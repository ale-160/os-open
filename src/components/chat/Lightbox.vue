<script setup>
import { ref, computed } from 'vue'
import { IconClose, IconDownload } from '../icons'

const props = defineProps({
  file: { type: Object, default: null },
  downloading: { type: Boolean, default: false },
  downloadFailed: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'retry', 'download'])

function fileSrc(file) {
  return file?.blobUrl || file?.dataUrl || ''
}

function isImage(type) {
  return ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'].includes(type)
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
</script>

<template>
  <div v-if="file" class="lightbox-overlay" @click.self="emit('close')">
    <div class="lightbox-card">
      <div class="lightbox-head">
        <span class="file-name" :title="file.name">{{ file.name }}</span>
        <span class="file-size">{{ formatSize(file.size) }}</span>
        <button class="btn-mini icon-only-btn" title="关闭" @click="emit('close')">
          <IconClose :size="16" />
        </button>
      </div>
      <div class="lightbox-body">
        <!-- 完整原图 -->
        <img
          v-if="file.blobUrl || file.dataUrl"
          :src="fileSrc(file)"
          :alt="file.name"
          class="lightbox-img"
        />
        <!-- 元信息模式：缩略图 + 正在加载原图 -->
        <div v-else-if="file.thumbDataUrl" class="lightbox-loading">
          <img :src="file.thumbDataUrl" :alt="file.name" class="lightbox-thumb" />
          <p v-if="!downloadFailed" v-show="!downloading">正在加载原图…</p>
          <p v-if="downloading" class="downloading">下载中…</p>
          <p v-else class="download-fail">⚠ 加载失败：发送者可能已离线或刷新页面</p>
          <button v-if="downloadFailed" class="btn-mini primary" @click="emit('retry')">重试</button>
        </div>
        <div v-else class="lightbox-loading">
          <p v-if="!downloadFailed" v-show="!downloading">正在加载…</p>
          <p v-if="downloading" class="downloading">下载中…</p>
          <p v-else class="download-fail">⚠ 加载失败：发送者可能已离线或刷新页面</p>
          <button v-if="downloadFailed" class="btn-mini primary" @click="emit('retry')">重试</button>
        </div>
      </div>
      <div class="lightbox-foot">
        <button class="btn primary" @click="emit('download')">
          <IconDownload :size="16" />
          <span>下载</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--sp-4);
  backdrop-filter: blur(4px);
  animation: fadeIn var(--t-fast) var(--ease-out);
}
.lightbox-card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  max-width: 92vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-4);
}
.lightbox-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.lightbox-head .file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: var(--fs-13);
}
.lightbox-head .btn-mini { min-height: 36px; min-width: 36px; }
.lightbox-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background: #000;
}
.lightbox-img { max-width: 100%; max-height: 70vh; object-fit: contain; display: block; }
.lightbox-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-6);
  color: var(--text-dim);
}
.lightbox-thumb { max-width: 40vw; max-height: 50vh; object-fit: contain; opacity: 0.5; }
.lightbox-loading .downloading { color: var(--accent); font-weight: var(--fw-medium); }
.download-fail { color: var(--c-danger); }
.lightbox-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-top: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.lightbox-foot .btn { min-height: 40px; padding: var(--sp-2) var(--sp-4); }
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
</style>