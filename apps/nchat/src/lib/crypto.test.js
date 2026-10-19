import { describe, expect, it } from 'vitest'
import * as noble from '@noble/ed25519'

import {
  base58Decode,
  base58Encode,
  hashPassword,
  shortPeerId,
  sha256Hex,
  sign,
  verify,
  verifyPassword
} from './crypto.js'

describe('Base58 编码', () => {
  it('编码→解码往返一致（含前导零）', () => {
    const roundtrip = (bytes) => expect(base58Decode(base58Encode(bytes))).toEqual(bytes)
    roundtrip(new Uint8Array(32).map((_, i) => i))
    roundtrip(new Uint8Array([0, 0, 0, 255, 0, 1]))
    roundtrip(new Uint8Array(0))
    roundtrip(crypto.getRandomValues(new Uint8Array(64)))
  })

  it('已知向量：前导零映射为字母 1', () => {
    expect(base58Encode(new Uint8Array([0, 0, 1]))).toBe('112')
    expect(base58Encode(new Uint8Array([0]))).toBe('1')
    expect(base58Decode('1')).toEqual(new Uint8Array([0]))
  })

  it('解码非法字符抛错', () => {
    expect(() => base58Decode('0OIl')).toThrow(/非法字符/)
  })
})

describe('SHA-256 / 短 ID', () => {
  it('sha256Hex 已知向量（"abc"）', () => {
    const bytes = new TextEncoder().encode('abc')
    expect(sha256Hex(bytes)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  it('shortPeerId：前 6 + … + 后 4，短 ID 原样', () => {
    expect(shortPeerId('')).toBe('')
    expect(shortPeerId('1234567890')).toBe('1234567890')
    expect(shortPeerId('abcdefghijk')).toBe('abcdef…hijk')
  })
})

describe('Ed25519 签名/验签（noble 路径，node 环境）', () => {
  const priv = noble.utils.randomSecretKey()
  const peerId = base58Encode(noble.getPublicKey(priv))

  it('签名字符串消息并可验证；换数据/换公钥失败', async () => {
    const sig = await sign(priv, 'nchat')
    expect(await verify(peerId, sig, 'nchat')).toBe(true)
    expect(await verify(peerId, sig, 'nchat2')).toBe(false)
    const other = base58Encode(noble.getPublicKey(noble.utils.randomSecretKey()))
    expect(await verify(other, sig, 'nchat')).toBe(false)
  })

  it('签名二进制数据', async () => {
    const data = crypto.getRandomValues(new Uint8Array(100))
    const sig = await sign(priv, data)
    expect(await verify(peerId, sig, data)).toBe(true)
  })
})

describe('房间密码哈希', () => {
  it('hashPassword 稳定且 verifyPassword 匹配判定', async () => {
    const h1 = await hashPassword('room-secret')
    expect(await hashPassword('room-secret')).toBe(h1)
    expect(await hashPassword('room-secret2')).not.toBe(h1)
    expect(await verifyPassword('room-secret', h1)).toBe(true)
    expect(await verifyPassword('wrong', h1)).toBe(false)
    // 无哈希（开放房间）视为通过
    expect(await verifyPassword('anything', '')).toBe(true)
  })
})
