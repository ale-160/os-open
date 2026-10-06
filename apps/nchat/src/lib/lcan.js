/**
 * LCAN（Local Content Addressable Network）纯函数模块。
 *
 * 实现 Kademlia 风格的 XOR 距离与责任集计算，为多副本分布式存储提供
 * 确定性的"责任节点"选举依据。所有函数均为纯函数，无副作用，可独立测试。
 *
 * 概念：
 *  - 节点 ID = Ed25519 公钥的 base58 字符串（32 字节熵）
 *  - 数据 key = sha256(namespace + ':' + objectId)，32 字节
 *  - 距离 = ID ⊕ key，按 BigInt 解释为大端无符号整数
 *  - 责任集 = 与 key XOR 距离最近的 k 个在线节点
 *
 * 异构网络扩展：调用方在传入 onlinePeers 前可按角色（full/normal/light）
 * 预过滤，light 节点不参与责任集；full 节点可在责任集外额外镜像。
 * 本模块只负责"算距离 + 选最近 k 个"，角色策略由调用方决定。
 */
import { sha256 } from '@noble/hashes/sha2.js'
import { base58Decode } from './crypto.js'

/** 32 字节 = 256 bit */
export const KEY_BYTES = 32
/** 责任集默认大小 */
export const DEFAULT_K = 3

/**
 * 将 32 字节 Uint8Array 解释为大端 BigInt。
 * @param {Uint8Array} bytes
 * @returns {bigint}
 */
export function bytesToBigInt(bytes) {
  let n = 0n
  for (let i = 0; i < bytes.length; i++) {
    n = (n << 8n) | BigInt(bytes[i])
  }
  return n
}

/**
 * 将 base58 字符串或 Uint8Array 归一化为 32 字节 Uint8Array。
 * base58 解码后长度可能不足/超过 32，统一按 sha256 折叠到 32 字节，
 * 保证 XOR 距离计算时双方长度一致。
 * @param {string|Uint8Array} id
 * @returns {Uint8Array} 32 字节
 */
export function normalizeId(id) {
  if (id == null) throw new Error('normalizeId: id required')
  if (id instanceof Uint8Array) {
    if (id.length === KEY_BYTES) return id
    return sha256(id)
  }
  if (typeof id === 'string' && id.length > 0) {
    try {
      const dec = base58Decode(id)
      if (dec.length === KEY_BYTES) return dec
      return sha256(dec)
    } catch {
      // 非法 base58，按 utf8 编码后哈希
      return sha256(new TextEncoder().encode(id))
    }
  }
  throw new Error('normalizeId: unsupported id type ' + typeof id)
}

/**
 * 计算两个 ID（base58 字符串或 Uint8Array）之间的 XOR 距离。
 * 距离对称：xorDistance(a, b) === xorDistance(b, a)
 * @param {string|Uint8Array} a
 * @param {string|Uint8Array} b
 * @returns {bigint}
 */
export function xorDistance(a, b) {
  const aa = normalizeId(a)
  const bb = normalizeId(b)
  // 逐字节 XOR
  const out = new Uint8Array(KEY_BYTES)
  for (let i = 0; i < KEY_BYTES; i++) {
    out[i] = aa[i] ^ bb[i]
  }
  return bytesToBigInt(out)
}

/**
 * 计算命名空间对象的 LCAN key（32 字节 sha256）。
 * @param {string} namespace 命名空间，如 'room' / 'doc' / 'thread'
 * @param {string} objectId  对象标识，如房间名 / 文档 ID
 * @returns {Uint8Array} 32 字节
 */
export function sha256Key(namespace, objectId) {
  if (typeof namespace !== 'string' || typeof objectId !== 'string') {
    throw new Error('sha256Key: namespace and objectId must be strings')
  }
  return sha256(new TextEncoder().encode(namespace + ':' + objectId))
}

/**
 * 计算 LCAN key 的 hex 表示（便于日志/调试）。
 * @param {Uint8Array} key
 * @returns {string}
 */
export function keyToHex(key) {
  if (!(key instanceof Uint8Array)) throw new Error('keyToHex: Uint8Array required')
  let s = ''
  for (let i = 0; i < key.length; i++) {
    s += key[i].toString(16).padStart(2, '0')
  }
  return s
}

/**
 * XOR 距离对应的 Kademlia bucket 索引（0~255）。
 * bucket 越小表示距离越近（高位 0 越多）。
 * 距离为 0（自身）返回 -1。
 * @param {bigint} dist
 * @returns {number} -1（自身）或 0..255
 */
export function bucketFor(dist) {
  if (typeof dist !== 'bigint') throw new Error('bucketFor: bigint required')
  if (dist === 0n) return -1
  // floor(log2(dist)) 即最高有效位的位置
  let b = -1
  let d = dist
  while (d > 0n) {
    b++
    d >>= 1n
  }
  return b
}

/**
 * 从在线节点集合中选出距离 key 最近的 k 个节点（责任集）。
 *
 * @param {Uint8Array|string} key  数据 key（32 字节或 base58 peerId 字符串）
 * @param {Array<string|{peerId:string}>} onlinePeers  在线节点列表，元素可以是 peerId 字符串或含 peerId 字段的对象
 * @param {number} [k=3]  责任集大小
 * @returns {Array<{peerId:string, dist:bigint}>} 按 dist 升序排列，长度 ≤ k
 */
export function responsible(key, onlinePeers, k = DEFAULT_K) {
  if (!Array.isArray(onlinePeers) || onlinePeers.length === 0) return []
  const kk = Math.max(0, k | 0)
  if (kk === 0) return []
  const keyBytes = typeof key === 'string' ? normalizeId(key) : key
  const arr = []
  for (const p of onlinePeers) {
    const pid = typeof p === 'string' ? p : p?.peerId
    if (!pid) continue
    const peerBytes = normalizeId(pid)
    // 逐字节 XOR → BigInt
    const out = new Uint8Array(KEY_BYTES)
    for (let i = 0; i < KEY_BYTES; i++) {
      out[i] = keyBytes[i] ^ peerBytes[i]
    }
    arr.push({ peerId: pid, dist: bytesToBigInt(out) })
  }
  // 升序：dist 小者责任优先
  arr.sort((a, b) => (a.dist < b.dist ? -1 : a.dist > b.dist ? 1 : 0))
  return arr.slice(0, kk)
}

/**
 * 判断某 peerId 是否属于该 key 的责任集。
 * @param {Uint8Array|string} key
 * @param {string} peerId
 * @param {Array} onlinePeers
 * @param {number} [k=3]
 * @returns {boolean}
 */
export function isResponsible(key, peerId, onlinePeers, k = DEFAULT_K) {
  const set = responsible(key, onlinePeers, k)
  return set.some((r) => r.peerId === peerId)
}

/**
 * 从候选节点中按 XOR 距离升序选出最多 n 个最近的（用于跨域中继路由）。
 * 与 responsible 不同：不限于责任集 k 个，可返回更多近邻用于路由候选。
 * @param {Uint8Array|string} key
 * @param {Array<string|{peerId:string}>} candidates
 * @param {number} n
 * @returns {Array<{peerId:string, dist:bigint}>}
 */
export function nearestTo(key, candidates, n) {
  if (!Array.isArray(candidates) || candidates.length === 0) return []
  const nn = Math.max(0, n | 0)
  if (nn === 0) return []
  // 复用 responsible 的排序逻辑（k 取 candidates.length，再截 n）
  const sorted = responsible(key, candidates, candidates.length)
  return sorted.slice(0, nn)
}
