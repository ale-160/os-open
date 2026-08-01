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

/** data URL → blob URL（同步转换；blob URL 可被新标签页打开/原生下载，不受 Chrome data URL 导航限制） */
function dataUrlToBlobUrl(dataUrl) {
  const [meta, b64] = String(dataUrl).split(',')
  const mime = (meta && meta.match(/data:(.*?)(;|$)/)?.[1]) || ''
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

function downloadFile(file) {
  try {
    const url = dataUrlToBlobUrl(file.dataUrl)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  } catch (e) {
    /* ignore */
  }
}

// ===== 图片放大查看（页面内 lightbox，不跳新标签页，避免掉出房间） =====
const lightboxFileId = ref(null)
// 当前 lightbox 展示的文件（响应式：meta 下载完成后自动更新为完整内容）
const lightboxFile = computed(() => {
  if (!lightboxFileId.value) return null
  const m = props.messages.find((x) => x.file?.fileId === lightboxFileId.value)
  return m?.file || null
})
// 正在下载中的 fileId（用于按钮显示"下载中…"）
const downloadingIds = ref(new Set())
// 下载失败标记（lightbox 提示）
const downloadFailed = ref(false)

// 打开放大查看；若为 meta（未下载）自动触发拉取原图
function openLightbox(file) {
  if (!file) return
  lightboxFileId.value = file.fileId || file.id || null
  downloadFailed.value = false
  if (file.isMeta && file.fileId) {
    requestDownload(file)
  }
}

function closeLightbox() {
  lightboxFileId.value = null
}

// 重试下载
function retryDownload() {
  if (!lightboxFile.value) return
  downloadFailed.value = false
  requestDownload(lightboxFile.value)
}

// 触发下载（记录状态；数据到达后卡片自动替换为完整内容）
function requestDownload(file) {
  if (!file?.fileId) return
  downloadingIds.value = new Set(downloadingIds.value).add(file.fileId)
  emit('download', file)
  // 12s 超时：未收到数据则提示失败并复位（发送者可能离线/已刷新页面）
  setTimeout(() => {
    if (!downloadingIds.value.has(file.fileId)) return
    const m = props.messages.find((x) => x.file?.fileId === file.fileId)
    if (m && !m.file?.dataUrl) {
      const next = new Set(downloadingIds.value)
      next.delete(file.fileId)
      downloadingIds.value = next
      if (lightboxFileId.value === file.fileId) {
        downloadFailed.value = true
      }
    }
  }, 12000)
}

// 监听消息变化：下载完成后清理下载中标记；下载失败立即提示
watch(
  () => props.messages,
  (list) => {
    if (!downloadingIds.value.size) return
    const done = new Set()
    for (const id of downloadingIds.value) {
      const m = list.find((x) => x.file?.fileId === id)
      if (m && m.file?.dataUrl) {
        done.add(id)
      } else if (m?.file?.downloadFailed) {
        done.add(id)
        if (lightboxFileId.value === id) {
          downloadFailed.value = true
        }
      }
    }
    if (done.size) {
      const next = new Set(downloadingIds.value)
      for (const id of done) next.delete(id)
      downloadingIds.value = next
    }
  },
  { deep: true }
)

// 打开预览（文本在新标签页打开，媒体走 lightbox/下载）
function openPreview(file) {
  if (isText(file.type)) {
    // 文本类型在新标签页打开
    const w = window.open()
    if (w) {
      w.document.write(`<pre style="white-space:pre-wrap;word-break:break-word;font-family:monospace;padding:16px;">${escapeHtml(file.dataUrl.split(',')[1] ? atob(file.dataUrl.split(',')[1]) : '')}</pre>`)
    }
  } else if (isImage(file.type)) {
    openLightbox(file)
  } else {
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
                  class="file-image-link"
                  title="点击查看（将自动加载原图）"
                  @click.prevent="openLightbox(m.file)"
                >
                  <img
                    :src="m.file.thumbDataUrl"
                    :alt="m.file.name"
                    class="file-image thumb"
                    loading="lazy"
                  />
                </a>
                <!-- 非图片大文件（压缩包/文档等）：保留下载按钮（图片走浏览器原生长按/右键保存） -->
                <button v-else class="btn-mini" @click="downloadFile(m.file)">下载</button>
              </div>
              <!-- 图片预览 -->
              <div v-else-if="isImage(m.file.type)" class="file-image-wrap">
                <a
                  class="file-image-link"
                  title="点击放大查看（长按/右键可保存图片）"
                  @click.prevent="openLightbox(m.file)"
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

    <!-- 图片放大查看 lightbox（页面内模态，不跳新标签页） -->
    <div v-if="lightboxFile" class="lightbox-overlay">
      <div class="lightbox-card">
        <div class="lightbox-head">
          <span class="file-name" :title="lightboxFile.name">{{ lightboxFile.name }}</span>
          <span class="file-size">{{ formatSize(lightboxFile.size) }}</span>
          <button class="btn-mini" @click="closeLightbox">✕</button>
        </div>
        <div class="lightbox-body">
          <!-- 完整原图 -->
          <img
            v-if="lightboxFile.dataUrl"
            :src="lightboxFile.dataUrl"
            :alt="lightboxFile.name"
            class="lightbox-img"
          />
          <!-- 元信息模式：缩略图 + 正在加载原图 -->
          <div v-else-if="lightboxFile.thumbDataUrl" class="lightbox-loading">
            <img :src="lightboxFile.thumbDataUrl" :alt="lightboxFile.name" class="lightbox-thumb" />
            <p v-if="!downloadFailed">正在加载原图…</p>
            <p v-else class="download-fail">⚠ 加载失败：发送者可能已离线或刷新页面</p>
            <button v-if="downloadFailed" class="btn-mini primary" @click="retryDownload">
              重试
            </button>
          </div>
          <div v-else class="lightbox-loading">
            <p v-if="!downloadFailed">正在加载…</p>
            <p v-else class="download-fail">⚠ 加载失败：发送者可能已离线或刷新页面</p>
            <button v-if="downloadFailed" class="btn-mini primary" @click="retryDownload">
              重试
            </button>
          </div>
        </div>
      </div>
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
.file-image-link {
  display: inline-block;
  cursor: pointer;
  line-height: 0;
}
.file-image-link .file-image {
  transition: opacity 0.15s;
}
.file-image-link:hover .file-image {
  opacity: 0.85;
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

/* ===== 图片放大 lightbox ===== */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 120;
  padding: 16px;
  backdrop-filter: blur(4px);
}
.lightbox-card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  max-width: 92vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow);
}
.lightbox-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.lightbox-head .file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 13px;
}
.lightbox-head .btn-mini {
  min-height: 36px;
  min-width: 36px;
}
.lightbox-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background: #000;
}
.lightbox-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  display: block;
}
.lightbox-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  color: var(--text-dim);
}
.lightbox-thumb {
  max-width: 40vw;
  max-height: 50vh;
  object-fit: contain;
  opacity: 0.5;
}
.lightbox-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-top: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.lightbox-foot .btn {
  min-height: 40px;
  padding: 8px 18px;
}
.file-hint {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
