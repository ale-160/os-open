<script setup>
import { ref, computed, onUnmounted } from 'vue'
import {
  IconEdit,
  IconTrash,
  IconPin,
  IconReact,
  IconDownload,
  IconImage,
  IconVoice,
  IconFile,
  IconVideo,
  IconCheck,
  IconClose,
  IconCopy,
} from '../icons'

const props = defineProps({
  msg: { type: Object, required: true },
  myPeerId: { type: String, default: '' },
  editing: { type: Boolean, default: false },
  draft: { type: String, default: '' },
  highlight: { type: Boolean, default: false },
})

const emit = defineEmits(['edit', 'save-edit', 'cancel-edit', 'recall', 'react', 'download'])

const reactPicker = ref(false)
const presetEmojis = ['👍', '❤️', '😂', '😮', '🎉', '🔥']

// 移动端长按显示操作键（PC 走 CSS :hover）
const actionsVisible = ref(false)
let longPressTimer = null
let longPressFired = false
function onTouchStart() {
  clearTimeout(longPressTimer)
  longPressFired = false
  longPressTimer = setTimeout(() => {
    actionsVisible.value = true
    longPressFired = true
  }, 500)
}
function onTouchEnd() { clearTimeout(longPressTimer) }
function onTouchMove() { clearTimeout(longPressTimer) }
function onClick() {
  // 短按消息任意处：若操作键已显示则收起（长按引发的 click 不收起）
  if (actionsVisible.value && !longPressFired) actionsVisible.value = false
  longPressFired = false
}
onUnmounted(() => clearTimeout(longPressTimer))

const isOwn = computed(() => !!props.msg && props.msg.from === props.myPeerId)
const RECALL_WINDOW = 5 * 60 * 1000
const canRecall = computed(() => isOwn.value && !props.msg.deleted && (Date.now() - (props.msg.timestamp || 0)) <= RECALL_WINDOW)
const reactions = computed(() => props.msg.reactions || {})
const reactionList = computed(() => Object.entries(reactions.value).map(([emoji, ids]) => ({
  emoji,
  count: ids.length,
  mine: ids.includes(props.myPeerId)
})))

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function onEmojiClick(e) {
  const action = reactionList.value.find(r => r.emoji === e)?.mine ? 'remove' : 'add'
  emit('react', { msgId: props.msg.id, emoji: e, action })
  reactPicker.value = false
}

function fileIcon(type) {
  if (type?.startsWith('image/')) return 'IconImage'
  if (type?.startsWith('video/')) return 'IconVideo'
  if (type?.startsWith('audio/')) return 'IconVoice'
  return 'IconFile'
}

function fileSrc(file) {
  return file.blobUrl || file.dataUrl || ''
}

function isImage(type) {
  return ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'].includes(type)
}
function isVideo(type) {
  return ['video/mp4', 'video/webm', 'video/ogg'].includes(type)
}
function isAudio(type) {
  return ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac'].includes(type)
}
function isText(type) {
  return ['text/plain', 'text/html', 'text/css', 'text/javascript', 'application/json', 'application/xml'].includes(type) || (type && type.startsWith('text/'))
}

function dataUrlToBlobUrl(dataUrl) {
  const [meta, b64] = String(dataUrl).split(',')
  const mime = (meta && meta.match(/data:(.*?)(;|$)/)?.[1]) || ''
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

function openPreview(file) {
  if (isText(file.type)) {
    let text = ''
    if (file.blobUrl) {
      fetch(file.blobUrl).then(res => res.text()).then(t => text = t).catch(() => {})
    } else if (file.dataUrl) {
      text = file.dataUrl.split(',')[1] ? atob(file.dataUrl.split(',')[1]) : ''
    }
    const w = window.open()
    if (w) {
      w.document.write('<pre style="white-space:pre-wrap;word-break:break-word;font-family:monospace;padding:16px;">' + escapeHtml(text) + '</pre>')
    }
  } else if (isImage(file.type)) {
    emit('download', file)
  } else {
    downloadFile(file)
  }
}

function downloadFile(file) {
  try {
    const url = file.blobUrl || dataUrlToBlobUrl(file.dataUrl)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    if (!file.blobUrl) setTimeout(() => URL.revokeObjectURL(url), 30000)
  } catch (e) {
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
}
</script>

<template>
  <div
    :id="msg.id"
    class="message"
    :class="{
      own: isOwn,
      deleted: msg.deleted,
      editing: editing,
      'has-file': !!msg.file,
      'has-reactions': reactionList.length,
      highlight,
      pinned: msg.pinned,
      'actions-visible': actionsVisible
    }"
    data-msg-id="msg.id"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
    @touchmove="onTouchMove"
    @click="onClick"
  >
    <div class="msg-header">
      <span class="msg-name" v-if="!isOwn">{{ msg.name || msg.from.slice(0, 8) }}</span>
      <span class="msg-time">{{ formatTime(msg.timestamp) }}</span>
      <span v-if="msg.status" class="msg-status">{{ msg.status }}</span>
    </div>

    <div class="msg-body">
      <!-- 编辑态 -->
      <input
        v-if="editing"
        class="edit-input"
        :value="draft"
        @input="$emit('save-edit', { msg, text: $event.target.value })"
        @blur="$emit('cancel-edit')"
        @keydown.enter="$emit('save-edit', { msg, text: $event.target.value })"
        @keydown.esc="$emit('cancel-edit')"
        autofocus
      />

      <!-- 文本 -->
      <div v-else-if="msg.text" class="msg-text" @dblclick="isOwn && !msg.deleted && $emit('edit', msg)">{{ msg.text }}</div>

      <!-- 文件 -->
      <div v-else-if="msg.file" class="msg-file">
        <div v-if="msg.file.isMeta" class="file-meta-wrap">
          <div class="file-meta">
            <span class="file-icon">
              <component :is="fileIcon(msg.file.type)" :size="16" />
            </span>
            <span class="file-name" :title="msg.file.name">{{ msg.file.name }}</span>
            <span class="file-size">{{ formatSize(msg.file.size) }}</span>
          </div>
          <a
            v-if="msg.file.thumbDataUrl"
            class="file-image-link"
            title="点击查看（将自动加载原图）"
            @click.prevent="$emit('download', msg.file)"
          >
            <img :src="msg.file.thumbDataUrl" :alt="msg.file.name" class="file-image thumb" loading="lazy" />
          </a>
          <button
            v-else-if="!msg.file.downloadPending"
            class="btn-mini icon-only-btn"
            title="下载"
            @click="$emit('download', msg.file)"
          >
            <IconDownload :size="16" />
          </button>
          <span v-else class="file-downloading" title="正在拉取文件…">下载中…</span>
        </div>
        <div v-else-if="isImage(msg.file.type)" class="file-image-wrap">
          <a
            class="file-image-link"
            title="点击放大查看（长按/右键可保存图片）"
            @click.prevent="$emit('download', msg.file)"
          >
            <img :src="fileSrc(msg.file)" :alt="msg.file.name" class="file-image" loading="lazy" />
          </a>
          <div class="file-meta">
            <span class="file-name" :title="msg.file.name">{{ msg.file.name }}</span>
            <span class="file-size">{{ formatSize(msg.file.size) }}</span>
          </div>
        </div>
        <div v-else-if="isVideo(msg.file.type)" class="file-video-wrap">
          <video :src="fileSrc(msg.file)" controls class="file-video"></video>
          <div class="file-meta">
            <span class="file-name" :title="msg.file.name">{{ msg.file.name }}</span>
            <span class="file-size">{{ formatSize(msg.file.size) }}</span>
            <button class="btn-mini icon-only-btn" title="下载" @click="downloadFile(msg.file)">
              <IconDownload :size="16" />
            </button>
          </div>
        </div>
        <div v-else-if="isAudio(msg.file.type)" class="file-audio-wrap">
          <div class="file-meta">
            <span class="file-icon"><IconVoice :size="16" /></span>
            <span class="file-name" :title="msg.file.name">{{ msg.file.name }}</span>
            <span class="file-size">{{ formatSize(msg.file.size) }}</span>
          </div>
          <audio :src="fileSrc(msg.file)" controls class="file-audio"></audio>
        </div>
        <div v-else-if="isText(msg.file.type)" class="file-text-wrap">
          <div class="file-meta">
            <span class="file-icon"><IconFile :size="16" /></span>
            <span class="file-name" :title="msg.file.name">{{ msg.file.name }}</span>
            <span class="file-size">{{ formatSize(msg.file.size) }}</span>
          </div>
          <button class="btn-mini icon-only-btn" title="预览" @click="openPreview(msg.file)">
            <IconFile :size="16" />
          </button>
          <button class="btn-mini icon-only-btn" title="下载" @click="downloadFile(msg.file)">
            <IconDownload :size="16" />
          </button>
        </div>
        <div v-else class="file-other-wrap">
          <div class="file-meta">
            <span class="file-icon"><IconFile :size="16" /></span>
            <span class="file-name" :title="msg.file.name">{{ msg.file.name }}</span>
            <span class="file-size">{{ formatSize(msg.file.size) }}</span>
          </div>
          <button class="btn-mini icon-only-btn" title="下载" @click="downloadFile(msg.file)">
            <IconDownload :size="16" />
          </button>
        </div>
      </div>

      <!-- 撤回/删除占位 -->
      <div v-else-if="msg.deleted" class="msg-recalled">
        <IconTrash :size="12" />
        <span>消息已撤回</span>
      </div>
    </div>

    <!-- 底部：回应徽章常显；操作键 PC 悬停 / 移动端长按显示 -->
    <div class="msg-footer" @click.stop>
      <div class="reactions" v-if="reactionList.length">
        <span
          v-for="r in reactionList"
          :key="r.emoji"
          class="reaction-badge"
          :class="{ mine: r.mine }"
          @click="onEmojiClick(r.emoji)"
        >{{ r.emoji }} {{ r.count }}</span>
      </div>

      <div class="msg-actions-bar">
        <button
          v-if="msg.pinned"
          class="icon-btn-mini"
          @click="$emit('recall', { type: 'unpin', msg })"
          title="取消置顶"
        >
          <IconPin :size="14" class="filled" />
        </button>
        <button
          v-else
          class="icon-btn-mini"
          @click="$emit('recall', { type: 'pin', msg })"
          title="置顶"
        >
          <IconPin :size="14" />
        </button>

        <div class="react-picker" v-if="reactPicker">
          <button
            v-for="e in presetEmojis"
            :key="e"
            class="emoji-btn"
            @click="onEmojiClick(e)"
          >{{ e }}</button>
        </div>
        <button class="icon-btn-mini" @click="reactPicker = !reactPicker" title="回应">
          <IconReact :size="14" />
        </button>

        <button v-if="isOwn && !msg.deleted" class="icon-btn-mini" @click="$emit('edit', msg)" title="编辑">
          <IconEdit :size="14" />
        </button>
        <button
          v-if="canRecall"
          class="icon-btn-mini danger"
          @click="$emit('recall', { type: 'delete', msg })"
          title="撤回"
        >
          <IconTrash :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-lg);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  max-width: 75%;
  align-self: flex-start;
  box-shadow: var(--shadow-1);
  transition: background var(--t-fast), border-color var(--t-fast), box-shadow var(--t-fast);
}
.message:hover {
  box-shadow: var(--shadow-2);
}
.message.own {
  align-self: flex-end;
  background: linear-gradient(135deg, rgba(79,140,255,0.18), rgba(79,140,255,0.06));
  border-color: rgba(79,140,255,0.25);
}
.message.highlight {
  animation: pin-highlight 2s ease-out;
}
@keyframes pin-highlight {
  0% { background: var(--c-warning-soft); }
  100% { background: inherit; }
}
.message.pinned {
  border-left: 3px solid var(--c-warning);
  background: var(--bg-elev2);
}
.message.deleted {
  opacity: 0.5;
}
.msg-header {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-11);
  color: var(--text-muted);
}
.msg-time { white-space: nowrap; }
.msg-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.edit-input {
  padding: var(--sp-2);
  border-radius: var(--r-sm);
  border: 1px solid var(--accent);
  background: var(--bg-input);
  color: var(--text);
  font-size: var(--fs-13);
  width: 100%;
}
.msg-text {
  font-size: var(--fs-13);
  line-height: var(--lh-normal);
  word-break: break-word;
}
.msg-file {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.file-meta-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  background: var(--bg-elev2);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  max-width: 320px;
}
.file-image-link {
  display: inline-block;
  cursor: pointer;
  line-height: 0;
}
.file-image-link .file-image { transition: opacity var(--t-fast); }
.file-image-link:hover .file-image { opacity: 0.85; }
.file-image.thumb {
  max-width: 240px;
  max-height: 160px;
  border-radius: var(--r-sm);
  cursor: pointer;
}
.file-meta { display: flex; align-items: center; gap: var(--sp-2); }
.file-icon { color: var(--accent); flex-shrink: 0; }
.file-name { font-size: var(--fs-12); font-weight: var(--fw-medium); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-size { font-size: var(--fs-11); color: var(--text-muted); }
.file-downloading { align-self: flex-start; padding: var(--sp-2) var(--sp-3); font-size: var(--fs-12); color: var(--text-muted); }
.file-image-wrap, .file-video-wrap, .file-audio-wrap, .file-text-wrap, .file-other-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-2);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  max-width: 320px;
}
.file-image-link .file-image { max-width: 100%; max-height: 40vh; object-fit: contain; border-radius: var(--r-sm); }
.file-video { max-width: 100%; max-height: 50vh; border-radius: var(--r-sm); }
.file-audio { width: 100%; }
.msg-recalled {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-13);
  color: var(--text-muted);
  font-style: italic;
}
.msg-footer {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: 2px;
}
/* 操作键：默认隐藏，PC 悬停 / 移动端长按显示（浮动于气泡右上角，不撑高气泡） */
.msg-actions-bar {
  position: absolute;
  top: -16px;
  right: -8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity var(--t-fast), transform var(--t-fast);
  z-index: 2;
}
@media (hover: hover) {
  .message:hover .msg-actions-bar {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }
}
@media (hover: none) {
  /* 移动端：长按由 JS 控制，阻止系统菜单干扰 */
  .message {
    -webkit-touch-callout: none;
    user-select: none;
  }
}
.message.actions-visible .msg-actions-bar {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}
.react-picker { display: flex; gap: 4px; padding: 2px; background: var(--bg-input); border-radius: var(--r-sm); }
.emoji-btn { font-size: 16px; line-height: 1; padding: 4px 8px; border-radius: var(--r-sm); background: transparent; border: none; cursor: pointer; }
.emoji-btn:hover { background: var(--bg-hover); }
.reactions { display: flex; gap: 4px; flex-wrap: wrap; }
.reaction-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--r-full);
  background: var(--bg-input);
  font-size: var(--fs-11);
  color: var(--text);
  cursor: pointer;
  transition: background var(--t-fast);
}
.reaction-badge.mine { background: var(--c-primary-soft); color: var(--c-primary); }
.reaction-badge:hover { background: var(--bg-hover); }
.icon-btn-mini {
  width: 24px; height: 24px;
  border-radius: var(--r-sm);
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-elev2); border: 1px solid var(--border);
  color: var(--text-dim);
  transition: background var(--t-fast), color var(--t-fast);
}
.icon-btn-mini:hover { background: var(--bg-hover); color: var(--text); }
.icon-btn-mini.danger:hover { background: var(--c-danger-soft); color: var(--c-danger); border-color: var(--c-danger); }
.icon-btn-mini .filled { fill: currentColor; }
</style>