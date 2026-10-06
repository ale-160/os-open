import { defineConfig } from 'vite';

// APP_BASE_PATH：作为 Ale OS 子应用嵌入时的部署子路径（如 /chat）
const APP_BASE_PATH = process.env.APP_BASE_PATH || '/';

export default defineConfig({
  base: APP_BASE_PATH,
  build: {
    outDir: 'out',
  },
});
