<script setup>
/**
 * 左侧图标导航栏（64px 宽）。
 * - 顶部：品牌 hexagon
 * - 中部：导航图标（会话/文档/文件/搜索）
 * - 底部：设置 + 用户头像（状态点 + 昵称首字母）
 *
 * 导航项切换 ListBar 内容；点击用户头像打开设置面板。
 */
import {
  IconChat,
  IconDoc,
  IconFile,
  IconSearch,
  IconSettings,
  IconTopology
} from './icons'

const props = defineProps({
  activeNav: { type: String, default: 'chat' },
  online: { type: Boolean, default: false },
  ownName: { type: String, default: '' },
  showTopology: { type: Boolean, default: false }
})

const emit = defineEmits(['nav', 'open-settings', 'open-topology'])

// 导航项定义：name → 图标 + 标题
const NAV_ITEMS = [
  { key: 'chat', label: '会话', Icon: IconChat },
  { key: 'doc', label: '云文档', Icon: IconDoc },
  { key: 'file', label: '文件', Icon: IconFile },
  { key: 'search', label: '搜索', Icon: IconSearch }
]

// 昵称首字母（取第一个字符，大写；无则用 '?'）
function initial(name) {
  const n = (name || '').trim()
  return n ? n.charAt(0).toUpperCase() : '?'
}
</script>

<template>
  <nav class="side-nav">
    <!-- 品牌 -->
    <div class="nav-brand" title="nchat · P2P">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    </div>

    <!-- 导航图标 -->
    <div class="nav-items">
      <button
        v-for="item in NAV_ITEMS"
        :key="item.key"
        class="nav-icon-btn"
        :class="{ active: activeNav === item.key }"
        :title="item.label"
        @click="emit('nav', item.key)"
      >
        <component :is="item.Icon" :size="22" />
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </div>

    <!-- 拓扑（调试入口，可选） -->
    <button
      v-if="showTopology"
      class="nav-icon-btn"
      title="网络拓扑"
      @click="emit('open-topology')"
    >
      <IconTopology :size="22" />
      <span class="nav-label">拓扑</span>
    </button>

    <div class="nav-spacer"></div>

    <!-- 设置 -->
    <button
      class="nav-icon-btn"
      :class="{ active: activeNav === 'settings' }"
      title="设置"
      @click="emit('open-settings')"
    >
      <IconSettings :size="22" />
      <span class="nav-label">设置</span>
    </button>

    <!-- 用户头像 -->
    <button
      class="nav-avatar"
      :class="{ on: online, off: !online }"
      :title="online ? '在线 · 点击打开设置' : '离线 · 点击打开设置'"
      @click="emit('open-settings')"
    >
      <span class="avatar-letter">{{ initial(ownName) }}</span>
      <span class="avatar-dot"></span>
    </button>
  </nav>
</template>

<style scoped>
.side-nav {
  width: 64px;
  flex-shrink: 0;
  height: 100%;
  background: var(--bg-elev);
  border-right: 1px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--sp-3) 0 var(--sp-2);
  gap: var(--sp-1);
  overflow: hidden;
}

.nav-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-bottom: var(--sp-2);
  flex-shrink: 0;
}

.nav-items {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-1);
  width: 100%;
}

.nav-icon-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 48px;
  height: 48px;
  border-radius: var(--r-sm);
  color: var(--text-dim);
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.nav-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.nav-icon-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
}
.nav-label {
  font-size: 10px;
  line-height: 1;
  letter-spacing: 0.2px;
}

.nav-spacer {
  flex: 1;
  min-height: var(--sp-2);
}

/* 用户头像：圆形 + 状态点 */
.nav-avatar {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--c-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-15);
  font-weight: 600;
  flex-shrink: 0;
  margin-top: var(--sp-1);
  transition: opacity 0.15s, transform 0.15s;
}
.nav-avatar:hover {
  opacity: 0.85;
  transform: scale(1.05);
}
.avatar-letter {
  line-height: 1;
}
.avatar-dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--text-muted);
  border: 2px solid var(--bg-elev);
}
.nav-avatar.on .avatar-dot {
  background: var(--green);
}
.nav-avatar.off .avatar-dot {
  background: var(--red);
}

/* 移动端：隐藏侧边导航，列表栏全屏 */
@media (max-width: 860px) {
  .side-nav {
    display: none;
  }
}
</style>
