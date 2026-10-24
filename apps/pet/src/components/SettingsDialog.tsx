'use client';

/** 设置弹窗：语言切换 / 音效 / AI（BYOK）/ 重置存档 / 关于（由父组件条件渲染） */

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { DEFAULT_AI_SETTINGS, loadAiSettings, saveAiSettings, type AiSettings } from '@/lib/ai';
import { isSfxMuted, setSfxMuted } from '@/lib/sfx';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { locale, setLocale } = useLocale();
  const reset = usePetStore((s) => s.reset);
  const t = ui(locale);
  const [confirming, setConfirming] = useState(false);
  const [ai, setAi] = useState<AiSettings>(() => (typeof window === 'undefined' ? DEFAULT_AI_SETTINGS : loadAiSettings()));
  const [aiSaved, setAiSaved] = useState(false);
  const [sfxOff, setSfxOff] = useState(() => (typeof window === 'undefined' ? false : isSfxMuted()));

  const saveAi = () => {
    saveAiSettings(ai);
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 2000);
  };

  const toggleSfx = () => {
    const next = !sfxOff;
    setSfxOff(next);
    setSfxMuted(next);
  };

  const aiField = (label: string, value: string, onChange: (v: string) => void, placeholder: string, type = 'text') => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-gugu-ink-soft">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-gugu-accent"
      />
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t.settingsTitle}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.settingsTitle}</h2>
          <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">
            ✕
          </button>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold text-gugu-ink-soft">{t.languageLabel}</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'zh' as const, label: '中文' },
                { id: 'en' as const, label: 'English' },
              ]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLocale(opt.id)}
                className={`press rounded-xl border py-2 text-sm font-bold ${
                  locale === opt.id ? 'border-gugu-accent bg-gugu-accent/10 text-gugu-accent' : 'border-amber-100 bg-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 音效 */}
        <label className="mb-4 flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/40 px-3 py-2.5">
          <span className="text-sm font-semibold">🔊 {t.sfxLabel}</span>
          <input type="checkbox" checked={!sfxOff} onChange={toggleSfx} className="h-4 w-4 accent-[#ff9f45]" />
        </label>

        {/* AI（BYOK） */}
        <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">🤖 {t.aiTitle}</p>
            <label className="flex items-center gap-1.5 text-xs font-semibold">
              <input
                type="checkbox"
                checked={ai.enabled}
                onChange={(e) => setAi({ ...ai, enabled: e.target.checked })}
                className="h-4 w-4 accent-[#ff9f45]"
              />
              {t.aiEnable}
            </label>
          </div>
          {ai.enabled && (
            <div className="space-y-2">
              {aiField(t.aiBaseURL, ai.baseURL, (v) => setAi({ ...ai, baseURL: v }), 'https://api.openai.com/v1')}
              {aiField(t.aiApiKey, ai.apiKey, (v) => setAi({ ...ai, apiKey: v }), 'sk-...', 'password')}
              {aiField(t.aiModel, ai.model, (v) => setAi({ ...ai, model: v }), 'gpt-4o-mini')}
              {aiField(t.aiImageModel, ai.imageModel, (v) => setAi({ ...ai, imageModel: v }), 'gpt-image-2')}
              <button type="button" onClick={saveAi} className="press w-full rounded-xl bg-gugu-accent py-2 text-xs font-bold text-white">
                {aiSaved ? t.aiSaved : t.aiSave}
              </button>
            </div>
          )}
          <p className="mt-2 text-[10px] leading-relaxed text-gugu-ink-soft/80">{t.aiNote}</p>
        </div>

        <div className="mb-5">
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className="press w-full rounded-xl border border-[#f0716b]/30 bg-[#f0716b]/5 py-2.5 text-sm font-bold text-[#d9534d]">
              {t.resetButton}
            </button>
          ) : (
            <div className="rounded-xl border border-[#f0716b]/30 bg-[#f0716b]/5 p-3">
              <p className="mb-2 text-xs leading-relaxed text-[#d9534d]">{t.resetConfirmText}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="press rounded-lg bg-white py-2 text-xs font-bold">
                  {t.resetNo}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    onClose();
                  }}
                  className="press rounded-lg bg-[#f0716b] py-2 text-xs font-bold text-white"
                >
                  {t.resetYes}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gugu-ink-soft/80">{t.aboutBody}</p>
      </div>
    </div>
  );
}
