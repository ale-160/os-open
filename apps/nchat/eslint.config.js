import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

/**
 * nchat ESLint flat config（Vue 3 + Vite，纯 JS）。
 * 规则集：@eslint/js recommended + eslint-plugin-vue flat/recommended。
 * 纯格式类规则交给编辑器/作者习惯，不在 lint 中强制（见下方 rules 说明）。
 */
export default [
  { ignores: ['out/**', 'dist/**', 'node_modules/**'] },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // 浏览器端源码（含 .vue SFC）
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // vite.config.js 中 define 注入的构建期常量
        __APP_VERSION__: 'readonly'
      }
    }
  },

  // 单元测试（vitest，node 环境）
  {
    files: ['src/**/*.test.js'],
    languageOptions: { globals: { ...globals.node } }
  },

  // Node 端脚本与工具配置
  {
    files: ['scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } }
  },

  // Service Worker
  {
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } }
  },

  {
    rules: {
      // 组件名沿用单词命名（Icon、Lightbox），改名牵动引用与文件名，收益仅为风格
      'vue/multi-word-component-names': 'off',
      // 以下为 vue/recommended 中纯模板排版/属性顺序规则（现有代码共 ~1200 处），不影响正确性
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/attributes-order': 'off',
      // 以 _ 开头的参数/变量视为有意未使用；catch (e) 不强制使用 e
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  }
]
