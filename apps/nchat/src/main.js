import { createApp } from 'vue'
import App from './App.vue'
import './styles/tokens.css'
import './styles/main.css'

// 注册 Service Worker（生产环境）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[nchat] SW 注册失败：', err)
    })
  })
}

createApp(App).mount('#app')
