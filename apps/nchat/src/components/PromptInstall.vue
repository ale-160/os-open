<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const showPrompt = ref(false)
const dismissed = ref(false)

const emit = defineEmits(['visible'])
let notified = false

function notifyVisible(visible) {
  if (visible && !notified) {
    notified = true
    emit('visible', true)
  } else if (!visible && notified) {
    notified = false
    emit('visible', false)
  }
}

// Check if already installed
const isStandalone = window.matchMedia('(display-mode: standalone)').matches

let deferredPrompt = null

function handleBeforeInstallPrompt(e) {
  // Prevent auto-prompt
  e.preventDefault()
  // Store for later use
  deferredPrompt = e
  // Show our custom banner
  if (!isStandalone && !dismissed.value) {
    showPrompt.value = true
    notifyVisible(true)
  }
}

function handleAppInstalled() {
  // App was installed, hide banner
  showPrompt.value = false
  notifyVisible(false)
  deferredPrompt = null
}

async function installApp() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') {
    showPrompt.value = false
    notifyVisible(false)
  }
  deferredPrompt = null
}

function dismiss() {
  showPrompt.value = false
  notifyVisible(false)
  dismissed.value = true
  // Don't show again until page reload
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
})
</script>

<template>
  <div v-if="showPrompt" class="install-banner">
    <div class="install-content">
      <span class="install-icon">📱</span>
      <span class="install-text">安装 nchat 到桌面</span>
      <div class="install-actions">
        <button class="btn btn-mini primary" @click="installApp">
          安装
        </button>
        <button class="btn btn-mini" @click="dismiss">
          稍后
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.install-banner {
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 8px 12px;
  z-index: 80;
  box-shadow: var(--shadow-2);
  backdrop-filter: blur(8px);
}

.install-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.install-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.install-text {
  font-size: 13px;
  color: var(--text);
  flex: 1;
}

.install-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.install-actions .btn-mini {
  min-height: 44px;
  min-width: 44px;
  padding: 6px 12px;
  font-size: 12px;
  touch-action: manipulation;
}
</style>
