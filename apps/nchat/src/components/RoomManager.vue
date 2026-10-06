<script setup>
import { ref, onMounted } from 'vue'
import { formatBytes, getRoomMessageCount } from '../lib/db.js'
import { IconClose } from './icons'

const props = defineProps({
  rooms: { type: Array, default: () => [] },
  currentRoom: { type: String, default: '' },
  storageStats: { type: Object, default: () => ({ rooms: 0, messages: 0, sizeBytes: 0 }) }
})

const emit = defineEmits(['close', 'clear-storage'])

// 房间列表用打开时的快照（静态，不随广播动态变化）
const roomSnapshot = ref([])
// 房间消息数缓存
const msgCounts = ref({})

onMounted(async () => {
  roomSnapshot.value = [...props.rooms]
  const counts = {}
  for (const r of roomSnapshot.value) {
    try {
      counts[r.name] = await getRoomMessageCount(r.name)
    } catch {
      counts[r.name] = 0
    }
  }
  msgCounts.value = counts
})
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card wide">
      <div class="modal-head">
        <span>存储管理</span>
        <button class="btn-mini icon-only-btn" title="关闭" @click="emit('close')">
          <IconClose :size="16" />
        </button>
      </div>

      <div class="modal-body">
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

        <p class="form-hint" v-if="!roomSnapshot.length">本地无存储的房间</p>
        <div class="room-mgr-list">
          <div v-for="r in roomSnapshot" :key="r.name" class="room-mgr-item">
            <div class="room-mgr-info">
              <div class="room-mgr-name">
                <span :class="{ active: r.name === currentRoom }">{{ r.name }}</span>
                <span v-if="r.name === currentRoom" class="room-mgr-tag">当前</span>
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
                删除并退出
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
