<script setup>
/**
 * Phase 2.5: 消息搜索面板（全局，本地 + 网络）。
 * 在 ListBar 的 search 导航下显示。
 * 点击结果 → emit('locate', { room, msgId }) → App 切房并定位消息。
 */
import { ref, watch } from 'vue'
import { IconSearch, IconClose, IconFile, IconChat } from './icons'

const props = defineProps({
  results: { type: Array, default: () => [] },
  searching: { type: Boolean, default: false }
})

const emit = defineEmits(['search', 'clear', 'locate'])

const keyword = ref('')
let debounceTimer = null

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  const kw = keyword.value.trim()
  if (!kw) {
    emit('clear')
    return
  }
  // 300ms 防抖
  debounceTimer = setTimeout(() => {
    emit('search', kw)
  }, 300)
}

function onClear() {
  keyword.value = ''
  emit('clear')
}

function onLocate(item) {
  if (!item?.room || !item?.id) return
  emit('locate', { room: item.room, msgId: item.id })
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (isSameDay) return hh + ':' + mm
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const DD = String(d.getDate()).padStart(2, '0')
  return MM + '/' + DD + ' ' + hh + ':' + mm
}

function textPreview(item) {
  if (item.text) return item.text
  if (item.file) return '[文件] ' + (item.file.name || '')
  return ''
}

// searching 状态变化时不清除 keyword（用户可能还在看结果）
watch(() => props.searching, () => {})
</script>

<template>
  <div class="msg-search">
    <!-- 搜索输入 -->
    <div class="msg-search-input-wrap">
      <span class="msg-search-icon"><IconSearch :size="16" /></span>
      <input
        class="input msg-search-input"
        v-model="keyword"
        type="text"
        placeholder="搜索消息内容…"
        @input="onInput"
        autofocus
      />
      <button
        v-if="keyword"
        class="btn-mini icon-only-btn msg-search-clear"
        title="清除"
        @click="onClear"
      >
        <IconClose :size="14" />
      </button>
    </div>

    <!-- 搜索状态提示 -->
    <div v-if="keyword && searching" class="msg-search-status">
      <span class="spinner-mini"></span>
      <span>正在搜索…</span>
    </div>

    <!-- 结果列表 -->
    <div v-if="keyword && results.length" class="msg-search-list">
      <div class="msg-search-count">{{ results.length }} 条结果</div>
      <button
        v-for="item in results"
        :key="item.id"
        class="msg-search-item"
        @click="onLocate(item)"
      >
        <div class="msg-search-item-head">
          <span class="msg-search-room">
            <IconChat :size="12" />
            #{{ item.room }}
          </span>
          <span class="msg-search-time">{{ formatTime(item.timestamp) }}</span>
        </div>
        <div class="msg-search-item-body">
          <span class="msg-search-name">{{ item.name || (item.from || '').slice(0, 8) }}</span>
          <span v-if="item.file" class="msg-search-file-badge">
            <IconFile :size="12" />
          </span>
          <span class="msg-search-text">{{ textPreview(item) }}</span>
        </div>
        <span v-if="item.source === 'network'" class="msg-search-source net" title="来自网络节点">
          网络
        </span>
        <span v-else class="msg-search-source local" title="本地缓存">本地</span>
      </button>
    </div>

    <!-- 空结果 -->
    <div v-else-if="keyword && !searching" class="msg-search-empty">
      <p>未找到匹配的消息</p>
      <p class="sub">尝试更换关键词，或等待网络节点回复</p>
    </div>

    <!-- 初始状态 -->
    <div v-else-if="!keyword" class="msg-search-hint">
      <IconSearch :size="32" />
      <p>搜索所有房间的消息</p>
      <p class="sub">支持本地缓存 + 网络节点聚合搜索</p>
    </div>
  </div>
</template>

<style scoped>
.msg-search {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.msg-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.msg-search-icon {
  display: flex;
  color: var(--text-muted);
  flex-shrink: 0;
}
.msg-search-input {
  flex: 1;
  min-width: 0;
  background: var(--bg-elev2);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  font-size: var(--fs-13);
}
.msg-search-input:focus {
  border-color: var(--accent);
}
.msg-search-clear {
  flex-shrink: 0;
}

.msg-search-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px var(--sp-3);
  font-size: var(--fs-12);
  color: var(--text-muted);
  flex-shrink: 0;
}
.spinner-mini {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.msg-search-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 6px var(--sp-2);
  min-height: 0;
  -webkit-overflow-scrolling: touch;
}
.msg-search-count {
  padding: var(--sp-2) 8px 4px;
  font-size: var(--fs-11);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.msg-search-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
  position: relative;
  margin-bottom: 2px;
}
.msg-search-item:hover {
  background: var(--bg-hover);
  border-color: var(--border-soft);
}

.msg-search-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.msg-search-room {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: var(--fs-11);
  font-weight: 600;
  color: var(--accent);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.msg-search-time {
  font-size: var(--fs-11);
  color: var(--text-muted);
  flex-shrink: 0;
}

.msg-search-item-body {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}
.msg-search-name {
  font-size: var(--fs-12);
  font-weight: 600;
  color: var(--text);
  flex-shrink: 0;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.msg-search-file-badge {
  display: inline-flex;
  color: var(--text-muted);
  flex-shrink: 0;
}
.msg-search-text {
  font-size: var(--fs-12);
  color: var(--text-dim);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.msg-search-source {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: var(--r-xs);
  font-weight: 500;
}
.msg-search-source.local {
  color: var(--text-muted);
  background: var(--bg-elev2);
}
.msg-search-source.net {
  color: var(--accent);
  background: var(--accent-soft);
}

.msg-search-empty {
  padding: 32px var(--sp-3);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--fs-13);
}
.msg-search-empty .sub {
  margin-top: 4px;
  font-size: var(--fs-11);
  opacity: 0.8;
}

.msg-search-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px var(--sp-3);
  text-align: center;
  color: var(--text-muted);
}
.msg-search-hint p {
  margin: 0;
  font-size: var(--fs-13);
}
.msg-search-hint .sub {
  font-size: var(--fs-11);
  opacity: 0.7;
}
.msg-search-hint svg {
  opacity: 0.4;
}
</style>
