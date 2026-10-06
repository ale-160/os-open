'use client';

import React, { useEffect, useState } from 'react';

/**
 * 启动动画：每次浏览器会话首次进入系统时展示品牌闪屏（logo + 名称 + 加载条），
 * 约 1.2 秒后淡出进入桌面。尊重系统「减少动态效果」设置；会话内只出现一次。
 */
export function BootSplash() {
  const [phase, setPhase] = useState<'hidden' | 'show' | 'fade'>('hidden');

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (sessionStorage.getItem('ale-os-booted') === '1') return;
      sessionStorage.setItem('ale-os-booted', '1');
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载期一次性初始化
    setPhase('show');
    const t1 = setTimeout(() => setPhase('fade'), 750);
    const t2 = setTimeout(() => setPhase('hidden'), 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  if (phase === 'hidden') return null;

  return (
    <div
      data-os-boot
      aria-hidden
      className={`fixed inset-0 z-[60] os-desktop-bg flex flex-col items-center justify-center gap-5 transition-opacity duration-500 ${
        phase === 'fade' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <img
        src="https://ale160.com/images/logo-icon.png"
        alt=""
        className="h-16 w-16 rounded-2xl shadow-lg"
      />
      <div className="text-2xl font-bold tracking-wide text-foreground">
        Ale <span className="text-primary">OS</span>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full w-full rounded-full bg-primary transition-transform duration-700 ease-out ${
            phase === 'show' ? '-translate-x-full' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
  );
}
