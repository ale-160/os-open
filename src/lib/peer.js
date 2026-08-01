/**
 * P2P 网络层：PeerJS 封装。
 *
 * 设计要点：
 *  - PeerJS ID（传输地址）与 Ed25519 PeerID（身份）解耦：
 *      PeerJS ID 由信令服务器分配，仅用于建连；
 *      真正的身份是 Ed25519 公钥的 Base58，通过 hello 消息告知对端。
 *    这样既能在同一浏览器多标签页测试，也为后续迁移 libp2p 留出空间。
 *  - 星形拓扑：通过 peer.listAllPeers() 拿到所有在线 peer，主动连接。
 *  - 心跳保活 + 离线检测。
 *  - 房间消息广播给所有已连接 peer，由接收方按 room 过滤。
 */
import Peer from 'peerjs'
import { CONFIG, getSignaling, getAllSignalingServers } from '../config.js'
import {
  MsgType,
  AccessRule,
  SpeakRule,
  DEFAULT_RULES,
  Stars,
  buildMessage,
  verifyMessage
} from './protocol.js'
import {
  savePeer,
  deletePeer,
  saveRoom,
  getMessages,
  getRoomPassword,
  setRoomPassword,
  getStarsOverride,
  setStarsOverride,
  deleteRoomStars,
  getRoomBans,
  setBan,
  deleteRoomBans
} from './db.js'

const DEBUG = false
function dbg(...args) {
  if (DEBUG) console.log('[nchat]', ...args)
}

export class PeerNetwork extends EventTarget {
  /**
   * @param {object} identity  { privateKey, publicKey, peerId }
   * @param {string} ownName   用户昵称
   */
  constructor(identity, ownName) {
    super()
    this.identity = identity
    this.ownName = ownName || ''
    this.peer = null
    this.peerJsId = null

    // peerJsId -> { conn, peerId, name, lastSeen, status, rooms: Set }
    this.connections = new Map()
    // 已知房间聚合：name -> { name, members:Map, activity, lastUpdate, aliases:Set, rules, owner }
    this.knownRooms = new Map()

    this._heartbeatTimer = null
    this._discoveryTimer = null
    this._checkTimer = null
    this._started = false
    /** 本地已加入房间集合 */
    this._localRoomsSet = new Set()
    /** 本地房间元数据：roomName -> { aliases, rules, owner } */
    this._localRoomMeta = new Map()
    /** 本地房间密码内存缓存：roomName -> password（仅密码房间，已验证） */
    this._passwordCache = new Map()
    /** 当前使用的信令服务器 */
    this._activeServer = null
    /** 待处理的加入申请：roomName -> [{ peerId, name, timestamp }] */
    this._pendingJoinRequests = new Map()
    /** 已处理消息去重：msgId -> timestamp，避免 gossip 转发导致的重复 emit/转发 */
    this._processedMsgs = new Map()
  }

  /** 检查并标记消息是否已处理过（返回 true 表示首次处理） */
  _markProcessed(msgId) {
    if (this._processedMsgs.has(msgId)) return false
    this._processedMsgs.set(msgId, Date.now())
    // 清理超过 5 分钟的记录，避免内存泄漏
    if (this._processedMsgs.size > 500) {
      const cutoff = Date.now() - 5 * 60 * 1000
      for (const [id, ts] of this._processedMsgs) {
        if (ts < cutoff) this._processedMsgs.delete(id)
      }
    }
    return true
  }

  // ---------------- 生命周期 ----------------
  /**
   * 启动 P2P 连接。
   * @param {object} [explicitServer] 指定信令服务器（覆盖配置）
   */
  async start(explicitServer) {
    if (this._started) return
    this._started = true

    // 候选信令服务器列表：优先 explicitServer，否则当前激活项，最后全部
    const allServers = getAllSignalingServers()
    const active = getSignaling()
    const candidates = []
    if (explicitServer) candidates.push(explicitServer)
    candidates.push(active)
    for (const s of allServers) {
      if (!candidates.find((c) => c.host === s.host && c.port === s.port && c.path === s.path)) {
        candidates.push(s)
      }
    }

    // 逐个尝试，首个成功即用
    for (let i = 0; i < candidates.length; i++) {
      const server = candidates[i]
      try {
        await this._tryStartWith(server)
        this._activeServer = server
        return
      } catch (e) {
        console.warn(`[nchat] 信令服务器 ${server.host}:${server.port} 连接失败：`, e?.type || e?.message)
        this._emit('error', {
          type: 'server-failed',
          message: `${server.host}:${server.port} 不可用`
        })
        // 最后一个也失败才抛出
        if (i === candidates.length - 1) {
          this._started = false
          throw e
        }
      }
    }
  }

  _tryStartWith(server) {
    return new Promise((resolve, reject) => {
      const peer = new Peer(server)
      this.peer = peer

      let settled = false
      const settle = (fn, arg) => {
        if (settled) return
        settled = true
        fn(arg)
      }

      // 单服务器超时 8s，失败后尝试下一个
      const timeout = setTimeout(() => {
        if (!this.peerJsId) {
          settle(reject, { type: 'timeout', message: '信令服务器连接超时' })
        }
      }, 8000)

      peer.on('open', (id) => {
        clearTimeout(timeout)
        this.peerJsId = id
        dbg('peer:open peerJsId=', id, 'server=', server.host + ':' + server.port)
        this._emit('identity', { peerId: this.identity.peerId, peerJsId: id })
        this._emit('status', { online: true, server })
        settle(resolve)
        this._startTimers()
        this._discover()
      })

      peer.on('connection', (conn) => {
        dbg('peer:incoming from', conn.peer)
        this._attachConnection(conn)
      })

      peer.on('error', (err) => {
        console.warn('[nchat] Peer error:', err?.type, err?.message)
        this._emit('error', { type: err?.type, message: err?.message })
        if (!this.peerJsId) settle(reject, err)
      })

      peer.on('disconnected', () => {
        this._emit('status', { online: false, reason: 'disconnected' })
        setTimeout(() => {
          if (this.peer && !this.peer.destroyed) {
            try {
              this.peer.reconnect()
            } catch (e) {
              /* ignore */
            }
          }
        }, 2000)
      })
    })
  }

  /** 当前使用的信令服务器 */
  getActiveServer() {
    return this._activeServer || getSignaling()
  }

  async stop() {
    this._started = false
    this._stopTimers()
    // 通知离开所有房间
    for (const roomName of this.localRooms()) {
      await this._broadcast({ type: MsgType.LEAVE_ROOM, payload: { room: roomName } })
    }
    for (const { conn } of this.connections.values()) {
      try {
        conn.close()
      } catch (e) {
        /* ignore */
      }
    }
    this.connections.clear()
    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }
    this.peerJsId = null
  }

  setOwnName(name) {
    this.ownName = name
  }

  // ---------------- 连接管理 ----------------
  _attachConnection(conn) {
    const peerJsId = conn.peer
    if (this.connections.has(peerJsId)) {
      dbg('conn:skip duplicate', peerJsId)
      // 已有连接，关闭新的
      try {
        conn.close()
      } catch (e) {
        /* ignore */
      }
      return
    }
    dbg('conn:attach', peerJsId)
    this.connections.set(peerJsId, {
      conn,
      peerId: null,
      name: '',
      lastSeen: Date.now(),
      status: 'connecting',
      rooms: new Set(),
      helloExchanged: false
    })

    conn.on('open', async () => {
      dbg('conn:open', peerJsId)
      const entry = this.connections.get(peerJsId)
      if (entry) {
        entry.status = 'online'
        entry.lastSeen = Date.now()
      }
      // 主动发送 hello
      await this._sendHello(peerJsId)
      this._emitPeerStatus(peerJsId)
    })

    conn.on('data', (data) => {
      dbg('conn:data', peerJsId, data?.type)
      this._onData(peerJsId, data)
    })

    conn.on('close', () => {
      dbg('conn:close', peerJsId)
      this._handleDisconnect(peerJsId)
    })

    conn.on('error', (err) => {
      console.warn('[nchat] conn error:', err?.message)
      this._handleDisconnect(peerJsId)
    })
  }

  async _connectTo(peerJsId) {
    if (peerJsId === this.peerJsId) return
    if (this.connections.has(peerJsId)) return
    if (this.connections.size >= CONFIG.MAX_PEERS) return
    dbg('conn:connect to', peerJsId)
    const conn = this.peer.connect(peerJsId, {
      reliable: true,
      serialization: 'json'
    })
    this._attachConnection(conn)
  }

  _handleDisconnect(peerJsId) {
    const entry = this.connections.get(peerJsId)
    const peerId = entry?.peerId
    this.connections.delete(peerJsId)
    if (peerId) deletePeer(peerId)

    // 继承制：如果离线者是某房间的 owner，由星标最高的在线成员继承
    if (peerId) {
      for (const [roomName, r] of this.knownRooms) {
        if (r.owner === peerId) {
          this._handleInheritance(roomName, peerId)
        }
      }
    }

    this._recomputeRooms()
    this._emit('peer:disconnected', { peerJsId, peerId })
  }

  /**
   * 处理房间继承：owner 下线后，由星标最高的在线成员继承
   * 无继承者时，如果本地也不在房间，则房间销毁
   */
  _handleInheritance(roomName, oldOwner) {
    const r = this.knownRooms.get(roomName)
    if (!r) return
    // 找在线成员中星标最高的
    let bestPeer = null
    let bestStars = 0
    for (const [peerId, info] of r.members) {
      if (peerId === oldOwner) continue
      if (info.stars > bestStars && info.stars >= Stars.MIN_INHERIT) {
        bestStars = info.stars
        bestPeer = peerId
      }
    }
    if (bestPeer) {
      // 继承
      r.owner = bestPeer
      const member = r.members.get(bestPeer)
      if (member) member.stars = Stars.CREATOR
      // 更新本地元数据
      const meta = this._localRoomMeta.get(roomName)
      if (meta) meta.owner = bestPeer
      this._emit('member:update', { room: roomName })
    } else {
      // 无继承者：如果本地不在房间，销毁
      if (!this._localRoomsSet.has(roomName)) {
        this.knownRooms.delete(roomName)
        deleteRoomStars(roomName)
      }
    }
  }

  /**
   * 设置成员星标（仅 owner 可操作）
   */
  async setMemberStars(room, peerId, stars) {
    const r = this.knownRooms.get(room)
    const meta = this._localRoomMeta.get(room)
    const owner = meta?.owner || r?.owner
    if (owner !== this.identity.peerId) return false
    if (peerId === this.identity.peerId) return false
    // 更新本地
    if (r && r.members.has(peerId)) {
      r.members.get(peerId).stars = stars
    }
    setStarsOverride(room, peerId, stars)
    // 广播给其他节点
    await this._broadcast({
      type: MsgType.SET_STARS,
      payload: { room, peerId, stars }
    })
    this._recomputeRooms()
    this._emit('member:update', { room })
    return true
  }

  /**
   * 更新房间规则（仅 owner 可操作）
   * @param {string} room
   * @param {object} rulesPatch { access?, speak?, whitelist?, approveThreshold? }
   */
  async setRoomRules(room, rulesPatch) {
    const r = this.knownRooms.get(room)
    const meta = this._localRoomMeta.get(room)
    const owner = meta?.owner || r?.owner
    if (owner !== this.identity.peerId) return false
    if (meta) {
      meta.rules = { ...meta.rules, ...rulesPatch }
      // 删除不可广播的字段
      delete meta.rules.passwordHash
    }
    if (r) {
      r.rules = { ...r.rules, ...rulesPatch }
      delete r.rules.passwordHash
    }
    // 重新广播 hello 让其他节点学习新规则
    for (const id of this.connections.keys()) {
      await this._sendHello(id)
    }
    this._recomputeRooms()
    this._emit('member:update', { room })
    return true
  }

  // ---------------- 数据收发 ----------------
  async _send(peerJsId, msg) {
    const entry = this.connections.get(peerJsId)
    if (!entry || !entry.conn.open) return false
    try {
      entry.conn.send(msg)
      return true
    } catch (e) {
      console.warn('[nchat] send failed:', e?.message)
      return false
    }
  }

  async _sendRaw(peerJsId, partial, to = '') {
    const msg = await buildMessage(
      {
        type: partial.type,
        from: this.identity.peerId,
        to,
        payload: partial.payload || {},
        extensions: partial.extensions || { name: this.ownName }
      },
      this.identity.privateKey
    )
    return this._send(peerJsId, msg)
  }

  async _broadcast(partial, to = '') {
    const msg = await buildMessage(
      {
        type: partial.type,
        from: this.identity.peerId,
        to,
        payload: partial.payload || {},
        extensions: { ...(partial.extensions || {}), name: this.ownName }
      },
      this.identity.privateKey
    )
    const targets = [...this.connections.keys()]
    await Promise.all(targets.map((id) => this._send(id, msg)))
  }

  async _sendHello(peerJsId) {
    const rooms = this.localRooms().map((name) => {
      const meta = this._localRoomMeta.get(name)
      return {
        name,
        aliases: meta?.aliases || [],
        rules: meta?.rules || { ...DEFAULT_RULES },
        owner: this.identity.peerId
      }
    })
    await this._sendRaw(
      peerJsId,
      {
        type: MsgType.HELLO,
        payload: { name: this.ownName, rooms }
      }
    )
  }

  async _onData(peerJsId, data) {
    if (!data || typeof data !== 'object') return
    const entry = this.connections.get(peerJsId)
    if (!entry) return
    entry.lastSeen = Date.now()
    if (entry.status !== 'online') {
      entry.status = 'online'
      this._emitPeerStatus(peerJsId)
    }

    // 校验签名
    const ok = await verifyMessage(data)
    if (!ok) {
      console.warn('[nchat] 签名校验失败，丢弃：', data?.type, data?.from)
      return
    }

    // 学习对端身份
    if (data.from && data.from !== entry.peerId) {
      entry.peerId = data.from
      entry.name = data.extensions?.name || entry.name
      await savePeer({
        id: data.from,
        name: entry.name,
        peerJsId,
        lastSeen: Date.now()
      })
      this._emit('peer:connected', {
        peerJsId,
        peerId: data.from,
        name: entry.name
      })
    }

    switch (data.type) {
      case MsgType.HELLO:
        await this._onHello(peerJsId, data)
        break
      case MsgType.HEARTBEAT:
        // 仅更新 lastSeen，已处理
        break
      case MsgType.JOIN_ROOM:
        await this._onJoinRoom(peerJsId, data)
        break
      case MsgType.LEAVE_ROOM:
        this._onLeaveRoom(peerJsId, data)
        break
      case MsgType.ROOM_MESSAGE:
        this._onRoomMessage(data)
        break
      case MsgType.ROOM_LIST:
        this._onRoomList(data)
        break
      case MsgType.QUERY_ROOMS:
        await this._onQueryRooms(peerJsId, data)
        break
      case MsgType.HISTORY_REQUEST:
        await this._onHistoryRequest(peerJsId, data)
        break
      case MsgType.HISTORY_RESPONSE:
        this._onHistoryResponse(data)
        break
      case MsgType.JOIN_REJECTED:
        this._emit('join:rejected', { room: data.payload?.room, reason: data.payload?.reason })
        break
      case MsgType.JOIN_APPROVED:
        await this._onJoinApproved(peerJsId, data)
        break
      case MsgType.JOIN_REQUEST:
        await this._onJoinRequest(peerJsId, data)
        break
      case MsgType.INVITE:
        this._onInvite(data)
        break
      case MsgType.SET_STARS:
        this._onSetStars(data)
        break
      case MsgType.BAN_UPDATE:
        this._onBanUpdate(data)
        break
      case MsgType.FILE_MESSAGE:
        this._onFileMessage(data)
        break
    }
  }

  /** 收到加入申请（审核制房间） */
  async _onJoinRequest(peerJsId, msg) {
    const room = msg.payload?.room
    if (!room) return
    // 判断我们是否有审核权限：owner 或星标 >= approveThreshold
    const meta = this._localRoomMeta.get(room)
    const known = this.knownRooms.get(room)
    const rules = meta?.rules || known?.rules
    if (!rules) return
    // 仅当我们在该房间内时才处理
    if (!this._localRoomsSet.has(room)) return
    const owner = meta?.owner || known?.owner
    const isOwner = owner === this.identity.peerId
    const threshold = rules.approveThreshold ?? DEFAULT_RULES.approveThreshold
    const myStars = this._getMyStars(room)
    const canApprove = isOwner || myStars >= threshold
    if (!canApprove) return
    // 加入待处理队列
    const list = this._pendingJoinRequests.get(room) || []
    // 去重（同一 peerId 只保留最新）
    const filtered = list.filter((r) => r.peerId !== msg.from)
    filtered.push({
      peerId: msg.from,
      name: msg.extensions?.name || msg.from.slice(0, 8),
      timestamp: Date.now(),
      peerJsId
    })
    this._pendingJoinRequests.set(room, filtered)
    this._emit('join:request', {
      room,
      peerId: msg.from,
      name: msg.extensions?.name || msg.from.slice(0, 8)
    })
  }

  /** 收到加入批准 */
  async _onJoinApproved(peerJsId, msg) {
    const room = msg.payload?.room
    if (!room) return
    // 真正加入房间
    if (!this._localRoomsSet.has(room)) {
      await this.joinRoom(room)
    }
    this._emit('join:approved', { room })
  }

  /** 收到邀请 */
  _onInvite(msg) {
    const room = msg.payload?.room
    if (!room) return
    this._emit('invite', {
      room,
      from: msg.from,
      name: msg.extensions?.name || msg.from.slice(0, 8)
    })
  }

  /** 收到星标调整广播 */
  _onSetStars(msg) {
    const { room, peerId, stars } = msg.payload || {}
    if (!room || !peerId) return
    const r = this.knownRooms.get(room)
    if (r && r.members.has(peerId)) {
      r.members.get(peerId).stars = stars
    }
    // 本地持久化覆盖
    setStarsOverride(room, peerId, stars)
    this._emit('member:update', { room })
  }

  /** 获取自己在某房间的星标 */
  _getMyStars(room) {
    const r = this.knownRooms.get(room)
    const meta = this._localRoomMeta.get(room)
    const owner = meta?.owner || r?.owner
    if (owner === this.identity.peerId) return Stars.CREATOR
    const override = getStarsOverride(room)
    if (override[this.identity.peerId] !== undefined) {
      return override[this.identity.peerId]
    }
    return Stars.DEFAULT
  }

  /**
   * 批准加入申请（仅 owner 或星标达标的成员可操作）
   */
  async approveJoin(room, peerId) {
    const meta = this._localRoomMeta.get(room)
    const known = this.knownRooms.get(room)
    const rules = meta?.rules || known?.rules
    if (!rules) return false
    const owner = meta?.owner || known?.owner
    const isOwner = owner === this.identity.peerId
    const threshold = rules.approveThreshold ?? DEFAULT_RULES.approveThreshold
    const myStars = this._getMyStars(room)
    if (!isOwner && myStars < threshold) return false
    // 从待处理队列移除
    const list = this._pendingJoinRequests.get(room) || []
    const req = list.find((r) => r.peerId === peerId)
    const filtered = list.filter((r) => r.peerId !== peerId)
    this._pendingJoinRequests.set(room, filtered)
    if (req) {
      await this._sendRaw(req.peerJsId, {
        type: MsgType.JOIN_APPROVED,
        payload: { room }
      }, peerId)
    }
    this._emit('join:request:update', { room })
    return true
  }

  /**
   * 拒绝加入申请
   */
  async rejectJoin(room, peerId, reason = '申请被拒绝') {
    const list = this._pendingJoinRequests.get(room) || []
    const req = list.find((r) => r.peerId === peerId)
    const filtered = list.filter((r) => r.peerId !== peerId)
    this._pendingJoinRequests.set(room, filtered)
    if (req) {
      await this._sendRaw(req.peerJsId, {
        type: MsgType.JOIN_REJECTED,
        payload: { room, reason }
      }, peerId)
    }
    this._emit('join:request:update', { room })
    return true
  }

  /**
   * 邀请某节点加入房间（INVITE 制房间）
   */
  async inviteMember(room, peerId) {
    const meta = this._localRoomMeta.get(room)
    const known = this.knownRooms.get(room)
    const owner = meta?.owner || known?.owner
    const isOwner = owner === this.identity.peerId
    const rules = meta?.rules || known?.rules
    const threshold = rules?.approveThreshold ?? DEFAULT_RULES.approveThreshold
    const myStars = this._getMyStars(room)
    if (!isOwner && myStars < threshold) return false
    // 找到该 peerId 对应的连接
    let targetPeerJsId = null
    for (const [pid, entry] of this.connections) {
      if (entry.peerId === peerId) {
        targetPeerJsId = pid
        break
      }
    }
    if (!targetPeerJsId) return false
    await this._sendRaw(targetPeerJsId, {
      type: MsgType.INVITE,
      payload: { room }
    }, peerId)
    return true
  }

  /** 获取某房间的待处理加入申请 */
  getPendingJoinRequests(room) {
    return this._pendingJoinRequests.get(room) || []
  }

  // ---------------- 协议处理 ----------------
  async _onHello(peerJsId, msg) {
    const entry = this.connections.get(peerJsId)
    if (!entry) return
    entry.name = msg.payload?.name || entry.name
    // 学习对端所在房间（含别名和规则）
    const rooms = msg.payload?.rooms || []
    for (const r of rooms) {
      entry.rooms.add(r.name)
      this._mergeRoom(r.name, peerJsId, entry.peerId, entry.name, null, null, r.aliases, r.rules, r.owner)
    }
    // 仅在首次 hello 时回复，避免无限 hello 循环
    if (!entry.helloExchanged) {
      entry.helloExchanged = true
      await this._sendHello(peerJsId)
      await this._sendRoomList(peerJsId)
    }
    this._recomputeRooms()
  }

  async _onJoinRoom(peerJsId, msg) {
    const room = msg.payload?.room
    if (!room) return

    // 密码验证：仅当我们是该密码房间的成员（持有密码）时才验证
    // 密码不通过 rules 广播，仅由已加入的在线成员持有
    const known = this.knownRooms.get(room)
    const isPasswordRoom = known?.rules?.access === AccessRule.PASSWORD ||
      this._localRoomMeta.get(room)?.rules?.access === AccessRule.PASSWORD
    const weHavePassword = this._passwordCache.has(room) || getRoomPassword(room)

    if (isPasswordRoom && weHavePassword && this._localRoomsSet.has(room)) {
      const expected = this._passwordCache.get(room) || getRoomPassword(room)
      const provided = msg.payload?.password || ''
      if (provided !== expected) {
        await this._sendRaw(peerJsId, {
          type: MsgType.JOIN_REJECTED,
          payload: { room, reason: '密码错误' }
        }, msg.from)
        return
      }
      // 密码正确，新成员也缓存密码
    }

    const entry = this.connections.get(peerJsId)
    if (entry) entry.rooms.add(room)
    this._mergeRoom(room, peerJsId, msg.from, msg.extensions?.name || entry?.name)
    this._recomputeRooms()
    this._emit('member:update', { room })
  }

  _onLeaveRoom(peerJsId, msg) {
    const room = msg.payload?.room
    if (!room) return
    const entry = this.connections.get(peerJsId)
    if (entry) entry.rooms.delete(room)
    this._removeMember(room, msg.from)
    this._recomputeRooms()
    this._emit('member:update', { room })
  }

  _onRoomMessage(msg) {
    const room = msg.payload?.room
    const text = msg.payload?.text
    if (!room || !text) return

    // 去重：同一条消息只处理一次（emit + 转发），避免 gossip 转发导致的重复
    if (!this._markProcessed(msg.id)) return

    const known = this.knownRooms.get(room)
    // 发言规则过滤：白名单模式下，非白名单成员的消息丢弃
    if (known && known.rules && known.rules.speak === SpeakRule.WHITELIST) {
      if (!Array.isArray(known.rules.whitelist) || !known.rules.whitelist.includes(msg.from)) {
        return
      }
    }

    // 放逐/屏蔽过滤：判断该消息是否应被本地屏蔽
    if (this._isMessageBanned(room, msg.from)) {
      dbg('消息被屏蔽：', room, msg.from)
      return
    }

    const chatMsg = {
      id: msg.id,
      room,
      from: msg.from,
      name: msg.extensions?.name || msg.from.slice(0, 8),
      text,
      timestamp: msg.timestamp
    }
    this._emit('chat', chatMsg)
    // 转发给房间内其他未直连的 peer（gossip 式简化：直接广播给除发送者外的所有连接）
    // 注意：为避免环路，仅当 from 不是我们时转发
    if (msg.from !== this.identity.peerId) {
      this._forward(msg)
    }
  }

  /**
   * 判断消息是否应被本地屏蔽
   * 屏蔽规则（取最高阈值，避免规则臃肿）：
   *  1. 房间默认屏蔽：owner 设置的 banBelowStars，星标 < 此值的成员发言被所有人屏蔽
   *  2. 个人屏蔽：本地用户设置的屏蔽阈值，屏蔽星标 < 阈值的用户发言
   *     注：屏蔽方自身星标必须 >= 阈值，被屏蔽方星标 < 阈值
   *     即"屏蔽 10 星标用户"时，自身和 >= 10 星标的不受影响，< 10 星标的被屏蔽
   */
  _isMessageBanned(room, fromPeerId) {
    if (fromPeerId === this.identity.peerId) return false
    const known = this.knownRooms.get(room)
    if (!known) return false
    const memberInfo = known.members.get(fromPeerId)
    const senderStars = memberInfo?.stars || Stars.DEFAULT

    // 房间默认屏蔽规则
    const roomBan = known.rules?.banBelowStars || 0
    if (roomBan > 0 && senderStars < roomBan) {
      return true
    }

    // 个人屏蔽规则：本地用户在房间内设置的屏蔽阈值（key '__me__'）
    const localBans = getRoomBans(room)
    const myBanThreshold = localBans['__me__']
    if (myBanThreshold && senderStars < myBanThreshold) {
      return true
    }

    return false
  }

  /**
   * 设置个人屏蔽规则：屏蔽房间内星标 < banBelowStars 的用户
   * @param {string} room 房间名
   * @param {number} banBelowStars 屏蔽阈值（0 表示取消屏蔽）
   */
  async setBanRule(room, banBelowStars) {
    if (!this._localRoomsSet.has(room)) return false
    // 本地用户的星标必须 >= 屏蔽阈值（不能屏蔽同级或更高）
    const known = this.knownRooms.get(room)
    const myInfo = known?.members.get(this.identity.peerId)
    const myStars = myInfo?.stars || Stars.DEFAULT
    if (banBelowStars > myStars) {
      this._emit('error', { type: 'ban-denied', message: '不能屏蔽星标高于自身的用户' })
      return false
    }
    // 存储到本地（key 用特殊标识表示"我的全局屏蔽阈值"）
    setBan(room, '__me__', banBelowStars)
    // 广播给其他节点，让它们知道本地用户的屏蔽偏好（用于UI显示）
    await this._broadcast({
      type: MsgType.BAN_UPDATE,
      payload: { room, banBelowStars }
    })
    this._emit('ban:update', { room, banBelowStars })
    return true
  }

  /**
   * 设置房间默认屏蔽规则（仅 owner 可操作）
   * @param {string} room 房间名
   * @param {number} banBelowStars 屏蔽阈值（0 表示取消）
   */
  async setRoomBanRule(room, banBelowStars) {
    const known = this.knownRooms.get(room)
    const meta = this._localRoomMeta.get(room)
    const owner = meta?.owner || known?.owner
    if (owner !== this.identity.peerId) return false
    return this.setRoomRules(room, { banBelowStars })
  }

  /** 处理收到的屏蔽规则更新 */
  _onBanUpdate(msg) {
    const room = msg.payload?.room
    const banBelowStars = msg.payload?.banBelowStars || 0
    if (!room) return
    // 记录该 peer 的屏蔽偏好（用于 UI 显示，不影响本地消息过滤）
    const known = this.knownRooms.get(room)
    if (known && known.members.has(msg.from)) {
      known.members.get(msg.from).banBelowStars = banBelowStars
    }
    this._emit('member:update', { room })
  }

  async _forward(msg) {
    // 广播给除原发送者外的所有连接
    const targets = [...this.connections.keys()].filter((id) => {
      const e = this.connections.get(id)
      return e && e.peerId !== msg.from
    })
    await Promise.all(targets.map((id) => this._send(id, msg)))
  }

  _onRoomList(msg) {
    const rooms = msg.payload?.rooms || []
    for (const r of rooms) {
      this._mergeRoom(r.name, null, msg.from, msg.extensions?.name, r.memberCount, r.activity, r.aliases, r.rules, r.owner)
    }
    this._recomputeRooms()
  }

  async _onQueryRooms(peerJsId, msg) {
    await this._sendRoomList(peerJsId, msg.payload?.keyword)
  }

  async _onHistoryRequest(peerJsId, msg) {
    const { room, since } = msg.payload || {}
    if (!room) return
    const messages = await getMessages(room, since || 0)
    await this._sendRaw(
      peerJsId,
      {
        type: MsgType.HISTORY_RESPONSE,
        payload: { room, messages }
      },
      msg.from
    )
  }

  _onHistoryResponse(msg) {
    const room = msg.payload?.room
    const messages = msg.payload?.messages || []
    if (!room) return
    this._emit('history', { room, messages })
  }

  // ---------------- 房间聚合 ----------------
  _mergeRoom(name, peerJsId, peerId, name2, memberCount, activity, aliases, rules, owner, stars) {
    let r = this.knownRooms.get(name)
    if (!r) {
      r = {
        name,
        members: new Map(), // peerId -> { peerJsId, name, stars }
        activity: 0,
        lastUpdate: Date.now(),
        aliases: new Set(),
        rules: { ...DEFAULT_RULES },
        owner: null
      }
      this.knownRooms.set(name, r)
    }
    if (peerId) {
      // 计算星标：owner=99, 其余看本地覆盖或默认1
      let s = Stars.DEFAULT
      if (owner && peerId === owner) s = Stars.CREATOR
      const override = getStarsOverride(name)
      if (override[peerId] !== undefined) s = override[peerId]
      if (stars !== undefined && stars !== null) s = stars
      const existing = r.members.get(peerId)
      r.members.set(peerId, { peerJsId, name: name2, stars: s })
    }
    if (typeof memberCount === 'number') {
      r.activity = Math.max(r.activity, activity || 0)
    }
    if (Array.isArray(aliases)) {
      for (const a of aliases) {
        if (a) r.aliases.add(a)
      }
    }
    if (rules && typeof rules === 'object') {
      // 不合并 passwordHash（密码不广播）
      const safeRules = { ...rules }
      delete safeRules.passwordHash
      r.rules = { ...r.rules, ...safeRules }
    }
    if (owner) {
      r.owner = owner
    }
    r.lastUpdate = Date.now()
  }

  _removeMember(room, peerId) {
    const r = this.knownRooms.get(room)
    if (!r) return
    r.members.delete(peerId)
  }

  _recomputeRooms() {
    const list = []
    for (const [name, r] of this.knownRooms) {
      // 清理无成员且本地不在的房间
      const localIn = this._localRoomsSet.has(name)
      if (r.members.size === 0 && !localIn) {
        this.knownRooms.delete(name)
        continue
      }
      // 合并本地元数据中的别名和规则
      const meta = this._localRoomMeta.get(name)
      const aliases = new Set(r.aliases)
      if (meta?.aliases) {
        for (const a of meta.aliases) aliases.add(a)
      }
      list.push({
        name,
        memberCount: r.members.size + (localIn && !r.members.has(this.identity.peerId) ? 1 : 0),
        activity: r.activity,
        lastUpdate: r.lastUpdate,
        aliases: [...aliases],
        rules: meta?.rules || r.rules,
        owner: meta?.owner || r.owner
      })
    }
    // 补上本地有但 knownRooms 没有的房间
    for (const name of this._localRoomsSet) {
      if (list.find((x) => x.name === name)) continue
      const meta = this._localRoomMeta.get(name)
      list.push({
        name,
        memberCount: 1,
        activity: 0,
        lastUpdate: Date.now(),
        aliases: meta?.aliases || [],
        rules: meta?.rules || { ...DEFAULT_RULES },
        owner: meta?.owner || this.identity.peerId
      })
    }
    // 持久化（异步）
    this._persistRooms(list)
    this._emit('rooms', this._sortRooms(list))
  }

  async _persistRooms(list) {
    try {
      // 只持久化已加入的房间，未加入的房间不存储到本地
      for (const r of list) {
        if (this._localRoomsSet.has(r.name)) {
          await saveRoom(r)
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  _sortRooms(list) {
    return list.sort((a, b) => {
      if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount
      if (b.lastUpdate !== a.lastUpdate) return b.lastUpdate - a.lastUpdate
      return a.name.localeCompare(b.name)
    })
  }

  _buildRoomList(keyword) {
    let rooms = []
    for (const [name, r] of this.knownRooms) {
      const localIn = this._localRoomsSet.has(name)
      // 合并本地元数据中的别名和规则
      const meta = this._localRoomMeta.get(name)
      const aliases = new Set(r.aliases)
      if (meta?.aliases) {
        for (const a of meta.aliases) aliases.add(a)
      }
      rooms.push({
        name,
        memberCount: r.members.size + (localIn ? 1 : 0),
        activity: r.activity,
        lastUpdate: r.lastUpdate,
        aliases: [...aliases],
        rules: meta?.rules || r.rules,
        owner: meta?.owner || r.owner
      })
    }
    // 若本地有而聚合表没有的房间，补上（含本地元数据）
    for (const name of this._localRoomsSet) {
      if (!rooms.find((x) => x.name === name)) {
        const meta = this._localRoomMeta.get(name)
        rooms.push({
          name,
          memberCount: 1,
          activity: 0,
          lastUpdate: Date.now(),
          aliases: meta?.aliases || [],
          rules: meta?.rules || { ...DEFAULT_RULES },
          owner: this.identity.peerId
        })
      }
    }
    if (keyword) {
      const kw = keyword.toLowerCase()
      // 同时匹配房间名和别名
      rooms = rooms.filter((r) => {
        if (r.name.toLowerCase().includes(kw)) return true
        if (Array.isArray(r.aliases)) {
          return r.aliases.some((a) => a.toLowerCase().includes(kw))
        }
        return false
      })
    }
    return rooms
  }

  async _sendRoomList(peerJsId, keyword) {
    const rooms = this._buildRoomList(keyword)
    await this._sendRaw(
      peerJsId,
      {
        type: MsgType.ROOM_LIST,
        payload: { rooms }
      }
    )
  }

  // ---------------- 本地房间 ----------------
  localRooms() {
    return [...this._localRoomsSet]
  }

  /**
   * 创建房间（设置别名和规则后加入）
   * @param {string} room  房间名
   * @param {object} options { aliases, access, speak, password, whitelist, approveThreshold }
   */
  async createRoom(room, options = {}) {
    // 构建规则（不广播 passwordHash，密码由在线成员持有并验证）
    const rules = { ...DEFAULT_RULES }
    if (options.access) rules.access = options.access
    if (options.speak) rules.speak = options.speak
    if (options.password) {
      rules.access = AccessRule.PASSWORD
      // 密码存本地（内存 + localStorage），不放入 rules 广播
      this._passwordCache.set(room, options.password)
      setRoomPassword(room, options.password)
    }
    if (typeof options.approveThreshold === 'number') {
      rules.approveThreshold = options.approveThreshold
    }
    if (Array.isArray(options.whitelist)) {
      rules.whitelist = options.whitelist
    }
    const aliases = (options.aliases || [])
      .filter((a) => a && typeof a === 'string')
      .slice(0, CONFIG.MAX_ALIASES)

    this._localRoomMeta.set(room, { aliases, rules, owner: this.identity.peerId })

    // 已在房间则先离开再重新加入（应用新规则）
    if (this._localRoomsSet.has(room)) {
      await this.leaveRoom(room)
    }
    await this.joinRoom(room)

    // 主动向所有连接广播 hello
    for (const id of this.connections.keys()) {
      await this._sendHello(id)
    }
  }

  async joinRoom(room, password) {
    if (this._localRoomsSet.has(room)) return
    this._localRoomsSet.add(room)

    // 密码房间：优先用传入密码，其次用已缓存的密码（避免重复输入）
    let actualPassword = password || ''
    if (!actualPassword) {
      actualPassword = this._passwordCache.get(room) || getRoomPassword(room) || ''
    }
    if (actualPassword) {
      this._passwordCache.set(room, actualPassword)
      setRoomPassword(room, actualPassword)
    }

    // 继承已知房间的元数据（别名/规则），没有则用默认
    if (!this._localRoomMeta.has(room)) {
      const known = this.knownRooms.get(room)
      const hasOwner = known?.owner && known.members.has(known.owner)
      this._localRoomMeta.set(room, {
        aliases: known ? [...known.aliases] : [],
        rules: known ? { ...known.rules } : { ...DEFAULT_RULES },
        owner: hasOwner ? known.owner : this.identity.peerId
      })
    }
    this._mergeRoom(room, this.peerJsId, this.identity.peerId, this.ownName)
    this._recomputeRooms()
    await this._broadcast({
      type: MsgType.JOIN_ROOM,
      payload: { room, password: actualPassword }
    })
    await this.requestHistory(room, 0)
    this._emit('member:update', { room })
  }

  /**
   * 请求加入审核制房间（不直接加入，等待 owner/有权限成员批准）
   * 向房间内已知的、有审核权限的成员发送 JOIN_REQUEST
   */
  async requestJoinRoom(room, password) {
    const known = this.knownRooms.get(room)
    if (!known) {
      this._emit('error', { type: 'join_failed', message: '未找到该房间的在线成员' })
      return false
    }
    const rules = known.rules || { ...DEFAULT_RULES }
    const threshold = rules.approveThreshold ?? DEFAULT_RULES.approveThreshold
    // 找到有审核权限的成员（owner 或 stars >= threshold）
    const targets = []
    for (const [peerId, info] of known.members) {
      if (peerId === this.identity.peerId) continue
      if (peerId === known.owner || info.stars >= threshold) {
        // 找到对应的 peerJsId
        for (const [pid, entry] of this.connections) {
          if (entry.peerId === peerId) {
            targets.push(pid)
            break
          }
        }
      }
    }
    if (targets.length === 0) {
      this._emit('error', { type: 'join_failed', message: '暂无有审核权限的在线成员' })
      return false
    }
    const payload = { room }
    if (password) payload.password = password
    for (const pid of targets) {
      await this._sendRaw(pid, {
        type: MsgType.JOIN_REQUEST,
        payload
      })
    }
    this._emit('join:requested', { room })
    return true
  }

  /**
   * 重启并切换到指定信令服务器
   */
  async restartWithServer(server) {
    await this.stop()
    this._started = false
    this.peerJsId = null
    this.connections.clear()
    this._activeServer = null
    await this.start(server)
  }

  async leaveRoom(room) {
    if (!this._localRoomsSet.has(room)) return
    this._localRoomsSet.delete(room)
    this._removeMember(room, this.identity.peerId)
    this._recomputeRooms()
    await this._broadcast({
      type: MsgType.LEAVE_ROOM,
      payload: { room }
    })
    this._emit('member:update', { room })
  }

  async sendRoomMessage(room, text) {
    if (!this._localRoomsSet.has(room)) {
      // 自动加入
      await this.joinRoom(room)
    }

    // 发言规则校验
    const meta = this._localRoomMeta.get(room)
    const known = this.knownRooms.get(room)
    const rules = meta?.rules || known?.rules
    if (rules && rules.speak === SpeakRule.WHITELIST) {
      if (!Array.isArray(rules.whitelist) || !rules.whitelist.includes(this.identity.peerId)) {
        this._emit('error', { type: 'speak_denied', message: '你不在该房间的发言白名单中' })
        return false
      }
    }
    // approve 模式：MVP 暂不实现完整审核流程，后续版本处理

    const msg = await buildMessage(
      {
        type: MsgType.ROOM_MESSAGE,
        from: this.identity.peerId,
        to: room,
        payload: { room, text },
        extensions: { name: this.ownName }
      },
      this.identity.privateKey
    )
    // 标记为已处理，避免收到对端转发回来时重复显示
    this._markProcessed(msg.id)
    // 本地立即可见
    this._emit('chat', {
      id: msg.id,
      room,
      from: msg.from,
      name: this.ownName,
      text,
      timestamp: msg.timestamp
    })
    await this._broadcast(msg)
    return true
  }

  /**
   * 发送文件消息
   * @param {string} room 房间名
   * @param {File} file 文件对象
   */
  async sendFileMessage(room, file) {
    if (!this._localRoomsSet.has(room)) {
      await this.joinRoom(room)
    }
    // 限制文件大小（WebRTC DataChannel 单条消息建议 < 16MB，这里限制 8MB 保险）
    const MAX_FILE_SIZE = 8 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      this._emit('error', { type: 'file_too_large', message: `文件超过 8MB 限制（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` })
      return false
    }
    // 读取文件为 base64
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

    const msg = await buildMessage(
      {
        type: MsgType.FILE_MESSAGE,
        from: this.identity.peerId,
        to: room,
        payload: {
          room,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          dataUrl
        },
        extensions: { name: this.ownName }
      },
      this.identity.privateKey
    )
    this._markProcessed(msg.id)
    // 本地立即可见
    this._emit('chat', {
      id: msg.id,
      room,
      from: msg.from,
      name: this.ownName,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl
      },
      timestamp: msg.timestamp
    })
    await this._broadcast(msg)
    return true
  }

  /** 处理收到的文件消息 */
  _onFileMessage(msg) {
    const room = msg.payload?.room
    const dataUrl = msg.payload?.dataUrl
    if (!room || !dataUrl) return

    if (!this._markProcessed(msg.id)) return

    // 屏蔽过滤
    if (this._isMessageBanned(room, msg.from)) return

    this._emit('chat', {
      id: msg.id,
      room,
      from: msg.from,
      name: msg.extensions?.name || msg.from.slice(0, 8),
      file: {
        name: msg.payload.fileName,
        type: msg.payload.fileType,
        size: msg.payload.fileSize,
        dataUrl
      },
      timestamp: msg.timestamp
    })

    if (msg.from !== this.identity.peerId) {
      this._forward(msg)
    }
  }

  async queryRooms(keyword) {
    await this._broadcast({
      type: MsgType.QUERY_ROOMS,
      payload: keyword ? { keyword } : {}
    })
    // 本地房间已在 rooms.value 中，由 filteredRooms computed 负责过滤显示
    // 不再用 _buildRoomList(keyword) 替换 rooms.value，避免清空未匹配的房间
  }

  async requestHistory(room, since) {
    await this._broadcast(
      {
        type: MsgType.HISTORY_REQUEST,
        payload: { room, since }
      },
      room
    )
  }

  // ---------------- 心跳与发现 ----------------
  _startTimers() {
    this._heartbeatTimer = setInterval(() => {
      try {
        this._broadcast({ type: MsgType.HEARTBEAT, payload: {} })
      } catch (e) {
        /* ignore */
      }
    }, CONFIG.HEARTBEAT_INTERVAL)

    this._discoveryTimer = setInterval(() => {
      try {
        this._discover()
      } catch (e) {
        /* ignore */
      }
    }, CONFIG.DISCOVERY_INTERVAL)

    this._checkTimer = setInterval(() => {
      try {
        this._checkLiveness()
      } catch (e) {
        /* ignore */
      }
    }, 2000)
  }

  _stopTimers() {
    clearInterval(this._heartbeatTimer)
    clearInterval(this._discoveryTimer)
    clearInterval(this._checkTimer)
    this._heartbeatTimer = this._discoveryTimer = this._checkTimer = null
  }

  _discover() {
    if (!this.peer || this.peer.destroyed) return
    if (typeof this.peer.listAllPeers !== 'function') return
    if (!this.peerJsId) return
    // PeerJS 的 listAllPeers 是回调式（不返回 Promise），
    // 且需要信令 socket 已连接；未连接时回调可能不触发，需防御。
    let done = false
    const finish = (ids) => {
      if (done) return
      done = true
      dbg('discover:result', Array.isArray(ids) ? ids.length + ' peers' : 'non-array', ids)
      if (!Array.isArray(ids)) return
      for (const id of ids) {
        if (id !== this.peerJsId && !this.connections.has(id)) {
          this._connectTo(id)
        }
      }
    }
    try {
      const ret = this.peer.listAllPeers((...args) => {
        // 兼容 (err, peers) 与 (peers) 两种回调签名
        if (args.length >= 2) finish(args[1])
        else if (args.length === 1) finish(Array.isArray(args[0]) ? args[0] : [])
        else finish([])
      })
      // 若实现返回了 Promise，也兼容
      if (ret && typeof ret.then === 'function') {
        ret.then(finish).catch(() => finish([]))
      }
    } catch (e) {
      dbg('discover:error', e?.message)
    }
    // 兜底：3s 内回调未触发则放弃本次（不阻塞）
    setTimeout(() => finish([]), 3000)
  }

  _checkLiveness() {
    const now = Date.now()
    for (const [peerJsId, entry] of this.connections) {
      const elapsed = now - entry.lastSeen
      let newStatus = entry.status
      if (elapsed > CONFIG.HEARTBEAT_OFFLINE) {
        // 离线：关闭连接
        try {
          entry.conn.close()
        } catch (e) {
          /* ignore */
        }
        this._handleDisconnect(peerJsId)
        continue
      } else if (elapsed > CONFIG.HEARTBEAT_UNSTABLE) {
        newStatus = 'unstable'
      } else {
        newStatus = 'online'
      }
      if (newStatus !== entry.status) {
        entry.status = newStatus
        this._emitPeerStatus(peerJsId)
      }
    }
  }

  _emitPeerStatus(peerJsId) {
    const entry = this.connections.get(peerJsId)
    if (!entry) return
    this._emit('peer:status', {
      peerJsId,
      peerId: entry.peerId,
      name: entry.name,
      status: entry.status
    })
  }

  // ---------------- 事件工具 ----------------
  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }
}
