<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useChat } from '../composables/useChat.js'
import { shortPeerId } from '../lib/crypto.js'

const props = defineProps({
  members: { type: Array, default: () => [] }
})

const {
  state,
  startMediaCall,
  answerMediaCall,
  hangupMediaCall
} = useChat()

// 仅在开发环境显示测试通话按钮
const isDev = import.meta.env.DEV

// 本地媒体流
const localStream = ref(null)
// 通话状态
const isInCall = ref(false)
const currentCallTarget = ref(null)
// 选择的成员
const selectedMember = ref('')
// 错误信息
const callError = ref('')

// 房间内其他成员
const otherMembers = computed(() => {
  return props.members.filter(m => !m.self)
})

// 监听远程流
watch(() => state.value?.remoteStream, (stream) => {
  // 远程流通过 state 管理
}, { flush: 'post' })

// 监听来电
watch(() => state.value?.incomingCall, (call) => {
  if (call) {
    // 自动接受来电（开发测试用）
    // 实际使用中，应提示用户确认
  }
})

// 获取媒体流
async function getLocalStream(video = true, audio = true) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: video,
      audio: audio
    })
    return stream
  } catch (e) {
    callError.value = '无法获取摄像头/麦克风: ' + e.message
    return null
  }
}

// 停止媒体流
function stopStream(stream) {
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
  }
}

// 开始通话
async function startCall() {
  callError.value = ''
  const member = props.members.find(m => m.peerId === selectedMember.value)
  if (!member) {
    callError.value = '请选择一个成员'
    return
  }
  const stream = await getLocalStream(true, true)
  if (!stream) return
  localStream.value = stream
  currentCallTarget.value = member.peerId
  isInCall.value = true

  const ok = await startMediaCall(member.peerId, stream)
  if (!ok) {
    callError.value = '呼叫失败，请检查对方是否在线'
    stopStream(stream)
    localStream.value = null
    isInCall.value = false
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
  currentCallTarget.value = null
  callError.value = ''
}
</script>

<template>
  <div v-if="isDev" class="call-controls">
    <div class="call-section">
      <label class="form-label">测试音视频通话 (开发模式)</label>

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

      <template v-if="!isInCall">
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
        <button
          class="btn primary"
          :disabled="!selectedMember || !otherMembers.length"
          @click="startCall"
        >
          视频通话
        </button>
      </template>

      <template v-else>
        <div class="call-active">
          <div class="call-status">通话中({{ shortPeerId(currentCallTarget) }})</div>
          <button class="btn danger" @click="hangup">
            挂断
          </button>
        </div>
      </template>
    </div>

    <!-- 远程视频预览 -->
    <div v-if="state.remoteStream" class="media-preview remote">
      <video :srcObject="state.remoteStream" autoplay playsinline class="media-video" />
    </div>

    <!-- 本地视频预览 -->
    <div v-if="localStream" class="media-preview local">
      <video :srcObject="localStream" autoplay muted playsinline class="media-video" />
    </div>
  </div>
</template>

<style scoped>
.call-controls {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-soft);
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

.call-active {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.call-status {
  font-size: 13px;
  color: var(--green);
}

.call-active .btn {
  min-height: 44px;
  min-width: 44px;
  touch-action: manipulation;
}

.media-preview {
  position: relative;
  margin-top: 8px;
}

.media-preview.remote {
  max-width: 100%;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
  background: #000;
}

.media-preview.local {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 80px;
  height: 60px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
  background: #000;
  z-index: 10;
}

.media-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
