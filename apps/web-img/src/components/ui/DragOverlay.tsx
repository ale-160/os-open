'use client';

import type { ReactNode } from 'react';

interface DragOverlayProps {
  icon: ReactNode;
  label: string;
}

/** 全窗口拖入文件时的指示覆盖层：淡入 + 卡片弹入 + 图标脉冲环 */
export function DragOverlay({ icon, label }: DragOverlayProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px] z-50 pointer-events-none animate-in fade-in duration-150">
      <div className="bg-card p-8 rounded-xl shadow-2xl border-2 border-dashed border-primary flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
        <span className="relative flex items-center justify-center">
          <span aria-hidden="true" className="absolute w-16 h-16 rounded-full bg-primary/30 animate-ping-slow" />
          <span className="relative text-primary">{icon}</span>
        </span>
        <p className="text-lg font-semibold">{label}</p>
      </div>
    </div>
  );
}
