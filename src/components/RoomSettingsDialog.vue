<script setup>
/**
 * 聊天室级设置（标题栏齿轮按钮）：独立于平台设置。
 * 包含：免打扰 / 星级屏蔽 / 屏蔽管理 / 导出记录 / 邀请链接。
 */
import { ref, computed } from 'vue'
import { IconClose, IconCopy, IconDownload } from './icons'

const props = defineProps({
  room: { type: String, default: '' },
  mutedRooms: { type: Array, default: () => [] },
  minBlockStars: { type: Number, default: 0 },
  blockedPeers: { type: Array, default: () => [] },
  memberNames: { type: Object, default: () => ({}) } // peerId -> name（显示屏蔽列表用）
})
const emit = defineEmits(['close', 'toggle-mute', 'set-min-stars', 'unblock', 'export'])

const isMuted = computed(() => props.mutedRooms.includes(props.room))
const starsInput = ref(props.minBlockStars)
const starsDraft = ref(String(props.minBlockStars))

function saveMinStars() {
  const v = Math.max(0, Math.floor(parseInt(starsDraft.value || '0', 10)))
  starsDraft.value = String(v)
  emit('set-min-stars', v)
}

// 邀请链接（复用 ?room= 协议）
const inviteLink = computed(() => {
  if (!props.room) return ''
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(props.room)}`
})
const copied = ref(false)
async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch (e) {
    /* ignore */
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card">
      <div class="modal-head">
        <span>房间设置 · {{ room }}</span>
        <button class="btn-mini icon-only-btn" title="关闭" @click="emit('close')">
          <IconClose :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <!-- 免打扰 -->
        <div class="diag-section">
          <label class="role-toggle">
            <input type="checkbox" :checked="isMuted" @change="emit('toggle-mute')" />
            <span>免打扰（新消息不弹通知）</span>
          </label>
        </div>

        <!-- 星级屏蔽 -->
        <div class="diag-section">
          <h4>星级屏蔽</h4>
          <div class="invite-link-row">
            <input v-model="starsDraft" type="number" min="0" max="99" class="input" style="width: 90px" />
            <button class="btn" @click="saveMinStars">保存</button>
          </div>
          <p class="form-hint">屏蔽星标低于该值的成员发言（0 = 不屏蔽；数据仍保留）</p>
        </div>

        <!-- 屏蔽管理 -->
        <div class="diag-section">
          <h4>已屏蔽的人</h4>
          <p v-if="!blockedPeers.length" class="form-hint">未屏蔽任何人（在成员列表可屏蔽）</p>
          <div v-for="pid in blockedPeers" :key="pid" class="room-mgr-item">
            <span class="room-mgr-name mono">{{ memberNames[pid] || pid.slice(0, 10) }}</span>
            <button class="btn-mini" @click="emit('unblock', pid)">取消屏蔽</button>
          </div>
        </div>

        <!-- 导出记录 -->
        <div class="diag-section">
          <h4>数据</h4>
          <button class="btn" @click="emit('export')"><IconDownload :size="14" /> 导出聊天记录（JSON）</button>
        </div>

        <!-- 邀请链接 -->
        <div class="diag-section">
          <h4>邀请加入</h4>
          <div class="invite-link-row">
            <input class="input mono" :value="inviteLink" readonly @focus="$event.target.select()" />
            <button class="btn" @click="copyInvite"><IconCopy :size="14" /> {{ copied ? '已复制' : '复制' }}</button>
          </div>
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.invite-link-row { display: flex; gap: var(--sp-2); align-items: center; }
.invite-link-row .input { flex: 1; font-size: var(--fs-11); }
.room-mgr-item { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-2) 0; }
</style>
