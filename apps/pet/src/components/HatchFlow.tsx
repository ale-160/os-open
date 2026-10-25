'use client';

/**
 * 领养流程：选蛋（单行毛玻璃无级滚动，与首页底栏同款）→ 起名 →（可选）一句话 AI 定制 → 开始孵化。
 * 页面为全幅暖色渐变（无白边框容器），底部有一条与游戏内 ActionPanel 一致的无级滚动动作条。
 */

import { useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { aiImageReady, aiReady, generatePetImage, loadAiSettings } from '@/lib/ai';
import { ui } from '@/lib/locale';
import { YYP_BASE } from '@/lib/pingdingshan';
import { usePetStore } from '@/lib/store';
import { bodyLocalSrc, VARIANTS } from '@/lib/skins';
import { assetThumbUrl, fallbackAsset } from '@/lib/assetUrl';
import type { CustomSkinRecord } from '@/lib/db';
import type { VariantId } from '@/lib/types';

/** 模块级构建皮肤记录（crypto.randomUUID 被 react-hooks/purity 视为不纯调用，不放组件体内） */
function buildAiSkinRecord(name: string, dataUrl: string): CustomSkinRecord {
  return {
    id: crypto.randomUUID(),
    name,
    imageDataUrl: dataUrl,
    faceOverlay: false,
    createdAt: Date.now(),
  };
}

/** 模块级随机挑一个与当前不同的官方配色（Math.random 被 react-hooks/purity 视为不纯调用，不放组件体内） */
function randomVariantId(current: VariantId): VariantId {
  const pool = VARIANTS.filter((v) => v.id !== current);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/** 与 ActionPanel 一致的无边框胶囊视觉语言 */
const CAPSULE =
  'pointer-events-auto rounded-[26px] bg-white/40 px-2 py-1.5 shadow-[0_10px_28px_rgba(138,106,77,0.14)] backdrop-blur-sm';

/** 底部动作条入口 */
interface StripEntry {
  key: string;
  icon: string;
  label: string;
  onClick: () => void;
}

export function HatchFlow() {
  const adopt = usePetStore((s) => s.adopt);
  const adoptWithSkin = usePetStore((s) => s.adoptWithSkin);
  const { locale } = useLocale();
  const t = ui(locale);

  const [variant, setVariant] = useState<VariantId>('cream');
  const [name, setName] = useState('');
  const [aiSentence, setAiSentence] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const eggStripRef = useRef<HTMLDivElement>(null);
  /** 拖拽滚动（桌面鼠标按住拖动，触屏原生滚动） */
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null);


  const aiSettings = typeof window === 'undefined' ? null : loadAiSettings();
  const aiUsable = !!aiSettings && aiImageReady(aiSettings);

  const start = async () => {
    const finalName = name.trim() || t.namePlaceholder;
    const sentence = aiSentence.trim();
    if (aiUsable && sentence && aiSettings) {
      setGenerating(true);
      setAiError(false);
      try {
        const dataUrl = await generatePetImage(aiSettings, sentence);
        await adoptWithSkin(variant, finalName, buildAiSkinRecord(finalName, dataUrl));
        return;
      } catch {
        setAiError(true);
        adopt(variant, finalName);
        return;
      } finally {
        setGenerating(false);
      }
    }
    adopt(variant, finalName);
  };

  const busy = generating;
  const aiHint = aiUsable
    ? aiReady(aiSettings!)
      ? t.hatchAiLabel
      : ''
    : '';

  /** 🎲 随机配色：从其余官方配色中随机挑一颗蛋 */
  const randomVariant = () => setVariant(randomVariantId(variant));

  /** 🎨 官方配色：按官方配色表顺序循环切换 */
  const cycleVariant = () => {
    const idx = VARIANTS.findIndex((v) => v.id === variant);
    setVariant(VARIANTS[(idx + 1) % VARIANTS.length].id);
  };

  const stripEntries: StripEntry[] = [
    {
      key: 'yyp',
      icon: '📷',
      label: locale === 'zh' ? '鹰悦拍' : 'YYP Photo',
      onClick: () => window.open(YYP_BASE, '_blank', 'noopener,noreferrer'),
    },
    { key: 'random', icon: '🎲', label: locale === 'zh' ? '随机配色' : 'Random', onClick: randomVariant },
    { key: 'official', icon: '🎨', label: locale === 'zh' ? '官方配色' : 'Official', onClick: cycleVariant },
  ];

  const stripButton = (entry: StripEntry) => (
    <button
      key={entry.key}
      type="button"
      onClick={entry.onClick}
      className="press flex w-[72px] shrink-0 snap-center flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors hover:bg-white/60 active:bg-white/85"
    >
      <span className="text-[24px] leading-none drop-shadow-sm">{entry.icon}</span>
      <span className="whitespace-nowrap text-[11px] font-bold tracking-wide">{entry.label}</span>
    </button>
  );

  /** 桌面鼠标拖拽滚动（触屏原生滚动已够用） */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    dragRef.current = { startX: e.clientX, startScroll: stripRef.current?.scrollLeft ?? 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !stripRef.current) return;
    stripRef.current.scrollLeft = dragRef.current.startScroll - (e.clientX - dragRef.current.startX);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    /* 全幅暖色渐变铺满（无白边框容器），内容居中 */
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center bg-[linear-gradient(180deg,#fff6e3_0%,#fdf3e3_45%,#ffe2bd_100%)]">
      <div className="flex w-full max-w-xl flex-col items-center gap-5 px-6 pb-28 pt-10">
        <header className="text-center">
          <h1 className="text-3xl font-extrabold tracking-wide">
            {t.appTitle}
            <span className="ml-2 inline-block text-2xl">🐣</span>
          </h1>
          <p className="mt-1 text-sm text-gugu-ink-soft">{t.adoptSubtitle}</p>
        </header>

        {/* 选蛋：单行毛玻璃无级滚动（与底栏同款，无白边框卡片） */}
        <div
          ref={eggStripRef}
          className={`no-scrollbar ${CAPSULE} flex w-full items-stretch gap-1 overflow-x-auto`}
          onWheel={(e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              e.currentTarget.scrollLeft += e.deltaY;
              e.preventDefault();
            }
          }}
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse') return;
            dragRef.current = { startX: e.clientX, startScroll: eggStripRef.current?.scrollLeft ?? 0 };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current || !eggStripRef.current) return;
            eggStripRef.current.scrollLeft = dragRef.current.startScroll - (e.clientX - dragRef.current.startX);
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerLeave={() => {
            dragRef.current = null;
          }}
        >
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVariant(v.id)}
              className={`press flex w-[72px] shrink-0 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors ${
                variant === v.id ? 'bg-white/85 shadow-sm ring-2 ring-gugu-accent' : 'hover:bg-white/60 active:bg-white/85'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetThumbUrl(bodyLocalSrc(v.id, 'egg'))}
                alt={locale === 'zh' ? v.zh : v.en}
                loading="lazy"
                decoding="async"
                onError={(e) => fallbackAsset(e, bodyLocalSrc(v.id, 'egg'))}
                className="h-14 w-12 object-contain"
                draggable={false}
              />
              <span className="whitespace-nowrap text-[11px] font-bold tracking-wide">{locale === 'zh' ? v.zh : v.en}</span>
            </button>
          ))}
        </div>

        {aiHint && (
          <div className="w-full">
            <label className="mb-1 block text-[11px] font-semibold text-gugu-ink-soft">✨ {aiHint}</label>
            <input
              value={aiSentence}
              onChange={(e) => setAiSentence(e.target.value)}
              placeholder={t.hatchAiPlaceholder}
              maxLength={120}
              className="w-full rounded-2xl border border-amber-200 bg-white/90 px-4 py-2.5 text-sm outline-none placeholder:text-gugu-ink-soft/60 focus:border-gugu-accent"
            />
          </div>
        )}

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && start()}
          placeholder={t.namePlaceholder}
          maxLength={12}
          aria-label={t.adoptTitle}
          className="w-full rounded-2xl border border-amber-200 bg-white/90 px-4 py-3 text-center text-lg font-bold outline-none placeholder:font-normal placeholder:text-gugu-ink-soft/60 focus:border-gugu-accent"
        />

        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="press w-full rounded-2xl bg-gugu-accent py-3.5 text-lg font-extrabold text-white shadow-lg shadow-amber-300/60 hover:brightness-105 disabled:opacity-60"
        >
          {busy ? t.hatchAiGenerating : t.adoptStart}
        </button>

        {aiError && <p className="text-xs font-semibold text-[#d9534d]">{t.hatchAiFailed}</p>}

        <p className="text-center text-xs text-gugu-ink-soft/80">{t.aboutBody}</p>
      </div>

      {/* 底部无级滚动动作条（与游戏页 ActionPanel 同款胶囊：触屏滑动 + 桌面滚轮/拖拽横滑） */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-3 md:px-6">
        <div
          ref={stripRef}
          className={`no-scrollbar ${CAPSULE} flex w-full max-w-[420px] snap-x items-stretch gap-1 overflow-x-auto`}
          onWheel={(e) => {
            // 桌面滚轮纵向 → 横向滚动（无级滚动）
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              e.currentTarget.scrollLeft += e.deltaY;
              e.preventDefault();
            }
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {stripEntries.map(stripButton)}
        </div>
      </div>
    </div>
  );
}
