'use client';

/** 游戏主舞台：房间布景 + 咕咕踱步（rAF 移动、碰边折返）+ 气泡 */

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { HATCH_TAPS } from '@/lib/balance';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import { PetSprite } from './PetSprite';

const WALK_SPEED = 4.2; // %/s
const BOUND_L = 26;
const BOUND_R = 74;

export function PetStage() {
  const pet = usePetStore((s) => s.pet)!;
  const anim = usePetStore((s) => s.anim);
  const burst = usePetStore((s) => s.burst);
  const bubble = usePetStore((s) => s.bubble);
  const tapPet = usePetStore((s) => s.tapPet);
  const tapEgg = usePetStore((s) => s.tapEgg);
  const resolvedSkin = usePetStore((s) => s.resolvedSkin);
  const { locale } = useLocale();
  const t = ui(locale);

  const wrapRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef<1 | -1>(1);
  const [facing, setFacing] = useState<1 | -1>(1);

  const isEgg = pet.stage === 'egg';
  const walking = !isEgg && !pet.sleeping && !anim && !pet.sick;

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

  return (
    <div className="relative min-h-[320px] flex-1 overflow-hidden">
      {/* 布景：暖色天空 + 太阳 + 云 + 地板 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#ffedd0] via-[#fff8ea] to-[#ffedcb]" />
      <div className="absolute left-[9%] top-[9%] h-12 w-12 rounded-full bg-[#ffd98a] shadow-[0_0_44px_18px_rgba(255,217,138,0.55)]" />
      <div className="absolute right-[10%] top-[16%] h-10 w-20 rounded-full bg-white/80 blur-[1px]" />
      <div className="absolute right-[16%] top-[11%] h-8 w-14 rounded-full bg-white/70 blur-[1px]" />
      <div className="absolute -bottom-[14%] left-1/2 h-[34%] w-[150%] -translate-x-1/2 rounded-[100%] bg-[#f7dcae]" />
      <div className="absolute bottom-0 h-[7%] w-full bg-[#f2d19a]/70" />

      {/* 咕咕（含气泡，随踱步整体移动） */}
      <div ref={wrapRef} className="absolute bottom-[7%] -translate-x-1/2" style={{ left: '50%' }}>
        {bubble && (
          <div
            key={bubble.id}
            className="anim-pop absolute -top-12 left-1/2 z-10 w-max max-w-[230px] -translate-x-1/2 rounded-2xl border border-amber-100 bg-white/95 px-3.5 py-2 text-sm font-medium shadow-lg shadow-amber-900/10"
          >
            {bubble.text}
            <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-amber-100 bg-white/95" />
          </div>
        )}
        <PetSprite
          pet={pet}
          anim={anim}
          burst={burst}
          walking={walking}
          facing={facing}
          customSkin={resolvedSkin()}
          onTap={isEgg ? tapEgg : tapPet}
        />
      </div>

      {/* 破壳提示 */}
      {isEgg && pet.tapsToHatch === HATCH_TAPS && (
        <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 animate-pulse rounded-full bg-white/85 px-4 py-1.5 text-sm font-semibold text-gugu-accent shadow">
          {t.hatchTapHint}
        </div>
      )}
    </div>
  );
}
