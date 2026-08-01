<script setup>
import { ref, watch, computed } from 'vue'
import { IconCheck, IconClose, IconUp, IconDown, IconEdit } from './icons'

const props = defineProps({
  members: { type: Array, default: () => [] },
  isOwner: { type: Boolean, default: false },
  canApprove: { type: Boolean, default: false },
  pendingRequests: { type: Array, default: () => [] },
  roomBanBelow: { type: Number, default: 0 },
  myBanBelow: { type: Number, default: 0 }
})

const emit = defineEmits(['reorder', 'set-stars', 'approve', 'reject', 'set-ban', 'set-room-ban'])

// 本地排序覆盖：peerId -> 手动顺序（仅 owner 操作，本地生效）
const orderOverride = ref(new Map())
const orderedMembers = ref([])
const starsEditing = ref(null) // peerId 正在编辑星标
const starsInput = ref(1)

// 屏蔽设置弹层
const banEditing = ref(false)
const banInput = ref(0)
const banMode = ref('personal') // personal | room

function rebuild() {
  const list = [...props.members]
  // 有覆盖顺序的按覆盖排，其余按原序
  list.sort((a, b) => {
    const oa = orderOverride.value.get(a.peerId) ?? 9999
    const ob = orderOverride.value.get(b.peerId) ?? 9999
    return oa - ob
  })
  orderedMembers.value = list
}

watch(() => props.members, rebuild, { immediate: true, deep: true })

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

// 屏蔽设置
function openBanEditor(mode) {
  banMode.value = mode
  banInput.value = mode === 'room' ? props.roomBanBelow : props.myBanBelow
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
  <div class="member-list">
    <!-- 待处理加入申请（审核制房间） -->
    <div v-if="canApprove && pendingRequests.length" class="pending-section">
      <div class="list-head">
        <span>待审核申请</span>
        <span class="list-count warn">{{ pendingRequests.length }}</span>
      </div>
      <div class="list-body compact">
        <div v-for="req in pendingRequests" :key="req.peerId" class="pending-item">
          <div class="pending-info">
            <span class="member-name">{{ req.name }}</span>
            <span class="pending-time">{{ new Date(req.timestamp).toLocaleTimeString() }}</span>
          </div>
          <div class="pending-actions">
            <button class="btn-mini primary icon-only-btn" title="批准" @click="emit('approve', req.peerId)">
              <IconCheck :size="14" />
            </button>
            <button class="btn-mini danger icon-only-btn" title="拒绝" @click="emit('reject', req.peerId)">
              <IconClose :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="list-head">
      <span>在线成员</span>
      <span class="list-count">{{ members.length }}</span>
    </div>
    <div class="list-body">
      <div v-if="!members.length" class="empty">
        <p>未加入房间</p>
      </div>
      <div v-for="(m, i) in orderedMembers" :key="m.peerId" class="member-item">
        <span class="dot" :class="m.status || 'online'"></span>
        <span class="member-name" :class="{ self: m.self }">
          {{ m.name || (m.peerId || '').slice(0, 8) }}
        </span>
        <!-- 星标显示：仅显示数字和一个★ -->
        <span class="stars-badge" :class="{ creator: m.isOwner }" :title="m.isOwner ? '创建者' : '星标: ' + (m.stars || 1)">
          {{ m.stars || 1 }}★
        </span>
        <div v-if="isOwner && !m.self && orderedMembers.length > 1" class="reorder-btns">
          <button class="btn-mini icon-only-btn" :disabled="i === 0" title="上移" @click="moveUp(m.peerId)">
            <IconUp :size="14" />
          </button>
          <button class="btn-mini icon-only-btn" :disabled="i === orderedMembers.length - 1" title="下移" @click="moveDown(m.peerId)">
            <IconDown :size="14" />
          </button>
        </div>
        <!-- owner 可调整星标 -->
        <div v-if="isOwner && !m.self" class="stars-control">
          <button v-if="starsEditing !== m.peerId" class="btn-mini icon-only-btn" @click="startEditStars(m)" title="调整星标">
            <IconEdit :size="14" />
          </button>
          <div v-else class="stars-edit">
            <input
              class="stars-input"
              v-model.number="starsInput"
              type="number"
              min="1"
              max="99"
              @keyup.enter="commitStars"
              @keyup.esc="cancelEditStars"
            />
            <button class="btn-mini primary icon-only-btn" title="确定" @click="commitStars">
              <IconCheck :size="14" />
            </button>
            <button class="btn-mini icon-only-btn" title="取消" @click="cancelEditStars">
              <IconClose :size="14" />
            </button>
          </div>
        </div>
        <!-- 有审核权限的成员可邀请（向未加入的节点） -->
        <div v-if="canApprove && !m.self && !m.isOwner" class="invite-control">
          <!-- 邀请通过节点列表触发，此处仅显示权限标记 -->
        </div>
      </div>
    </div>

    <!-- 屏蔽设置 -->
    <div class="list-head second">
      <span>屏蔽设置</span>
    </div>
    <div class="ban-section">
      <div class="ban-row">
        <span class="ban-label">个人屏蔽</span>
        <span class="ban-value" v-if="myBanBelow > 0">
          &lt; {{ myBanBelow }}★
        </span>
        <span class="ban-value muted" v-else>未启用</span>
        <button class="btn-mini" @click="openBanEditor('personal')">设置</button>
      </div>
      <p class="ban-hint">屏蔽星标低于阈值的用户发言</p>

      <div class="ban-row" v-if="isOwner">
        <span class="ban-label">房间默认</span>
        <span class="ban-value" v-if="roomBanBelow > 0">
          &lt; {{ roomBanBelow }}★
        </span>
        <span class="ban-value muted" v-else>未启用</span>
        <button class="btn-mini" @click="openBanEditor('room')">设置</button>
      </div>
      <p class="ban-hint" v-if="isOwner">所有成员都会屏蔽低于此星标的发言</p>
    </div>

    <!-- 屏蔽设置弹层 -->
    <div v-if="banEditing" class="ban-edit-overlay" @click.self="cancelBan">
      <div class="ban-edit-card">
        <h4>{{ banMode === 'room' ? '房间默认屏蔽' : '个人屏蔽' }}</h4>
        <p class="ban-edit-hint">
          屏蔽星标 <strong>&lt; {{ Number(banInput) || 0 }}★</strong> 的用户发言
          <span v-if="banMode === 'personal'">（自身及更高星标不受影响）</span>
        </p>
        <input
          class="ban-input"
          v-model.number="banInput"
          type="range"
          min="0"
          max="99"
          step="1"
        />
        <div class="ban-edit-value">当前：{{ Number(banInput) || 0 }}（0=关闭）</div>
        <div class="ban-edit-actions">
          <button class="btn-mini" @click="cancelBan">取消</button>
          <button class="btn-mini primary" @click="commitBan">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>
