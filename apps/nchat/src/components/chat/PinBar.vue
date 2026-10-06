<script setup>
import { ref, computed } from 'vue'
import { IconPin, IconClose } from '../icons'

const props = defineProps({
  pinnedMsgIds: { type: Array, default: () => [] },
  messages: { type: Array, default: () => [] },
})

const emit = defineEmits(['locate', 'unpin'])

const pinListExpanded = ref(false)

const pinnedMessages = computed(() => {
  if (!props.pinnedMsgIds.length) return []
  return props.pinnedMsgIds.map((id) => {
    const m = props.messages.find((x) => x.id === id)
    return {
      id,
      found: !!m,
      name: m?.name || m?.from?.slice(0, 8) || '未知',
      text: m?.text || (m?.file ? `[文件] ${m.file.name || ''}` : ''),
      timestamp: m?.timestamp || 0
    }
  })
})

function locatePin(msgId) {
  emit('locate', msgId)
}

function unpin(msgId) {
  emit('unpin', msgId)
}
</script>

<template>
  <div v-if="pinnedMsgIds.length" class="pin-bar">
    <button class="pin-bar-toggle" @click="pinListExpanded = !pinListExpanded">
      <IconPin :size="14" />
      <span class="pin-bar-count">{{ pinnedMsgIds.length }} 条置顶</span>
      <span class="pin-bar-arrow">{{ pinListExpanded ? '收起' : '展开' }}</span>
    </button>
    <div v-if="pinListExpanded" class="pin-list">
      <div
        v-for="p in pinnedMessages"
        :key="p.id"
        class="pin-item"
        :class="{ unavailable: !p.found }"
        @click="locatePin(p.id)"
      >
        <span class="pin-item-icon"><IconPin :size="12" /></span>
        <span class="pin-item-name">{{ p.name }}</span>
        <span class="pin-item-text" v-if="p.found">{{ p.text }}</span>
        <span class="pin-item-text muted" v-else>消息不可用（已删除或未加载）</span>
        <button
          class="btn-mini icon-only-btn pin-unpin-btn"
          title="取消置顶"
          @click.stop="unpin(p.id)"
        >
          <IconClose :size="12" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pin-bar {
  display: flex;
  flex-direction: column;
  background: var(--bg-elev2);
  border-bottom: 1px solid var(--border-soft);
  position: relative;
  z-index: 5;
}
.pin-bar-toggle {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text);
  font-size: var(--fs-12);
}
.pin-bar-toggle:hover { background: var(--bg-elev); }
.pin-bar-count { font-weight: var(--fw-semibold); }
.pin-bar-arrow { margin-left: auto; color: var(--text-muted); font-size: var(--fs-11); }
.pin-list {
  display: flex;
  flex-direction: column;
  max-height: 200px;
  overflow-y: auto;
  border-top: 1px solid var(--border-soft);
}
.pin-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  cursor: pointer;
  font-size: var(--fs-12);
  color: var(--text);
}
.pin-item:hover { background: var(--bg-elev); }
.pin-item.unavailable { opacity: 0.6; }
.pin-item-icon { color: var(--c-warning); flex-shrink: 0; }
.pin-item-name { font-weight: var(--fw-semibold); color: var(--accent); flex-shrink: 0; }
.pin-item-text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pin-item-text.muted { color: var(--text-muted); font-style: italic; }
.pin-unpin-btn { flex-shrink: 0; opacity: 0; }
.pin-item:hover .pin-unpin-btn { opacity: 1; }
</style>