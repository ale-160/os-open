<script setup>
import { ref, computed, watch } from 'vue'
import { IconAnnounce, IconEdit, IconClose, IconCheck } from '../icons'

const props = defineProps({
  announcement: { type: Object, default: null },
  canSetAnnouncement: { type: Boolean, default: false },
  editMode: { type: Boolean, default: false },
})

const emit = defineEmits(['set-announcement', 'close-edit'])

const showAnnouncement = computed(() => !!props.announcement?.text)
const editingAnnouncement = ref(false)
const announcementDraft = ref('')

// 标题栏公告按钮触发编辑模式
watch(
  () => props.editMode,
  (v) => {
    if (v) startEditAnnouncement()
  }
)

function startEditAnnouncement() {
  announcementDraft.value = props.announcement?.text || ''
  editingAnnouncement.value = true
  emit('close-edit')
}

function saveAnnouncement() {
  emit('set-announcement', announcementDraft.value.trim())
  editingAnnouncement.value = false
  announcementDraft.value = ''
}

function cancelEditAnnouncement() {
  editingAnnouncement.value = false
  announcementDraft.value = ''
}

function clearAnnouncement() {
  emit('set-announcement', '')
  editingAnnouncement.value = false
  announcementDraft.value = ''
}
</script>

<template>
  <!-- 无公告且非编辑模式时不渲染 -->
  <div v-if="showAnnouncement || editingAnnouncement" class="announcement-bar">
    <div v-if="showAnnouncement && !editingAnnouncement" class="announcement-display">
      <span class="announcement-icon"><IconAnnounce :size="16" /></span>
      <span class="announcement-text">{{ announcement.text }}</span>
      <span class="announcement-meta" v-if="announcement.name">— {{ announcement.name }}</span>
      <button v-if="canSetAnnouncement" class="btn-mini icon-only-btn announcement-edit-btn" title="编辑公告" @click="startEditAnnouncement">
        <IconEdit :size="14" />
      </button>
    </div>
    <div v-else-if="editingAnnouncement" class="announcement-editor">
      <IconAnnounce :size="16" />
      <input class="input announcement-input" v-model="announcementDraft" type="text" placeholder="输入公告内容…" @keyup.enter="saveAnnouncement" autofocus />
      <button class="btn-mini primary" title="保存" @click="saveAnnouncement">保存</button>
      <button v-if="announcement?.text" class="btn-mini danger" title="清除公告" @click="clearAnnouncement">清除</button>
      <button class="btn-mini icon-only-btn" title="取消" @click="cancelEditAnnouncement"><IconClose :size="14" /></button>
    </div>
  </div>
</template>

<style scoped>
.announcement-bar {
  display: flex;
  align-items: center;
  padding: var(--sp-2) var(--sp-4);
  background: var(--bg-elev2);
  border-bottom: 1px solid var(--border-soft);
  gap: var(--sp-2);
  min-height: 36px;
}
.announcement-display {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  min-width: 0;
}
.announcement-icon { color: var(--c-warning); flex-shrink: 0; display: flex; align-items: center; }
.announcement-text {
  font-size: var(--fs-13);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.announcement-meta { font-size: var(--fs-11); color: var(--text-muted); flex-shrink: 0; }
.announcement-edit-btn { flex-shrink: 0; opacity: 0.6; }
.announcement-edit-btn:hover { opacity: 1; }
.announcement-editor {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
}
.announcement-editor .announcement-icon { color: var(--c-warning); }
.announcement-input { flex: 1; min-width: 0; }
.announcement-empty-hint {
  display: flex;
  align-items: center;
  padding: var(--sp-1) var(--sp-3);
  min-height: 28px;
}
.announcement-empty-hint .btn-mini { opacity: 0.4; min-height: 28px; padding: var(--sp-1) var(--sp-2); }
.announcement-empty-hint .btn-mini:hover { opacity: 1; }
</style>