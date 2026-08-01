/**
 * 本地持久化层（基于 localStorage）
 *
 * 原设计使用 IndexedDB（idb 库），但在部分浏览器环境下
 * indexedDB.open() 的回调不触发，导致整个应用初始化卡死。
 * MVP 阶段数据量小，改用 localStorage 更简单可靠。
 *
 * 四类数据：
 *  - peers:    已发现节点 [{ id, name, lastSeen }]
 *  - rooms:    已知房间 [{ name, memberCount, activity, lastUpdate }]
 *  - messages: 房间消息 [{ id, room, from, name, text, timestamp }]
 *  - meta:     杂项 KV（如 ownName）
 */
import { CONFIG } from '../config.js'

const KEYS = {
  peers: 'nchat:peers',
  rooms: 'nchat:rooms',
  messages: 'nchat:messages', // { roomName: [msg, ...] }
  meta: 'nchat:meta',
  aliases: 'nchat:aliases', // { alias: roomName } 别名→房间名映射
  passwords: 'nchat:passwords', // { roomName: password } 已验证的房间密码
  stars: 'nchat:stars', // { roomName: { peerId: stars } } 星标覆盖
  bans: 'nchat:bans' // { roomName: { peerId: banBelowStars } } 个人屏蔽规则
}

// ---- 内部工具 ----
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('[nchat] localStorage 写入失败：', e)
  }
}

// ---- Peers ----
export async function savePeer(peer) {
  const peers = readJSON(KEYS.peers, [])
  const idx = peers.findIndex((p) => p.id === peer.id)
  if (idx >= 0) peers[idx] = { ...peers[idx], ...peer }
  else peers.push(peer)
  writeJSON(KEYS.peers, peers)
}

export async function getPeer(id) {
  const peers = readJSON(KEYS.peers, [])
  return peers.find((p) => p.id === id) || null
}

export async function getAllPeers() {
  return readJSON(KEYS.peers, [])
}

export async function deletePeer(id) {
  const peers = readJSON(KEYS.peers, [])
  const filtered = peers.filter((p) => p.id !== id)
  writeJSON(KEYS.peers, filtered)
}

// ---- Rooms ----
export async function saveRoom(room) {
  const rooms = readJSON(KEYS.rooms, [])
  const idx = rooms.findIndex((r) => r.name === room.name)
  if (idx >= 0) rooms[idx] = { ...rooms[idx], ...room }
  else rooms.push(room)
  writeJSON(KEYS.rooms, rooms)
  // 同步别名索引
  if (Array.isArray(room.aliases)) {
    syncAliasIndex(room.name, room.aliases)
  }
}

export async function getRoom(name) {
  const rooms = readJSON(KEYS.rooms, [])
  return rooms.find((r) => r.name === name) || null
}

export async function getAllRooms() {
  return readJSON(KEYS.rooms, [])
}

/** 搜索房间：匹配房间名或别名 */
export async function searchRooms(keyword) {
  const all = await getAllRooms()
  if (!keyword) return all
  const kw = keyword.toLowerCase()
  // 1. 房间名直接匹配
  const byName = all.filter((r) => r.name.toLowerCase().includes(kw))
  // 2. 别名匹配
  const aliasMap = readJSON(KEYS.aliases, {})
  const matchedRoomNames = new Set()
  for (const [alias, roomName] of Object.entries(aliasMap)) {
    if (alias.toLowerCase().includes(kw)) matchedRoomNames.add(roomName)
  }
  // 合并：别名命中的房间也加入结果（避免重复）
  const byAlias = all.filter((r) => matchedRoomNames.has(r.name) && !byName.find((x) => x.name === r.name))
  return [...byName, ...byAlias]
}

/** 通过别名查找房间名 */
export function getRoomNameByAlias(alias) {
  const aliasMap = readJSON(KEYS.aliases, {})
  // 精确匹配
  if (aliasMap[alias]) return aliasMap[alias]
  // 模糊匹配（不区分大小写）
  const lower = alias.toLowerCase()
  for (const [a, roomName] of Object.entries(aliasMap)) {
    if (a.toLowerCase() === lower) return roomName
  }
  return null
}

export async function deleteRoom(name) {
  const rooms = readJSON(KEYS.rooms, [])
  writeJSON(
    KEYS.rooms,
    rooms.filter((r) => r.name !== name)
  )
  // 清理别名索引
  const aliasMap = readJSON(KEYS.aliases, {})
  for (const [alias, roomName] of Object.entries(aliasMap)) {
    if (roomName === name) delete aliasMap[alias]
  }
  writeJSON(KEYS.aliases, aliasMap)
}

/** 同步别名索引：以房间名为 key，覆盖该房间的别名集合 */
function syncAliasIndex(roomName, aliases) {
  const aliasMap = readJSON(KEYS.aliases, {})
  // 先移除该房间旧的别名
  for (const [alias, rn] of Object.entries(aliasMap)) {
    if (rn === roomName) delete aliasMap[alias]
  }
  // 写入新别名（最多 MAX_ALIASES 个）
  const list = (aliases || []).slice(0, CONFIG.MAX_ALIASES)
  for (const alias of list) {
    if (alias && typeof alias === 'string') {
      aliasMap[alias] = roomName
    }
  }
  writeJSON(KEYS.aliases, aliasMap)
}

// ---- Messages ----
export async function addMessage(msg) {
  const store = readJSON(KEYS.messages, {})
  const list = store[msg.room] || []
  // 去重
  if (!list.some((m) => m.id === msg.id)) {
    list.push(msg)
  }
  // 房间消息超限时裁剪最早的
  if (list.length > CONFIG.HISTORY_LIMIT) {
    list.sort((a, b) => a.timestamp - b.timestamp)
    store[msg.room] = list.slice(list.length - CONFIG.HISTORY_LIMIT)
  } else {
    store[msg.room] = list
  }
  writeJSON(KEYS.messages, store)
}

export async function getMessages(room, since = 0, limit = CONFIG.HISTORY_FETCH_BATCH) {
  const store = readJSON(KEYS.messages, {})
  const list = store[room] || []
  return list
    .filter((m) => m.timestamp > since)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, limit)
}

export async function hasMessage(id) {
  const store = readJSON(KEYS.messages, {})
  for (const room of Object.keys(store)) {
    if (store[room].some((m) => m.id === id)) return true
  }
  return false
}

// ---- Meta KV ----
export async function setMeta(key, value) {
  const meta = readJSON(KEYS.meta, {})
  meta[key] = value
  writeJSON(KEYS.meta, meta)
}

export async function getMeta(key, defaultValue = null) {
  const meta = readJSON(KEYS.meta, {})
  return meta[key] === undefined ? defaultValue : meta[key]
}

// ---- 房间密码（已验证的密码，避免重复输入） ----
export function getRoomPassword(room) {
  const passwords = readJSON(KEYS.passwords, {})
  return passwords[room] || null
}

export function setRoomPassword(room, password) {
  const passwords = readJSON(KEYS.passwords, {})
  passwords[room] = password
  writeJSON(KEYS.passwords, passwords)
}

export function deleteRoomPassword(room) {
  const passwords = readJSON(KEYS.passwords, {})
  delete passwords[room]
  writeJSON(KEYS.passwords, passwords)
}

// ---- 星标覆盖（创建者调整的成员星标） ----
export function getStarsOverride(room) {
  const all = readJSON(KEYS.stars, {})
  return all[room] || {}
}

export function setStarsOverride(room, peerId, stars) {
  const all = readJSON(KEYS.stars, {})
  if (!all[room]) all[room] = {}
  all[room][peerId] = stars
  writeJSON(KEYS.stars, all)
}

export function deleteRoomStars(room) {
  const all = readJSON(KEYS.stars, {})
  delete all[room]
  writeJSON(KEYS.stars, all)
}

// ---- 清理房间所有数据 ----
export async function clearRoomData(room) {
  // 删除房间记录
  await deleteRoom(room)
  // 删除消息
  const store = readJSON(KEYS.messages, {})
  delete store[room]
  writeJSON(KEYS.messages, store)
  // 删除密码
  deleteRoomPassword(room)
  // 删除星标
  deleteRoomStars(room)
  // 删除个人屏蔽规则
  deleteRoomBans(room)
}

// ---- 个人屏蔽规则 ----
// 结构：{ roomName: { peerId: banBelowStars } }
// 含义：peerId 设置的屏蔽阈值，屏蔽星标 < banBelowStars 的用户发言
// 注：屏蔽方自身的星标必须 >= banBelowStars，被屏蔽方星标 < banBelowStars

export function getRoomBans(room) {
  const all = readJSON(KEYS.bans, {})
  return all[room] || {}
}

export function setBan(room, banPeerId, banBelowStars) {
  const all = readJSON(KEYS.bans, {})
  if (!all[room]) all[room] = {}
  if (banBelowStars > 0) {
    all[room][banPeerId] = banBelowStars
  } else {
    delete all[room][banPeerId]
  }
  writeJSON(KEYS.bans, all)
}

export function deleteRoomBans(room) {
  const all = readJSON(KEYS.bans, {})
  delete all[room]
  writeJSON(KEYS.bans, all)
}

/** 统计某房间的本地存储消息数 */
export async function getRoomMessageCount(room) {
  const store = readJSON(KEYS.messages, {})
  const list = store[room] || []
  return list.length
}

/** 本地存储用量统计 */
export async function getStorageStats() {
  const rooms = readJSON(KEYS.rooms, [])
  const messages = readJSON(KEYS.messages, {})
  let msgCount = 0
  let sizeBytes = 0
  for (const list of Object.values(messages)) {
    if (Array.isArray(list)) msgCount += list.length
  }
  // 估算 localStorage 总用量
  try {
    for (const k of Object.values(KEYS)) {
      const v = localStorage.getItem(k)
      if (v) sizeBytes += v.length * 2 // UTF-16 近似
    }
  } catch {
    /* ignore */
  }
  return {
    rooms: rooms.length,
    messages: msgCount,
    sizeBytes
  }
}

/** 格式化字节数为可读字符串 */
export function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}
