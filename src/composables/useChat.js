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
import { AccessRule, SpeakRule } from '../lib/protocol.js'
import {
  addMessage,
  hasMessage,
  getMessages,
  getMeta,
  setMeta,
  getAllRooms,
  searchRooms as searchRoomsInDB,
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
    const savedName = await getMeta('ownName', '')
    state.ownName = savedName || randomDefaultName()
    await loadCachedRooms()
    await refreshStorageStats()

    network = new PeerNetwork(identity, state.ownName)
    wireEvents(network)

    // dev 调试钩子
    if (import.meta.env.DEV) {
      window.__nchat = { network, state, peers, rooms, messages }
    }

    await network.start()
    state.online = true
    state.activeServer = network.getActiveServer()
    state.error = null
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
}

function dismissNotification(id) {
  const idx = notifications.value.findIndex((n) => n.id === id)
  if (idx >= 0) notifications.value.splice(idx, 1)
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
  })

  net.addEventListener('peer:disconnected', (e) => {
    const { peerJsId, peerId } = e.detail
    const idx = peers.value.findIndex((p) => p.peerJsId === peerJsId)
    if (idx >= 0) peers.value.splice(idx, 1)
    if (peerId && currentRoom.value) refreshMembers()
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

  // 房间列表（合并而非替换，保留缓存房间和别名）
  net.addEventListener('rooms', (e) => {
    const incoming = e.detail || []
    const existing = new Map(rooms.value.map((r) => [r.name, r]))
    // 合并：新数据更新已有房间，新房间添加到列表
    for (const r of incoming) {
      const old = existing.get(r.name)
      if (old) {
        // 合并别名（取并集）
        const allAliases = new Set([...(r.aliases || []), ...(old.aliases || [])])
        existing.set(r.name, { ...old, ...r, aliases: [...allAliases] })
      } else {
        existing.set(r.name, r)
      }
    }
    rooms.value = [...existing.values()]
  })

  // 聊天消息
  net.addEventListener('chat', async (chatMsg) => {
    await handleChatMessage(chatMsg.detail)
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

  // 大文件：下载完成后（带完整 dataUrl）替换已有的 meta 卡片消息（同一 fileId）
  if (chatMsg.file?.fileId) {
    const existing = messages.value.find(
      (m) => m.file?.fileId === chatMsg.file.fileId && !m.file?.dataUrl
    )
    if (existing && chatMsg.file.dataUrl) {
      Object.assign(existing, chatMsg)
      pendingDownloads.delete(chatMsg.file.fileId)
      return
    }
  }

  // 去重
  const set = roomMessageIndex.get(chatMsg.room) || new Set()
  if (set.has(chatMsg.id)) return
  set.add(chatMsg.id)
  roomMessageIndex.set(chatMsg.room, set)

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
  refreshMembers()
  refreshPendingRequests()
  return 'joined'
}

async function loadLocalMessages(name) {
  try {
    const local = await getMessages(name, 0)
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
  currentRoom.value = ''
  messages.value = []
  members.value = []
  pendingRequests.value = []
}

async function sendRoomMessage(text) {
  if (!network || !currentRoom.value || !text.trim()) return
  const ok = await network.sendRoomMessage(currentRoom.value, text.trim())
  if (ok) stats.value.sent++
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

/** 已加入的房间列表 */
const joinedRooms = computed(() => {
  if (!network) return []
  const joined = new Set(network.localRooms())
  return rooms.value.filter((r) => joined.has(r.name))
})

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

// ---------------- 房间与存储管理 ----------------
/** 清空某房间的本地数据（消息/密码/星标/房间记录） */
async function clearRoomStorage(room) {
  await clearRoomData(room)
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
    AccessRule,
    SpeakRule,
    init,
    setOwnName,
    createRoom,
    joinRoom,
    leaveCurrentRoom,
    sendRoomMessage,
    sendFileMessage,
    downloadFile,
    searchRooms,
    clearSearch,
    filteredRooms,
    joinedRooms,
    isCurrentUserOwner,
    canUserApprove,
    // 审核/邀请/星标
    approveJoin,
    rejectJoin,
    inviteMember,
    setMemberStars,
    setRoomRules,
    // 屏蔽/放逐
    setBanRule,
    setRoomBanRule,
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
    // 通知
    dismissNotification,
    // 音视频通话（开发测试用）
    startMediaCall,
    answerMediaCall,
    hangupMediaCall,
    getRoomPeers
  }
}
