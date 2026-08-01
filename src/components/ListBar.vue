<script setup>
/**
 * 列表栏（280px 宽）。
 * 内容随 SideNav 的 activeNav 切换：
 *   - chat: PeerInfo + RoomSearch + RoomList（当前主用）
 *   - doc / file / search: 占位（后续 Phase 实现）
 *
 * 顶部固定显示用户身份条（PeerInfo），下方为列表内容。
 */
import { computed } from 'vue'
import PeerInfo from './PeerInfo.vue'
import RoomSearch from './RoomSearch.vue'
import RoomList from './RoomList.vue'
import { IconPlus, IconSearch as IconSearchComp } from './icons'

const props = defineProps({
  activeNav: { type: String, default: 'chat' },
  // PeerInfo
  state: { type: Object, required: true },
  serverLabel: { type: String, default: '' },
  // RoomSearch / RoomList
  online: { type: Boolean, default: false },
  searchKeyword: { type: String, default: '' },
  rooms: { type: Array, default: () => [] },
  filteredRooms: { type: Array, default: () => [] },
  currentRoom: { type: String, default: '' },
  searching: { type: Boolean, default: false },
  joinedRooms: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'rename',
  'search',
  'clear',
  'create',
  'join',
  'manage'
])

// 当前导航标题
const navTitle = computed(() => {
  switch (props.activeNav) {
    case 'chat':
      return '会话'
    case 'doc':
      return '云文档'
    case 'file':
      return '文件'
    case 'search':
      return '搜索'
    default:
      return ''
  }
})

// 是否显示创建按钮（仅会话与文档）
const showCreate = computed(() => props.activeNav === 'chat' || props.activeNav === 'doc')

// 是否显示管理按钮（仅会话）
const showManage = computed(() => props.activeNav === 'chat')

// 是否为已实现视图（chat 已实现，其余为占位）
const isImplemented = computed(() => props.activeNav === 'chat')
</script>

<template>
  <aside class="list-bar">
    <!-- 用户身份条（紧凑） -->
    <div class="listbar-peer">
      <PeerInfo
        :state="state"
        :server-label="serverLabel"
        @rename="emit('rename', $event)"
      />
    </div>

    <!-- 已实现视图：会话 -->
    <template v-if="activeNav === 'chat'">
      <div class="listbar-head">
        <span class="listbar-title">{{ navTitle }}</span>
        <div class="listbar-actions">
          <button
            v-if="showManage"
            class="icon-btn-mini"
            title="管理房间与存储"
            @click="emit('manage')"
          >
            管理
          </button>
          <button
            v-if="showCreate"
            class="icon-btn-mini primary"
            title="创建新房间"
            @click="emit('create')"
          >
            <IconPlus :size="16" />
          </button>
        </div>
      </div>

      <RoomSearch
        :online="online"
        :keyword="searchKeyword"
        @search="emit('search', $event)"
        @clear="emit('clear')"
        @create="emit('create')"
      />

      <RoomList
        :rooms="filteredRooms"
        :current-room="currentRoom"
        :online="online"
        :searching="searching"
        :joined-rooms="joinedRooms"
        @join="emit('join', $event)"
      />
    </template>

    <!-- 占位视图（doc / file / search） -->
    <template v-else>
      <div class="listbar-head">
        <span class="listbar-title">{{ navTitle }}</span>
      </div>
      <div class="listbar-placeholder">
        <IconSearchComp :size="36" />
        <p class="placeholder-title">{{ navTitle }}</p>
        <p class="placeholder-sub">该模块将在后续版本上线</p>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.list-bar {
  width: 280px;
  flex-shrink: 0;
  height: 100%;
  background: var(--bg-elev);
  border-right: 1px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 用户身份条：覆盖 PeerInfo 的右对齐为左对齐 */
.listbar-peer {
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-elev);
  flex-shrink: 0;
}
.listbar-peer :deep(.peer-info) {
  align-items: flex-start;
  width: 100%;
}

/* 列表栏头部 */
.listbar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-3);
  flex-shrink: 0;
}
.listbar-title {
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.listbar-actions {
  display: flex;
  gap: var(--sp-1);
}
.icon-btn-mini {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 28px;
  padding: 2px 8px;
  border-radius: var(--r-xs);
  background: var(--bg-elev2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: var(--fs-12);
  transition: background 0.15s, color 0.15s;
}
.icon-btn-mini:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.icon-btn-mini.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--c-white);
}
.icon-btn-mini.primary:hover {
  background: var(--accent-hover);
}

/* 占位视图 */
.listbar-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  color: var(--text-muted);
  padding: var(--sp-4);
  text-align: center;
}
.placeholder-title {
  margin: 0;
  font-size: var(--fs-15);
  font-weight: 600;
  color: var(--text-dim);
}
.placeholder-sub {
  margin: 0;
  font-size: var(--fs-12);
  color: var(--text-muted);
}

/* RoomSearch 在 ListBar 内去掉自身边框（避免双边界） */
.list-bar :deep(.room-search) {
  padding: var(--sp-2) var(--sp-3);
}

/* 移动端：列表栏占满全宽（SideNav 隐藏） */
@media (max-width: 860px) {
  .list-bar {
    width: 100%;
    border-right: none;
  }
}
</style>
