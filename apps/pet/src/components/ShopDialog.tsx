'use client';

/** 咕咕商店：元宝购买道具，买即用（无库存） */

import { useLocale } from '@/hooks/useLocale';
import { SHOP_ITEMS } from '@/lib/balance';
import { fmt, ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { PetState, ShopItem } from '@/lib/types';

/** 当前状态用不上该道具则不卖（省元宝） */
function isUsable(item: ShopItem, pet: PetState): boolean {
  if (item.cure) return pet.sick;
  if (item.cleanliness !== undefined) return pet.cleanliness < 99;
  if (item.satiety !== undefined) return pet.satiety < 99;
  if (item.id === 'balloon') return pet.mood < 99;
  return true;
}

function effectText(item: ShopItem, t: ReturnType<typeof ui>): string {
  const parts: string[] = [];
  if (item.satiety !== undefined) parts.push(fmt(t.effSatiety, { n: item.satiety }));
  if (item.cleanliness !== undefined) parts.push(fmt(t.effCleanliness, { n: item.cleanliness }));
  if (item.mood !== undefined) parts.push(fmt(t.effMood, { n: item.mood }));
  if (item.health !== undefined) parts.push(fmt(t.effHealth, { n: item.health }));
  if (item.cure) parts.push(t.effCure);
  return parts.join(' · ');
}

export function ShopDialog({ pet, onClose }: { pet: PetState; onClose: () => void }) {
  const buyItem = usePetStore((s) => s.buyItem);
  const { locale } = useLocale();
  const t = ui(locale);

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
        aria-label={t.shopTitle}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{t.shopTitle}</h2>
            <p className="text-xs text-gugu-ink-soft">{t.shopSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100/80 px-3 py-1 text-sm font-extrabold text-gugu-ink">
              🪙 {pet.coins}
            </span>
            <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SHOP_ITEMS.map((item) => {
            const affordable = pet.coins >= item.price;
            const usable = isUsable(item, pet);
            const disabled = !affordable || !usable;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => buyItem(item)}
                title={usable ? undefined : item.cure ? t.coinsInsufficient : undefined}
                className={`press flex items-center gap-2.5 rounded-2xl border border-amber-100 bg-amber-50/60 p-3 text-left ${
                  disabled ? 'opacity-40' : 'hover:bg-amber-50 active:bg-amber-100'
                }`}
              >
                <span className="text-3xl leading-none">{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{locale === 'zh' ? item.zh : item.en}</span>
                  <span className="block truncate text-[10px] text-gugu-ink-soft">{effectText(item, t)}</span>
                  <span className={`block text-xs font-extrabold ${affordable ? 'text-gugu-accent' : 'text-[#f0716b]'}`}>
                    🪙 {item.price}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-[11px] text-gugu-ink-soft/80">{t.coinsInsufficient}</p>
      </div>
    </div>
  );
}
