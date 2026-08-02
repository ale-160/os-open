<script setup>
import { ref, computed, watch } from 'vue'
import { CONFIG } from '../config.js'
import { IconLock, IconUser, IconChat, IconEdit, IconStar } from './icons'

const props = defineProps({
  rooms: { type: Array, default: () => [] },
  currentRoom: { type: String, default: '' },
  online: { type: Boolean, default: false },
  searching: { type: Boolean, default: false },
  joinedRooms: { type: Array, default: () => [] },
  favorites: { type: Array, default: () => [] }
})

const emit = defineEmits(['join', 'toggle-fav'])

// 筛选标签：discover=发现, joined=已加入, faved=收藏
const filterTab = ref('discover')

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
// 收藏房间名集合
const favNames = computed(() => new Set(props.favorites))

// 排序：收藏 > 已加入 > 其他（组内按在线人数/活跃度降序）
const sortedRooms = computed(() => {
  const score = (r) => {
    if (favNames.value.has(r.name)) return 0
    if (joinedNames.value.has(r.name)) return 1
    return 2
  }
  return [...props.rooms].sort((a, b) => {
    const sa = score(a)
    const sb = score(b)
    if (sa !== sb) return sa - sb
    if ((b.memberCount || 0) !== (a.memberCount || 0)) return (b.memberCount || 0) - (a.memberCount || 0)
    return (b.lastUpdate || 0) - (a.lastUpdate || 0)
  })
})

// 按筛选标签过滤
const filteredByTab = computed(() => {
  if (filterTab.value === 'joined') {
    return sortedRooms.value.filter((r) => joinedNames.value.has(r.name))
  }
  if (filterTab.value === 'faved') {
    return sortedRooms.value.filter((r) => favNames.value.has(r.name))
  }
  return sortedRooms.value
})

const visibleRooms = computed(() => filteredByTab.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < filteredByTab.value.length)

// 各分类计数
const allCount = computed(() => sortedRooms.value.length)
const joinedCount = computed(() => sortedRooms.value.filter((r) => joinedNames.value.has(r.name)).length)
const favedCount = computed(() => sortedRooms.value.filter((r) => favNames.value.has(r.name)).length)

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
        :class="{ active: filterTab === 'discover' }"
        @click="filterTab = 'discover'; visibleCount = CONFIG.ROOM_PAGE_SIZE"
      >
        发现 <span class="tab-count">{{ allCount }}</span>
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
        :class="{ active: filterTab === 'faved' }"
        @click="filterTab = 'faved'; visibleCount = CONFIG.ROOM_PAGE_SIZE"
      >
        收藏 <span class="tab-count">{{ favedCount }}</span>
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
        <!-- 收藏按钮：房间信息右上角（span 模拟按钮，button 内不可嵌 button） -->
        <span
          class="fav-btn"
          :class="{ faved: favNames.has(r.name) }"
          :title="favNames.has(r.name) ? '取消收藏' : '收藏'"
          role="button"
          @click.stop="emit('toggle-fav', r.name)"
        >
          <IconStar :size="14" :class="{ filled: favNames.has(r.name) }" />
        </span>
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
          <span v-if="favNames.has(r.name)" class="room-badge faved">收藏</span>
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
