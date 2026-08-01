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
  FILE_REQUEST: 'file_request',
  // 大文件：发送者缓存已失效（如刷新页面），通知请求者
  FILE_UNAVAILABLE: 'file_unavailable',
  // ---- LCAN 多副本分布式存储（蛛网核心） ----
  LCAN_STORE: 'lcan_store', // 饱和写入责任集
  LCAN_ACK: 'lcan_ack', // 写入确认（任一成功即视为存储成功）
  LCAN_GET: 'lcan_get', // 饱和请求（同时发往所有已知副本持有者）
  LCAN_FOUND: 'lcan_found', // 命中返回数据
  LCAN_NOT_FOUND: 'lcan_not_found', // 未命中
  LCAN_HOLDERS: 'lcan_holders', // 副本索引交换（holder 表同步）
  LCAN_UPDATE: 'lcan_update' // 房间内轻量信号（公告/Pin 变更通知）
}

/**
 * 二进制通道消息类型（bin 连接专用，走 PeerJS serialization:'binary'）。
 * bin 通道承载 ArrayBuffer / 大对象，规避 JSON 通道 16KB 上限。
 * 控制消息（hello/heartbeat/join_room 等）仍走 json 连接。
 */
export const BinKind = {
  /** 连接探测（Phase 2.1 能力探测用）：发 N 字节 → 对方回 ACK */
  PROBE: 'probe',
  PROBE_ACK: 'probe_ack',
  /** 文件分片（含 ArrayBuffer） */
  FILE_CHUNK: 'file_chunk',
  /** 文件元信息（bin 版，可带较大缩略图） */
  FILE_META_BIN: 'file_meta_bin',
  /** LCAN 大块数据传输（如云文档快照） */
  LCAN_BLOB: 'lcan_blob'
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

// ---- 节点能力声明（异构网络） ----
/**
 * storage:
 *   - 'full':   全量镜像节点，自愿持久化更多副本（如责任集外最近 10 个 key），适合常驻节点
 *   - 'normal': 默认，只存自己责任区（k=3 内）
 *   - 'light':  轻量节点（移动端/低配额），几乎不存，只做路由与转发
 * relay:    是否愿意中继转发（跨域/跨连接桥接）
 * alwaysOn: 是否常驻（如 NAS/服务器节点）
 * version:  协议版本（异构兼容）
 */
export const NodeRole = {
  FULL: 'full',
  NORMAL: 'normal',
  LIGHT: 'light'
}

export const PROTOCOL_VERSION = '2.0'

export const DEFAULT_CAPABILITIES = {
  storage: NodeRole.NORMAL,
  relay: true,
  alwaysOn: false,
  version: PROTOCOL_VERSION
}

/** 各角色的 LCAN 存储条目上限（LRU 淘汰基线） */
export const STORAGE_LIMITS = {
  [NodeRole.FULL]: 20000,
  [NodeRole.NORMAL]: 5000,
  [NodeRole.LIGHT]: 0
}

/** 校验并归一化 capabilities 对象（容错：缺字段补默认值，非法值回退默认） */
export function normalizeCapabilities(caps) {
  const out = { ...DEFAULT_CAPABILITIES }
  if (caps && typeof caps === 'object') {
    if (caps.storage === NodeRole.FULL || caps.storage === NodeRole.NORMAL || caps.storage === NodeRole.LIGHT) {
      out.storage = caps.storage
    }
    if (typeof caps.relay === 'boolean') out.relay = caps.relay
    if (typeof caps.alwaysOn === 'boolean') out.alwaysOn = caps.alwaysOn
    if (typeof caps.version === 'string') out.version = caps.version
  }
  return out
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
