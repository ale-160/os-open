<script setup>
/**
 * 邀请弹窗：生成房间邀请链接 + 二维码，复制/扫码即可加入。
 */
import { ref, computed, onMounted, watch } from 'vue'
import QRCode from 'qrcode'
import { IconClose, IconCopy } from './icons'

const props = defineProps({
  room: { type: String, default: '' }
})
const emit = defineEmits(['close'])

const inviteLink = computed(() => {
  if (!props.room) return ''
  const base = `${location.origin}${location.pathname}`
  return `${base}?room=${encodeURIComponent(props.room)}`
})

const copied = ref(false)
const qrCanvas = ref(null)

onMounted(renderQr)
watch(inviteLink, renderQr)

async function renderQr() {
  if (!qrCanvas.value || !inviteLink.value) return
  try {
    await QRCode.toCanvas(qrCanvas.value, inviteLink.value, {
      width: 180,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' }
    })
  } catch (e) {
    /* ignore */
  }
}

async function copyLink() {
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
        <span>邀请加入「{{ room }}」</span>
        <button class="btn-mini icon-only-btn" title="关闭" @click="emit('close')">
          <IconClose :size="16" />
        </button>
      </div>
      <div class="modal-body invite-body">
        <canvas ref="qrCanvas" class="invite-qr"></canvas>
        <p class="form-hint">扫码或复制链接发送给好友，对方打开后自动加入房间。</p>
        <div class="invite-link-row">
          <input class="input mono" :value="inviteLink" readonly @focus="$event.target.select()" />
          <button class="btn" @click="copyLink">
            <IconCopy :size="14" /> {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.invite-body { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-4); }
.invite-qr { width: 180px; height: 180px; border: 1px solid var(--border); border-radius: var(--r-md); }
.invite-link-row { display: flex; gap: var(--sp-2); width: 100%; }
.invite-link-row .input { flex: 1; font-size: var(--fs-11); }
</style>
