<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatBytes, getRoomMessageCount } from '../lib/db.js'

const props = defineProps({
  rooms: { type: Array, default: () => [] },
  joinedRooms: { type: Array, default: () => [] },
  currentRoom: { type: String, default: '' },
  storageStats: { type: Object, default: () => ({ rooms: 0, messages: 0, sizeBytes: 0 }) }
})

const emit = defineEmits(['close', 'switch', 'clear-storage', 'delete-room'])

const tab = ref('joined') // joined | storage
// 房间消息数缓存
const msgCounts = ref({})

onMounted(async () => {
  await refreshMsgCounts()
})

async function refreshMsgCounts() {
  const counts = {}
  for (const r of props.rooms) {
    try {
      counts[r.name] = await getRoomMessageCount(r.name)
    } catch {
      counts[r.name] = 0
    }
  }
  msgCounts.value = counts
}

function accessLabel(rules) {
  if (!rules) return '开放'
  const map = { open: '开放', password: '密码', approve: '审核', invite: '邀请' }
  return map[rules.access] || '开放'
}

function accessIcon(rules) {
  if (!rules) return ''
  const map = { password: '🔒', approve: '🛡', invite: '✉' }
  return map[rules.access] || ''
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card wide">
      <div class="modal-head">
        <span>房间与存储管理</span>
        <button class="btn-mini" @click="emit('close')">✕</button>
      </div>

      <div class="settings-tabs">
        <button
          class="tab-btn"
          :class="{ active: tab === 'joined' }"
          @click="tab = 'joined'"
        >
          已加入房间 ({{ joinedRooms.length }})
        </button>
        <button
          class="tab-btn"
          :class="{ active: tab === 'storage' }"
          @click="tab = 'storage'"
        >
          本地存储
        </button>
      </div>

      <!-- 已加入房间 -->
      <div v-if="tab === 'joined'" class="modal-body">
        <p class="form-hint" v-if="!joinedRooms.length">
          当前未加入任何房间
        </p>
        <div class="room-mgr-list">
          <div v-for="r in joinedRooms" :key="r.name" class="room-mgr-item">
            <div class="room-mgr-info">
              <div class="room-mgr-name">
                <span class="room-icons">
                  <span v-if="accessIcon(r.rules)">{{ accessIcon(r.rules) }}</span>
                </span>
                <span :class="{ active: r.name === currentRoom }">{{ r.name }}</span>
                <span class="room-mgr-tag">{{ accessLabel(r.rules) }}</span>
              </div>
              <div class="room-mgr-meta">
                <span>{{ r.memberCount }} 人在线</span>
                <span>·</span>
                <span>{{ msgCounts[r.name] || 0 }} 条本地消息</span>
                <span v-if="r.aliases && r.aliases.length">·</span>
                <span v-if="r.aliases && r.aliases.length">{{ r.aliases.join(' / ') }}</span>
              </div>
            </div>
            <div class="room-mgr-actions">
              <button
                class="btn-mini"
                :disabled="r.name === currentRoom"
                @click="emit('switch', r.name)"
              >
                切换
              </button>
              <button
                class="btn-mini danger"
                @click="emit('delete-room', r.name)"
              >
                离开并删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 本地存储管理 -->
      <div v-if="tab === 'storage'" class="modal-body">
        <div class="storage-summary">
          <div class="storage-stat">
            <span class="stat-num">{{ storageStats.rooms }}</span>
            <span class="stat-label">房间记录</span>
          </div>
          <div class="storage-stat">
            <span class="stat-num">{{ storageStats.messages }}</span>
            <span class="stat-label">消息总数</span>
          </div>
          <div class="storage-stat">
            <span class="stat-num">{{ formatBytes(storageStats.sizeBytes) }}</span>
            <span class="stat-label">占用空间</span>
          </div>
        </div>

        <p class="form-hint" v-if="!rooms.length">本地无存储的房间</p>
        <div class="room-mgr-list">
          <div v-for="r in rooms" :key="r.name" class="room-mgr-item">
            <div class="room-mgr-info">
              <div class="room-mgr-name">
                <span :class="{ active: r.name === currentRoom }">{{ r.name }}</span>
              </div>
              <div class="room-mgr-meta">
                <span>{{ msgCounts[r.name] || 0 }} 条消息</span>
                <span v-if="r.aliases && r.aliases.length">·</span>
                <span v-if="r.aliases && r.aliases.length">{{ r.aliases.join(' / ') }}</span>
              </div>
            </div>
            <div class="room-mgr-actions">
              <button
                class="btn-mini danger"
                @click="emit('clear-storage', r.name)"
              >
                清空数据
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>
