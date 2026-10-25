'use client';

/** 领养流程：选蛋（三配色变体）→ 起名 →（可选）一句话 AI 定制 → 开始孵化 */

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { aiImageReady, aiReady, generatePetImage, loadAiSettings } from '@/lib/ai';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import { bodySrc, VARIANTS } from '@/lib/skins';
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-5 px-6 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-extrabold tracking-wide">
          {t.appTitle}
          <span className="ml-2 inline-block text-2xl">🐣</span>
        </h1>
        <p className="mt-1 text-sm text-gugu-ink-soft">{t.adoptSubtitle}</p>
      </header>

      <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVariant(v.id)}
            className={`press flex flex-col items-center gap-1 rounded-3xl border-2 bg-white/85 p-3 shadow-sm ${
              variant === v.id ? 'border-gugu-accent shadow-md' : 'border-transparent hover:bg-white'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bodySrc(v.id, 'egg')} alt={locale === 'zh' ? v.zh : v.en} className="h-16 w-13 object-contain" draggable={false} />
            <span className="text-sm font-bold">{locale === 'zh' ? v.zh : v.en}</span>
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
  );
}
