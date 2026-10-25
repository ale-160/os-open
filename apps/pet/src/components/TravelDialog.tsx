'use client';

/** 旅行手记：相册（旅行寄回的照片）+ 手信收藏 + 便当柜 */

import { useLocale } from '@/hooks/useLocale';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import { PROVISIONS, destById, photoCaption } from '@/lib/travel';
import { PDS_DESTS, yypPhotoUrl } from '@/lib/pingdingshan';
import { BASE_PATH } from '@/lib/skins';
import { assetUrl, fallbackAsset } from '@/lib/assetUrl';
import { useEscClose } from '@/hooks/useEscClose';
import type { PetState, Provision } from '@/lib/types';

export function TravelDialog({ pet, onClose }: { pet: PetState; onClose: () => void }) {
  const packProvision = usePetStore((s) => s.packProvision);
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const photos = [...pet.album.photos].reverse();
  const destInfo = (dest: string) => {
    const pds = PDS_DESTS.find((x) => x.id === dest);
    if (pds) {
      return {
        icon: '📍',
        name: locale === 'zh' ? pds.zh : pds.en,
        caption: locale === 'zh' ? pds.zhDesc : pds.enDesc,
        bg: 'linear-gradient(to bottom, #a8d8f0, #e0f4ff)',
        img: yypPhotoUrl(pds),
        scenery: ['🏞️'],
        souvenirIcon: pds.souvenirIcon,
        souvenirZh: pds.souvenirZh,
        souvenirEn: pds.souvenirEn,
        capsZh: pds.capsZh,
        capsEn: pds.capsEn,
        photoBg: yypPhotoUrl(pds),
        zh: pds.zh,
      };
    }
    const d = destById(dest as never);
    return {
      icon: d.icon,
      name: locale === 'zh' ? d.zh : d.en,
      caption: locale === 'zh' ? d.capsZh[0] : d.capsEn[0],
      bg: `linear-gradient(to bottom, ${d.scene.split(' ')[0].replace('from-[', '').replace(']', '')}, #fff)`,
      img: null,
      scenery: d.scenery,
      souvenirIcon: d.souvenirIcon,
      capsZh: d.capsZh,
      capsEn: d.capsEn,
      photoBg: assetUrl(`${BASE_PATH}/skins/gugu/pc/${dest}.png`),
      souvenirZh: d.souvenirZh,
      souvenirEn: d.souvenirEn,
    };
  };
  const souvenirs = [...pet.album.souvenirs].reverse();

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
        aria-label={t.travelTitle}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">🎒 {t.travelTitle}</h2>
          <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">
            ✕
          </button>
        </div>

        {/* 便当柜 */}
        <p className="mb-2 text-xs font-bold text-gugu-ink-soft">🍱 {t.travelPack}</p>
        <div className="mb-1 grid grid-cols-3 gap-2">
          {PROVISIONS.map((p) => {
            const active = pet.packedProvision === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => packProvision(active ? null : (p.id as Provision))}
                className={`press flex flex-col items-center gap-0.5 rounded-2xl border-2 p-2.5 ${
                  pet.packedProvision === p.id ? 'border-gugu-accent bg-amber-50' : 'border-transparent bg-amber-50/50'
                }`}
              >
                <span className="text-2xl leading-none">{p.icon}</span>
                <span className="text-[11px] font-bold">{locale === 'zh' ? p.zh : p.en}</span>
              </button>
            );
          })}
        </div>
        <p className="mb-5 text-center text-[10px] text-gugu-ink-soft/70">{t.travelPackHint}</p>

        {/* 相册 */}
        <p className="mb-2 text-xs font-bold text-gugu-ink-soft">📸 {t.travelAlbum}（{photos.length}）</p>
        {photos.length === 0 ? (
          <p className="mb-4 text-center text-xs text-gugu-ink-soft/70">{t.albumEmpty}</p>
        ) : (
          <div className="mb-5 grid grid-cols-2 gap-2">
            {photos.map((ph, i) => {
              const d = destInfo(ph.dest);
              const pds = PDS_DESTS.find((x) => x.id === ph.dest);
              return (
                <div key={`${ph.at}-${i}`} className="relative overflow-hidden rounded-2xl border border-amber-100" style={{ backgroundImage: pds ? `url(${yypPhotoUrl(pds)})` : `url(${assetUrl(`${BASE_PATH}/skins/gugu/pc/${ph.dest}.png`)})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                  <div className="flex h-16 items-end justify-end gap-0.5 p-1 text-xl drop-shadow">
                    {(d.scenery ?? []).map((e, j) => (
                      <span key={j} style={{ opacity: 1 - j * 0.25 }}>
                        {e}
                      </span>
                    ))}
                  </div>
                  <div className="bg-white/70 px-2.5 py-1.5">
                    <p className="truncate text-[10px] font-bold text-gugu-ink">
                      {d.icon} {d.name}
                    </p>
                    <p className="truncate text-[10px] text-gugu-ink-soft">
                      {pds ? (locale === 'zh' ? pds.capsZh[ph.cap % pds.capsZh.length] : pds.capsEn[ph.cap % pds.capsEn.length]) : photoCaption(ph.dest as never, ph.cap, locale)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 手信 */}
        <p className="mb-2 text-xs font-bold text-gugu-ink-soft">🎁 {t.travelSouvenir}（{souvenirs.length}）</p>
        {souvenirs.length === 0 ? (
          <p className="text-center text-xs text-gugu-ink-soft/70">{t.souvenirEmpty}</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {souvenirs.map((sv, i) => {
              const d = destInfo(sv.dest);
              return (
                <div key={`${sv.at}-${i}`} className="flex flex-col items-center gap-0.5 rounded-2xl bg-amber-50/70 p-2">
                  {d.img ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={d.img} alt="" className="h-7 w-7 object-cover rounded-lg" draggable={false} />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={assetUrl(`${BASE_PATH}/skins/gugu/souvenir/${sv.dest}.png`)} alt="" onError={(e) => fallbackAsset(e, `${BASE_PATH}/skins/gugu/souvenir/${sv.dest}.png`)} className="h-7 w-7 object-contain" draggable={false} />
                  )}
                  <span className="w-full truncate text-center text-[10px] font-bold">
                    {locale === 'zh' ? d.souvenirZh : d.souvenirEn}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
