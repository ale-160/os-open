<script setup>
import { ref, watch, nextTick } from 'vue'
import MessageItem from './MessageItem.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  myPeerId: { type: String, default: '' },
  locateMsgId: { type: String, default: '' },
})

const emit = defineEmits(['edit', 'recall', 'react', 'download'])

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

function saveEdit(m) {
  emit('edit', { msg: m, text: editDraft.value.trim() })
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
  editDraft.value = ''
}

function onRecall(m) {
  emit('recall', m)
}

function onReact(m, emoji) {
  emit('react', { msgId: m.id, emoji, action: 'add' })
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
      @edit="startEdit"
      @save-edit="saveEdit"
      @cancel-edit="cancelEdit"
      @recall="onRecall"
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
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.scroll-anchor { height: 1px; }
</style>