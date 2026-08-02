/**
 * 全局聊天状态管理（单例 composable）。
 *
 * 桥接 PeerNetwork 的事件与 Vue 响应式状态：
 *  - identity / peerJsId / online / ownName
 *  - peers:       已连接节点列表
 *  - rooms:       已发现房间列表（按活跃度排序）
 *  - currentRoom: 当前所在房间
 *  - messages:    当前房间的消息列表
 *  - members:     当前房间的成员列表
 *  - status:      启动状态与错误
 *  - pendingRequests: 当前房间的待处理加入申请
 *  - storageStats: 本地存储用量统计
 */
import { reactive, ref, shallowRef, readonly, computed } from 'vue'
import { loadOrCreateIdentity } from '../lib/crypto.js'
import { PeerNetwork } from '../lib/peer.js'
import { AccessRule, SpeakRule, NodeRole, DEFAULT_CAPABILITIES, MsgType } from '../lib/protocol.js'
import {
  addMessage,
  hasMessage,
  getMessages,
  updateMessage,
  getMeta,
  setMeta,
  getAllRooms,
  searchRooms as searchRoomsInDB,
  searchMessages as searchMessagesInDB,
  clearRoomData,
  getStorageStats
} from '../lib/db.js'
import {
  getAllSignalingServers,
  getSignaling,
  setActiveSignalingServer,
  addSignalingServer,
  removeSignalingServer,
  resetSignaling,
  getDiagnostics
} from '../config.js'

const state = reactive({
  booting: true,
  error: null,
  online: false,
  peerId: '',
  peerJsId: '',
  ownName: '',
  activeServer: null,
  // 开发测试用：媒体通话状态
  incomingCall: null
})

// MediaStream 不应放入 reactive（Vue 会 proxy 包装导致 srcObject 问题），
// 使用 shallowRef 保持原始对象引用
const remoteStream = shallowRef(null)

const peers = ref([]) // [{ peerJsId, peerId, name, status }]
const rooms = ref([]) // [{ name, memberCount, activity, lastUpdate }]
const currentRoom = ref('')
const messages = ref([]) // 当前房间消息
const members = ref([]) // 当前房间成员 [{ peerId, name, status }]
const stats = ref({ sent: 0, received: 0 })
const searchKeyword = ref('') // 当前搜索关键词，空则显示全部
const pendingRequests = ref([]) // 当前房间待处理加入申请
const storageStats = ref({ rooms: 0, messages: 0, sizeBytes: 0 })
const notifications = ref([]) // 通知列表 [{ id, type, text, timestamp }]
const downloadingIds = ref(new Set()) // 正在下载中的 fileId（UI 状态用）
const fileProgress = ref(new Map()) // fileId -> { received, total, pct }（Phase 2.1 进度条）
// 本节点能力声明（异构网络角色）+ 已连接节点的角色统计
const capabilities = ref({ ...DEFAULT_CAPABILITIES })
const roleStats = ref({ full: 0, normal: 0, light: 0, unknown: 0, relay: 0, alwaysOn: 0 })
// 多域并行状态（蛛网核心：每域独立 status/peerJsId/reconnectAttempts）
const domains = ref([])
// Phase 2.2: 群公告（room -> { text, from, name, timestamp }）
const announcements = ref(new Map())
// Phase 2.3: Pin 置顶（room -> [msgId...]）
const pins = ref(new Map())

// ---- 消息星标（本地收藏，按房间持久化到 localStorage） ----
const starredByRoom = ref(loadStarred())
function loadStarred() {
  try {
    return JSON.parse(localStorage.getItem('nchat:stars') || '{}')
  } catch {
    return {}
  }
}
function saveStarred() {
  try {
    localStorage.setItem('nchat:stars', JSON.stringify(starredByRoom.value))
  } catch {
    /* 存储满/隐私模式忽略 */
  }
}

// ---- 房间收藏（手动收藏，持久化到 localStorage 'nchat:favorites'） ----
const favoriteRooms = ref(loadFavorites())
function loadFavorites() {
  try {
    const raw = localStorage.getItem('nchat:favorites')
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
function saveFavorites() {
  try {
    localStorage.setItem('nchat:favorites', JSON.stringify(favoriteRooms.value))
  } catch {
    /* ignore */
  }
}
function toggleFavorite(room) {
  if (!room) return
  const idx = favoriteRooms.value.indexOf(room)
  if (idx >= 0) favoriteRooms.value.splice(idx, 1)
  else favoriteRooms.value.push(room)
  saveFavorites()
}
function isFavorite(room) {
  return favoriteRooms.value.includes(room)
}
/** 当前房间已标记消息 id 列表 */
function currentRoomStarred() {
  const room = currentRoom.value
  if (!room) return []
  return starredByRoom.value[room] || []
}
/** 切换消息星标（仅本地收藏，不广播） */
function toggleStar(msgId) {
  const room = currentRoom.value
  if (!room || !msgId) return false
  const next = { ...starredByRoom.value }
  const list = next[room] || []
  next[room] = list.includes(msgId) ? list.filter((x) => x !== msgId) : [...list, msgId]
  starredByRoom.value = next
  saveStarred()
  return true
}
// Phase 2.4: 云文档（room -> [doc...]）
const docs = ref(new Map())
// Phase 2.4: 文档冲突提示（docId -> { local, remote }）
const docConflicts = ref(new Map())
// Phase 2.5: 消息搜索
const messageSearchResults = ref([]) // 搜索结果列表
const searchingMessages = ref(false) // 正在搜索中
let currentSearchId = null // 当前网络搜索 ID（用于匹配异步回复）
let searchResultTimer = null // 网络搜索聚合超时计时器

let network = null
let initialized = false
const roomMessageIndex = new Map() // room -> Set(msgId) 去重内存索引

async function init() {
  if (initialized) return
  initialized = true

  try {
    const identity = await loadOrCreateIdentity()
    state.peerId = identity.peerId

    // 读取昵称与本地已缓存房间
    // 未改过名时：首次生成随机名并立即持久化，之后刷新复用同一名字（不再每次随机）
    let savedName = await getMeta('ownName', '')
    if (!savedName) {
      savedName = randomDefaultName()
      try {
        await setMeta('ownName', savedName)
      } catch (e) {
        /* ignore */
      }
    }
    state.ownName = savedName
    await loadCachedRooms()
    await refreshStorageStats()

    network = new PeerNetwork(identity, state.ownName)
    // 初始化本节点能力声明（从 localStorage 读取，同步到响应式状态）
    capabilities.value = network.getCapabilities()
    // 初始化多域状态（启动前先空数组，start 后 domains:update 事件会持续刷新）
    domains.value = network.getDomains().map((d) => ({ ...d }))
    wireEvents(network)

    // dev 调试钩子（仅 DEV，生产构建不含）
    if (import.meta.env.DEV) {
      window.__nchat = {
        network, state, peers, rooms, messages,
        currentRoom, docs, docConflicts,
        joinedNames, joinedRooms,
        createRoom, joinRoom, searchRooms, switchToRoom, setOwnName,
    createDoc, updateDoc, renameDoc, deleteDocRemote,
    resolveDocConflictAcceptRemote, resolveDocConflictKeepLocal,
    currentRoomDocs,
    editMessage, recallMessage, reactToMessage,
    getMessageById: (id) => messages.value.find((m) => m.id === id) || null
  }
    }

    await network.start()
    state.online = true
    state.activeServer = network.getActiveServer()
    state.error = null
    // 恢复已加入的房间（joinedNames 已从 localStorage 恢复，刷新列表）
    refreshJoinedRooms()
  } catch (e) {
    console.error('[nchat] 启动失败：', e)
    state.error = describeError(e)
    // 信令连不上也允许使用本地缓存
  } finally {
    state.booting = false
  }
}

function randomDefaultName() {
  const adjectives = ['快速', '安静', '远方', '霓虹', '极地', '深海', '星轨', '晨雾']
  const nouns = ['旅人', '观察者', '节点', '信使', '航行者', '回声']
  const a = adjectives[Math.floor(Math.random() * adjectives.length)]
  const n = nouns[Math.floor(Math.random() * nouns.length)]
  return a + n
}

function describeError(e) {
  const t = e?.type
  if (t === 'unavailable-id') return 'PeerID 已被占用（同一身份已在别处上线）'
  if (t === 'network' || t === 'server-error') return '无法连接信令服务器'
  if (t === 'browser-incompatible') return '当前浏览器不支持 WebRTC'
  if (t === 'disconnected') return '与信令服务器断开，正在重连…'
  if (t === 'timeout') return '信令服务器连接超时，请检查网络或在设置中切换服务器'
  return e?.message || '未知错误'
}

function pushNotification(type, text) {
  const id = Date.now() + '-' + Math.random().toString(36).slice(2, 6)
  notifications.value.push({ id, type, text, timestamp: Date.now() })
  // 5 秒后自动移除
  setTimeout(() => {
    const idx = notifications.value.findIndex((n) => n.id === id)
    if (idx >= 0) notifications.value.splice(idx, 1)
  }, 5000)

  // Phase 3.5: 浏览器通知（需授权且用户开启）
  try {
    if (notificationsEnabled.value && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('nchat', { body: text, tag: id })
    }
  } catch (e) {
    /* ignore */
  }
}

// Phase 3.5: 浏览器通知开关（默认开启，持久化到 localStorage）
function setNotificationsEnabled(next) {
  notificationsEnabled.value = !!next
  try {
    localStorage.setItem('nchat:notifications:enabled', String(!!next))
  } catch (e) {
    /* ignore */
  }
  // 关闭时不再需要权限；开启时尝试请求权限
  if (next && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

function dismissNotification(id) {
  const idx = notifications.value.findIndex((n) => n.id === id)
  if (idx >= 0) notifications.value.splice(idx, 1)
}

// Phase 3.2-3.4: 最小内存状态（后续再持久化）
const mentions = ref(new Map()) // room -> Set<msgId>
const readReceipts = ref(new Map()) // room -> Map<msgId, Set<peerId>>
const threads = ref(new Map()) // rootMsgId -> { room, replies: [] }
const dmSessions = ref(new Map()) // peerId -> { pubKey, messages: [] }
function addMention(room, msgId) {
  const set = mentions.value.get(room) || new Set()
  set.add(msgId)
  mentions.value.set(room, set)
}
function addReadReceipt(room, msgId, from) {
  const map = readReceipts.value.get(room) || new Map()
  const set = map.get(msgId) || new Set()
  set.add(from)
  map.set(msgId, set)
  readReceipts.value.set(room, map)
}
function addThreadReply(rootMsgId, reply) {
  const thread = threads.value.get(rootMsgId) || { room: reply.room, replies: [] }
  thread.replies.push(reply)
  threads.value.set(rootMsgId, thread)
}
function addDmMessage(peerId, msg) {
  const session = dmSessions.value.get(peerId) || { pubKey: null, messages: [] }
  session.messages.push(msg)
  dmSessions.value.set(peerId, session)
}

function wireEvents(net) {
  net.addEventListener('identity', (e) => {
    state.peerJsId = e.detail.peerJsId
  })

  net.addEventListener('status', (e) => {
    state.online = !!e.detail.online
    if (state.online) {
      state.error = null
      if (e.detail.server) state.activeServer = e.detail.server
    }
  })

  net.addEventListener('error', (e) => {
    if (e.detail.type === 'speak_denied' || e.detail.type === 'join_failed') {
      state.error = e.detail.message
      setTimeout(() => {
        if (state.error === e.detail.message) state.error = null
      }, 3000)
    } else if (!state.online) {
      state.error = describeError(e.detail)
    }
  })

  // 加入被拒（密码错误等）
  net.addEventListener('join:rejected', (e) => {
    const { room, reason } = e.detail
    pushNotification('error', `加入「${room}」被拒：${reason || '未知原因'}`)
  })

  // 加入申请已提交
  net.addEventListener('join:requested', (e) => {
    pushNotification('info', `加入申请已提交，等待房间管理员审核…`)
  })

  // 加入被批准
  net.addEventListener('join:approved', (e) => {
    pushNotification('success', `已加入「${e.detail.room}」`)
  })

  // 收到加入申请（我们是审核方）
  net.addEventListener('join:request', (e) => {
    const { room, name } = e.detail
    pushNotification('info', `${name} 申请加入「${room}」`)
    if (room === currentRoom.value) refreshPendingRequests()
  })

  net.addEventListener('join:request:update', () => {
    if (currentRoom.value) refreshPendingRequests()
  })

  // 收到邀请
  net.addEventListener('invite', (e) => {
    const { room, name } = e.detail
    pushNotification('info', `${name} 邀请你加入「${room}」`)
  })

  // 节点连接
  net.addEventListener('peer:connected', (e) => {
    const { peerJsId, peerId, name } = e.detail
    upsertPeer(peerJsId, { peerId, name, status: 'online' })
    if (currentRoom.value) refreshMembers()
    if (network) roleStats.value = network.getRoleStats()
  })

  net.addEventListener('peer:disconnected', (e) => {
    const { peerJsId, peerId } = e.detail
    const idx = peers.value.findIndex((p) => p.peerJsId === peerJsId)
    if (idx >= 0) peers.value.splice(idx, 1)
    if (peerId && currentRoom.value) refreshMembers()
    if (network) roleStats.value = network.getRoleStats()
  })

  // 音视频通话事件
  net.addEventListener('media:call', (e) => {
    const { from } = e.detail
    pushNotification('info', `收到音视频通话请求`)
    state.incomingCall = { from, timestamp: Date.now() }
  })

  net.addEventListener('media:stream', (e) => {
    state.incomingCall = null
    remoteStream.value = e.detail.stream
  })

  net.addEventListener('media:close', (e) => {
    remoteStream.value = null
  })

  net.addEventListener('peer:status', (e) => {
    const { peerJsId, status } = e.detail
    upsertPeer(peerJsId, { status })
  })

  // 对端能力声明变更 → 角色统计刷新
  net.addEventListener('peer:capabilities', () => {
    if (network) roleStats.value = network.getRoleStats()
  })

  // 本节点能力声明变更（设置面板触发） → 同步响应式状态
  net.addEventListener('capabilities:update', (e) => {
    capabilities.value = { ...e.detail.capabilities }
    if (network) roleStats.value = network.getRoleStats()
  })

  // 多域状态变更 → 同步 domains 响应式数组（UI 拓扑/域状态展示用）
  net.addEventListener('domains:update', (e) => {
    const list = e.detail?.domains || (network ? network.getDomains() : [])
    domains.value = list.map((d) => ({ ...d }))
  })

  // 房间列表：以各节点广播的活跃房间为准（覆盖/新增），
  // 本地已加入或已保存的房间保留（广播可能未覆盖；保存的房间无人也可再加入），
  // 其余（含已销毁且未保存的空房间缓存）移除
  net.addEventListener('rooms', (e) => {
    const incoming = e.detail || []
    const localJoined = new Set(network ? network.localRooms() : [])
    const localSaved = new Set(getSavedRoomNames())
    const incomingMap = new Map(incoming.map((r) => [r.name, r]))
    const next = new Map()
    // 保留：incoming 未覆盖但本地已加入或已保存的房间
    for (const r of rooms.value) {
      if (incomingMap.has(r.name)) continue
      if (localJoined.has(r.name) || localSaved.has(r.name)) next.set(r.name, r)
    }
    // 合并 incoming（覆盖旧值，别名取并集）
    for (const r of incoming) {
      const old = next.get(r.name)
      if (old) {
        const allAliases = new Set([...(r.aliases || []), ...(old.aliases || [])])
        next.set(r.name, { ...old, ...r, aliases: [...allAliases] })
      } else {
        next.set(r.name, r)
      }
    }
    rooms.value = [...next.values()]
    refreshJoinedRooms()
  })

  // 本地保存的房间名（加入/创建过且未退出）
  function getSavedRoomNames() {
    try {
      const raw = localStorage.getItem('nchat:rooms')
      if (!raw) return new Set()
      const list = JSON.parse(raw)
      return new Set(Array.isArray(list) ? list.map((r) => r && r.name).filter(Boolean) : [])
    } catch {
      return new Set()
    }
  }

  // 房间销毁（无成员）：从列表移除，避免残留空房间
  net.addEventListener('room:removed', (e) => {
    const room = e.detail?.room
    if (!room) return
    rooms.value = rooms.value.filter((r) => r.name !== room)
  })

  // 聊天消息
  net.addEventListener('chat', async (chatMsg) => {
    await handleChatMessage(chatMsg.detail)
  })
  net.addEventListener('file:unavailable', (e) => {
    const fileId = e.detail?.fileId
    if (!fileId) return
    pendingDownloads.delete(fileId)
    // 标记对应消息的 file 为下载失败（ChatPanel 检测后立即显示失败提示，无需等 12s 超时）
    const m = messages.value.find((x) => x.file?.fileId === fileId)
    if (m && m.file && !m.file.dataUrl && !m.file.blobUrl) {
      m.file.downloadFailed = true
    }
    // 清理进度条
    const fp = new Map(fileProgress.value)
    fp.delete(fileId)
    fileProgress.value = fp
    pushNotification('error', '文件不可用：发送者刷新页面后原文件缓存已丢失，请对方重新发送')
  })

  // 文件分片下载进度（Phase 2.1 bin 通道）
  net.addEventListener('file:progress', (e) => {
    const { fileId, received, total } = e.detail || {}
    if (!fileId || !total) return
    const fp = new Map(fileProgress.value)
    fp.set(fileId, { received, total, pct: Math.round((received / total) * 100) })
    fileProgress.value = fp
  })

  // Phase 2.2: 群公告
  net.addEventListener('announcement', (e) => {
    const ann = e.detail
    if (!ann || !ann.room) return
    const next = new Map(announcements.value)
    next.set(ann.room, ann)
    announcements.value = next
  })

  // Phase 2.3: Pin 置顶
  net.addEventListener('pin_update', (e) => {
    const pinData = e.detail
    if (!pinData || !pinData.room) return
    const next = new Map(pins.value)
    next.set(pinData.room, pinData.pins || [])
    pins.value = next
  })

  // Phase 2.4: 云文档更新
  net.addEventListener('doc_update', (e) => {
    const { room, doc } = e.detail || {}
    if (!room || !doc || !doc.docId) return
    const next = new Map(docs.value)
    const list = [...(next.get(room) || [])]
    const idx = list.findIndex((d) => d.docId === doc.docId)
    if (doc.deleted) {
      // 标记删除：从列表移除
      if (idx >= 0) list.splice(idx, 1)
    } else {
      if (idx >= 0) list[idx] = doc
      else list.push(doc)
    }
    // 按更新时间倒序
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    next.set(room, list)
    docs.value = next
  })

  // Phase 2.4: 文档版本冲突
  net.addEventListener('doc_conflict', (e) => {
    const { room, docId, local, remote } = e.detail || {}
    if (!docId) return
    const next = new Map(docConflicts.value)
    next.set(docId, { room, local, remote })
    docConflicts.value = next
    pushNotification('warning', `文档「${local?.title || '未命名'}」存在版本冲突，对方有更新版本`)
  })

  // Phase 3.1: 消息编辑 / 撤回 / 回应
  net.addEventListener('message:edit', (e) => {
    const { room, msgId, newText } = e.detail || {}
    applyEdit(room, msgId, newText)
  })
  net.addEventListener('message:delete', (e) => {
    const { room, msgId } = e.detail || {}
    applyDelete(room, msgId)
  })
  net.addEventListener('message:react', (e) => {
    const { room, msgId, emoji, action, from } = e.detail || {}
    applyReact(room, msgId, emoji, action, from || (network && network.identity.peerId))
  })

  // Phase 3.2: @提及 + 已读回执
  net.addEventListener('mention', (e) => {
    const { room, msgId } = e.detail || {}
    if (!room || !msgId) return
    addMention(room, msgId)
    pushNotification('info', `有人在「${room}」提到了你`)
  })
  net.addEventListener('read_receipt', (e) => {
    const { room, msgIds, from } = e.detail || {}
    if (!room || !Array.isArray(msgIds)) return
    for (const msgId of msgIds) {
      addReadReceipt(room, msgId, from)
    }
  })

  // Phase 3.3: 话题
  net.addEventListener('thread:create', (e) => {
    const { rootMsgId } = e.detail || {}
    if (!rootMsgId) return
  })
  net.addEventListener('thread:reply', (e) => {
    const { rootMsgId, text, from } = e.detail || {}
    if (!rootMsgId || !text) return
    addThreadReply(rootMsgId, {
      rootMsgId,
      text,
      from,
      timestamp: Date.now()
    })
  })

  // Phase 3.4: 私聊 E2E
  net.addEventListener('dm:create', (e) => {
    const { from, pubKey } = e.detail || {}
    if (!from || !pubKey) return
    const session = dmSessions.value.get(from) || { pubKey, messages: [] }
    session.pubKey = pubKey
    dmSessions.value.set(from, session)
  })
  net.addEventListener('dm:message', (e) => {
    const { from, text, timestamp } = e.detail || {}
    if (!from || !text) return
    addDmMessage(from, {
      from,
      text,
      timestamp: timestamp || Date.now(),
      direction: 'in'
    })
    pushNotification('info', `私聊消息：${text.slice(0, 50)}`)
  })
  net.addEventListener('dm:key', (e) => {
    const { from, pubKey } = e.detail || {}
    if (!from || !pubKey) return
    const session = dmSessions.value.get(from) || { pubKey, messages: [] }
    session.pubKey = pubKey
    dmSessions.value.set(from, session)
  })

  // Phase 2.5: 网络搜索结果聚合
  net.addEventListener('search_result', (e) => {
    const { searchId, results } = e.detail || {}
    if (!searchId || searchId !== currentSearchId) return // 非当前搜索，忽略
    if (!Array.isArray(results) || !results.length) return
    // 合并去重（按消息 id）
    const existing = new Map(messageSearchResults.value.map((r) => [r.id, r]))
    for (const r of results) {
      if (r && r.id && !existing.has(r.id)) {
        existing.set(r.id, { ...r, source: 'network' })
      }
    }
    // 按时间倒序
    const merged = [...existing.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    messageSearchResults.value = merged
  })

  // 历史消息
  net.addEventListener('history', async (e) => {
    const { room, messages: msgs } = e.detail
    if (!Array.isArray(msgs)) return
    for (const m of msgs) {
      await handleChatMessage(m, /* fromHistory */ true)
    }
    if (room === currentRoom.value) sortMessages()
  })

  // 成员变动
  net.addEventListener('member:update', () => {
    if (currentRoom.value) {
      refreshMembers()
      refreshPendingRequests()
    }
  })

  // 页面关闭前离开所有房间
  window.addEventListener('beforeunload', () => {
    if (network) {
      for (const room of network.localRooms()) {
        network._broadcast({ type: 'leave_room', payload: { room } })
      }
    }
  })
}

function upsertPeer(peerJsId, patch) {
  const arr = peers.value
  let p = arr.find((x) => x.peerJsId === peerJsId)
  if (!p) {
    p = { peerJsId, peerId: '', name: '', status: 'online' }
    arr.push(p)
  }
  Object.assign(p, patch)
  peers.value = [...arr]
}

async function handleChatMessage(chatMsg, fromHistory = false) {
  if (!chatMsg || !chatMsg.id) return

  // 大文件：下载完成后（带完整 blobUrl 或 dataUrl）替换已有的 meta 卡片消息（同一 fileId）
  if (chatMsg.file?.fileId) {
    const existing = messages.value.find(
      (m) => m.file?.fileId === chatMsg.file.fileId && !m.file?.dataUrl && !m.file?.blobUrl
    )
    if (existing && (chatMsg.file.blobUrl || chatMsg.file.dataUrl)) {
      Object.assign(existing, chatMsg)
      pendingDownloads.delete(chatMsg.file.fileId)
      // 主动清理下载中标记，避免 watch 时序导致 timeout 误判失败
      const next = new Set(downloadingIds.value)
      next.delete(chatMsg.file.fileId)
      downloadingIds.value = next
      // 清理进度条
      const fp = new Map(fileProgress.value)
      fp.delete(chatMsg.file.fileId)
      fileProgress.value = fp
      return
    }
  }

  // 去重
  const set = roomMessageIndex.get(chatMsg.room) || new Set()
  if (set.has(chatMsg.id)) return
  set.add(chatMsg.id)
  roomMessageIndex.set(chatMsg.room, set)

  // Phase 3.1: 回填早到的 EDIT/DELETE/REACT 补丁（必须在持久化前，否则库里存的是旧副本）
  drainPendingPatch(chatMsg)

  // 持久化
  try {
    if (!(await hasMessage(chatMsg.id))) {
      await addMessage(chatMsg)
    }
  } catch (e) {
    /* ignore */
  }

  if (chatMsg.room === currentRoom.value) {
    messages.value.push(chatMsg)
    if (!fromHistory) sortMessages()
    stats.value.received++
  }
}

function sortMessages() {
  messages.value.sort((a, b) => a.timestamp - b.timestamp)
}

function refreshMembers() {
  const room = currentRoom.value
  if (!room || !network) {
    members.value = []
    return
  }
  // 获取房间 owner
  const known = network.knownRooms.get(room)
  const meta = network._localRoomMeta?.get(room)
  const ownerPeerId = meta?.owner || known?.owner
  const selfIsOwner = ownerPeerId === state.peerId
  const rules = meta?.rules || known?.rules
  const threshold = rules?.approveThreshold ?? 50
  const myStars = network._getMyStars(room)
  const canApprove = selfIsOwner || myStars >= threshold

  const list = []
  // 自己
  list.push({
    peerId: state.peerId,
    name: state.ownName + '（我）',
    status: 'online',
    self: true,
    isOwner: selfIsOwner,
    stars: myStars,
    canApprove
  })
  // 从 network.knownRooms 提取房间成员
  if (known) {
    for (const [peerId, info] of known.members) {
      if (peerId === state.peerId) continue
      const peerEntry = peers.value.find((p) => p.peerId === peerId)
      list.push({
        peerId,
        name: info.name || (peerEntry?.name || ''),
        status: peerEntry?.status || 'online',
        isOwner: peerId === ownerPeerId,
        stars: info.stars || 1,
        canApprove: peerId === ownerPeerId || (info.stars || 0) >= threshold
      })
    }
  }
  members.value = list
}

function refreshPendingRequests() {
  const room = currentRoom.value
  if (!room || !network) {
    pendingRequests.value = []
    return
  }
  pendingRequests.value = network.getPendingJoinRequests(room)
}

/** 当前用户是否是当前房间的 owner */
function isCurrentUserOwner() {
  const room = currentRoom.value
  if (!room || !network) return false
  const known = network.knownRooms.get(room)
  const meta = network._localRoomMeta?.get(room)
  const ownerPeerId = meta?.owner || known?.owner
  return ownerPeerId === state.peerId
}

/** 当前用户是否有审核/邀请权限 */
function canUserApprove() {
  const room = currentRoom.value
  if (!room || !network) return false
  const known = network.knownRooms.get(room)
  const meta = network._localRoomMeta?.get(room)
  const ownerPeerId = meta?.owner || known?.owner
  if (ownerPeerId === state.peerId) return true
  const rules = meta?.rules || known?.rules
  const threshold = rules?.approveThreshold ?? 50
  return network._getMyStars(room) >= threshold
}

function canSetAnnouncement() {
  const room = currentRoom.value
  if (!room || !network) return false
  if (isCurrentUserOwner()) return true
  return network._getMyStars(room) >= 50
}

/** Phase 2.2: 设置房间公告 */
async function setAnnouncement(room, text) {
  if (!network) return false
  return network.setAnnouncement(room, text)
}

/** Phase 2.3: 切换消息置顶（加入房间即可操作） */
async function togglePin(msgId) {
  if (!network || !currentRoom.value) return false
  return network.togglePin(currentRoom.value, msgId)
}

/** Phase 2.3: 判断消息是否已置顶 */
function isPinned(msgId) {
  const room = currentRoom.value
  if (!room) return false
  const list = pins.value.get(room) || []
  return list.includes(msgId)
}

/** Phase 2.3: 获取当前房间 Pin 列表 */
function currentRoomPins() {
  const room = currentRoom.value
  if (!room) return []
  return pins.value.get(room) || []
}

// ---- Phase 2.4: 云文档 ----

/** Phase 2.4: 获取当前房间文档列表 */
function currentRoomDocs() {
  const room = currentRoom.value
  if (!room) return []
  return docs.value.get(room) || []
}

/** Phase 2.4: 创建文档 */
async function createDoc(title) {
  if (!network || !currentRoom.value) return null
  return network.createDoc(currentRoom.value, title)
}

/** Phase 2.4: 更新文档内容（3s 防抖由调用方处理） */
async function updateDoc(docId, patch) {
  if (!network || !currentRoom.value) return null
  return network.updateDoc(currentRoom.value, docId, patch)
}

/** Phase 2.4: 重命名文档 */
async function renameDoc(docId, newTitle) {
  if (!network || !currentRoom.value) return null
  return network.renameDoc(currentRoom.value, docId, newTitle)
}

/** Phase 2.4: 删除文档 */
async function deleteDocRemote(docId) {
  if (!network || !currentRoom.value) return false
  return network.deleteDocRemote(currentRoom.value, docId)
}

/** Phase 2.4: 解决冲突——采用远端版本 */
function resolveDocConflictAcceptRemote(docId) {
  const next = new Map(docConflicts.value)
  next.delete(docId)
  docConflicts.value = next
}

/** Phase 2.4: 解决冲突——保留本地版本（强制推送） */
async function resolveDocConflictKeepLocal(docId) {
  const conflict = docConflicts.value.get(docId)
  if (!conflict?.local) return
  // 强制用本地版本重新发布（version+1）
  if (network && currentRoom.value) {
    await network.updateDoc(currentRoom.value, docId, {
      title: conflict.local.title,
      content: conflict.local.content
    })
  }
  const next = new Map(docConflicts.value)
  next.delete(docId)
  docConflicts.value = next
}

async function loadCachedRooms() {
  try {
    const cached = await getAllRooms()
    if (cached && cached.length) {
      rooms.value = cached.sort((a, b) => {
        if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount
        return (b.lastUpdate || 0) - (a.lastUpdate || 0)
      })
    }
  } catch (e) {
    /* ignore */
  }
}

async function refreshStorageStats() {
  try {
    storageStats.value = await getStorageStats()
  } catch (e) {
    /* ignore */
  }
}

// ---------------- 对外动作 ----------------
async function setOwnName(name) {
  state.ownName = name
  if (network) network.setOwnName(name)
  await setMeta('ownName', name)
}

/**
 * 创建房间（支持别名和高级规则）
 * @param {string} name  房间名
 * @param {object} options { aliases, access, speak, password, whitelist, approveThreshold }
 */
async function createRoom(name, options = {}) {
  if (!name || !network) return
  if (currentRoom.value && currentRoom.value !== name) {
    await network.leaveRoom(currentRoom.value)
  }
  await network.createRoom(name, options)
  currentRoom.value = name
  messages.value = []
  // 加载本地缓存的历史
  await loadLocalMessages(name)
  refreshMembers()
  refreshPendingRequests()
}

/**
 * 加入房间（自动处理 OPEN/PASSWORD/APPROVE/INVITE 四种准入）
 * @param {string} name     房间名
 * @param {string} password 密码（密码房间需要）
 * @returns {Promise<'joined'|'requested'|'denied'>}
 */
async function joinRoom(name, password) {
  if (!network) return 'denied'
  // 检查房间准入规则
  const known = network.knownRooms.get(name)
  const rules = known?.rules
  const access = rules?.access

  if (access === AccessRule.APPROVE) {
    // 审核制：发送申请
    const ok = await network.requestJoinRoom(name, password)
    return ok ? 'requested' : 'denied'
  }

  if (access === AccessRule.INVITE) {
    // 邀请制：无邀请无法加入
    pushNotification('error', '该房间为邀请制，需收到邀请才能加入')
    return 'denied'
  }

  // OPEN / PASSWORD：直接加入
  if (currentRoom.value && currentRoom.value !== name) {
    await network.leaveRoom(currentRoom.value)
  }
  currentRoom.value = name
  messages.value = []
  await loadLocalMessages(name)
  await network.joinRoom(name, password)
  // 立即把房间写入列表（不等广播），确保出现在「已加入」；
  // 即使已存在也替换引用，触发 joinedRooms computed 重算
  markJoined(name)
  const knownRoom = network.knownRooms.get(name)
  const existing = rooms.value.find((r) => r.name === name)
  if (existing) {
    existing.memberCount = knownRoom?.members?.size ?? existing.memberCount
    existing.lastUpdate = Date.now()
    rooms.value = [...rooms.value]
  } else {
    rooms.value = [
      {
        name,
        memberCount: knownRoom?.members?.size ?? 1,
        activity: knownRoom?.activity ?? 0,
        lastUpdate: Date.now(),
        aliases: knownRoom ? [...knownRoom.aliases] : [],
        rules: knownRoom?.rules || { access: 'open', speak: 'all' },
        owner: knownRoom?.owner || null,
      },
      ...rooms.value,
    ]
  }
  refreshMembers()
  refreshPendingRequests()
  refreshJoinedRooms()
  return 'joined'
}

async function loadLocalMessages(name) {
  try {
    const local = await getMessages(name, 0)
    // Phase 3.1: 从库加载时回填仍在缓冲中的编辑/撤回/回应补丁
    for (const m of local) {
      if (drainPendingPatch(m)) updateMessage(m.id, plain(m)).catch(() => {})
    }
    messages.value = local
    for (const m of local) {
      const set = roomMessageIndex.get(name) || new Set()
      set.add(m.id)
      roomMessageIndex.set(name, set)
    }
  } catch (e) {
    /* ignore */
  }
}

async function leaveCurrentRoom() {
  if (!network || !currentRoom.value) return
  await network.leaveRoom(currentRoom.value)
  markLeft(currentRoom.value)
  currentRoom.value = ''
  messages.value = []
  members.value = []
  pendingRequests.value = []
}

/** 退出指定房间（广播 leave + 移除已加入标记 + 若为当前房间清空视图）——清空数据复用退出逻辑 */
async function leaveRoomByName(room) {
  if (!network || !room) return
  await network.leaveRoom(room)
  markLeft(room)
  if (currentRoom.value === room) {
    currentRoom.value = ''
    messages.value = []
    members.value = []
    pendingRequests.value = []
  }
}

/** 仅退出当前房间视图（不清除成员身份/不广播 leave）——移动端返回房间列表用 */
function backToRoomList() {
  currentRoom.value = ''
  messages.value = []
  members.value = []
  pendingRequests.value = []
}

async function sendRoomMessage(text, replyTo) {
  if (!network || !currentRoom.value || !text.trim()) return
  const ok = await network.sendRoomMessage(currentRoom.value, text.trim(), replyTo)
  if (ok) stats.value.sent++
}

// ---- Phase 3.1: 消息编辑 / 撤回 / 回应 ----

/**
 * 未落地补丁缓冲：msgId -> patch。
 * P2P 下 EDIT/DELETE/REACT 可能先于消息本体到达（历史同步、乱序转发），
 * 此时目标消息还不在 messages/IndexedDB 中，补丁必须暂存，
 * 等消息到达（handleChatMessage / 切换房间加载）后再补上，否则会被静默丢弃。
 */
const pendingMsgPatches = new Map()

/** 剥离 Vue 响应式 Proxy，得到可写入 IndexedDB 的纯数据。 */
function plain(v) {
  try {
    return JSON.parse(JSON.stringify(v))
  } catch (e) {
    return v
  }
}

/** 记录补丁（与已有补丁合并），供消息稍后到达时回填。 */
function stashPatch(msgId, patch) {
  const prev = pendingMsgPatches.get(msgId) || {}
  pendingMsgPatches.set(msgId, { ...prev, ...patch })
}

/** 消息到达后回填暂存补丁。返回是否有补丁被应用。 */
function drainPendingPatch(msg) {
  if (!msg || !pendingMsgPatches.has(msg.id)) return false
  Object.assign(msg, pendingMsgPatches.get(msg.id))
  pendingMsgPatches.delete(msg.id)
  return true
}

/** 统一应用补丁：内存 + IndexedDB；消息不在本地时暂存。 */
function applyMsgPatch(msgId, patch) {
  const p = plain(patch)
  const m = messages.value.find((x) => x.id === msgId)
  if (m) {
    Object.assign(m, p)
    messages.value = [...messages.value]
  } else {
    stashPatch(msgId, p)
  }
  // 即使当前不在该房间（m 为空），也尝试写库：消息可能已持久化但未加载到内存
  updateMessage(msgId, p).then((written) => {
    if (!written) stashPatch(msgId, p)
  }).catch(() => stashPatch(msgId, p))
}

/** 本地应用编辑：替换文本 + 标记 edited，并持久化。 */
function applyEdit(room, msgId, newText) {
  applyMsgPatch(msgId, {
    text: newText,
    edited: true,
    editedAt: Date.now(),
    deleted: false // 编辑可恢复被撤回消息
  })
}

/** 本地应用撤回：标记 deleted。 */
function applyDelete(room, msgId) {
  applyMsgPatch(msgId, { deleted: true, deletedAt: Date.now() })
}

/** 本地应用表情回应：在消息底部聚合（add/remove），按 peerId 去重。 */
function applyReact(room, msgId, emoji, action, from) {
  if (!emoji || !from) return
  const m = messages.value.find((x) => x.id === msgId)
  // 基准取内存值，其次取暂存补丁，保证乱序到达时聚合不丢
  const base = m?.reactions || pendingMsgPatches.get(msgId)?.reactions || {}
  const reactions = plain(base) || {}
  const list = new Set(reactions[emoji] || [])
  if (action === 'remove') list.delete(from)
  else list.add(from)
  if (list.size) reactions[emoji] = [...list]
  else delete reactions[emoji]
  applyMsgPatch(msgId, { reactions })
}

/** 编辑自己发送的消息（UI 传入消息对象以取得原发送者/时间戳）。 */
async function editMessage(msg, newText) {
  if (!network || !currentRoom.value || !msg) return false
  const ok = await network.editMessage(
    currentRoom.value,
    msg.id,
    newText,
    msg.from,
    msg.timestamp
  )
  if (!ok) pushNotification('error', '编辑失败：只能编辑自己发送的消息')
  return ok
}

/** 撤回自己发送的消息（限 5 分钟内）。 */
async function recallMessage(msg) {
  if (!network || !currentRoom.value || !msg) return false
  const ok = await network.recallMessage(
    currentRoom.value,
    msg.id,
    msg.from,
    msg.timestamp
  )
  if (!ok) pushNotification('error', '撤回失败：只能撤回自己 5 分钟内发送的消息')
  return ok
}

/** 对消息添加/移除表情回应。 */
async function reactToMessage(msgId, emoji, action = 'add') {
  if (!network || !currentRoom.value || !msgId) return false
  const ok = await network.reactToMessage(currentRoom.value, msgId, emoji, action)
  if (!ok) pushNotification('error', '回应失败')
  return ok
}

async function sendFileMessage(file) {
  if (!network || !currentRoom.value || !file) return
  const ok = await network.sendFileMessage(currentRoom.value, file)
  if (ok) stats.value.sent++
}

/** 按需下载大文件完整内容（向发送者拉取，成功后自动替换 meta 卡片） */
const pendingDownloads = new Set() // 正在下载的 fileId
async function downloadFile(fileId, fromPeerId) {
  if (!network || !fileId) return false
  pendingDownloads.add(fileId)
  const ok = await network.requestFile(fileId, fromPeerId)
  if (!ok) pendingDownloads.delete(fileId)
  // 15s 超时未完成则放弃（发送者可能离线）
  setTimeout(() => pendingDownloads.delete(fileId), 15000)
  return ok
}

/** data URL → blob URL（同步转换；blob URL 可被新标签页打开/原生下载，不受 Chrome data URL 导航限制） */
function dataUrlToBlobUrl(dataUrl) {
  const [meta, b64] = String(dataUrl).split(',')
  const mime = (meta && meta.match(/data:(.*?)(;|$)/)?.[1]) || ''
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

/** 搜索房间：设置关键词过滤 + 查询网络节点和本地缓存 */
async function searchRooms(keyword) {
  searchKeyword.value = keyword || ''
  if (!keyword) return
  // 1. 本地搜索（含别名索引），合并到 rooms
  try {
    const localResults = await searchRoomsInDB(keyword)
    if (localResults && localResults.length) {
      const existing = new Set(rooms.value.map((r) => r.name))
      const merged = [...rooms.value]
      for (const r of localResults) {
        if (!existing.has(r.name)) {
          merged.push(r)
          existing.add(r.name)
        }
      }
      rooms.value = merged
    }
  } catch (e) {
    /* ignore */
  }
  // 2. 网络搜索（向其他节点广播查询，结果通过 rooms 事件回传）
  if (network) await network.queryRooms(keyword)
}

/** 清除搜索，显示全部房间 */
function clearSearch() {
  searchKeyword.value = ''
}

// ---------------- Phase 2.5: 消息搜索（本地 + 网络） ----------------

/**
 * 全局消息搜索：本地 IndexedDB 全文搜索 + 网络广播搜索（2s 聚合）。
 * @param {string} keyword  搜索关键词
 */
async function searchMessagesGlobal(keyword) {
  const kw = String(keyword || '').trim()
  if (!kw) {
    clearMessageSearch()
    return
  }
  searchingMessages.value = true
  // 清理上一次搜索的超时计时器
  if (searchResultTimer) {
    clearTimeout(searchResultTimer)
    searchResultTimer = null
  }
  // 1. 本地搜索（立即渲染）
  let localResults = []
  try {
    localResults = await searchMessagesInDB(kw, { limit: 50 })
  } catch (e) {
    localResults = []
  }
  const localMarked = localResults.map((r) => ({ ...r, source: 'local' }))
  messageSearchResults.value = localMarked
  // 2. 网络搜索（广播，2s 内聚合回复）
  if (network) {
    try {
      currentSearchId = await network.searchMessagesNetwork(kw)
    } catch (e) {
      currentSearchId = null
    }
  }
  // 3. 2s 超时：结束搜索状态（验收：空结果 2s 内返回）
  searchResultTimer = setTimeout(() => {
    searchingMessages.value = false
    searchResultTimer = null
  }, 2000)
}

/** 清除消息搜索结果 */
function clearMessageSearch() {
  messageSearchResults.value = []
  searchingMessages.value = false
  currentSearchId = null
  if (searchResultTimer) {
    clearTimeout(searchResultTimer)
    searchResultTimer = null
  }
}

/** 过滤后的房间列表（computed，响应式跟踪） */
const filteredRooms = computed(() => {
  const kw = searchKeyword.value
  if (!kw) return rooms.value
  const lower = kw.toLowerCase()
  return rooms.value.filter((r) => {
    if (r.name.toLowerCase().includes(lower)) return true
    if (Array.isArray(r.aliases)) {
      return r.aliases.some((a) => String(a).toLowerCase().includes(lower))
    }
    return false
  })
})

/** 已加入的房间列表（显式维护 joinedNames + 手动刷新，持久化到 localStorage 与收藏一致） */
const joinedNames = ref(loadJoinedNames())
function loadJoinedNames() {
  try {
    const raw = localStorage.getItem('nchat:joined')
    if (!raw) return new Set()
    const list = JSON.parse(raw)
    return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}
function saveJoinedNames() {
  try {
    localStorage.setItem('nchat:joined', JSON.stringify([...joinedNames.value]))
  } catch {
    /* ignore */
  }
}
const joinedRooms = ref([])
function refreshJoinedRooms() {
  if (!network) {
    joinedRooms.value = []
    return
  }
  const joined = joinedNames.value
  joinedRooms.value = rooms.value.filter((r) => joined.has(r.name))
}
function markJoined(name) {
  if (!name) return
  const next = new Set(joinedNames.value)
  next.add(name)
  joinedNames.value = next
  saveJoinedNames()
  refreshJoinedRooms()
}
function markLeft(name) {
  if (!name) return
  const next = new Set(joinedNames.value)
  next.delete(name)
  joinedNames.value = next
  saveJoinedNames()
  refreshJoinedRooms()
}

// ---------------- 房间管理（审核/邀请/星标/规则） ----------------
async function approveJoin(room, peerId) {
  if (!network) return false
  const ok = await network.approveJoin(room, peerId)
  refreshPendingRequests()
  return ok
}

async function rejectJoin(room, peerId, reason) {
  if (!network) return false
  const ok = await network.rejectJoin(room, peerId, reason)
  refreshPendingRequests()
  return ok
}

async function inviteMember(room, peerId) {
  if (!network) return false
  return await network.inviteMember(room, peerId)
}

async function setMemberStars(room, peerId, stars) {
  if (!network) return false
  return await network.setMemberStars(room, peerId, stars)
}

async function setRoomRules(room, rulesPatch) {
  if (!network) return false
  return await network.setRoomRules(room, rulesPatch)
}

// 个人屏蔽规则：屏蔽房间内星标 < banBelowStars 的用户发言
async function setBanRule(room, banBelowStars) {
  if (!network) return false
  return await network.setBanRule(room, banBelowStars)
}

// 房间默认屏蔽规则（仅 owner）
async function setRoomBanRule(room, banBelowStars) {
  if (!network) return false
  return await network.setRoomBanRule(room, banBelowStars)
}

// 踢出成员（仅 owner）
async function kickMember(room, peerId) {
  if (!network) return false
  const known = network.knownRooms?.get?.(room)
  const meta = network._localRoomMeta?.get?.(room)
  const owner = meta?.owner || known?.owner
  if (owner !== network.identity?.peerId) return false
  if (peerId === network.identity?.peerId) return false
  // 从本地移除
  if (network._removeMember) {
    network._removeMember(room, peerId)
  }
  // 广播踢出消息
  await network._broadcast({
    type: MsgType.KICK_MEMBER,
    payload: { room, peerId }
  })
  network._recomputeRooms?.()
  network._emit?.('member:update', { room })
  return true
}

// ---------------- 房间与存储管理 ----------------
/** 清空某房间的本地数据（消息/密码/星标/房间记录） */
async function clearRoomStorage(room) {
  await clearRoomData(room)
  // 星标（localStorage）
  const stars = { ...starredByRoom.value }
  delete stars[room]
  starredByRoom.value = stars
  saveStarred()
  // 置顶/公告/文档
  const nextPins = new Map(pins.value)
  nextPins.delete(room)
  pins.value = nextPins
  const nextAnn = new Map(announcements.value)
  nextAnn.delete(room)
  announcements.value = nextAnn
  const nextDocs = new Map(docs.value)
  nextDocs.delete(room)
  docs.value = nextDocs
  // 从内存索引移除
  roomMessageIndex.delete(room)
  // 从房间列表移除
  const idx = rooms.value.findIndex((r) => r.name === room)
  if (idx >= 0) rooms.value.splice(idx, 1)
  // 若是当前房间，清空显示
  if (currentRoom.value === room) {
    currentRoom.value = ''
    messages.value = []
    members.value = []
    pendingRequests.value = []
  }
  await refreshStorageStats()
}

/** 离开并清空房间数据 */
async function deleteRoomCompletely(room) {
  if (network) await network.leaveRoom(room)
  await clearRoomStorage(room)
}

/** 切换到指定房间（仅切换显示，不重新加入） */
async function switchToRoom(room) {
  if (currentRoom.value === room) return
  if (currentRoom.value && network) {
    await network.leaveRoom(currentRoom.value)
  }
  currentRoom.value = room
  messages.value = []
  await loadLocalMessages(room)
  if (network) await network.joinRoom(room)
  refreshMembers()
  refreshPendingRequests()
}

// ---------------- 信令服务器管理 ----------------
function getSignalingServers() {
  return getAllSignalingServers()
}

function getCurrentSignaling() {
  return network ? network.getActiveServer() : getSignaling()
}

async function addCustomSignalingServer(cfg) {
  const ok = addSignalingServer(cfg)
  return ok
}

function removeCustomSignalingServer(server) {
  removeSignalingServer(server)
}

async function switchSignalingServer(server) {
  setActiveSignalingServer(server)
  if (!network) return
  state.booting = true
  try {
    await network.restartWithServer(server)
    state.online = true
    state.activeServer = network.getActiveServer()
    state.error = null
  } catch (e) {
    state.error = describeError(e)
  } finally {
    state.booting = false
  }
}

function resetSignalingServers() {
  resetSignaling()
}

function getDiagnosticsInfo() {
  return getDiagnostics()
}

// ---------------- 节点能力（异构角色） ----------------
function getCapabilities() {
  return network ? network.getCapabilities() : { ...DEFAULT_CAPABILITIES }
}

async function setCapabilities(patch) {
  if (!network) return false
  const ok = await network.setCapabilities(patch)
  capabilities.value = network.getCapabilities()
  roleStats.value = network.getRoleStats()
  return ok
}

function getRoleStatsInfo() {
  return network ? network.getRoleStats() : { full: 0, normal: 0, light: 0, unknown: 0, relay: 0, alwaysOn: 0 }
}

/** 获取多域状态快照（UI 用） */
function getDomainsInfo() {
  return network ? network.getDomains() : []
}

// ---------------- 音视频通话（开发测试用） ----------------
async function startMediaCall(targetPeerId, localStream) {
  if (!network) return false
  return await network.startMediaCall(targetPeerId, localStream)
}

async function answerMediaCall(peerId, localStream) {
  if (!network) return false
  return await network.answerMediaCall(peerId, localStream)
}

function hangupMediaCall(peerId) {
  if (!network) return
  network.hangupMediaCall(peerId)
  remoteStream.value = null
  state.incomingCall = null
}

function getRoomPeers() {
  if (!network || !currentRoom.value) return []
  return network.getRoomMembers(currentRoom.value) || []
}

export function useChat() {
  return {
    state: readonly(state),
    remoteStream,
    peers,
    rooms,
    currentRoom,
    messages,
    members,
    stats,
    searchKeyword,
    pendingRequests,
    storageStats,
    notifications,
    downloadingIds,
    fileProgress,
    // 节点能力（异构角色）
    capabilities,
    roleStats,
    NodeRole,
    AccessRule,
    SpeakRule,
    // 多域并行状态（蛛网核心）
    domains,
    getDomainsInfo,
    // Phase 2.2: 群公告
    announcements,
    // Phase 2.3: Pin 置顶
    pins,
    // Phase 2.4: 云文档
    docs,
    docConflicts,
    init,
    setOwnName,
    createRoom,
    joinRoom,
    leaveCurrentRoom,
    leaveRoomByName,
    clearRoomData,
    backToRoomList,
    sendRoomMessage,
    sendFileMessage,
    downloadFile,
    // Phase 3.1: 消息编辑 / 撤回 / 回应
    editMessage,
    recallMessage,
    reactToMessage,
    searchRooms,
    clearSearch,
    // Phase 2.5: 消息搜索
    messageSearchResults,
    searchingMessages,
    searchMessagesGlobal,
    clearMessageSearch,
    filteredRooms,
    joinedRooms,
    isCurrentUserOwner,
    canUserApprove,
    // Phase 2.2: 公告权限与操作
    canSetAnnouncement,
    setAnnouncement,
    // Phase 2.3: Pin 置顶
    togglePin,
    isPinned,
    currentRoomPins,
    // 消息星标（本地收藏）
    toggleStar,
    currentRoomStarred,
    // 房间收藏（手动收藏）
    favoriteRooms,
    toggleFavorite,
    isFavorite,
    // Phase 2.4: 云文档
    currentRoomDocs,
    createDoc,
    updateDoc,
    renameDoc,
    deleteDocRemote,
    resolveDocConflictAcceptRemote,
    resolveDocConflictKeepLocal,
    // 审核/邀请/星标
    approveJoin,
    rejectJoin,
    inviteMember,
    setMemberStars,
    setRoomRules,
    // 屏蔽/放逐
    setBanRule,
    setRoomBanRule,
    kickMember,
    // 房间与存储管理
    clearRoomStorage,
    deleteRoomCompletely,
    switchToRoom,
    refreshStorageStats,
    // 信令服务器管理
    getSignalingServers,
    getCurrentSignaling,
    addCustomSignalingServer,
    removeCustomSignalingServer,
    switchSignalingServer,
    resetSignalingServers,
    getDiagnosticsInfo,
    // 节点能力
    getCapabilities,
    setCapabilities,
    getRoleStatsInfo,
    // 通知
    dismissNotification,
    // 音视频通话（开发测试用）
    startMediaCall,
    answerMediaCall,
    hangupMediaCall,
    getRoomPeers
  }
}
