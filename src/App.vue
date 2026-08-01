<script setup>
import { ref, onMounted, computed } from 'vue'
import { useChat } from './composables/useChat.js'
import { getRoomPassword } from './lib/db.js'
import PeerInfo from './components/PeerInfo.vue'
import RoomSearch from './components/RoomSearch.vue'
import RoomList from './components/RoomList.vue'
import ChatPanel from './components/ChatPanel.vue'
import MemberList from './components/MemberList.vue'
import CreateRoomDialog from './components/CreateRoomDialog.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import RoomManager from './components/RoomManager.vue'
import PromptInstall from './components/PromptInstall.vue'

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
  AccessRule,
  SpeakRule,
  init,
  setOwnName,
  createRoom,
  joinRoom,
  leaveCurrentRoom,
  sendRoomMessage,
  sendFileMessage,
  downloadFile,
  searchRooms,
  clearSearch,
  filteredRooms,
  joinedRooms,
  isCurrentUserOwner,
  canUserApprove,
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
</script>

<template>
  <div class="app" :class="{ 'is-booting': state.booting }">
    <header class="app-header" :class="{ compact: !!currentRoom }">
      <div class="brand">
        <span class="brand-mark">⬡</span>
        <span class="brand-name">nchat</span>
        <span class="brand-tag">P2P</span>
      </div>
      <div class="header-actions">
        <button class="btn-mini" @click="showRoomManager = true" title="管理房间与存储">
          管理
        </button>
        <button class="btn-mini" @click="showSettings = true" title="设置与诊断">
          设置
        </button>
      </div>
      <PeerInfo
        :state="state"
        :server-label="currentServerLabel"
        @rename="setOwnName"
      />
    </header>

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

    <main class="app-main">
      <aside class="sidebar">
        <RoomSearch
          :online="state.online"
          :keyword="searchKeyword"
          @search="searchRooms"
          @clear="clearSearch"
          @create="showCreateDialog = true"
        />
        <RoomList
          :rooms="filteredRooms"
          :current-room="currentRoom"
          :online="state.online"
          :searching="!!searchKeyword"
          :joined-rooms="joinedRooms"
          @join="onJoinRoom"
        />
      </aside>

      <section class="chat-area" :class="{ 'install-banner-visible': installBannerVisible }">
        <ChatPanel
          :current-room="currentRoom"
          :messages="messages"
          :online="state.online"
          :stats="stats"
          :members="members"
          @send="sendRoomMessage"
          @send-file="sendFileMessage"
          @download="onDownloadFile"
          @leave="leaveCurrentRoom"
        />
      </section>

      <aside class="members-bar">
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
          <button class="btn-mini" @click="passwordPrompt = null">✕</button>
        </div>
        <div class="modal-body">
          <p class="form-hint">🔒 该房间需要密码</p>
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
