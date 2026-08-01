/**
 * 协议层：消息类型定义、消息构造、签名与校验。
 *
 * 消息格式（JSON over WebRTC DataChannel）：
 * { type, from, to, payload, timestamp, signature, extensions, id }
 *
 * 签名内容：将 message 中除 signature 外的字段按固定顺序拼成字符串后签名。
 */
import { sign, verify } from './crypto.js'

export const MsgType = {
  HELLO: 'hello',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_MESSAGE: 'room_message',
  ROOM_LIST: 'room_list',
  QUERY_ROOMS: 'query_rooms',
  HISTORY_REQUEST: 'history_request',
  HISTORY_RESPONSE: 'history_response',
  HEARTBEAT: 'heartbeat',
  // 高级准入
  JOIN_REQUEST: 'join_request',
  JOIN_APPROVED: 'join_approved',
  JOIN_REJECTED: 'join_rejected',
  // 发言审核
  SPEAK_REQUEST: 'speak_request',
  SPEAK_APPROVED: 'speak_approved',
  // 星标管理：创建者调整成员星标
  SET_STARS: 'set_stars',
  // 邀请
  INVITE: 'invite',
  // 放逐/屏蔽：广播屏蔽规则更新
  BAN_UPDATE: 'ban_update',
  // 文件传输
  FILE_MESSAGE: 'file_message',
  // 大文件：元信息广播（缩略图/大小），完整内容按需拉取
  FILE_META: 'file_meta',
  FILE_REQUEST: 'file_request'
}

// ---- 房间规则 ----
export const AccessRule = {
  OPEN: 'open',
  PASSWORD: 'password',
  APPROVE: 'approve',
  INVITE: 'invite'
}

export const SpeakRule = {
  ALL: 'all',
  WHITELIST: 'whitelist',
  APPROVE: 'approve'
}

export const DEFAULT_RULES = {
  access: AccessRule.OPEN,
  speak: SpeakRule.ALL,
  whitelist: [],
  // 审核/邀请权限的星标阈值：星标 >= 此值的成员可审核加入和邀请
  approveThreshold: 50,
  // 房间默认屏蔽：星标 < 此值的成员发言将被房间内所有人屏蔽（0 表示不屏蔽）
  banBelowStars: 0
}

// 星标常量
export const Stars = {
  CREATOR: 99,       // 创建者默认星标
  DEFAULT: 1,        // 普通成员默认星标
  MIN_INHERIT: 1     // 最低可继承星标
}

/** 待签名内容的固定字段顺序 */
function canonicalString(obj) {
  const keys = ['type', 'from', 'to', 'payload', 'timestamp', 'id', 'extensions']
  const parts = []
  for (const k of keys) {
    const v = obj[k]
    if (v === undefined || v === null) {
      parts.push(k + ':')
    } else if (typeof v === 'object') {
      parts.push(k + ':' + JSON.stringify(v))
    } else {
      parts.push(k + ':' + String(v))
    }
  }
  return parts.join('|')
}

export async function buildMessage({ type, from, to, payload, extensions }, privateKey) {
  const msg = {
    id: genMsgId(from),
    type,
    from,
    to: to || '',
    payload: payload || {},
    timestamp: Date.now(),
    extensions: extensions || {}
  }
  msg.signature = await sign(privateKey, canonicalString(msg))
  return msg
}

export async function verifyMessage(msg) {
  if (!msg || !msg.from || !msg.signature) return false
  const copy = { ...msg }
  const sig = copy.signature
  delete copy.signature
  return verify(msg.from, sig, canonicalString(copy))
}

function genMsgId(from) {
  return (
    from.slice(0, 8) +
    '-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 8)
  )
}
