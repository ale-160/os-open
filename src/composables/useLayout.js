/**
 * 响应式布局状态机
 * 管理 SideNav / ListBar / MemberList 在不同断点的显隐与交互
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

export function useLayout() {
  const width = ref(window.innerWidth)
  const sideNavOpen = ref(false)
  const listBarOpen = ref(false)
  const memberOpen = ref(false)

  const bp = {
    xs: 375,
    sm: 640,
    md: 860,
    lg: 1200,
  }

  function updateWidth() {
    const w = window.innerWidth
    width.value = w

    // 桌面默认全开，移动端默认全关
    if (w >= bp.md) {
      sideNavOpen.value = true
      listBarOpen.value = true
      memberOpen.value = true
    } else {
      sideNavOpen.value = false
      listBarOpen.value = false
      memberOpen.value = false
    }
  }

  function handleResize() {
    updateWidth()
  }

  onMounted(() => {
    updateWidth()
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  const isDesktop = computed(() => width.value >= bp.md)
  const isTablet = computed(() => width.value >= bp.sm && width.value < bp.md)
  const isMobile = computed(() => width.value < bp.sm)

  function toggleSideNav() {
    sideNavOpen.value = !sideNavOpen.value
    if (sideNavOpen.value) {
      listBarOpen.value = false
      memberOpen.value = false
    }
  }

  function toggleListBar() {
    listBarOpen.value = !listBarOpen.value
    if (listBarOpen.value) {
      sideNavOpen.value = false
      memberOpen.value = false
    }
  }

  function toggleMember() {
    memberOpen.value = !memberOpen.value
    if (memberOpen.value) {
      sideNavOpen.value = false
      listBarOpen.value = false
    }
  }

  function closeAll() {
    sideNavOpen.value = false
    listBarOpen.value = false
    memberOpen.value = false
  }

  return {
    width,
    sideNavOpen,
    listBarOpen,
    memberOpen,
    isDesktop,
    isTablet,
    isMobile,
    toggleSideNav,
    toggleListBar,
    toggleMember,
    closeAll,
  }
}