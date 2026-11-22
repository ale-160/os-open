import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// 只跑 src 下的单测（纯逻辑：存储序列化 / 历史版本 / 文本统计 / HTML 导出）。
// IndexedDB 由 fake-indexeddb 在各测试文件内按需注入，环境保持 node。
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  esbuild: {
    // tsconfig 为 Next 设的 jsx: preserve，单测里需要真正编译 TSX
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
