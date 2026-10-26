'use client';

/**
 * 咕咕分层渲染器：AI 生成的身体 PNG（无脸）+ 代码绘制的 SVG 表情 + 粒子演出。
 * 动画全部程序驱动：呼吸/小跳/进食/洗澡/玩耍/生病发抖/眨眼/啾啾嘴，不做逐帧序列。
 */

import { useEffect, useState } from 'react';
import { THRESHOLD } from '@/lib/balance';
import { bodyLocalSrc, bodySrc, DEFAULT_CUSTOM_FACE, faceLayoutFor, type FaceLayout } from '@/lib/skins';
import { accessoryById, accessoryLocalSrc, accessorySrc, type AccessoryDef } from '@/lib/accessories';
import { fallbackToLocal, resetAssetState } from '@/lib/assetUrl';
import { usePetStore } from '@/lib/store';
import type { AccessoryId, ActivityState, BurstData, GrowthStage, PetState } from '@/lib/types';

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

/** 配件槽位：不同佩戴位置使用不同锚点与层级 */
type AccSlot = 'hat' | 'ears' | 'helmet' | 'neck' | 'neckSmall' | 'eyes' | 'back' | 'headSide' | 'held' | 'bodyFront';

/** 背在身后/披在身后的整件装扮（渲染在身体图层之下） */
const ACC_BACK_RE = /(wings?|cape|backpack|bag|satchel)/i;
const ACC_BODY_RE = /(apron|overalls|dress)/i;
const ACC_SCARF_RE = /(scarf|bandana|tie|life-ring|shawl)/i;
const ACC_HELD_RE = /(watch|bracelet|camera|icecream|ice-cream|flag|book|pin-wheel|umbrella|balloon-hand|magic-wand|silver-bell)/i;

function accessorySlot(def: AccessoryDef): AccSlot {
  const file = def.file.toLowerCase();
  if (ACC_BACK_RE.test(file)) return 'back';
  if (ACC_BODY_RE.test(file)) return 'bodyFront';
  if (def.anchor === 'eyes') return 'eyes';
  if (def.id === 'headphones' || def.id === 'earmuffs') return 'ears';
  if (def.id === 'space-helmet') return 'helmet';
  if (def.anchor === 'head') return 'hat';
  if (def.anchor === 'scarf') return ACC_SCARF_RE.test(file) ? 'neck' : 'neckSmall';
  if (ACC_HELD_RE.test(file)) return 'held';
  return 'headSide';
}

export function isBackAccessory(id: AccessoryId): boolean {
  const def = accessoryById(id);
  if (!def) return false;
  // 只有翅膀/披风需要压在身体后面；背包与挎包在侧面，需在身体之上
  return /(wings?|cape)/i.test(def.file);
}

interface AccLayout {
  x: number;
  y: number;
  w: number;
  /** z-index：1=身体之后，30=身体/表情之前 */
  z: number;
}

/**
 * 按阶段与表情锚点计算配件位置：帽子/耳机/围巾/眼镜都随头部比例缩放，
 * 避免固定坐标在 baby → adult 之间盖住眼睛或飘在头顶。
 */
function accessoryLayout(def: AccessoryDef, face: FaceLayout, stage: GrowthStage): AccLayout {
  const si = stage === 'adult' ? 2 : stage === 'teen' ? 1 : 0;
  const eyeY = face.eyeY * 100;
  const beakY = face.beakY * 100;
  const file = def.file.toLowerCase();
  const slot = accessorySlot(def);

  switch (slot) {
    case 'hat':
      // adult 眼线在 22%，帽檐必须收在眼线之上（y 压到 0、宽度收窄）
      return { x: 50, y: [5, 4, 0][si], w: [36, 32, 26][si], z: 30 };
    case 'ears':
      // 头梁在头顶、耳罩落在头部两侧；压在表情层下方，避免挡住眼睛
      return { x: 50, y: [4, 2, 1][si], w: [64, 54, 48][si], z: 15 };
    case 'helmet':
      return { x: 50, y: [1, 0, 0][si], w: [82, 74, 66][si], z: 30 };
    case 'eyes': {
      // 眼镜图片高度约 0.8w，镜片中心在图片 45% 处
      const w = Math.max(30, Math.min(40, face.eyeDX * 200 * 1.75));
      return { x: 50, y: eyeY - w * 0.36, w, z: 30 };
    }
    case 'neck':
      return { x: 50, y: beakY + 2, w: [52, 46, 42][si], z: 30 };
    case 'neckSmall':
      return { x: 50, y: beakY + 1, w: [24, 22, 20][si], z: 30 };
    case 'bodyFront':
      return { x: 50, y: beakY + 12, w: [46, 44, 40][si], z: 30 };
    case 'back': {
      if (/wing/.test(file)) return { x: 50, y: [16, 14, 12][si], w: [125, 118, 110][si], z: 1 };
      if (/cape/.test(file)) return { x: 50, y: [35, 31, 28][si], w: [125, 116, 108][si], z: 1 };
      // 双肩包：挂在身体侧后方，只露出包体与肩带
      if (/backpack/.test(file)) return { x: 84, y: [48, 46, 44][si], w: [32, 30, 28][si], z: 15 };
      // 挎包/小包：挂在身体侧面，压在身体之上才不会被肚子完全挡住
      return { x: 83, y: [50, 48, 46][si], w: [30, 28, 26][si], z: 30 };
    }
    case 'held': {
      if (/umbrella/.test(file)) return { x: 80, y: 8, w: 38, z: 30 };
      if (/balloon/.test(file)) return { x: 84, y: 22, w: 32, z: 30 };
      if (/(watch|bracelet|silver-bell)/.test(file)) return { x: 74, y: 58, w: 11, z: 30 };
      if (/pin-wheel/.test(file)) return { x: 80, y: 34, w: 18, z: 30 };
      return { x: 79, y: 52, w: 17, z: 30 };
    }
    case 'headSide':
    default:
      return {
        x: 50 + face.eyeDX * 100 + 8.5,
        y: eyeY - [7, 6, 5][si],
        w: [17, 15, 14][si],
        z: 30,
      };
  }
}

/** 配件层：蛋阶段不渲染；back 层需在身体图之前插入 */
function AccessoryLayer({
  accessory,
  face,
  stage,
  isEgg,
  hasFaceOverlay,
  layer,
}: {
  accessory: AccessoryId;
  face: FaceLayout;
  stage: GrowthStage;
  isEgg: boolean;
  hasFaceOverlay: boolean;
  layer: 'back' | 'front';
}) {
  if (isEgg) return null;
  const def = accessoryById(accessory);
  if (!def) return null;
  const layoutFace = hasFaceOverlay ? DEFAULT_CUSTOM_FACE : face;
  const l = accessoryLayout(def, layoutFace, stage);
  if ((l.z < 10) !== (layer === 'back')) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={accessorySrc(def.id)}
      alt=""
      draggable={false}
      onLoad={resetAssetState}
      onError={(e) => fallbackToLocal(e, accessoryLocalSrc(def.id))}
      className="pointer-events-none absolute object-contain"
      style={{ left: `${l.x - l.w / 2}%`, top: `${l.y}%`, width: `${l.w}%`, zIndex: l.z }}
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

  const accBack = pet.equippedAccessory ? isBackAccessory(pet.equippedAccessory) : false;

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
        {/* 披风/翅膀/背包：垫在身体图层之后 */}
        {pet.equippedAccessory && accBack && (
          <AccessoryLayer
            accessory={pet.equippedAccessory}
            face={face}
            stage={pet.stage}
            isEgg={isEgg}
            hasFaceOverlay={!!customSkin?.faceOverlay}
            layer="back"
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={!isEgg && customSkin ? customSkin.src : bodySrc(pet.variant, pet.stage)}
          alt={pet.name}
          key={customSkin ? 'custom' : `${pet.variant}-${pet.stage}`}
          className="relative z-10 h-full w-full object-contain"
          draggable={false}
          onLoad={resetAssetState}
          onError={(e) => {
            if (customSkin) {
              usePetStore.getState().applySkin(null); // 自定义皮肤失效时回官方形象
              return;
            }
            fallbackToLocal(e, bodyLocalSrc(pet.variant, pet.stage));
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
            washing={anim === 'washing'}
            playing={anim === 'playing'}
          />
        )}
        {pet.equippedAccessory && !accBack && (
          <AccessoryLayer
            accessory={pet.equippedAccessory}
            face={face}
            stage={pet.stage}
            isEgg={isEgg}
            hasFaceOverlay={!!customSkin?.faceOverlay}
            layer="front"
          />
        )}
      </div>

      {/* 常驻粒子层 */}
      <Particles sleeping={sleeping} eating={anim === 'eating'} washing={anim === 'washing'} playing={anim === 'playing'} sick={sick} working={anim === 'working'} studying={anim === 'studying'} trick={trick} />

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
  /** 洗澡：闭眼享受 + 头顶泡泡 */
  washing?: boolean;
  /** 玩耍：亮晶晶睁大眼 + 张嘴欢呼 */
  playing?: boolean;
}

/** SVG 表情：喂食/洗澡/玩耍各有独立眼型与嘴型，避免动作演出同质化 */
export function Face({ face, sleeping, happy, sad, sick, chewing, washing = false, playing = false }: FaceProps) {
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
    if (washing) {
      // 洗澡：闭眼 + 小睫毛，和睡觉的下垂眼区分
      return (
        <g stroke={EYE_INK} strokeWidth={2.2} fill="none" strokeLinecap="round">
          <path d={`M ${cx - 5} ${ey} Q ${cx} ${ey + 4.2} ${cx + 5} ${ey}`} />
          <path d={`M ${cx - 5.2} ${ey + 0.2} l -1.8 -1.5 M ${cx + 5.2} ${ey + 0.2} l 1.8 -1.5`} />
        </g>
      );
    }
    if (playing) {
      // 玩耍：亮晶晶的圆眼 + 星光高光
      return (
        <g className="anim-blink">
          <ellipse cx={cx} cy={ey} rx={eyeRx * 1.14} ry={eyeRy * 1.16} fill={EYE_INK} />
          <path
            d={`M ${cx + eyeRx * 0.25} ${ey - eyeRy * 0.85} l ${eyeRx * 0.2} ${eyeRy * 0.32} l ${eyeRx * 0.36} ${eyeRy * 0.08} l -${eyeRx * 0.28} ${eyeRy * 0.24} l ${eyeRx * 0.08} ${eyeRy * 0.36} l -${eyeRx * 0.36} -${eyeRy * 0.22} l -${eyeRx * 0.36} ${eyeRy * 0.22} l ${eyeRx * 0.08} -${eyeRy * 0.36} l -${eyeRx * 0.28} -${eyeRy * 0.24} l ${eyeRx * 0.36} -${eyeRy * 0.08} Z`}
            fill="#fff"
            opacity={0.95}
          />
        </g>
      );
    }
    if (chewing) {
      // 喂食：圆眼向下看着食物
      const dy = eyeRy * 0.28;
      return (
        <g className="anim-blink">
          <ellipse cx={cx} cy={ey + dy} rx={eyeRx} ry={eyeRy} fill={EYE_INK} />
          <circle cx={cx - eyeRx * 0.3} cy={ey + dy - eyeRy * 0.35} r={eyeRx * 0.32} fill="#fff" opacity={0.9} />
        </g>
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
    // 吃东西时视线微微向下看食物
    const dy = chewing ? eyeRy * 0.28 : 0;
    return (
      <g className="anim-blink">
        <ellipse cx={cx} cy={ey + dy} rx={eyeRx} ry={eyeRy} fill={EYE_INK} />
        <circle cx={cx - eyeRx * 0.3} cy={ey + dy - eyeRy * 0.35} r={eyeRx * 0.32} fill="#fff" opacity={0.9} />
      </g>
    );
  };

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-20 h-full w-full">
      {/* 腮红 */}
      <ellipse cx={50 - blushDX} cy={blushY} rx={blushRx} ry={blushRy} fill={BLUSH_FILL} opacity={playing ? 0.9 : washing ? 0.7 : happy ? 0.75 : sad || sick ? 0.3 : 0.5} />
      <ellipse cx={50 + blushDX} cy={blushY} rx={blushRx} ry={blushRy} fill={BLUSH_FILL} opacity={playing ? 0.9 : washing ? 0.7 : happy ? 0.75 : sad || sick ? 0.3 : 0.5} />
      {eye(lx)}
      {eye(rx)}
      {/* 喙：玩耍时张嘴欢呼，喂食时啾啾咀嚼，洗澡时安静闭着 */}
      <g className={chewing ? 'anim-chirp' : undefined}>
        <path
          d={`M ${50 - bs} ${by} L ${50 + bs} ${by} L ${50} ${by + bs * 1.25} Z`}
          fill={BEAK_FILL}
          stroke={EYE_INK}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {playing && (
          <ellipse cx={50} cy={by + bs * 0.74} rx={bs * 0.5} ry={bs * 0.55} fill="#8a4435" opacity={0.9} />
        )}
      </g>
      {/* 洗澡：头顶泡泡 */}
      {washing && (
        <g opacity={0.9}>
          <circle cx={38} cy={Math.max(8, ey - 18)} r={5.4} fill="#fff" stroke="#9fd3ff" strokeWidth={1} />
          <circle cx={45} cy={Math.max(5, ey - 24)} r={3.6} fill="#fff" stroke="#9fd3ff" strokeWidth={0.9} />
          <circle cx={61} cy={Math.max(9, ey - 17)} r={4.2} fill="#fff" stroke="#9fd3ff" strokeWidth={0.9} />
        </g>
      )}
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
  eating,
  washing,
  playing,
  sick,
  working,
  studying,
  trick,
}: {
  sleeping: boolean;
  eating: boolean;
  washing: boolean;
  playing: boolean;
  sick: boolean;
  working?: boolean;
  studying?: boolean;
  trick?: TrickId | null;
}) {
  if (!sleeping && !eating && !washing && !playing && !sick && !working && !studying && !trick) return null;
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
      {eating &&
        ['🍪', '✨', '🍰'].map((ch, i) => (
          <span
            key={i}
            className="anim-float absolute"
            style={{
              left: `${30 + i * 20}%`,
              top: '48%',
              fontSize: `${11 + (i % 2) * 3}px`,
              animationDelay: `${i * 0.4}s`,
              ['--drift' as string]: `${i % 2 === 0 ? -8 : 8}px`,
            }}
          >
            {ch}
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
