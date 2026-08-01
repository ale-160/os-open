<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useChat } from '../composables/useChat.js'
import { shortPeerId } from '../lib/crypto.js'

const props = defineProps({
  members: { type: Array, default: () => [] }
})

const {
  state,
  remoteStream,
  startMediaCall,
  answerMediaCall,
  hangupMediaCall
} = useChat()

// 仅开发环境显示测试通话按钮
const isDev = import.meta.env.DEV

// 移动端（≤860px）默认折叠测试面板，点击标题展开，避免占据聊天区高度
const panelCollapsed = ref(false)
const isMobileLayout = typeof window !== 'undefined' && window.innerWidth <= 860
if (isMobileLayout) panelCollapsed.value = true
function togglePanel() {
  panelCollapsed.value = !panelCollapsed.value
}

// 本地媒体流
const localStream = ref(null)
// 通话状态
const isInCall = ref(false)
const currentCallTarget = ref(null)
// 视频预览状态（冷启动前的预览）
const isPreviewing = ref(false)
// 选择的成员
const selectedMember = ref('')
// 错误信息
const callError = ref('')
// 通话浮层形态：'minimized' 小窗 | 'fullscreen' 全屏
const callView = ref('minimized')

function enterFullscreen() {
  callView.value = 'fullscreen'
}

function exitFullscreen() {
  callView.value = 'minimized'
}

// 房间内其他成员
const otherMembers = computed(() => {
  return props.members.filter(m => !m.self)
})

// 本地流是否有视频轨道（纯语音降级时隐藏本地画中画角标）
const hasLocalVideo = computed(() => {
  return !!localStream.value && localStream.value.getVideoTracks().length > 0
})

// 监听远程流：对方挂断（remoteStream 变 null）时自动复位本地通话状态
watch(() => remoteStream.value, (stream) => {
  if (!stream && isInCall.value) {
    // 对方已挂断：停止本地流并退出通话 UI
    stopStream(localStream.value)
    localStream.value = null
    isInCall.value = false
    isPreviewing.value = false
    currentCallTarget.value = null
    callView.value = 'minimized'
  }
}, { flush: 'post' })

// 监听来电
watch(() => state.incomingCall, (call) => {
  if (call) {
    // 自动接受来电（开发测试用）
    // 实际使用中，应提示用户确认
  }
})

// 将 getUserMedia 错误映射为可读提示
function describeMediaError(e) {
  const name = e?.name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return '摄像头/麦克风权限被拒绝，请在浏览器地址栏允许访问后重试'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return '未检测到摄像头或麦克风设备'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '无法启动摄像头：可能被其他应用或标签页占用，请关闭后重试'
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return '摄像头不满足请求参数'
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return '当前环境不支持摄像头/麦克风采集（需要 HTTPS 或 localhost 访问）'
  }
  return e?.message || '未知错误'
}

// 获取媒体流（带降级：视频失败 → 纯语音；音频失败 → 纯视频）
async function getLocalStream(video = true, audio = true) {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    callError.value = '当前环境不支持摄像头/麦克风采集（需要 HTTPS 或 localhost 访问）'
    return null
  }
  // 按优先级尝试：视频+音频 → 仅音频 → 仅视频
  const attempts = []
  if (video && audio) attempts.push({ video: true, audio: true })
  if (audio) attempts.push({ audio: true })
  if (video) attempts.push({ video: true })
  if (!attempts.length) attempts.push({ audio: true })

  let lastErr = null
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (e) {
      lastErr = e
    }
  }
  callError.value = describeMediaError(lastErr)
  return null
}

// 停止媒体流
function stopStream(stream) {
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
  }
}

// 开始视频预览（冷启动）
async function startPreview() {
  callError.value = ''
  const stream = await getLocalStream(true, true)
  if (!stream) return
  localStream.value = stream
  isPreviewing.value = true
}

// 停止预览
function stopPreview() {
  stopStream(localStream.value)
  localStream.value = null
  isPreviewing.value = false
}

// 开始通话（基于已有的预览流）
async function startCall() {
  callError.value = ''
  const member = props.members.find(m => m.peerId === selectedMember.value)
  if (!member) {
    callError.value = '请选择一个成员'
    return
  }
  // 如果还没有本地流，获取一个
  if (!localStream.value) {
    const stream = await getLocalStream(true, true)
    if (!stream) return
    localStream.value = stream
    isPreviewing.value = true
  }
  currentCallTarget.value = member.peerId
  isInCall.value = true

  const ok = await startMediaCall(member.peerId, localStream.value)
  if (!ok) {
    callError.value = '呼叫失败，请检查对方是否在线'
    stopStream(localStream.value)
    localStream.value = null
    isInCall.value = false
    isPreviewing.value = false
    currentCallTarget.value = null
  }
}

// 接收来电
async function answerCall(peerId) {
  callError.value = ''
  const stream = await getLocalStream(true, true)
  if (!stream) return
  localStream.value = stream
  currentCallTarget.value = peerId
  isInCall.value = true

  const ok = await answerMediaCall(peerId, stream)
  if (!ok) {
    callError.value = '回答失败'
    stopStream(stream)
    localStream.value = null
    isInCall.value = false
    currentCallTarget.value = null
  }
}

// 挂断
function hangup() {
  hangupMediaCall(currentCallTarget.value)
  stopStream(localStream.value)
  localStream.value = null
  isInCall.value = false
  isPreviewing.value = false
  currentCallTarget.value = null
  callError.value = ''
  callView.value = 'minimized'
}
</script>

<template>
  <div v-if="isDev">
    <!-- 未通话时的测试面板（嵌入聊天区，不遮挡；移动端默认折叠） -->
    <div v-if="!isInCall" class="call-controls">
      <div class="call-toggle" @click="togglePanel">
        <span class="form-label">测试音视频通话 (开发模式)</span>
        <span class="call-toggle-arrow">{{ panelCollapsed ? '▸' : '▾' }}</span>
      </div>
      <div v-if="!panelCollapsed" class="call-section">
        <div v-if="callError" class="call-error">
          {{ callError }}
        </div>

        <!-- 来电提示 -->
        <div v-if="state.incomingCall" class="incoming-call">
          <div class="call-text">📞 {{ shortPeerId(state.incomingCall.from) }} 请求视频通话</div>
          <button class="btn-mini primary" @click="answerCall(state.incomingCall.from)">
            接听
          </button>
        </div>

        <template v-if="!isPreviewing">
          <select
            v-model="selectedMember"
            class="input"
            :disabled="!otherMembers.length"
          >
            <option value="" disabled>选择呼叫对象</option>
            <option v-for="m in otherMembers" :key="m.peerId" :value="m.peerId">
              {{ m.name || shortPeerId(m.peerId) }} ({{ m.stars || 1 }}★)
            </option>
          </select>
          <div class="preview-row">
            <button
              class="btn primary"
              :disabled="!otherMembers.length"
              @click="startPreview"
            >
              视频预览 (冷启动)
            </button>
          </div>
        </template>

        <!-- 视频冷启动预览 -->
        <template v-else>
          <div class="preview-row">
            <button
              class="btn primary"
              :disabled="!selectedMember"
              @click="startCall"
            >
              开始通话
            </button>
            <button class="btn" @click="stopPreview">
              取消
            </button>
          </div>
        </template>

        <!-- 冷启动本地预览 -->
        <div v-if="isPreviewing && localStream" class="preview-box">
          <video :srcObject="localStream" autoplay muted playsinline class="preview-video" />
        </div>
      </div>
    </div>

    <!-- ===== 通话中：小窗 / 全屏浮层（不遮挡聊天） ===== -->
    <template v-else>
      <!-- 小窗模式：右下角悬浮，点击放大 -->
      <div
        v-if="callView === 'minimized'"
        class="call-mini"
        @click="enterFullscreen"
      >
        <video
          v-if="remoteStream"
          :srcObject="remoteStream"
          autoplay playsinline class="mini-video"
        />
        <div v-else class="mini-placeholder">📹 等待对方视频…</div>
        <!-- 本地画中画角标 -->
        <div v-if="hasLocalVideo" class="mini-local">
          <video :srcObject="localStream" autoplay muted playsinline class="mini-local-video" />
        </div>
        <!-- 挂断（小窗内点击不冒泡到放大） -->
        <button class="mini-hangup" @click.stop="hangup" title="挂断">✕</button>
        <span class="mini-status">通话中 {{ shortPeerId(currentCallTarget) }}</span>
      </div>

      <!-- 全屏模式 -->
      <div v-else class="call-fullscreen">
        <video
          v-if="remoteStream"
          :srcObject="remoteStream"
          autoplay playsinline class="full-video"
        />
        <div v-else class="full-placeholder">📹 等待对方视频…</div>
        <!-- 本地画中画角标 -->
        <div v-if="hasLocalVideo" class="full-local">
          <video :srcObject="localStream" autoplay muted playsinline class="full-local-video" />
        </div>
        <div class="full-controls">
          <button class="btn" @click="exitFullscreen">— 小窗</button>
          <button class="btn danger" @click="hangup">挂断</button>
        </div>
        <div class="full-status">
          通话中 {{ shortPeerId(currentCallTarget) }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.call-controls {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-soft);
}

.call-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
  touch-action: manipulation;
}
.call-toggle-arrow {
  color: var(--text-muted);
  font-size: 12px;
}

.call-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  font-weight: 600;
}

.call-error {
  font-size: 12px;
  color: var(--red);
  padding: 4px 8px;
  background: rgba(248, 81, 73, 0.12);
  border-radius: var(--radius-sm);
}

.incoming-call {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(47, 129, 247, 0.12);
  border-radius: var(--radius-sm);
}

.call-text {
  font-size: 13px;
  color: var(--accent);
  flex: 1;
}

.preview-row {
  display: flex;
  gap: 8px;
}

.preview-row .btn {
  flex: 1;
  min-height: 44px;
  touch-action: manipulation;
}

.preview-box {
  margin-top: 8px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
  background: #000;
  max-width: 100%;
}
.preview-video {
  width: 100%;
  max-height: 240px;
  object-fit: contain;
  display: block;
}

/* ===== 通话中小窗 ===== */
.call-mini {
  position: fixed;
  right: 12px;
  bottom: 12px;
  width: 168px;
  height: 126px;
  background: #000;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  z-index: 90;
  cursor: pointer;
  box-shadow: var(--shadow);
}
.mini-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.mini-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  font-size: 12px;
  background: var(--bg-elev2);
}
.mini-local {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 56px;
  height: 42px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: #000;
}
.mini-local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: scaleX(-1); /* 镜像，接近自拍习惯 */
}
.mini-hangup {
  position: absolute;
  left: 4px;
  top: 4px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(248, 81, 73, 0.9);
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
}
.mini-status {
  position: absolute;
  left: 4px;
  bottom: 4px;
  right: 4px;
  font-size: 10px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 4px;
  padding: 2px 6px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== 通话中全屏 ===== */
.call-fullscreen {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 95;
  display: flex;
  flex-direction: column;
}
.full-video {
  flex: 1;
  width: 100%;
  object-fit: contain;
  display: block;
  min-height: 0;
}
.full-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  font-size: 15px;
}
.full-local {
  position: absolute;
  right: 12px;
  top: 12px;
  width: 108px;
  height: 152px;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--border);
  background: #000;
  box-shadow: var(--shadow);
}
.full-local-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: scaleX(-1);
}
.full-controls {
  position: absolute;
  bottom: 28px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 12px;
}
.full-controls .btn {
  min-height: 48px;
  min-width: 96px;
  font-size: 15px;
  border-radius: 24px;
  touch-action: manipulation;
}
.full-status {
  position: absolute;
  top: 16px;
  left: 0;
  right: 0;
  text-align: center;
  color: #fff;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.5);
  padding: 6px;
  border-radius: 6px;
  width: fit-content;
  margin: 0 auto;
}

/* 移动端全屏本地窗口缩小，避免遮挡过多 */
@media (max-width: 600px) {
  .full-local {
    width: 72px;
    height: 100px;
  }
  .call-mini {
    width: 150px;
    height: 112px;
  }
}
</style>
