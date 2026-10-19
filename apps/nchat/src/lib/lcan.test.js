import { describe, expect, it } from 'vitest'

import {
  DEFAULT_K,
  bucketFor,
  bytesToBigInt,
  isResponsible,
  keyToHex,
  nearestTo,
  normalizeId,
  responsible,
  sha256Key,
  xorDistance
} from './lcan.js'
import { base58Encode } from './crypto.js'

/** 32 字节确定性 id：字节 i = seed + i（mod 256） */
function det32(seed) {
  return new Uint8Array(32).map((_, i) => (seed + i) % 256)
}

/** 确定性 base58 peerId（32 字节熵，符合节点 ID 契约） */
function peerId(seed) {
  return base58Encode(det32(seed))
}

describe('LCAN 纯函数', () => {
  it('bytesToBigInt：大端解释，空数组为 0n', () => {
    expect(bytesToBigInt(new Uint8Array(32))).toBe(0n)
    expect(bytesToBigInt(new Uint8Array([0, 0, 1]))).toBe(1n)
    expect(bytesToBigInt(new Uint8Array([1, 0]))).toBe(256n)
  })

  it('normalizeId：32 字节原样返回，其余折叠为 sha256', () => {
    const exact = det32(1)
    expect(normalizeId(exact)).toBe(exact)

    const short = new Uint8Array([1, 2, 3])
    const folded = normalizeId(short)
    expect(folded).toHaveLength(32)
    // 确定性：同一输入两次折叠结果一致
    expect(normalizeId(new Uint8Array([1, 2, 3]))).toEqual(folded)

    expect(() => normalizeId(null)).toThrow()
    expect(() => normalizeId(42)).toThrow()
  })

  it('xorDistance：对称、自距为零、异或正确', () => {
    const a = new Uint8Array(32)
    const b = new Uint8Array(32)
    b[0] = 1 // 仅最高位字节不同 → 距离 = 2^248

    expect(xorDistance(a, b)).toBe(1n << 248n)
    expect(xorDistance(b, a)).toBe(xorDistance(a, b))
    expect(xorDistance(a, a)).toBe(0n)

    // 两个不同字节位置：首字节差 1，末字节差 1
    const c = new Uint8Array(32)
    c[0] = 1
    c[31] = 1
    expect(xorDistance(a, c)).toBe((1n << 248n) | 1n)
  })

  it('sha256Key：确定性 + 命名空间隔离 + hex 输出', () => {
    const k1 = sha256Key('room', 'dev')
    expect(k1).toHaveLength(32)
    expect(sha256Key('room', 'dev')).toEqual(k1)
    expect(sha256Key('room', 'dev')).not.toEqual(sha256Key('doc', 'dev'))
    expect(keyToHex(k1)).toMatch(/^[0-9a-f]{64}$/)
    expect(() => sha256Key(null, 'x')).toThrow()
  })

  it('bucketFor：自身为 -1，最高有效位位置', () => {
    expect(bucketFor(0n)).toBe(-1)
    expect(bucketFor(1n)).toBe(0)
    expect(bucketFor(2n)).toBe(1)
    expect(bucketFor(3n)).toBe(1)
    expect(bucketFor(1n << 255n)).toBe(255)
    expect(() => bucketFor(1)).toThrow()
  })

  it('responsible：选出 XOR 距离最近的 k 个并升序排列', () => {
    const key = peerId(100)
    const peers = [peerId(0), peerId(50), peerId(200), peerId(7)]

    const all = responsible(key, peers, peers.length)
    expect(all).toHaveLength(4)
    // 升序
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].dist).toBeLessThanOrEqual(all[i].dist)
    }
    // 距离与 xorDistance 一致
    expect(all[0].dist).toBe(xorDistance(key, all[0].peerId))

    const top = responsible(key, peers, 2)
    expect(top.map((r) => r.peerId)).toEqual(all.slice(0, 2).map((r) => r.peerId))

    // 支持 {peerId} 对象形式；空集合与 k=0 返回空
    expect(responsible(key, [{ peerId: peers[0] }], 3)).toHaveLength(1)
    expect(responsible(key, [], 3)).toEqual([])
    expect(responsible(key, peers, 0)).toEqual([])
    expect(responsible(key, [null, undefined, {}], 3)).toEqual([])
  })

  it('isResponsible 与 nearestTo 语义一致', () => {
    const key = sha256Key('announcement', 'room-1')
    const peers = [peerId(3), peerId(9), peerId(27), peerId(81), peerId(243)]
    const set = responsible(key, peers, DEFAULT_K)
    expect(set).toHaveLength(DEFAULT_K)

    for (const p of peers) {
      expect(isResponsible(key, p, peers, DEFAULT_K)).toBe(set.some((r) => r.peerId === p))
    }
    // 在线列表为 {peerId} 对象形式时同样成立
    expect(isResponsible(key, set[0].peerId, peers.map((p) => ({ peerId: p })), DEFAULT_K)).toBe(true)

    const near = nearestTo(key, peers, 4)
    expect(near).toHaveLength(4)
    // nearestTo(n) 等价于 responsible(k=候选总数) 的前 n 个
    expect(near.map((r) => r.peerId)).toEqual(responsible(key, peers, 4).map((r) => r.peerId))
    expect(nearestTo(key, peers, 0)).toEqual([])
  })
})
