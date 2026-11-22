import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * nchat 单元测试配置（Vitest，node 环境）。
 * 覆盖纯逻辑层：src/lib（LCAN 责任集、协议签名、加密原语）、
 * src/i18n（跟随系统语言）、src/utils（系统图库接入，fake-indexeddb）。
 * WebRTC/网络层（peer.js）与 UI 组件不在单测范围。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,ts}'],
  },
})
