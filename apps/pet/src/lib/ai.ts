/**
 * BYOK AI 客户端：OpenAI 兼容 chat/completions 与 images/generations。
 * 密钥只存浏览器 localStorage（ale-pet-ai），绝不入库、绝不随皮肤分享码导出；
 * 所有请求失败都由调用方回退本地台词/官方形象。
 */

import type { PetState } from './types';

export interface AiSettings {
  enabled: boolean;
  /** 形如 https://api.openai.com/v1 */
  baseURL: string;
  apiKey: string;
  /** 对话模型 */
  model: string;
  /** 图像生成模型（一句话领养用） */
  imageModel: string;
}

const AI_STORAGE_KEY = 'ale-pet-ai';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  baseURL: '',
  apiKey: '',
  model: 'gpt-4o-mini',
  imageModel: 'gpt-image-2',
};

export function loadAiSettings(): AiSettings {
  try {
    const text = localStorage.getItem(AI_STORAGE_KEY);
    if (!text) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(text) as Partial<AiSettings>;
    return { ...DEFAULT_AI_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(settings: AiSettings) {
  try {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* 隐私模式等场景写入失败可忽略 */
  }
}

export function aiReady(s: AiSettings): boolean {
  return s.enabled && !!s.baseURL && !!s.apiKey && !!s.model;
}

export function aiImageReady(s: AiSettings): boolean {
  return aiReady(s) && !!s.imageModel;
}

/** 拼接端点（容忍末尾斜杠） */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

const STAGE_ZH: Record<PetState['stage'], string> = { egg: '蛋', baby: '幼年', teen: '少年', adult: '成年' };
const PERSONALITY_ZH: Record<string, string> = {
  foodie: '吃货',
  lively: '活泼',
  artsy: '文艺',
  chill: '淡定',
};

/** 对话 system prompt（纯函数，便于测试） */
export function buildSystemPrompt(pet: {
  name: string;
  stage: PetState['stage'];
  satiety: number;
  cleanliness: number;
  mood: number;
  energy: number;
  health: number;
  sick: boolean;
  dominantPersonality?: string | null;
}, locale: 'zh' | 'en'): string {
  if (locale === 'en') {
    return [
      `You are "${pet.name}", a ${pet.stage}-stage original bird pet the player is raising.`,
      pet.dominantPersonality ? `Your personality leans ${pet.dominantPersonality}.` : '',
      pet.sick ? 'You are sick right now, sound weak and ask for care.' : '',
      `Current stats: food ${Math.round(pet.satiety)}/100, clean ${Math.round(pet.cleanliness)}/100, mood ${Math.round(pet.mood)}/100, energy ${Math.round(pet.energy)}/100, health ${Math.round(pet.health)}/100.`,
      'Reply in English, under 40 characters, cute and playful; at most one emoji; never mention being an AI or a model.',
    ].filter(Boolean).join(' ');
  }
  return [
    `你是「${pet.name}」，一只${STAGE_ZH[pet.stage]}阶段的原创小鸟宠物，正被玩家养在网页操作系统里。`,
    pet.dominantPersonality ? `你的性格偏「${PERSONALITY_ZH[pet.dominantPersonality] ?? pet.dominantPersonality}」。` : '',
    pet.sick ? '你现在生病了，语气虚弱，想要玩家照顾。' : '',
    `当前状态：饱食 ${Math.round(pet.satiety)}/100、清洁 ${Math.round(pet.cleanliness)}/100、心情 ${Math.round(pet.mood)}/100、精力 ${Math.round(pet.energy)}/100、健康 ${Math.round(pet.health)}/100。`,
    '回复要求：不超过 40 字，口语化、可爱，可以带"咕"字语气词；最多 1 个 emoji；不要自称 AI 或模型。',
  ].filter(Boolean).join('\n');
}

/** 一句话领养的图像 prompt（纯函数，便于测试） */
export function buildImagePrompt(sentence: string): string {
  const trimmed = sentence.trim().slice(0, 120);
  return [
    trimmed,
    'Style: kawaii flat sticker illustration of a round chubby bird character, soft pastel colors, thick dark brown outline, full body, front view, centered composition, plain solid light background, no watermark, no text.',
  ].join(' ');
}

interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 对话补全；任何失败都抛错，由调用方回退本地台词 */
export async function chatComplete(
  settings: AiSettings,
  messages: ChatMessageInput[],
  timeoutMs = 20_000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(joinUrl(settings.baseURL, '/chat/completions'), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        max_tokens: 120,
        temperature: 0.9,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('empty completion');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** 生成 1024 透明 PNG dataURL；白/黑底时用 canvas flood-fill 抠图 */
export async function generatePetImage(settings: AiSettings, sentence: string, timeoutMs = 120_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let dataUrl: string;
  try {
    const res = await fetch(joinUrl(settings.baseURL, '/images/generations'), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.imageModel,
        prompt: buildImagePrompt(sentence),
        size: '1024x1024',
        background: 'transparent',
        n: 1,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const d = json.data?.[0];
    if (d?.b64_json) {
      dataUrl = `data:image/png;base64,${d.b64_json}`;
    } else if (d?.url) {
      const imgRes = await fetch(d.url);
      const blob = await imgRes.blob();
      dataUrl = await blobToDataUrl(blob);
    } else {
      throw new Error('no image in response');
    }
  } finally {
    clearTimeout(timer);
  }
  return removeSolidBackground(dataUrl);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read blob failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 浏览器版底色抠图：四角取平均底色，从边缘 flood-fill 清成透明。
 * 已透明的图原样返回。
 */
export async function removeSolidBackground(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const cornerAt = (x: number, y: number) => (y * w + x) * 4;
  const samples = [cornerAt(0, 0), cornerAt(w - 1, 0), cornerAt(0, h - 1), cornerAt(w - 1, h - 1)];
  if (samples.some((i) => px[i + 3] < 10)) {
    return dataUrl; // 已透明
  }
  const bg = [0, 1, 2].map((ch) => samples.reduce((s, i) => s + px[i + ch], 0) / samples.length);
  const isBg = (i: number) =>
    Math.abs(px[i] - bg[0]) <= 30 && Math.abs(px[i + 1] - bg[1]) <= 30 && Math.abs(px[i + 2] - bg[2]) <= 30;
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    const i = p * 4;
    if (px[i + 3] >= 10 && !isBg(i)) return;
    visited[p] = 1;
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
    px[i + 3] = 0;
    queue.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (queue.length) {
    const p = queue.pop()!;
    const x = p % w;
    const y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}
