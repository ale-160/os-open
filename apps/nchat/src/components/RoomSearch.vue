<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  online: { type: Boolean, default: false },
  keyword: { type: String, default: '' }
})

const emit = defineEmits(['search', 'create', 'clear'])

const keyword = ref(props.keyword)

watch(() => props.keyword, (v) => { keyword.value = v })

function onSearch() {
  emit('search', keyword.value.trim())
}
</script>

<template>
  <div class="room-search">
    <div class="search-input-wrap">
      <input
        class="search-input"
        v-model="keyword"
        type="text"
        placeholder="搜索房间名或别名，如 ale160 / 阿乐一百六"
        @keyup.enter="onSearch"
      />
      <button class="btn" @click="onSearch" title="搜索网络中的房间">搜索</button>
      <button class="btn primary" @click="emit('create')" title="创建新房间">
        创建
      </button>
    </div>
    <div class="search-status" v-if="keyword">
      <span>搜索: "{{ keyword }}"</span>
      <button class="btn-link" @click="emit('clear')">清除</button>
    </div>
    <p class="hint" v-if="!online">
      信令未连接，仅显示本地缓存的房间
    </p>
  </div>
</template>
