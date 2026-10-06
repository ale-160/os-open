import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// APP_BASE_PATH：作为 Ale OS 子应用嵌入时的部署子路径（如 /chat）
const APP_BASE_PATH = process.env.APP_BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base: APP_BASE_PATH,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0')
  },
  server: {
    host: true,
    port: 5173,
    // 代理 PeerJS 信令服务器：浏览器连接本端口，vite 转发到 localhost:9000
    // 这样局域网设备无需直连 9000 端口，避免防火墙问题
    proxy: {
      '/peerjs': {
        target: 'http://localhost:9000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    outDir: 'out'
  }
})
