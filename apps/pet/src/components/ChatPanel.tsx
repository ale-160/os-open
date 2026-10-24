'use client';

import { useEscClose } from '@/hooks/useEscClose';

/** 与咕咕的 AI 聊天面板（BYOK；失败自动回退本地台词并在提示条说明） */

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { fmt, ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const pet = usePetStore((s) => s.pet)!;
  const chatMessages = usePetStore((s) => s.chatMessages);
  const chatBusy = usePetStore((s) => s.chatBusy);
  const chatFallbackUsed = usePetStore((s) => s.chatFallbackUsed);
  const sendChat = usePetStore((s) => s.sendChat);
  const clearChat = usePetStore((s) => s.clearChat);
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, chatBusy]);

  const send = async () => {
    const text = input.trim();
    if (!text || chatBusy) return;
    setInput('');
    await sendChat(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" role="dialog" aria-label={t.chatTitle}>
      <div className="flex h-[72dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl sm:h-[520px] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
          <h2 className="text-base font-bold">💬 {fmt(t.chatTitle, { name: pet.name })}</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={clearChat} className="press rounded-full bg-amber-900/5 px-3 py-1 text-xs font-semibold">
              🗑
            </button>
            <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">
              ✕
            </button>
          </div>
        </div>

        {chatFallbackUsed && (
          <p className="bg-[#f6c445]/10 px-4 py-1.5 text-[11px] text-[#b98a10]">⚠️ {t.chatFallback}</p>
        )}

        <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          {chatMessages.length === 0 && <p className="mt-8 text-center text-xs text-gugu-ink-soft">{t.chatEmpty}</p>}
          {chatMessages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-br-md bg-gugu-accent text-white'
                    : `rounded-bl-md border border-amber-100 bg-amber-50 ${m.fallback ? 'opacity-80' : ''}`
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {chatBusy && <p className="animate-pulse text-center text-xs text-gugu-ink-soft">{t.chatThinking}</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-amber-100 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={t.chatPlaceholder}
            maxLength={200}
            className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-gugu-accent"
          />
          <button
            type="button"
            onClick={send}
            disabled={chatBusy || !input.trim()}
            className="press shrink-0 rounded-xl bg-gugu-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-45"
          >
            {t.chatSend}
          </button>
        </div>
      </div>
    </div>
  );
}
