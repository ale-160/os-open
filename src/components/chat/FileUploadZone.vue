<script setup>
import { ref } from 'vue'
import {
  IconFile,
  IconImage,
  IconVideo,
  IconVoice,
  IconX,
  IconPlus
} from '../icons'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  maxSize: { type: Number, default: 100 * 1024 * 1024 }
})

const emit = defineEmits(['file', 'progress', 'remove'])

const dragOver = ref(false)
const files = ref([])

function onDrop(e) {
  e.preventDefault()
  dragOver.value = false
  handleFiles(e.dataTransfer.files)
}

function onDragOver(e) {
  e.preventDefault()
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

function onInput(e) {
  handleFiles(e.target.files)
  e.target.value = ''
}

function handleFiles(fileList) {
  Array.from(fileList).forEach(f => {
    if (f.size > props.maxSize) {
      emit('progress', { file: f, error: '文件过大' })
      return
    }
    files.value.push({ file: f, progress: 0, id: Date.now() + Math.random() })
    emit('file', f)
  })
}

function removeFile(id) {
  files.value = files.value.filter(f => f.id !== id)
  emit('remove', id)
}

function formatBytes(b) {
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(1) + ' MB'
}

function fileIcon(f) {
  if (f.type?.startsWith('image/')) return 'IconImage'
  if (f.type?.startsWith('video/')) return 'IconVideo'
  if (f.type?.startsWith('audio/')) return 'IconVoice'
  return 'IconFile'
}
</script>

<template>
  <div class="upload-zone" :class="{ active: dragOver }" @drop="onDrop" @dragover="onDragOver" @dragleave="onDragLeave">
    <input type="file" ref="fileInput" multiple @change="onInput" class="hidden" accept="image/*,video/*,audio/*,application/*" :disabled="props.disabled" />
    <button v-if="files.length === 0" class="upload-btn" @click="$refs.fileInput.click()" :disabled="props.disabled">
      <IconPlus :size="24" />
      <span>拖拽或点击上传文件</span>
      <span class="hint">支持图片/视频/音频/文档，单文件 ≤ {{ formatBytes(maxSize) }}</span>
    </button>

    <div v-else class="file-list">
      <div v-for="f in files" :key="f.id" class="file-item">
        <component :is="fileIcon(f.file)" :size="24" class="file-icon" />
        <div class="file-info">
          <span class="file-name">{{ f.file.name }}</span>
          <span class="file-size">{{ formatBytes(f.file.size) }}</span>
          <progress v-if="f.progress < 100" :value="f.progress" max="100" class="file-progress"></progress>
        </div>
        <button class="icon-btn-mini danger" @click="removeFile(f.id)"><IconX :size="14" /></button>
      </div>
      <button v-if="files.length" class="upload-submit" @click="() => files.forEach(f => emit('file', f.file))">发送 {{ files.length }} 个文件</button>
    </div>
  </div>
</template>

<style scoped>
.upload-zone {
  padding: var(--sp-4);
  border: 2px dashed var(--border);
  border-radius: var(--r-lg);
  background: var(--bg-input);
  transition: border-color var(--t-fast), background var(--t-fast);
}
.upload-zone.active { border-color: var(--accent); background: var(--c-primary-soft); }
.upload-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  padding: var(--sp-6) var(--sp-4);
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  transition: color var(--t-fast);
}
.upload-btn:hover { color: var(--accent); }
.upload-btn .hint { font-size: var(--fs-11); color: var(--text-muted); }
.file-list { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-3); }
.file-item {
  display: flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-2);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}
.file-icon { color: var(--accent); flex-shrink: 0; }
.file-info { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.file-name { font-size: var(--fs-12); font-weight: var(--fw-medium); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-size { font-size: var(--fs-11); color: var(--text-muted); }
.file-progress { width: 100%; height: 4px; border-radius: var(--r-full); accent-color: var(--accent); }
.upload-submit {
  width: 100%;
  padding: var(--sp-2);
  border-radius: var(--r-md);
  background: var(--accent);
  border: none;
  color: white;
  font-weight: var(--fw-semibold);
  font-size: var(--fs-13);
}
</style>