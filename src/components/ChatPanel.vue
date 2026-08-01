<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import CallControls from './CallControls.vue'
import DocPanel from './DocPanel.vue'
import {
  IconBack,
  IconLeave,
  IconChat,
  IconFile,
  IconImage,
  IconVoice,
  IconDoc,
  IconDownload,
  IconSend,
  IconClose,
  IconAnnounce,
  IconEdit,
  IconPin,
  IconTrash,
  IconReact
} from './icons'

const props = defineProps({
  currentRoom: { type: String, default: '' },
  messages: { type: Array, default: () => [] },
  online: { type: Boolean, default: false },
  stats: { type: Object, default: () => ({ sent: 0, received: 0 }) },
  members: { type: Array, default: () => [] },
  fileProgress: { type: Map, default: () => new Map() },
  announcement: { type: Object, default: null },
  canSetAnnouncement: { type: Boolean, default: false },
  pinnedMsgIds: { type: Array, default: () => [] },
  // Phase 2.4: 云文档
  docs: { type: Array, default: () => [] },
  docConflicts: { type: Map, default: () => new Map() },
  // Phase 2.5: 从搜索结果跳转定位的消息 ID
  locateMsgId: { type: String, default: '' },
  // Phase 3.1: 当前用户 peerId（用于判断"我的消息"以显示编辑/撤回）
  myPeerId: { type: String, default: '' }
})

const emit = defineEmits([
  'send', 'leave', 'back', 'send-file', 'download',
  'set-announcement', 'toggle-pin',
  // Phase 2.4: 云文档
  'create-doc', 'update-doc', 'rename-doc', 'delete-doc',
  'resolve-conflict-remote', 'resolve-conflict-local',
  // Phase 2.5: 定位完成通知（父组件清除 locateMsgId）
  'located',
  // Phase 3.1: 消息编辑 / 撤回 / 回应
  'edit-message', 'recall-message', 'react-message'
])

// ---- Phase 3.1: 消息编辑 / 撤回 / 回应 ----
const RECALL_WINDOW = 5 * 60 * 1000 // 5 分钟撤回时限
const presetEmojis = ['👍', '❤️', '😂', '😮', '🎉', '🔥']
const editingMsgId = ref(null)
const editDraft = ref('')
const reactPickerMsgId = ref(null)

function isOwn(m) {
  return !!m && m.from === props.myPeerId
}
function canRecall(m) {
  // 仅自己发送 + 未撤回 + 5 分钟内
  return isOwn(m) && !m.deleted && (Date.now() - (m.timestamp || 0)) <= RECALL_WINDOW
}
function startEdit(m) {
  if (!m.text) return
  editingMsgId.value = m.id
  editDraft.value = m.text
  // 关闭表情选择器，避免叠加
  reactPickerMsgId.value = null
}
function cancelEdit() {
  editingMsgId.value = null
  editDraft.value = ''
}
function saveEdit(m) {
  const text = editDraft.value.trim()
  if (!text) return
  emit('edit-message', { msg: m, text })
  editingMsgId.value = null
  editDraft.value = ''
}
function onRecall(m) {
  emit('recall-message', m)
}
function toggleReactPicker(m) {
  reactPickerMsgId.value = reactPickerMsgId.value === m.id ? null : m.id
  // 关闭编辑态
  if (editingMsgId.value === m.id) editingMsgId.value = null
}
function myReacted(m, emoji) {
  const ids = (m.reactions && m.reactions[emoji]) || []
  return ids.includes(props.myPeerId)
}
function reactionList(m) {
  const r = m.reactions || {}
  return Object.keys(r).map((emoji) => {
    const ids = r[emoji] || []
    return {
      emoji,
      count: ids.length,
      mine: ids.includes(props.myPeerId),
      title: ids.length + ' 人回应'
    }
  })
}
function onEmojiClick(m, emoji) {
  const action = myReacted(m, emoji) ? 'remove' : 'add'
  emit('react-message', { msgId: m.id, emoji, action })
  // 选择后关闭选择器
  if (reactPickerMsgId.value === m.id) reactPickerMsgId.value = null
}


// Phase 2.4: 群内视图 tab（聊天 / 云文档）
const activeTab = ref('chat')

const draft = ref('')
const bodyRef = ref(null)
const fileInputRef = ref(null)

const inRoom = computed(() => !!props.currentRoom)

// Phase 2.2: 公告编辑器
const editingAnnouncement = ref(false)
const announcementDraft = ref('')

function startEditAnnouncement() {
  announcementDraft.value = props.announcement?.text || ''
  editingAnnouncement.value = true
}

function saveAnnouncement() {
  emit('set-announcement', announcementDraft.value)
  editingAnnouncement.value = false
  announcementDraft.value = ''
}

function cancelEditAnnouncement() {
  editingAnnouncement.value = false
  announcementDraft.value = ''
}

function clearAnnouncement() {
  emit('set-announcement', '')
  editingAnnouncement.value = false
  announcementDraft.value = ''
}

// ===== Phase 2.3: Pin 置顶 =====
const pinListExpanded = ref(false)
const highlightMsgId = ref(null)

// 当前房间的置顶消息列表（带预览文本；消息不在当前列表则显示占位）
const pinnedMessages = computed(() => {
  if (!props.pinnedMsgIds.length) return []
  return props.pinnedMsgIds.map((id) => {
    const m = props.messages.find((x) => x.id === id)
    return {
      id,
      found: !!m,
      name: m?.name || m?.from?.slice(0, 8) || '未知',
      text: m?.text || (m?.file ? `[文件] ${m.file.name || ''}` : ''),
      timestamp: m?.timestamp || 0
    }
  })
})

function isPinnedMsg(msgId) {
  return props.pinnedMsgIds.includes(msgId)
}

function onTogglePin(msgId) {
  emit('toggle-pin', msgId)
}

// 点击 Pin 列表项 → 滚动定位到消息并高亮
async function locatePin(msgId) {
  await locateMessage(msgId)
}

// Phase 2.5: 通用消息定位（Pin / 搜索结果跳转共用）
async function locateMessage(msgId) {
  if (!msgId) return false
  // 确保在聊天 tab（搜索跳转可能从文档 tab 过来）
  if (activeTab.value !== 'chat') activeTab.value = 'chat'
  await nextTick()
  const el = bodyRef.value?.querySelector(`[data-msg-id="${msgId}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightMsgId.value = msgId
    setTimeout(() => {
      if (highlightMsgId.value === msgId) highlightMsgId.value = null
    }, 2000)
    return true
  }
  // 消息不在当前视口（未加载/已删除）
  return false
}

// Phase 2.5: 从搜索结果跳转 → 定位消息
watch(
  () => props.locateMsgId,
  async (msgId) => {
    if (!msgId) return
    // 等待消息列表加载（切房后 messages 可能尚未就绪）
    let attempts = 0
    let ok = false
    while (attempts < 10 && !ok) {
      await nextTick()
      ok = await locateMessage(msgId)
      if (!ok) await new Promise((r) => setTimeout(r, 200))
      attempts++
    }
    emit('located', msgId)
  }
)

async function scrollToBottom() {
  await nextTick()
  if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
}

watch(() => props.messages.length, scrollToBottom)
watch(() => props.currentRoom, () => {
  pinListExpanded.value = false
  highlightMsgId.value = null
  activeTab.value = 'chat'
  scrollToBottom()
})

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

// 统一取媒体源 URL（新流程 blobUrl 优先，老消息兼容 dataUrl）
function fileSrc(file) {
  if (!file) return ''
  return file.blobUrl || file.dataUrl || ''
}

function downloadFile(file) {
  try {
    // blobUrl 直接用；dataUrl 需转 blob URL（Chrome 限制 data URL 导航下载）
    const url = file.blobUrl || dataUrlToBlobUrl(file.dataUrl)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // 仅清理由 dataUrlToBlobUrl 临时创建的 URL；blobUrl 由发送方/组装方管理生命周期
    if (!file.blobUrl) setTimeout(() => URL.revokeObjectURL(url), 30000)
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
  const fileId = file.fileId || file.id || null
  lightboxFileId.value = fileId
  downloadFailed.value = false
  // 同一 fileId 可能被多次打开：清掉旧的下载中标记，避免 watch 误判
  if (fileId) {
    const next = new Set(downloadingIds.value)
    next.delete(fileId)
    downloadingIds.value = next
  }
  if (file.isMeta && fileId) {
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
    if (m && !m.file?.dataUrl && !m.file?.blobUrl) {
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
      if (m && (m.file?.dataUrl || m.file?.blobUrl)) {
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
async function openPreview(file) {
  if (isText(file.type)) {
    // 文本类型在新标签页打开（兼容 blobUrl 与 dataUrl）
    let text = ''
    if (file.blobUrl) {
      try {
        const res = await fetch(file.blobUrl)
        text = await res.text()
      } catch (e) {
        text = ''
      }
    } else if (file.dataUrl) {
      text = file.dataUrl.split(',')[1] ? atob(file.dataUrl.split(',')[1]) : ''
    }
    const w = window.open()
    if (w) {
      w.document.write(`<pre style="white-space:pre-wrap;word-break:break-word;font-family:monospace;padding:16px;">${escapeHtml(text)}</pre>`)
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
        <!-- 移动端：返回房间列表（收起的侧边栏） -->
        <button class="btn-mini back-btn icon-only-btn" title="返回房间列表" @click="emit('back')">
          <IconBack :size="20" />
        </button>
        <span class="hash">#</span>
        <span class="room-title">{{ currentRoom }}</span>
        <span class="room-stats">
          {{ messages.length }} 条消息
        </span>
        <!-- Phase 2.4: 群内功能 tab 切换 -->
        <div class="room-tabs">
          <button
            class="room-tab-btn"
            :class="{ active: activeTab === 'chat' }"
            title="聊天"
            @click="activeTab = 'chat'"
          >
            <IconChat :size="16" />
            <span class="room-tab-label">聊天</span>
          </button>
          <button
            class="room-tab-btn"
            :class="{ active: activeTab === 'doc' }"
            title="云文档"
            @click="activeTab = 'doc'"
          >
            <IconDoc :size="16" />
            <span class="room-tab-label">文档</span>
          </button>
        </div>
        <button class="btn-mini danger icon-only-btn" title="离开房间" @click="emit('leave')">
          <IconLeave :size="16" />
        </button>
      </template>
      <template v-else>
        <span class="room-title muted">选择左侧房间开始聊天</span>
      </template>
    </div>

    <!-- 音视频通话测试 (开发模式) — 放在 ChatPanel 头部，在桌面/移动都可见 -->
    <CallControls v-if="members.length > 1" :members="members" />

    <!-- Phase 2.4: 云文档视图（群内 tab） -->
    <DocPanel
      v-if="inRoom && activeTab === 'doc'"
      :current-room="currentRoom"
      :docs="docs"
      :conflicts="docConflicts"
      @create-doc="(title) => emit('create-doc', title)"
      @update-doc="(payload) => emit('update-doc', payload)"
      @rename-doc="(payload) => emit('rename-doc', payload)"
      @delete-doc="(docId) => emit('delete-doc', docId)"
      @resolve-conflict-remote="(docId) => emit('resolve-conflict-remote', docId)"
      @resolve-conflict-local="(docId) => emit('resolve-conflict-local', docId)"
    />

    <!-- ===== 聊天视图（群内 tab） ===== -->
    <template v-if="!inRoom || activeTab === 'chat'">
    <!-- Phase 2.2: 群公告条 -->
    <div v-if="inRoom && (announcement?.text || editingAnnouncement)" class="announcement-bar">
      <div v-if="!editingAnnouncement" class="announcement-display">
        <span class="announcement-icon"><IconAnnounce :size="16" /></span>
        <span class="announcement-text">{{ announcement.text }}</span>
        <span class="announcement-meta" v-if="announcement.name">— {{ announcement.name }}</span>
        <button
          v-if="canSetAnnouncement"
          class="btn-mini icon-only-btn announcement-edit-btn"
          title="编辑公告"
          @click="startEditAnnouncement"
        >
          <IconEdit :size="14" />
        </button>
      </div>
      <div v-else class="announcement-editor">
        <IconAnnounce :size="16" />
        <input
          class="input announcement-input"
          v-model="announcementDraft"
          type="text"
          placeholder="输入公告内容…"
          @keyup.enter="saveAnnouncement"
          autofocus
        />
        <button class="btn-mini primary" title="保存" @click="saveAnnouncement">保存</button>
        <button
          v-if="announcement?.text"
          class="btn-mini danger"
          title="清除公告"
          @click="clearAnnouncement"
        >清除</button>
        <button class="btn-mini icon-only-btn" title="取消" @click="cancelEditAnnouncement">
          <IconClose :size="14" />
        </button>
      </div>
    </div>
    <!-- Phase 2.2: 无公告时，有权限者显示"发布公告"入口 -->
    <div v-else-if="inRoom && canSetAnnouncement && !announcement?.text" class="announcement-empty-hint">
      <button class="btn-mini icon-only-btn" title="发布公告" @click="startEditAnnouncement">
        <IconAnnounce :size="14" />
      </button>
    </div>

    <!-- Phase 2.3: Pin 置顶列表条 -->
    <div v-if="inRoom && pinnedMsgIds.length" class="pin-bar">
      <button class="pin-bar-toggle" @click="pinListExpanded = !pinListExpanded">
        <IconPin :size="14" />
        <span class="pin-bar-count">{{ pinnedMsgIds.length }} 条置顶</span>
        <span class="pin-bar-arrow">{{ pinListExpanded ? '收起' : '展开' }}</span>
      </button>
      <div v-if="pinListExpanded" class="pin-list">
        <div
          v-for="p in pinnedMessages"
          :key="p.id"
          class="pin-item"
          :class="{ unavailable: !p.found }"
          @click="locatePin(p.id)"
        >
          <span class="pin-item-icon"><IconPin :size="12" /></span>
          <span class="pin-item-name">{{ p.name }}</span>
          <span class="pin-item-text" v-if="p.found">{{ p.text }}</span>
          <span class="pin-item-text muted" v-else>消息不可用（已删除或未加载）</span>
          <button
            class="btn-mini icon-only-btn pin-unpin-btn"
            title="取消置顶"
            @click.stop="onTogglePin(p.id)"
          >
            <IconClose :size="12" />
          </button>
        </div>
      </div>
    </div>

    <div class="chat-body" ref="bodyRef">
      <div v-if="!inRoom" class="chat-empty">
        <div class="empty-icon"><IconChat :size="48" /></div>
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
        <div
          v-for="m in messages"
          :key="m.id"
          class="msg"
          :class="{ pinned: isPinnedMsg(m.id), highlight: highlightMsgId === m.id }"
          :data-msg-id="m.id"
        >
          <div class="msg-time">{{ formatTime(m.timestamp) }}</div>
          <div class="msg-body">
            <div class="msg-head">
              <span class="msg-name">{{ m.name || m.from.slice(0, 8) }}</span>
              <span v-if="isPinnedMsg(m.id)" class="msg-pin-badge" title="已置顶">
                <IconPin :size="12" />
              </span>
              <!-- Phase 3.1: 操作工具条（hover 显示）：置顶 + 编辑 + 撤回 + 回应 -->
              <span class="msg-actions">
                <button
                  class="btn-mini icon-only-btn msg-pin-btn"
                  :title="isPinnedMsg(m.id) ? '取消置顶' : '置顶'"
                  @click="onTogglePin(m.id)"
                >
                  <IconPin :size="14" />
                </button>
                <template v-if="isOwn(m)">
                  <button
                    v-if="!m.deleted && m.text"
                    class="btn-mini icon-only-btn msg-act-btn"
                    title="编辑"
                    @click="startEdit(m)"
                  >
                    <IconEdit :size="14" />
                  </button>
                  <button
                    v-if="!m.deleted && canRecall(m)"
                    class="btn-mini icon-only-btn msg-act-btn"
                    title="撤回（5 分钟内）"
                    @click="onRecall(m)"
                  >
                    <IconTrash :size="14" />
                  </button>
                </template>
                <button
                  v-if="!m.deleted"
                  class="btn-mini icon-only-btn msg-act-btn"
                  title="表情回应"
                  @click="toggleReactPicker(m)"
                >
                  <IconReact :size="14" />
                </button>
              </span>
            </div>

            <!-- 已撤回显示 -->
            <div v-if="m.deleted" class="msg-recalled">
              <IconTrash :size="12" />
              <span>消息已撤回</span>
            </div>
            <!-- 编辑态 -->
            <div v-else-if="editingMsgId === m.id" class="msg-edit-box">
              <input
                class="input msg-edit-input"
                v-model="editDraft"
                type="text"
                @keyup.enter="saveEdit(m)"
                @keyup.esc="cancelEdit"
                autofocus
              />
              <button class="btn-mini primary" title="保存" @click="saveEdit(m)">保存</button>
              <button class="btn-mini icon-only-btn" title="取消" @click="cancelEdit">
                <IconClose :size="14" />
              </button>
            </div>
            <!-- 文本内容 -->
            <template v-else>
              <span v-if="m.text" class="msg-text">{{ m.text }}</span>
              <span v-if="m.edited" class="msg-edited-tag" title="已编辑">已编辑</span>
              <!-- 文件消息 -->
              <div v-else-if="m.file" class="msg-file">
              <!-- 大文件元信息卡片：仅缩略图/大小，点击下载按需拉取完整内容 -->
              <div v-if="m.file.isMeta" class="file-meta-wrap">
                <div class="file-meta">
                  <span class="file-icon">
                    <IconImage v-if="m.file.thumbDataUrl" :size="16" />
                    <IconVoice v-else-if="isAudio(m.file.type)" :size="16" />
                    <IconFile v-else :size="16" />
                  </span>
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
                <!-- 非图片大文件（压缩包/文档等）：点击拉取完整内容，下载完成后替换为可下载卡片 -->
                <button
                  v-else-if="!downloadingIds.has(m.file.fileId)"
                  class="btn-mini icon-only-btn"
                  title="下载"
                  @click="requestDownload(m.file)"
                >
                  <IconDownload :size="16" />
                </button>
                <span v-else class="file-downloading" title="正在拉取文件…">下载中…</span>
                <!-- 下载进度条（bin 通道分片） -->
                <div v-if="fileProgress.get(m.file.fileId)" class="file-progress">
                  <div class="progress-bar" :style="{ width: fileProgress.get(m.file.fileId).pct + '%' }"></div>
                  <span class="progress-text">{{ fileProgress.get(m.file.fileId).pct }}%</span>
                </div>
              </div>
              <!-- 图片预览 -->
              <div v-else-if="isImage(m.file.type)" class="file-image-wrap">
                <a
                  class="file-image-link"
                  title="点击放大查看（长按/右键可保存图片）"
                  @click.prevent="openLightbox(m.file)"
                >
                  <img
                    :src="fileSrc(m.file)"
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
                <video :src="fileSrc(m.file)" controls class="file-video"></video>
                <div class="file-meta">
                  <span class="file-name" :title="m.file.name">{{ m.file.name }}</span>
                  <span class="file-size">{{ formatSize(m.file.size) }}</span>
                  <button class="btn-mini icon-only-btn" title="下载" @click="downloadFile(m.file)">
                    <IconDownload :size="16" />
                  </button>
                </div>
              </div>
              <!-- 音频预览 -->
              <div v-else-if="isAudio(m.file.type)" class="file-audio-wrap">
                <div class="file-meta">
                  <span class="file-icon"><IconVoice :size="16" /></span>
                  <span class="file-name" :title="m.file.name">{{ m.file.name }}</span>
                  <span class="file-size">{{ formatSize(m.file.size) }}</span>
                </div>
                <audio :src="fileSrc(m.file)" controls class="file-audio"></audio>
              </div>
              <!-- 文本预览 -->
              <div v-else-if="isText(m.file.type)" class="file-text-wrap">
                <div class="file-meta">
                  <span class="file-icon"><IconDoc :size="16" /></span>
                  <span class="file-name" :title="m.file.name">{{ m.file.name }}</span>
                  <span class="file-size">{{ formatSize(m.file.size) }}</span>
                </div>
                <button class="btn-mini icon-only-btn" title="预览" @click="openPreview(m.file)">
                  <IconDoc :size="16" />
                </button>
                <button class="btn-mini icon-only-btn" title="下载" @click="downloadFile(m.file)">
                  <IconDownload :size="16" />
                </button>
              </div>
              <!-- 其他类型 -->
              <div v-else class="file-other-wrap">
                <div class="file-meta">
                  <span class="file-icon"><IconFile :size="16" /></span>
                  <span class="file-name" :title="m.file.name">{{ m.file.name }}</span>
                  <span class="file-size">{{ formatSize(m.file.size) }}</span>
                </div>
                <button class="btn-mini icon-only-btn" title="下载" @click="downloadFile(m.file)">
                  <IconDownload :size="16" />
                </button>
              </div>
            </div>
            </template>
            <!-- Phase 3.1: 表情回应聚合条 -->
            <div v-if="!m.deleted && reactionList(m).length" class="msg-reactions">
              <button
                v-for="r in reactionList(m)"
                :key="r.emoji"
                class="reaction-chip"
                :class="{ mine: r.mine }"
                :title="r.title"
                @click="onEmojiClick(m, r.emoji)"
              >
                <span class="reaction-emoji">{{ r.emoji }}</span>
                <span class="reaction-count">{{ r.count }}</span>
              </button>
            </div>
            <!-- Phase 3.1: 表情选择器 -->
            <div v-if="reactPickerMsgId === m.id" class="react-picker">
              <button
                v-for="e in presetEmojis"
                :key="e"
                class="react-picker-emoji"
                :class="{ active: myReacted(m, e) }"
                @click="onEmojiClick(m, e)"
              >{{ e }}</button>
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
        class="btn-mini file-btn icon-only-btn"
        :disabled="!inRoom"
        @click="onPickFile"
        title="发送文件（≤8MB，支持图片/视频/音频预览）"
      >
        <IconFile :size="20" />
      </button>
      <input
        ref="fileInputRef"
        type="file"
        class="file-input-hidden"
        @change="onFileChange"
      />
      <button class="btn primary icon-only-btn" :disabled="!inRoom || !draft.trim()" title="发送" @click="onSend">
        <IconSend :size="18" />
      </button>
    </div>
    </template>
    <!-- ===== /聊天视图 ===== -->

    <!-- 图片放大查看 lightbox（页面内模态，不跳新标签页） -->
    <div v-if="lightboxFile" class="lightbox-overlay">
      <div class="lightbox-card">
        <div class="lightbox-head">
          <span class="file-name" :title="lightboxFile.name">{{ lightboxFile.name }}</span>
          <span class="file-size">{{ formatSize(lightboxFile.size) }}</span>
          <button class="btn-mini icon-only-btn" title="关闭" @click="closeLightbox">
            <IconClose :size="16" />
          </button>
        </div>
        <div class="lightbox-body">
          <!-- 完整原图（兼容 blobUrl 与 dataUrl） -->
          <img
            v-if="lightboxFile.blobUrl || lightboxFile.dataUrl"
            :src="fileSrc(lightboxFile)"
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
/* 纯图标按钮：统一尺寸与对齐 */
.icon-only-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.file-btn {
  padding: 8px 12px;
  min-height: 44px;
  min-width: 44px;
  touch-action: manipulation;
}
.empty-icon {
  color: var(--accent);
  opacity: 0.5;
  margin-bottom: var(--sp-3);
  line-height: 1;
}
/* ===== Phase 2.2: 群公告条 ===== */
.announcement-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--bg-elev2);
  border-bottom: 1px solid var(--border-soft);
  gap: 8px;
  min-height: 36px;
}
.announcement-display {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.announcement-icon {
  color: var(--warning);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.announcement-text {
  font-size: 13px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.announcement-meta {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.announcement-edit-btn {
  flex-shrink: 0;
  opacity: 0.6;
}
.announcement-edit-btn:hover {
  opacity: 1;
}
.announcement-editor {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.announcement-editor .announcement-icon {
  color: var(--warning);
}
.announcement-input {
  flex: 1;
  min-width: 0;
}
.announcement-empty-hint {
  display: flex;
  align-items: center;
  padding: 2px 12px;
  min-height: 28px;
}
.announcement-empty-hint .btn-mini {
  opacity: 0.4;
  min-height: 28px;
  padding: 4px 8px;
}
.announcement-empty-hint .btn-mini:hover {
  opacity: 1;
}

/* ===== Phase 2.3: Pin 置顶 ===== */
.pin-bar {
  display: flex;
  flex-direction: column;
  background: var(--bg-elev2);
  border-bottom: 1px solid var(--border-soft);
  position: relative;
  z-index: 5;
}
.pin-bar-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text);
  font-size: var(--fs-12);
}
.pin-bar-toggle:hover {
  background: var(--bg-elev);
}
.pin-bar-count {
  font-weight: 600;
}
.pin-bar-arrow {
  margin-left: auto;
  color: var(--text-muted);
  font-size: var(--fs-11);
}
.pin-list {
  display: flex;
  flex-direction: column;
  max-height: 200px;
  overflow-y: auto;
  border-top: 1px solid var(--border-soft);
}
.pin-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: var(--fs-12);
  color: var(--text);
}
.pin-item:hover {
  background: var(--bg-elev);
}
.pin-item.unavailable {
  opacity: 0.6;
}
.pin-item-icon {
  color: var(--c-warning);
  flex-shrink: 0;
}
.pin-item-name {
  font-weight: 600;
  color: var(--accent);
  flex-shrink: 0;
}
.pin-item-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pin-item-text.muted {
  color: var(--text-muted);
  font-style: italic;
}
.pin-unpin-btn {
  flex-shrink: 0;
  opacity: 0;
}
.pin-item:hover .pin-unpin-btn {
  opacity: 1;
}

/* 消息 hover Pin 按钮 + 置顶角标 + 高亮 */
.msg-head {
  display: flex;
  align-items: center;
  gap: 4px;
}
.msg-pin-badge {
  display: inline-flex;
  color: var(--c-warning);
}
.msg-pin-btn {
  opacity: 0.35;
  transition: opacity 0.15s;
  margin-left: 2px;
}
.msg:hover .msg-pin-btn,
.msg.pinned .msg-pin-btn {
  opacity: 1;
}
.msg.pinned {
  background: var(--bg-elev2);
  border-left: 3px solid var(--c-warning);
  padding-left: 8px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.msg.highlight {
  animation: pin-highlight 2s ease-out;
}
@keyframes pin-highlight {
  0% { background: var(--c-warning-soft); }
  100% { background: transparent; }
}

/* ===== Phase 3.1: 消息编辑 / 撤回 / 回应 ===== */
.msg-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s;
}
.msg:hover .msg-actions {
  opacity: 1;
}
.msg-act-btn {
  opacity: 0.55;
  min-height: 26px;
  min-width: 26px;
  padding: 2px 4px;
}
.msg-act-btn:hover {
  opacity: 1;
}
.msg-edited-tag {
  margin-left: 6px;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  cursor: default;
  user-select: none;
}
.msg-recalled {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}
.msg-edit-box {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.msg-edit-input {
  flex: 1;
  min-width: 0;
}
.msg-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.reaction-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-elev2);
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
  transition: background 0.12s, border-color 0.12s;
}
.reaction-chip:hover {
  border-color: var(--accent);
}
.reaction-chip.mine {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.reaction-emoji {
  font-size: 14px;
}
.reaction-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  min-width: 8px;
  text-align: center;
}
.react-picker {
  display: flex;
  gap: 2px;
  margin-top: 6px;
  padding: 4px;
  background: var(--bg-elev2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  width: fit-content;
}
.react-picker-emoji {
  font-size: 18px;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 8px;
  border: none;
  background: none;
  cursor: pointer;
  transition: background 0.12s;
}
.react-picker-emoji:hover {
  background: var(--bg-elev);
}
.react-picker-emoji.active {
  background: var(--accent-soft);
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
.file-downloading {
  align-self: flex-start;
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text-muted);
}
/* 文件分片下载进度条（bin 通道） */
.file-progress {
  position: relative;
  width: 100%;
  max-width: 280px;
  height: 18px;
  background: var(--bg-elev2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.file-progress .progress-bar {
  height: 100%;
  background: var(--primary);
  transition: width 0.15s ease;
}
.file-progress .progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  mix-blend-mode: difference;
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
