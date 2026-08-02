<script setup>
import { ref, computed } from 'vue'
import {
  IconBack,
  IconLeave,
  IconAnnounce,
  IconPin,
  IconMenu,
  IconEdit,
  IconCheck,
  IconClose
} from '../icons'

const props = defineProps({
  currentRoom: { type: String, default: '' },
  announcement: { type: Object, default: null },
  canSetAnnouncement: { type: Boolean, default: false },
  pinnedMsgIds: { type: Array, default: () => [] },
  online: { type: Boolean, default: false },
  memberCount: { type: Number, default: 0 },
  inRoom: { type: Boolean, default: false },
})

const emit = defineEmits(['back', 'leave', 'set-announcement', 'toggle-pin', 'more'])

const showAnnouncement = computed(() => !!props.announcement?.text)
const editingAnnouncement = ref(false)
const announcementDraft = ref('')

function startEditAnn() {
  editingAnnouncement.value = true
  announcementDraft.value = props.announcement?.text || ''
}

function saveAnn() {
  emit('set-announcement', announcementDraft.value.trim())
  editingAnnouncement.value = false
}

function cancelAnn() {
  editingAnnouncement.value = false
}

function clearAnn() {
  emit('set-announcement', '')
  editingAnnouncement.value = false
}
</script>

<template>
  <header class="chat-header" :class="{ 'has-announcement': showAnnouncement }">
    <div class="header-left">
      <button v-if="!inRoom" class="icon-btn" @click="emit('back')" title="返回">
        <IconBack :size="20" />
      </button>
      <div class="room-title" v-else>
        <span class="room-name"># {{ currentRoom }}</span>
        <span class="room-meta">{{ memberCount }} 人 · {{ online ? '在线' : '离线' }}</span>
      </div>
    </div>

    <div class="header-center" v-if="showAnnouncement">
      <div class="announcement" v-if="!editingAnnouncement">
        <IconAnnounce :size="14" class="announce-icon" />
        <span class="announce-text">{{ announcement.text }}</span>
        <button v-if="canSetAnnouncement" class="icon-btn-mini" @click="startEditAnn" title="编辑">
          <IconEdit :size="12" />
        </button>
      </div>
      <div class="announcement-editor" v-else>
        <input v-model="announcementDraft" class="announce-input" @keydown.enter="saveAnn" @keydown.esc="cancelAnn" autofocus />
        <button class="icon-btn-mini primary" @click="saveAnn"><IconCheck :size="12" /></button>
        <button class="icon-btn-mini" @click="cancelAnn"><IconClose :size="12" /></button>
      </div>
    </div>

    <div class="header-right">
      <button v-if="pinnedMsgIds.length" class="icon-btn" @click="emit('toggle-pin', pinnedMsgIds[0])" title="置顶消息">
        <IconPin :size="18" class="filled" />
      </button>
      <button v-if="inRoom" class="icon-btn danger" @click="emit('leave')" title="离开房间">
        <IconLeave :size="18" />
      </button>
      <button class="icon-btn" @click="emit('more')" title="更多">
        <IconMenu :size="20" />
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
.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 0;
}
.announcement {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  background: var(--c-warning-soft);
  border: 1px solid var(--c-warning);
  border-radius: var(--r-md);
  color: var(--c-warning);
  font-size: var(--fs-12);
  max-width: 400px;
}
.announce-icon { flex-shrink: 0; }
.announce-text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.announcement-editor {
  display: flex;
  gap: var(--sp-2);
  max-width: 400px;
}
.announce-input {
  flex: 1;
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-sm);
  border: 1px solid var(--accent);
  background: var(--bg-input);
  color: var(--text);
  font-size: var(--fs-12);
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