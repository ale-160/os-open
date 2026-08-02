/**
 * Ed25519 密钥对生成、签名、验签，以及 Base58 编码。
 *
 * 双路径实现：
 *  - 安全上下文（HTTPS / localhost）：使用浏览器原生 crypto.subtle
 *  - 非安全上下文（HTTP + 局域网 IP）：回退到 @noble/ed25519 纯 JS 实现
 *
 * 密钥持久化使用 localStorage（JWK 仅几个字符串字段，体积小且同步可用），
 * 跨标签页共享同一身份，刷新后不变。
 */
import * as noble from '@noble/ed25519'
import { sha512, sha256 } from '@noble/hashes/sha2.js'

// noble v3 需要显式配置 SHA-512 实现（同步 + 异步）
// 非安全上下文下 crypto.subtle 不可用，必须两条都配置
noble.hashes.sha512 = sha512
noble.hashes.sha512Async = async (message) => sha512(message)

// ---- Base58 (Bitcoin 字母表) ----
const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function base58Encode(bytes) {
  const input = Array.from(bytes)
  let zeros = 0
  while (zeros < input.length && input[zeros] === 0) zeros++
  const digits = []
  let start = zeros
  while (start < input.length) {
    let remainder = 0
    for (let i = start; i < input.length; i++) {
      remainder = (remainder << 8) + input[i]
      input[i] = (remainder / 58) | 0
      remainder = remainder % 58
    }
    digits.push(remainder)
    while (start < input.length && input[start] === 0) start++
  }
  let out = ''
  for (let i = 0; i < zeros; i++) out += BASE58_ALPHABET[0]
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58_ALPHABET[digits[i]]
  return out
}

export function base58Decode(str) {
  const bytes = []
  let zeros = 0
  while (zeros < str.length && str[zeros] === BASE58_ALPHABET[0]) zeros++
  for (let i = zeros; i < str.length; i++) {
    let carry = BASE58_ALPHABET.indexOf(str[i])
    if (carry < 0) throw new Error('base58: 非法字符 ' + str[i])
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58
      bytes[j] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (let i = 0; i < zeros; i++) bytes.push(0)
  return new Uint8Array(bytes.reverse())
}

// ---- 安全上下文检测 ----
const hasSubtleCrypto =
  typeof crypto !== 'undefined' &&
  typeof crypto.subtle !== 'undefined' &&
  typeof crypto.subtle.generateKey === 'function'

// ---- Ed25519 ----
const KEY_STORAGE = 'nchat:ed25519:jwk'

/**
 * 生成或从 localStorage 复用 Ed25519 密钥对。
 */
export async function loadOrCreateIdentity() {
  // 先尝试从 localStorage 恢复
  const stored = readJWK()
  if (stored && stored.priv) {
    try {
      return await identityFromStored(stored)
    } catch (e) {
      console.warn('[nchat] 持久化密钥加载失败，重新生成：', e)
    }
  }

  // 生成新密钥
  if (hasSubtleCrypto) {
    return await generateWithSubtle()
  }
  return await generateWithNoble()
}

// ---- 基于 crypto.subtle 的实现 ----
async function generateWithSubtle() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  )
  const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const pubRaw = new Uint8Array(spki).slice(-32)
  const peerId = base58Encode(pubRaw)
  // 持久化：存私钥 JWK + 公钥 raw(base58)
  writeJWK({ priv: privJwk, pub: base58Encode(pubRaw) })
  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    peerId,
    _pubRaw: pubRaw
  }
}

async function identityFromStored(stored) {
  if (hasSubtleCrypto && stored.priv && stored.priv.x) {
    // subtle 路径恢复
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      stored.priv,
      { name: 'Ed25519' },
      true,
      ['sign']
    )
    const publicJwk = { kty: stored.priv.kty, crv: stored.priv.crv, x: stored.priv.x }
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      publicJwk,
      { name: 'Ed25519' },
      true,
      ['verify']
    )
    const peerId = stored.pub || (await peerIdFromPublicKey(publicKey))
    return { privateKey, publicKey, peerId, _pubRaw: base58Decode(peerId) }
  }
  // noble 路径恢复
  if (stored.privRaw) {
    return await identityFromStoredNoble(stored)
  }
  throw new Error('stored identity invalid')
}

async function peerIdFromPublicKey(publicKey) {
  const spki = await crypto.subtle.exportKey('spki', publicKey)
  const raw = new Uint8Array(spki).slice(-32)
  return base58Encode(raw)
}

// ---- 基于 @noble/ed25519 的实现（非安全上下文回退） ----
async function generateWithNoble() {
  console.warn('[nchat] 非安全上下文，使用 @noble/ed25519 回退')
  const privRaw = noble.utils.randomSecretKey()
  const pubRaw = noble.getPublicKey(privRaw)
  const peerId = base58Encode(pubRaw)
  writeJWK({ privRaw: base58Encode(privRaw), pub: peerId })
  return {
    privateKey: privRaw,
    publicKey: pubRaw,
    peerId,
    _pubRaw: pubRaw,
    _noble: true
  }
}

// noble 路径恢复
async function identityFromStoredNoble(stored) {
  const privRaw = base58Decode(stored.privRaw)
  const pubRaw = noble.getPublicKey(privRaw)
  const peerId = base58Encode(pubRaw)
  return {
    privateKey: privRaw,
    publicKey: pubRaw,
    peerId,
    _pubRaw: pubRaw,
    _noble: true
  }
}

// ---- 签名 / 验签（统一接口，内部自动路由） ----
export async function sign(privateKey, data) {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data
  if (hasSubtleCrypto && !(privateKey instanceof Uint8Array)) {
    const sig = await crypto.subtle.sign('Ed25519', privateKey, buf)
    return base58Encode(new Uint8Array(sig))
  }
  // noble 路径
  const sig = await noble.signAsync(buf, privateKey)
  return base58Encode(sig)
}

export async function verify(publicKeyB58, signatureB58, data) {
  try {
    const pubRaw = base58Decode(publicKeyB58)
    const sig = base58Decode(signatureB58)
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data
    if (hasSubtleCrypto) {
      const publicKey = await crypto.subtle.importKey(
        'raw',
        pubRaw,
        { name: 'Ed25519' },
        true,
        ['verify']
      )
      return await crypto.subtle.verify('Ed25519', publicKey, sig, buf)
    }
    // noble 路径
    return await noble.verify(sig, buf, pubRaw)
  } catch (e) {
    return false
  }
}

/** 密码哈希（SHA-256 → base64），用于房间密码验证 */
export async function hashPassword(password) {
  const buf = new TextEncoder().encode(password)
  if (hasSubtleCrypto) {
    const hash = await crypto.subtle.digest('SHA-256', buf)
    const bytes = new Uint8Array(hash)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }
  // noble 回退：使用 @noble/hashes 的 sha256
  const bytes = sha256(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/** 验证密码是否匹配哈希 */
export async function verifyPassword(password, hash) {
  if (!hash) return true
  const h = await hashPassword(password)
  return h === hash
}

// ---- localStorage JWK 持久化 ----
function readJWK() {
  try {
    const raw = localStorage.getItem(KEY_STORAGE)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.warn('[nchat] readJWK error:', e)
    return null
  }
}

function writeJWK(jwk) {
  try {
    localStorage.setItem(KEY_STORAGE, JSON.stringify(jwk))
  } catch (e) {
    console.warn('[nchat] 密钥持久化失败：', e)
  }
}

/** 取 PeerID 的短显示形式（前 6 + … + 后 4） */
export function shortPeerId(peerId) {
  if (!peerId) return ''
  if (peerId.length <= 10) return peerId
  return peerId.slice(0, 6) + '…' + peerId.slice(-4)
}

// ---- AES-GCM（Phase 3.4 私聊 E2E 用） ----
/**
 * 生成 AES-GCM 密钥（AES-GCM 256）。
 */
export async function generateAesKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * 导出 AES 密钥为 raw bytes（用于公钥交换后存储会话密钥）。
 */
export async function exportAesKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key)
  return base58Encode(new Uint8Array(raw))
}

/**
 * 从 raw/base58 导入 AES-GCM 密钥。
 */
export async function importAesKey(base58) {
  const raw = base58Decode(base58)
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * AES-GCM 加密文本（返回 iv + ciphertext base58）。
 */
export async function aesGcmEncrypt(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  )
  return {
    iv: base58Encode(iv),
    ciphertext: base58Encode(new Uint8Array(ciphertext))
  }
}

/**
 * AES-GCM 解密文本。
 */
export async function aesGcmDecrypt(key, ivB58, ciphertextB58) {
  const iv = base58Decode(ivB58)
  const ciphertext = base58Decode(ciphertextB58)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  return new TextDecoder().decode(plain)
}
