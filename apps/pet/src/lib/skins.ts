/** 咕咕皮肤系统：官方分层皮肤 + 玩家自定义单图皮肤（manifest 规范的运行时子集） */

import type { GrowthStage, VariantId } from './types';

/** 构建时注入的子路径（见 next.config.ts env） */
export const BASE_PATH = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';

const SKIN_BASE = `${BASE_PATH}/skins/gugu`;

/** 官方各阶段身体图文件段（素材齐全，直接映射） */
const STAGE_SEGMENT: Record<GrowthStage, string> = {
  egg: 'egg',
  baby: 'baby',
  teen: 'teen',
  adult: 'adult',
};

export function bodySrc(variant: VariantId, stage: GrowthStage): string {
  return `${SKIN_BASE}/${variant}-${STAGE_SEGMENT[stage]}.png`;
}

export interface VariantInfo {
  id: VariantId;
  zh: string;
  en: string;
}

export const VARIANTS: VariantInfo[] = [
  { id: 'cream', zh: '奶黄', en: 'Cream' },
  { id: 'mint', zh: '薄荷', en: 'Mint' },
  { id: 'sakura', zh: '樱粉', en: 'Sakura' },
  { id: 'choco', zh: '巧克力', en: 'Choco' },
  { id: 'lavender', zh: '薰衣草', en: 'Lavender' },
  { id: 'soda', zh: '苏打', en: 'Soda' },
];

/**
 * 表情（SVG）在身体图上的定位（百分比：x 系相对宽度、y 系相对高度）。
 * 各变体/阶段的生成图比例略有差异，按 (变体, 阶段) 微调。
 */
export interface FaceLayout {
  eyeY: number;
  eyeDX: number;
  eyeRx: number;
  eyeRy: number;
  beakY: number;
  beakSize: number;
  blushY: number;
  blushDX: number;
  blushRx: number;
  blushRy: number;
}

export type FaceStage = Exclude<GrowthStage, 'egg'>;

export const FACE_LAYOUTS: Record<VariantId, Record<FaceStage, FaceLayout>> = {
  cream: {
    baby: {
      eyeY: 0.395,
      eyeDX: 0.105,
      eyeRx: 0.047,
      eyeRy: 0.058,
      beakY: 0.455,
      beakSize: 0.042,
      blushY: 0.415,
      blushDX: 0.175,
      blushRx: 0.045,
      blushRy: 0.03,
    },
    teen: {
      eyeY: 0.3,
      eyeDX: 0.09,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.365,
      beakSize: 0.04,
      blushY: 0.315,
      blushDX: 0.155,
      blushRx: 0.042,
      blushRy: 0.028,
    },
    adult: {
      eyeY: 0.22,
      eyeDX: 0.09,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.275,
      beakSize: 0.04,
      blushY: 0.24,
      blushDX: 0.155,
      blushRx: 0.042,
      blushRy: 0.028,
    },
  },
  mint: {
    baby: {
      eyeY: 0.36,
      eyeDX: 0.1,
      eyeRx: 0.045,
      eyeRy: 0.056,
      beakY: 0.425,
      beakSize: 0.04,
      blushY: 0.385,
      blushDX: 0.165,
      blushRx: 0.042,
      blushRy: 0.028,
    },
    teen: {
      eyeY: 0.3,
      eyeDX: 0.095,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.37,
      beakSize: 0.04,
      blushY: 0.32,
      blushDX: 0.16,
      blushRx: 0.042,
      blushRy: 0.028,
    },
    adult: {
      eyeY: 0.27,
      eyeDX: 0.1,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.325,
      beakSize: 0.04,
      blushY: 0.29,
      blushDX: 0.165,
      blushRx: 0.042,
      blushRy: 0.028,
    },
  },
  choco: {
    baby: {
      eyeY: 0.395,
      eyeDX: 0.105,
      eyeRx: 0.047,
      eyeRy: 0.058,
      beakY: 0.455,
      beakSize: 0.042,
      blushY: 0.415,
      blushDX: 0.175,
      blushRx: 0.045,
      blushRy: 0.03,
    },
    teen: {
      eyeY: 0.3,
      eyeDX: 0.09,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.365,
      beakSize: 0.04,
      blushY: 0.315,
      blushDX: 0.155,
      blushRx: 0.042,
      blushRy: 0.028,
    },
    adult: {
      eyeY: 0.22,
      eyeDX: 0.09,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.275,
      beakSize: 0.04,
      blushY: 0.24,
      blushDX: 0.155,
      blushRx: 0.042,
      blushRy: 0.028,
    },
  },
  lavender: {
    baby: {
      eyeY: 0.395,
      eyeDX: 0.105,
      eyeRx: 0.047,
      eyeRy: 0.058,
      beakY: 0.455,
      beakSize: 0.042,
      blushY: 0.415,
      blushDX: 0.175,
      blushRx: 0.045,
      blushRy: 0.03,
    },
    teen: {
      eyeY: 0.3,
      eyeDX: 0.09,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.365,
      beakSize: 0.04,
      blushY: 0.315,
      blushDX: 0.155,
      blushRx: 0.042,
      blushRy: 0.028,
    },
    adult: {
      eyeY: 0.22,
      eyeDX: 0.09,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.275,
      beakSize: 0.04,
      blushY: 0.24,
      blushDX: 0.155,
      blushRx: 0.042,
      blushRy: 0.028,
    },
  },
  soda: {
    baby: {
      eyeY: 0.395,
      eyeDX: 0.105,
      eyeRx: 0.047,
      eyeRy: 0.058,
      beakY: 0.455,
      beakSize: 0.042,
      blushY: 0.415,
      blushDX: 0.175,
      blushRx: 0.045,
      blushRy: 0.03,
    },
    teen: {
      eyeY: 0.3,
      eyeDX: 0.09,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.365,
      beakSize: 0.04,
      blushY: 0.315,
      blushDX: 0.155,
      blushRx: 0.042,
      blushRy: 0.028,
    },
    adult: {
      eyeY: 0.22,
      eyeDX: 0.09,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.275,
      beakSize: 0.04,
      blushY: 0.24,
      blushDX: 0.155,
      blushRx: 0.042,
      blushRy: 0.028,
    },
  },
  sakura: {
    baby: {
      eyeY: 0.385,
      eyeDX: 0.11,
      eyeRx: 0.047,
      eyeRy: 0.058,
      beakY: 0.445,
      beakSize: 0.041,
      blushY: 0.41,
      blushDX: 0.18,
      blushRx: 0.045,
      blushRy: 0.03,
    },
    teen: {
      eyeY: 0.355,
      eyeDX: 0.11,
      eyeRx: 0.047,
      eyeRy: 0.057,
      beakY: 0.42,
      beakSize: 0.041,
      blushY: 0.375,
      blushDX: 0.175,
      blushRx: 0.045,
      blushRy: 0.03,
    },
    adult: {
      eyeY: 0.26,
      eyeDX: 0.1,
      eyeRx: 0.045,
      eyeRy: 0.055,
      beakY: 0.315,
      beakSize: 0.04,
      blushY: 0.28,
      blushDX: 0.165,
      blushRx: 0.042,
      blushRy: 0.028,
    },
  },
};

export function faceLayoutFor(variant: VariantId, stage: GrowthStage): FaceLayout {
  const key: FaceStage = stage === 'egg' ? 'baby' : stage;
  return FACE_LAYOUTS[variant][key];
}

/** 自定义单图皮肤的默认表情定位（比例未知时居中偏下） */
export const DEFAULT_CUSTOM_FACE: FaceLayout = {
  eyeY: 0.4,
  eyeDX: 0.11,
  eyeRx: 0.047,
  eyeRy: 0.058,
  beakY: 0.46,
  beakSize: 0.042,
  blushY: 0.42,
  blushDX: 0.18,
  blushRx: 0.045,
  blushRy: 0.03,
};

// ---------- 皮肤分享码（纯函数，零依赖） ----------

export interface ShareableSkin {
  name: string;
  imageDataUrl?: string;
  url?: string;
  faceOverlay: boolean;
}

const CODE_PREFIX = 'guguskin1.';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * 导出分享码（v2）：`guguskin1.<base64url(metajson)>.<图片负载 base64>`。
 * 图片负载直接沿用 dataURL 的 base64 段，避免 JSON→base64 的 4/3 二次膨胀；
 * 远程 URL 皮肤无负载段。（解析兼容 v1 单段旧码）
 */
export function encodeSkinCode(skin: ShareableSkin): string {
  const payload = skin.imageDataUrl?.startsWith('data:image/') ? skin.imageDataUrl.split(',')[1] : undefined;
  const meta = {
    name: skin.name,
    url: skin.url,
    faceOverlay: skin.faceOverlay,
  };
  const head = CODE_PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(meta)));
  return payload ? `${head}.${payload}` : head;
}

/** 解析分享码（兼容 v1 单段旧码）；非法输入抛错 */
export function decodeSkinCode(code: string): ShareableSkin {
  const trimmed = code.trim();
  if (!trimmed.startsWith(CODE_PREFIX)) throw new Error('invalid skin code');
  const rest = trimmed.slice(CODE_PREFIX.length);
  const dotIdx = rest.indexOf('.');
  let parsed: ShareableSkin;
  if (dotIdx === -1) {
    // v1：整段 base64url(JSON)
    parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(rest))) as ShareableSkin;
  } else {
    // v2：meta base64url(JSON) + 图片负载 base64
    const meta = JSON.parse(new TextDecoder().decode(fromBase64Url(rest.slice(0, dotIdx)))) as ShareableSkin;
    const payload = rest.slice(dotIdx + 1);
    if (payload && !meta.url) meta.imageDataUrl = `data:image/png;base64,${payload}`;
    parsed = meta;
  }
  if (typeof parsed.name !== 'string' || (!parsed.imageDataUrl && !parsed.url)) {
    throw new Error('invalid skin payload');
  }
  if (typeof parsed.faceOverlay !== 'boolean') parsed.faceOverlay = false;
  return parsed;
}
