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
  BinKind,
  AccessRule,
  SpeakRule,
  DEFAULT_RULES,
  Stars,
  NodeRole,
  DEFAULT_CAPABILITIES,
  STORAGE_LIMITS,
  normalizeCapabilities,
  buildMessage,
  verifyMessage
} from './protocol.js'
import {
  savePeer,
  deletePeer,
  saveRoom,
  getRoom,
  getMessages,
  getRoomPassword,
  setRoomPassword,
  getStarsOverride,
  setStarsOverride,
  deleteRoomStars,
  getRoomBans,
  setBan,
  deleteRoomBans,
  lcanPut,
  lcanGet,
  lcanDelete,
  lcanCount,
  lcanCleanExpired,
  getHolders,
  getAllHolders,
  addHolder,
  removeHolder,
  removePeerFromHolders,
  // Phase 2.4: 云文档
  getDoc,
  putDoc,
  getAllDocs,
  deleteDoc,
  // Phase 2.5: 消息搜索
  searchMessages as searchMessagesInDB
} from './db.js'
import {
  sha256Key,
  keyToHex,
  responsible as lcanResponsible,
  DEFAULT_K as LCAN_DEFAULT_K
} from './lcan.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { sign as edSign, verify as edVerify } from './crypto.js'
import {
  sendFileMessage,
  _pushFileChunks,
  _pushFileChunksToPeer,
  _onFileChunkBin,
  _assembleFile
} from './fileTransfer.js'

const DEBUG = false
function dbg(...args) {
  if (DEBUG) console.log('[nchat]', ...args)
}

// ---- Phase 2.1 高性能文件传输常量（蛛网核心） ----
/** 探测上限：256KB（Chromium usrsctp 上限，512KB 任何浏览器都会断通道） */
const PROBE_MAX_BYTES = 262144
/** 探测降级链：256KB → 128KB → 64KB → 32KB */
const PROBE_TIERS = [262144, 131072, 65536, 32768]
/** 单档探测超时（ms） */
const PROBE_TIMEOUT = 1500
/** 探测结果缓存有效期：24h（同设备不重复探测） */
const PROBE_CACHE_TTL = 24 * 60 * 60 * 1000
/** 每条 bin 连接的并发分片数（3 路） */
const FILE_BIN_CONCURRENCY = 3
/** 分片头余量（字节），避免消息头叠加后超限 */
const FILE_CHUNK_HEADER_MARGIN = 64
/** 拉取模式固定分片大小（64KB，所有浏览器安全；多源取模分配统一尺寸） */
const PULL_CHUNK_SIZE = 65536
/** 探测能力缓存 localStorage key */
const CAP_CACHE_KEY = 'nchat:capability'

export class PeerNetwork extends EventTarget {
  /**
   * @param {object} identity  { privateKey, publicKey, peerId }
   * @param {string} ownName   用户昵称
   */
  constructor(identity, ownName) {
    super()
    this.identity = identity
    this.ownName = ownName || ''

    // ---- 多域并行（蛛网核心：域 = 信令服务器） ----
    // domainKey -> { peer, peerJsId, server, status, reconnectAttempts, reconnectTimer, error }
    // status: 'connecting' | 'online' | 'reconnecting' | 'offline' | 'error'
    this.peers = new Map()
    /** 主域 key（首个成功连接的域，用于兼容旧代码 this.peer / this.peerJsId） */
    this._primaryDomainKey = null

    // 兼容旧代码：this.peer / this.peerJsId 指向主域
    // 新代码应使用 this.peers.get(domainKey) 或 this._peerForConnection(peerJsId)
    this.peer = null
    this.peerJsId = null

    // connectionKey -> { conn, peerId, name, lastSeen, status, rooms: Set, domainKey, peerJsId }
    // connectionKey = domainKey + '/' + remotePeerJsId（多域下保证唯一）
    // 同时维护 peerJsId -> connectionKey 反向索引（同一域内 peerJsId 唯一）
    this.connections = new Map()
    this._connKeyByPeerJsId = new Map() // peerJsId(per domain) -> connectionKey

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
    /** 当前主信令服务器（兼容旧 API） */
    this._activeServer = null
    /** 待处理的加入申请：roomName -> [{ peerId, name, timestamp }] */
    this._pendingJoinRequests = new Map()
    /** 已处理消息去重：msgId -> timestamp，避免 gossip 转发导致的重复 emit/转发 */
    this._processedMsgs = new Map()
    /** 本节点发送过的大文件 fileId 集合（用于请求时判断"缓存是否已失效"） */
    this._sentFileIds = new Set()

    /** 本节点能力声明（异构网络角色） */
    this._capabilities = this._loadCapabilities()

    // ---- LCAN 多副本分布式存储（蛛网核心） ----
    /** 饱和请求超时（ms）：全部候选 1.5s 内返回成功或明确失败，绝不干等 */
    this._lcanGetTimeout = 1500
    /** 待处理的 STORE：reqId -> { resolve, ackCount, targetCount, timer, keyHex } */
    this._pendingStores = new Map()
    /** 待处理的 GET：reqId -> { resolve, reject, found, notFound, targetCount, timer, keyHex } */
    this._pendingGets = new Map()
    /** 本地 LCAN 自愈定时器 */
    this._lcanHealTimer = null
    /** LCAN TTL 清扫定时器 */
    this._lcanCleanTimer = null

    // ---- 存储滥用防护（SPAM 防御） ----
    /** 单对端 STORE 速率限制：peerId -> { count, windowStart }（10s 窗口 ≤20 次） */
    this._storeRateMap = new Map()
    /** 被限流的 peer 集合（SET peerId，窗口内超限则加入） */
    this._rateLimitedPeers = new Set()
    /** 累计被拒 STORE 次数（设置面板展示） */
    this._rejectedStoreCount = 0
    /** 累计被限流次数 */
    this._rateLimitedCount = 0
    /** 速率窗口（ms）与上限 */
    this._storeRateWindow = 10 * 1000
    this._storeRateMax = 20
  }

  // ---------------- 多域基础设施 ----------------
  /** 域唯一 key：ws/wss://host:port/path */
  _domainKey(server) {
    return `${server.secure ? 'wss' : 'ws'}://${server.host}:${server.port}${server.path || '/'}`
  }

  /** connection key：域 + 远端 peerJsId */
  _connKey(domainKey, peerJsId) {
    return domainKey + '/' + peerJsId
  }

  /**
   * 获取所有域的运行状态（UI 用）。
   * @returns {Array<{key, host, port, path, secure, status, peerJsId, error, reconnectAttempts}>}
   */
  getDomains() {
    const out = []
    for (const [key, d] of this.peers) {
      const s = d.server
      out.push({
        key,
        host: s.host,
        port: s.port,
        path: s.path,
        secure: !!s.secure,
        label: s.label || `${s.host}:${s.port}`,
        status: d.status,
        peerJsId: d.peerJsId || '',
        error: d.error || '',
        reconnectAttempts: d.reconnectAttempts || 0
      })
    }
    return out
  }

  /** 发射 domains:update 事件（UI 刷新） */
  _emitDomainsUpdate() {
    this._emit('domains:update', { domains: this.getDomains() })
  }

  /**
   * 域独立 backoff 重连（2s/5s/10s，封顶 10s）。
   * 每个域独立计数，互不影响。
   */
  _scheduleReconnect(domainKey) {
    const d = this.peers.get(domainKey)
    if (!d) return
    if (d.reconnectTimer) return // 已在重连中
    if (d.status === 'online') return
    const attempts = d.reconnectAttempts || 0
    const backoff = attempts === 0 ? 2000 : attempts === 1 ? 5000 : 10000
    d.status = 'reconnecting'
    d.reconnectAttempts = attempts + 1
    this._emitDomainsUpdate()
    dbg('domain:reconnect scheduled', domainKey, 'in', backoff, 'ms, attempt', d.reconnectAttempts)
    d.reconnectTimer = setTimeout(() => {
      d.reconnectTimer = null
      this._reconnectDomain(domainKey)
    }, backoff)
  }

  /** 实际执行重连：销毁旧实例，重建 Peer */
  _reconnectDomain(domainKey) {
    const d = this.peers.get(domainKey)
    if (!d) return
    if (d.status === 'online') {
      d.reconnectAttempts = 0
      this._emitDomainsUpdate()
      return
    }
    // 销毁旧实例（可能已失效）
    try {
      if (d.peer && !d.peer.destroyed) d.peer.destroy()
    } catch (e) {
      /* ignore */
    }
    d.peer = null
    d.peerJsId = null
    d.status = 'connecting'
    this._emitDomainsUpdate()
    // 重建（不等 await，让事件驱动）
    this._bootstrapDomain(domainKey, d.server).catch((e) => {
      console.warn('[nchat] 域重连失败：', domainKey, e?.message)
      this._scheduleReconnect(domainKey)
    })
  }

  // ---------------- 节点能力（异构角色） ----------------
  /** 从 localStorage 读取角色偏好，缺省返回 DEFAULT_CAPABILITIES */
  _loadCapabilities() {
    try {
      const raw = localStorage.getItem('nchat:capabilities')
      if (raw) return normalizeCapabilities(JSON.parse(raw))
    } catch (e) {
      /* ignore */
    }
    return { ...DEFAULT_CAPABILITIES }
  }

  /** 持久化能力声明 */
  _saveCapabilities() {
    try {
      localStorage.setItem('nchat:capabilities', JSON.stringify(this._capabilities))
    } catch (e) {
      /* ignore */
    }
  }

  /** 获取本节点能力声明（只读副本） */
  getCapabilities() {
    return { ...this._capabilities }
  }

  /**
   * 更新本节点能力声明（设置面板调用）。
   * @param {Partial<{storage:string, relay:boolean, alwaysOn:boolean}>} patch
   */
  async setCapabilities(patch) {
    const next = normalizeCapabilities({ ...this._capabilities, ...patch })
    this._capabilities = next
    this._saveCapabilities()
    // 重新广播 hello 让对端学习新角色
    for (const id of this.connections.keys()) {
      await this._sendHello(id).catch(() => {})
    }
    this._emit('capabilities:update', { capabilities: { ...next } })
    return true
  }

  /** 本节点是否愿意承担存储责任（light 节点不存） */
  _canStore() {
    return this._capabilities.storage !== NodeRole.LIGHT
  }

  /** 本节点 LCAN 存储条目上限（按角色） */
  _storageLimit() {
    return STORAGE_LIMITS[this._capabilities.storage] ?? 0
  }

  /** 本节点是否愿意中继转发 */
  _canRelay() {
    return !!this._capabilities.relay
  }

  /** 统计当前已连接节点的角色分布（调试/拓扑视图用） */
  getRoleStats() {
    const stats = { full: 0, normal: 0, light: 0, unknown: 0, relay: 0, alwaysOn: 0 }
    for (const entry of this.connections.values()) {
      const c = entry.capabilities
      if (!c) {
        stats.unknown++
        continue
      }
      if (c.storage === NodeRole.FULL) stats.full++
      else if (c.storage === NodeRole.NORMAL) stats.normal++
      else if (c.storage === NodeRole.LIGHT) stats.light++
      else stats.unknown++
      if (c.relay) stats.relay++
      if (c.alwaysOn) stats.alwaysOn++
    }
    // 包含自己
    if (this._capabilities.storage === NodeRole.FULL) stats.full++
    else if (this._capabilities.storage === NodeRole.NORMAL) stats.normal++
    else if (this._capabilities.storage === NodeRole.LIGHT) stats.light++
    if (this._capabilities.relay) stats.relay++
    if (this._capabilities.alwaysOn) stats.alwaysOn++
    return stats
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

  // ---------------- 生命周期（多域并行） ----------------
  /**
   * 启动 P2P 连接：并行挂载全部候选信令域（Promise.allSettled）。
   * 任一域成功即视为在线；全部失败才抛错。
   * @param {object} [explicitServer] 指定信令服务器（追加到候选列表）
   */
  async start(explicitServer) {
    if (this._started) return
    this._started = true

    // 大文件发送缓存（Phase 2.1 起改为 ArrayBuffer 内存缓存，不再持久化 localStorage）。
    // 旧版 dataUrl 持久化数据已失效（无 arrayBuffer），清空避免误用。
    // 发送者刷新页面后的文件可达性由 LCAN 元信息 + 多源拉取保障。
    if (!this._outgoingFiles) this._outgoingFiles = new Map()
    try {
      localStorage.removeItem('nchat:outgoing-files')
    } catch (e) {
      /* ignore */
    }

    // 候选信令服务器列表：优先 explicitServer，否则当前激活项，最后全部
    const allServers = getAllSignalingServers()
    const active = getSignaling()
    const candidates = []
    if (explicitServer) candidates.push(explicitServer)
    candidates.push(active)
    for (const s of allServers) {
      const key = this._domainKey(s)
      if (!candidates.find((c) => this._domainKey(c) === key)) {
        candidates.push(s)
      }
    }

    // 并行连接全部候选域（蛛网核心：不再"首个成功即用"）
    // 每个域独立 bootstrap，互不阻塞
    const tasks = candidates.map((server) =>
      this._bootstrapDomain(this._domainKey(server), server).then(
        () => ({ server, ok: true }),
        (e) => ({ server, ok: false, error: e })
      )
    )
    const results = await Promise.allSettled(tasks)
    const succeeded = results.filter(
      (r) => r.status === 'fulfilled' && r.value?.ok
    )

    if (succeeded.length === 0) {
      // 全部失败：抛出第一个错误（但域重连已在 _bootstrapDomain 内调度，不放弃）
      this._started = false
      const firstErr =
        results.find((r) => r.status === 'rejected')?.reason ||
        new Error('所有信令服务器均不可用')
      throw firstErr
    }
    // 至少一个域在线即视为启动成功（其余失败域已自动调度重连）
  }

  /**
   * 引导单个域：创建 Peer 实例，注册到 this.peers，绑定事件。
   * 成功（peer 'open'）时 resolve；失败/超时 reject 并自动调度重连。
   * @param {string} domainKey
   * @param {object} server
   * @returns {Promise<void>}
   */
  _bootstrapDomain(domainKey, server) {
    return new Promise((resolve, reject) => {
      // 注册域状态
      let d = this.peers.get(domainKey)
      if (!d) {
        d = {
          peer: null,
          peerJsId: null,
          server,
          status: 'connecting',
          reconnectAttempts: 0,
          reconnectTimer: null,
          error: ''
        }
        this.peers.set(domainKey, d)
      }
      // 清理旧定时器
      if (d.reconnectTimer) {
        clearTimeout(d.reconnectTimer)
        d.reconnectTimer = null
      }
      d.status = 'connecting'
      d.error = ''
      this._emitDomainsUpdate()

      // 创建 Peer 实例
      const peer = new Peer(server)
      d.peer = peer

      let settled = false
      const settle = (fn, arg) => {
        if (settled) return
        settled = true
        fn(arg)
      }

      // 单域超时 8s
      const timeout = setTimeout(() => {
        if (!d.peerJsId) {
          settle(reject, { type: 'timeout', message: `信令服务器 ${server.host}:${server.port} 连接超时` })
        }
      }, 8000)

      peer.on('open', (id) => {
        clearTimeout(timeout)
        d.peerJsId = id
        d.status = 'online'
        d.reconnectAttempts = 0
        d.error = ''
        // 主域：兼容旧代码 this.peer / this.peerJsId / this._activeServer
        if (!this._primaryDomainKey) {
          this._primaryDomainKey = domainKey
          this.peer = peer
          this.peerJsId = id
          this._activeServer = server
          this._emit('identity', { peerId: this.identity.peerId, peerJsId: id })
        }
        dbg('domain:open', domainKey, 'peerJsId=', id)
        this._emit('status', { online: this._anyDomainOnline(), server, domainKey })
        this._emitDomainsUpdate()
        settle(resolve)
        this._startTimers()
        this._discoverDomain(domainKey)
      })

      // 收到入站连接（per-domain）
      // 双通道：json（控制）+ bin（大数据），通过 metadata.channel 区分
      peer.on('connection', (conn) => {
        const channel = conn.metadata?.channel
        dbg('domain:incoming from', conn.peer, 'on', domainKey, 'channel=', channel || 'json')
        if (channel === 'bin') {
          this._attachBinaryConnection(conn, domainKey)
        } else {
          this._attachConnection(conn, domainKey)
        }
      })

      // 收到媒体通话请求（per-domain）
      peer.on('call', (call) => {
        dbg('domain:call from', call.peer, 'on', domainKey)
        let fromPeerId = null
        for (const entry of this.connections.values()) {
          if (entry.peerJsId === call.peer && entry.domainKey === domainKey) {
            fromPeerId = entry.peerId
            break
          }
        }
        this._onMediaCall(call, fromPeerId || call.peer)
      })

      peer.on('error', (err) => {
        console.warn(`[nchat] Peer error [${domainKey}]:`, err?.type, err?.message)
        clearTimeout(timeout)
        d.error = err?.message || String(err)
        // 不可恢复错误（如 unavailable-id）：不重连
        const noReconnect = err?.type === 'unavailable-id' || err?.type === 'browser-incompatible'
        if (!settled) {
          settle(reject, err)
        }
        if (noReconnect) {
          d.status = 'error'
          this._emitDomainsUpdate()
        } else {
          // 可恢复：调度重连
          d.status = 'offline'
          this._emitDomainsUpdate()
          this._scheduleReconnect(domainKey)
        }
        this._emit('error', { type: err?.type, message: err?.message, domainKey })
      })

      peer.on('disconnected', () => {
        dbg('domain:disconnected', domainKey)
        d.status = 'offline'
        d.peerJsId = null
        // 如果是主域断开，更新兼容字段
        if (this._primaryDomainKey === domainKey) {
          this.peerJsId = null
        }
        this._emit('status', { online: this._anyDomainOnline(), reason: 'disconnected', domainKey })
        this._emitDomainsUpdate()
        // 独立 backoff 重连（不影响其他域）
        this._scheduleReconnect(domainKey)
      })

      peer.on('close', () => {
        dbg('domain:close', domainKey)
        if (d.status !== 'error') {
          d.status = 'offline'
          this._emitDomainsUpdate()
        }
      })
    })
  }

  /** 是否有任一域在线 */
  _anyDomainOnline() {
    for (const d of this.peers.values()) {
      if (d.status === 'online') return true
    }
    return false
  }

  /** 当前主信令服务器（兼容旧 API；主域离线时回退到首个在线域） */
  getActiveServer() {
    if (this._primaryDomainKey) {
      const d = this.peers.get(this._primaryDomainKey)
      if (d && d.status === 'online') return d.server
    }
    for (const d of this.peers.values()) {
      if (d.status === 'online') return d.server
    }
    return this._activeServer || getSignaling()
  }

  /**
   * 重启并切换到指定信令服务器（兼容旧 API）。
   * 多域模式下：若该域已存在则销毁重建，否则新增域。
   */
  async restartWithServer(server) {
    const domainKey = this._domainKey(server)
    const existing = this.peers.get(domainKey)
    if (existing) {
      // 销毁旧实例后重建
      if (existing.reconnectTimer) {
        clearTimeout(existing.reconnectTimer)
        existing.reconnectTimer = null
      }
      try {
        if (existing.peer && !existing.peer.destroyed) existing.peer.destroy()
      } catch (e) {
        /* ignore */
      }
      existing.peer = null
      existing.peerJsId = null
      existing.status = 'connecting'
      existing.reconnectAttempts = 0
      this._emitDomainsUpdate()
      await this._bootstrapDomain(domainKey, server)
    } else {
      // 新增域
      await this._bootstrapDomain(domainKey, server)
    }
  }

  async stop() {
    this._started = false
    this._stopTimers()
    // 关闭所有媒体通话
    if (this._mediaCalls) {
      for (const call of this._mediaCalls.values()) {
        try {
          call.close()
        } catch (e) {
          /* ignore */
        }
      }
      this._mediaCalls.clear()
    }
    // 清理大文件缓存与分片聚合（防止内存泄漏）
    if (this._outgoingFiles) this._outgoingFiles.clear()
    if (this._fileChunks) this._fileChunks.clear()
    // 通知离开所有房间
    for (const roomName of this.localRooms()) {
      await this._broadcast({ type: MsgType.LEAVE_ROOM, payload: { room: roomName } })
    }
    // 关闭所有连接（json + bin 双通道）
    for (const entry of this.connections.values()) {
      try {
        if (entry.conn) entry.conn.close()
      } catch (e) {
        /* ignore */
      }
      try {
        if (entry.binConn) entry.binConn.close()
      } catch (e) {
        /* ignore */
      }
    }
    this.connections.clear()
    this._connKeyByPeerJsId.clear()
    // 销毁所有域的 Peer 实例
    for (const [key, d] of this.peers) {
      if (d.reconnectTimer) {
        clearTimeout(d.reconnectTimer)
        d.reconnectTimer = null
      }
      try {
        if (d.peer && !d.peer.destroyed) d.peer.destroy()
      } catch (e) {
        /* ignore */
      }
    }
    this.peers.clear()
    this.peer = null
    this.peerJsId = null
    this._primaryDomainKey = null
    this._activeServer = null
  }

  setOwnName(name) {
    this.ownName = name
    // 改名后广播 hello，让已连接节点立即学到新名字（无需刷新页面）
    for (const id of this.connections.keys()) {
      this._sendHello(id).catch(() => {})
    }
  }

  // ---------------- 连接管理（多域） ----------------
  /**
   * 挂载一条入站/出站 DataConnection。
   * @param {object} conn  PeerJS DataConnection
   * @param {string} domainKey  该连接所属的域
   */
  _attachConnection(conn, domainKey) {
    const peerJsId = conn.peer
    const connKey = this._connKey(domainKey, peerJsId)
    if (this.connections.has(connKey)) {
      dbg('conn:skip duplicate', connKey)
      // 已有连接，关闭新的
      try {
        conn.close()
      } catch (e) {
        /* ignore */
      }
      return
    }
    dbg('conn:attach', connKey)
    this.connections.set(connKey, {
      conn,
      connKey,
      domainKey,
      peerJsId, // 远端在该域的 PeerJS ID
      peerId: null,
      name: '',
      lastSeen: Date.now(),
      createdAt: Date.now(),
      status: 'connecting',
      rooms: new Set(),
      helloExchanged: false,
      capabilities: null, // 对端能力声明，hello 后学习
      // ---- 双通道：json（控制）+ bin（大数据） ----
      binConn: null, // 二进制 DataConnection（serialization:'binary'）
      binStatus: 'none', // 'none' | 'opening' | 'online' | 'closed'
      _binWaiters: [] // binConn open 等待队列（_sendBinary 在 open 前调用时挂起）
    })
    // 反向索引：同域内 peerJsId -> connKey（用于 _send 等按 peerJsId 查找）
    this._connKeyByPeerJsId.set(connKey, peerJsId)

    conn.on('open', async () => {
      dbg('conn:open', connKey)
      const entry = this.connections.get(connKey)
      if (entry) {
        entry.status = 'online'
        entry.lastSeen = Date.now()
      }
      // 主动发送 hello
      await this._sendHello(connKey)
      this._emitPeerStatus(connKey)
    })

    conn.on('data', (data) => {
      dbg('conn:data', connKey, data?.type)
      this._onData(connKey, data)
    })

    conn.on('close', () => {
      dbg('conn:close', connKey)
      this._handleDisconnect(connKey)
    })

    conn.on('error', (err) => {
      console.warn('[nchat] conn error:', err?.message)
      this._handleDisconnect(connKey)
    })
  }

  // ---------------- 双通道：二进制连接（蛛网高性能文件通道） ----------------
  /**
   * 确定性发起 bin 连接：peerId 字典序较小的一方主动发起，避免双方同时发起造成重复。
   * bin 连接承载 ArrayBuffer / 大对象，规避 JSON 通道 16KB 上限。
   * @param {string} connKey  已建立 json 连接的 key（peerId 已知）
   */
  _ensureBinaryConnection(connKey) {
    const entry = this.connections.get(connKey)
    if (!entry || !entry.peerId) return
    if (entry.binStatus === 'online' || entry.binStatus === 'opening') return
    // 确定性发起方：peerId 字典序较小的一方。另一方只接收（_attachBinaryConnection）。
    const mine = this.identity.peerId
    const theirs = entry.peerId
    if (mine >= theirs) return // 由对端发起
    const d = this.peers.get(entry.domainKey)
    if (!d || !d.peer || d.status !== 'online') return
    try {
      entry.binStatus = 'opening'
      dbg('bin:connect to', entry.peerJsId, 'on', entry.domainKey)
      const binConn = d.peer.connect(entry.peerJsId, {
        reliable: true,
        serialization: 'binary',
        metadata: { channel: 'bin' }
      })
      this._wireBinaryConnection(connKey, binConn)
    } catch (e) {
      entry.binStatus = 'none'
      console.warn('[nchat] bin connect failed:', e?.message)
    }
  }

  /**
   * 接收对端发起的 bin 连接（incoming）。
   * bin 连接可能在 json hello 之前到达，也可能之后；找不到 entry 时暂存待绑定。
   */
  _attachBinaryConnection(conn, domainKey) {
    const peerJsId = conn.peer
    const connKey = this._connKey(domainKey, peerJsId)
    const entry = this.connections.get(connKey)
    if (!entry) {
      // json 连接尚未建立：暂存到 pending，_attachConnection 建好后绑定
      dbg('bin:pending (no json entry yet)', connKey)
      // 直接绑定等待 json entry 出现；最多保留 10s
      const wait = () => {
        const e = this.connections.get(connKey)
        if (e) {
          this._wireBinaryConnection(connKey, conn)
        } else {
          // json entry 还没来，bin 连接先挂着开监听，避免数据丢失
          this._wireBinaryConnection(connKey, conn, /* pending */ true)
        }
      }
      wait()
      return
    }
    if (entry.binStatus === 'online' || entry.binStatus === 'opening') {
      // 已有 bin 连接，关闭重复的
      try {
        conn.close()
      } catch (e) {
        /* ignore */
      }
      return
    }
    this._wireBinaryConnection(connKey, conn)
  }

  /**
   * 绑定 bin 连接事件到指定 connKey 的 entry。
   * @param {string} connKey
   * @param {DataConnection} binConn
   * @param {boolean} [pending=false]  json entry 尚未建立（暂存模式）
   */
  _wireBinaryConnection(connKey, binConn, pending = false) {
    let entry = this.connections.get(connKey)
    // pending 模式：entry 可能不存在，仅绑定 data 事件，待 entry 出现后补登记
    if (entry) {
      entry.binConn = binConn
      if (entry.binStatus !== 'online') entry.binStatus = 'opening'
    }
    binConn.on('open', () => {
      const e = this.connections.get(connKey)
      if (e) {
        e.binConn = binConn
        e.binStatus = 'online'
        // 唤醒所有等待 binConn open 的 _sendBinary 调用
        const waiters = e._binWaiters || []
        e._binWaiters = []
        for (const w of waiters) w.resolve()
      }
      dbg('bin:open', connKey)
    })
    binConn.on('data', (data) => {
      this._onBinaryData(connKey, data)
    })
    binConn.on('close', () => {
      const e = this.connections.get(connKey)
      if (e && e.binConn === binConn) {
        e.binConn = null
        e.binStatus = 'closed'
        // 唤醒等待者并拒绝（连接已关）
        const waiters = e._binWaiters || []
        e._binWaiters = []
        for (const w of waiters) w.reject(new Error('bin conn closed'))
      }
      dbg('bin:close', connKey)
    })
    binConn.on('error', (err) => {
      console.warn('[nchat] bin conn error:', err?.message)
      const e = this.connections.get(connKey)
      if (e && e.binConn === binConn) {
        e.binConn = null
        e.binStatus = 'closed'
        const waiters = e._binWaiters || []
        e._binWaiters = []
        for (const w of waiters) w.reject(new Error('bin conn error'))
      }
    })
    // pending 模式下没有 entry，data 事件仍会被 _onBinaryData 丢弃（找不到 entry）
  }

  /**
   * 等待 bin 连接 open（若已 open 立即 resolve）。
   * @returns {Promise<void>}
   */
  _waitForBinOpen(connKey) {
    const entry = this.connections.get(connKey)
    if (!entry) return Promise.reject(new Error('no entry'))
    if (entry.binStatus === 'online' && entry.binConn && entry.binConn.open) {
      return Promise.resolve()
    }
    // 尚未 open：加入等待队列
    return new Promise((resolve, reject) => {
      entry._binWaiters.push({ resolve, reject })
    })
  }

  /**
   * 通过 bin 通道发送数据（ArrayBuffer / 大对象）。
   * 若 bin 连接尚未 open 则等待；超时 5s 则回退 false。
   * @param {string} connKey
   * @param {object} obj  消息对象（含 kind 字段，可携带 ArrayBuffer）
   * @returns {Promise<boolean>} 是否发送成功
   */
  async _sendBinary(connKey, obj) {
    const entry = this.connections.get(connKey)
    if (!entry) return false
    if (entry.binStatus !== 'online') {
      // 等待 bin open，最多 5s
      try {
        await Promise.race([
          this._waitForBinOpen(connKey),
          new Promise((_, reject) => setTimeout(() => reject(new Error('bin open timeout')), 5000))
        ])
      } catch (e) {
        return false
      }
    }
    const e = this.connections.get(connKey)
    if (!e || !e.binConn || !e.binConn.open) return false
    try {
      e.binConn.send(obj)
      return true
    } catch (err) {
      console.warn('[nchat] bin send failed:', err?.message)
      return false
    }
  }

  /**
   * 处理 bin 通道收到的数据（按 kind 分发）。
   * bin 消息不走签名校验（大块数据签名在 json 控制通道完成，分片只带 fileId+index）。
   */
  _onBinaryData(connKey, data) {
    if (!data || typeof data !== 'object') return
    const entry = this.connections.get(connKey)
    if (!entry) {
      dbg('bin:data no entry, drop', connKey, data?.kind)
      return
    }
    entry.lastSeen = Date.now()
    switch (data.kind) {
      case BinKind.PROBE:
        // Phase 2.1 能力探测：收到 probe 立即回 ACK（带 size + tag）
        this._sendBinary(connKey, {
          kind: BinKind.PROBE_ACK,
          size: data.size || 0,
          tag: data.tag
        }).catch(() => {})
        break
      case BinKind.PROBE_ACK:
        // 由 _probeCapability 的等待逻辑处理（通过事件回调）
        this._emit('bin:probe_ack', { connKey, size: data.size || 0, tag: data.tag })
        break
      case BinKind.FILE_CHUNK:
        this._onFileChunkBin(connKey, data)
        break
      case BinKind.FILE_META_BIN:
      case BinKind.LCAN_BLOB:
        dbg('bin:blob', connKey, data.kind)
        break
      default:
        dbg('bin:unknown kind', data.kind)
    }
  }

  /**
   * bin 通道文件分片接收：ArrayBuffer 聚合 + 总哈希校验 + 签名验证 + Blob URL 生成。
   * @param {string} connKey
   * @param {{kind, fileId, index, total, chunkSize, totalHashHex, fileSig, from,
   *          fileName, fileType, fileSize, room, name, buf:ArrayBuffer}} data
   */
  _onFileChunkBin(connKey, data) {
    const { fileId, index, total, chunkSize, totalHashHex, fileSig, buf } = data
    if (!fileId || !buf || typeof index !== 'number') return
    const entry = this.connections.get(connKey)
    const fromPeerId = data.from || entry?.peerId || ''
    if (!fromPeerId) return

    if (!this._fileChunks) this._fileChunks = new Map()
    let agg = this._fileChunks.get(fileId)
    if (!agg) {
      agg = {
        total,
        chunkSize,
        totalHashHex,
        fileSig,
        from: fromPeerId,
        chunks: new Map(),
        meta: {
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          room: data.room,
          from: fromPeerId,
          name: data.name || fromPeerId.slice(0, 8),
          timestamp: Date.now()
        },
        firstSeen: Date.now()
      }
      this._fileChunks.set(fileId, agg)
    }
    // 仅接受与首次一致的 chunkSize（避免 push/pull 不同尺寸交叉污染）
    if (agg.chunkSize && agg.chunkSize !== chunkSize) return
    agg.chunks.set(index, buf)

    // 进度事件（UI 进度条用）
    this._emit('file:progress', {
      fileId,
      received: agg.chunks.size,
      total: agg.total,
      bytes: data.fileSize || 0
    })

    // 全部到齐：组装
    if (agg.chunks.size >= agg.total) {
      this._fileChunks.delete(fileId)
      _assembleFile(this, fileId, agg).catch((e) => {
        console.warn('[nchat] assemble file failed:', e?.message)
      })
    }

    // 惰性清理：超过 10 分钟未完成的聚合丢弃
    if (this._fileChunks.size > 50) {
      const cutoff = Date.now() - 10 * 60 * 1000
      for (const [fid, a] of this._fileChunks) {
        if (a.firstSeen < cutoff) this._fileChunks.delete(fid)
      }
    }
  }

// ---------------- Phase 2.1 能力探测（蛛网高性能文件通道） ----------------
  /**
   * 探测对端 bin 通道最大可接受分片大小。
   * 优先读 localStorage 缓存（24h 内不重复探测）；否则逐档探测 256KB→128KB→64KB→32KB。
   * @param {string} connKey
   * @returns {Promise<number>} 探测到的能力（字节）
   */
  async _probeCapability(connKey) {
    const entry = this.connections.get(connKey)
    if (!entry || !entry.peerId) return PROBE_TIERS[PROBE_TIERS.length - 1]
    // 缓存命中
    const cached = this._loadCapability(entry.peerId)
    if (cached) {
      dbg('probe:cache hit', entry.peerId, cached)
      return cached
    }
    // 逐档探测
    for (const size of PROBE_TIERS) {
      const ok = await this._probeOnce(connKey, size)
      if (ok) {
        this._saveCapability(entry.peerId, size)
        dbg('probe:success', entry.peerId, size)
        return size
      }
    }
    // 全部失败：用最小档并缓存（短时间内不再重试）
    const fallback = PROBE_TIERS[PROBE_TIERS.length - 1]
    this._saveCapability(entry.peerId, fallback)
    dbg('probe:all failed, fallback', entry.peerId, fallback)
    return fallback
  }

  /**
   * 单次探测：发 N 字节 ArrayBuffer → 等 PROBE_ACK（1.5s 超时）。
   * @param {string} connKey
   * @param {number} size  探测字节数
   * @returns {Promise<boolean>}
   */
  _probeOnce(connKey, size) {
    const tag = 'probe:' + size + ':' + Math.random().toString(36).slice(2, 10)
    const buf = new ArrayBuffer(size)
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.removeEventListener('bin:probe_ack', onAck)
        resolve(false)
      }, PROBE_TIMEOUT)
      const onAck = (e) => {
        if (e.detail?.connKey !== connKey) return
        if (e.detail?.tag !== tag) return
        clearTimeout(timer)
        this.removeEventListener('bin:probe_ack', onAck)
        resolve(true)
      }
      this.addEventListener('bin:probe_ack', onAck)
      this._sendBinary(connKey, { kind: BinKind.PROBE, size, tag, buf }).catch(() => {
        clearTimeout(timer)
        this.removeEventListener('bin:probe_ack', onAck)
        resolve(false)
      })
    })
  }

  /** 从 localStorage 读取对端能力缓存（过期返回 null） */
  _loadCapability(peerId) {
    try {
      const raw = localStorage.getItem(CAP_CACHE_KEY)
      if (!raw) return null
      const map = JSON.parse(raw)
      const rec = map[peerId]
      if (!rec) return null
      if (Date.now() - rec.ts > PROBE_CACHE_TTL) return null
      return rec.size
    } catch (e) {
      return null
    }
  }

  /** 持久化对端能力缓存（LRU 100 个 peer） */
  _saveCapability(peerId, size) {
    try {
      const raw = localStorage.getItem(CAP_CACHE_KEY)
      const map = raw ? JSON.parse(raw) : {}
      map[peerId] = { size, ts: Date.now() }
      const keys = Object.keys(map)
      while (keys.length > 100) {
        delete map[keys.shift()]
      }
      localStorage.setItem(CAP_CACHE_KEY, JSON.stringify(map))
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * 主动连接某域内的一个 peer。
   * @param {string} peerJsId  目标在指定域的 PeerJS ID
   * @param {string} domainKey 目标所在域
   */
  async _connectTo(peerJsId, domainKey) {
    if (!domainKey) return
    const d = this.peers.get(domainKey)
    if (!d || !d.peer || d.status !== 'online') return
    if (peerJsId === d.peerJsId) return // 自己
    const connKey = this._connKey(domainKey, peerJsId)
    if (this.connections.has(connKey)) return
    if (this.connections.size >= CONFIG.MAX_PEERS) return
    dbg('conn:connect to', peerJsId, 'on', domainKey)
    const conn = d.peer.connect(peerJsId, {
      reliable: true,
      serialization: 'json'
    })
    this._attachConnection(conn, domainKey)
  }

  _handleDisconnect(connKey) {
    const entry = this.connections.get(connKey)
    if (!entry) return
    const peerId = entry.peerId
    const peerJsId = entry.peerJsId
    const domainKey = entry.domainKey
    // 关闭 bin 连接（若有）+ 拒绝等待者
    if (entry.binConn) {
      try {
        entry.binConn.close()
      } catch (e) {
        /* ignore */
      }
      entry.binConn = null
      entry.binStatus = 'closed'
    }
    if (entry._binWaiters && entry._binWaiters.length) {
      const ws = entry._binWaiters
      entry._binWaiters = []
      for (const w of ws) w.reject(new Error('json conn disconnected'))
    }
    this.connections.delete(connKey)
    this._connKeyByPeerJsId.delete(connKey)
    // 仅当该 peer 在所有域都没有连接时才删除（跨域多连接去重）
    if (peerId && !this._hasConnectionForPeerId(peerId)) {
      deletePeer(peerId)
      // LCAN 副本自愈：节点全部域断开 → 从 holder 表移除，触发副本数下降
      // （Phase 1.6 的自愈定时器会检测副本数 <2 并补齐）
      const touched = removePeerFromHolders(peerId)
      if (touched > 0) dbg('lcan:holder removed for offline peer', peerId, touched)
    }

    // 继承制：如果离线者在所有域都断开且是某房间 owner，由星标最高的在线成员继承
    if (peerId && !this._hasConnectionForPeerId(peerId)) {
      for (const [roomName, r] of this.knownRooms) {
        if (r.owner === peerId) {
          this._handleInheritance(roomName, peerId)
        }
      }
    }

    this._recomputeRooms()
    this._emit('peer:disconnected', { peerJsId, peerId, domainKey, connKey })
  }

  /** 检查某 peerId 是否还有任意域的活跃连接（跨域去重判断） */
  _hasConnectionForPeerId(peerId) {
    if (!peerId) return false
    for (const entry of this.connections.values()) {
      if (entry.peerId === peerId && entry.status !== 'disconnected') return true
    }
    return false
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

  // ---------------- 数据收发（多域） ----------------
  /**
   * 通过指定连接发送消息。
   * @param {string} connKey  连接 key（domainKey/peerJsId）
   * @param {object} msg
   */
  async _send(connKey, msg, retries = 3) {
    const entry = this.connections.get(connKey)
    if (!entry || !entry.conn) return false
    // PeerJS 数据通道有"假开"现象：conn.open===true 但底层 WebRTC SCTP transport
    // 尚未完全就绪，此时 conn.send() 不抛异常但消息被静默丢弃。
    // 策略：等待 open → 发送 → 若非最后一次重试则短暂等待后重试（给 transport 就绪时间）。
    for (let attempt = 0; attempt <= retries; attempt++) {
      // 等待 open（首次或通道重建）
      while (!entry.conn.open && attempt < retries) {
        await new Promise((r) => setTimeout(r, 250))
        // 连接可能在等待期间被关闭/删除
        if (!this.connections.has(connKey)) return false
      }
      if (!entry.conn.open) return false
      try {
        const len = JSON.stringify(msg).length
        if (len >= 16000) {
          console.warn('[nchat] send blocked: message too big', len, 'bytes')
          return false
        }
        entry.conn.send(msg)
        // 非末次重试：等待一小段时间，若 transport 未就绪则下次重试会重新尝试
        if (attempt < retries) await new Promise((r) => setTimeout(r, 350))
        // 注意：不检查返回值（PeerJS send 返回 void）。若静默丢弃，
        // 下一次重试时 transport 可能已就绪。
      } catch (e) {
        if (attempt < retries) await new Promise((r) => setTimeout(r, 350))
      }
    }
    return true
  }

  async _sendRaw(connKey, partial, to = '') {
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
    return this._send(connKey, msg)
  }

  /**
   * 广播给所有已连接 peer（跨域去重：同一 peerId 只发一次，选任一在线域连接）。
   * @param {object} partial  消息体（不含签名）
   * @param {string} [to]     to 字段
   */
  async _broadcast(partial, to = '') {
    // 已签名的完整消息：原样广播，绝不重建。
    // 重建会生成新的 id/timestamp，导致：
    //   1) 本地存的 msgId 与全网其他节点不一致 —— 所有按 msgId 引用的协议
    //      （EDIT / DELETE / REACT / PIN / 文件元信息）在对端都定位不到目标消息；
    //   2) 调用方在广播前做的 _markProcessed(msg.id) 失效（标记的 id 没上过线），
    //      对端转发回来时会被当作新消息重复处理。
    const msg =
      partial && partial.id && partial.signature
        ? partial
        : await buildMessage(
            {
              type: partial.type,
              from: this.identity.peerId,
              to,
              payload: partial.payload || {},
              extensions: { ...(partial.extensions || {}), name: this.ownName }
            },
            this.identity.privateKey
          )
    // 跨域去重：按 peerId 选一条在线连接（peerId 未知时按 connKey 全发，hello 后才有 peerId）
    const sent = new Set() // peerId 集合，已发送的 peer 不重复
    const tasks = []
    for (const [connKey, entry] of this.connections) {
      if (entry.status === 'disconnected') continue
      // 已知 peerId 的连接去重；peerId 未知的连接（尚未 hello）全发
      if (entry.peerId) {
        if (sent.has(entry.peerId)) continue
        sent.add(entry.peerId)
      }
      tasks.push(this._send(connKey, msg))
    }
    await Promise.all(tasks)
  }

  /**
   * 按 peerId 查找任一在线连接 key（跨域：优先选在线连接）。
   * @param {string} peerId
   * @returns {string|null} connKey
   */
  _connKeyForPeerId(peerId) {
    if (!peerId) return null
    let fallback = null
    for (const [connKey, entry] of this.connections) {
      if (entry.peerId === peerId) {
        if (entry.status === 'online') return connKey
        if (!fallback) fallback = connKey
      }
    }
    return fallback
  }

  async _sendHello(connKey) {
    const rooms = this.localRooms().map((name) => {
      const meta = this._localRoomMeta.get(name)
      return {
        name,
        aliases: meta?.aliases || [],
        rules: meta?.rules || { ...DEFAULT_RULES },
        // 只广播"本地已知的房主"，而不是写死自己：
        // 否则每个节点 hello 都自称房主，会反复覆盖其他节点的 owner（双 99 星根因）
        owner: meta?.owner || null
      }
    })
    await this._sendRaw(
      connKey,
      {
        type: MsgType.HELLO,
        payload: {
          name: this.ownName,
          rooms,
          // 异构网络能力声明：让对端知道本节点的存储/中继/常驻意愿
          capabilities: this._capabilities
        }
      }
    )
  }

  async _onData(connKey, data) {
    if (!data || typeof data !== 'object') return
    const entry = this.connections.get(connKey)
    if (!entry) return
    entry.lastSeen = Date.now()
    if (entry.status !== 'online') {
      entry.status = 'online'
      this._emitPeerStatus(connKey)
    }

    // 校验签名
    const ok = await verifyMessage(data)
    if (!ok) {
      console.warn('[nchat] 签名校验失败，丢弃：', data?.type, data?.from)
      return
    }

    // 学习对端身份（跨域：同一 peerId 可能在多域都有连接，仅首次 emit peer:connected）
    if (data.from && data.from !== entry.peerId) {
      entry.peerId = data.from
      entry.name = data.extensions?.name || entry.name
      await savePeer({
        id: data.from,
        name: entry.name,
        peerJsId: entry.peerJsId,
        lastSeen: Date.now()
      })
      // 跨域去重：仅当该 peerId 之前没有任何连接时才 emit peer:connected
      const otherConns = [...this.connections.values()].filter(
        (e) => e.peerId === data.from && e.connKey !== connKey
      )
      if (otherConns.length === 0) {
        this._emit('peer:connected', {
          peerJsId: entry.peerJsId,
          peerId: data.from,
          name: entry.name,
          domainKey: entry.domainKey
        })
      }
      // 双通道：peerId 已知后，确定性发起 bin 连接（避免双方同时发起）
      // 规则：peerId 字典序较小的一方主动发起 bin 连接
      this._ensureBinaryConnection(connKey)
    }

    switch (data.type) {
      case MsgType.HELLO:
        await this._onHello(connKey, data)
        break
      case MsgType.HEARTBEAT:
        // 仅更新 lastSeen，已处理
        break
      case MsgType.JOIN_ROOM:
        await this._onJoinRoom(connKey, data)
        break
      case MsgType.LEAVE_ROOM:
        this._onLeaveRoom(connKey, data)
        break
      case MsgType.ROOM_MESSAGE:
        this._onRoomMessage(data)
        break
      case MsgType.ROOM_LIST:
        this._onRoomList(data)
        break
      case MsgType.QUERY_ROOMS:
        await this._onQueryRooms(connKey, data)
        break
      case MsgType.HISTORY_REQUEST:
        await this._onHistoryRequest(connKey, data)
        break
      case MsgType.HISTORY_RESPONSE:
        this._onHistoryResponse(data)
        break
      case MsgType.JOIN_REJECTED:
        this._emit('join:rejected', { room: data.payload?.room, reason: data.payload?.reason })
        break
      case MsgType.JOIN_APPROVED:
        await this._onJoinApproved(connKey, data)
        break
      case MsgType.JOIN_REQUEST:
        await this._onJoinRequest(connKey, data)
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
      case MsgType.FILE_META:
        this._onFileMeta(data)
        break
      case MsgType.FILE_REQUEST:
        await _onFileRequest(this, connKey, data)
        // 请求也转发（meta 是转发来的，请求也要能到达发送者，否则间接节点无法下载）
        if (data.from !== this.identity.peerId) {
          this._forward(data)
        }
        break
      case MsgType.FILE_UNAVAILABLE:
        this._onFileUnavailable(data)
        // 沿转发路径回传给请求者（meta 转发链的反向）
        if (data.from !== this.identity.peerId) {
          this._forward(data)
        }
        break
      // ---- LCAN 多副本分布式存储 ----
      case MsgType.LCAN_STORE:
        await this._onLcanStore(connKey, data)
        break
      case MsgType.LCAN_ACK:
        this._onLcanAck(data)
        break
      case MsgType.LCAN_GET:
        await this._onLcanGet(connKey, data)
        break
      case MsgType.LCAN_FOUND:
        this._onLcanFound(data)
        break
      case MsgType.LCAN_NOT_FOUND:
        this._onLcanNotFound(data)
        break
      case MsgType.LCAN_HOLDERS:
        this._onLcanHolders(data)
        break
      // ---- Phase 2.2: 群公告 ----
      case MsgType.ANNOUNCEMENT:
        this._onAnnouncement(data)
        break
      // ---- Phase 2.3: Pin 置顶 ----
      case MsgType.PIN_UPDATE:
        this._onPinUpdate(data)
        break
      // ---- Phase 2.4: 云文档 ----
      case MsgType.DOC_UPDATE:
        this._onDocUpdate(data)
        break
      case MsgType.DOC_LIST:
        this._onDocList(connKey, data)
        break
      // ---- Phase 2.5: 消息搜索 ----
      case MsgType.MSG_SEARCH:
        this._onMsgSearch(connKey, data)
        break
      case MsgType.MSG_SEARCH_RESULT:
        this._onMsgSearchResult(data)
        break
      // ---- Phase 3.1: 消息编辑 / 撤回 / 回应 ----
      case MsgType.EDIT:
        this._onEdit(data)
        break
      case MsgType.DELETE:
        this._onDelete(data)
        break
      case MsgType.REACT:
        this._onReact(data)
        break
      // ---- Phase 3.2: @提及 + 已读回执 ----
      case MsgType.MENTION:
        this._onMention(data)
        break
      case MsgType.READ_RECEIPT:
        this._onReadReceipt(data)
        break
      // ---- Phase 3.3: 话题 ----
      case MsgType.THREAD_CREATE:
        this._onThreadCreate(data)
        break
      case MsgType.THREAD_REPLY:
        this._onThreadReply(data)
        break
      // ---- Phase 3.4: 私聊 E2E ----
      case MsgType.DM_CREATE:
        this._onDmCreate(data)
        break
      case MsgType.DM_MESSAGE:
        this._onDmMessage(data)
        break
      case MsgType.DM_KEY:
        this._onDmKey(data)
        break
    }
  }

  /** 收到加入申请（审核制房间） */
  async _onJoinRequest(connKey, msg) {
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
      connKey // 记录连接 key，审核通过时通过该连接回发
    })
    this._pendingJoinRequests.set(room, filtered)
    this._emit('join:request', {
      room,
      peerId: msg.from,
      name: msg.extensions?.name || msg.from.slice(0, 8)
    })
  }

  /** 收到加入批准 */
  async _onJoinApproved(connKey, msg) {
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
      // 优先用记录的 connKey 回发；若该连接已断开，按 peerId 查找任一在线连接
      const targetConnKey = this.connections.has(req.connKey)
        ? req.connKey
        : this._connKeyForPeerId(peerId)
      if (targetConnKey) {
        await this._sendRaw(targetConnKey, {
          type: MsgType.JOIN_APPROVED,
          payload: { room }
        }, peerId)
      }
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
      const targetConnKey = this.connections.has(req.connKey)
        ? req.connKey
        : this._connKeyForPeerId(peerId)
      if (targetConnKey) {
        await this._sendRaw(targetConnKey, {
          type: MsgType.JOIN_REJECTED,
          payload: { room, reason }
        }, peerId)
      }
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
    // 跨域查找该 peerId 对应的任一在线连接
    const targetConnKey = this._connKeyForPeerId(peerId)
    if (!targetConnKey) return false
    await this._sendRaw(targetConnKey, {
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
  async _onHello(connKey, msg) {
    const entry = this.connections.get(connKey)
    if (!entry) return
    entry.name = msg.payload?.name || entry.name
    // 学习对端能力声明（异构角色：full / normal / light + relay + alwaysOn）
    const caps = msg.payload?.capabilities
    if (caps) {
      const before = entry.capabilities
      entry.capabilities = normalizeCapabilities(caps)
      if (!before || JSON.stringify(before) !== JSON.stringify(entry.capabilities)) {
        dbg('peer:capabilities', connKey, entry.capabilities)
        this._emit('peer:capabilities', { peerJsId: entry.peerJsId, peerId: entry.peerId, capabilities: entry.capabilities })
      }
    }
    // 学习对端所在房间（含别名和规则）
    const rooms = msg.payload?.rooms || []
    for (const r of rooms) {
      entry.rooms.add(r.name)
      this._mergeRoom(r.name, entry.peerJsId, entry.peerId, entry.name, null, null, r.aliases, r.rules, r.owner)
      // 通知 UI 刷新成员列表（新成员/改名通过 hello 同步后立即显示，无需刷新页面）
      this._emit('member:update', { room: r.name })
    }
    // 仅在首次 hello 时回复，避免无限 hello 循环
    if (!entry.helloExchanged) {
      entry.helloExchanged = true
      await this._sendHello(connKey)
      await this._sendRoomList(connKey)
    }
    this._recomputeRooms()
  }

  async _onJoinRoom(connKey, msg) {
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
        await this._sendRaw(connKey, {
          type: MsgType.JOIN_REJECTED,
          payload: { room, reason: '密码错误' }
        }, msg.from)
        return
      }
      // 密码正确，新成员也缓存密码
    }

    const entry = this.connections.get(connKey)
    if (entry) entry.rooms.add(room)
    this._mergeRoom(room, entry?.peerJsId, msg.from, msg.extensions?.name || entry?.name)
    this._recomputeRooms()
    this._emit('member:update', { room })
  }

  _onLeaveRoom(connKey, msg) {
    const room = msg.payload?.room
    if (!room) return
    const entry = this.connections.get(connKey)
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
      // 房主声明可信度检查：只有"广播者自己就是房主"（hello 里 owner === 广播者 peerId）
      // 或本地还不知道房主时，才采纳该声明。否则普通成员广播的过时 owner 会覆盖真实房主。
      if (peerId === owner || !r.owner) {
        r.owner = owner
      }
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

  /** 获取指定房间内所有成员的 peerId 列表（用于 UI 显示如呼叫） */
  getRoomMembers(roomName) {
    const known = this.knownRooms.get(roomName)
    if (!known) return []
    const result = []
    for (const [peerId, info] of known.members) {
      result.push({ peerId, name: info.name || '' })
    }
    return result
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
    // 注意：owner 未知时不能默认自己是房主（否则新加入者会显示 99 星），
    // 从 knownRooms 或本地缓存房间记录恢复，都没有则置空，等 hello 学习。
    if (!this._localRoomMeta.has(room)) {
      const known = this.knownRooms.get(room)
      const cached = await getRoom(room)
      this._localRoomMeta.set(room, {
        aliases: known ? [...known.aliases] : [],
        rules: known ? { ...known.rules } : { ...DEFAULT_RULES },
        owner: known?.owner || cached?.owner || null
      })
    }
    this._mergeRoom(room, this.peerJsId, this.identity.peerId, this.ownName)
    this._recomputeRooms()
    await this._broadcast({
      type: MsgType.JOIN_ROOM,
      payload: { room, password: actualPassword }
    })
    await this.requestHistory(room, 0)
    // Phase 2.2: 入房后拉取群公告
    this._fetchAnnouncement(room).catch(() => {})
    // Phase 2.3: 入房后拉取 Pin 列表
    this._fetchPins(room).catch(() => {})
    // Phase 2.4: 入房后拉取云文档列表
    this._fetchDocs(room).catch(() => {})
    this._emit('member:update', { room })
  }

  // ---------------- Phase 2.2: 群公告 ----------------

  /**
   * 设置房间公告（仅 owner 或星标 ≥ 50 可操作）。
   * STORE 到 LCAN（发送者离线后其他节点仍可读）+ 广播 ANNOUNCEMENT 信号。
   * @param {string} room
   * @param {string} text  公告文本（空字符串表示清除公告）
   */
  async setAnnouncement(room, text) {
    if (!this._localRoomsSet.has(room)) {
      this._emit('error', { type: 'announcement_denied', message: '请先加入房间' })
      return false
    }
    // 权限校验：owner 或星标 ≥ 50
    const meta = this._localRoomMeta.get(room)
    const known = this.knownRooms.get(room)
    const owner = meta?.owner || known?.owner
    const isOwner = owner === this.identity.peerId
    const myStars = this._getMyStars(room)
    if (!isOwner && myStars < 50) {
      this._emit('error', { type: 'announcement_denied', message: '仅房主或星标≥50的成员可发布公告' })
      return false
    }

    const ann = {
      room,
      text: String(text || ''),
      from: this.identity.peerId,
      name: this.ownName,
      timestamp: Date.now()
    }

    // LCAN STORE（发送者离线后，其他节点仍可从责任集/holder 获取公告）
    this.lcanStore('room', room + ':announcement', ann).catch(() => {})

    // 广播 ANNOUNCEMENT 信号（在线节点立即收到）
    const msg = await buildMessage(
      {
        type: MsgType.ANNOUNCEMENT,
        from: this.identity.peerId,
        to: room,
        payload: ann,
        extensions: { name: this.ownName }
      },
      this.identity.privateKey
    )
    this._markProcessed(msg.id)
    await this._broadcast(msg)

    // 本地立即生效
    this._emit('announcement', ann)
    return true
  }

  /**
   * 收到公告广播信号。
   * @param {{ payload: { room, text, from, name, timestamp } }} msg
   */
  _onAnnouncement(msg) {
    if (!this._markProcessed(msg.id)) return
    const ann = msg.payload
    if (!ann || !ann.room) return
    // 屏蔽过滤
    if (this._isMessageBanned(ann.room, msg.from)) return
    // 持久化到本地 LCAN（后续入房者可从本地获取）
    this.lcanStore('room', ann.room + ':announcement', ann).catch(() => {})
    this._emit('announcement', ann)
  }

  /**
   * 从 LCAN 拉取房间公告（入房时调用，离线发送者仍可读）。
   * @param {string} room
   */
  async _fetchAnnouncement(room) {
    try {
      const result = await this.lcanGet('room', room + ':announcement')
      if (result?.payload) {
        this._emit('announcement', result.payload)
      }
    } catch (e) {
      // NOT_FOUND 或无候选——房间无公告，正常静默
    }
  }

  // ---------------- Phase 2.3: Pin 置顶 ----------------

  /**
   * 切换消息置顶状态（加入房间即可操作；owner/星标≥50 可管理他人消息的 Pin）。
   * STORE 到 LCAN（发送者离线后其他节点仍可读）+ 广播 PIN_UPDATE 信号。
   * @param {string} room
   * @param {string} msgId  目标消息 ID
   * @returns {Promise<boolean>} 操作是否成功
   */
  async togglePin(room, msgId) {
    if (!this._localRoomsSet.has(room)) {
      this._emit('error', { type: 'pin_denied', message: '请先加入房间' })
      return false
    }
    // 读取当前 Pin 列表（本地缓存 + LCAN 合并）
    const current = await this._loadPins(room)
    const set = new Set(current)
    const pinned = set.has(msgId)
    if (pinned) {
      set.delete(msgId)
    } else {
      set.add(msgId)
    }
    const pins = [...set]
    const pinData = {
      room,
      pins,
      from: this.identity.peerId,
      name: this.ownName,
      timestamp: Date.now()
    }
    // LCAN STORE（发送者离线后，其他节点仍可从责任集/holder 获取 Pin 列表）
    this.lcanStore('room', room + ':pins', pinData).catch(() => {})
    // 广播 PIN_UPDATE 信号（在线节点立即收到）
    const msg = await buildMessage(
      {
        type: MsgType.PIN_UPDATE,
        from: this.identity.peerId,
        to: room,
        payload: pinData,
        extensions: { name: this.ownName }
      },
      this.identity.privateKey
    )
    this._markProcessed(msg.id)
    await this._broadcast(msg)
    // 本地立即生效
    this._emit('pin_update', pinData)
    return true
  }

  /**
   * 收到 Pin 列表变更广播信号。
   * @param {{ payload: { room, pins: string[], from, name, timestamp } }} msg
   */
  _onPinUpdate(msg) {
    if (!this._markProcessed(msg.id)) return
    const pinData = msg.payload
    if (!pinData || !pinData.room || !Array.isArray(pinData.pins)) return
    // 屏蔽过滤
    if (this._isMessageBanned(pinData.room, msg.from)) return
    // 持久化到本地 LCAN（后续入房者可从本地获取）
    this.lcanStore('room', pinData.room + ':pins', pinData).catch(() => {})
    this._emit('pin_update', pinData)
  }

  /**
   * 从 LCAN 拉取房间 Pin 列表（入房时调用，离线发送者仍可读）。
   * @param {string} room
   */
  async _fetchPins(room) {
    try {
      const result = await this.lcanGet('room', room + ':pins')
      if (result?.payload) {
        this._emit('pin_update', result.payload)
      }
    } catch (e) {
      // NOT_FOUND 或无候选——房间无 Pin，正常静默
    }
  }

  /**
   * 加载当前房间的 Pin 列表（本地 LCAN 读取）。
   * @param {string} room
   * @returns {Promise<string[]>}
   */
  async _loadPins(room) {
    try {
      const result = await this.lcanGet('room', room + ':pins')
      if (result?.payload?.pins && Array.isArray(result.payload.pins)) {
        return result.payload.pins
      }
    } catch (e) {
      /* NOT_FOUND 正常 */
    }
    return []
  }

  // ---------------- Phase 2.4: 云文档（LWW + 版本） ----------------

  /**
   * 创建新云文档。
   * @param {string} room
   * @param {string} title
   * @returns {Promise<Object|null>} 创建的文档对象
   */
  async createDoc(room, title) {
    if (!this._localRoomsSet.has(room)) {
      this._emit('error', { type: 'doc_denied', message: '请先加入房间' })
      return null
    }
    const doc = {
      docId: 'doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      room,
      title: String(title || '未命名文档'),
      content: '',
      version: 1,
      updatedAt: Date.now(),
      author: this.identity.peerId,
      authorName: this.ownName,
      deleted: false
    }
    await putDoc(doc)
    this.lcanStore('doc', doc.docId, doc).catch(() => {})
    await this._broadcastDocUpdate(room, doc)
    this._emit('doc_update', { room, doc })
    return doc
  }

  /**
   * 更新云文档内容（version+1）。
   * @param {string} room
   * @param {string} docId
   * @param {Object} patch { title?, content? }
   * @returns {Promise<Object|null>} 更新后的文档；版本冲突返回 null
   */
  async updateDoc(room, docId, patch) {
    if (!this._localRoomsSet.has(room)) {
      this._emit('error', { type: 'doc_denied', message: '请先加入房间' })
      return null
    }
    const existing = await getDoc(docId)
    if (!existing) {
      this._emit('error', { type: 'doc_not_found', message: '文档不存在' })
      return null
    }
    const updated = {
      ...existing,
      title: patch.title !== undefined ? patch.title : existing.title,
      content: patch.content !== undefined ? patch.content : existing.content,
      version: existing.version + 1,
      updatedAt: Date.now(),
      author: this.identity.peerId,
      authorName: this.ownName
    }
    const ok = await putDoc(updated)
    if (!ok) {
      // 版本冲突：本地已有更高版本
      this._emit('doc_conflict', { room, docId, local: existing, remote: updated })
      return null
    }
    this.lcanStore('doc', docId, updated).catch(() => {})
    await this._broadcastDocUpdate(room, updated)
    this._emit('doc_update', { room, doc: updated })
    return updated
  }

  /**
   * 重命名云文档。
   */
  async renameDoc(room, docId, newTitle) {
    return this.updateDoc(room, docId, { title: newTitle })
  }

  /**
   * 删除云文档（标记删除，version+1，广播）。
   */
  async deleteDocRemote(room, docId) {
    if (!this._localRoomsSet.has(room)) {
      this._emit('error', { type: 'doc_denied', message: '请先加入房间' })
      return false
    }
    const existing = await getDoc(docId)
    if (!existing) return false
    const deleted = {
      ...existing,
      deleted: true,
      version: existing.version + 1,
      updatedAt: Date.now(),
      author: this.identity.peerId,
      authorName: this.ownName
    }
    await putDoc(deleted)
    this.lcanStore('doc', docId, deleted).catch(() => {})
    await this._broadcastDocUpdate(room, deleted)
    this._emit('doc_update', { room, doc: deleted })
    // 本地物理删除（标记删除的文档从 IndexedDB 清除，仅保留 LCAN 中的副本供其他节点同步）
    await deleteDoc(docId)
    return true
  }

  /** 广播 DOC_UPDATE 信号 */
  async _broadcastDocUpdate(room, doc) {
    const msg = await buildMessage(
      {
        type: MsgType.DOC_UPDATE,
        from: this.identity.peerId,
        to: room,
        payload: { room, doc },
        extensions: { name: this.ownName }
      },
      this.identity.privateKey
    )
    this._markProcessed(msg.id)
    await this._broadcast(msg)
  }

  /** 收到文档更新广播 */
  async _onDocUpdate(msg) {
    if (!this._markProcessed(msg.id)) return
    const { room, doc } = msg.payload || {}
    if (!room || !doc || !doc.docId) return
    if (this._isMessageBanned(room, msg.from)) return
    // LWW 写入本地
    const ok = await putDoc(doc)
    if (ok) {
      this.lcanStore('doc', doc.docId, doc).catch(() => {})
      this._emit('doc_update', { room, doc })
    } else {
      // 本地版本更高 → 冲突提示（仅当前用户正在编辑该文档时）
      const local = await getDoc(doc.docId)
      if (local) {
        this._emit('doc_conflict', { room, docId: doc.docId, local, remote: doc })
      }
    }
  }

  /** 收到文档列表同步请求 → 回复本地文档列表 */
  async _onDocList(connKey, msg) {
    if (!this._markProcessed(msg.id)) return
    const room = msg.payload?.room
    if (!room || !this._localRoomsSet.has(room)) return
    const docs = await getAllDocs(room)
    for (const doc of docs) {
      // 逐个广播（复用 DOC_UPDATE 通道，对端 LWW 合并）
      const reply = await buildMessage(
        {
          type: MsgType.DOC_UPDATE,
          from: this.identity.peerId,
          to: room,
          payload: { room, doc },
          extensions: { name: this.ownName }
        },
        this.identity.privateKey
      )
      // 定向回复（不广播，避免风暴）
      this._send(connKey, reply).catch(() => {})
    }
  }

  /** 入房时拉取云文档列表（本地 + 网络） */
  async _fetchDocs(room) {
    // 1. 本地缓存先渲染
    const localDocs = await getAllDocs(room)
    for (const doc of localDocs) {
      if (!doc.deleted) {
        this._emit('doc_update', { room, doc })
      }
    }
    // 2. 网络请求其他节点的文档列表
    try {
      const msg = await buildMessage(
        {
          type: MsgType.DOC_LIST,
          from: this.identity.peerId,
          to: room,
          payload: { room },
          extensions: { name: this.ownName }
        },
        this.identity.privateKey
      )
      this._markProcessed(msg.id)
      await this._broadcast(msg)
    } catch (e) {
      /* 静默 */
    }
    // 3. 从 LCAN 拉取已知 docId 的最新版本（补充离线期间的更新）
    // 此处依赖 DOC_LIST 的回复覆盖，LCAN 兜底由责任集提供
  }

  // ---------------- Phase 2.5: 消息搜索（本地 + 网络） ----------------

  /**
   * 网络搜索消息：广播 MSG_SEARCH 给所有已连接节点，2s 内聚合回复。
   * 本地搜索由调用方（useChat）自行执行，此处仅负责网络部分。
   * @param {string} keyword  搜索关键词
   * @returns {Promise<string>} searchId（用于追踪本次搜索）
   */
  async searchMessagesNetwork(keyword) {
    const kw = String(keyword || '').trim()
    if (!kw) return null
    const searchId = 'search-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
    // 广播搜索请求
    try {
      const msg = await buildMessage(
        {
          type: MsgType.MSG_SEARCH,
          from: this.identity.peerId,
          to: '',
          payload: { keyword: kw, searchId },
          extensions: { name: this.ownName }
        },
        this.identity.privateKey
      )
      this._markProcessed(msg.id)
      await this._broadcast(msg)
    } catch (e) {
      /* 静默 */
    }
    return searchId
  }

  /** 收到搜索请求 → 搜索本地消息 → 定向回复结果 */
  async _onMsgSearch(connKey, msg) {
    if (!this._markProcessed(msg.id)) return
    const { keyword, searchId } = msg.payload || {}
    if (!keyword || !searchId) return
    // 搜索本地消息（限制 20 条，避免回复过大）
    let results = []
    try {
      results = await searchMessagesInDB(keyword, { limit: 20 })
    } catch (e) {
      results = []
    }
    if (!results.length) return // 无结果不回复，减少网络开销
    try {
      const reply = await buildMessage(
        {
          type: MsgType.MSG_SEARCH_RESULT,
          from: this.identity.peerId,
          to: '',
          payload: { searchId, results },
          extensions: { name: this.ownName }
        },
        this.identity.privateKey
      )
      // 定向回复（不广播）
      this._send(connKey, reply).catch(() => {})
    } catch (e) {
      /* 静默 */
    }
  }

  /** 收到搜索结果 → 合并并 emit */
  _onMsgSearchResult(msg) {
    if (!this._markProcessed(msg.id)) return
    const { searchId, results } = msg.payload || {}
    if (!searchId || !Array.isArray(results)) return
    this._emit('search_result', { searchId, results, from: msg.from })
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

  // ---------------- Phase 3.1: 消息编辑 / 撤回 / 回应 ----------------

  /**
   * 编辑自己发送的消息（仅发送者本人可操作；签名校验 from）。
   * @param {string} room
   * @param {string} msgId   目标消息 ID
   * @param {string} newText 新文本
   * @param {string} originalFrom  原消息发送者 peerId（必须等于本节点，否则本地拒绝）
   * @param {number} originalTimestamp  原消息时间戳（用于撤回时限校验，编辑不强制）
   * @returns {Promise<boolean>}
   */
  async editMessage(room, msgId, newText, originalFrom, originalTimestamp) {
    if (!this._localRoomsSet.has(room)) return false
    // 仅发送者本人可编辑：本地先校验身份
    if (originalFrom !== this.identity.peerId) {
      this._emit('error', { type: 'edit_denied', message: '只能编辑自己发送的消息' })
      return false
    }
    const editMsg = await buildMessage(
      {
        type: MsgType.EDIT,
        from: this.identity.peerId,
        to: room,
        payload: { room, msgId, newText: String(newText || ''), originalFrom, originalTimestamp },
        extensions: { name: this.ownName }
      },
      this.identity.privateKey
    )
    this._markProcessed(editMsg.id)
    // 本地立即生效
    this._emit('message:edit', { room, msgId, newText: editMsg.payload.newText })
    await this._broadcast(editMsg)
    return true
  }

  /**
   * 撤回自己发送的消息（仅发送者本人 + 5 分钟内）。
   */
  async recallMessage(room, msgId, originalFrom, originalTimestamp) {
    if (!this._localRoomsSet.has(room)) return false
    if (originalFrom !== this.identity.peerId) {
      this._emit('error', { type: 'recall_denied', message: '只能撤回自己发送的消息' })
      return false
    }
    // 5 分钟时限
    if (originalTimestamp && Date.now() - originalTimestamp > 5 * 60 * 1000) {
      this._emit('error', { type: 'recall_expired', message: '已超过 5 分钟，无法撤回' })
      return false
    }
    const delMsg = await buildMessage(
      {
        type: MsgType.DELETE,
        from: this.identity.peerId,
        to: room,
        payload: { room, msgId, originalFrom, originalTimestamp },
        extensions: { name: this.ownName }
      },
      this.identity.privateKey
    )
    this._markProcessed(delMsg.id)
    this._emit('message:delete', { room, msgId })
    await this._broadcast(delMsg)
    return true
  }

  /**
   * 表情回应（任意成员可操作，可重复切换）。
   * @param {string} room
   * @param {string} msgId
   * @param {string} emoji
   * @param {'add'|'remove'} action
   */
  async reactToMessage(room, msgId, emoji, action) {
    if (!this._localRoomsSet.has(room)) return false
    const reactMsg = await buildMessage(
      {
        type: MsgType.REACT,
        from: this.identity.peerId,
        to: room,
        payload: { room, msgId, emoji, action: action || 'add' },
        extensions: { name: this.ownName }
      },
      this.identity.privateKey
    )
    this._markProcessed(reactMsg.id)
    this._emit('message:react', { room, msgId, emoji, action: reactMsg.payload.action, from: this.identity.peerId })
    await this._broadcast(reactMsg)
    return true
  }

  /** 收到编辑广播：仅原发送者可编辑（签名校验 from === originalFrom） */
  _onEdit(msg) {
    if (!this._markProcessed(msg.id)) return
    const { room, msgId, newText, originalFrom } = msg.payload || {}
    if (!room || !msgId) return
    // 权限校验：编辑者必须是原消息发送者（from 由签名保证不可伪造）
    if (msg.from !== originalFrom) {
      dbg('edit: 非发送者操作被拒', msg.from, originalFrom)
      return
    }
    this._emit('message:edit', { room, msgId, newText })
    if (msg.from !== this.identity.peerId) this._forward(msg)
  }

  /** 收到撤回广播：仅原发送者 + 5 分钟内 */
  _onDelete(msg) {
    if (!this._markProcessed(msg.id)) return
    const { room, msgId, originalFrom, originalTimestamp } = msg.payload || {}
    if (!room || !msgId) return
    if (msg.from !== originalFrom) {
      dbg('delete: 非发送者操作被拒', msg.from, originalFrom)
      return
    }
    if (originalTimestamp && Date.now() - originalTimestamp > 5 * 60 * 1000) {
      dbg('delete: 超过 5 分钟时限被拒')
      return
    }
    this._emit('message:delete', { room, msgId })
    if (msg.from !== this.identity.peerId) this._forward(msg)
  }

  /** 收到表情回应广播：更新聚合（add/remove） */
  _onReact(msg) {
    if (!this._markProcessed(msg.id)) return
    const { room, msgId, emoji, action } = msg.payload || {}
    if (!room || !msgId || !emoji) return
    this._emit('message:react', { room, msgId, emoji, action: action || 'add', from: msg.from })
    if (msg.from !== this.identity.peerId) this._forward(msg)
  }

  // ---- Phase 3.2: @提及 + 已读回执 ----
  _onMention(msg) {
    if (!this._markProcessed(msg.id)) return
    const { room, msgId, mentioned } = msg.payload || {}
    if (!room || !msgId || !Array.isArray(mentioned)) return
    this._emit('mention', { room, msgId, mentioned, from: msg.from, name: msg.extensions?.name || msg.from.slice(0, 8) })
  }

  _onReadReceipt(msg) {
    if (!this._markProcessed(msg.id)) return
    const { room, msgIds } = msg.payload || {}
    if (!room || !Array.isArray(msgIds)) return
    this._emit('read_receipt', { room, msgIds, from: msg.from })
  }

  // ---- Phase 3.3: 话题 ----
  _onThreadCreate(msg) {
    if (!this._markProcessed(msg.id)) return
    const { rootMsgId, room } = msg.payload || {}
    if (!rootMsgId || !room) return
    this._emit('thread:create', { rootMsgId, room, from: msg.from })
  }

  _onThreadReply(msg) {
    if (!this._markProcessed(msg.id)) return
    const { rootMsgId, msgId, room } = msg.payload || {}
    if (!rootMsgId || !msgId || !room) return
    this._emit('thread:reply', {
      rootMsgId,
      msgId,
      room,
      from: msg.from,
      text: msg.payload?.text || ''
    })
  }

  // ---- Phase 3.4: 私聊 E2E ----
  _onDmCreate(msg) {
    if (!this._markProcessed(msg.id)) return
    const { to, pubKey } = msg.payload || {}
    if (!to || !pubKey) return
    this._emit('dm:create', { from: msg.from, pubKey })
  }

  async _onDmMessage(msg) {
    if (!this._markProcessed(msg.id)) return
    const { to, iv, ciphertext } = msg.payload || {}
    if (!to || !iv || !ciphertext) return
    // 尝试用已有会话密钥解密
    const session = this._dmSessions?.get(msg.from)
    if (session?.key) {
      try {
        const plain = await aesGcmDecrypt(session.key, iv, ciphertext)
        this._emit('dm:message', { from: msg.from, text: plain, timestamp: Date.now() })
        return
      } catch (e) {
        // 密钥失效，忽略
      }
    }
    // 无会话密钥：无法解密，静默丢弃
  }

  _onDmKey(msg) {
    if (!this._markProcessed(msg.id)) return
    const { to, pubKey } = msg.payload || {}
    if (!to || !pubKey) return
    this._emit('dm:key', { from: msg.from, pubKey })
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
    // 文件大小上限
    const MAX_FILE_SIZE = 100 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      this._emit('error', { type: 'file_too_large', message: `文件超过 100MB 限制（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` })
      return false
    }

    // ---- 全程 ArrayBuffer（零 base64 膨胀） ----
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(file)
    })

    // 唯一 fileId
    const fileId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
    // 总哈希（sha256，noble 纯 JS，安全/非安全上下文通用）
    const totalHashHex = sha256Hex(arrayBuffer)
    // 每文件一次签名（fileId + ':' + totalHashHex）—— 分片只带 fileId+index，不逐片签
    const fileSig = await edSign(this.identity.privateKey, fileId + ':' + totalHashHex)

    // 图片缩略图（meta 卡片预览用，小 dataUrl 走 JSON 通道）
    let thumbDataUrl = null
    if (file.type && file.type.startsWith('image/')) {
      thumbDataUrl = await makeThumbnailFromBlob(file)
    }

    // 缓存完整 ArrayBuffer（供按需拉取；本节点是首个 holder）
    this._sentFileIds.add(fileId)
    if (!this._outgoingFiles) this._outgoingFiles = new Map()
    this._outgoingFiles.set(fileId, {
      room,
      arrayBuffer,
      name: file.name,
      type: file.type,
      size: file.size,
      totalHashHex,
      fileSig,
      chunkSize: 0, // 探测后填充
      totalChunks: 0,
      originalFrom: this.identity.peerId // 原始发送者（fileSig 验签用）
    })
    addHolder('file:' + fileId, this.identity.peerId)
    // 上限 20 个，超出清理最早的
    if (this._outgoingFiles.size > 20) {
      const oldest = this._outgoingFiles.keys().next().value
      this._outgoingFiles.delete(oldest)
    }

    // 本地立即可见（blob URL，无 base64）
    const localBlobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' }))
    this._emit('chat', {
      id: fileId,
      room,
      from: this.identity.peerId,
      name: this.ownName,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        blobUrl: localBlobUrl,
        fileId,
        fromPeerId: this.identity.peerId,
        totalHashHex,
        isMeta: false,
        isLocal: true
      },
      timestamp: Date.now()
    })

    // 广播 FILE_META（控制信息走 JSON 通道；分片内容走 bin 通道）
    const meta = await buildMessage(
      {
        type: MsgType.FILE_META,
        from: this.identity.peerId,
        to: room,
        payload: {
          room,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileId,
          thumbDataUrl,
          totalHashHex,
          fileSig,
          bin: true // 标记：使用 bin 通道推送分片
        },
        extensions: { name: this.ownName }
      },
      this.identity.privateKey
    )
    this._markProcessed(meta.id)
    await this._broadcast(meta)

    // LCAN STORE 文件元信息（发送者离线后，其他节点仍可从 LCAN 获知文件存在）
    this.lcanStore('file', fileId, {
      room,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileId,
      totalHashHex,
      fileSig,
      from: this.identity.peerId,
      name: this.ownName
    }).catch(() => {})

    // 向所有已连接 peer 推送分片（bin 通道，每连接 3 路并发）
    this._pushFileChunks(fileId).catch((e) => {
      console.warn('[nchat] push file chunks failed:', e?.message)
    })

    return true
  }

  /**
   * 向所有已连接且 bin 在线的 peer 推送文件分片（每连接独立探测 + 3 路并发）。
   * @param {string} fileId
   */
  async _pushFileChunks(fileId) {
    const entry = this._outgoingFiles?.get(fileId)
    if (!entry) return
    const targets = []
    for (const [connKey, conn] of this.connections) {
      if (!conn.peerId) continue
      if (conn.binStatus !== 'online') continue
      targets.push(connKey)
    }
    if (targets.length === 0) return
    await Promise.allSettled(
      targets.map((ck) => this._pushFileChunksToPeer(ck, fileId, entry))
    )
  }

  /**
   * 向单个 peer 推送文件分片：探测能力 → 自适应分片 → 3 路并发发送。
   * @param {string} connKey
   * @param {string} fileId
   * @param {object} entry  _outgoingFiles 条目
   */
  async _pushFileChunksToPeer(connKey, fileId, entry) {
    const { arrayBuffer, totalHashHex, fileSig, name, type, size, room } = entry
    // 探测能力（缓存命中不重复探测）
    const cap = await this._probeCapability(connKey)
    const chunkSize = Math.max(1024, cap - FILE_CHUNK_HEADER_MARGIN)
    const total = Math.ceil(arrayBuffer.byteLength / chunkSize)
    // 更新缓存（供 _onFileRequest 用同样的尺寸）
    entry.chunkSize = chunkSize
    entry.totalChunks = total

    for (let start = 0; start < total; start += FILE_BIN_CONCURRENCY) {
      const end = Math.min(start + FILE_BIN_CONCURRENCY, total)
      const tasks = []
      for (let i = start; i < end; i++) {
        const offset = i * chunkSize
        const len = Math.min(chunkSize, arrayBuffer.byteLength - offset)
        const buf = arrayBuffer.slice(offset, offset + len)
        tasks.push(
          this._sendBinary(connKey, {
            kind: BinKind.FILE_CHUNK,
            fileId,
            index: i,
            total,
            chunkSize,
            totalHashHex,
            fileSig,
            from: this.identity.peerId,
            fileName: name,
            fileType: type,
            fileSize: size,
            room,
            name: this.ownName,
            buf
          })
        )
      }
      await Promise.all(tasks)
    }
  }

  /** 处理收到的文件消息 */
  _onFileMessage(msg) {
    const room = msg.payload?.room
    const dataUrl = msg.payload?.dataUrl
    if (!room || !dataUrl) return

    if (!this._markProcessed(msg.id)) return

    // 屏蔽过滤
    if (this._isMessageBanned(room, msg.from)) return

    const { fileId, chunkIndex, totalChunks } = msg.payload
    // 分片消息：聚合完成后才显示
    if (typeof chunkIndex === 'number' && typeof totalChunks === 'number' && fileId) {
      if (!this._fileChunks) this._fileChunks = new Map()
      let agg = this._fileChunks.get(fileId)
      if (!agg) {
        agg = {
          total: totalChunks,
          chunks: new Map(),
          meta: {
            fileName: msg.payload.fileName,
            fileType: msg.payload.fileType,
            fileSize: msg.payload.fileSize,
            from: msg.from,
            name: msg.extensions?.name || msg.from.slice(0, 8),
            timestamp: msg.timestamp
          },
          firstSeen: Date.now()
        }
        this._fileChunks.set(fileId, agg)
      }
      agg.chunks.set(chunkIndex, dataUrl)
      // 全部到齐：拼接并显示
      if (agg.chunks.size >= agg.total) {
        let full = ''
        for (let i = 0; i < agg.total; i++) full += agg.chunks.get(i) || ''
        this._fileChunks.delete(fileId)
        this._emit('chat', {
          id: fileId,
          room,
          from: agg.meta.from,
          name: agg.meta.name,
          file: {
            name: agg.meta.fileName,
            type: agg.meta.fileType,
            size: agg.meta.fileSize,
            dataUrl: full,
            fileId,
            fromPeerId: agg.meta.from
          },
          timestamp: agg.meta.timestamp
        })
      } else {
        // 惰性清理：超过 10 分钟未完成的聚合丢弃，避免内存泄漏
        if (this._fileChunks.size > 50) {
          const cutoff = Date.now() - 10 * 60 * 1000
          for (const [fid, a] of this._fileChunks) {
            if (a.firstSeen < cutoff) this._fileChunks.delete(fid)
          }
        }
      }
    } else {
      // 兼容旧格式：单条完整消息
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
    }

    if (msg.from !== this.identity.peerId) {
      this._forward(msg)
    }
  }

  /** 处理收到的大文件元信息（不传完整内容，仅元数据 + 缩略图） */
  _onFileMeta(msg) {
    const room = msg.payload?.room
    const fileId = msg.payload?.fileId
    if (!room || !fileId) return
    if (!this._markProcessed(msg.id)) return
    // 屏蔽过滤
    if (this._isMessageBanned(room, msg.from)) return

    // 记录文件元信息到 holder 表索引（便于后续多源拉取定位）
    // 注意：holder 表的 key 是 'file:' + fileId，记录的是"谁持有完整内容"
    // 此处先不加入 holder（meta 不是完整内容），等收到分片组装完成后再加

    this._emit('chat', {
      id: fileId,
      room,
      from: msg.from,
      name: msg.extensions?.name || msg.from.slice(0, 8),
      file: {
        name: msg.payload.fileName,
        type: msg.payload.fileType,
        size: msg.payload.fileSize,
        fileId,
        fromPeerId: msg.from,
        // 元信息模式：无完整内容，仅缩略图；分片由 bin 通道自动推送或点击拉取
        thumbDataUrl: msg.payload.thumbDataUrl || null,
        totalHashHex: msg.payload.totalHashHex || null,
        isMeta: true
      },
      timestamp: msg.timestamp
    })

    // 元信息也转发（让间接连接的节点也能看到文件卡片）
    if (msg.from !== this.identity.peerId) {
      this._forward(msg)
    }
  }

  /** 收到文件不可用通知（发送者缓存已失效，如刷新页面） */
  _onFileUnavailable(msg) {
    const fileId = msg.payload?.fileId
    if (!fileId) return
    this._emit('file:unavailable', { fileId, from: msg.from })
  }

  /**
   * 请求下载大文件完整内容（多源并行拉取）。
   * 查 holder 表 → 在线 holder 取模分配 → 各 holder 通过 bin 通道回传分片。
   * 无已知在线 holder 时退化为广播请求。
   * @param {string} fileId
   * @param {string} [_fromPeerId]  原始发送者 peerId（兼容旧 API，未使用）
   */
  async requestFile(fileId, _fromPeerId) {
    if (!fileId) return false

    // 确定分片大小：优先用已部分接收的 chunkSize（保证 push/pull 索引对齐），
    // 否则用默认 64KB
    let chunkSize = PULL_CHUNK_SIZE
    if (this._fileChunks?.has(fileId)) {
      const agg = this._fileChunks.get(fileId)
      if (agg?.chunkSize) chunkSize = agg.chunkSize
    }

    // 查 holder 表，过滤出在线的（排除自己）
    const allHolders = getHolders('file:' + fileId) || []
    const onlineHolders = allHolders.filter(
      (pid) => pid !== this.identity.peerId && this._connKeyForPeerId(pid)
    )

    if (onlineHolders.length === 0) {
      // 无已知在线 holder：广播请求（房间内任何持有者响应）
      await this._broadcast({
        type: MsgType.FILE_REQUEST,
        payload: { fileId, chunkSize }
      })
      return true
    }

    // 多源并行：按 holder 位置取模分配分片
    const modulo = onlineHolders.length
    const tasks = onlineHolders.map((pid, pos) => {
      const ck = this._connKeyForPeerId(pid)
      if (!ck) return Promise.resolve()
      return this._sendRaw(ck, {
        type: MsgType.FILE_REQUEST,
        payload: { fileId, chunkSize, modulo, position: pos }
      }, pid)
    })
    await Promise.all(tasks)
    return true
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
        this._pruneZombieConnections()
      } catch (e) {
        /* ignore */
      }
    }, 2000)

    // LCAN 维护定时器（TTL 清扫 + 副本自愈 + holder 同步，60s 周期）
    this._startLcanTimers()
  }

  _stopTimers() {
    clearInterval(this._heartbeatTimer)
    clearInterval(this._discoveryTimer)
    clearInterval(this._checkTimer)
    this._heartbeatTimer = this._discoveryTimer = this._checkTimer = null
    this._stopLcanTimers()
  }

  _discover() {
    // 兼容：对主域执行发现（定时器调用入口）
    if (this._primaryDomainKey) {
      this._discoverDomain(this._primaryDomainKey)
    }
  }

  /**
   * 发现指定域上的所有在线 peer 并主动连接（多域并行发现）。
   * @param {string} domainKey
   */
  _discoverDomain(domainKey) {
    const d = this.peers.get(domainKey)
    if (!d || !d.peer || d.peer.destroyed) return
    if (typeof d.peer.listAllPeers !== 'function') return
    if (!d.peerJsId) return
    // PeerJS 的 listAllPeers 是回调式（不返回 Promise），
    // 且需要信令 socket 已连接；未连接时回调可能不触发，需防御。
    let done = false
    const finish = (ids) => {
      if (done) return
      done = true
      dbg('discover:domain', domainKey, Array.isArray(ids) ? ids.length + ' peers' : 'non-array')
      if (!Array.isArray(ids)) return
      for (const id of ids) {
        if (id !== d.peerJsId) {
          this._connectTo(id, domainKey)
        }
      }
    }
    try {
      const ret = d.peer.listAllPeers((...args) => {
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
      dbg('discover:domain error', domainKey, e?.message)
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

  /**
   * 清理僵尸连接：无 peerId 且数据通道未 open 的连接（通常是 PeerJS 握手残留）。
   * 这些连接浪费 _broadcast 迭代带宽，且 conn.send() 会静默失败。
   * 每 2 秒由 _checkTimer 调用一次。
   */
  _pruneZombieConnections() {
    if (this.connections.size <= 1) return // 单节点无需清理
    let pruned = 0
    for (const [connKey, entry] of this.connections) {
      // 有 peerId 的连接保留（即使暂时 offline，由 _checkLiveness 处理）
      if (entry.peerId) continue
      // 数据通道已 open → 可能是正在握手的合法连接，再给一点时间
      if (entry.conn && entry.conn.open) continue
      // 无 peerId + 未 open + 存在超过 10s → 僵尸，清理
      if ((entry.createdAt || 0) < Date.now() - 10000) {
        try { if (entry.conn) entry.conn.close() } catch (e) { /* ignore */ }
        this.connections.delete(connKey)
        this._connKeyByPeerJsId.delete(connKey)
        pruned++
      }
    }
    if (pruned > 0) dbg('pruned', pruned, 'zombie connections')
  }

  // ---------------- 音视频通话（开发测试用） ----------------
  /**
   * 开始音视频通话（开发测试用）。
   * 查找目标 peerId 对应的 peerJsId，发起 media call。
   * @param {string} targetPeerId  目标 Ed25519 PeerID
   * @param {MediaStream} localStream 本地媒体流
   */
  async startMediaCall(targetPeerId, localStream) {
    // 查找目标的 peerJsId
    let targetPeerJsId = null
    for (const [pid, entry] of this.connections) {
      if (entry.peerId === targetPeerId) {
        targetPeerJsId = pid
        break
      }
    }
    if (!targetPeerJsId) {
      this._emit('error', {
        type: 'call_failed',
        message: '未找到目标用户的连接，请确保对方在线并已连接'
      })
      return false
    }
    if (!this.peer) {
      this._emit('error', {
        type: 'call_failed',
        message: 'PeerJS 未就绪'
      })
      return false
    }
    try {
      // 初始化媒体调用映射
      if (!this._mediaCalls) this._mediaCalls = new Map()
      const call = this.peer.call(targetPeerJsId, localStream)
      this._mediaCalls.set(targetPeerId, call)
      this._wireMediaCallEvents(call, targetPeerId)
      return true
    } catch (e) {
      this._emit('error', {
        type: 'call_failed',
        message: '媒体通话初始化失败：' + e.message
      })
      return false
    }
  }

  /** 处理收到的媒体通话请求 */
  _onMediaCall(call, fromPeerId) {
    if (!this._mediaCalls) this._mediaCalls = new Map()
    this._mediaCalls.set(fromPeerId, call)
    this._wireMediaCallEvents(call, fromPeerId)
    // 自动响应：直接接受（开发测试用）
    // 真实应用应弹出确认对话框
    this._emit('media:call', { from: fromPeerId })
  }

  _wireMediaCallEvents(call, peerId) {
    call.on('stream', (remoteStream) => {
      this._emit('media:stream', { peerId, stream: remoteStream })
    })
    call.on('close', () => {
      this._emit('media:close', { peerId })
      this._mediaCalls.delete(peerId)
    })
    call.on('error', (err) => {
      this._emit('media:error', { peerId, error: err })
      this._mediaCalls.delete(peerId)
    })
  }

  /** 接收媒体通话（开发测试用） */
  async answerMediaCall(peerId, localStream) {
    const call = this._mediaCalls?.get(peerId)
    if (!call) return false
    try {
      await call.answer(localStream)
      return true
    } catch (e) {
      this._emit('error', {
        type: 'call_failed',
        message: '回答通话失败：' + e.message
      })
      return false
    }
  }

  /** 挂断媒体通话 */
  hangupMediaCall(peerId) {
    const call = this._mediaCalls?.get(peerId)
    if (call) {
      try {
        call.close()
      } catch (e) {
        /* ignore */
      }
      this._mediaCalls.delete(peerId)
    }
  }

  // ---------------- LCAN 多副本分布式存储（蛛网核心） ----------------
  /**
   * 收集在线节点 peerId 列表（排除自己；可选排除 light 节点）。
   * @param {boolean} [excludeLight=true]  light 节点不参与责任集
   * @returns {string[]}
   */
  _onlinePeerIds(excludeLight = true) {
    const out = []
    for (const entry of this.connections.values()) {
      if (entry.status === 'disconnected') continue
      if (!entry.peerId) continue
      if (excludeLight && entry.capabilities?.storage === NodeRole.LIGHT) continue
      out.push(entry.peerId)
    }
    return out
  }

  /** 计算 LCAN key 的 hex 字符串（IndexedDB keyPath 用） */
  _lcanKeyHex(namespace, objectId) {
    return keyToHex(sha256Key(namespace, objectId))
  }

  /**
   * 计算某 key 的责任集（k=3 最近在线节点，排除 light）。
   * @param {string} keyHex
   * @returns {Array<{peerId:string, dist:bigint}>}
   */
  _responsiblePeers(keyHex) {
    const online = this._onlinePeerIds(true)
    // 加入自己（自己也是候选责任节点）
    online.push(this.identity.peerId)
    return lcanResponsible(keyHex, online, LCAN_DEFAULT_K)
  }

  /**
   * 饱和写入：向责任集 k=3 同时发 STORE，任一 ACK 即成功。
   * 发送者本人也保留一份副本（TTL=7d）。
   * @param {string} namespace  命名空间（如 'room' / 'doc' / 'thread'）
   * @param {string} objectId   对象标识
   * @param {*} payload         任意可序列化数据
   * @param {object} [opts]
   * @param {number} [opts.ttl]  存活时长 ms（默认 7 天）
   * @returns {Promise<{ok:boolean, acks:number, keyHex:string}>}
   */
  async lcanStore(namespace, objectId, payload, opts = {}) {
    const keyHex = this._lcanKeyHex(namespace, objectId)
    const ttl = opts.ttl != null ? opts.ttl : 7 * 24 * 60 * 60 * 1000
    // 发送者本人保留副本
    if (this._canStore()) {
      await lcanPut(keyHex, payload, { ttl, author: this.identity.peerId })
      addHolder(keyHex, this.identity.peerId)
    }
    // 责任集（排除自己，只发给远端）
    const resp = this._responsiblePeers(keyHex).filter(
      (r) => r.peerId !== this.identity.peerId
    )
    if (resp.length === 0) {
      // 没有其他在线节点：本地副本即全部，视为成功
      return { ok: true, acks: 0, keyHex }
    }
    const reqId = keyHex + ':store:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    return new Promise((resolve) => {
      const state = { resolve, ackCount: 0, targetCount: resp.length, timer: null, keyHex }
      this._pendingStores.set(reqId, state)
      state.timer = setTimeout(() => {
        if (this._pendingStores.has(reqId)) {
          this._pendingStores.delete(reqId)
          resolve({ ok: state.ackCount > 0, acks: state.ackCount, keyHex })
        }
      }, this._lcanGetTimeout)
      // 饱和发送：同时发给全部责任节点
      for (const r of resp) {
        const ck = this._connKeyForPeerId(r.peerId)
        if (!ck) continue
        this._sendRaw(ck, {
          type: MsgType.LCAN_STORE,
          payload: { keyHex, reqId, ttl, payload, ns: namespace, oid: objectId },
          extensions: { lcan: true }
        }).catch(() => {})
      }
    })
  }

  /** 收到 LCAN_STORE：按角色 + 命名空间策略 + 速率限制决定是否落库，回 ACK */
  async _onLcanStore(connKey, msg) {
    const { keyHex, reqId, ttl, payload, ns, oid } = msg.payload || {}
    if (!keyHex || !reqId) return
    const fromPeerId = msg.from
    let stored = false
    let rejected = false

    // ---- 存储滥用防护 ----
    // 1. 速率限制：单对端 10s 窗口内 STORE ≤ 20 次
    if (this._isRateLimited(fromPeerId)) {
      this._rejectedStoreCount++
      this._rateLimitedCount++
      rejected = true
      dbg('lcan:store rate-limited', fromPeerId, keyHex)
    }
    // 2. 命名空间接受策略：只接受已订阅命名空间
    if (!rejected && !this._isNamespaceAccepted(ns, oid)) {
      this._rejectedStoreCount++
      rejected = true
      dbg('lcan:store namespace rejected', ns, oid, keyHex)
    }

    // ---- 角色判断 + 落库 ----
    if (!rejected && this._canStore()) {
      const limit = this._storageLimit()
      if (limit > 0) {
        const count = await lcanCount().catch(() => 0)
        if (count >= limit) {
          // 超限：LRU 淘汰低引用 key 后再存（Phase 1.7 Step 3）
          await this._lcanEvictLowRef(1)
          const count2 = await lcanCount().catch(() => 0)
          if (count2 < limit) {
            stored = await lcanPut(keyHex, payload, { ttl, author: fromPeerId })
            if (stored) addHolder(keyHex, this.identity.peerId)
          } else {
            dbg('lcan:store over quota, skip', keyHex, count2, '/', limit)
          }
        } else {
          stored = await lcanPut(keyHex, payload, { ttl, author: fromPeerId })
          if (stored) addHolder(keyHex, this.identity.peerId)
        }
      }
    }
    // 回 ACK（即使拒绝也回，避免发送者干等；stored=false 表示未落库）
    await this._sendRaw(connKey, {
      type: MsgType.LCAN_ACK,
      payload: { keyHex, reqId, stored }
    })
  }

  /**
   * 命名空间接受策略：只接受本节点已加入/已订阅的命名空间。
   * - room:*  → 仅当本节点已加入该房间时接受
   * - doc:* / thread:* / announce:* / pin:* → 接受（协作数据，按配额限流）
   * - 未知命名空间 → 拒绝（防垃圾）
   * @param {string} ns  命名空间
   * @param {string} oid 对象标识
   * @returns {boolean}
   */
  _isNamespaceAccepted(ns, oid) {
    if (!ns) return true // 兼容旧消息（无 ns 字段时默认接受）
    const ACCEPTED_NS = ['doc', 'thread', 'announce', 'pin', 'search', 'file']
    if (ns === 'room') {
      // 仅当已加入该房间时接受（防止垃圾房间数据填满配额）
      return this._localRoomsSet.has(oid)
    }
    return ACCEPTED_NS.includes(ns)
  }

  /**
   * 速率限制检查：单对端 10s 窗口内 STORE ≤ 20 次，超限则加入限流集合。
   * @param {string} peerId
   * @returns {boolean} true 表示已被限流（应拒绝）
   */
  _isRateLimited(peerId) {
    if (!peerId) return false
    if (this._rateLimitedPeers.has(peerId)) return true
    const now = Date.now()
    let entry = this._storeRateMap.get(peerId)
    if (!entry || now - entry.windowStart > this._storeRateWindow) {
      entry = { count: 0, windowStart: now }
      this._storeRateMap.set(peerId, entry)
    }
    entry.count++
    if (entry.count > this._storeRateMax) {
      this._rateLimitedPeers.add(peerId)
      // 10s 后自动解除限流
      setTimeout(() => this._rateLimitedPeers.delete(peerId), this._storeRateWindow)
      return true
    }
    return false
  }

  /**
   * LRU 淘汰低引用 key（配额保护）：优先淘汰 holder 表中引用计数少的 key。
   * @param {number} n  淘汰条数
   */
  async _lcanEvictLowRef(n) {
    const db = await import('./db.js').then((m) => m).catch(() => null)
    if (!db) return
    const idb = db._idbProxy || null
    // 直接用 openMessagesDB 不可访问（私有），通过 lcanDelete 逐条删
    // 策略：从 holder 表找引用最少的 key，再查本地是否有，有则删
    const all = getAllHolders()
    // 按 holder 数升序排列（引用少的优先淘汰）
    const candidates = Object.entries(all)
      .map(([key, peers]) => ({ key, ref: peers ? peers.length : 0 }))
      .sort((a, b) => a.ref - b.ref)
    let evicted = 0
    for (const c of candidates) {
      if (evicted >= n) break
      // 只淘汰引用 ≤1 的 key（低引用 = 几乎没人用）
      if (c.ref > 1) break
      await lcanDelete(c.key)
      removeHolder(c.key, this.identity.peerId)
      evicted++
      dbg('lcan:evict low-ref', c.key, 'ref=', c.ref)
    }
  }

  /** 获取存储统计（设置面板展示用） */
  getStorageDefenseStats() {
    return {
      rejectedStoreCount: this._rejectedStoreCount,
      rateLimitedCount: this._rateLimitedCount,
      rateLimitedPeers: [...this._rateLimitedPeers],
      storeRateMax: this._storeRateMax,
      storeRateWindow: this._storeRateWindow
    }
  }

  /** 收到 LCAN_ACK：唤醒等待中的 lcanStore */
  _onLcanAck(msg) {
    const { reqId, stored } = msg.payload || {}
    if (!reqId) return
    const state = this._pendingStores.get(reqId)
    if (!state) return
    state.ackCount++
    // 记录持有者
    if (stored) addHolder(state.keyHex, msg.from)
    // 任一 ACK（无论 stored true/false）即视为送达；
    // stored=true 优先成功，stored=false 至少知道对端在线
    if (state.ackCount >= 1) {
      clearTimeout(state.timer)
      this._pendingStores.delete(reqId)
      state.resolve({ ok: true, acks: state.ackCount, keyHex: state.keyHex })
    }
  }

  /**
   * 饱和读取：同时向全部已知副本持有者（责任集 + holder 表）发 GET，
   * 第一个 FOUND 返回即成功；全失败/超时 → reject('not_found')。
   * @param {string} namespace
   * @param {string} objectId
   * @returns {Promise<{payload:*, keyHex:string, from:string}>}
   */
  async lcanGet(namespace, objectId) {
    const keyHex = this._lcanKeyHex(namespace, objectId)
    // 先查本地
    const local = await lcanGet(keyHex)
    if (local) {
      return { payload: local.payload, keyHex, from: this.identity.peerId }
    }
    // 候选 = 责任集 ∪ holder 表（去重，排除自己）
    const resp = this._responsiblePeers(keyHex).map((r) => r.peerId)
    const holders = getHolders(keyHex)
    const candidates = [...new Set([...resp, ...holders])].filter(
      (p) => p !== this.identity.peerId
    )
    if (candidates.length === 0) {
      throw new Error('not_found')
    }
    const reqId = keyHex + ':get:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    return new Promise((resolve, reject) => {
      const state = {
        resolve,
        reject,
        found: false,
        notFound: 0,
        targetCount: candidates.length,
        timer: null,
        keyHex
      }
      this._pendingGets.set(reqId, state)
      state.timer = setTimeout(() => {
        if (this._pendingGets.has(reqId)) {
          this._pendingGets.delete(reqId)
          reject(new Error('not_found'))
        }
      }, this._lcanGetTimeout)
      // 饱和请求：同时发给全部候选
      for (const peerId of candidates) {
        const ck = this._connKeyForPeerId(peerId)
        if (!ck) {
          // 该候选无连接，计为未命中
          state.notFound++
          continue
        }
        this._sendRaw(ck, {
          type: MsgType.LCAN_GET,
          payload: { keyHex, reqId }
        }).catch(() => {
          state.notFound++
          this._checkLcanGetComplete(reqId)
        })
      }
      // 如果全部候选都无连接，立即失败
      this._checkLcanGetComplete(reqId)
    })
  }

  /** 检查饱和 GET 是否全部 NOT_FOUND（提前 reject） */
  _checkLcanGetComplete(reqId) {
    const state = this._pendingGets.get(reqId)
    if (!state || state.found) return
    if (state.notFound >= state.targetCount) {
      clearTimeout(state.timer)
      this._pendingGets.delete(reqId)
      state.reject(new Error('not_found'))
    }
  }

  /** 收到 LCAN_GET：查本地，命中回 FOUND，未命中回 NOT_FOUND */
  async _onLcanGet(connKey, msg) {
    const { keyHex, reqId } = msg.payload || {}
    if (!keyHex || !reqId) return
    const rec = await lcanGet(keyHex)
    if (rec) {
      await this._sendRaw(connKey, {
        type: MsgType.LCAN_FOUND,
        payload: { keyHex, reqId, payload: rec.payload }
      })
    } else {
      await this._sendRaw(connKey, {
        type: MsgType.LCAN_NOT_FOUND,
        payload: { keyHex, reqId }
      })
    }
  }

  /** 收到 LCAN_FOUND：唤醒等待中的 lcanGet（先到先用） */
  _onLcanFound(msg) {
    const { reqId, payload } = msg.payload || {}
    if (!reqId) return
    const state = this._pendingGets.get(reqId)
    if (!state || state.found) return
    state.found = true
    clearTimeout(state.timer)
    this._pendingGets.delete(reqId)
    // 记录持有者（下载成功 → 该节点有副本）
    addHolder(state.keyHex, msg.from)
    state.resolve({ payload, keyHex: state.keyHex, from: msg.from })
  }

  /** 收到 LCAN_NOT_FOUND：累计，全部未命中则 reject */
  _onLcanNotFound(msg) {
    const { reqId } = msg.payload || {}
    if (!reqId) return
    const state = this._pendingGets.get(reqId)
    if (!state || state.found) return
    state.notFound++
    this._checkLcanGetComplete(reqId)
  }

  /** 收到 LCAN_HOLDERS：合并对端的 holder 表到本地（副本索引交换） */
  _onLcanHolders(msg) {
    const entries = msg.payload?.entries
    if (!entries || typeof entries !== 'object') return
    for (const [key, peers] of Object.entries(entries)) {
      if (!Array.isArray(peers)) continue
      for (const p of peers) addHolder(key, p)
    }
  }

  /** 广播本地的 holder 表给对端（心跳/定期同步副本索引） */
  async _broadcastHolders() {
    const all = getAllHolders()
    // 只发有意义的条目（避免空广播）
    const entries = {}
    let n = 0
    for (const [key, peers] of Object.entries(all)) {
      if (peers && peers.length) {
        entries[key] = peers
        n++
      }
      if (n >= 200) break // 单次最多 200 条，避免消息过大
    }
    if (n === 0) return
    await this._broadcast({
      type: MsgType.LCAN_HOLDERS,
      payload: { entries }
    })
  }

  /** 启动 LCAN 定时器（TTL 清扫 + 副本自愈 + holder 同步） */
  _startLcanTimers() {
    if (this._lcanCleanTimer) return
    // 60s 清扫过期 + 自愈检查 + holder 同步
    this._lcanCleanTimer = setInterval(() => {
      this._lcanMaintenance().catch(() => {})
    }, 60 * 1000)
  }

  _stopLcanTimers() {
    if (this._lcanCleanTimer) {
      clearInterval(this._lcanCleanTimer)
      this._lcanCleanTimer = null
    }
    // 清理待处理请求
    for (const [, s] of this._pendingStores) {
      clearTimeout(s.timer)
      s.resolve({ ok: false, acks: s.ackCount, keyHex: s.keyHex })
    }
    this._pendingStores.clear()
    for (const [, g] of this._pendingGets) {
      clearTimeout(g.timer)
      g.reject(new Error('shutdown'))
    }
    this._pendingGets.clear()
  }

  /** LCAN 维护：TTL 清扫 + 副本自愈 + holder 同步（60s 周期） */
  async _lcanMaintenance() {
    // 1. 清扫过期条目
    const removed = await lcanCleanExpired()
    if (removed > 0) dbg('lcan:clean expired', removed)
    // 2. 副本自愈：检查 holder 表，副本数 <2 且本地有数据则补齐
    await this._lcanSelfHeal()
    // 3. 同步 holder 表
    await this._broadcastHolders()
  }

  /**
   * 副本自愈：遍历 holder 表，对副本数 <2 的 key，
   * 若本地持有则重新饱和 STORE 到当前责任集补齐副本。
   * 每轮最多补齐 20 个 key（避免单次维护耗时过长）。
   */
  async _lcanSelfHeal() {
    const all = getAllHolders()
    const self = this.identity.peerId
    let healed = 0
    for (const [keyHex, peers] of Object.entries(all)) {
      if (healed >= 20) break
      // 只处理我们持有的 key（我们才能提供数据补齐）
      if (!peers || !peers.includes(self)) continue
      // 在线持有者数（排除已下线的）
      const onlineHolders = peers.filter((p) =>
        p === self ? true : this._hasConnectionForPeerId(p)
      )
      if (onlineHolders.length >= 2) continue // 副本充足
      // 副本不足：从本地取数据，重新饱和存储补齐
      const rec = await lcanGet(keyHex)
      if (!rec) {
        // 本地也没有了（可能已过期）→ 从 holder 表移除自己
        removeHolder(keyHex, self)
        continue
      }
      // 重新 STORE（会发给当前责任集，补齐副本）
      dbg('lcan:self-heal', keyHex, 'holders=', onlineHolders.length)
      await this._lcanReStore(keyHex, rec)
      healed++
    }
    if (healed > 0) dbg('lcan:self-heal done', healed, 'keys re-published')
  }

  /**
   * 重新饱和存储一条已有数据（自愈用，不发给自己，只补齐远端副本）。
   * @param {string} keyHex
   * @param {{payload, expires, author}} rec  本地 LCAN 记录
   */
  async _lcanReStore(keyHex, rec) {
    const resp = this._responsiblePeers(keyHex).filter(
      (r) => r.peerId !== this.identity.peerId
    )
    if (resp.length === 0) return
    // 计算剩余 TTL
    const ttl = rec.expires > 0 ? Math.max(0, rec.expires - Date.now()) : 0
    for (const r of resp) {
      const ck = this._connKeyForPeerId(r.peerId)
      if (!ck) continue
      this._sendRaw(ck, {
        type: MsgType.LCAN_STORE,
        payload: { keyHex, reqId: keyHex + ':heal:' + Date.now().toString(36), ttl, payload: rec.payload },
        extensions: { lcan: true }
      }).catch(() => {})
    }
  }

  // ---------------- 事件工具 ----------------
  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  // ---------------- 双通道调试 / 验收工具 ----------------
  /**
   * 【验收用】向指定 peerId 发送一个 ~1MB 的 ArrayBuffer 走 bin 通道。
   * 用于 Phase 1.4 验收："双浏览器互发 1MB 对象走 bin，控制台无 Message too big"。
   * 在浏览器控制台执行：await window.__nchat.network.binTestSend('<peerId>')
   * @param {string} peerId
   * @returns {Promise<{ok:boolean, bytes:number, ms:number}>}
   */
  async binTestSend(peerId) {
    const connKey = this._connKeyForPeerId(peerId)
    if (!connKey) return { ok: false, bytes: 0, ms: 0, error: 'no connection' }
    const bytes = 1024 * 1024 // 1MB
    const buf = new ArrayBuffer(bytes)
    const t0 = performance.now()
    const ok = await this._sendBinary(connKey, {
      kind: BinKind.LCAN_BLOB,
      testTag: 'bin-1mb-probe',
      buf
    })
    const ms = Math.round(performance.now() - t0)
    dbg('bin:test send', ok ? 'ok' : 'fail', bytes, 'bytes in', ms, 'ms')
    return { ok, bytes, ms }
  }
}
