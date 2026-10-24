'use client';

/**
 * 咕咕桌宠挂件（壳侧）：桌面角落的开关按钮 + 可拖拽透明浮窗（iframe 加载 /pet/widget/）。
 * 挂件与独立页同源共享存档；应用全屏时自动隐藏，回桌面恢复；开关与位置记忆在 localStorage。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAppWindow } from '@/components/app/AppWindow';
import { getStrings, type Language } from '@/data/i18n';

const ENABLED_KEY = 'ale-os-pet-widget';
const POS_KEY = 'ale-os-pet-widget-pos';
const WIDGET_W = 232;
const WIDGET_H = 296;
const GRIP_H = 30;

export function PetWidget({ language }: { language: Language }) {
  const { activeApp } = useAppWindow();
  const S = getStrings(language);

  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const clampPos = useCallback((p: { x: number; y: number }) => ({
    x: Math.min(Math.max(8, p.x), Math.max(8, window.innerWidth - WIDGET_W - 8)),
    y: Math.min(Math.max(8, p.y), Math.max(8, window.innerHeight - WIDGET_H - 8))
  }), []);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(ENABLED_KEY) === 'on');
      const saved = localStorage.getItem(POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { x: number; y: number };
        setPos(clampPos(parsed));
      }
    } catch {
      /* 忽略坏数据 */
    }
    setMounted(true);
  }, [clampPos]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ENABLED_KEY, next ? 'on' : 'off');
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const onGripPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { dx: e.clientX, dy: e.clientY };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setPos((prev) => {
        const base = prev ?? defaultPos();
        const next = clampPos({ x: base.x + (e.clientX - drag.dx), y: base.y + (e.clientY - drag.dy) });
        drag.dx = e.clientX;
        drag.dy = e.clientY;
        return next;
      });
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(p));
          } catch { /* ignore */ }
        }
        return p;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [mounted, clampPos]);

  if (!mounted) return null;

  const visible = enabled && !activeApp; // 应用全屏时隐藏，回桌面恢复
  const position = pos ?? defaultPos();

  return (
    <>
      {/* 桌面角落开关 */}
      <button
        type="button"
        onClick={toggle}
        aria-label={enabled ? S.petWidgetHide : S.petWidgetShow}
        title={enabled ? S.petWidgetHide : S.petWidgetShow}
        className="glass fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full text-xl shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        🐣
      </button>

      {/* 挂件浮窗 */}
      {visible && (
        <div
          data-os-pet-widget
          className="fixed z-30 select-none rounded-2xl border border-border/40 shadow-2xl"
          style={{ left: position.x, top: position.y, width: WIDGET_W }}
        >
          {/* 拖拽把手 */}
          <div
            onPointerDown={onGripPointerDown}
            title={S.petWidgetGrip}
            className="flex h-[30px] cursor-grab items-center justify-between rounded-t-2xl border-b border-border/30 bg-background/70 px-2 backdrop-blur active:cursor-grabbing"
          >
            <span className="text-[11px] font-semibold text-muted-foreground">🐣 GuGu</span>
            <button
              type="button"
              onClick={toggle}
              aria-label={S.petWidgetClose}
              title={S.petWidgetClose}
              className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {/* 透明宠物窗 */}
          <div
            className="overflow-hidden rounded-b-2xl bg-transparent"
            style={{ height: WIDGET_H - GRIP_H }}
          >
            <iframe
              src="/pet/widget/"
              title="GuGu"
              className="h-full w-full border-0"
              style={{ background: 'transparent' }}
            />
          </div>
        </div>
      )}
    </>
  );
}

/** 默认位置：右下角（开关按钮上方） */
function defaultPos(): { x: number; y: number } {
  return {
    x: Math.max(8, window.innerWidth - WIDGET_W - 16),
    y: Math.max(8, window.innerHeight - WIDGET_H - 76)
  };
}
