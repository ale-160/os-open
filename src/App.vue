<script setup>
import { ref, onMounted, computed } from 'vue'
import { useChat } from './composables/useChat.js'
import { getRoomPassword } from './lib/db.js'
import SideNav from './components/SideNav.vue'
import ListBar from './components/ListBar.vue'
import ChatPanel from './components/ChatPanel.vue'
import MemberList from './components/MemberList.vue'
import CreateRoomDialog from './components/CreateRoomDialog.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import RoomManager from './components/RoomManager.vue'
import PromptInstall from './components/PromptInstall.vue'
import { IconClose, IconLock } from './components/icons'

const {
  state,
  peers,
  rooms,
  currentRoom,
  messages,
  members,
  stats,
  searchKeyword,
  pendingRequests,
  storageStats,
  notifications,
  downloadingIds,
  fileProgress,
  announcements,
  // Phase 2.3: Pin 置顶
  togglePin,
  currentRoomPins,
  // Phase 2.4: 云文档
  currentRoomDocs,
  createDoc,
  updateDoc,
  renameDoc,
  deleteDocRemote,
  resolveDocConflictAcceptRemote,
  resolveDocConflictKeepLocal,
  docConflicts,
  // Phase 2.5: 消息搜索
  messageSearchResults,
  searchingMessages,
  searchMessagesGlobal,
  clearMessageSearch,
  AccessRule,
  SpeakRule,
  init,
  setOwnName,
  createRoom,
  joinRoom,
  leaveCurrentRoom,
  backToRoomList,
  sendRoomMessage,
  sendFileMessage,
  downloadFile,
  searchRooms,
  clearSearch,
  filteredRooms,
  joinedRooms,
  isCurrentUserOwner,
  canUserApprove,
  canSetAnnouncement,
  setAnnouncement,
  // 审核/邀请/星标
  approveJoin,
  rejectJoin,
  inviteMember,
  setMemberStars,
  setRoomRules,
  // 屏蔽/放逐
  setBanRule,
  setRoomBanRule,
  // 房间与存储管理
  clearRoomStorage,
  deleteRoomCompletely,
  switchToRoom,
  refreshStorageStats,
  // 信令服务器管理
  getSignalingServers,
  getCurrentSignaling,
  addCustomSignalingServer,
  removeCustomSignalingServer,
  switchSignalingServer,
  resetSignalingServers,
  getDiagnosticsInfo,
  // 通知
  dismissNotification
} = useChat()

// 对话框状态
const showCreateDialog = ref(false)
const showSettings = ref(false)
const showRoomManager = ref(false)
const installBannerVisible = ref(false)

// 三栏布局：SideNav 当前激活的导航项（chat/doc/file/search）
const activeNav = ref('chat')

// Phase 2.5: 从搜索结果跳转定位的消息 ID（传递给 ChatPanel）
const pendingLocateMsgId = ref('')

// 屏蔽规则计算
const currentRoomBanBelow = computed(() => {
  if (!currentRoom.value) return 0
  const r = rooms.value.find((x) => x.name === currentRoom.value)
  return r?.rules?.banBelowStars || 0
})

const myBanBelow = computed(() => {
  if (!currentRoom.value) return 0
  try {
    const raw = localStorage.getItem('nchat:bans')
    if (!raw) return 0
    const all = JSON.parse(raw)
    return all[currentRoom.value]?.['__me__'] || 0
  } catch {
    return 0
  }
})

// 密码房间加入提示
const passwordPrompt = ref(null) // { name }
const passwordInput = ref('')

onMounted(() => {
  init()
})

async function onJoinRoom(room) {
  // room 可能是 string（旧式调用）或 object（RoomList 传整个房间对象）
  const r = typeof room === 'string' ? { name: room } : room
  const access = r.rules?.access
  if (access === AccessRule.PASSWORD) {
    // 检查是否有已缓存的密码，有则直接加入，不再二次输入
    const cached = getRoomPassword(r.name)
    if (cached) {
      const result = await joinRoom(r.name, cached)
      if (result === 'joined') return
    }
    passwordPrompt.value = { name: r.name }
    passwordInput.value = ''
  } else if (access === AccessRule.APPROVE) {
    // 审核制：直接调用 joinRoom，内部会发送申请
    await joinRoom(r.name)
  } else if (access === AccessRule.INVITE) {
    // 邀请制：需收到邀请才能加入
    // joinRoom 内部会提示
    await joinRoom(r.name)
  } else {
    await joinRoom(r.name)
  }
}

async function onJoinWithPassword() {
  if (passwordPrompt.value && passwordInput.value) {
    await joinRoom(passwordPrompt.value.name, passwordInput.value)
  }
  passwordPrompt.value = null
  passwordInput.value = ''
}

// 大文件按需下载
async function onDownloadFile(file) {
  if (!file?.fileId) return
  const ok = await downloadFile(file.fileId, file.fromPeerId)
  if (!ok) {
    alert('下载失败：文件发送者已离线或无法连接')
  }
}

function onCreateRoom(name, options) {
  createRoom(name, options)
  showCreateDialog.value = false
  refreshStorageStats()
}

// 审核/邀请/星标事件
function onApprove(peerId) {
  if (currentRoom.value) approveJoin(currentRoom.value, peerId)
}

function onReject(peerId) {
  if (currentRoom.value) rejectJoin(currentRoom.value, peerId, '申请被拒绝')
}

function onInvite(peerId) {
  if (currentRoom.value) inviteMember(currentRoom.value, peerId)
}

function onSetStars(peerId, stars) {
  if (currentRoom.value) setMemberStars(currentRoom.value, peerId, stars)
}

// 屏蔽/放逐事件
function onSetBan(banBelowStars) {
  if (currentRoom.value) setBanRule(currentRoom.value, banBelowStars)
}

function onSetRoomBan(banBelowStars) {
  if (currentRoom.value) setRoomBanRule(currentRoom.value, banBelowStars)
}

// 房间管理事件
async function onSwitchRoom(room) {
  await switchToRoom(room)
  showRoomManager.value = false
}

async function onClearStorage(room) {
  if (!confirm(`确定清空「${room}」的本地数据？消息历史将被删除。`)) return
  await clearRoomStorage(room)
}

async function onDeleteRoom(room) {
  if (!confirm(`确定离开并删除「${room}」？将退出房间并清空所有本地数据。`)) return
  await deleteRoomCompletely(room)
  showRoomManager.value = false
}

// 信令服务器事件
async function onAddServer(cfg) {
  const ok = await addCustomSignalingServer(cfg)
  if (!ok) {
    alert('该服务器已存在')
  }
}

function onRemoveServer(server) {
  removeCustomSignalingServer(server)
}

async function onSwitchServer(server) {
  await switchSignalingServer(server)
  showSettings.value = false
}

function onResetServers() {
  if (!confirm('确定重置为默认信令服务器配置？')) return
  resetSignalingServers()
}

// 当前信令服务器显示
const currentServerLabel = computed(() => {
  const s = getCurrentSignaling()
  return s ? `${s.host}:${s.port}` : ''
})

// Phase 2.2: 当前房间公告
const currentAnnouncement = computed(() => {
  if (!currentRoom.value) return null
  return announcements.value.get(currentRoom.value) || null
})

// Phase 2.3: 当前房间 Pin 列表
const currentRoomPinnedIds = computed(() => currentRoomPins())

// Phase 2.4: 当前房间文档列表
const currentRoomDocsList = computed(() => currentRoomDocs())

// Phase 2.2: 发布/编辑公告
async function onSetAnnouncement(text) {
  if (!currentRoom.value) return
  const ok = await setAnnouncement(currentRoom.value, text)
  if (!ok) {
    // 权限不足或未加入房间——setAnnouncement 内部已 emit error
  }
}

// Phase 2.3: 切换消息置顶
async function onTogglePin(msgId) {
  if (!currentRoom.value) return
  await togglePin(msgId)
}

// Phase 2.4: 云文档事件
async function onCreateDoc(title) {
  if (!currentRoom.value) return
  await createDoc(title)
}

async function onUpdateDoc(payload) {
  if (!currentRoom.value) return
  await updateDoc(payload.docId, payload.patch)
}

async function onRenameDoc(payload) {
  if (!currentRoom.value) return
  await renameDoc(payload.docId, payload.title)
}

async function onDeleteDoc(docId) {
  if (!currentRoom.value) return
  await deleteDocRemote(docId)
}

function onResolveConflictRemote(docId) {
  resolveDocConflictAcceptRemote(docId)
}

async function onResolveConflictLocal(docId) {
  await resolveDocConflictKeepLocal(docId)
}

// Phase 2.5: 消息搜索事件
async function onMsgSearch(keyword) {
  await searchMessagesGlobal(keyword)
}

function onMsgClear() {
  clearMessageSearch()
}

// 从搜索结果跳转：切房 + 定位消息
async function onMsgLocate(payload) {
  const { room, msgId } = payload || {}
  if (!room || !msgId) return
  // 切到会话视图
  activeNav.value = 'chat'
  // 如果不在该房间，先加入
  if (currentRoom.value !== room) {
    await joinRoom(room)
  }
  // 设置待定位消息 ID（ChatPanel watch 后自动滚动）
  pendingLocateMsgId.value = msgId
}

// ChatPanel 定位完成 → 清除待定位 ID
function onLocated(msgId) {
  if (pendingLocateMsgId.value === msgId) {
    pendingLocateMsgId.value = ''
  }
}
</script>

<template>
  <div class="app" :class="{ 'is-booting': state.booting, 'in-room': !!currentRoom }">
    <!-- 三栏布局：SideNav(64px) | ListBar(280px) | ContentArea(1fr) -->
    <SideNav
      :active-nav="activeNav"
      :online="state.online"
      :own-name="state.ownName"
      @nav="activeNav = $event"
      @open-settings="showSettings = true"
    />

    <ListBar
      :active-nav="activeNav"
      :state="state"
      :server-label="currentServerLabel"
      :online="state.online"
      :search-keyword="searchKeyword"
      :rooms="rooms"
      :filtered-rooms="filteredRooms"
      :current-room="currentRoom"
      :searching="!!searchKeyword"
      :joined-rooms="joinedRooms"
      :message-search-results="messageSearchResults"
      :searching-messages="searchingMessages"
      @rename="setOwnName"
      @search="searchRooms"
      @clear="clearSearch"
      @create="showCreateDialog = true"
      @join="onJoinRoom"
      @manage="showRoomManager = true"
      @msg-search="onMsgSearch"
      @msg-clear="onMsgClear"
      @msg-locate="onMsgLocate"
    />

    <main class="content-area" :class="{ 'install-banner-visible': installBannerVisible, 'has-aside': !!currentRoom }">
      <div class="content-main">
        <ChatPanel
          :current-room="currentRoom"
          :messages="messages"
          :online="state.online"
          :stats="stats"
          :members="members"
          :file-progress="fileProgress"
          :announcement="currentAnnouncement"
          :can-set-announcement="canSetAnnouncement()"
          :pinned-msg-ids="currentRoomPinnedIds"
          :docs="currentRoomDocsList"
          :doc-conflicts="docConflicts"
          :locate-msg-id="pendingLocateMsgId"
          @send="sendRoomMessage"
          @send-file="sendFileMessage"
          @download="onDownloadFile"
          @back="backToRoomList"
          @leave="leaveCurrentRoom"
          @set-announcement="onSetAnnouncement"
          @toggle-pin="onTogglePin"
          @create-doc="onCreateDoc"
          @update-doc="onUpdateDoc"
          @rename-doc="onRenameDoc"
          @delete-doc="onDeleteDoc"
          @resolve-conflict-remote="onResolveConflictRemote"
          @resolve-conflict-local="onResolveConflictLocal"
          @located="onLocated"
        />
      </div>
      <aside class="content-aside" v-if="currentRoom">
        <MemberList
          :members="members"
          :is-owner="isCurrentUserOwner()"
          :can-approve="canUserApprove()"
          :pending-requests="pendingRequests"
          :room-ban-below="currentRoomBanBelow"
          :my-ban-below="myBanBelow"
          @set-stars="onSetStars"
          @approve="onApprove"
          @reject="onReject"
          @set-ban="onSetBan"
          @set-room-ban="onSetRoomBan"
        />
      </aside>
    </main>

    <!-- 通知条 -->
    <div class="notifications" v-if="notifications.length">
      <div
        v-for="n in notifications"
        :key="n.id"
        class="notification"
        :class="n.type"
        @click="dismissNotification(n.id)"
      >
        <span class="notif-icon">
          {{ n.type === 'success' ? '✓' : n.type === 'error' ? '✗' : 'ℹ' }}
        </span>
        <span class="notif-text">{{ n.text }}</span>
      </div>
    </div>

    <!-- 创建房间对话框 -->
    <CreateRoomDialog
      v-if="showCreateDialog"
      @create="onCreateRoom"
      @close="showCreateDialog = false"
    />

    <!-- 设置与诊断面板 -->
    <SettingsPanel
      v-if="showSettings"
      @close="showSettings = false"
      @add-server="onAddServer"
      @remove-server="onRemoveServer"
      @switch-server="onSwitchServer"
      @reset-servers="onResetServers"
    />

    <!-- 房间与存储管理 -->
    <RoomManager
      v-if="showRoomManager"
      :rooms="rooms"
      :joined-rooms="joinedRooms"
      :current-room="currentRoom"
      :storage-stats="storageStats"
      @close="showRoomManager = false"
      @switch="onSwitchRoom"
      @clear-storage="onClearStorage"
      @delete-room="onDeleteRoom"
    />

    <!-- 密码输入对话框 -->
    <div v-if="passwordPrompt" class="modal-overlay" @click.self="passwordPrompt = null">
      <div class="modal-card small">
        <div class="modal-head">
          <span>加入「{{ passwordPrompt.name }}」</span>
          <button class="btn-mini icon-only-btn" title="关闭" @click="passwordPrompt = null">
            <IconClose :size="16" />
          </button>
        </div>
        <div class="modal-body">
          <p class="form-hint"><IconLock :size="14" /> 该房间需要密码</p>
          <input
            class="input"
            v-model="passwordInput"
            type="password"
            placeholder="输入房间密码"
            @keyup.enter="onJoinWithPassword"
            autofocus
          />
        </div>
        <div class="modal-foot">
          <button class="btn" @click="passwordPrompt = null">取消</button>
          <button class="btn primary" @click="onJoinWithPassword" :disabled="!passwordInput">
            加入
          </button>
        </div>
      </div>
    </div>

    <!-- PWA 安装提示 -->
    <PromptInstall @visible="installBannerVisible = $event" />

    <div v-if="state.booting" class="overlay">
      <div class="overlay-card">
        <div class="spinner"></div>
        <div>正在建立 P2P 身份与信令连接…</div>
        <div class="overlay-sub" v-if="state.error">{{ state.error }}</div>
      </div>
    </div>
  </div>
</template>
