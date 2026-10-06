<script setup>
import { ref } from 'vue'
import { shortPeerId } from '../lib/crypto.js'

const props = defineProps({
  state: { type: Object, required: true },
  serverLabel: { type: String, default: '' }
})

const emit = defineEmits(['rename'])

const editing = ref(false)
const nameInput = ref('')
const copied = ref(false)

function startEdit() {
  nameInput.value = props.state.ownName
  editing.value = true
}

function commitEdit() {
  const v = nameInput.value.trim()
  if (v) emit('rename', v)
  editing.value = false
}

async function copyPeerId() {
  try {
    await navigator.clipboard.writeText(props.state.peerId)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch (e) {
    /* ignore */
  }
}
</script>

<template>
  <div class="peer-info">
    <div class="peer-row">
      <span
        class="dot"
        :class="state.online ? 'on' : 'off'"
        :title="state.online ? '信令在线' : '信令离线'"
      ></span>
      <div class="peer-id" @click="copyPeerId" title="点击复制完整 PeerID">
        <span class="label">你的 ID</span>
        <span class="value">{{ shortPeerId(state.peerId) || '生成中…' }}</span>
        <span class="copied" v-if="copied">已复制</span>
      </div>
    </div>

    <div class="name-row">
      <template v-if="!editing">
        <span class="name" @dblclick="startEdit" title="双击编辑昵称">
          {{ state.ownName || '未命名' }}
        </span>
        <button class="btn-mini" @click="startEdit">改名</button>
      </template>
      <template v-else>
        <input
          class="name-input"
          v-model="nameInput"
          maxlength="24"
          @keyup.enter="commitEdit"
          @keyup.esc="editing = false"
          autofocus
        />
        <button class="btn-mini primary" @click="commitEdit">确定</button>
      </template>
    </div>

    <div class="meta-row">
      <span class="meta-item signal" :title="serverLabel ? '信令: ' + serverLabel : '信令状态'">
        {{ state.online ? '信令已连接' : '信令未连接' }}
        <span v-if="serverLabel" class="server-mini">{{ serverLabel }}</span>
      </span>
      <span class="meta-sep" v-if="state.error">·</span>
      <span class="meta-error" v-if="state.error">{{ state.error }}</span>
    </div>
  </div>
</template>
