<script setup>
import { ref, computed, watch } from 'vue'
import { CONFIG } from '../config.js'
import { IconLock, IconUser, IconChat, IconEdit } from './icons'

const props = defineProps({
  rooms: { type: Array, default: () => [] },
  currentRoom: { type: String, default: '' },
  online: { type: Boolean, default: false },
  searching: { type: Boolean, default: false },
  joinedRooms: { type: Array, default: () => [] }
})

const emit = defineEmits(['join'])

// 筛选标签：all=全部, joined=已加入, saved=已保存
const filterTab = ref('all')

// 分页：当前显示的房间数
const visibleCount = ref(CONFIG.ROOM_PAGE_SIZE)

// 房间列表变化时重置分页
watch(
  () => props.rooms,
  () => {
    visibleCount.value = CONFIG.ROOM_PAGE_SIZE
  }
)

// 已加入房间名集合
const joinedNames = computed(() => new Set(props.joinedRooms.map((r) => r.name)))
// 已保存房间名集合（从 localStorage 读取的已加入房间）
const savedNames = computed(() => {
  try {
    const raw = localStorage.getItem('nchat:rooms')
    if (!raw) return new Set()
    const list = JSON.parse(raw)
    return new Set(list.map((r) => r.name))
  } catch {
    return new Set()
  }
})

// 按筛选标签过滤
const filteredByTab = computed(() => {
  if (filterTab.value === 'all') return props.rooms
  if (filterTab.value === 'joined') {
    return props.rooms.filter((r) => joinedNames.value.has(r.name))
  }
  if (filterTab.value === 'saved') {
    return props.rooms.filter((r) => savedNames.value.has(r.name))
  }
  return props.rooms
})

const visibleRooms = computed(() => filteredByTab.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < filteredByTab.value.length)

// 各分类计数
const allCount = computed(() => props.rooms.length)
const joinedCount = computed(() => props.rooms.filter((r) => joinedNames.value.has(r.name)).length)
const savedCount = computed(() => props.rooms.filter((r) => savedNames.value.has(r.name)).length)

function loadMore() {
  visibleCount.value += CONFIG.ROOM_PAGE_SIZE
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return Math.floor(diff / 86400000) + '天前'
}

function accessIconName(rules) {
  if (!rules) return ''
  if (rules.access === 'password') return 'lock'
  if (rules.access === 'approve') return 'user'
  if (rules.access === 'invite') return 'chat'
  return ''
}

function speakIconName(rules) {
  if (!rules) return ''
  if (rules.speak === 'whitelist') return 'chat'
  if (rules.speak === 'approve') return 'edit'
  return ''
}
</script>

<template>
  <div class="room-list">
    <div class="room-filter-tabs">
      <button
        class="filter-tab"
        :class="{ active: filterTab === 'all' }"
        @click="filterTab = 'all'; visibleCount = CONFIG.ROOM_PAGE_SIZE"
      >
        全部 <span class="tab-count">{{ allCount }}</span>
      </button>
      <button
        class="filter-tab"
        :class="{ active: filterTab === 'joined' }"
        @click="filterTab = 'joined'; visibleCount = CONFIG.ROOM_PAGE_SIZE"
      >
        已加入 <span class="tab-count">{{ joinedCount }}</span>
      </button>
      <button
        class="filter-tab"
        :class="{ active: filterTab === 'saved' }"
        @click="filterTab = 'saved'; visibleCount = CONFIG.ROOM_PAGE_SIZE"
      >
        已保存 <span class="tab-count">{{ savedCount }}</span>
      </button>
    </div>

    <div class="list-body">
      <div v-if="!visibleRooms.length" class="empty">
        <p v-if="searching">未找到匹配的房间</p>
        <p v-else-if="filterTab === 'joined'">未加入任何房间</p>
        <p v-else-if="filterTab === 'saved'">未保存任何房间</p>
        <p v-else>暂未发现房间</p>
        <p class="sub" v-if="!searching && filterTab === 'all'">点击「创建」发起第一个房间</p>
        <p class="sub" v-else-if="searching">尝试其他关键词或清除搜索</p>
      </div>
      <button
        v-for="r in visibleRooms"
        :key="r.name"
        class="room-item"
        :class="{ active: r.name === currentRoom }"
        @click="emit('join', r)"
      >
        <div class="room-name">
          <span class="room-icons">
            <IconLock v-if="accessIconName(r.rules) === 'lock'" :size="12" :title="'准入: ' + r.rules?.access" />
            <IconUser v-else-if="accessIconName(r.rules) === 'user'" :size="12" :title="'准入: ' + r.rules?.access" />
            <IconChat v-else-if="accessIconName(r.rules) === 'chat'" :size="12" :title="'准入: ' + r.rules?.access" />
            <IconChat v-if="speakIconName(r.rules) === 'chat'" :size="12" :title="'发言: ' + r.rules?.speak" />
            <IconEdit v-else-if="speakIconName(r.rules) === 'edit'" :size="12" :title="'发言: ' + r.rules?.speak" />
          </span>
          {{ r.name }}
          <span v-if="joinedNames.has(r.name)" class="room-badge joined">已加入</span>
        </div>
        <div class="room-aliases" v-if="r.aliases && r.aliases.length">
          {{ r.aliases.join(' · ') }}
        </div>
        <div class="room-meta">
          <span class="members">{{ r.memberCount > 0 ? `${r.memberCount}人在线` : '暂无成员' }}</span>
          <span class="ago" v-if="r.lastUpdate">{{ timeAgo(r.lastUpdate) }}</span>
        </div>
      </button>
      <button v-if="hasMore" class="load-more-btn" @click="loadMore">
        加载更多（剩余 {{ filteredByTab.length - visibleCount }} 个）
      </button>
    </div>
  </div>
</template>
