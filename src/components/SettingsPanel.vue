<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getAllSignalingServers,
  getDiagnostics
} from '../config.js'
import { formatBytes } from '../lib/db.js'

const emit = defineEmits(['close', 'add-server', 'remove-server', 'switch-server', 'reset-servers'])

const tab = ref('diagnostics') // diagnostics | signaling | lan
const diagnostics = ref({})
const servers = ref([])
const currentServer = ref(null)

// 新增信令服务器表单
const newHost = ref('')
const newPort = ref('9000')
const newPath = ref('/')
const newSecure = ref(false)
const newLabel = ref('')
const addError = ref('')

onMounted(() => {
  refresh()
})

function refresh() {
  diagnostics.value = getDiagnostics()
  servers.value = getAllSignalingServers()
  // 当前激活：优先 state.activeServer，否则第一个
}

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
        <button class="btn-mini" @click="emit('close')">✕</button>
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
          :class="{ active: tab === 'lan' }"
          @click="tab = 'lan'"
        >
          连接帮助
        </button>
      </div>

      <!-- 诊断面板 -->
      <div v-if="tab === 'diagnostics'" class="modal-body">
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
