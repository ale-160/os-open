<script setup>
import { ref, watch, nextTick } from 'vue'
import MessageItem from './MessageItem.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  myPeerId: { type: String, default: '' },
  locateMsgId: { type: String, default: '' },
  pinnedIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['edit', 'recall', 'toggle-pin', 'react', 'download'])

const listRef = ref(null)
const editingId = ref(null)
const editDraft = ref('')

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
  <div ref="listRef" class="message-list" role="log" aria-live="polite">
    <MessageItem
      v-for="m in messages"
      :key="m.id"
      :msg="m"
      :my-peer-id="myPeerId"
      :editing="editingId === m.id"
      :draft="editDraft"
      :highlight="locateMsgId === m.id"
      :pinned-ids="pinnedIds"
      @edit="startEdit"
      @save-edit="saveEdit"
      @update-draft="updateDraft"
      @cancel-edit="cancelEdit"
      @recall="onRecall"
      @toggle-pin="emit('toggle-pin', $event)"
      @react="onReact"
      @download="onDownload"
    />
    <div class="scroll-anchor" ref="anchor" />
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 48px var(--sp-4) var(--sp-6);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  scrollbar-width: thin;
  scrollbar-color: var(--bg-elev3) transparent;
}
.scroll-anchor { height: 1px; }
</style>