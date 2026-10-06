<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import CallControls from './CallControls.vue'
import DocPanel from './DocPanel.vue'
// New chat sub-components
import MessageList from './chat/MessageList.vue'
import MessageInput from './chat/MessageInput.vue'
import ChatHeader from './chat/ChatHeader.vue'
import PinBar from './chat/PinBar.vue'
import AnnouncementBar from './chat/AnnouncementBar.vue'
import Lightbox from './chat/Lightbox.vue'
import FileUploadZone from './chat/FileUploadZone.vue'
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
  typingName: { type: String, default: '' },
  canSetAnnouncement: { type: Boolean, default: false },
  pinnedMsgIds: { type: Array, default: () => [] },
  starredMsgIds: { type: Array, default: () => [] },
  memberOpen: { type: Boolean, default: true },
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
  'edit-message', 'recall-message', 'react-message',
  // 通知（多选批量删除无可用项时提示）
  'notify', 'toggle-star', 'toggle-member', 'open-settings', 'retry-message', 'typing'
])

// Phase 2.4: 群内视图 tab（聊天 / 云文档）
const activeTab = ref('chat')
const inRoom = computed(() => !!props.currentRoom)

// Phase 2.2: 公告编辑器
const editingAnnouncement = ref(false)
const announcementDraft = ref('')

function startEditAnnouncement() {
  announcementDraft.value = props.announcement?.text || ''
  editingAnnouncement.value = true
}

function saveAnnouncement() {
  emit('set-announcement', announcementDraft.value.trim())
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

// 公告编辑模式（标题栏公告按钮触发，编辑区在公告栏）
const announcementEditOpen = ref(false)

// 回复引用：{ msgId, name, text }，设置后输入框显示引用条
const replyingTo = ref(null)
function startReply(msg) {
  replyingTo.value = { msgId: msg.id, name: msg.name || msg.from?.slice(0, 8), text: msg.text || '' }
}
function cancelReply() {
  replyingTo.value = null
}

// 音视频通话面板（标题栏通话按钮控制）
const callOpen = ref(false)

// ---- 多选模式：批量撤回/删除 ----
const multiSelect = ref({ active: false, ids: new Set() })
const selectedIds = computed(() => [...multiSelect.value.ids])
const deletableCount = computed(() => {
  let n = 0
  for (const id of multiSelect.value.ids) {
    const m = props.messages.find((x) => x.id === id)
    if (m && m.from === props.myPeerId && !m.deleted && Date.now() - (m.timestamp || 0) <= 5 * 60 * 1000) n++
  }
  return n
})
function enterMultiSelect(msg) {
  multiSelect.value = { active: true, ids: new Set([msg.id]) }
}
function toggleSelect(id) {
  const ids = new Set(multiSelect.value.ids)
  if (ids.has(id)) ids.delete(id)
  else ids.add(id)
  multiSelect.value = { active: true, ids }
}
function exitMultiSelect() {
  multiSelect.value = { active: false, ids: new Set() }
}
function batchDelete() {
  let deleted = 0
  for (const id of multiSelect.value.ids) {
    const m = props.messages.find((x) => x.id === id)
    if (m && m.from === props.myPeerId && !m.deleted && Date.now() - (m.timestamp || 0) <= 5 * 60 * 1000) {
      emit('recall-message', m)
      deleted++
    }
  }
  exitMultiSelect()
  if (deleted === 0) emit('notify', { type: 'error', message: '没有可删除的消息（仅限自己 5 分钟内发送的）' })
}

// Phase 2.5: 通用消息定位（Pin / 搜索结果跳转共用）
async function locateMessage(msgId) {
  if (!msgId) return false
  // 确保在聊天 tab（搜索跳转可能从文档 tab 过来）
  if (activeTab.value !== 'chat') activeTab.value = 'chat'
  await nextTick()
  const el = document.querySelector(`[data-msg-id="${msgId}"]`)
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
  const list = document.querySelector('.message-list')
  if (list) list.scrollTop = list.scrollHeight
}

watch(() => props.currentRoom, () => {
  pinListExpanded.value = false
  highlightMsgId.value = null
  activeTab.value = 'chat'
  replyingTo.value = null
  exitMultiSelect()
  // 切换房间强制滚到底（由 MessageList 的智能滚动接管新消息场景）
  scrollToBottom()
})

function onSend(text) {
  if (!text || !inRoom.value) return
  emit('send', { text, replyTo: replyingTo.value || undefined })
  replyingTo.value = null
}

function onSendFile(file) {
  if (!inRoom.value) return
  emit('send-file', file)
}

function onDownloadFile(file) {
  if (!file?.fileId) return
  emit('download', file)
}

// 打开放大查看
const lightboxFileId = ref(null)
const downloadingIds = ref(new Set())
const downloadFailed = ref(false)

const lightboxFile = computed(() => {
  if (!lightboxFileId.value) return null
  const m = props.messages.find((x) => x.file?.fileId === lightboxFileId.value)
  return m?.file || null
})

function openLightbox(file) {
  if (!file) return
  const fileId = file.fileId || file.id || null
  lightboxFileId.value = fileId
  downloadFailed.value = false
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

function retryDownload() {
  if (!lightboxFile.value) return
  downloadFailed.value = false
  requestDownload(lightboxFile.value)
}

function requestDownload(file) {
  if (!file?.fileId) return
  downloadingIds.value = new Set(downloadingIds.value).add(file.fileId)
  emit('download', file)
  // 12s 超时：未收到数据则提示失败并复位
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

function onLocated(msgId) {
  emit('located', msgId)
}
</script>

<template>
  <div class="chat-panel">
    <ChatHeader
      :current-room="currentRoom"
      :announcement="announcement"
      :can-set-announcement="canSetAnnouncement"
      :pinned-msg-ids="pinnedMsgIds"
      :online="online"
      :member-count="members.length"
      :in-room="inRoom"
      :member-open="memberOpen"
      :call-open="callOpen"
      :typing-name="typingName"
      @back="emit('back')"
      @leave="emit('leave')"
      @toggle-member="emit('toggle-member')"
      @toggle-call="callOpen = !callOpen"
      @open-settings="emit('open-settings')"
      @edit-announcement="announcementEditOpen = true"
      @set-announcement="emit('set-announcement', $event)"
      @toggle-pin="emit('toggle-pin', $event)"
      @more="() => {}"
    />

    <!-- 音视频通话测试 (开发模式) — 由标题栏通话按钮控制显隐 -->
    <CallControls v-if="callOpen && members.length > 1" :members="members" />

    <!-- Phase 2.4: 云文档视图（群内 tab） -->
    <DocPanel
      v-if="inRoom && activeTab === 'doc'"
      :current-room="currentRoom"
      :docs="docs"
      :conflicts="docConflicts"
      @create-doc="emit('create-doc', $event)"
      @update-doc="emit('update-doc', $event)"
      @rename-doc="emit('rename-doc', $event)"
      @delete-doc="emit('delete-doc', $event)"
      @resolve-conflict-remote="emit('resolve-conflict-remote', $event)"
      @resolve-conflict-local="emit('resolve-conflict-local', $event)"
    />

    <!-- ===== 聊天视图（群内 tab） ===== -->
    <template v-if="!inRoom || activeTab === 'chat'">
      <!-- Phase 2.2: 群公告条（显示+编辑；无公告且非编辑时不渲染） -->
      <AnnouncementBar
        :announcement="announcement"
        :can-set-announcement="canSetAnnouncement"
        :edit-mode="announcementEditOpen"
        @set-announcement="emit('set-announcement', $event)"
        @close-edit="announcementEditOpen = false"
      />

      <!-- Phase 2.3: Pin 置顶列表条 -->
      <PinBar
        :pinned-msg-ids="pinnedMsgIds"
        :messages="messages"
        @locate="locateMessage"
        @unpin="emit('toggle-pin', $event)"
      />

      <div class="chat-body">
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

          <MessageList
            :messages="messages"
            :my-peer-id="myPeerId"
            :locate-msg-id="locateMsgId"
            :pinned-ids="pinnedMsgIds"
            :starred-ids="starredMsgIds"
            :multi-select="multiSelect.active"
            :selected-ids="selectedIds"
            @edit="emit('edit-message', $event)"
            @recall="emit('recall-message', $event)"
            @toggle-pin="emit('toggle-pin', $event)"
            @toggle-star="emit('toggle-star', $event)"
            @retry-message="emit('retry-message', $event)"
            @react="emit('react-message', $event)"
            @download="onDownloadFile"
            @reply="startReply"
            @locate="locateMessage"
            @multi-select="enterMultiSelect"
            @toggle-select="toggleSelect"
          />
        </template>
      </div>

      <!-- 多选操作栏 -->
      <div v-if="multiSelect.active" class="multi-select-bar">
        <span class="ms-count">已选 {{ multiSelect.ids.size }} 条</span>
        <div class="ms-actions">
          <button class="ms-btn primary" :disabled="deletableCount === 0" @click="batchDelete" title="仅限自己 5 分钟内发送的消息">
            <IconTrash :size="14" /> 删除{{ deletableCount ? ` (${deletableCount})` : '' }}
          </button>
          <button class="ms-btn" @click="exitMultiSelect">取消</button>
        </div>
      </div>

      <!-- 输入区 -->
      <MessageInput
        :disabled="!inRoom"
        :placeholder="inRoom ? `发送到 ${currentRoom}` : '输入消息，回车发送，Shift+Enter 换行'"
        :replying-to="replyingTo"
        @send="onSend"
        @file="onSendFile"
        @mention="() => {}"
        @cancel-reply="cancelReply"
        @typing="emit('typing')"
      />
    </template>

    <!-- 图片放大查看 lightbox（页面内模态，不跳新标签页） -->
    <Lightbox
      v-if="lightboxFile"
      :file="lightboxFile"
      :downloading="downloadingIds.has(lightboxFile.fileId)"
      :download-failed="downloadFailed"
      @close="closeLightbox"
      @retry="retryDownload"
      @download="requestDownload(lightboxFile)"
    />
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg);
}

.chat-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  color: var(--text-muted);
  padding: var(--sp-8);
  text-align: center;
}

.chat-empty .empty-icon {
  color: var(--accent);
  opacity: 0.5;
  margin-bottom: var(--sp-3);
  line-height: 1;
}

.chat-empty p { margin: 0; }
.chat-empty .sub {
  font-size: var(--fs-13);
  color: var(--text-muted);
  line-height: var(--lh-normal);
}
.chat-empty .sub.stat {
  margin-top: var(--sp-4);
  font-size: var(--fs-12);
  color: var(--text-dim);
}

.chat-empty.small {
  padding: var(--sp-4);
}

.icon-only-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
}

/* ===== 多选操作栏 ===== */
.multi-select-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  background: var(--bg-elev2);
  border-top: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.ms-count {
  font-size: var(--fs-12);
  color: var(--text-dim);
}
.ms-actions {
  display: flex;
  gap: var(--sp-2);
}
.ms-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: var(--sp-1) var(--sp-3);
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-elev2);
  color: var(--text);
  font-size: var(--fs-12);
  cursor: pointer;
  min-height: 32px;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.ms-btn:hover { background: var(--bg-hover); }
.ms-btn.primary {
  background: var(--c-danger);
  border-color: var(--c-danger);
  color: white;
}
.ms-btn.primary:hover:not(:disabled) { background: var(--c-danger); opacity: 0.9; }
.ms-btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>