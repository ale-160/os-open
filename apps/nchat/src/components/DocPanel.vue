<script setup>
/**
 * Phase 2.4: 云文档面板（群内视图）。
 * 在 ChatPanel 内通过 tab 切换显示。
 *
 * 功能：
 * - 文档列表（按更新时间倒序）
 * - 创建新文档
 * - 编辑文档（标题 + 内容，3s 防抖自动保存）
 * - 重命名 / 删除
 * - 版本冲突提示与解决
 * - LWW + 版本号合并
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  IconDoc,
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconCheck
} from './icons'

const props = defineProps({
  currentRoom: { type: String, default: '' },
  docs: { type: Array, default: () => [] },
  conflicts: { type: Map, default: () => new Map() }
})

const emit = defineEmits([
  'create-doc',
  'update-doc',
  'rename-doc',
  'delete-doc',
  'resolve-conflict-remote',
  'resolve-conflict-local'
])

// 当前正在编辑的文档
const editingDocId = ref(null)
const editTitle = ref('')
const editContent = ref('')
const saveTimer = ref(null)
const saving = ref(false)
const lastSavedAt = ref(null)

// 新建文档
const creating = ref(false)
const newTitle = ref('')

const editingDoc = computed(() => {
  if (!editingDocId.value) return null
  return props.docs.find((d) => d.docId === editingDocId.value) || null
})

// 当前文档的冲突信息
const currentConflict = computed(() => {
  if (!editingDocId.value) return null
  return props.conflicts.get(editingDocId.value) || null
})

function startCreate() {
  creating.value = true
  newTitle.value = ''
}

async function confirmCreate() {
  const title = newTitle.value.trim()
  if (!title) return
  emit('create-doc', title)
  creating.value = false
  newTitle.value = ''
}

function cancelCreate() {
  creating.value = false
  newTitle.value = ''
}

function openDoc(doc) {
  editingDocId.value = doc.docId
  editTitle.value = doc.title || ''
  editContent.value = doc.content || ''
  clearSaveTimer()
}

function closeDoc() {
  flushSave()
  editingDocId.value = null
  editTitle.value = ''
  editContent.value = ''
  clearSaveTimer()
}

function clearSaveTimer() {
  if (saveTimer.value) {
    clearTimeout(saveTimer.value)
    saveTimer.value = null
  }
}

// 3s 防抖自动保存
function scheduleSave() {
  clearSaveTimer()
  saveTimer.value = setTimeout(() => {
    flushSave()
  }, 3000)
}

function flushSave() {
  if (!editingDocId.value) return
  const doc = editingDoc.value
  if (!doc) return
  // 检查是否有变更
  const titleChanged = editTitle.value !== doc.title
  const contentChanged = editContent.value !== doc.content
  if (!titleChanged && !contentChanged) return
  saving.value = true
  emit('update-doc', {
    docId: editingDocId.value,
    patch: {
      title: editTitle.value,
      content: editContent.value
    }
  })
  lastSavedAt.value = Date.now()
  setTimeout(() => {
    saving.value = false
  }, 500)
}

function onTitleInput() {
  scheduleSave()
}

function onContentInput() {
  scheduleSave()
}

// 重命名（列表项内联）
const renamingId = ref(null)
const renameValue = ref('')

function startRename(doc) {
  renamingId.value = doc.docId
  renameValue.value = doc.title || ''
}

function confirmRename() {
  if (!renamingId.value) return
  const title = renameValue.value.trim()
  if (title) {
    emit('rename-doc', { docId: renamingId.value, title })
  }
  renamingId.value = null
  renameValue.value = ''
}

function cancelRename() {
  renamingId.value = null
  renameValue.value = ''
}

function onDelete(doc) {
  if (!confirm(`确定删除文档「${doc.title || '未命名'}」？`)) return
  emit('delete-doc', doc.docId)
  if (editingDocId.value === doc.docId) {
    closeDoc()
  }
}

// 冲突解决
function acceptRemote() {
  if (!editingDocId.value) return
  const conflict = currentConflict.value
  if (conflict?.remote) {
    // 采用远端版本，更新编辑器内容
    editTitle.value = conflict.remote.title || ''
    editContent.value = conflict.remote.content || ''
  }
  emit('resolve-conflict-remote', editingDocId.value)
}

function keepLocal() {
  if (!editingDocId.value) return
  emit('resolve-conflict-local', editingDocId.value)
  flushSave()
}

// 切换房间时关闭编辑器
watch(
  () => props.currentRoom,
  () => {
    closeDoc()
    creating.value = false
  }
)

onUnmounted(() => {
  clearSaveTimer()
})

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (isToday) return `${hh}:${mm}`
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${mo}-${da} ${hh}:${mm}`
}
</script>

<template>
  <div class="doc-panel">
    <!-- 文档列表视图 -->
    <div v-if="!editingDocId" class="doc-list-view">
      <div class="doc-list-head">
        <span class="doc-list-title">
          <IconDoc :size="16" />
          云文档
        </span>
        <button class="btn-mini primary icon-only-btn" title="新建文档" @click="startCreate">
          <IconPlus :size="16" />
        </button>
      </div>

      <!-- 新建文档输入 -->
      <div v-if="creating" class="doc-create-row">
        <input
          class="input"
          v-model="newTitle"
          type="text"
          placeholder="文档标题…"
          @keyup.enter="confirmCreate"
          @keyup.esc="cancelCreate"
          autofocus
        />
        <button class="btn-mini primary" title="创建" @click="confirmCreate">
          <IconCheck :size="14" />
        </button>
        <button class="btn-mini icon-only-btn" title="取消" @click="cancelCreate">
          <IconClose :size="14" />
        </button>
      </div>

      <!-- 文档列表 -->
      <div v-if="docs.length" class="doc-list">
        <div
          v-for="doc in docs"
          :key="doc.docId"
          class="doc-item"
          @click="openDoc(doc)"
        >
          <div class="doc-item-icon"><IconDoc :size="18" /></div>
          <div class="doc-item-body">
            <div v-if="renamingId === doc.docId" class="doc-rename-row" @click.stop>
              <input
                class="input"
                v-model="renameValue"
                type="text"
                @keyup.enter="confirmRename"
                @keyup.esc="cancelRename"
                autofocus
              />
              <button class="btn-mini primary icon-only-btn" title="确认" @click="confirmRename">
                <IconCheck :size="14" />
              </button>
              <button class="btn-mini icon-only-btn" title="取消" @click="cancelRename">
                <IconClose :size="14" />
              </button>
            </div>
            <template v-else>
              <div class="doc-item-title">{{ doc.title || '未命名文档' }}</div>
              <div class="doc-item-meta">
                <span class="doc-item-author">{{ doc.authorName || '匿名' }}</span>
                <span class="doc-item-sep">·</span>
                <span class="doc-item-time">{{ formatTime(doc.updatedAt) }}</span>
                <span class="doc-item-version">v{{ doc.version }}</span>
              </div>
            </template>
          </div>
          <div class="doc-item-actions" v-if="renamingId !== doc.docId" @click.stop>
            <button class="btn-mini icon-only-btn" title="重命名" @click="startRename(doc)">
              <IconEdit :size="14" />
            </button>
            <button class="btn-mini icon-only-btn" title="删除" @click="onDelete(doc)">
              <IconTrash :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!creating" class="doc-empty">
        <IconDoc :size="48" />
        <p>暂无云文档</p>
        <p class="sub">点击右上角 + 创建第一个文档</p>
      </div>
    </div>

    <!-- 文档编辑视图 -->
    <div v-else class="doc-edit-view">
      <div class="doc-edit-head">
        <button class="btn-mini icon-only-btn" title="返回列表" @click="closeDoc">
          <IconClose :size="16" />
        </button>
        <input
          class="input doc-edit-title"
          v-model="editTitle"
          type="text"
          placeholder="文档标题"
          @input="onTitleInput"
        />
        <span class="doc-save-status" v-if="saving">保存中…</span>
        <span class="doc-save-status saved" v-else-if="lastSavedAt">已保存</span>
        <span class="doc-version-badge" v-if="editingDoc">v{{ editingDoc.version }}</span>
      </div>

      <!-- 版本冲突提示 -->
      <div v-if="currentConflict" class="doc-conflict-bar">
        <span class="conflict-text">
          ⚠ 检测到版本冲突：对方有 v{{ currentConflict.remote?.version }} 版本，你当前为 v{{ currentConflict.local?.version }}
        </span>
        <button class="btn-mini primary" @click="acceptRemote">采用对方版本</button>
        <button class="btn-mini" @click="keepLocal">保留我的版本</button>
      </div>

      <textarea
        class="doc-edit-content"
        v-model="editContent"
        placeholder="开始编辑文档内容…"
        @input="onContentInput"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.doc-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ===== 文档列表视图 ===== */
.doc-list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.doc-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.doc-list-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.doc-create-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.doc-create-row .input {
  flex: 1;
}

.doc-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-1) 0;
}

.doc-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  cursor: pointer;
  transition: background 0.15s;
}
.doc-item:hover {
  background: var(--bg-hover);
}
.doc-item-icon {
  color: var(--accent);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.doc-item-body {
  flex: 1;
  min-width: 0;
}
.doc-item-title {
  font-size: var(--fs-14);
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.doc-item-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-11);
  color: var(--text-muted);
  margin-top: 2px;
}
.doc-item-sep {
  opacity: 0.5;
}
.doc-item-version {
  margin-left: 4px;
  padding: 0 4px;
  background: var(--bg-elev2);
  border-radius: var(--r-xs);
  font-size: var(--fs-10);
}
.doc-item-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.doc-item:hover .doc-item-actions {
  opacity: 1;
}

.doc-rename-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.doc-rename-row .input {
  flex: 1;
  font-size: var(--fs-14);
}

.doc-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  color: var(--text-muted);
  padding: var(--sp-4);
}
.doc-empty p {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--text-dim);
}
.doc-empty .sub {
  font-size: var(--fs-12);
  color: var(--text-muted);
}

/* ===== 文档编辑视图 ===== */
.doc-edit-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.doc-edit-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.doc-edit-title {
  flex: 1;
  font-size: var(--fs-15);
  font-weight: 600;
}
.doc-save-status {
  font-size: var(--fs-11);
  color: var(--text-muted);
  flex-shrink: 0;
}
.doc-save-status.saved {
  color: var(--green);
}
.doc-version-badge {
  padding: 2px 6px;
  background: var(--bg-elev2);
  border-radius: var(--r-xs);
  font-size: var(--fs-10);
  color: var(--text-muted);
  flex-shrink: 0;
}

.doc-conflict-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  background: var(--c-warning-soft);
  border-bottom: 1px solid var(--c-warning);
  font-size: var(--fs-12);
  flex-shrink: 0;
}
.conflict-text {
  flex: 1;
  color: var(--text);
}

.doc-edit-content {
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: var(--sp-3);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: var(--fs-13);
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
  min-height: 0;
}
.doc-edit-content:focus {
  background: var(--bg-elev);
}
</style>
