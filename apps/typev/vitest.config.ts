import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 只跑 src 下的纯逻辑单测（node 环境，不依赖浏览器）；`@/` 与 tsconfig paths 保持一致
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
