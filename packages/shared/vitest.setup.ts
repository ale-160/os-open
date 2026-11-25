/**
 * Node ≥ 25 默认启用实验性 Web Storage：全局自带 `localStorage` / `sessionStorage` 访问器，
 * 未传 --localstorage-file 时取值为 undefined。vitest 的 jsdom 环境不会覆盖已存在的全局，
 * 于是源码里的裸 `localStorage` 拿到的是 Node 的空实现而非 jsdom 的 Storage。
 * 在 jsdom 环境下把两者显式指回 jsdom 窗口（Node 24 / 浏览器语义一致，不影响 node 环境用例）。
 */
const dom = (globalThis as { jsdom?: { window: Pick<Window, 'localStorage' | 'sessionStorage'> } }).jsdom;
if (dom) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      enumerable: true,
      get: () => dom.window[key],
    });
  }
}

export {};
