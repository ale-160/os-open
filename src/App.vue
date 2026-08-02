<script setup>
import { ref, computed, onMounted } from 'vue'
import { useChat } from './composables/useChat.js'
import { getRoomPassword } from './lib/db.js'
import { AccessRule } from './lib/protocol.js'
import { useLayout } from './composables/useLayout.js'
import SideNav from './components/SideNav.vue'
import ListBar from './components/ListBar.vue'
import ChatPanel from './components/ChatPanel.vue'
import MemberList from './components/MemberList.vue'
import CreateRoomDialog from './components/CreateRoomDialog.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import RoomManager from './components/RoomManager.vue'
import PromptInstall from './components/PromptInstall.vue'
import { IconClose, IconLock, IconInfo, IconCheck, IconAlert } from './components/icons'
import TopologyView from './components/TopologyView.vue'

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
  init,
  setOwnName,
  createRoom,
  joinRoom,
  leaveCurrentRoom,
  backToRoomList,
  sendRoomMessage,
  sendFileMessage,
  downloadFile,
  // Phase 3.1: 消息编辑 / 撤回 / 回应
  editMessage,
  recallMessage,
  reactToMessage,
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
  kickMember,
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
  dismissNotification,
  // Phase 4.2: 拓扑
  getDomainsInfo
} = useChat()

const {
  width,
  sideNavOpen,
  listBarOpen,
  memberOpen,
  isDesktop,
  isTablet,
  isMobile,
  toggleSideNav,
  toggleListBar,
  toggleMember,
  closeAll
} = useLayout()

// 对话框状态
const showCreateDialog = ref(false)
const showSettings = ref(false)
const showRoomManager = ref(false)
const installBannerVisible = ref(false)
const showTopology = ref(false)

// Phase 4.2: 拓扑数据快照
const topologyDomains = computed(() => getDomainsInfo())

// 三栏布局：SideNav 当前激活的导航项（chat/search/settings）
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

// 房间规则设置事件
function onSetRoomRules(rulesPatch) {
  if (currentRoom.value) setRoomRules(currentRoom.value, rulesPatch)
}

// 踢出成员事件
function onKickMember(peerId) {
  if (currentRoom.value) kickMember(currentRoom.value, peerId)
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

// Phase 3.1: 消息编辑 / 撤回 / 回应
async function onEditMessage({ msg, text }) {
  if (!currentRoom.value) return
  await editMessage(msg, text)
}
async function onRecallMessage(msg) {
  if (!currentRoom.value) return
  await recallMessage(msg)
}
async function onReactMessage({ msgId, emoji, action }) {
  if (!currentRoom.value) return
  await reactToMessage(msgId, emoji, action)
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

// 响应式布局辅助
const inRoom = computed(() => !!currentRoom.value)
const memberCount = computed(() => members.value.length)

function onOpenTopology() {
  showTopology.value = true
}

function onCloseTopology() {
  showTopology.value = false
}
</script>

<template>
  <div
    class="app"
    :class="{
      'in-room': inRoom,
      'sidenav-open': sideNavOpen,
      'listbar-open': listBarOpen,
      'member-open': memberOpen
    }"
  >
    <!-- Backdrop for mobile drawers/sheets -->
    <div
      v-if="!isDesktop && (sideNavOpen || listBarOpen || memberOpen)"
      class="drawer-backdrop"
      @click="closeAll"
    />

    <!-- SideNav: Desktop fixed, Mobile drawer -->
    <aside
      v-if="isDesktop || sideNavOpen"
      class="side-nav"
      :class="{ drawer: !isDesktop && sideNavOpen, open: sideNavOpen }"
    >
      <SideNav
        :active-nav="activeNav"
        :online="state.online"
        :own-name="state.ownName"
        @nav="activeNav = $event"
        @open-settings="showSettings = true"
        @open-topology="onOpenTopology"
      />
    </aside>

    <!-- ListBar: Desktop fixed, Mobile bottom sheet（移动端首页也显示，进房后由 CSS 隐藏） -->
    <aside
      v-if="isDesktop || listBarOpen || !inRoom"
      class="list-bar"
      :class="{ sheet: !isDesktop && listBarOpen, open: listBarOpen }"
    >
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
        :fullscreen="!inRoom"
        @rename="setOwnName"
        @search="searchRooms"
        @clear="clearSearch"
        @create="showCreateDialog = true"
        @join="onJoinRoom"
        @manage="showRoomManager = true"
        @menu="toggleSideNav"
        @msg-search="onMsgSearch"
        @msg-clear="onMsgClear"
        @msg-locate="onMsgLocate"
      />
    </aside>

    <!-- Main Content Area -->
    <main
      class="content-area"
      :class="{ 'has-aside': inRoom && memberOpen && isDesktop }"
    >
      <div class="content-main">
        <!-- ChatPanel / RoomList / Settings / Topology -->
        <ChatPanel
          v-if="inRoom"
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
          :my-peer-id="state.peerId"
          @send="sendRoomMessage"
          @leave="leaveCurrentRoom"
          @back="backToRoomList"
          @send-file="sendFileMessage"
          @download="onDownloadFile"
          @set-announcement="onSetAnnouncement"
          @toggle-pin="onTogglePin"
          @create-doc="onCreateDoc"
          @update-doc="onUpdateDoc"
          @rename-doc="onRenameDoc"
          @delete-doc="onDeleteDoc"
          @resolve-conflict-remote="onResolveConflictRemote"
          @resolve-conflict-local="onResolveConflictLocal"
          @located="onLocated"
          @edit-message="onEditMessage"
          @recall-message="onRecallMessage"
          @react-message="onReactMessage"
        />

        <template v-else-if="activeNav === 'chat'">
          <div class="welcome-card">
            <svg class="welcome-logo" width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z"
                stroke="var(--c-primary)"
                stroke-width="1.5"
                stroke-linejoin="round"
                fill="var(--c-primary-soft)"
              />
              <path
                d="M12 7 L16 9.5 V14.5 L12 17 L8 14.5 V9.5 Z"
                stroke="var(--c-primary)"
                stroke-width="1.2"
                stroke-linejoin="round"
                fill="none"
                opacity="0.7"
              />
            </svg>
            <h2 class="welcome-title">nchat</h2>
            <p class="welcome-sub">去中心化 P2P 聊天室</p>
            <p class="welcome-desc">
              没有中心服务器，消息只在节点之间直接流转。<br />
              搜索或创建一个房间，与同一网络中的节点实时通信。
            </p>
            <div class="welcome-actions">
              <button class="btn primary" @click="showCreateDialog = true">＋ 创建房间</button>
            </div>
          </div>
        </template>

        <SettingsPanel
          v-else-if="showSettings"
          :capabilities="capabilities"
          :role-stats="roleStats"
          :domains="topologyDomains"
          :current-server="currentServerLabel"
          :own-name="state.ownName"
          :peer-id="state.peerId"
          @save-role="onSaveRole"
          @rename="setOwnName"
          @add-server="onAddServer"
          @remove-server="onRemoveServer"
          @switch-server="onSwitchServer"
          @reset-servers="onResetServers"
          @close="showSettings = false"
        />

        <TopologyView
          v-else-if="showTopology"
          :domains="topologyDomains"
          :peers="peers"
          :connections="connections"
          @close="onCloseTopology"
        />

        <div v-else class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>选择左侧功能开始</p>
        </div>
      </div>

      <!-- MemberList: Desktop right column, Mobile right drawer -->
      <aside
        v-if="inRoom && (isDesktop || memberOpen)"
        class="content-aside"
        :class="{ drawer: !isDesktop && memberOpen, open: memberOpen }"
      >
        <MemberList
          :members="members"
          :current-room="currentRoom"
          :can-set-announcement="canSetAnnouncement()"
          :announcement="currentAnnouncement"
          :pinned-msg-ids="currentRoomPinnedIds"
          @set-announcement="onSetAnnouncement"
          @toggle-pin="onTogglePin"
          @invite="onInvite"
          @set-stars="onSetStars"
          @set-rules="onSetRoomRules"
          @ban="onSetRoomBan"
          @kick="onKickMember"
        />
      </aside>
    </main>

    <!-- Common Modals/Overlays -->
    <CreateRoomDialog
      v-if="showCreateDialog"
      @close="showCreateDialog = false"
      @create="onCreateRoom"
    />

    <PromptInstall @visible="installBannerVisible = $event" />

    <TopologyView
      v-if="showTopology"
      :domains="topologyDomains"
      :peers="peers"
      :connections="connections"
      @close="onCloseTopology"
    />

    <RoomManager
      v-if="showRoomManager"
      :rooms="rooms"
      :current-room="currentRoom"
      :own-peer-id="state.peerId"
      :is-owner="isCurrentUserOwner"
      @switch="onSwitchRoom"
      @clear="onClearStorage"
      @delete="onDeleteRoom"
      @close="showRoomManager = false"
    />

    <SettingsPanel
      v-if="showSettings"
      :capabilities="capabilities"
      :role-stats="roleStats"
      :domains="topologyDomains"
      :current-server="currentServerLabel"
      :own-name="state.ownName"
      :peer-id="state.peerId"
      @save-role="onSaveRole"
      @rename="setOwnName"
      @add-server="onAddServer"
      @remove-server="onRemoveServer"
      @switch-server="onSwitchServer"
      @reset-servers="onResetServers"
      @close="showSettings = false"
    />

    <!-- Password Prompt Modal -->
    <div v-if="passwordPrompt" class="modal-overlay" @click.self="passwordPrompt = null">
      <div class="modal-card">
        <div class="modal-head">
          <h3 class="modal-title">加入房间「{{ passwordPrompt.name }}」</h3>
          <button class="modal-close" @click="passwordPrompt = null"><IconClose :size="20" /></button>
        </div>
        <div class="modal-body">
          <p style="margin: 0 0 var(--sp-3); color: var(--text-dim);">该房间需要密码</p>
          <input
            v-model="passwordInput"
            type="password"
            class="form-input"
            placeholder="输入密码"
            @keydown.enter="onJoinWithPassword"
            autofocus
          />
        </div>
        <div class="modal-footer">
          <button class="btn" @click="passwordPrompt = null">取消</button>
          <button class="btn primary" @click="onJoinWithPassword">加入</button>
        </div>
      </div>
    </div>

    <!-- Notifications Toast -->
    <div class="notifications" aria-live="polite" aria-atomic="true">
      <div
        v-for="n in notifications"
        :key="n.id"
        class="notification"
        :class="n.type"
        @click="dismissNotification(n.id)"
      >
        <div class="notification-icon">
          <IconInfo v-if="n.type === 'info'" :size="20" />
          <IconCheck v-if="n.type === 'success'" :size="20" />
          <IconAlert v-if="n.type === 'warning'" :size="20" />
          <IconAlert v-if="n.type === 'error'" :size="20" />
        </div>
        <div class="notification-content">
          <div class="notification-text">{{ n.text }}</div>
        </div>
        <button class="notification-close" @click.stop="dismissNotification(n.id)"><IconClose :size="16" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles for App-level overlays only */
.welcome-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: var(--sp-8);
  text-align: center;
  min-height: 0;
}
.welcome-logo {
  margin-bottom: var(--sp-3);
  filter: drop-shadow(0 0 24px rgba(79, 140, 255, 0.35));
  animation: welcomeFloat 3s var(--ease-in-out) infinite;
}
@keyframes welcomeFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.welcome-title {
  margin: 0;
  font-size: var(--fs-24);
  font-weight: var(--fw-bold);
  color: var(--text);
  letter-spacing: 0.02em;
}
.welcome-sub {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--text-dim);
}
.welcome-desc {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-13);
  color: var(--text-muted);
  line-height: 1.8;
}
.welcome-actions {
  margin-top: var(--sp-6);
  display: flex;
  gap: var(--sp-3);
}
.welcome-actions .btn {
  min-width: 140px;
  min-height: 44px;
  padding: var(--sp-2) var(--sp-6);
  border-radius: var(--r-full);
  font-size: var(--fs-14);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-4);
  animation: fadeIn var(--t-fast) var(--ease-out);
}
.modal-card {
  background: var(--bg-elev);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-4);
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: scaleIn var(--t-base) var(--ease-out);
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--border-soft);
}
.modal-title { font-size: var(--fs-16); font-weight: var(--fw-semibold); color: var(--text); }
.modal-close { width: 32px; height: 32px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; background: var(--bg-elev2); border: 1px solid var(--border); color: var(--text-dim); transition: background var(--t-fast), color var(--t-fast); }
.modal-close:hover { background: var(--bg-hover); color: var(--text); }
.modal-body { flex: 1; overflow-y: auto; padding: var(--sp-4) var(--sp-5); }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-5);
  border-top: 1px solid var(--border-soft);
}
.form-input {
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text);
  font-size: var(--fs-13);
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--c-primary-soft);
  outline: none;
}
</style>