'use client';

/**
 * 咕咕分层渲染器：AI 生成的身体 PNG（无脸）+ 代码绘制的 SVG 表情 + 粒子演出。
 * 动画全部程序驱动：呼吸/小跳/进食/洗澡/玩耍/生病发抖/眨眼/啾啾嘴，不做逐帧序列。
 */

import { useEffect, useState } from 'react';
import { THRESHOLD } from '@/lib/balance';
import { bodyLocalSrc, bodySrc, DEFAULT_CUSTOM_FACE, faceLayoutFor, type FaceLayout } from '@/lib/skins';
import { accessoryById, accessoryLocalSrc, accessorySrc } from '@/lib/accessories';
import { fallbackToLocal } from '@/lib/assetUrl';
import type { AccessoryId, ActivityState, BurstData, PetState } from '@/lib/types';

export interface ResolvedSkin {
  /** 身体图地址（dataURL / 远程 URL / 官方素材路径） */
  src: string;
  /** 是否叠加咕咕 SVG 表情 */
  faceOverlay: boolean;
}

/** 闲时小动作 id（与 globals.css 的 anim-<id> 一一对应） */
export type TrickId = 'tilt' | 'peck' | 'turn' | 'flap' | 'sing' | 'dance' | 'sit' | 'run';

interface PetSpriteProps {
  pet: PetState;
  anim: ActivityState | null;
  burst: BurstData | null;
  walking: boolean;
  /** 面朝方向（走路时随移动翻转） */
  facing: 1 | -1;
  /** 激活的自定义皮肤（缺省用官方分层形象） */
  customSkin?: ResolvedSkin | null;
  /** 闲时小动作（站立时随机表演） */
  trick?: TrickId | null;
  onTap: () => void;
}

/** 配件锚点布局（百分比相对精灵容器；head/side/scarf 固定，eyes 跟随表情布局） */
const ACCESSORY_LAYOUT: Record<'head' | 'side' | 'scarf', { x: number; y: number; w: number }> = {
  head: { x: 50, y: 7, w: 36 },
  side: { x: 69, y: 13, w: 18 },
  scarf: { x: 50, y: 45, w: 44 },
};

/** 配件层：蛋阶段与自定义无叠加皮肤时不渲染 */
function AccessoryLayer({
  accessory,
  face,
  isEgg,
  hasFaceOverlay,
}: {
  accessory: AccessoryId;
  face: FaceLayout;
  isEgg: boolean;
  hasFaceOverlay: boolean;
}) {
  if (isEgg) return null;
  const def = accessoryById(accessory);
  if (!def) return null;
  if (def.anchor === 'eyes') {
    // 眼镜：跟随表情布局（眼部中线）
    const layout = hasFaceOverlay ? DEFAULT_CUSTOM_FACE : face;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={accessorySrc(def.id)}
        alt=""
        draggable={false}
        onError={(e) => fallbackToLocal(e, accessoryLocalSrc(def.id))}
        className="pointer-events-none absolute object-contain"
        style={{
          left: `${50 - 19}%`,
          top: `${layout.eyeY * 100 - 7}%`,
          width: '38%',
        }}
      />
    );
  }
  const l = ACCESSORY_LAYOUT[def.anchor];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={accessorySrc(def.id)}
      alt=""
      draggable={false}
      onError={(e) => fallbackToLocal(e, accessoryLocalSrc(def.id))}
      className="pointer-events-none absolute object-contain"
      style={{ left: `${l.x - l.w / 2}%`, top: `${l.y}%`, width: `${l.w}%` }}
    />
  );
}

const EYE_INK = '#4a3226';
const BEAK_FILL = '#f7a64a';
const BLUSH_FILL = '#f79892';

export function PetSprite({ pet, anim, burst, walking, facing, customSkin, trick, onTap }: PetSpriteProps) {
  const isEgg = pet.stage === 'egg';
  const sleeping = pet.sleeping;
  const sick = pet.sick;
  const face = customSkin?.faceOverlay ? DEFAULT_CUSTOM_FACE : faceLayoutFor(pet.variant, pet.stage);
  const showFace = isEgg ? false : (customSkin ? customSkin.faceOverlay : true);

  const happy =
    !sleeping &&
    !sick &&
    (anim === 'playing' || anim === 'eating' || anim === 'washing' || pet.mood >= THRESHOLD.happyFace);
  const sad = !sleeping && !sick && pet.mood <= THRESHOLD.sadFace;

  // 身体动画类：动作演出 > 生病 > 闲时小动作 > 走路 > 呼吸
  let bodyAnim = 'anim-breathe';
  if (anim === 'eating') bodyAnim = 'anim-eat';
  else if (anim === 'washing') bodyAnim = 'anim-scrub';
  else if (anim === 'playing') bodyAnim = 'anim-happy';
  else if (anim === 'working') bodyAnim = 'anim-work';
  else if (anim === 'studying') bodyAnim = 'anim-study';
  else if (sick) bodyAnim = 'anim-shiver';
  else if (trick) bodyAnim = `anim-${trick}`;
  else if (walking) bodyAnim = 'anim-hop';

  return (
    <div
      className="relative w-[46vw] max-w-[240px] min-w-[170px] select-none"
      style={{ aspectRatio: '4 / 5' }}
      onClick={onTap}
      role="button"
      aria-label={isEgg ? 'egg' : 'pet'}
    >
      {/* 地面阴影 */}
      <div className="absolute bottom-[2%] left-1/2 h-[7%] w-[64%] -translate-x-1/2 rounded-[50%] bg-[#8a6a4d]/20 blur-[3px]" />

      {/* 身体 + 表情 */}
      <div
        key={burst?.kind === 'wobble' ? `wobble-${burst.id}` : undefined}
        className={`absolute inset-0 ${burst?.kind === 'wobble' ? 'anim-wobble' : ''} ${bodyAnim}`}
        style={{ transform: `scaleX(${facing})` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={!isEgg && customSkin ? customSkin.src : bodySrc(pet.variant, pet.stage)}
          alt={pet.name}
          className="h-full w-full object-contain"
          draggable={false}
          onError={(e) => {
            if (!customSkin) fallbackToLocal(e, bodyLocalSrc(pet.variant, pet.stage));
          }}
        />
        {/* 蛋裂纹（随啄壳进度增多） */}
        {isEgg && <EggCracks tapsToHatch={pet.tapsToHatch} />}
        {showFace && (
          <Face
            face={face}
            sleeping={sleeping}
            happy={happy}
            sad={sad}
            sick={sick}
            chewing={anim === 'eating'}
          />
        )}
        {pet.equippedAccessory && (
          <AccessoryLayer
            accessory={pet.equippedAccessory}
            face={face}
            isEgg={isEgg}
            hasFaceOverlay={!!customSkin?.faceOverlay}
          />
        )}
      </div>

      {/* 常驻粒子层 */}
      <Particles sleeping={sleeping} washing={anim === 'washing'} playing={anim === 'playing'} sick={sick} working={anim === 'working'} studying={anim === 'studying'} trick={trick} />

      {/* 摸摸爱心 / 破壳彩带 */}
      {burst?.kind === 'heart' && <BurstParticles key={`h-${burst.id}`} kind="heart" />}
      {burst?.kind === 'confetti' && <BurstParticles key={`c-${burst.id}`} kind="confetti" />}
    </div>
  );
}

/** 蛋壳裂纹：按剩余啄壳次数显隐 */
function EggCracks({ tapsToHatch }: { tapsToHatch: number }) {
  const done = 5 - tapsToHatch; // 已啄次数
  const cracks = [
    'M46 18 L50 26 L45 32 L51 40',
    'M58 22 L54 30 L60 36 L55 44',
    'M36 26 L41 33 L35 40 L42 47',
    'M52 44 L48 52 L55 57 L50 64',
  ];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      {cracks.slice(0, done).map((d, i) => (
        <path key={i} d={d} fill="none" stroke={EYE_INK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      ))}
    </svg>
  );
}

interface FaceProps {
  face: FaceLayout;
  sleeping: boolean;
  happy: boolean;
  sad: boolean;
  sick: boolean;
  chewing: boolean;
}

/** SVG 表情：眼（眨眼/开心弧/委屈垂/睡颜）+ 喙（啾啾嘴）+ 腮红（小游戏接点心复用） */
export function Face({ face, sleeping, happy, sad, sick, chewing }: FaceProps) {
  // viewBox 100x100 + preserveAspectRatio=none：x/y 直接用百分比坐标
  const lx = 50 - face.eyeDX * 100;
  const rx = 50 + face.eyeDX * 100;
  const ey = face.eyeY * 100;
  const eyeRx = face.eyeRx * 100;
  const eyeRy = face.eyeRy * 100;
  const by = face.beakY * 100;
  const bs = face.beakSize * 100;
  const blushY = face.blushY * 100;
  const blushDX = face.blushDX * 100;
  const blushRx = face.blushRx * 100;
  const blushRy = face.blushRy * 100;

  const eye = (cx: number) => {
    if (sleeping) {
      return (
        <path d={`M ${cx - 5} ${ey} Q ${cx} ${ey + 3.6} ${cx + 5} ${ey}`} stroke={EYE_INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      );
    }
    if (happy) {
      return (
        <path d={`M ${cx - 5.2} ${ey + 1.4} Q ${cx} ${ey - 5.4} ${cx + 5.2} ${ey + 1.4}`} stroke={EYE_INK} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      );
    }
    if (sad || sick) {
      return (
        <path d={`M ${cx - 5} ${ey - 1.4} Q ${cx} ${ey + 4.6} ${cx + 5} ${ey - 1.4}`} stroke={EYE_INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      );
    }
    return (
      <g className="anim-blink">
        <ellipse cx={cx} cy={ey} rx={eyeRx} ry={eyeRy} fill={EYE_INK} />
        <circle cx={cx - eyeRx * 0.3} cy={ey - eyeRy * 0.35} r={eyeRx * 0.32} fill="#fff" opacity={0.9} />
      </g>
    );
  };

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      {/* 腮红 */}
      <ellipse cx={50 - blushDX} cy={blushY} rx={blushRx} ry={blushRy} fill={BLUSH_FILL} opacity={happy ? 0.75 : sad || sick ? 0.3 : 0.5} />
      <ellipse cx={50 + blushDX} cy={blushY} rx={blushRx} ry={blushRy} fill={BLUSH_FILL} opacity={happy ? 0.75 : sad || sick ? 0.3 : 0.5} />
      {eye(lx)}
      {eye(rx)}
      {/* 喙 */}
      <g className={chewing ? 'anim-chirp' : undefined}>
        <path
          d={`M ${50 - bs} ${by} L ${50 + bs} ${by} L ${50} ${by + bs * 1.25} Z`}
          fill={BEAK_FILL}
          stroke={EYE_INK}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </g>
      {/* 生病小汗珠 */}
      {sick && !sleeping && (
        <text x={rx + 4} y={ey - 6} fontSize={6} opacity={0.85}>
          💧
        </text>
      )}
    </svg>
  );
}

/** 常驻状态粒子：Zzz / 泡泡 / 星星 / 汗 / 元宝 / 书本 / 唱歌音符 */
function Particles({
  sleeping,
  washing,
  playing,
  sick,
  working,
  studying,
  trick,
}: {
  sleeping: boolean;
  washing: boolean;
  playing: boolean;
  sick: boolean;
  working?: boolean;
  studying?: boolean;
  trick?: TrickId | null;
}) {
  if (!sleeping && !washing && !playing && !sick && !working && !studying && !trick) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {trick === 'sing' &&
        ['♪', '♫', '♪'].map((ch, i) => (
          <span
            key={i}
            className="anim-float absolute text-[#8aa8ff]"
            style={{
              left: `${26 + i * 22}%`,
              top: '18%',
              fontSize: `${14 + i * 2}px`,
              animationDelay: `${i * 0.5}s`,
              ['--drift' as string]: `${i % 2 === 0 ? -12 : 12}px`,
            }}
          >
            {ch}
          </span>
        ))}
      {trick === 'dance' &&
        ['🎵', '💃', '🎵'].map((ch, i) => (
          <span
            key={i}
            className="anim-float absolute text-[#f6c445]"
            style={{
              left: `${24 + i * 24}%`,
              top: '16%',
              fontSize: `${13 + i * 2}px`,
              animationDelay: `${i * 0.45}s`,
              ['--drift' as string]: `${i % 2 === 0 ? -14 : 14}px`,
            }}
          >
            {ch}
          </span>
        ))}
      {trick === 'flap' &&
        ['🪶', '✨'].map((ch, i) => (
          <span
            key={i}
            className="anim-float absolute"
            style={{
              left: `${i === 0 ? 12 : 74}%`,
              top: '30%',
              fontSize: '14px',
              animationDelay: `${i * 0.6}s`,
              ['--drift' as string]: `${i === 0 ? -14 : 14}px`,
            }}
          >
            {ch}
          </span>
        ))}
      {working &&
        ['💰', '💰', '✨'].map((ch, i) => (
          <span
            key={i}
            className="anim-float absolute"
            style={{
              left: `${24 + i * 26}%`,
              top: '24%',
              fontSize: '15px',
              animationDelay: `${i * 0.5}s`,
              ['--drift' as string]: `${i % 2 === 0 ? -10 : 10}px`,
            }}
          >
            {ch}
          </span>
        ))}
      {studying &&
        ['📖', '✏️', '💡'].map((ch, i) => (
          <span
            key={i}
            className="anim-float absolute"
            style={{
              left: `${24 + i * 26}%`,
              top: '22%',
              fontSize: '15px',
              animationDelay: `${i * 0.55}s`,
              ['--drift' as string]: `${i % 2 === 0 ? -10 : 10}px`,
            }}
          >
            {ch}
          </span>
        ))}
      {sleeping &&
        [0, 0.9, 1.8].map((delay, i) => (
          <span
            key={i}
            className="anim-float absolute text-[#8aa8ff] font-bold"
            style={{
              left: `${58 + i * 6}%`,
              top: `${8 + i * 4}%`,
              fontSize: `${13 + i * 4}px`,
              animationDelay: `${delay}s`,
              ['--drift' as string]: '14px',
            }}
          >
            Z
          </span>
        ))}
      {washing &&
        [0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="anim-float absolute h-3 w-3 rounded-full border border-white/80 bg-white/40"
            style={{
              left: `${22 + i * 14}%`,
              top: '62%',
              animationDelay: `${i * 0.42}s`,
              ['--drift' as string]: `${i % 2 === 0 ? -10 : 10}px`,
            }}
          />
        ))}
      {playing &&
        ['✦', '♪', '✦'].map((ch, i) => (
          <span
            key={i}
            className="anim-float absolute text-[#f6c445]"
            style={{
              left: `${20 + i * 26}%`,
              top: '26%',
              fontSize: '16px',
              animationDelay: `${i * 0.55}s`,
              ['--drift' as string]: `${i % 2 === 0 ? -12 : 12}px`,
            }}
          >
            {ch}
          </span>
        ))}
      {sick && (
        <span
          className="anim-float absolute text-[14px]"
          style={{ left: '66%', top: '18%', animationDelay: '0.3s', ['--drift' as string]: '-6px' }}
        >
          💧
        </span>
      )}
    </div>
  );
}

/** 一次性爆发粒子：摸摸爱心 / 破壳彩带 */
function BurstParticles({ kind }: { kind: 'heart' | 'confetti' }) {
  const [alive, setAlive] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAlive(false), kind === 'confetti' ? 2200 : 1600);
    return () => clearTimeout(t);
  }, [kind]);
  if (!alive) return null;

  if (kind === 'heart') {
    return (
      <div className="pointer-events-none absolute inset-0">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="anim-burst absolute"
            style={{
              left: `${14 + i * 14}%`,
              top: `${34 + (i % 3) * 10}%`,
              fontSize: `${15 + (i % 3) * 5}px`,
              animationDelay: `${i * 0.09}s`,
              ['--drift' as string]: `${(i % 2 === 0 ? 1 : -1) * (10 + i * 3)}px`,
            }}
          >
            {i % 2 === 0 ? '💗' : '💛'}
          </span>
        ))}
      </div>
    );
  }
  const colors = ['#ff9f45', '#7bc86c', '#8aa8ff', '#f6c445', '#f79892', '#7fd8d0'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 16 }).map((_, i) => (
        <span
          key={i}
          className="anim-confetti absolute top-0 h-2.5 w-1.5 rounded-[2px]"
          style={{
            left: `${4 + (i * 23) % 92}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${(i % 6) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}
