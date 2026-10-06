<script setup>
/**
 * 列表栏（280px 宽）
 * - 桌面端：固定左侧栏，显示 PeerInfo + RoomSearch + RoomList / MessageSearch
 * - 移动端：底部 Sheet（拖拽手柄、房间列表/搜索切换、创建/管理按钮）
 */
import { computed } from 'vue'
import { useLayout } from '@/composables/useLayout.js'
import PeerInfo from './PeerInfo.vue'
import RoomSearch from './RoomSearch.vue'
import RoomList from './RoomList.vue'
import MessageSearch from './MessageSearch.vue'
import { IconPlus, IconSettings, IconX, IconMenu } from './icons'

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
  joinedRooms: { type: Array, default: () => [] },
  favorites: { type: Array, default: () => [] },
  // Phase 2.5: 消息搜索
  messageSearchResults: { type: Array, default: () => [] },
  searchingMessages: { type: Boolean, default: false },
  // 移动端首页全屏模式（未进房时 ListBar 全屏显示房间列表）
  fullscreen: { type: Boolean, default: false }
})

const emit = defineEmits([
  'rename',
  'search',
  'clear',
  'create',
  'join',
  'toggle-fav',
  'invite',
  'manage',
  'menu',
  // Phase 2.5: 消息搜索
  'msg-search',
  'msg-clear',
  'msg-locate'
])

const { isDesktop, listBarOpen, toggleListBar } = useLayout()

// 当前导航标题
const navTitle = computed(() => {
  switch (props.activeNav) {
    case 'chat': return '会话'
    case 'search': return '搜索'
    default: return '会话'
  }
})

// 是否显示创建按钮（仅会话）
const showCreate = computed(() => props.activeNav === 'chat')

// 是否显示管理按钮（仅会话）
const showManage = computed(() => props.activeNav === 'chat')
</script>

<template>
  <aside
    class="list-bar"
    :class="{ sheet: !isDesktop && !fullscreen, open: listBarOpen || (!isDesktop && fullscreen), fullscreen }"
  >
    <!-- Sheet 拖拽手柄（仅移动端） -->
    <div class="sheet-handle" v-if="!isDesktop" @click="toggleListBar">
      <div class="handle-bar"></div>
    </div>

    <!-- Sheet 头部（仅移动端） -->
    <header class="sheet-header" v-if="!isDesktop">
      <button class="icon-btn" @click="emit('menu')" title="菜单"><IconMenu :size="20" /></button>
      <h2 class="sheet-title">{{ navTitle }}</h2>
      <div class="sheet-actions">
        <button v-if="showManage" class="icon-btn" @click="emit('manage'); toggleListBar()" title="管理"><IconSettings :size="20" /></button>
        <button v-if="showCreate" class="icon-btn primary" @click="emit('create'); toggleListBar()" title="创建"><IconPlus :size="20" /></button>
      </div>
    </header>

    <!-- 内容区 -->
    <div class="listbar-content" :class="{ 'has-header': !isDesktop }">
      <div class="listbar-peer" v-if="isDesktop">
        <PeerInfo :state="state" :server-label="serverLabel" @rename="emit('rename', $event)" />
      </div>

      <template v-if="activeNav === 'chat'">
        <div class="listbar-head" v-if="isDesktop">
          <span class="listbar-title">{{ navTitle }}</span>
          <div class="listbar-actions">
            <button v-if="showManage" class="icon-btn-mini" @click="emit('manage')" title="管理">管理</button>
            <button v-if="showCreate" class="icon-btn-mini primary" @click="emit('create')"><IconPlus :size="16" /></button>
          </div>
        </div>
        <RoomSearch :online="online" :keyword="searchKeyword" @search="emit('search', $event)" @clear="emit('clear')" @create="emit('create')" />
        <RoomList :rooms="filteredRooms" :current-room="currentRoom" :online="online" :searching="searching" :joined-rooms="joinedRooms" :favorites="favorites" @join="emit('join', $event)" @toggle-fav="emit('toggle-fav', $event)" @invite="emit('invite', $event)" />
      </template>

      <template v-else-if="activeNav === 'search'">
        <div class="listbar-head" v-if="isDesktop"><span class="listbar-title">{{ navTitle }}</span></div>
        <MessageSearch :results="messageSearchResults" :searching="searchingMessages" @search="emit('msg-search', $event)" @clear="emit('msg-clear')" @locate="emit('msg-locate', $event)" />
      </template>
    </div>
  </aside>
</template>

<style scoped>
.list-bar {
  width: 280px;
  flex-shrink: 0;
  height: 100%;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition: transform var(--t-base) var(--ease-out);
  z-index: var(--z-drawer);
}

.list-bar.sheet {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  width: 100%;
  height: 60vh;
  max-height: 80vh;
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  border-right: none;
  border-top: 1px solid var(--border-soft);
  box-shadow: var(--shadow-4);
  z-index: var(--z-sheet);
  transform: translateY(100%);
  transition: transform var(--t-base) var(--ease-out);
}

.list-bar.sheet.open { transform: translateY(0); }

/* 移动端首页：全屏显示房间列表（非 Sheet） */
.list-bar.fullscreen {
  position: static;
  width: 100%;
  height: 100%;
  transform: none;
  border-radius: 0;
  border-top: none;
  box-shadow: none;
}

.sheet-handle {
  display: none;
  height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border-soft);
}
.sheet-handle .handle-bar {
  width: 36px; height: 4px;
  border-radius: var(--r-full);
  background: var(--c-neutral-500);
}

.sheet-header {
  display: none;
  padding: var(--sp-3) var(--sp-4);
  display: flex; align-items: center; justify-content: space-between;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border-soft);
}
.sheet-title { font-size: var(--fs-16); font-weight: var(--fw-semibold); color: var(--text); }
.sheet-actions { display: flex; gap: var(--sp-2); }
.icon-btn { width: 40px; height: 40px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; background: var(--bg-elev2); border: 1px solid var(--border); color: var(--text-dim); transition: background var(--t-fast), color var(--t-fast); }
.icon-btn:hover { background: var(--bg-hover); color: var(--text); }
.icon-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--c-white); }
.icon-btn.primary:hover { background: var(--c-primary-hover); }

.listbar-content { flex: 1; overflow-y: auto; padding: var(--sp-2) var(--sp-3); }
.listbar-content.has-header { padding-top: 0; }

/* 用户身份条：覆盖 PeerInfo 的右对齐为左对齐 */
.listbar-peer {
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-elev);
  flex-shrink: 0;
}
.listbar-peer :deep(.peer-info) { align-items: flex-start; width: 100%; }

/* 列表栏头部 */
.listbar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-3);
  flex-shrink: 0;
}
.listbar-title { font-size: var(--fs-13); font-weight: var(--fw-semibold); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.listbar-actions { display: flex; gap: var(--sp-1); }
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
  transition: background var(--t-fast), color var(--t-fast);
}
.icon-btn-mini:hover { background: var(--bg-hover); color: var(--text); }
.icon-btn-mini.primary { background: var(--accent); border-color: var(--accent); color: var(--c-white); }

@media (min-width: 861px) {
  .sheet-handle, .sheet-header { display: none !important; }
  .list-bar { position: relative; transform: none !important; height: 100%; }
}
</style>