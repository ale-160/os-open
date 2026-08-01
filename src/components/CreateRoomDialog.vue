<script setup>
import { ref } from 'vue'
import { AccessRule, SpeakRule } from '../lib/protocol.js'
import { CONFIG } from '../config.js'

const emit = defineEmits(['create', 'close'])

const name = ref('')
const aliasInput = ref('')
const aliases = ref([])
const access = ref(AccessRule.OPEN)
const speak = ref(SpeakRule.ALL)
const password = ref('')
const approveThreshold = ref(50)
const showAdvanced = ref(false)

const maxAliases = CONFIG.MAX_ALIASES

function addAlias() {
  const v = aliasInput.value.trim()
  if (!v) return
  if (aliases.value.length >= maxAliases) return
  if (aliases.value.includes(v)) return
  aliases.value.push(v)
  aliasInput.value = ''
}

function removeAlias(idx) {
  aliases.value.splice(idx, 1)
}

function onCreate() {
  const n = name.value.trim()
  if (!n) return
  const options = {
    aliases: aliases.value.slice(),
    access: access.value,
    speak: speak.value,
    approveThreshold: Number(approveThreshold.value) || 50
  }
  if (access.value === AccessRule.PASSWORD && password.value) {
    options.password = password.value
  }
  emit('create', n, options)
  // 重置
  name.value = ''
  aliases.value = []
  password.value = ''
  access.value = AccessRule.OPEN
  speak.value = SpeakRule.ALL
  approveThreshold.value = 50
  showAdvanced.value = false
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card">
      <div class="modal-head">
        <span>创建房间</span>
        <button class="btn-mini" @click="emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>房间名</label>
          <input
            class="input"
            v-model="name"
            placeholder="如 ale160"
            maxlength="64"
            @keyup.enter="onCreate"
            autofocus
          />
        </div>

        <div class="form-row">
          <label>
            别名
            <span class="label-hint">（最多 {{ maxAliases }} 个，方便搜索）</span>
          </label>
          <div class="alias-input-wrap">
            <input
              class="input"
              v-model="aliasInput"
              placeholder="如 阿乐一百六"
              @keyup.enter="addAlias"
            />
            <button
              class="btn-mini"
              @click="addAlias"
              :disabled="!aliasInput.trim() || aliases.length >= maxAliases"
            >
              添加
            </button>
          </div>
          <div class="alias-tags" v-if="aliases.length">
            <span v-for="(a, i) in aliases" :key="i" class="alias-tag">
              {{ a }}
              <button class="alias-remove" @click="removeAlias(i)">✕</button>
            </span>
          </div>
        </div>

        <button class="toggle-advanced" @click="showAdvanced = !showAdvanced">
          {{ showAdvanced ? '▼' : '▶' }} 高级设置
        </button>

        <div v-if="showAdvanced" class="advanced">
          <div class="form-row">
            <label>准入规则</label>
            <select class="input" v-model="access">
              <option :value="AccessRule.OPEN">开放（任何人可加入）</option>
              <option :value="AccessRule.PASSWORD">密码（需密码加入）</option>
              <option :value="AccessRule.APPROVE">审核（需创建者批准）</option>
              <option :value="AccessRule.INVITE">邀请（仅邀请可加入）</option>
            </select>
          </div>

          <div class="form-row" v-if="access === AccessRule.PASSWORD">
            <label>房间密码</label>
            <input
              class="input"
              v-model="password"
              type="password"
              placeholder="设置加入密码"
            />
          </div>

          <div class="form-row">
            <label>发言规则</label>
            <select class="input" v-model="speak">
              <option :value="SpeakRule.ALL">所有人可发言</option>
              <option :value="SpeakRule.WHITELIST">仅白名单发言</option>
              <option :value="SpeakRule.APPROVE">发言需审核</option>
            </select>
            <p class="form-hint" v-if="speak !== SpeakRule.ALL">
              白名单和审核功能需在加入后由房间占领者管理
            </p>
          </div>

          <div class="form-row">
            <label>
              审核/邀请权限阈值
              <span class="label-hint">（星标 ≥ 此值的成员可审核加入申请和邀请他人）</span>
            </label>
            <input
              class="input"
              v-model.number="approveThreshold"
              type="number"
              min="1"
              max="99"
              placeholder="50"
            />
            <p class="form-hint">
              创建者默认 99 星，普通成员 1 星。阈值越低，能审核的成员越多。
            </p>
          </div>

          <p class="form-hint" v-if="access === AccessRule.APPROVE">
            🛡 审核制：新成员需提交申请，由星标达标的在线成员批准后才能加入
          </p>
          <p class="form-hint" v-if="access === AccessRule.INVITE">
            ✉ 邀请制：仅星标达标的成员可邀请他人加入
          </p>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="emit('close')">取消</button>
        <button class="btn primary" @click="onCreate" :disabled="!name.trim()">
          创建并加入
        </button>
      </div>
    </div>
  </div>
</template>
