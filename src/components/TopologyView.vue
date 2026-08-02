<template>
  <div class="topology-panel">
    <div class="topology-head">
      <span class="topology-title">网络拓扑</span>
      <span class="topology-hint">本地可见节点与连接</span>
    </div>
    <div class="topology-body">
      <div v-if="!domains.length" class="topology-empty">暂无可视化数据</div>
      <div v-for="d in domains" :key="d.id || d.name || Math.random()" class="topology-domain">
        <div class="domain-head">
          <span class="domain-name">{{ d.name || d.id || '域' }}</span>
          <span class="domain-meta">{{ d.peers?.length || 0 }} 节点</span>
        </div>
        <div class="domain-peers">
          <div v-for="p in (d.peers || [])" :key="p.peerId || p.id" class="peer-chip" :class="statusClass(p)">
            <span class="peer-name">{{ p.name || (p.peerId || p.id || '').slice(0,8) }}</span>
            <span class="peer-status">{{ statusText(p) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  domains: { type: Array, default: () => [] }
})

function statusClass(p) {
  const s = (p.status || '').toLowerCase()
  if (!s || s === 'online' || s === 'connected') return 'online'
  if (s === 'unstable') return 'unstable'
  return 'offline'
}
function statusText(p) {
  const s = (p.status || '').toLowerCase()
  if (!s || s === 'online' || s === 'connected') return '在线'
  if (s === 'unstable') return '不稳定'
  return '离线'
}
</script>

<style scoped>
.topology-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: auto;
}
.topology-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.topology-title {
  font-weight: 700;
}
.topology-hint {
  color: var(--text-dim);
  font-size: 12px;
}
.topology-empty {
  color: var(--text-dim);
  font-size: 13px;
}
.topology-domain {
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  padding: 12px;
  background: var(--bg-elev);
}
.domain-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.domain-name {
  font-weight: 600;
}
.domain-meta {
  color: var(--text-dim);
  font-size: 12px;
}
.domain-peers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.peer-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: var(--bg);
  font-size: 12px;
}
.peer-chip.online {
  border-color: var(--green);
  color: var(--green);
}
.peer-chip.unstable {
  border-color: #f5a623;
  color: #b37400;
}
.peer-chip.offline {
  border-color: var(--red);
  color: var(--red);
}
.peer-name {
  font-weight: 600;
}
.peer-status {
  opacity: 0.9;
}
</style>
