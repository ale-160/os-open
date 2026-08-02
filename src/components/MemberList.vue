<script setup>
/**
 * 成员列表
 * - 桌面端：240px 固定右栏
 * - 移动端：右侧抽屉（默认收起，头部图标触发，含搜索/邀请/星标/禁言/踢人）
 */
import { ref, watch, computed } from 'vue'
import { useLayout } from '@/composables/useLayout.js'
import {
  IconCheck,
  IconClose,
  IconUp,
  IconDown,
  IconEdit,
  IconStar,
  IconUserPlus,
  IconMicOff,
  IconUserX,
  IconSearch,
  IconX
} from './icons'

const props = defineProps({
  members: { type: Array, default: () => [] },
  peers: { type: Array, default: () => [] },
  currentRoom: { type: String, default: '' },
  canSetAnnouncement: { type: Boolean, default: false },
  announcement: { type: Object, default: null },
  pinnedMsgIds: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'set-announcement',
  'toggle-pin',
  'invite',
  'set-stars',
  'set-rules',
  'set-ban',
  'ban',
  'kick'
])

const { isDesktop, memberOpen, toggleMember } = useLayout()

// 权限：邀请需创建者或星级达标；星标/禁言/踢出仅创建者可操作
const selfIsOwner = computed(() => props.members.find((m) => m.self)?.isOwner ?? false)
const canInvite = computed(() => props.members.find((m) => m.self)?.canApprove ?? false)

// 本地排序覆盖：peerId -> 手动顺序（仅 owner 操作，本地生效）
const orderOverride = ref(new Map())
const orderedMembers = ref([])

/** 从 props.members 构建有序列表（应用手动排序覆盖） */
function rebuild() {
  const arr = [...props.members]
  if (orderOverride.value.size) {
    arr.sort((a, b) => {
      const ia = orderOverride.value.get(a.peerId)
      const ib = orderOverride.value.get(b.peerId)
      if (ia === undefined && ib === undefined) return 0
      if (ia === undefined) return 1
      if (ib === undefined) return -1
      return ia - ib
    })
  }
  orderedMembers.value = arr
}
watch(() => props.members, rebuild, { deep: true, immediate: true })
const starsEditing = ref(null) // peerId 正在编辑星标
const starsInput = ref(1)
const searchKeyword = ref('')

// 屏蔽设置弹层
const banEditing = ref(false)
const banInput = ref(0)
const banMode = ref('personal') // personal | room

const filteredMembers = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return orderedMembers.value
  return orderedMembers.value.filter(m =>
    (m.name || '').toLowerCase().includes(kw) ||
    (m.peerId || '').toLowerCase().includes(kw)
  )
})

function moveUp(peerId) {
  const arr = orderedMembers.value.map((m) => m.peerId)
  const idx = arr.indexOf(peerId)
  if (idx <= 0) return
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
  orderOverride.value = new Map(arr.map((id, i) => [id, i]))
  rebuild()
}

function moveDown(peerId) {
  const arr = orderedMembers.value.map((m) => m.peerId)
  const idx = arr.indexOf(peerId)
  if (idx < 0 || idx >= arr.length - 1) return
  ;[arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]
  orderOverride.value = new Map(arr.map((id, i) => [id, i]))
  rebuild()
}

function startEditStars(member) {
  starsEditing.value = member.peerId
  starsInput.value = member.stars || 1
}

function commitStars() {
  if (starsEditing.value) {
    const stars = Math.max(1, Math.min(99, Number(starsInput.value) || 1))
    emit('set-stars', starsEditing.value, stars)
  }
  starsEditing.value = null
}

function cancelEditStars() {
  starsEditing.value = null
}

function initial(name) {
  const n = (name || '').trim()
  return n ? n.charAt(0).toUpperCase() : '?'
}

function roleLabel(role) {
  switch (role) {
    case 'owner': return '创建者'
    case 'admin': return '管理员'
    default: return '成员'
  }
}

function starsLabel(stars) {
  return `${stars || 1}★`
}

// 邀请弹窗：列出在线且不在本房间的节点
const inviteOpen = ref(false)
function inviteMember(member) {
  inviteOpen.value = true
}
const inviteCandidates = computed(() => {
  const inRoom = new Set(props.members.map((m) => m.peerId))
  const selfId = props.members.find((m) => m.self)?.peerId
  return (props.peers || [])
    .filter((p) => p.peerId && p.peerId !== selfId && !inRoom.has(p.peerId))
    .map((p) => ({ peerId: p.peerId, name: p.name || p.peerId.slice(0, 8) }))
})
function doInvite(peerId) {
  emit('invite', peerId)
  inviteOpen.value = false
}

function setStars(member) {
  starsEditing.value = member.peerId
  starsInput.value = member.stars || 1
}

// 禁言编辑：目标成员 + 阈值（星级低于阈值禁言）
const banTarget = ref(null)
function banMember(member) {
  banTarget.value = member.peerId
  banMode.value = 'personal'
  banEditing.value = true
  banInput.value = 0
}

function kickMember(member) {
  if (confirm(`确定踢出 ${member.name || member.peerId.slice(0, 8)} 吗？`)) {
    emit('kick', member.peerId)
  }
}

function openBanEditor(mode) {
  banMode.value = mode
  banEditing.value = true
}

function commitBan() {
  const v = Math.max(0, Math.min(99, Number(banInput.value) || 0))
  if (banMode.value === 'room') {
    emit('set-room-ban', v)
  } else {
    emit('set-ban', v)
  }
  banEditing.value = false
}

function cancelBan() {
  banEditing.value = false
}
</script>

<template>
  <aside class="member-list" :class="{ drawer: !isDesktop, open: memberOpen }">
    <!-- 抽屉头部（仅移动端） -->
    <header class="drawer-header" v-if="!isDesktop">
      <div class="drawer-search">
        <input
          type="search"
          placeholder="搜索成员..."
          v-model="searchKeyword"
          class="search-input"
        />
      </div>
      <button class="icon-btn" @click="toggleMember" aria-label="关闭成员列表"><IconX :size="20" /></button>
    </header>

    <div class="member-content">
      <!-- 栏目标题（桌面端） -->
      <div class="member-head" v-if="isDesktop">
        <span class="member-head-title">成员</span>
        <span class="member-head-count">{{ filteredMembers.length }}</span>
      </div>

      <!-- 搜索框（桌面端显示在列表上方） -->
      <div class="member-search" v-if="isDesktop">
        <input
          type="search"
          placeholder="搜索成员..."
          v-model="searchKeyword"
          class="search-input"
        />
      </div>

      <!-- 成员列表 -->
      <ul class="member-items">
        <li
          v-for="m in filteredMembers"
          :key="m.peerId"
          class="member-item"
          :class="{ self: m.self, owner: m.role === 'owner' }"
        >
          <div class="member-avatar">{{ initial(m.name) }}</div>
          <div class="member-info">
            <span class="member-name">{{ m.name || initial(m.peerId) }}</span>
            <span class="member-meta">{{ roleLabel(m.isOwner ? 'owner' : 'member') }} · {{ starsLabel(m.stars) }}</span>
          </div>
          <!-- 操作按钮：默认隐藏，悬停成员项时显示；邀请需创建者或星级达标，管理操作仅创建者 -->
          <div class="member-actions" v-if="!m.self">
            <button v-if="canInvite" class="icon-btn-mini" @click="inviteMember(m)" title="邀请"><IconUserPlus :size="16" /></button>
            <button v-if="selfIsOwner" class="icon-btn-mini" @click="setStars(m)" title="星标"><IconStar :size="16" :class="{ filled: m.stars > 1 }" /></button>
            <button v-if="selfIsOwner" class="icon-btn-mini" @click="banMember(m)" title="禁言"><IconMicOff :size="16" /></button>
            <button v-if="selfIsOwner" class="icon-btn-mini danger" @click="kickMember(m)" title="踢出"><IconUserX :size="16" /></button>
          </div>
          <!-- 禁言编辑（创建者操作）：星级低于阈值的成员禁言 -->
          <div v-if="banEditing && banMode === 'personal' && banTarget === m.peerId" class="stars-editor" @click.stop>
            <input
              type="number"
              v-model.number="banInput"
              min="0"
              max="99"
              class="stars-input"
              placeholder="星级阈值"
              @keydown.enter="commitBan"
              @keydown.esc="cancelBan"
              autofocus
            />
            <button class="icon-btn-mini primary" @click="commitBan" title="确认"><IconCheck :size="14" /></button>
            <button class="icon-btn-mini" @click="cancelBan" title="取消"><IconClose :size="14" /></button>
          </div>
          <!-- 星标编辑（owner 操作） -->
          <div v-if="starsEditing === m.peerId" class="stars-editor" @click.stop>
            <input
              type="number"
              v-model.number="starsInput"
              min="1"
              max="99"
              class="stars-input"
              placeholder="1-99"
              @keydown.enter="commitStars"
              @keydown.esc="cancelEditStars"
              autofocus
            />
            <button class="icon-btn-mini primary" @click="commitStars" title="确认"><IconCheck :size="14" /></button>
            <button class="icon-btn-mini" @click="cancelEditStars" title="取消"><IconClose :size="14" /></button>
          </div>
        </li>
      </ul>

      <div v-if="filteredMembers.length === 0" class="empty-state">暂无成员</div>

      <!-- 邀请弹窗：选择在线节点加入房间 -->
      <div v-if="inviteOpen" class="invite-panel" @click.stop>
        <div class="invite-head">
          <span class="invite-title">邀请加入</span>
          <button class="icon-btn-mini" @click="inviteOpen = false" title="关闭"><IconX :size="14" /></button>
        </div>
        <div v-if="inviteCandidates.length === 0" class="invite-empty">没有可邀请的在线节点</div>
        <ul v-else class="invite-list">
          <li v-for="p in inviteCandidates" :key="p.peerId" class="invite-item" @click="doInvite(p.peerId)">
            <span class="member-avatar sm">{{ initial(p.name) }}</span>
            <span class="invite-name">{{ p.name }}</span>
            <button class="icon-btn-mini primary" title="邀请"><IconUserPlus :size="14" /></button>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<script>
import { useLayout } from '@/composables/useLayout.js'
import {
  IconCheck,
  IconClose,
  IconUp,
  IconDown,
  IconEdit,
  IconStar,
  IconUserPlus,
  IconMicOff,
  IconUserX,
  IconSearch,
  IconX
} from './icons'
</script>

<style scoped>
.member-list {
  width: 240px;
  flex-shrink: 0;
  background: var(--bg-elev);
  border-left: 1px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition: transform var(--t-base) var(--ease-out);
}

.member-list.drawer {
  position: fixed;
  right: 0; top: 0; bottom: 0;
  width: 280px;
  max-width: 85vw;
  border-left: none;
  box-shadow: var(--shadow-3);
  z-index: var(--z-drawer);
  transform: translateX(100%);
}
.member-list.drawer.open { transform: translateX(0); }

.drawer-header {
  display: none;
  padding: var(--sp-3) var(--sp-4);
  display: flex; align-items: center; justify-content: space-between;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border-soft);
}
.drawer-title { font-size: var(--fs-15); font-weight: var(--fw-semibold); color: var(--text); }

.drawer-search {
  flex: 1;
  display: flex;
  align-items: center;
}
.search-input {
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text);
  font-size: var(--fs-13);
}

.member-content { flex: 1; overflow-y: auto; padding: var(--sp-3); }

/* 邀请弹窗 */
.invite-panel {
  position: sticky;
  bottom: 0;
  margin-top: var(--sp-3);
  padding: var(--sp-3);
  background: var(--bg-elev2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-3);
}
.invite-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-2);
}
.invite-title { font-size: var(--fs-13); font-weight: var(--fw-semibold); color: var(--text); }
.invite-empty { font-size: var(--fs-12); color: var(--text-muted); padding: var(--sp-2) 0; }
.invite-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-1); }
.invite-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background var(--t-fast);
}
.invite-item:hover { background: var(--bg-hover); }
.member-avatar.sm { width: 24px; height: 24px; font-size: var(--fs-11); }
.invite-name { flex: 1; font-size: var(--fs-13); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 栏目标题（桌面端） */
.member-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0 var(--sp-1) var(--sp-2);
}
.member-head-title {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-muted);
  font-weight: 600;
}
.member-head-count {
  background: var(--bg-elev2);
  padding: 1px 8px;
  border-radius: var(--r-full);
  font-size: var(--fs-11);
  color: var(--text-dim);
}

.member-search { margin-bottom: var(--sp-3); }
.search-input {
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text);
  font-size: var(--fs-13);
}

.member-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-1); }
.member-item { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); padding: var(--sp-2); border-radius: var(--r-md); transition: background var(--t-fast); }
.member-item:hover { background: var(--bg-hover); }
.member-avatar { width: 32px; height: 32px; border-radius: var(--r-full); background: var(--c-primary-soft); color: var(--c-primary); display: flex; align-items: center; justify-content: center; font-weight: var(--fw-bold); font-size: var(--fs-13); flex-shrink: 0; }
.member-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.member-name { font-size: var(--fs-13); font-weight: var(--fw-medium); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.member-meta { font-size: var(--fs-11); color: var(--text-muted); }
.member-actions {
  display: flex;
  gap: var(--sp-1);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--t-fast);
}
/* 悬停成员项时显示操作按钮 */
.member-item:hover .member-actions {
  opacity: 1;
  pointer-events: auto;
}
/* 星标编辑器（成员列表内联，独占一行） */
.stars-editor {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  margin-top: var(--sp-1);
}
.stars-input {
  width: 64px;
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-sm);
  border: 1px solid var(--accent);
  background: var(--bg-input);
  color: var(--text);
  font-size: var(--fs-12);
}
.icon-btn-mini { width: 28px; height: 28px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; background: var(--bg-elev2); border: 1px solid var(--border); color: var(--text-dim); transition: background var(--t-fast), color var(--t-fast); }
.icon-btn-mini:hover { background: var(--bg-hover); color: var(--text); }
.icon-btn-mini.danger:hover { background: var(--c-danger-soft); color: var(--c-danger); border-color: var(--c-danger); }
.empty-state { padding: var(--sp-4); text-align: center; color: var(--text-muted); font-size: var(--fs-13); }

@media (min-width: 861px) {
  .drawer-header { display: none !important; }
  .member-list { position: relative; transform: none !important; width: 240px; }
  .member-search { margin-bottom: var(--sp-3); }
}
</style>