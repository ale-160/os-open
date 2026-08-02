<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import MessageItem from './MessageItem.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  myPeerId: { type: String, default: '' },
  locateMsgId: { type: String, default: '' },
  pinnedIds: { type: Array, default: () => [] },
  starredIds: { type: Array, default: () => [] },
  multiSelect: { type: Boolean, default: false },
  selectedIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['edit', 'recall', 'toggle-pin', 'react', 'download', 'reply', 'locate', 'toggle-star', 'multi-select', 'toggle-select', 'retry-message'])

const listRef = ref(null)
const editingId = ref(null)
const editDraft = ref('')

// ---- 智能自动滚动：用户手动向上翻看历史时，新消息不再强制拉回底部 ----
let userScrolledUp = false
function onListScroll() {
  const el = listRef.value
  if (!el) return
  userScrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 80
  // 滚动条：滚动时短暂显示，2s 无滚动后隐藏
  el.classList.add('show-scrollbar')
  clearTimeout(scrollbarTimer)
  scrollbarTimer = setTimeout(() => el.classList.remove('show-scrollbar'), 2000)
}
let scrollbarTimer = null
onUnmounted(() => clearTimeout(scrollbarTimer))

/** 强制滚到底部（切换房间/定位时调用） */
function scrollToBottom() {
  const el = listRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

watch(() => props.messages.length, async () => {
  await nextTick()
  if (!userScrolledUp) scrollToBottom()
})

defineExpose({ scrollToBottom })

watch(() => props.locateMsgId, async (id) => {
  if (id) {
    await nextTick()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
})

function startEdit(m) {
  editingId.value = m.id
  editDraft.value = m.text
}

function saveEdit() {
  if (!editingId.value) return
  const m = props.messages.find((x) => x.id === editingId.value)
  if (!m) {
    editingId.value = null
    return
  }
  emit('edit', { msg: m, text: editDraft.value.trim() })
  editingId.value = null
}

function updateDraft(text) {
  editDraft.value = text
}

function cancelEdit() {
  editingId.value = null
  editDraft.value = ''
}

function onRecall(m) {
  emit('recall', m)
}

function onReact(payload) {
  // MessageItem 已计算 action(add/remove)，直接透传
  emit('react', payload)
}

function onDownload(file) {
  emit('download', file)
}
</script>

<template>
  <div ref="listRef" class="message-list" role="log" aria-live="polite" @scroll="onListScroll">
    <MessageItem
      v-for="m in messages"
      :key="m.id"
      :msg="m"
      :my-peer-id="myPeerId"
      :editing="editingId === m.id"
      :draft="editDraft"
      :highlight="locateMsgId === m.id"
      :pinned-ids="pinnedIds"
      :starred-ids="starredIds"
      :multi-select="multiSelect"
      :selected="selectedIds.includes(m.id)"
      @edit="startEdit"
      @save-edit="saveEdit"
      @update-draft="updateDraft"
      @cancel-edit="cancelEdit"
      @recall="onRecall"
      @toggle-pin="emit('toggle-pin', $event)"
      @react="onReact"
      @download="onDownload"
      @reply="emit('reply', $event)"
      @locate="emit('locate', $event)"
      @toggle-star="emit('toggle-star', $event)"
      @retry-message="emit('retry-message', $event)"
      @multi-select="emit('multi-select', $event)"
      @toggle-select="emit('toggle-select', $event)"
    />
    <div class="scroll-anchor" ref="anchor" />
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--sp-4) var(--sp-4) var(--sp-6);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.2s;
}
/* 滚动条：默认隐藏（保持极简），用户滚动时短暂显示 2s */
.message-list::-webkit-scrollbar { width: 6px; }
.message-list::-webkit-scrollbar-track { background: transparent; }
.message-list::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.2s;
}
.message-list.show-scrollbar {
  scrollbar-color: var(--bg-elev3) transparent;
}
.message-list.show-scrollbar::-webkit-scrollbar-thumb {
  background: var(--bg-elev3);
}
.scroll-anchor { height: 1px; }
</style>