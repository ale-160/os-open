/** 咕咕皮肤系统：官方分层皮肤 + 玩家自定义单图皮肤（manifest 规范的运行时子集） */

import type { GrowthStage, VariantId } from './types';

/** 构建时注入的子路径（见 next.config.ts env） */
export const BASE_PATH = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';

import { assetUrl } from './assetUrl';

const SKIN_BASE = `${BASE_PATH}/skins/gugu`;

/** 官方各阶段身体图文件段（素材齐全，直接映射） */
const STAGE_SEGMENT: Record<GrowthStage, string> = {
  egg: 'egg',
  baby: 'baby',
  teen: 'teen',
  adult: 'adult',
};

/**
 * 身体图本地路径。
 * adult 是 2026-11 重绘的 466×421 主体，放在 `adult/` 子目录里；
 * 旧的 `gugu/<variant>-adult.png` 不覆盖，留作兜底（线上 R2 上仍在）。
 */
export function bodyLocalSrc(variant: VariantId, stage: GrowthStage): string {
  if (stage === 'adult') return `${SKIN_BASE}/adult/${variant}-adult.png`;
  return `${SKIN_BASE}/${variant}-${STAGE_SEGMENT[stage]}.png`;
}

export function bodySrc(variant: VariantId, stage: GrowthStage): string {
  return assetUrl(bodyLocalSrc(variant, stage));
}

/**
 * 身体图兜底链的第二站：新主体（`gugu/adult/<variant>-adult.png`）失败时退到旧主体
 * （`gugu/<variant>-adult.png`）；其它阶段退到本地同名文件。
 * 只在一处定义，避免组件里再写一遍分支。
 */
export function bodyFallbackSrc(variant: VariantId, stage: GrowthStage): string {
  if (stage === 'adult') return assetUrl(`${SKIN_BASE}/${variant}-${STAGE_SEGMENT.adult}.png`);
  return bodyLocalSrc(variant, stage);
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
  { id: 'matcha', zh: '抹茶', en: 'Matcha' },
  { id: 'peach', zh: '蜜桃', en: 'Peach' },
  { id: 'ocean', zh: '海盐蓝', en: 'Ocean' },
  { id: 'grape', zh: '葡萄紫', en: 'Grape' },
  { id: 'lemon', zh: '柠檬', en: 'Lemon' },
  { id: 'sakura-deep', zh: '浓樱', en: 'Deep Sakura' },
  { id: 'cotton', zh: '棉白', en: 'Cotton' },
  { id: 'charcoal', zh: '炭灰', en: 'Charcoal' },
  { id: 'caramel', zh: '焦糖', en: 'Caramel' },
  { id: 'mint-deep', zh: '深荷', en: 'Deep Mint' },
  { id: 'coral', zh: '珊瑚', en: 'Coral' },
  { id: 'sky', zh: '天空', en: 'Sky' },
  { id: 'rose', zh: '玫瑰', en: 'Rose' },
  { id: 'olive', zh: '橄榄', en: 'Olive' },
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

/**
 * adult 段面锚点：2026-11 重绘主体（466×421，主体 417×421 居中）按参考图 439×480 直接提取，
 * 五官基准与 baby/teen 那套旧锚点不同，所以单独抽出来共用——20 个变体只差配色，几何完全一致。
 * （baby/teen 的数值仍保留在各变体里，未做合并不改行为）
 */
const ADULT_FACE: FaceLayout = {
  eyeY: 0.3394,
  eyeDX: 0.073,
  eyeRx: 0.034,
  eyeRy: 0.0413,
  beakY: 0.3841,
  beakSize: 0.0365,
  blushY: 0.3515,
  blushDX: 0.1288,
  blushRx: 0.0279,
  blushRy: 0.0215,
};

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
    adult: ADULT_FACE,
  },
  mint: {
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
    adult: ADULT_FACE,
  },
  sakura: {
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
    adult: ADULT_FACE,
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
    adult: ADULT_FACE,
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
    adult: ADULT_FACE,
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
    adult: ADULT_FACE,
  },
  matcha: {
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
    adult: ADULT_FACE,
  },
  peach: {
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
    adult: ADULT_FACE,
  },
  ocean: {
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
    adult: ADULT_FACE,
  },
  grape: {
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
    adult: ADULT_FACE,
  },
  lemon: {
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
    adult: ADULT_FACE,
  },
  'sakura-deep': {
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
    adult: ADULT_FACE,
  },
  cotton: {
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
    adult: ADULT_FACE,
  },
  charcoal: {
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
    adult: ADULT_FACE,
  },
  caramel: {
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
    adult: ADULT_FACE,
  },
  'mint-deep': {
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
    adult: ADULT_FACE,
  },
  coral: {
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
    adult: ADULT_FACE,
  },
  sky: {
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
    adult: ADULT_FACE,
  },
  rose: {
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
    adult: ADULT_FACE,
  },
  olive: {
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
    adult: ADULT_FACE,
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
