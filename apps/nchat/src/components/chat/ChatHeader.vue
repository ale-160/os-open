<script setup>
import { ref, computed } from 'vue'
import {
  IconBack,
  IconLeave,
  IconAnnounce,
  IconPin,
  IconMenu,
  IconUser,
  IconVoice,
  IconSettings
} from '../icons'

const props = defineProps({
  currentRoom: { type: String, default: '' },
  announcement: { type: Object, default: null },
  canSetAnnouncement: { type: Boolean, default: false },
  pinnedMsgIds: { type: Array, default: () => [] },
  online: { type: Boolean, default: false },
  memberCount: { type: Number, default: 0 },
  inRoom: { type: Boolean, default: false },
  memberOpen: { type: Boolean, default: true },
  callOpen: { type: Boolean, default: false },
  typingName: { type: String, default: '' },
})

const emit = defineEmits(['back', 'leave', 'set-announcement', 'toggle-pin', 'more', 'toggle-member', 'toggle-call', 'open-settings', 'edit-announcement'])

// 是否有公告（用于公告按钮高亮）
const showAnnouncement = computed(() => !!props.announcement?.text)
</script>

<template>
  <header class="chat-header">
    <div class="header-left">
      <button class="icon-btn back-btn" @click="emit('back')" title="返回房间列表">
        <IconBack :size="20" />
      </button>
      <div class="room-title">
        <span class="room-name"># {{ currentRoom }}</span>
        <span class="room-meta" v-if="typingName">{{ typingName }} 正在输入…</span>
        <span class="room-meta" v-else>{{ memberCount }} 人 · {{ online ? '在线' : '离线' }}</span>
      </div>
    </div>

    <div class="header-right">
      <button v-if="pinnedMsgIds.length" class="icon-btn" @click="emit('toggle-pin', pinnedMsgIds[0])" title="置顶消息">
        <IconPin :size="18" class="filled" />
      </button>
      <button v-if="inRoom" class="icon-btn danger" @click="emit('leave')" title="退出房间（清除所有聊天记录）">
        <IconLeave :size="18" />
      </button>
      <!-- 发布公告（创建者/高星成员）：点击在公告栏打开编辑器 -->
      <button v-if="canSetAnnouncement" class="icon-btn" :class="{ active: showAnnouncement }" @click="emit('edit-announcement')" title="发布公告">
        <IconAnnounce :size="18" />
      </button>
      <button v-if="inRoom" class="icon-btn" :class="{ active: callOpen }" @click="emit('toggle-call')" :title="callOpen ? '收起音视频通话' : '音视频通话'">
        <IconVoice :size="18" />
      </button>
      <button class="icon-btn" @click="emit('more')" title="更多">
        <IconMenu :size="20" />
      </button>
      <button v-if="inRoom" class="icon-btn" :class="{ active: memberOpen }" @click="emit('toggle-member')" :title="memberOpen ? '收起成员列表' : '展开成员列表'">
        <IconUser :size="18" />
      </button>
      <button class="icon-btn" @click="emit('open-settings')" title="设置">
        <IconSettings :size="18" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--sp-5);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
  gap: var(--sp-3);
}
.header-left {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}
.room-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.room-name {
  font-size: var(--fs-15);
  font-weight: var(--fw-semibold);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.room-meta {
  font-size: var(--fs-11);
  color: var(--text-muted);
}
.header-right {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--r-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elev2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  transition: background var(--t-fast), color var(--t-fast);
}
.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.icon-btn.danger:hover {
  background: var(--c-danger-soft);
  color: var(--c-danger);
  border-color: var(--c-danger);
}
.icon-btn.active {
  background: var(--c-primary-soft);
  color: var(--c-primary);
  border-color: var(--c-primary);
}
.icon-btn-mini {
  width: 24px;
  height: 24px;
  border-radius: var(--r-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elev2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  transition: background var(--t-fast), color var(--t-fast);
}
.icon-btn-mini.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}
</style>