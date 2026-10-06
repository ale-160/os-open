<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getAllSignalingServers,
  getDiagnostics
} from '../config.js'
import { formatBytes } from '../lib/db.js'
import { exportIdentityBackup, importIdentityBackup, shortPeerId } from '../lib/crypto.js'
import { getMessageLimit, setMessageLimit, trimRoomMessages, getAllRooms } from '../lib/db.js'
import { IconClose } from './icons'
import { useChat } from '../composables/useChat.js'

const emit = defineEmits(['close', 'add-server', 'remove-server', 'switch-server', 'reset-servers'])

const {
  state,
  capabilities,
  roleStats,
  domains,
  NodeRole,
  getCapabilities,
  setCapabilities,
  getRoleStatsInfo,
  getDomainsInfo,
  // Phase 3.5: 通知
  setNotificationsEnabled,
  notificationsEnabled
} = useChat()

const tab = ref('diagnostics') // diagnostics | signaling | network | role | lan | identity
const diagnostics = ref({})
// 存储限制（P1-6）
const msgLimit = ref(getMessageLimit())
async function onMsgLimitChange() {
  const v = Math.max(0, Math.floor(msgLimit.value || 0))
  msgLimit.value = v
  setMessageLimit(v)
  // 立即对本地所有房间执行一次裁剪
  try {
    const rooms = await getAllRooms()
    for (const r of rooms) {
      await trimRoomMessages(r.name, v)
    }
  } catch (e) {
    /* ignore */
  }
}
const servers = ref([])
const currentServer = ref(null)

// 新增信令服务器表单
const newHost = ref('')
const newPort = ref('9000')
const newPath = ref('/')
const newSecure = ref(false)
const newLabel = ref('')
const addError = ref('')

// 节点角色表单（本地编辑，提交时调 setCapabilities）
const roleStorage = ref(capabilities.value?.storage || NodeRole.NORMAL)
const roleRelay = ref(!!capabilities.value?.relay)
const roleAlwaysOn = ref(!!capabilities.value?.alwaysOn)
const roleSaving = ref(false)

onMounted(() => {
  refresh()
  // 同步表单初值
  roleStorage.value = capabilities.value?.storage || NodeRole.NORMAL
  roleRelay.value = !!capabilities.value?.relay
  roleAlwaysOn.value = !!capabilities.value?.alwaysOn
})

function refresh() {
  diagnostics.value = getDiagnostics()
  servers.value = getAllSignalingServers()
  // 当前激活：优先 state.activeServer，否则第一个
}

async function onSaveRole() {
  roleSaving.value = true
  try {
    await setCapabilities({
      storage: roleStorage.value,
      relay: roleRelay.value,
      alwaysOn: roleAlwaysOn.value
    })
  } finally {
    roleSaving.value = false
  }
}

function onNotificationsEnabledChange() {
  setNotificationsEnabled(notificationsEnabled.value)
}

/** 根据角色返回存储上限文本 */
function storageLimitText(role) {
  const map = { [NodeRole.FULL]: '20,000 条', [NodeRole.NORMAL]: '5,000 条', [NodeRole.LIGHT]: '0 条（只读转发）' }
  return map[role] || '—'
}

// ---- 多域状态展示（蛛网核心） ----
/** 域状态文本 */
function domainStatusText(s) {
  switch (s) {
    case 'online':
      return '在线'
    case 'connecting':
      return '连接中…'
    case 'reconnecting':
      return '重连中…'
    case 'offline':
      return '已断开'
    case 'error':
      return '错误'
    default:
      return s || '未知'
  }
}

/** 域状态 CSS class（用于染色） */
function domainStatusClass(s) {
  switch (s) {
    case 'online':
      return 'ok'
    case 'connecting':
    case 'reconnecting':
      return 'warn'
    case 'offline':
    case 'error':
      return 'err'
    default:
      return ''
  }
}

/** 在线域数量统计（拓扑摘要用） */
const onlineDomainCount = computed(() => {
  return (domains.value || []).filter((d) => d.status === 'online').length
})

function serverId(s) {
  return `${s.secure ? 'wss' : 'ws'}://${s.host}:${s.port}${s.path}`
}

function serverLabel(s) {
  return s.label || `${s.host}:${s.port}`
}

function onAdd() {
  addError.value = ''
  const host = newHost.value.trim()
  if (!host) {
    addError.value = '请输入主机名/IP'
    return
  }
  const cfg = {
    host,
    port: Number(newPort.value) || 9000,
    path: newPath.value || '/',
    secure: newSecure.value,
    label: newLabel.value.trim() || `${host}:${newPort.value}`
  }
  const ok = emit('add-server', cfg)
  // 父组件处理，这里仅清空表单
  newHost.value = ''
  newPort.value = '9000'
  newPath.value = '/'
  newSecure.value = false
  newLabel.value = ''
  refresh()
}

function onRemove(s) {
  emit('remove-server', s)
  refresh()
}

function onSwitch(s) {
  emit('switch-server', s)
  refresh()
}

// ---- 身份备份/恢复（P0-3 跨设备迁移） ----
const backupPassword = ref('')
const backupOutput = ref('')
const restoreText = ref('')
const restorePassword = ref('')
const identityMsg = ref('')

async function onBackupIdentity() {
  if (!backupPassword.value) {
    identityMsg.value = '请先输入备份口令'
    return
  }
  const backup = await exportIdentityBackup(backupPassword.value)
  if (!backup) {
    identityMsg.value = '未找到身份信息'
    return
  }
  backupOutput.value = backup
  identityMsg.value = '备份已生成，请复制并妥善保管（连同口令），在新设备上粘贴恢复'
}

async function onCopyBackup() {
  if (!backupOutput.value) return
  await copyToClipboard(backupOutput.value)
  identityMsg.value = '备份已复制'
}

async function onRestoreIdentity() {
  if (!restoreText.value || !restorePassword.value) {
    identityMsg.value = '请粘贴备份并输入口令'
    return
  }
  const ok = await importIdentityBackup(restoreText.value.trim(), restorePassword.value)
  identityMsg.value = ok
    ? '身份恢复成功，刷新页面后生效（身份/昵称/房间将变为备份时的状态）'
    : '恢复失败：备份或口令不正确'
}

function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(text)
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card wide">
      <div class="modal-head">
        <span>设置与诊断</span>
        <button class="btn-mini icon-only-btn" title="关闭" @click="emit('close')">
          <IconClose :size="16" />
        </button>
      </div>

      <div class="settings-tabs">
        <button
          class="tab-btn"
          :class="{ active: tab === 'diagnostics' }"
          @click="tab = 'diagnostics'"
        >
          诊断
        </button>
        <button
          class="tab-btn"
          :class="{ active: tab === 'signaling' }"
          @click="tab = 'signaling'"
        >
          信令服务器
        </button>
        <button
          class="tab-btn"
          :class="{ active: tab === 'network' }"
          @click="tab = 'network'"
        >
          网络
        </button>
        <button
          class="tab-btn"
          :class="{ active: tab === 'role' }"
          @click="tab = 'role'"
        >
          节点角色
        </button>
        <button
          class="tab-btn"
          :class="{ active: tab === 'lan' }"
          @click="tab = 'lan'"
        >
          连接帮助
        </button>
        <button
          class="tab-btn"
          :class="{ active: tab === 'identity' }"
          @click="tab = 'identity'"
        >
          身份
        </button>
      </div>

      <!-- 诊断面板 -->
      <div v-if="tab === 'diagnostics'" class="modal-body">
        <div class="diag-section">
          <h4>存储限制</h4>
          <label class="role-toggle">
            <input type="number" v-model.number="msgLimit" min="0" step="500" @change="onMsgLimitChange" />
            <span>每房间消息条数上限（0 = 不限，超出自动清理最旧）</span>
          </label>
        </div>

        <div class="diag-section">
          <h4>通知</h4>
          <label class="role-toggle">
            <input type="checkbox" v-model="notificationsEnabled" @change="onNotificationsEnabledChange" />
            <span>允许浏览器通知（需授权）</span>
          </label>
          <p class="form-hint" v-if="typeof Notification !== 'undefined' && Notification.permission === 'denied'">
            当前浏览器已禁止通知，请在浏览器地址栏权限中手动允许。
          </p>
        </div>

        <div class="diag-section">
          <h4>浏览器环境</h4>
          <div class="diag-row">
            <span class="diag-label">页面 URL</span>
            <span class="diag-value mono" @click="copyToClipboard(diagnostics.pageUrl)" title="点击复制">
              {{ diagnostics.pageUrl }}
            </span>
          </div>
          <div class="diag-row">
            <span class="diag-label">安全上下文 (HTTPS)</span>
            <span class="diag-value" :class="diagnostics.isSecureContext ? 'ok' : 'warn'">
              {{ diagnostics.isSecureContext ? '✓ 是' : '✗ 否（将使用纯 JS 加密回退）' }}
            </span>
          </div>
          <div class="diag-row">
            <span class="diag-label">原生加密 (crypto.subtle)</span>
            <span class="diag-value" :class="diagnostics.hasSubtleCrypto ? 'ok' : 'warn'">
              {{ diagnostics.hasSubtleCrypto ? '✓ 可用' : '✗ 不可用（需 HTTPS 或 localhost）' }}
            </span>
          </div>
          <div class="diag-row">
            <span class="diag-label">WebRTC</span>
            <span class="diag-value" :class="diagnostics.hasWebRTC ? 'ok' : 'err'">
              {{ diagnostics.hasWebRTC ? '✓ 支持' : '✗ 不支持（无法 P2P 通信）' }}
            </span>
          </div>
          <div class="diag-row">
            <span class="diag-label">localStorage</span>
            <span class="diag-value" :class="diagnostics.hasLocalStorage ? 'ok' : 'err'">
              {{ diagnostics.hasLocalStorage ? '✓ 可用' : '✗ 不可用' }}
            </span>
          </div>
        </div>

        <div class="diag-section">
          <h4>信令连接</h4>
          <div class="diag-row">
            <span class="diag-label">当前服务器</span>
            <span class="diag-value mono">{{ diagnostics.signalingServer }}</span>
          </div>
          <div class="diag-row" v-if="diagnostics.lanHint">
            <span class="diag-label">访问提示</span>
            <span class="diag-value hint">{{ diagnostics.lanHint }}</span>
          </div>
        </div>

        <p class="form-hint" v-if="!diagnostics.isSecureContext">
          ⚠ 非安全上下文（HTTP + 非 localhost）下，浏览器会禁用 crypto.subtle。
          nchat 已自动回退到 @noble/ed25519 纯 JS 实现，可正常生成 ID 与签名。
          若手机仍无法连接，请检查信令服务器是否监听 0.0.0.0 并允许跨域。
        </p>
      </div>

      <!-- 信令服务器管理 -->
      <div v-if="tab === 'signaling'" class="modal-body">
        <p class="form-hint">
          支持配置多个信令服务器，连接时按列表顺序尝试，首个可用即用。
          自建示例：<code>npx peerjs --port 9000 --allow_discovery true</code>
        </p>

        <div class="server-list">
          <div v-for="s in servers" :key="serverId(s)" class="server-item">
            <div class="server-info">
              <span class="server-label">{{ serverLabel(s) }}</span>
              <span class="server-url mono">{{ serverId(s) }}</span>
              <span class="server-tag" v-if="s._isDefault || servers.indexOf(s) === 0">默认</span>
            </div>
            <div class="server-actions">
              <button class="btn-mini" @click="onSwitch(s)">切换</button>
              <button
                class="btn-mini danger"
                v-if="!s._isDefault && servers.indexOf(s) !== 0"
                @click="onRemove(s)"
              >
                删除
              </button>
            </div>
          </div>
        </div>

        <div class="add-server-form">
          <h4>添加自定义服务器</h4>
          <div class="form-row">
            <label>主机名 / IP</label>
            <input class="input" v-model="newHost" placeholder="如 192.168.1.100 或 peer.example.com" />
          </div>
          <div class="form-row-inline">
            <div class="form-row">
              <label>端口</label>
              <input class="input" v-model="newPort" type="number" placeholder="9000" />
            </div>
            <div class="form-row">
              <label>路径</label>
              <input class="input" v-model="newPath" placeholder="/" />
            </div>
          </div>
          <div class="form-row-inline">
            <div class="form-row">
              <label>标签（可选）</label>
              <input class="input" v-model="newLabel" placeholder="如 公司服务器" />
            </div>
            <div class="form-row">
              <label>
                <input type="checkbox" v-model="newSecure" /> 使用安全连接 (WSS)
              </label>
            </div>
          </div>
          <p class="form-hint err" v-if="addError">{{ addError }}</p>
          <button class="btn primary" @click="onAdd">添加</button>
        </div>

        <button class="btn-link danger" @click="emit('reset-servers')">重置为默认</button>
      </div>

      <!-- 多域网络状态（蛛网核心） -->
      <div v-if="tab === 'network'" class="modal-body">
        <p class="form-hint">
          nchat v2 蛛网网络：节点并行挂载全部信令域，任一域断开不影响其他域的通信。
          域 = 信令服务器；路径 = 直连 / 跨域桥接 / 中继转发。
        </p>

        <div class="role-section">
          <h4>域连接状态</h4>
          <div class="diag-row">
            <span class="diag-label">在线域</span>
            <span class="diag-value" :class="onlineDomainCount > 0 ? 'ok' : 'err'">
              {{ onlineDomainCount }} / {{ domains.length }}
            </span>
          </div>

          <div class="domain-list" v-if="domains.length">
            <div
              v-for="d in domains"
              :key="d.key"
              class="domain-item"
              :class="domainStatusClass(d.status)"
            >
              <div class="domain-head">
                <span class="domain-dot" :class="domainStatusClass(d.status)"></span>
                <span class="domain-label">{{ d.label }}</span>
                <span class="domain-status" :class="domainStatusClass(d.status)">
                  {{ domainStatusText(d.status) }}
                </span>
              </div>
              <div class="domain-meta">
                <span class="mono">{{ d.secure ? 'wss' : 'ws' }}://{{ d.host }}:{{ d.port }}{{ d.path }}</span>
              </div>
              <div class="domain-meta" v-if="d.peerJsId">
                <span class="diag-label">PeerJS ID</span>
                <span class="diag-value mono">{{ d.peerJsId }}</span>
              </div>
              <div class="domain-meta" v-if="d.reconnectAttempts > 0">
                <span class="diag-label">重连次数</span>
                <span class="diag-value warn">{{ d.reconnectAttempts }}</span>
              </div>
              <div class="domain-meta" v-if="d.error">
                <span class="diag-label">错误</span>
                <span class="diag-value err">{{ d.error }}</span>
              </div>
            </div>
          </div>
          <p class="form-hint" v-else>
            尚未连接任何域。请在「信令服务器」标签页配置可用服务器，或检查网络后重试。
          </p>
        </div>

        <div class="role-section">
          <h4>当前网络形态</h4>
          <div class="role-stats">
            <span class="stat-chip full">全量 {{ roleStats.full }}</span>
            <span class="stat-chip normal">普通 {{ roleStats.normal }}</span>
            <span class="stat-chip light">轻量 {{ roleStats.light }}</span>
            <span class="stat-chip unknown" v-if="roleStats.unknown">未知 {{ roleStats.unknown }}</span>
            <span class="stat-chip relay">中继 {{ roleStats.relay }}</span>
            <span class="stat-chip alwayson" v-if="roleStats.alwayson">常驻 {{ roleStats.alwaysOn }}</span>
          </div>
          <p class="form-hint">
            域并行 + 异构节点 = 蛛网。任一域/节点下线只减少副本，不断路径。
          </p>
        </div>
      </div>

      <!-- 节点角色（异构网络能力声明） -->
      <div v-if="tab === 'role'" class="modal-body">
        <p class="form-hint">
          nchat v2 采用异构网络：每个节点可声明自己的存储/中继/常驻意愿。
          不同节点组合 = 不同形态的网络，天然"没有两片相同的网络"。
        </p>

        <div class="role-section">
          <h4>存储意愿</h4>
          <div class="role-options">
            <label class="role-option" :class="{ active: roleStorage === NodeRole.FULL }">
              <input type="radio" :value="NodeRole.FULL" v-model="roleStorage" />
              <div class="role-option-body">
                <span class="role-name">全量节点（full）</span>
                <span class="role-desc">自愿持久化更多副本（责任集外最近 10 个 key），适合 NAS/服务器常驻节点</span>
                <span class="role-meta">存储上限：{{ storageLimitText(NodeRole.FULL) }}</span>
              </div>
            </label>
            <label class="role-option" :class="{ active: roleStorage === NodeRole.NORMAL }">
              <input type="radio" :value="NodeRole.NORMAL" v-model="roleStorage" />
              <div class="role-option-body">
                <span class="role-name">普通节点（normal）</span>
                <span class="role-desc">默认。只存自己责任区（k=3 内）</span>
                <span class="role-meta">存储上限：{{ storageLimitText(NodeRole.NORMAL) }}</span>
              </div>
            </label>
            <label class="role-option" :class="{ active: roleStorage === NodeRole.LIGHT }">
              <input type="radio" :value="NodeRole.LIGHT" v-model="roleStorage" />
              <div class="role-option-body">
                <span class="role-name">轻量节点（light）</span>
                <span class="role-desc">几乎不存（移动端/低配额），只做路由与转发</span>
                <span class="role-meta">存储上限：{{ storageLimitText(NodeRole.LIGHT) }}</span>
              </div>
            </label>
          </div>
        </div>

        <div class="role-section">
          <h4>其他能力</h4>
          <label class="role-toggle">
            <input type="checkbox" v-model="roleRelay" />
            <span>愿意中继转发（帮其他节点跨域/跨连接桥接）</span>
          </label>
          <label class="role-toggle">
            <input type="checkbox" v-model="roleAlwaysOn" />
            <span>常驻节点（NAS/服务器，长时间在线）</span>
          </label>
        </div>

        <div class="role-section">
          <h4>当前网络形态</h4>
          <div class="role-stats">
            <span class="stat-chip full">全量 {{ roleStats.full }}</span>
            <span class="stat-chip normal">普通 {{ roleStats.normal }}</span>
            <span class="stat-chip light">轻量 {{ roleStats.light }}</span>
            <span class="stat-chip unknown" v-if="roleStats.unknown">未知 {{ roleStats.unknown }}</span>
            <span class="stat-chip relay">中继 {{ roleStats.relay }}</span>
            <span class="stat-chip alwayson" v-if="roleStats.alwaysOn">常驻 {{ roleStats.alwaysOn }}</span>
          </div>
          <p class="form-hint">
            full 节点越多 → 副本越多 → 韧性越强。网络形态随各节点能力组合而变。
          </p>
        </div>

        <button class="btn primary" :disabled="roleSaving" @click="onSaveRole">
          {{ roleSaving ? '保存中…' : '保存并广播' }}
        </button>
      </div>

      <!-- 身份备份/恢复 -->
      <div v-if="tab === 'identity'" class="modal-body">
        <div class="diag-section">
          <h4>身份（P2P 账号）</h4>
          <p class="form-hint">
            当前身份 ID：<span class="mono">{{ shortPeerId(state.peerId) }}</span>。
            身份即私钥，绑定你的昵称、星标与房间关系。换设备/清缓存后身份会丢失，
            请提前备份。
          </p>
        </div>

        <div class="diag-section">
          <h4>备份身份</h4>
          <label class="form-hint">设置备份口令（用于加密备份，请牢记）</label>
          <input v-model="backupPassword" type="password" class="input" placeholder="备份口令" />
          <div class="btn-row" style="display: flex; gap: var(--sp-2); margin-top: var(--sp-2)">
            <button class="btn" @click="onBackupIdentity">生成备份</button>
            <button class="btn" :disabled="!backupOutput" @click="onCopyBackup">复制备份</button>
          </div>
          <textarea
            v-if="backupOutput"
            v-model="backupOutput"
            class="input mono"
            rows="4"
            readonly
            style="margin-top: var(--sp-2); font-size: var(--fs-11); word-break: break-all"
          ></textarea>
        </div>

        <div class="diag-section">
          <h4>恢复身份</h4>
          <label class="form-hint">粘贴备份文本并输入原口令</label>
          <textarea v-model="restoreText" class="input mono" rows="4" placeholder="备份文本"></textarea>
          <input v-model="restorePassword" type="password" class="input" placeholder="备份口令" style="margin-top: var(--sp-2)" />
          <div class="btn-row" style="margin-top: var(--sp-2)">
            <button class="btn" @click="onRestoreIdentity">恢复身份</button>
          </div>
        </div>

        <p v-if="identityMsg" class="form-hint" style="color: var(--c-warning)">{{ identityMsg }}</p>
      </div>

      <!-- 连接帮助 -->
      <div v-if="tab === 'lan'" class="modal-body">
        <div class="lan-guide">
          <h4>连接帮助</h4>

          <div class="help-section">
            <h5>无法连接信令？</h5>
            <p>本应用依赖信令服务器进行 P2P 握手。如果上方诊断显示「信令未连接」，请尝试：</p>
            <ul>
              <li>切换到「信令服务器」标签页，检查服务器地址是否正确</li>
              <li>添加一个可用的信令服务器（公网或局域网均可）</li>
              <li>信令服务器需支持 WebSocket，地址格式如 <code>ws://host:port</code> 或 <code>wss://host:port</code></li>
            </ul>
          </div>

          <div class="help-section">
            <h5>自建信令服务器</h5>
            <p>如需自建信令服务器（适用于局域网或公网部署）：</p>
            <pre class="code-block">npx peerjs --port 9000 --allow_discovery true</pre>
            <p class="form-hint">
              自建后，在「信令服务器」标签页添加地址即可。
              <code>--allow_discovery true</code> 允许节点互相发现。
            </p>
          </div>

          <div class="help-section">
            <h5>HTTPS 部署注意事项</h5>
            <ul>
              <li>页面为 HTTPS 时，信令也必须走 <code>wss://</code>，否则浏览器会拦截</li>
              <li>HTTP 局域网访问（非 localhost）时 <code>crypto.subtle</code> 不可用，应用自动回退到纯 JS 加密</li>
              <li>建议生产环境使用 HTTPS + WSS，本地开发用 localhost 即可</li>
            </ul>
          </div>

          <div class="help-section">
            <h5>排查清单</h5>
            <ul>
              <li>确认浏览器支持 WebRTC（现代浏览器均支持）</li>
              <li>确认网络未屏蔽 WebSocket 连接</li>
              <li>企业网络可能开启 AP 隔离，导致设备间无法通信</li>
              <li>防火墙需放行信令服务器端口（默认 9000）</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>
