'use client';

import { useEscClose } from '@/hooks/useEscClose';

/**
 * 形象工坊：官方配色切换 + 社区模板（仓库 PR 渠道）+ 自定义单图皮肤（上传 / URL / 表情叠加开关 / 分享码导入导出）。
 * 自定义皮肤存 IndexedDB；分享码 = base64url(JSON)，含 dataURL（远程 URL 皮肤只含引用）。
 */

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { ACCESSORIES, DECORATIONS, accessoryLocalSrc, decoLocalSrc } from '@/lib/accessories';
import { SCENES, sceneLocalSrc } from '@/lib/scenes';
import { assetThumbUrl, fallbackAsset, templateUrl } from '@/lib/assetUrl';
import {
  BASE_PATH,
  bodyLocalSrc,
  decodeSkinCode,
  encodeSkinCode,
  VARIANTS,
} from '@/lib/skins';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { CustomSkinRecord } from '@/lib/db';
import type { PetState } from '@/lib/types';

const MAX_FILE_BYTES = 3 * 1024 * 1024;

interface CommunitySkin {
  id: string;
  name: string;
  nameEn: string;
  author: string;
  file: string;
  faceOverlay: boolean;
  zhDesc: string;
  enDesc: string;
}

export function SkinDialog({ pet, onClose }: { pet: PetState; onClose: () => void }) {
  const setVariant = usePetStore((s) => s.setVariant);
  const equipAccessory = usePetStore((s) => s.equipAccessory);
  const toggleDecoration = usePetStore((s) => s.toggleDecoration);
  const setScene = usePetStore((s) => s.setScene);
  const applySkin = usePetStore((s) => s.applySkin);
  const addCustomSkin = usePetStore((s) => s.addCustomSkin);
  const removeCustomSkin = usePetStore((s) => s.removeCustomSkin);
  const customSkins = usePetStore((s) => s.customSkins);
  const resolvedSkin = usePetStore((s) => s.resolvedSkin);
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const [urlInput, setUrlInput] = useState('');
  const [faceOverlay, setFaceOverlay] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [community, setCommunity] = useState<CommunitySkin[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 拉取社区模板清单：R2 templates/ 优先，本地兜底，失败则整区隐藏
  useEffect(() => {
    let alive = true;
    const localManifest = `${BASE_PATH}/templates/skins.json`;
    const loadManifest = (u: string) =>
      fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
    loadManifest(templateUrl(localManifest))
      .catch(() => loadManifest(localManifest))
      .then((j: { skins?: CommunitySkin[] }) => {
        if (alive) setCommunity(j.skins ?? []);
      })
      .catch(() => {
        if (alive) setCommunity(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const activeCustomId = pet.customSkinId;
  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      flash(t.skinFileTooBig);
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const record: CustomSkinRecord = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'skin',
        imageDataUrl: String(reader.result),
        faceOverlay,
        createdAt: Date.now(),
      };
      setBusy(true);
      await addCustomSkin(record).catch(() => flash(t.skinNone));
      setBusy(false);
    };
    reader.readAsDataURL(file);
  };

  const addUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    const record: CustomSkinRecord = {
      id: crypto.randomUUID(),
      name: url.split('/').pop()?.slice(0, 24) || 'url-skin',
      url,
      faceOverlay,
      createdAt: Date.now(),
    };
    setBusy(true);
    await addCustomSkin(record).catch(() => flash(t.skinNone));
    setBusy(false);
    setUrlInput('');
  };

  const doImport = async () => {
    try {
      const parsed = decodeSkinCode(importCode);
      const record: CustomSkinRecord = { ...parsed, id: crypto.randomUUID(), createdAt: Date.now() };
      setBusy(true);
      await addCustomSkin(record);
      setBusy(false);
      setImportCode('');
    } catch {
      flash(t.skinInvalidCode);
    }
  };

  const doExport = async () => {
    const current = resolvedSkin();
    if (!current || !activeCustomId) {
      flash(t.skinExportNeedCustom);
      return;
    }
    const rec = customSkins.find((s) => s.id === activeCustomId);
    if (!rec) return;
    const code = encodeSkinCode({ name: rec.name, imageDataUrl: rec.imageDataUrl, url: rec.url, faceOverlay: rec.faceOverlay });
    try {
      await navigator.clipboard.writeText(code);
      flash(t.skinCopied);
    } catch {
      flash(code.slice(0, 0) || t.skinInvalidCode);
      // 剪贴板不可用则退化为展示在导入框
      setImportCode(code);
    }
  };

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
        aria-label={t.skinTitle}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">🎨 {t.skinTitle}</h2>
          <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">
            ✕
          </button>
        </div>

        {/* 官方配色（只显示已购买；购买去商店） */}
        <p className="mb-2 text-xs font-bold text-gugu-ink-soft">{t.skinOfficial}</p>
        <div className="mb-2 grid grid-cols-3 gap-2">
          {VARIANTS.filter((v) => pet.variantOwned?.includes(v.id) || v.id === pet.variant).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVariant(v.id)}
              className={`press flex flex-col items-center gap-1 rounded-2xl border-2 p-2 ${
                !activeCustomId && pet.variant === v.id ? 'border-gugu-accent bg-amber-50' : 'border-transparent bg-amber-50/50'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetThumbUrl(bodyLocalSrc(v.id, pet.stage))}
                alt={locale === 'zh' ? v.zh : v.en}
                loading="lazy"
                decoding="async"
                onError={(e) => fallbackAsset(e, bodyLocalSrc(v.id, pet.stage))}
                className="h-14 w-12 object-contain"
                draggable={false}
              />
              <span className="text-[11px] font-bold">{locale === 'zh' ? v.zh : v.en}</span>
            </button>
          ))}
        </div>
        {(pet.variantOwned?.length ?? 0) < VARIANTS.length && (
          <p className="mb-5 text-[10px] font-semibold text-gugu-ink-soft/75">
            {locale === 'zh' ? '更多配色请在商店购买' : 'More colors in the shop'}
          </p>
        )}

        {/* 装扮配件（只显示已拥有；购买去商店） */}
        <p className="mb-2 text-xs font-bold text-gugu-ink-soft">🎩 装扮</p>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {ACCESSORIES.filter((a) => pet.accessories?.includes(a.id)).map((a) => {
            const active = pet.equippedAccessory === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => equipAccessory(active ? null : a.id)}
                title={locale === 'zh' ? a.zh : a.en}
                className={`press flex flex-col items-center gap-0.5 rounded-2xl border-2 p-1.5 ${active ? 'border-gugu-accent bg-amber-50' : 'border-transparent bg-amber-50/50'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetThumbUrl(accessoryLocalSrc(a.id))}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-9 w-9 object-contain"
                  draggable={false}
                  onError={(e) => fallbackAsset(e, accessoryLocalSrc(a.id))}
                />
                <span className="w-full truncate text-center text-[9px] font-bold">{locale === 'zh' ? a.zh : a.en}</span>
              </button>
            );
          })}
        </div>

        {/* 房间装饰（只显示已拥有；购买去商店） */}
        <p className="mb-2 text-xs font-bold text-gugu-ink-soft">🪴 房间装饰</p>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {DECORATIONS.filter((d) => pet.decoOwned?.includes(d.id)).map((d) => {
            const placed = pet.decorations?.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDecoration(d.id)}
                title={locale === 'zh' ? d.zh : d.en}
                className={`press flex flex-col items-center gap-0.5 rounded-2xl border-2 p-1.5 ${placed ? 'border-gugu-accent bg-amber-50' : 'border-transparent bg-amber-50/50'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetThumbUrl(decoLocalSrc(d.id))}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-9 w-9 object-contain"
                  draggable={false}
                  onError={(e) => fallbackAsset(e, decoLocalSrc(d.id))}
                />
                <span className="w-full truncate text-center text-[9px] font-bold">{locale === 'zh' ? d.zh : d.en}</span>
              </button>
            );
          })}
        </div>

        {/* 场景（每日自动 / 已购买场景） */}
        <p className="mb-2 text-xs font-bold text-gugu-ink-soft">🏞️ 场景</p>
        <div className="mb-2 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setScene(null)}
            className={`press flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 p-1.5 ${!pet.sceneId ? 'border-gugu-accent bg-amber-50' : 'border-transparent bg-amber-50/50'}`}
          >
            <span className="text-xl leading-none">🎲</span>
            <span className="w-full truncate text-center text-[9px] font-bold">{locale === 'zh' ? '每日轮换' : 'Daily'}</span>
          </button>
          {SCENES.filter((sc) => pet.sceneOwned?.includes(sc.id) || pet.sceneId === sc.id).map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => setScene(sc.id)}
              className={`press flex flex-col items-center gap-0.5 rounded-2xl border-2 p-1.5 ${pet.sceneId === sc.id ? 'border-gugu-accent bg-amber-50' : 'border-transparent bg-amber-50/50'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetThumbUrl(sceneLocalSrc(sc.id))}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(e) => fallbackAsset(e, sceneLocalSrc(sc.id))}
                className="h-9 w-9 rounded-lg object-cover"
                draggable={false}
              />
              <span className="w-full truncate text-center text-[9px] font-bold">{locale === 'zh' ? sc.zh : sc.en}</span>
            </button>
          ))}
        </div>
        {(pet.sceneOwned?.length ?? 0) < SCENES.length && (
          <p className="mb-4 text-[10px] font-semibold text-gugu-ink-soft/75">
            {locale === 'zh' ? '更多场景请在商店购买' : 'More scenes in the shop'}
          </p>
        )}

        {/* 社区模板（仓库 PR 渠道） */}
        {community && community.length > 0 && (
          <>
            <p className="mb-2 text-xs font-bold text-gugu-ink-soft">
              🌍 {t.communityTitle}
              <span className="ml-2 font-normal text-gugu-ink-soft/70">{t.communitySubtitle}</span>
            </p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {community.map((s) => {
                const localUrl = `${BASE_PATH}/templates/skins/${s.file}`;
                const url = templateUrl(localUrl);
                const active = customSkins.some((c) => c.url === url || c.url === localUrl);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      addCustomSkin({
                        id: crypto.randomUUID(),
                        name: locale === 'zh' ? s.name : s.nameEn,
                        url,
                        faceOverlay: s.faceOverlay,
                        createdAt: Date.now(),
                      })
                    }
                    className={`press flex flex-col items-center gap-1 rounded-2xl border-2 p-2 ${
                      active ? 'border-gugu-accent bg-amber-50' : 'border-transparent bg-amber-50/50 hover:bg-amber-50'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={locale === 'zh' ? s.name : s.nameEn} onError={(e) => { if (e.currentTarget.dataset.local) { e.currentTarget.style.display = 'none'; return; } e.currentTarget.dataset.local = '1'; e.currentTarget.src = localUrl; }} className="h-14 w-12 object-contain" draggable={false} />
                    <span className="w-full truncate text-center text-[11px] font-bold">{locale === 'zh' ? s.name : s.nameEn}</span>
                    <span className="w-full truncate text-center text-[9px] text-gugu-ink-soft/70">
                      {t.communityBy} {s.author}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* 表情叠加开关 */}
        <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-gugu-ink">
          <input type="checkbox" checked={faceOverlay} onChange={(e) => setFaceOverlay(e.target.checked)} className="h-4 w-4 accent-[#ff9f45]" />
          {t.skinFaceOverlay}
        </label>

        {/* 添加自定义 */}
        <div className="mb-4 space-y-2 rounded-2xl border border-amber-100 bg-amber-50/40 p-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="press w-full rounded-xl border border-amber-200 bg-white py-2 text-xs font-bold"
          >
            🖼 {t.skinUpload}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={t.skinUrlLabel}
              className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-gugu-accent"
            />
            <button type="button" onClick={addUrl} disabled={busy || !urlInput.trim()} className="press shrink-0 rounded-xl bg-gugu-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
              +
            </button>
          </div>
        </div>

        {/* 自定义列表 */}
        <p className="mb-2 text-xs font-bold text-gugu-ink-soft">{t.skinCustom}</p>
        {customSkins.length === 0 ? (
          <p className="mb-4 text-center text-xs text-gugu-ink-soft/70">{t.skinNone}</p>
        ) : (
          <div className="mb-4 space-y-2">
            {customSkins.map((s) => {
              const active = activeCustomId === s.id;
              return (
                <div key={s.id} className={`flex items-center gap-2.5 rounded-2xl border p-2 ${active ? 'border-gugu-accent bg-amber-50' : 'border-amber-100'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.imageDataUrl ?? s.url} alt={s.name} className="h-11 w-11 rounded-lg bg-amber-50 object-contain" draggable={false} />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => applySkin(active ? null : s.id)}
                    className={`press shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      active ? 'bg-gugu-accent text-white' : 'border border-amber-200 bg-white'
                    }`}
                  >
                    {active ? t.skinActive : t.skinApply}
                  </button>
                  <button type="button" onClick={() => removeCustomSkin(s.id)} className="press shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-[#d9534d]">
                    {t.skinDelete}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 分享码 */}
        <p className="mb-2 text-xs font-bold text-gugu-ink-soft">{t.skinShare}</p>
        <button type="button" onClick={doExport} className="press mb-2 w-full rounded-xl border border-amber-200 bg-white py-2 text-xs font-bold">
          📤 {t.skinShareExport}
        </button>
        <textarea
          value={importCode}
          onChange={(e) => setImportCode(e.target.value)}
          placeholder={t.skinShareImport}
          rows={2}
          className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-gugu-accent"
        />
        <button
          type="button"
          onClick={doImport}
          disabled={busy || !importCode.trim()}
          className="press mt-2 w-full rounded-xl bg-amber-900/80 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {t.skinImportBtn}
        </button>

        {notice && <p className="mt-3 text-center text-xs font-semibold text-gugu-accent">{notice}</p>}
      </div>
    </div>
  );
}
