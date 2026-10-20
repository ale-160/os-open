'use client';

import Link from 'next/link';

interface HeaderProps {
  onOpenSettings?: () => void;
  onOpenGuide?: () => void;
}

/**
 * 页面头部组件
 */
export default function Header({ onOpenSettings, onOpenGuide }: HeaderProps) {
  return (
    <header className="w-full bg-gray-950 border-b border-gray-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* 项目标题 */}
        <div className="flex items-center gap-3">
          {/* 内联 SVG 标志：静态导出任意子路径下均可用，无外部资源依赖 */}
          <svg width="32" height="32" viewBox="0 0 720 720" aria-hidden="true" className="rounded-xl">
            <defs>
              <linearGradient id="typev-logo-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#0f172a" />
                <stop offset="1" stopColor="#1e293b" />
              </linearGradient>
            </defs>
            <rect width="720" height="720" rx="160" fill="url(#typev-logo-bg)" />
            <text x="300" y="470" fontFamily="'PingFang SC','Microsoft YaHei',sans-serif" fontSize="340" fontWeight="700" fill="#ffffff" textAnchor="middle">字</text>
            <rect x="440" y="220" width="56" height="250" rx="12" fill="#38bdf8" />
          </svg>
          <h1 className="text-white text-2xl font-bold">TypeV</h1>
        </div>
        
        {/* 右侧：帮助和设置按钮 */}
        <div className="flex items-center gap-2">
          {/* 帮助按钮 - 打开样式指南 */}
          <button
            onClick={onOpenGuide}
            className="p-2 rounded transition-colors hover:bg-gray-800"
            title="样式使用指南"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-white"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
            </svg>
          </button>

          {/* 设置按钮 */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded transition-colors hover:bg-gray-800"
            title="设置"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-white"
            >
              <path d="M19.14,12.94c0.04-0.32,0.06-0.64,0.06-0.94c0-0.3-0.02-0.62-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.39,0.12-0.59l-1.93-3.33c-0.12-0.21-0.36-0.29-0.58-0.21l-2.39,0.96c-0.5-0.38-1.03-0.7-1.61-0.95L14.42,2.8c-0.04-0.23-0.24-0.4-0.48-0.4h-3.88c-0.24,0-0.44,0.17-0.48,0.4L9.25,5.37C8.67,5.62,8.14,5.94,7.64,6.32L5.25,5.36c-0.22-0.08-0.46,0-0.58,0.21L2.74,8.9C2.62,9.11,2.67,9.36,2.86,9.5l2.03,1.58C4.85,11.38,4.83,11.68,4.83,12c0,0.32,0.02,0.62,0.06,0.94l-2.03,1.58c-0.18,0.14-0.23,0.39-0.12,0.59l1.93,3.33c0.12,0.21,0.36,0.29,0.58,0.21l2.39-0.96c0.5,0.38,1.03,0.7,1.61,0.95l0.34,2.56c0.04,0.23,0.24,0.4,0.48,0.4h3.88c0.24,0,0.44-0.17,0.48-0.4l0.34-2.56c0.58-0.25,1.11-0.57,1.61-0.95l2.39,0.96c0.22,0.08,0.46,0,0.58-0.21l1.93-3.33c0.12-0.21,0.07-0.45-0.12-0.59L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
