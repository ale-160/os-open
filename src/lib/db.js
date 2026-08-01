/**
 * 本地持久化层
 *
 * 消息（含图片 dataUrl，体积大）存 IndexedDB（配额远大于 localStorage 的 ~5MB，
 * 几张图片就会写满 localStorage 导致历史丢失）；其余轻量元数据
 * （peers/rooms/meta/aliases/passwords/stars/bans）仍用 localStorage。
 *
 * IndexedDB 不可用（部分浏览器 open 回调不触发/卡死）时自动回退 localStorage，
 * 功能不中断。
 *
 * 四类数据：
 *  - peers:    已发现节点 [{ id, name, lastSeen }]
 *  - rooms:    已知房间 [{ name, memberCount, activity, lastUpdate }]
 *  - messages: 房间消息 [{ id, room, from, name, text, timestamp }]（IndexedDB）
 *  - meta:     杂项 KV（如 ownName）
 */
import { openDB } from 'idb'
import { CONFIG } from '../config.js'

const KEYS = {
  peers: 'nchat:peers',
  rooms: 'nchat:rooms',
  messages: 'nchat:messages', // { roomName: [msg, ...] } 旧格式（localStorage 回退/迁移源）
  meta: 'nchat:meta',
  aliases: 'nchat:aliases', // { alias: roomName } 别名→房间名映射
  passwords: 'nchat:passwords', // { roomName: password } 已验证的房间密码
  stars: 'nchat:stars', // { roomName: { peerId: stars } } 星标覆盖
  bans: 'nchat:bans' // { roomName: { peerId: banBelowStars } } 个人屏蔽规则
}

const IDB_NAME = 'nchat-db'
const IDB_VERSION = 2
const IDB_STORE = 'messages'
const IDB_STORE_LCAN = 'lcan'
const IDB_STORE_DOCS = 'docs'
// IndexedDB 打开超时（ms）：部分环境 open 回调不触发，超时后回退 localStorage
const IDB_TIMEOUT = 4000

let idbPromise = null
let idbDisabled = false
let idbMigrated = false

function openMessagesDB() {
  if (idbDisabled) return null
  if (!idbPromise) {
    idbPromise = Promise.race([
      openDB(IDB_NAME, IDB_VERSION, {
        upgrade(db) {
          // v1: messages store
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            const store = db.createObjectStore(IDB_STORE, { keyPath: 'id' })
            store.createIndex('room', 'room')
          }
          // v2: LCAN 多副本分布式存储 + 云文档
          if (!db.objectStoreNames.contains(IDB_STORE_LCAN)) {
            const lcan = db.createObjectStore(IDB_STORE_LCAN, { keyPath: 'key' })
            lcan.createIndex('expires', 'expires')
          }
          if (!db.objectStoreNames.contains(IDB_STORE_DOCS)) {
            db.createObjectStore(IDB_STORE_DOCS, { keyPath: 'docId' })
          }
        }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('IndexedDB open timeout')), IDB_TIMEOUT)
      )
    ]).catch((e) => {
      console.warn('[nchat] IndexedDB 不可用，消息回退 localStorage：', e?.message)
      idbDisabled = true
      idbPromise = null
      return null
    })
  }
  return idbPromise
}

/** 迁移旧 localStorage 消息到 IndexedDB（首次打开时执行一次） */
async function migrateMessagesToIDB(db) {
  if (idbMigrated) return
  idbMigrated = true
  try {
    const legacy = readJSON(KEYS.messages, {})
    if (!legacy || !Object.keys(legacy).length) return
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    let moved = 0
    for (const list of Object.values(legacy)) {
      if (!Array.isArray(list)) continue
      for (const m of list) {
        if (m && m.id) {
          await store.put(m)
          moved++
        }
      }
    }
    await tx.done
    if (moved > 0) {
      console.log(`[nchat] 已迁移 ${moved} 条历史消息到 IndexedDB`)
      localStorage.removeItem(KEYS.messages)
    }
  } catch (e) {
    console.warn('[nchat] 迁移旧消息失败（保留 localStorage）：', e?.message)
  }
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

// ---- Messages（IndexedDB 优先，localStorage 回退）----
export async function addMessage(msg) {
  if (!msg || !msg.id || !msg.room) return
  const db = await openMessagesDB()
  if (db) {
    try {
      await migrateMessagesToIDB(db)
      await db.put(IDB_STORE, msg)
      // 裁剪：每房间最多 HISTORY_LIMIT 条（新成员能看到的历史有上限即可，不无限累积）
      await trimRoomMessages(db, msg.room)
      return
    } catch (e) {
      console.warn('[nchat] IndexedDB 写入失败，回退 localStorage：', e?.message)
    }
  }
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

/** IndexedDB 中裁剪某房间的旧消息（保留最近 HISTORY_LIMIT 条） */
async function trimRoomMessages(db, room) {
  try {
    const all = await db.getAllFromIndex(IDB_STORE, 'room', room)
    if (all.length <= CONFIG.HISTORY_LIMIT) return
    all.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    const excess = all.slice(0, all.length - CONFIG.HISTORY_LIMIT)
    const tx = db.transaction(IDB_STORE, 'readwrite')
    for (const m of excess) {
      tx.store.delete(m.id)
    }
    await tx.done
  } catch (e) {
    /* ignore */
  }
}

export async function getMessages(room, since = 0, limit = CONFIG.HISTORY_FETCH_BATCH) {
  const db = await openMessagesDB()
  if (db) {
    try {
      await migrateMessagesToIDB(db)
      const all = await db.getAllFromIndex(IDB_STORE, 'room', room)
      return all
        .filter((m) => m.timestamp > since)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, limit)
    } catch (e) {
      /* 回退下方 localStorage */
    }
  }
  const store = readJSON(KEYS.messages, {})
  const list = store[room] || []
  return list
    .filter((m) => m.timestamp > since)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, limit)
}

export async function hasMessage(id) {
  if (!id) return false
  const db = await openMessagesDB()
  if (db) {
    try {
      const m = await db.get(IDB_STORE, id)
      if (m) return true
    } catch (e) {
      /* 回退下方 localStorage */
    }
  }
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
  // 删除消息（IndexedDB + localStorage 双清）
  try {
    const db = await openMessagesDB()
    if (db) {
      const all = await db.getAllFromIndex(IDB_STORE, 'room', room)
      const tx = db.transaction(IDB_STORE, 'readwrite')
      for (const m of all) tx.store.delete(m.id)
      await tx.done
    }
  } catch (e) {
    /* ignore */
  }
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

// ---- 大文件发送缓存（刷新页面后仍可提供下载） ----
// 结构：{ fileId: { room, name, type, size, dataUrl } }
const OUTGOING_KEY = 'nchat:outgoing-files'

export function saveOutgoingFile(fileId, info) {
  const all = readJSON(OUTGOING_KEY, {})
  all[fileId] = info
  // 限制条数，防 localStorage 溢出（每条可能几百 KB ~ 几 MB）
  const keys = Object.keys(all)
  while (keys.length > 5) {
    delete all[keys.shift()]
  }
  writeJSON(OUTGOING_KEY, all)
}

export function getOutgoingFiles() {
  return readJSON(OUTGOING_KEY, {})
}

export function deleteOutgoingFile(fileId) {
  const all = readJSON(OUTGOING_KEY, {})
  delete all[fileId]
  writeJSON(OUTGOING_KEY, all)
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
  const db = await openMessagesDB()
  if (db) {
    try {
      const all = await db.getAllFromIndex(IDB_STORE, 'room', room)
      return all.length
    } catch (e) {
      /* 回退下方 localStorage */
    }
  }
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
  // IndexedDB 消息数（叠加）
  try {
    const db = await openMessagesDB()
    if (db) {
      const all = await db.getAll(IDB_STORE)
      msgCount += all.length
    }
  } catch (e) {
    /* ignore */
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

// ---- LCAN 多副本分布式存储 ----
// objectStore 'lcan': { key, payload, expires, author, ts }
// holder 表（localStorage）：{ key: [peerId...] } 记录哪些节点持有该 key 的副本

/**
 * 写入一条 LCAN 数据（多副本责任区存储）。
 * @param {string} key   LCAN key（hex 字符串）
 * @param {*} payload    任意可序列化数据
 * @param {object} [opts]
 * @param {number} [opts.ttl=604800000]  存活时长 ms（默认 7 天）
 * @param {string} [opts.author]         原始写入者 peerId
 * @returns {Promise<boolean>}
 */
export async function lcanPut(key, payload, opts = {}) {
  const ttl = opts.ttl != null ? opts.ttl : 7 * 24 * 60 * 60 * 1000
  const db = await openMessagesDB()
  if (!db) return false
  try {
    const rec = {
      key,
      payload,
      expires: ttl > 0 ? Date.now() + ttl : 0, // 0 = 永不过期
      author: opts.author || '',
      ts: Date.now()
    }
    await db.put(IDB_STORE_LCAN, rec)
    return true
  } catch (e) {
    console.warn('[nchat] lcanPut failed:', e?.message)
    return false
  }
}

/**
 * 读取一条 LCAN 数据。过期则删除并返回 null。
 * @param {string} key
 * @returns {Promise<{key,payload,expires,author,ts}|null>}
 */
export async function lcanGet(key) {
  const db = await openMessagesDB()
  if (!db) return null
  try {
    const rec = await db.get(IDB_STORE_LCAN, key)
    if (!rec) return null
    if (rec.expires && rec.expires < Date.now()) {
      await db.delete(IDB_STORE_LCAN, key)
      return null
    }
    return rec
  } catch (e) {
    return null
  }
}

/** 删除一条 LCAN 数据 */
export async function lcanDelete(key) {
  const db = await openMessagesDB()
  if (!db) return
  try {
    await db.delete(IDB_STORE_LCAN, key)
  } catch (e) {
    /* ignore */
  }
}

/**
 * 清扫所有过期的 LCAN 条目（Phase 1.6 定时调用）。
 * @returns {Promise<number>} 清理条数
 */
export async function lcanCleanExpired() {
  const db = await openMessagesDB()
  if (!db) return 0
  try {
    const now = Date.now()
    const tx = db.transaction(IDB_STORE_LCAN, 'readwrite')
    const store = tx.objectStore(IDB_STORE_LCAN)
    let removed = 0
    let cursor = await store.openCursor()
    while (cursor) {
      const rec = cursor.value
      if (rec.expires && rec.expires < now) {
        await cursor.delete()
        removed++
      }
      cursor = await cursor.continue()
    }
    await tx.done
    return removed
  } catch (e) {
    return 0
  }
}

/** 统计 LCAN 存储条目数（角色限流用） */
export async function lcanCount() {
  const db = await openMessagesDB()
  if (!db) return 0
  try {
    return await db.count(IDB_STORE_LCAN)
  } catch (e) {
    return 0
  }
}

// ---- 副本持有者表（holder table，localStorage） ----
// { key: [peerId, peerId, ...] } —— 记录哪些节点声称持有该 key 的副本
const HOLDERS_KEY = 'nchat:holders'

/** 读取某 key 的持有者列表 */
export function getHolders(key) {
  const all = readJSON(HOLDERS_KEY, {})
  return all[key] || []
}

/** 读取全部 holder 表（拓扑/自愈用） */
export function getAllHolders() {
  return readJSON(HOLDERS_KEY, {})
}

/** 向某 key 的持有者列表添加一个 peerId（去重） */
export function addHolder(key, peerId) {
  if (!key || !peerId) return
  const all = readJSON(HOLDERS_KEY, {})
  const list = all[key] || []
  if (!list.includes(peerId)) {
    list.push(peerId)
    all[key] = list
    writeJSON(HOLDERS_KEY, all)
  }
}

/** 从某 key 的持有者列表移除一个 peerId */
export function removeHolder(key, peerId) {
  if (!key || !peerId) return
  const all = readJSON(HOLDERS_KEY, {})
  const list = all[key] || []
  const idx = list.indexOf(peerId)
  if (idx >= 0) {
    list.splice(idx, 1)
    if (list.length === 0) delete all[key]
    else all[key] = list
    writeJSON(HOLDERS_KEY, all)
  }
}

/** 节点下线时，从全部 holder 表中移除该 peerId（副本自愈触发用） */
export function removePeerFromHolders(peerId) {
  if (!peerId) return 0
  const all = readJSON(HOLDERS_KEY, {})
  let touched = 0
  for (const key of Object.keys(all)) {
    const list = all[key]
    const idx = list.indexOf(peerId)
    if (idx >= 0) {
      list.splice(idx, 1)
      if (list.length === 0) delete all[key]
      else all[key] = list
      touched++
    }
  }
  if (touched > 0) writeJSON(HOLDERS_KEY, all)
  return touched
}
