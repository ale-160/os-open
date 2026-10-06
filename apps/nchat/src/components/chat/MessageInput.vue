<script setup>
import { ref, computed } from 'vue'
import {
  IconSend,
  IconPlus,
  IconFile,
  IconImage,
  IconReact,
  IconClose
} from '../icons'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '输入消息，回车发送，Shift+Enter 换行' },
  replyingTo: { type: Object, default: null }
})

const emit = defineEmits(['send', 'file', 'mention', 'cancel-reply', 'typing'])

const draft = ref('')
const showEmoji = ref(false)
const showAttach = ref(false)

const canSend = computed(() => draft.value.trim().length > 0 && !props.disabled)

function handleSend() {
  if (canSend.value) {
    emit('send', draft.value.trim())
    draft.value = ''
    showEmoji.value = false
    showAttach.value = false
  }
}

function handleInput() {
  // P2-8: 打字状态（peer 层 2s 节流）
  emit('typing')
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    emit('file', file)
  }
  e.target.value = ''
}
</script>

<template>
  <div class="message-input-area">
    <!-- 回复引用条 -->
    <div class="reply-bar" v-if="replyingTo">
      <span class="reply-icon"><IconThread :size="14" /></span>
      <span class="reply-label">回复 {{ replyingTo.name || '对方' }}</span>
      <span class="reply-snippet">{{ replyingTo.text || '（文件/图片消息）' }}</span>
      <button class="reply-close" @click="emit('cancel-reply')" title="取消回复">
        <IconClose :size="14" />
      </button>
    </div>

    <div class="input-row">
      <div class="input-toolbar">
        <button class="icon-btn" @click="showAttach = !showAttach" title="附件">
          <IconPlus :size="20" />
        </button>
        <button class="icon-btn" @click="showEmoji = !showEmoji" title="表情">
          <IconReact :size="20" />
        </button>
      </div>

      <div class="input-wrapper">
        <textarea
          v-model="draft"
          class="input-field"
          :placeholder="placeholder"
          @input="handleInput"
          @keydown="handleKeydown"
          :disabled="props.disabled"
          rows="1"
          style="resize: none; min-height: 44px; max-height: 160px;"
        ></textarea>
      </div>

      <div class="input-actions">
        <button class="icon-btn primary" :disabled="!canSend" @click="handleSend" title="发送">
          <IconSend :size="20" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-input-area {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4) var(--sp-3);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-top: 1px solid var(--glass-border);
  flex-shrink: 0;
}
/* 回复引用条 */
.reply-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  background: var(--bg-elev2);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  font-size: var(--fs-12);
  min-height: 34px;
}
.reply-icon { color: var(--accent); flex-shrink: 0; display: flex; }
.reply-label { color: var(--accent); font-weight: var(--fw-medium); white-space: nowrap; }
.reply-snippet {
  color: var(--text-muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reply-close {
  width: 22px;
  height: 22px;
  border-radius: var(--r-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  flex-shrink: 0;
}
.reply-close:hover { background: var(--bg-hover); color: var(--text); }
.input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--sp-3);
}
.input-toolbar {
  display: flex;
  gap: var(--sp-1);
  margin-bottom: 0;
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
.input-wrapper { flex: 1; }
.input-field {
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text);
  font-size: var(--fs-13);
  line-height: var(--lh-normal);
  font-family: inherit;
  outline: none;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
  resize: none;
}
.input-field:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--c-primary-soft);
}
.input-field::placeholder { color: var(--c-neutral-500); }
.input-field:disabled { opacity: 0.5; cursor: not-allowed; }
.input-actions { display: flex; justify-content: flex-end; margin-top: var(--sp-2); }
.icon-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}
.icon-btn.primary:hover:not(:disabled) { background: var(--c-primary-hover); }
.icon-btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>