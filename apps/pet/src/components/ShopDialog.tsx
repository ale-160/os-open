'use client';

import { useState } from 'react';
import { useEscClose } from '@/hooks/useEscClose';

/** 咕咕商店：元宝购买道具，买即用（无库存） */

import { useLocale } from '@/hooks/useLocale';
import { SHOP_ITEMS } from '@/lib/balance';
import { wardrobeShopItems } from '@/lib/accessories';
import { sceneShopItems, variantShopItems } from '@/lib/shop-extra';
import { BASE_PATH } from '@/lib/skins';
import { assetThumbUrl, assetUrl, thumbLocalSrc } from '@/lib/assetUrl';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { PetState, ShopItem } from '@/lib/types';

/** 商品图标：R2 缩略图 → R2 原图 → 本地缩略图 → 本地原图 → emoji */
function ShopIcon({ item, kind }: { item: ShopItem; kind: NonNullable<ShopItem['kind']> }) {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const localFull =
    item.iconSrc ?? (kind === 'use' ? `${BASE_PATH}/skins/gugu/item/${item.id}.png` : '');
  const candidates = localFull
    ? [assetThumbUrl(localFull), assetUrl(localFull), thumbLocalSrc(localFull), localFull].filter(
        (v, i, a) => v && a.indexOf(v) === i,
      )
    : [];
  if (failed || candidates.length === 0) {
    return <span className="text-3xl leading-none">{item.icon}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={candidates[Math.min(idx, candidates.length - 1)]}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        if (idx < candidates.length - 1) setIdx(idx + 1);
        else setFailed(true);
      }}
      className="h-10 w-10 shrink-0 object-contain"
      draggable={false}
    />
  );
}

export function ShopDialog({ pet, onClose }: { pet: PetState; onClose: () => void }) {
  const buyItem = usePetStore((s) => s.buyItem);
  const ALL_ITEMS = [...SHOP_ITEMS, ...wardrobeShopItems(), ...variantShopItems(), ...sceneShopItems()];
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
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

                {([
          ['use', locale === 'zh' ? '🍪 道具（买即用）' : 'Snacks & items'],
          ['variant', locale === 'zh' ? '🎨 官方配色（买后拥有）' : 'Color variants'],
          ['scene', locale === 'zh' ? '🏞️ 场景（买后拥有）' : 'Scenes'],
          ['accessory', locale === 'zh' ? '🎩 装扮（买后拥有）' : 'Accessories'],
          ['decoration', locale === 'zh' ? '🪴 房间装饰' : 'Decorations'],
        ] as const).map(([kind, title]) => (
          <div key={kind} className="mb-4">
            <p className="mb-2 text-xs font-bold text-gugu-ink-soft">{title}</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_ITEMS.filter((it) => (it.kind ?? 'use') === kind).map((item) => {
                const affordable = pet.coins >= item.price;
                const owned =
                  (item.accessory && pet.accessories?.includes(item.accessory)) ||
                  (item.deco && pet.decoOwned?.includes(item.deco)) ||
                  (item.variant && pet.variantOwned?.includes(item.variant)) ||
                  (item.scene && pet.sceneOwned?.includes(item.scene));
                const usable =
                  kind !== 'use' ||
                  (item.cure ? pet.sick : true);
                const disabled = !affordable || !!owned || !usable;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => buyItem(item)}
                    className={`press flex items-center gap-2.5 rounded-2xl bg-amber-50/60 p-3 text-left ${disabled ? 'opacity-40' : 'hover:bg-amber-50 active:bg-amber-100'}`}
                  >
                    {(item.iconSrc ?? (kind === 'use' ? `${BASE_PATH}/skins/gugu/item/${item.id}.png` : undefined)) ? (
                      <ShopIcon item={item} kind={kind} />
                    ) : (
                      <span className="text-3xl leading-none">{item.icon}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{locale === 'zh' ? item.zh : item.en}</span>
                      <span className={`block text-xs font-extrabold ${owned ? 'text-[#7bc86c]' : affordable ? 'text-gugu-accent' : 'text-[#f0716b]'}`}>
                        {owned ? (locale === 'zh' ? '已拥有 ✓' : 'Owned ✓') : `🪙 ${item.price}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <p className="mt-3 text-center text-[11px] text-gugu-ink-soft/80">{t.coinsInsufficient}</p>
      </div>
    </div>
  );
}
