import { describe, expect, it } from 'vitest'
import * as noble from '@noble/ed25519'

import {
  AccessRule,
  DEFAULT_CAPABILITIES,
  MsgType,
  NodeRole,
  STORAGE_LIMITS,
  buildMessage,
  normalizeCapabilities,
  verifyMessage
} from './protocol.js'
import { base58Encode, sign, verify } from './crypto.js'

// crypto.js 模块加载时已为 noble 配置 sha512（同步+异步），node 环境走 noble 路径
const privRaw = noble.utils.randomSecretKey()
const pubRaw = noble.getPublicKey(privRaw)
const peerId = base58Encode(pubRaw)

describe('协议消息构造与签名', () => {
  it('buildMessage：字段齐全、签名可验证', async () => {
    const msg = await buildMessage(
      { type: MsgType.ROOM_MESSAGE, from: peerId, to: 'dev', payload: { room: 'dev', text: 'hello' } },
      privRaw
    )
    expect(msg.id).toBeTruthy()
    expect(msg.timestamp).toBeGreaterThan(0)
    expect(msg.extensions).toEqual({})
    expect(msg.to).toBe('dev')
    expect(typeof msg.signature).toBe('string')
    await expect(verifyMessage(msg)).resolves.toBe(true)
  })

  it('verifyMessage：篡改任何被签名字段后校验失败', async () => {
    const msg = await buildMessage(
      { type: MsgType.ROOM_MESSAGE, from: peerId, payload: { room: 'dev', text: 'secret' } },
      privRaw
    )

    const tamperedText = { ...msg, payload: { room: 'dev', text: 'forged' } }
    await expect(verifyMessage(tamperedText)).resolves.toBe(false)

    const tamperedFrom = { ...msg, from: base58Encode(noble.getPublicKey(noble.utils.randomSecretKey())) }
    await expect(verifyMessage(tamperedFrom)).resolves.toBe(false)

    const noSig = { ...msg }
    delete noSig.signature
    await expect(verifyMessage(noSig)).resolves.toBe(false)
    await expect(verifyMessage(null)).resolves.toBe(false)
  })

  it('verify：数据或公钥不匹配返回 false（不抛错）', async () => {
    const sig = await sign(privRaw, 'hello')
    await expect(verify(peerId, sig, 'hello')).resolves.toBe(true)
    await expect(verify(peerId, sig, 'hello!')).resolves.toBe(false)
    await expect(verify('invalid-base58!!', sig, 'hello')).resolves.toBe(false)
  })
})

describe('能力声明归一化', () => {
  it('normalizeCapabilities：缺字段补默认，非法值回退', () => {
    expect(normalizeCapabilities(null)).toEqual(DEFAULT_CAPABILITIES)
    expect(normalizeCapabilities(undefined)).toEqual(DEFAULT_CAPABILITIES)
    expect(
      normalizeCapabilities({ storage: NodeRole.LIGHT, relay: false, alwaysOn: true, version: '9.9' })
    ).toEqual({ storage: NodeRole.LIGHT, relay: false, alwaysOn: true, version: '9.9' })
    const out = normalizeCapabilities({ storage: 'bogus', relay: 'yes' })
    expect(out.storage).toBe(DEFAULT_CAPABILITIES.storage)
    expect(out.relay).toBe(DEFAULT_CAPABILITIES.relay)
  })

  it('角色存储上限：light 节点不参与存储', () => {
    expect(STORAGE_LIMITS[NodeRole.LIGHT]).toBe(0)
    expect(STORAGE_LIMITS[NodeRole.NORMAL]).toBeGreaterThan(0)
    expect(STORAGE_LIMITS[NodeRole.FULL]).toBeGreaterThan(STORAGE_LIMITS[NodeRole.NORMAL])
  })

  it('准入与发言规则常量齐备', () => {
    expect(Object.values(AccessRule)).toEqual(['open', 'password', 'approve', 'invite'])
    expect(MsgType.ROOM_MESSAGE).toBe('room_message')
  })
})
