/**
 * 商店扩展：官方配色与场景的购买项（买后解锁；默认领养配色/每日自动场景免费）。
 * 价格按顺序分档，避免一次买齐；图标复用现有素材，缺图时前端回退 emoji。
 */

import { sceneLocalSrc, SCENES } from './scenes';
import { bodyLocalSrc, VARIANTS } from './skins';
import type { ShopItem } from './types';

function variantPrice(index: number): number {
  return 20 + (index % 5) * 4; // 20/24/28/32/36
}

function scenePrice(index: number): number {
  return 30 + (index % 5) * 6; // 30/36/42/48/54
}

export function variantShopItems(): ShopItem[] {
  return VARIANTS.map((v, i) => ({
    id: `variant-${v.id}`,
    icon: '🎨',
    iconSrc: bodyLocalSrc(v.id, 'egg'),
    zh: `${v.zh}配色`,
    en: `${v.en} Color`,
    price: variantPrice(i),
    kind: 'variant',
    variant: v.id,
  }));
}

export function sceneShopItems(): ShopItem[] {
  return SCENES.map((s, i) => ({
    id: `scene-${s.id}`,
    icon: '🏞️',
    iconSrc: sceneLocalSrc(s.id),
    zh: s.zh,
    en: s.en,
    price: scenePrice(i),
    kind: 'scene',
    scene: s.id,
  }));
}