'use client';

/** 旅行归来报告：寄回的照片 + 手信（关闭后咕咕回家） */

import { useLocale } from '@/hooks/useLocale';
import { fmt, ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import { destById, photoCaption } from '@/lib/travel';
import { BASE_PATH } from '@/lib/skins';
import { useEscClose } from '@/hooks/useEscClose';
import type { PetState } from '@/lib/types';

export function TripReport({ pet, onClose }: { pet: PetState; onClose: () => void }) {
  const dismissTrip = usePetStore((s) => s.dismissTrip);
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const trip = pet.trip!;
  const d = destById(trip.dest);
  const photos = trip.photos.length ? trip.photos : [0];

  const close = () => {
    onClose();
    dismissTrip();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3" role="dialog" aria-label={t.reportTitle}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">🎒 {t.reportTitle}</h2>
          <button type="button" onClick={close} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">✕</button>
        </div>

        <div className="space-y-2.5 px-4 pb-4">
          {photos.map((cap, i) => (
            <div key={i} className="relative overflow-hidden rounded-2xl border border-amber-100" style={{ backgroundImage: `url(${BASE_PATH}/skins/gugu/pc/${trip.dest}.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <div className="absolute inset-0 bg-white/10" />
              <div className="flex h-24 items-center justify-center gap-1.5 text-3xl">
                {d.scenery.map((e, j) => (
                  <span key={j} style={{ opacity: 1 - j * 0.25 }}>
                    {e}
                  </span>
                ))}
              </div>
              <div className="relative bg-white/80 px-3 py-2 backdrop-blur-sm">
                <p className="text-xs font-bold text-gugu-ink">
                  {d.icon} {locale === 'zh' ? d.zh : d.en}
                </p>
                <p className="text-[11px] text-gugu-ink-soft">{photoCaption(trip.dest, cap, locale)}</p>
              </div>
            </div>
          ))}

          {trip.souvenir && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
              <span className="text-2xl leading-none">{d.souvenirIcon}</span>
              <span className="flex-1 text-xs font-bold text-gugu-ink">
                🎁 {t.souvenirGet}：{locale === 'zh' ? d.souvenirZh : d.souvenirEn}
              </span>
            </div>
          )}

          <p className="text-center text-[11px] text-gugu-ink-soft/70">{fmt(t.photosSent, { n: photos.length })}</p>

          <button
            type="button"
            onClick={close}
            className="press w-full rounded-2xl bg-gugu-accent py-3 text-base font-extrabold text-white shadow-lg shadow-amber-300/60"
          >
            {locale === 'zh' ? '欢迎回家！' : 'Welcome home!'}
          </button>
        </div>
      </div>
    </div>
  );
}
