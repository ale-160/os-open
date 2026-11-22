<script setup>
import { ref, watch } from 'vue'
import { t } from '@/i18n/index.js'

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
        :placeholder="t('roomSearch.placeholder')"
        @keyup.enter="onSearch"
      />
      <button class="btn" @click="onSearch" :title="t('roomSearch.searchTitle')">{{ t('roomSearch.search') }}</button>
      <button class="btn primary" @click="emit('create')" :title="t('roomSearch.createTitle')">
        {{ t('roomSearch.create') }}
      </button>
    </div>
    <div class="search-status" v-if="keyword">
      <span>{{ t('roomSearch.status', { keyword }) }}</span>
      <button class="btn-link" @click="emit('clear')">{{ t('roomSearch.clear') }}</button>
    </div>
    <p class="hint" v-if="!online">
      {{ t('roomSearch.offlineHint') }}
    </p>
  </div>
</template>
