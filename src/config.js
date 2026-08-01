/**
 * nchat 全局配置
 *
 * 信令服务器（PeerJS Server）：
 *  - 支持多个信令服务器，按顺序尝试连接，首个成功即用
 *  - 默认跟随页面 host:port（手机访问 http://电脑IP:5173 时，信令自动指向 电脑IP:5173，由 vite 代理到 9000）
 *  - 用户可在设置面板中增删自定义信令服务器
 *    → 自建示例：npx peerjs --port 9000 --allow_discovery true
 *    → 或部署到公网：peers/peerjs-server
 *  - 配置存储在 localStorage('nchat:signaling:servers') 与 ('nchat:signaling:active')
 */

const SERVERS_KEY = 'nchat:signaling:servers'
const ACTIVE_KEY = 'nchat:signaling:active'
// 兼容旧版单服务器配置
const LEGACY_KEY = 'nchat:signaling'

function defaultSignaling() {
  if (typeof window === 'undefined') {
    return { host: 'localhost', port: 9000, path: '/', secure: false, key: 'peerjs' }
  }
  const loc = window.location
  // 信令服务器跟随页面 host:port
  // 开发模式：vite 代理 /peerjs → localhost:9000，浏览器只需连页面端口
  // 生产模式：需在反向代理（nginx 等）中配置 /peerjs 转发，或在设置中指定信令服务器
  const host = loc.hostname || 'localhost'
  const secure = loc.protocol === 'https:'
  const port = loc.port ? Number(loc.port) : secure ? 443 : 80
  return {
    host,
    port,
    path: '/',
    secure,
    key: 'peerjs',
    label: `自动（${host}:${port}）`
  }
}

/** 读取所有信令服务器列表（含默认） */
export function getAllSignalingServers() {
  let custom = []
  try {
    const raw = localStorage.getItem(SERVERS_KEY)
    if (raw) custom = JSON.parse(raw)
  } catch {
    custom = []
  }
  // 兼容旧版单服务器配置
  if (custom.length === 0) {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        const parsed = JSON.parse(legacy)
        if (parsed && parsed.host) {
          custom = [
            {
              ...parsed,
              label: parsed.label || `自定义（${parsed.host}:${parsed.port}）`
            }
          ]
        }
      }
    } catch {
      /* ignore */
    }
  }
  const def = defaultSignaling()
  def._isDefault = true
  return [def, ...custom]
}

/** 当前激活的信令服务器配置 */
export function getSignaling() {
  const servers = getAllSignalingServers()
  let activeId = null
  try {
    activeId = localStorage.getItem(ACTIVE_KEY)
  } catch {
    /* ignore */
  }
  if (activeId) {
    const found = servers.find((s) => serverId(s) === activeId)
    if (found) return found
  }
  return servers[0]
}

/** 设置当前激活的信令服务器 */
export function setActiveSignalingServer(server) {
  try {
    localStorage.setItem(ACTIVE_KEY, serverId(server))
  } catch (e) {
    console.warn('[nchat] 切换信令服务器失败：', e)
  }
}

/** 添加自定义信令服务器 */
export function addSignalingServer(cfg) {
  const custom = getAllSignalingServers().filter((s) => !s._isDefault)
  const entry = {
    host: cfg.host,
    port: Number(cfg.port) || 9000,
    path: cfg.path || '/',
    secure: !!cfg.secure,
    key: cfg.key || 'peerjs',
    label: cfg.label || `自定义（${cfg.host}:${cfg.port}）`
  }
  // 去重（按 host+port+path）
  const exists = custom.find(
    (s) => s.host === entry.host && s.port === entry.port && s.path === entry.path
  )
  if (exists) return false
  custom.push(entry)
  try {
    localStorage.setItem(SERVERS_KEY, JSON.stringify(custom))
  } catch (e) {
    console.warn('[nchat] 保存信令服务器失败：', e)
  }
  return true
}

/** 移除自定义信令服务器 */
export function removeSignalingServer(server) {
  const id = serverId(server)
  const custom = getAllSignalingServers().filter(
    (s) => !s._isDefault && serverId(s) !== id
  )
  try {
    localStorage.setItem(SERVERS_KEY, JSON.stringify(custom))
    // 若移除的是当前激活项，回到默认
    if (localStorage.getItem(ACTIVE_KEY) === id) {
      localStorage.removeItem(ACTIVE_KEY)
    }
  } catch (e) {
    console.warn('[nchat] 移除信令服务器失败：', e)
  }
}

/** 重置为默认（清空所有自定义） */
export function resetSignaling() {
  try {
    localStorage.removeItem(SERVERS_KEY)
    localStorage.removeItem(ACTIVE_KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
}

function serverId(s) {
  return `${s.secure ? 'wss' : 'ws'}://${s.host}:${s.port}${s.path}`
}

/** 诊断信息：浏览器环境与连接能力 */
export function getDiagnostics() {
  const info = {
    pageUrl: '',
    pageHost: '',
    isSecureContext: false,
    hasSubtleCrypto: false,
    hasWebRTC: false,
    hasLocalStorage: false,
    signalingServer: '',
    signalingReachable: null,
    lanHint: ''
  }
  if (typeof window === 'undefined') return info
  info.pageUrl = window.location.href
  info.pageHost = window.location.host
  info.isSecureContext = window.isSecureContext
  info.hasSubtleCrypto =
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.generateKey === 'function'
  info.hasWebRTC =
    typeof RTCPeerConnection !== 'undefined' || typeof webkitRTCPeerConnection !== 'undefined'
  try {
    info.hasLocalStorage = typeof localStorage !== 'undefined' && !!localStorage.setItem
  } catch {
    info.hasLocalStorage = false
  }
  const sig = getSignaling()
  info.signalingServer = `${sig.secure ? 'wss' : 'ws'}://${sig.host}:${sig.port}${sig.path}`
  // 访问提示
  const host = window.location.hostname
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    info.lanHint = `当前通过 ${host} 访问，信令服务器：${sig.host}:${sig.port}`
  } else {
    info.lanHint = '本机开发模式，信令服务器：localhost:' + sig.port
  }
  return info
}

export const CONFIG = {
  // 信令服务器（仅用于 WebRTC 握手，不参与数据传输）
  // 动态计算：默认跟随页面 host，可在 UI 中自定义
  get SIGNALING_SERVER() {
    return getSignaling()
  },

  // 心跳间隔（毫秒）
  HEARTBEAT_INTERVAL: 3000,
  // 心跳超时：超过该时长未收到对端任何消息则视为不稳定
  HEARTBEAT_UNSTABLE: 5000,
  // 离线判定：超过该时长未收到对端任何消息则视为离线并移除
  HEARTBEAT_OFFLINE: 15000,

  // 房间发现：拉取 peer 列表的间隔
  DISCOVERY_INTERVAL: 8000,
  // 单次连接的 peer 上限（避免洪水连接）
  MAX_PEERS: 30,

  // 消息历史：每个房间本地最多缓存条数
  HISTORY_LIMIT: 500,
  // 历史请求时一次拉取的最大条数
  HISTORY_FETCH_BATCH: 100,

  // 房间别名：每个房间最多声明的别名数
  MAX_ALIASES: 5,

  // 房间列表分页：单页显示数量
  ROOM_PAGE_SIZE: 30
}
