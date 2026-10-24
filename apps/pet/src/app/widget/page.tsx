'use client';

/**
 * 咕咕挂件页（/pet/widget/）：被 Ale OS 壳以透明 iframe 浮窗加载。
 * 只保留宠物本体 + 气泡 + 三快捷键；与独立页共享同一 localStorage 存档
 * （storage 事件互同步 + tick 双写守卫，见 store.tick）。
 */

import { useEffect, useRef, useState } from 'react';
import { PetSprite } from '@/components/PetSprite';
import { useLocale } from '@/hooks/useLocale';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { ActivityState, BurstData, PetState } from '@/lib/types';

const TICK_MS = 5000;
const BUBBLE_MS = 4200;
const WALK_SPEED = 3.5;
const BOUND_L = 12;
const BOUND_R = 88;

export default function WidgetPage() {
  const ready = usePetStore((s) => s.ready);
  const pet = usePetStore((s) => s.pet);
  const anim = usePetStore((s) => s.anim);
  const burst = usePetStore((s) => s.burst);
  const bubble = usePetStore((s) => s.bubble);
  const tapPet = usePetStore((s) => s.tapPet);
  const tapEgg = usePetStore((s) => s.tapEgg);
  const doAction = usePetStore((s) => s.doAction);
  const init = usePetStore((s) => s.init);
  const clearBubble = usePetStore((s) => s.clearBubble);
  const resolvedSkin = usePetStore((s) => s.resolvedSkin);
  const { locale } = useLocale();
  const t = ui(locale);

  const wrapRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef<1 | -1>(1);
  const [facing, setFacing] = useState<1 | -1>(1);

  useEffect(() => {
    init();
    const timer = setInterval(() => usePetStore.getState().tick(), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') usePetStore.getState().tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [init]);

  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(clearBubble, BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [bubble, clearBubble]);

  const isEgg = pet?.stage === 'egg';
  const walking = !!pet && !isEgg && !pet.sleeping && !anim && !pet.sick;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let px = 50;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (walking) {
        px += dirRef.current * WALK_SPEED * dt;
        if (px >= BOUND_R) {
          px = BOUND_R;
          dirRef.current = -1;
          setFacing(-1);
        } else if (px <= BOUND_L) {
          px = BOUND_L;
          dirRef.current = 1;
          setFacing(1);
        }
        if (wrapRef.current) wrapRef.current.style.left = `${px}%`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [walking]);

  // 透明背景（壳侧 iframe 透出桌面）
  return (
    <>
      <style>{`html,body{background:transparent!important;overflow:hidden}`}</style>
      <div className="fixed inset-0 overflow-hidden" role="presentation">
        {!ready ? null : !pet ? (
          <Unadopted />
        ) : (
          <>
            {/* 气泡 */}
            {bubble && (
              <div
                key={bubble.id}
                className="anim-pop absolute left-1/2 top-2 z-10 w-max max-w-[190px] -translate-x-1/2 rounded-2xl border border-amber-100 bg-white/95 px-3 py-1.5 text-xs font-medium shadow-lg shadow-amber-900/10"
              >
                {bubble.text}
              </div>
            )}

            {/* 咕咕本体 */}
            <div ref={wrapRef} className="absolute bottom-[52px] -translate-x-1/2" style={{ left: '50%' }}>
              <PetSprite
                pet={pet as PetState}
                anim={anim as ActivityState | null}
                burst={burst as BurstData | null}
                walking={walking}
                facing={facing}
                customSkin={resolvedSkin()}
                onTap={isEgg ? tapEgg : tapPet}
              />
            </div>

            {/* 快捷键 */}
            <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
              {(
                [
                  { icon: '🍪', id: 'feed' as const },
                  { icon: '🛁', id: 'wash' as const },
                  { icon: '🎾', id: 'play' as const },
                ]
              ).map(({ icon, id }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => doAction(id)}
                  aria-label={t[`act${id.charAt(0).toUpperCase()}${id.slice(1)}` as 'actFeed']}
                  className="press flex h-9 w-9 items-center justify-center rounded-full border border-amber-100 bg-white/90 text-lg shadow-md backdrop-blur hover:bg-amber-50"
                >
                  {icon}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const p = usePetStore.getState().pet;
                  if (p && p.stage !== 'egg') usePetStore.getState().toggleSleep();
                }}
                aria-label={pet.sleeping ? t.actWake : t.actSleep}
                className="press flex h-9 w-9 items-center justify-center rounded-full border border-amber-100 bg-white/90 text-lg shadow-md backdrop-blur hover:bg-amber-50"
              >
                {pet.sleeping ? '☀️' : '😴'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** 未领养时：引导去完整应用领养 */
function Unadopted() {
  const { locale } = useLocale();
  const t = ui(locale);
  const basePath = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';
  return (
    <a
      href={`${basePath}/pet/`}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-100 bg-white/95 px-4 py-3 text-center text-xs font-bold shadow-lg backdrop-blur hover:bg-amber-50"
    >
      <span className="block text-2xl">🐣</span>
      {t.adoptTitle}
    </a>
  );
}
