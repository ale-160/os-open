import { defineConfig } from 'vitest/config';

// 默认 node 环境（gif-encoder / css / os-assets 不依赖 DOM；IndexedDB 由 fake-indexeddb 在测试文件内注入）；
// 需要 window / localStorage / StorageEvent 的用例（os-language-core / os-language）在文件头用
// `// @vitest-environment jsdom` 单独切到 jsdom。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
