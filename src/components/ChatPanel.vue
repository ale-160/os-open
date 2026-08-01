<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import CallControls from './CallControls.vue'

const props = defineProps({
  currentRoom: { type: String, default: '' },
  messages: { type: Array, default: () => [] },
  online: { type: Boolean, default: false },
  stats: { type: Object, default: () => ({ sent: 0, received: 0 }) },
  members: { type: Array, default: () => [] }
})

const emit = defineEmits(['send', 'leave', 'send-file', 'download'])

const draft = ref('')
const bodyRef = ref(null)
const fileInputRef = ref(null)

const inRoom = computed(() => !!props.currentRoom)

async function scrollToBottom() {
  await nextTick()
  if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
}

watch(() => props.messages.length, scrollToBottom)
watch(() => props.currentRoom, scrollToBottom)

function onSend() {
  const text = draft.value.trim()
  if (!text || !inRoom.value) return
  emit('send', text)
  draft.value = ''
}

function onPickFile() {
  if (!inRoom.value) return
  fileInputRef.value?.click()
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    emit('send-file', file)
  }
  // 清空 input，允许重复选择同一文件
  e.target.value = ''
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return hh + ':' + mm
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 判断文件类型是否可预览
const PREVIEWABLE_IMAGE = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp']
const PREVIEWABLE_VIDEO = ['video/mp4', 'video/webm', 'video/ogg']
const PREVIEWABLE_AUDIO = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac']
const PREVIEWABLE_TEXT = ['text/plain', 'text/html', 'text/css', 'text/javascript', 'application/json', 'application/xml']

function isImage(type) {
  return PREVIEWABLE_IMAGE.includes(type)
}
function isVideo(type) {
  return PREVIEWABLE_VIDEO.includes(type)
}
function isAudio(type) {
  return PREVIEWABLE_AUDIO.includes(type)
}
function isText(type) {
  return PREVIEWABLE_TEXT.includes(type) || (type && type.startsWith('text/'))
}

function downloadFile(file) {
  const a = document.createElement('a')
  a.href = file.dataUrl
  a.download = file.name || 'download'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// 打开预览（图片/视频/音频在模态层展示，文本在新标签页打开）
function openPreview(file) {
  if (isText(file.type)) {
    // 文本类型在新标签页打开
    const w = window.open()
    if (w) {
      w.document.write(`<pre style="white-space:pre-wrap;word-break:break-word;font-family:monospace;padding:16px;">${escapeHtml(file.dataUrl.split(',')[1] ? atob(file.dataUrl.split(',')[1]) : '')}</pre>`)
    }
  } else {
    // 媒体类型直接下载或由浏览器处理
    downloadFile(file)
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
</script>

<template>
  <div class="chat-panel">
    <div class="chat-head">
      <template v-if="inRoom">
        <span class="hash">#</span>
        <span class="room-title">{{ currentRoom }}</span>
        <span class="room-stats">
          {{ messages.length }} 条消息
        </span>
        <button class="btn-mini danger" @click="emit('leave')">离开</button>
      </template>
      <template v-else>
        <span class="room-title muted">选择左侧房间开始聊天</span>
      </template>
    </div>

    <!-- 音视频通话测试 (开发模式) — 放在 ChatPanel 头部，在桌面/移动都可见 -->
    <CallControls v-if="members.length > 1" :members="members" />

    <div class="chat-body" ref="bodyRef">
      <div v-if="!inRoom" class="chat-empty">
        <div class="empty-icon">⬡</div>
        <p>欢迎来到 nchat</p>
        <p class="sub">
          这是一个去中心化 P2P 聊天室，没有中心服务器存储你的消息。<br />
          在左侧搜索或创建房间，与同一网络中的节点实时通信。
        </p>
        <p class="sub stat" v-if="stats.received || stats.sent">
          本次会话：已收 {{ stats.received }} / 已发 {{ stats.sent }}
        </p>
      </div>

      <template v-else>
        <div v-if="!messages.length" class="chat-empty small">
          <p>房间内暂无消息</p>
          <p class="sub">在下方输入第一条消息吧</p>
        </div>
        <div v-for="m in messages" :key="m.id" class="msg">
          <div class="msg-time">{{ formatTime(m.timestamp) }}</div>
          <div class="msg-body">
            <span class="msg-name">{{ m.name || m.from.slice(0, 8) }}</span>
            <!-- 文本消息 -->
            <span v-if="m.text" class="msg-text">{{ m.text }}</span>
            <!-- 文件消息 -->
            <div v-else-if="m.file" class="msg-file">
              <!-- 大文件元信息卡片：仅缩略图/大小，点击下载按需拉取完整内容 -->
              <div v-if="m.file.isMeta" class="file-meta-wrap">
                <div class="file-meta">
                  <span class="file-icon">{{ m.file.thumbDataUrl ? '🖼' : (isAudio(m.file.type) ? '🎵' : '📦') }}</span>
                  <span class="file-name" :title="m.file.name">{{ m.file.name }}</span>
                  <span class="file-size">{{ formatSize(m.file.size) }}</span>
                </div>
                <a
                  v-if="m.file.thumbDataUrl"
                  :href="m.file.thumbDataUrl"
                  target="_blank"
                  rel="noopener"
                  class="file-image-link"
                >
                  <img
                    :src="m.file.thumbDataUrl"
                    :alt="m.file.name"
                    class="file-image thumb"
                    loading="lazy"
                  />
                </a>
                <div class="file-meta-hint">
                  大文件（{{ formatSize(m.file.size) }}），点击下载后查看
                </div>
                <button class="btn-mini primary" @click="emit('download', m.file)">
                  ⬇ 下载
                </button>
              </div>
              <!-- 图片预览 -->
              <div v-else-if="isImage(m.file.type)" class="file-image-wrap">
                <a
                  :href="m.file.dataUrl"
                  target="_blank"
                  rel="noopener"
                  class="file-image-link"
                  title="新标签页打开原图"
                >
                  <img
                    :src="m.file.dataUrl"
                    :alt="m.file.name"
                    class="file-image"
                    loading="lazy"
                  />
                </a>
                <div class="file-meta">
                  <span class="file-name" :title="m.file.name">{{ m.file.name }}</span>
                  <span class="file-size">{{ formatSize(m.file.size) }}</span>
                  <a
                    class="btn-mini"
                    :href="m.file.dataUrl"
                    :download="m.file.name"
                  >下载</a>
                </div>
              </div>
              <!-- 视频预览 -->
              <div v-else-if="isVideo(m.file.type)" class="file-video-wrap">
                <video :src="m.file.dataUrl" controls class="file-video"></video>
                <div class="file-meta">
                  <span class="file-name" :title="m.file.name">{{ m.file.name }}</span>
                  <span class="file-size">{{ formatSize(m.file.size) }}</span>
                  <button class="btn-mini" @click="downloadFile(m.file)">下载</button>
                </div>
              </div>
              <!-- 音频预览 -->
              <div v-else-if="isAudio(m.file.type)" class="file-audio-wrap">
                <div class="file-meta">
                  <span class="file-icon">🎵</span>
                  <span class="file-name" :title="m.file.name">{{ m.file.name }}</span>
                  <span class="file-size">{{ formatSize(m.file.size) }}</span>
                </div>
                <audio :src="m.file.dataUrl" controls class="file-audio"></audio>
              </div>
              <!-- 文本预览 -->
              <div v-else-if="isText(m.file.type)" class="file-text-wrap">
                <div class="file-meta">
                  <span class="file-icon">📄</span>
                  <span class="file-name" :title="m.file.name">{{ m.file.name }}</span>
                  <span class="file-size">{{ formatSize(m.file.size) }}</span>
                </div>
                <button class="btn-mini" @click="openPreview(m.file)">预览</button>
                <button class="btn-mini" @click="downloadFile(m.file)">下载</button>
              </div>
              <!-- 其他类型 -->
              <div v-else class="file-other-wrap">
                <div class="file-meta">
                  <span class="file-icon">📎</span>
                  <span class="file-name" :title="m.file.name">{{ m.file.name }}</span>
                  <span class="file-size">{{ formatSize(m.file.size) }}</span>
                </div>
                <button class="btn-mini" @click="downloadFile(m.file)">下载</button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="chat-input" :class="{ disabled: !inRoom }">
      <input
        class="input"
        v-model="draft"
        type="text"
        :placeholder="inRoom ? '输入消息，回车发送…' : '请先加入房间'"
        :disabled="!inRoom"
        @keyup.enter="onSend"
      />
      <button
        class="btn-mini file-btn"
        :disabled="!inRoom"
        @click="onPickFile"
        title="发送文件（≤8MB，支持图片/视频/音频预览）"
      >
        📎
      </button>
      <input
        ref="fileInputRef"
        type="file"
        class="file-input-hidden"
        @change="onFileChange"
      />
      <button class="btn primary" :disabled="!inRoom || !draft.trim()" @click="onSend">
        发送
      </button>
    </div>
  </div>
</template>

<style scoped>
.file-input-hidden {
  display: none;
}
.file-btn {
  font-size: 20px;
  padding: 8px 14px;
  min-height: 44px;
  min-width: 44px;
  touch-action: manipulation;
}
/* 大文件元信息卡片 */
.file-meta-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--bg-elev2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  max-width: 320px;
}
.file-meta-wrap .file-image.thumb {
  max-width: 240px;
  max-height: 160px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.file-meta-hint {
  font-size: 11px;
  color: var(--text-muted);
}
.file-meta-wrap .btn-mini {
  align-self: flex-start;
  min-height: 36px;
  padding: 6px 14px;
  font-size: 13px;
}
</style>
