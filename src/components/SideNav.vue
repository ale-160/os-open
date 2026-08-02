<script setup>
/**
 * 左侧导航栏
 * - 桌面端：64px 图标栏
 * - 移动端：280px 抽屉（含品牌、导航标签、用户头像、版本信息）
 */
import { computed } from 'vue'
import { useLayout } from '@/composables/useLayout.js'
import {
  IconChat,
  IconSearch,
  IconSettings,
  IconTopology
} from './icons'

const props = defineProps({
  activeNav: { type: String, default: 'chat' },
  online: { type: Boolean, default: false },
  ownName: { type: String, default: '' }
})

const emit = defineEmits(['nav', 'open-settings', 'open-topology'])

const { isDesktop, sideNavOpen, closeAll } = useLayout()

// 全局导航项
const NAV_ITEMS = [
  { key: 'chat', label: '会话', Icon: IconChat },
  { key: 'search', label: '搜索', Icon: IconSearch }
]

// 昵称首字母（取第一个字符，大写；无则用 '?'）
function initial(name) {
  const n = (name || '').trim()
  return n ? n.charAt(0).toUpperCase() : '?'
}
</script>

<template>
  <nav
    class="side-nav"
    :class="{ drawer: !isDesktop, open: sideNavOpen }"
    @click.self="closeAll"
  >
    <!-- 品牌区 -->
    <div class="nav-brand" :class="{ mobile: !isDesktop }">
      <svg class="brand-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z"
          stroke="var(--c-primary)"
          stroke-width="2"
          stroke-linejoin="round"
          fill="var(--c-primary-soft)"
        />
        <path
          d="M12 7 L16 9.5 V14.5 L12 17 L8 14.5 V9.5 Z"
          stroke="var(--c-primary)"
          stroke-width="1.5"
          stroke-linejoin="round"
          fill="none"
          opacity="0.6"
        />
      </svg>
      <span class="brand-text" v-if="!isDesktop || sideNavOpen">nchat</span>
    </div>

    <!-- 导航项 -->
    <div class="nav-items">
      <button
        v-for="item in NAV_ITEMS"
        :key="item.key"
        class="nav-item"
        :class="{ active: activeNav === item.key }"
        :title="item.label"
        @click="emit('nav', item.key); if (!isDesktop) closeAll()"
      >
        <component :is="item.Icon" :size="22" />
        <span class="nav-label" v-if="!isDesktop || sideNavOpen">{{ item.label }}</span>
      </button>
    </div>

    <!-- 底部：拓扑 + 设置 + 用户头像 -->
    <div class="nav-bottom">
      <button
        class="nav-item"
        :title="'网络拓扑'"
        @click="emit('open-topology'); if (!isDesktop) closeAll()"
      >
        <IconTopology :size="22" />
        <span class="nav-label" v-if="!isDesktop || sideNavOpen">拓扑</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: activeNav === 'settings' }"
        :title="'设置'"
        @click="emit('open-settings'); if (!isDesktop) closeAll()"
      >
        <IconSettings :size="22" />
        <span class="nav-label" v-if="!isDesktop || sideNavOpen">设置</span>
      </button>

      <div class="nav-spacer" v-if="!isDesktop || sideNavOpen" />

      <button
        class="nav-user"
        :class="{ on: online, off: !online }"
        :title="online ? '在线 · 点击打开设置' : '离线 · 点击打开设置'"
        @click="emit('open-settings'); if (!isDesktop) closeAll()"
      >
        <span class="avatar-letter">{{ initial(ownName) }}</span>
        <span class="avatar-name" v-if="!isDesktop || sideNavOpen">{{ ownName }}</span>
        <span class="avatar-dot" :class="{ on: online }"></span>
      </button>

      <div class="nav-version" v-if="!isDesktop || sideNavOpen">
        v{{ __APP_VERSION__ }}
      </div>
    </div>
  </nav>
</template>

<style scoped>
.side-nav {
  width: 64px;
  flex-shrink: 0;
  height: 100%;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--sp-3) 0 var(--sp-2);
  gap: var(--sp-1);
  overflow: hidden;
  transition: width var(--t-base) var(--ease-out), transform var(--t-base) var(--ease-out);
}

.side-nav.drawer {
  width: 280px;
  padding: var(--sp-4) var(--sp-3);
  align-items: flex-start;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  height: 44px;
  margin-bottom: var(--sp-2);
}

.brand-icon { flex-shrink: 0; }
.brand-text {
  font-size: var(--fs-16);
  font-weight: var(--fw-semibold);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-md);
  color: var(--text-dim);
  transition: background var(--t-fast), color var(--t-fast);
  width: 100%;
  justify-content: flex-start;
}

.nav-item:hover { background: var(--bg-hover); color: var(--text); }
.nav-item.active { background: var(--c-primary-soft); color: var(--c-primary); }

.nav-label {
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  white-space: nowrap;
}

.nav-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding-top: var(--sp-2);
  border-top: 1px solid var(--border-soft);
  width: 100%;
}

.nav-spacer { height: 1px; background: var(--border-soft); margin: var(--sp-2) 0; }

.nav-user {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-md);
  width: 100%;
  justify-content: flex-start;
}

.avatar-letter {
  width: 32px; height: 32px;
  border-radius: var(--r-full);
  background: var(--c-primary-soft);
  color: var(--c-primary);
  display: flex; align-items: center; justify-content: center;
  font-weight: var(--fw-bold); font-size: var(--fs-14);
}

.avatar-name { flex: 1; font-size: var(--fs-13); color: var(--text); }
.avatar-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
.avatar-dot.on { background: var(--c-success); box-shadow: 0 0 0 2px var(--c-success-soft); }

.nav-version {
  font-size: var(--fs-11);
  color: var(--text-muted);
  text-align: center;
  padding-top: var(--sp-2);
  width: 100%;
}

/* Desktop: 64px 图标栏 */
@media (min-width: 861px) {
  .side-nav.drawer { width: 64px; padding: var(--sp-3) 0 var(--sp-2); align-items: center; }
  .nav-brand { justify-content: center; width: 44px; height: 44px; margin-bottom: var(--sp-2); }
  .brand-text { display: none; }
  .nav-items { align-items: center; }
  .nav-item { flex-direction: column; gap: 2px; width: 48px; height: 48px; padding: 0; justify-content: center; }
  .nav-label { font-size: 10px; line-height: 1; letter-spacing: 0.2px; }
  .nav-bottom { flex-direction: column; align-items: center; gap: var(--sp-1); padding-top: var(--sp-2); border-top: 1px solid var(--border-soft); }
  .nav-spacer { display: none; }
  .nav-user { width: 40px; height: 40px; padding: 0; justify-content: center; border-radius: 50%; }
  .avatar-name { display: none; }
  .avatar-letter { width: 28px; height: 28px; font-size: var(--fs-14); }
  .avatar-dot { position: absolute; right: 0; bottom: 0; width: 11px; height: 11px; border-radius: 50%; background: var(--text-muted); border: 2px solid var(--bg-elev); }
  .nav-version { display: none; }
}
</style>