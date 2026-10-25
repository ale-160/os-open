'use client';

/**
 * 咕咕中央状态仓库。
 * - 存档 localStorage `ale-pet-save`（版本化，带 updatedAt，跨页面 storage 事件同步）
 * - 时间推进统一走 lib/sim 的 simulate()（tick 5s + 可见性恢复即时补算）
 * - 气泡/粒子演出只存内存，不进存档
 */

import { create } from 'zustand';
import {
  clamp01,
  cooldownRemaining,
  INITIAL_COINS,
  OFFLINE,
  PET_TAP,
  RANDOM_EVENTS,
  minigameReward,
} from './balance';
import { pickLine, type LineKind } from './lines';
import { useLocale } from '@/hooks/useLocale';
import { aiReady, buildSystemPrompt, chatComplete, loadAiSettings } from './ai';
import { achievementById, checkAchievements } from './achievements';
import { sfx } from './sfx';
import { checkCare } from './care';
import { addDiaryEvent } from './diary';
import { isBadWeather, weatherFor } from './weather';
import { notify } from './notify';
import { pickDest } from './travel';
import { pickSticker } from './stickers';
import { PDS_DESTS } from './pingdingshan';
import {
  deleteSkinRecord,
  listSkinRecords,
  saveSkinRecord,
  type CustomSkinRecord,
} from './db';
import {
  applyAction,
  applyStudy,
  applyWork,
  buyItem,
  createPet,
  dominantPersonality,
  hatchEgg,
  simulate,
} from './sim';
import type {
  AccessoryId,
  ActionId,
  ActivityState,
  BurstData,
  DecoId,
  GameBests,
  GameKind,
  PetCounters,
  PetState,
  Provision,
  ShopItem,
  SimEventKind,
  VariantId,
} from './types';

const STORAGE_KEY = 'ale-pet-save';
const CARE_KEY = 'ale-pet-care';
const ZERO_COUNTERS: PetCounters = {
  feed: 0,
  wash: 0,
  play: 0,
  work: 0,
  study: 0,
  tap: 0,
  heal: 0,
  aiChat: 0,
};
const ZERO_BESTS: GameBests = { snack: 0, whack: 0, memory: 0, race: 0, toss: 0, sing: 0, lianliankan: 0, match3: 0, monopoly: 0, merge: 0 };

interface BubbleData {
  id: number;
  text: string;
  kind?: LineKind;
  sticker?: string | null;
}

export interface ChatMsg {
  role: 'user' | 'gugu';
  text: string;
  /** 该条咕咕回复是否来自本地台词兜底 */
  fallback?: boolean;
}

interface PetStore {
  pet: PetState | null;
  /** 存档是否已从 localStorage 恢复（防 SSR/首帧闪烁） */
  ready: boolean;
  /** 瞬时动作演出（eating/washing/playing/working/studying） */
  anim: ActivityState | null;
  bubble: BubbleData | null;
  burst: BurstData | null;
  recentLines: string[];
  tapStamps: number[];

  /** 自定义皮肤（IndexedDB） */
  customSkins: CustomSkinRecord[];
  /** AI 聊天会话（仅内存，不持久化） */
  chatMessages: ChatMsg[];
  chatBusy: boolean;
  /** 本次会话是否出现过 AI 失败回退 */
  chatFallbackUsed: boolean;
  /** 用户活动追踪（关怀功能用，内存态） */
  lastActivityAt: number;
  sessionStartAt: number;
  careSent: Set<string>;

  init: () => void;
  adopt: (variant: VariantId, name: string) => void;
  /** 一句话领养：先存皮肤再建档 */
  adoptWithSkin: (variant: VariantId, name: string, skin: CustomSkinRecord) => Promise<void>;
  tapEgg: () => void;
  tapPet: () => void;
  doAction: (id: ActionId) => void;
  doWork: () => void;
  doStudy: () => void;
  buyItem: (item: ShopItem) => void;
  /** 小游戏结算：按得分发放奖励并更新该游戏最高分，返回奖励与新纪录标记 */
  finishMinigame: (game: GameKind, score: number) => { coins: number; mood: number; newBest: boolean };
  toggleSleep: () => void;
  /** 周期调用：推进模拟并派发事件气泡 */
  tick: () => void;
  say: (kind: LineKind, vars?: Record<string, string | number>) => void;
  clearBubble: () => void;
  tutorialNext: () => void;
  reset: () => void;

  /** 切换官方配色（整体重上色） */
  setVariant: (variant: VariantId) => void;
  /** 穿/脱配件（null = 脱下） */
  equipAccessory: (id: AccessoryId | null) => void;
  /** 摆放/收起装饰 */
  toggleDecoration: (id: DecoId) => void;
  /** 选择场景（null = 每日自动轮换） */
  setScene: (id: string | null) => void;
  /** 应用/取消自定义皮肤（null = 回到官方） */
  applySkin: (skinId: string | null) => void;
  addCustomSkin: (record: CustomSkinRecord) => Promise<void>;
  removeCustomSkin: (skinId: string) => Promise<void>;
  /** 解析当前应渲染的身体图与表情叠加开关 */
  resolvedSkin: () => { src: string; faceOverlay: boolean } | null;
  sendChat: (text: string) => Promise<void>;
  clearChat: () => void;
  /** 检查并发放新解锁的成就（气泡 + 粒子庆祝） */
  grantAchievements: () => void;
  /** 改名 */
  rename: (name: string) => void;
  /** 导出完整备份（存档 + 自定义皮肤）；未领养时返回 null */
  exportBackup: () => { save: PetState; skins: CustomSkinRecord[]; exportedAt: number } | null;
  /** 从备份导入（存档走版本迁移，皮肤逐条落 IndexedDB） */
  importBackup: (data: unknown) => Promise<boolean>;
  /** 切换养成模式（休闲/经典） */
  setMode: (mode: PetState['mode']) => void;
  /** 便当柜装行李（下次出发生效） */
  packProvision: (p: Provision | null) => void;
  /** 关闭旅行报告，咕咕回家 */
  dismissTrip: () => void;
  /** 用户活动心跳（指针/键盘），供关怀判断 */
  pokeActivity: () => void;
}

/** v1 → v5 迁移：补元宝、冷却、成就、逐游戏最高分与旅行系统 */
function migrateV1(raw: Record<string, unknown>): PetState {
  return {
    ...(raw as unknown as PetState),
    saveVersion: 7,
    coins: INITIAL_COINS,
    lastWorkedAt: 0,
    lastStudiedAt: 0,
    counters: { ...ZERO_COUNTERS },
    bests: { ...ZERO_BESTS },
    achievements: [],
    trip: null,
    album: { photos: [], souvenirs: [] },
    diary: {},
  };
}

/** v2 → v5 迁移：补成就系统与旅行系统 */
function migrateV2(raw: Record<string, unknown>): PetState {
  return {
    ...(raw as unknown as PetState),
    saveVersion: 7,
    counters: { ...ZERO_COUNTERS },
    bests: { ...ZERO_BESTS },
    achievements: [],
    trip: null,
    album: { photos: [], souvenirs: [] },
    diary: {},
  };
}

/** v3 → v5 迁移：共享最高分拆分为逐游戏最高分（接点心继承旧值） */
function migrateV3(raw: Record<string, unknown>): PetState {
  const legacyCounters = (raw.counters ?? {}) as Partial<PetCounters> & { minigameBest?: number };
  const { minigameBest = 0, ...restCounters } = legacyCounters;
  return {
    ...(raw as unknown as PetState),
    saveVersion: 7,
    counters: { ...ZERO_COUNTERS, ...restCounters },
    bests: { ...ZERO_BESTS, snack: minigameBest },
    achievements: Array.isArray(raw.achievements) ? (raw.achievements as string[]) : [],
    trip: null,
    album: { photos: [], souvenirs: [] },
    diary: {},
  };
}

/** v6 → v7 迁移：补装扮与装饰字段 */
function migrateV6(raw: Record<string, unknown>): PetState {
  return {
    ...(raw as unknown as PetState),
    saveVersion: 7,
    accessories: [],
    equippedAccessory: null,
    decoOwned: [],
    decorations: [],
  };
}

/** v5 → v7 迁移：补日记与装扮字段 */
function migrateV5(raw: Record<string, unknown>): PetState {
  return {
    ...(raw as unknown as PetState),
    saveVersion: 7,
    diary: {},
  };
}

/** v4 → v6 迁移：补旅行系统与日记字段 */
function migrateV4(raw: Record<string, unknown>): PetState {
  return {
    ...(raw as unknown as PetState),
    saveVersion: 7,
    trip: null,
    album: { photos: [], souvenirs: [] },
    diary: {},
  };
}

function normalizeRaw(parsed: { saveVersion?: number } & Record<string, unknown>): PetState | null {
  if (parsed.saveVersion === 1) return withDefaults(migrateV1(parsed));
  if (parsed.saveVersion === 2) return withDefaults(migrateV2(parsed));
  if (parsed.saveVersion === 3) return withDefaults(migrateV3(parsed));
  if (parsed.saveVersion === 4) return withDefaults(migrateV4(parsed));
  if (parsed.saveVersion === 5) return withDefaults(migrateV5(parsed));
  if (parsed.saveVersion === 6) return withDefaults(migrateV6(parsed));
  if (parsed.saveVersion !== 7 || typeof parsed.updatedAt !== 'number') return null;
  return withDefaults(parsed as unknown as PetState);
}

/** 老档兜底：补齐各版本新增字段，避免旧存档读取 undefined.length / 新游戏最高分空白 */
function withDefaults(pet: PetState): PetState {
  const variantOwned = Array.isArray(pet.variantOwned) && pet.variantOwned.length
    ? [...pet.variantOwned]
    : [pet.variant];
  if (!variantOwned.includes(pet.variant)) variantOwned.push(pet.variant);
  const sceneOwned = Array.isArray(pet.sceneOwned)
    ? [...pet.sceneOwned]
    : pet.sceneId
      ? [pet.sceneId]
      : [];
  if (pet.sceneId && !sceneOwned.includes(pet.sceneId)) sceneOwned.push(pet.sceneId);
  return {
    ...pet,
    counters: { ...ZERO_COUNTERS, ...pet.counters },
    bests: { ...ZERO_BESTS, ...pet.bests },
    achievements: Array.isArray(pet.achievements) ? pet.achievements : [],
    accessories: Array.isArray(pet.accessories) ? pet.accessories : [],
    equippedAccessory: pet.equippedAccessory ?? null,
    decoOwned: Array.isArray(pet.decoOwned) ? pet.decoOwned : [],
    decorations: Array.isArray(pet.decorations) ? pet.decorations : [],
    // 老档：当前配色/场景视为已解锁，保证已有选择不被收回
    variantOwned,
    sceneOwned,
    trip: pet.trip ?? null,
    album: pet.album ?? { photos: [], souvenirs: [] },
    diary: pet.diary ?? {},
  };
}

function loadRaw(): PetState | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    return normalizeRaw(JSON.parse(text) as { saveVersion?: number } & Record<string, unknown>);
  } catch {
    return null;
  }
}

function saveRaw(pet: PetState | null) {
  try {
    if (pet) localStorage.setItem(STORAGE_KEY, JSON.stringify(pet));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 隐私模式等场景写入失败可忽略 */
  }
}

let bubbleSeq = 0;
let burstSeq = 0;

/** SimEventKind 与台词 kind 基本同名，集中映射便于后续增补 */
const EVENT_LINE: Partial<Record<SimEventKind, LineKind>> = {
  hungry: 'hungry',
  dirty: 'dirty',
  sleepy: 'sleepy',
  sick: 'sick',
  recover: 'recover',
  wake: 'wake',
  stageUp: 'stageUp',
};

const ACTION_ANIM: Record<ActionId | 'work' | 'study', ActivityState> = {
  feed: 'eating',
  wash: 'washing',
  play: 'playing',
  work: 'working',
  study: 'studying',
};

const ANIM_MS: Record<ActionId | 'work' | 'study', number> = {
  feed: 2400,
  wash: 2800,
  play: 3200,
  work: 5000,
  study: 4600,
};

/** 结算评语分档：各游戏"很棒/不错"阈值不同（race 赢即 14+，toss 满分 15） */
const TIER_CFG: Record<GameKind, [great: number, ok: number]> = {
  snack: [12, 5],
  whack: [12, 5],
  memory: [15, 6],
  race: [14, 6],
  toss: [11, 5],
  sing: [12, 5],
  lianliankan: [8, 3],
  match3: [1500, 600],
  monopoly: [18, 8],
  merge: [600, 200],
};

/** 关怀去重记录（localStorage，保留最近 60 条 key） */
function loadCareSent(): Set<string> {
  try {
    const text = localStorage.getItem(CARE_KEY);
    return new Set(text ? (JSON.parse(text) as string[]) : []);
  } catch {
    return new Set();
  }
}
function persistCareSent(sent: Set<string>) {
  try {
    const arr = [...sent].slice(-60);
    localStorage.setItem(CARE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

/** 旅行相册上限（超出淘汰最旧） */
const ALBUM_CAP = 36;

function trimAlbum<T>(list: T[]): T[] {
  return list.slice(-ALBUM_CAP);
}

/** 在宠物状态上记录一条日记事件（按今天聚合） */
function withDiary(pet: PetState, token: string): PetState {
  const today = new Date().toDateString();
  return { ...pet, diary: addDiaryEvent(pet.diary, today, token) };
}

/** 旅行归来结算：照片/手信入册 + 收获（心情/成长提升，消耗少量饱食精力） */
function processTripReturn(pet: PetState, trip: NonNullable<PetState['trip']>, now: number): PetState {
  const photoCaps = trip.photos.length ? trip.photos : [0];
  const photos = photoCaps.map((cap, i) => ({
    dest: trip.dest,
    cap,
    at: trip.departAt + ((i + 1) * (trip.returnAt - trip.departAt)) / (photoCaps.length + 1),
  }));
  const souvenir = trip.souvenir || Math.random() < 0.4;
  return {
    ...pet,
    trip: { ...trip, status: 'returned' },
    album: {
      photos: trimAlbum([...pet.album.photos, ...photos]),
      souvenirs: trimAlbum([...pet.album.souvenirs, ...(souvenir ? [{ dest: trip.dest, at: trip.returnAt }] : [])]),
    },
    mood: clamp01(pet.mood + 12),
    growth: pet.growth + 5,
    satiety: clamp01(pet.satiety - 6),
    energy: clamp01(pet.energy - 8),
    lastTripAt: now,
  };
}

/** 自主出发：状态好才会出门 */
function departTrip(pet: PetState, now: number): PetState {
  // 30% 概率去平顶山文旅远门（鹰悦拍联动），其余本地 8 目的地
  const goPds = Math.random() < 0.3;
  const dest = goPds
    ? PDS_DESTS[Math.floor(Math.random() * PDS_DESTS.length)].id
    : pickDest(pet.packedProvision ?? null);
  return {
    ...pet,
    packedProvision: null,
    lastTripAt: now,
    trip: {
      status: 'away',
      departAt: now,
      returnAt: now + (goPds ? 4 + Math.random() * 2 : 3 + Math.random() * 1.5) * 60_000,
      dest,
      provision: pet.packedProvision ?? null,
      photos: [],
      souvenir: pet.packedProvision === 'charm' || goPds,
    },
  };
}

/** 自主出门条件 */
function canTravel(pet: PetState): boolean {
  return (
    pet.alive &&
    pet.stage !== 'egg' &&
    !pet.sleeping &&
    !pet.sick &&
    !pet.trip &&
    pet.satiety > 60 &&
    pet.mood > 60 &&
    pet.energy > 60
  );
}

export const usePetStore = create<PetStore>()((set, get) => ({
  pet: null,
  ready: false,
  anim: null,
  bubble: null,
  burst: null,
  recentLines: [],
  tapStamps: [],
  customSkins: [],
  chatMessages: [],
  chatBusy: false,
  chatFallbackUsed: false,
  lastActivityAt: 0,
  sessionStartAt: 0,
  careSent: new Set<string>(),

  init: () => {
    if (get().ready || typeof window === 'undefined') return;
    const now = Date.now();
    set({ lastActivityAt: now, sessionStartAt: now, careSent: loadCareSent() });
    const raw = loadRaw();
    if (raw) {
      const awayMs = now - raw.updatedAt;
      const { next, events } = simulate(raw, now);
      saveRaw(next);
      set({ pet: next, ready: true });
      if (next.stage !== 'egg' && awayMs > OFFLINE.thresholdMs) {
        get().say('back');
      } else {
        const kind = events[events.length - 1]?.kind;
        if (kind && EVENT_LINE[kind]) get().say(EVENT_LINE[kind]!);
      }
      // 每日签到（自动，领养未破壳不签）
      const today = new Date().toDateString();
      if (next.stage !== 'egg' && next.lastCheckinDate !== today) {
        const yesterday = new Date(Date.now() - 86_400_000).toDateString();
        const streak = next.lastCheckinDate === yesterday ? (next.checkinStreak ?? 0) + 1 : 1;
        const checkinNext: PetState = {
          ...withDiary(next, 'checkin'),
          lastCheckinDate: today,
          checkinStreak: streak,
          coins: next.coins + 10,
        };
        saveRaw(checkinNext);
        set({ pet: checkinNext });
        get().say('checkin', { n: 10, s: streak });
      }
      // 离线旅行：离开足够久、状态还行、没在旅途中 → 咕咕自己出门玩了一趟
      const awayMin = awayMs / 60_000;
      const cur = get().pet;
      if (
        cur &&
        cur.alive &&
        cur.stage !== 'egg' &&
        !cur.trip &&
        awayMin >= 25 &&
        cur.satiety > 45 &&
        cur.mood > 45 &&
        Math.random() < 0.65
      ) {
        const provision = cur.packedProvision ?? null;
        const goPds = Math.random() < 0.3;
        const dest = goPds
          ? PDS_DESTS[Math.floor(Math.random() * PDS_DESTS.length)].id
          : pickDest(provision);
        const durMin = goPds ? 20 + Math.random() * 15 : provision === 'bento' ? 25 + Math.random() * 15 : 12 + Math.random() * 13;
        const window = Math.max(60_000, awayMs - durMin * 60_000);
        const departAt = now - awayMs + Math.random() * window;
        const returnAt = departAt + durMin * 60_000;
        const photoCaps = [0, ...(provision === 'bento' || Math.random() < 0.5 ? [1] : [])];
        const souvenir = provision === 'charm' || Math.random() < 0.7;
        const tripNext: PetState = {
          ...cur,
          packedProvision: null,
          trip: { status: 'returned', departAt, returnAt, dest, provision, photos: photoCaps, souvenir },
          album: {
            photos: trimAlbum([
              ...cur.album.photos,
              ...photoCaps.map((cap, i) => ({ dest, cap, at: departAt + ((i + 1) * (returnAt - departAt)) / (photoCaps.length + 1) })),
            ]),
            souvenirs: trimAlbum([...cur.album.souvenirs, ...(souvenir ? [{ dest, at: returnAt }] : [])]),
          },
          mood: clamp01(cur.mood + 12),
          growth: cur.growth + 6,
          satiety: clamp01(cur.satiety - 6),
          energy: clamp01(cur.energy - 8),
        };
        const withTripDiary = withDiary(tripNext, 'trip:' + dest);
        saveRaw(withTripDiary);
        set({ pet: withTripDiary });
      }
    } else {
      set({ ready: true });
    }
    // 自定义皮肤列表（IndexedDB 异步加载）
    listSkinRecords()
      .then((list) => set({ customSkins: list.sort((a, b) => b.createdAt - a.createdAt) }))
      .catch(() => {
        /* IndexedDB 不可用时无自定义皮肤功能 */
      });
    // 跨页面同步：另一页（挂件/独立页）写入的更新存档
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const remote = JSON.parse(e.newValue) as { saveVersion?: number } & Record<string, unknown>;
        const cur = get().pet;
        const remotePet = normalizeRaw(remote);
        if (
          remotePet?.saveVersion === 7 &&
          (!cur || remotePet.updatedAt > cur.updatedAt)
        ) {
          set({ pet: remotePet });
        }
      } catch {
        /* 忽略坏数据 */
      }
    });
  },

  adopt: (variant, name) => {
    const now = Date.now();
    const pet = createPet(variant, name, now);
    saveRaw(pet);
    set({ pet, recentLines: [] });
  },

  adoptWithSkin: async (variant, name, skin) => {
    await saveSkinRecord(skin);
    const now = Date.now();
    const pet: PetState = { ...createPet(variant, name, now), customSkinId: skin.id };
    saveRaw(pet);
    const list = await listSkinRecords().catch(() => [skin]);
    set({ pet, recentLines: [], customSkins: list.sort((a, b) => b.createdAt - a.createdAt) });
  },

  tapEgg: () => {
    const pet = get().pet;
    if (!pet || pet.stage !== 'egg') return;
    const remaining = pet.tapsToHatch - 1;
    if (remaining <= 0) {
    const next = withDiary(hatchEgg(pet, Date.now()), 'hatch');
    saveRaw(next);
    set({ pet: next, burst: { id: ++burstSeq, kind: 'confetti' } });
    sfx.hatch();
    get().say('hatchWelcome');
    get().grantAchievements();
    } else {
      const next = { ...pet, tapsToHatch: remaining };
      saveRaw(next);
      set({ pet: next, burst: { id: ++burstSeq, kind: 'wobble' } });
      get().say('tapEgg');
    }
  },

  tapPet: () => {
    const pet = get().pet;
    if (!pet || pet.stage === 'egg' || pet.sleeping || !pet.alive) return;
    const now = Date.now();
    // 摸摸前先补算时间，避免把衰减窗口清零
    const { next: simmed } = simulate(pet, now);
    const stamps = get().tapStamps.filter((t) => now - t < 60_000);
    const loved = stamps.length < PET_TAP.maxPerMinute;
    stamps.push(now);
    const next: PetState = loved
      ? {
          ...simmed,
          mood: clamp01(simmed.mood + PET_TAP.mood),
          counters: { ...simmed.counters, tap: simmed.counters.tap + 1 },
        }
      : simmed;
    saveRaw(next);
    set({
      pet: next,
      tapStamps: stamps,
      burst: { id: ++burstSeq, kind: 'heart' },
    });
    sfx.chirp();
    if (Math.random() < 0.55) get().say('tap');
    get().grantAchievements();
  },

  doAction: (id) => {
    const pet = get().pet;
    if (!pet) return;
    const now = Date.now();
    if (cooldownRemaining(id, pet, now) > 0) {
      set({ burst: { id: ++burstSeq, kind: 'wobble' } });
      return;
    }
    const { ok, next } = applyAction(pet, id, now);
    if (!ok) return;
    const withD = withDiary(next, id);
    saveRaw(withD);
    const nextPet = withD;
    const anim = ACTION_ANIM[id];
    set({
      pet: nextPet,
      anim,
      burst: { id: ++burstSeq, kind: id === 'wash' ? 'bubble' : id === 'play' ? 'sparkle' : 'heart' },
    });
    get().say(id);
    const animMs = ANIM_MS[id];
    setTimeout(() => {
      if (get().anim === anim) set({ anim: null });
    }, animMs);
    get().grantAchievements();
  },

  doWork: () => {
    const pet = get().pet;
    if (!pet) return;
    const now = Date.now();
    if (cooldownRemaining('work', pet, now) > 0) {
      set({ burst: { id: ++burstSeq, kind: 'wobble' } });
      return;
    }
    const { ok, next, reason } = applyWork(pet, now);
    if (!ok) {
      if (reason === 'tired') get().say('tired');
      return;
    }
    const withD = withDiary(next, 'work');
    saveRaw(withD);
    set({
      pet: withD,
      anim: 'working',
      burst: { id: ++burstSeq, kind: 'sparkle' },
    });
    get().say('work');
    setTimeout(() => {
      if (get().anim === 'working') set({ anim: null });
    }, ANIM_MS.work);
    get().grantAchievements();
  },

  doStudy: () => {
    const pet = get().pet;
    if (!pet) return;
    const now = Date.now();
    if (cooldownRemaining('study', pet, now) > 0) {
      set({ burst: { id: ++burstSeq, kind: 'wobble' } });
      return;
    }
    const { ok, next, reason } = applyStudy(pet, now);
    if (!ok) {
      if (reason === 'tired') get().say('tired');
      return;
    }
    const withD = withDiary(next, 'study');
    saveRaw(withD);
    set({
      pet: withD,
      anim: 'studying',
      burst: { id: ++burstSeq, kind: 'sparkle' },
    });
    get().say('study');
    setTimeout(() => {
      if (get().anim === 'studying') set({ anim: null });
    }, ANIM_MS.study);
    get().grantAchievements();
  },

  buyItem: (item) => {
    const pet = get().pet;
    if (!pet) return;
    // 已拥有则不重复扣钱
    if (item.accessory && pet.accessories.includes(item.accessory)) return;
    if (item.deco && pet.decoOwned.includes(item.deco)) return;
    if (item.variant && pet.variantOwned.includes(item.variant)) return;
    if (item.scene && pet.sceneOwned.includes(item.scene)) return;
    const { ok, next } = buyItem(pet, item, Date.now());
    if (!ok) return;
    let bought: PetState = next;
    if (item.accessory) {
      bought = { ...bought, accessories: [...bought.accessories, item.accessory], equippedAccessory: item.accessory };
    }
    if (item.deco) {
      bought = {
        ...bought,
        decoOwned: [...bought.decoOwned, item.deco],
        decorations: [...bought.decorations, item.deco].slice(0, 7),
      };
    }
    if (item.variant) {
      bought = {
        ...bought,
        variantOwned: [...bought.variantOwned, item.variant],
        variant: item.variant,
        customSkinId: undefined,
      };
    }
    if (item.scene) {
      bought = { ...bought, sceneOwned: [...bought.sceneOwned, item.scene], sceneId: item.scene };
    }
    saveRaw(bought);
    set({
      pet: bought,
      burst: { id: ++burstSeq, kind: item.cure || item.variant || item.scene ? 'sparkle' : 'heart' },
    });
    get().say('buy');
  },

  finishMinigame: (game, score) => {
    const pet = get().pet;
    const reward = minigameReward(score);
    if (!pet) return { ...reward, newBest: false };
    const now = Date.now();
    const { next: simmed } = simulate(pet, now);
    const prevBest = simmed.bests[game] ?? 0;
    const newBest = score > prevBest;
    const next: PetState = {
      ...simmed,
      coins: simmed.coins + reward.coins,
      mood: clamp01(simmed.mood + reward.mood),
      bests: { ...simmed.bests, [game]: Math.max(prevBest, score) },
      updatedAt: now,
    };
    const withGame = withDiary(next, 'game');
    const withBest = newBest ? withDiary(withGame, `best:${game}:${score}`) : withGame;
    saveRaw(withBest);
    set({ pet: withBest, burst: { id: ++burstSeq, kind: 'heart' } });
    const [great, ok] = TIER_CFG[game];
    const tier: LineKind = score >= great ? 'gameGreat' : score >= ok ? 'gameOk' : 'gameMeh';
    get().say(tier);
    get().grantAchievements();
    return { ...reward, newBest };
  },

  toggleSleep: () => {
    const pet = get().pet;
    if (!pet || pet.stage === 'egg' || !pet.alive) return;
    const now = Date.now();
    const { next } = simulate(pet, now);
    const sleeping = !next.sleeping;
    const final: PetState = { ...next, sleeping, updatedAt: now };
    saveRaw(final);
    set({ pet: final, anim: null });
    get().say(sleeping ? 'sleep' : 'wake');
  },

  tick: () => {
    const pet = get().pet;
    if (!pet || !pet.alive) return;
    // 多页面共存（独立页 + 壳内挂件）：另一页写入了明显更新的存档时直接采纳，
    // 避免双页各自衰减导致的重复消耗与 updatedAt 版本回退
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (text) {
        const remote = JSON.parse(text) as { saveVersion?: number; updatedAt?: number };
        if (remote?.saveVersion === 7 && (remote.updatedAt ?? 0) > pet.updatedAt + 2000) {
          const latest = loadRaw();
          if (latest) set({ pet: latest });
          return;
        }
      }
    } catch {
      /* 忽略坏数据，继续本页模拟 */
    }
    const now = Date.now();

    // 旅行状态机：归来结算（报告弹窗由页面依据 trip.status 渲染）
    if (pet.trip?.status === 'away') {
      if (now >= pet.trip.returnAt) {
        const { next: simmed } = simulate(pet, now);
        const returned = withDiary(processTripReturn(simmed, simmed.trip!, now), 'trip:' + simmed.trip!.dest);
        saveRaw(returned);
        set({ pet: returned });
        const ln = useLocale.getState().locale;
        notify(
          ln === 'zh' ? `🎒 ${returned.name}旅行归来` : '🎒 Back from a trip',
          ln === 'zh' ? '带回了照片和手信，快来看看！' : 'Photos and souvenirs await!'
        );
      }
      return; // 旅途中舞台展示出门告示
    }

    if (pet.stage === 'egg') {
      // 蛋不衰减，只推进时间戳（避免长时间挂蛋后回来误触发离线结算）
      if (now - pet.updatedAt > 60_000) {
        const next = { ...pet, updatedAt: now };
        saveRaw(next);
        set({ pet: next });
      }
      return;
    }
    const { next, events } = simulate(pet, now);
    saveRaw(next);
    set({ pet: next });
    if (get().anim) return;
    const kind = events[events.length - 1]?.kind;
    if (kind && EVENT_LINE[kind]) {
      if (kind === 'sick' || kind === 'recover' || kind === 'stageUp') {
        saveRaw(withDiary(next, kind));
        set({ pet: withDiary(next, kind) });
      }
      if (kind === 'sick') {
        const ln = useLocale.getState().locale;
        notify(ln === 'zh' ? '🤒 咕咕生病了' : '🤒 GuGu is sick', ln === 'zh' ? '快回来喂药照顾它！' : 'Come back and take care of it!');
      }
      get().say(EVENT_LINE[kind]!);
      return;
    }
    // 随机小事件：捡元宝 / 心情起伏（睡觉与生病时不出）
    if (!next.sleeping && !next.sick && Math.random() < RANDOM_EVENTS.chance) {
      const roll = Math.random();
      if (roll < 0.45) {
        const n =
          RANDOM_EVENTS.coinsMin +
          Math.floor(Math.random() * (RANDOM_EVENTS.coinsMax - RANDOM_EVENTS.coinsMin + 1));
        const evNext: PetState = { ...next, coins: next.coins + n };
        saveRaw(evNext);
        set({ pet: evNext });
        get().say('eventCoin', { n });
        return;
      }
      const delta = roll < 0.72 ? RANDOM_EVENTS.moodUp : -RANDOM_EVENTS.moodDown;
      const evNext: PetState = { ...next, mood: clamp01(next.mood + delta) };
      saveRaw(evNext);
      set({ pet: evNext });
      get().say(delta > 0 ? 'eventMoodUp' : 'eventMoodDown');
      return;
    }
    // 自主出门：状态好、距上次旅行 20 分钟以上、天气好、小概率（雨雪天咕咕宅家）
    const wToday = weatherFor(new Date());
    if (isBadWeather(wToday)) {
      if (!next.sleeping && Math.random() < 0.02) get().say(wToday === 'snow' ? 'weatherSnow' : 'weatherRain');
    } else if (canTravel(next) && now - (next.lastTripAt ?? 0) > 20 * 60_000 && Math.random() < 0.004) {
      const departed = departTrip(next, now);
      saveRaw(departed);
      set({ pet: departed });
      return;
    }
    // 偶发闲聊（睡觉时安静）；小概率插播时段问候或长按/右键菜单提示
    if (!next.sleeping && Math.random() < 0.07) {
      const roll = Math.random();
      const h = new Date().getHours();
      const greet = h >= 5 && h < 8 ? 'greetDawn' : h >= 8 && h < 17 ? 'greetDay' : h >= 17 && h < 20 ? 'greetDusk' : 'greetNight';
      if (roll < 0.12) get().say('hintMenu');
      else if (roll < 0.3) get().say(greet);
      else get().say('idle');
    }
    // 关怀：咕咕反过来关心用户（饭点/久坐/熬夜/疲劳，各自去重）
    if (!next.sleeping) {
      const decision = checkCare({
        hour: new Date().getHours(),
        date: new Date().toDateString(),
        sessionActiveMs: now - get().sessionStartAt,
        sinceInteractionMs: now - get().lastActivityAt,
        sent: get().careSent,
      });
      if (decision) {
        const sent = new Set(get().careSent);
        sent.add(decision.dedupeKey);
        persistCareSent(sent);
        set({ careSent: sent });
        const l = useLocale.getState().locale;
        const CARE_LINE: Record<string, LineKind> = { careMeal: 'careMeal', careRest: 'careRest', careNight: 'careNight', careFatigue: 'careFatigue' };
        const line = CARE_LINE[decision.kind];
        if (!line) return;
        if (decision.kind === 'mealBreakfast') {
          get().say(line, { m: l === 'zh' ? decision.mealZh ?? '' : decision.mealEn ?? '' });
        } else {
          get().say(line);
        }
        return;
      }
    }
    get().grantAchievements();
  },

  say: (kind, vars) => {
    const { pet, recentLines } = get();
    if (!pet) return;
    const locale = useLocale.getState().locale;
    const text = pickLine(kind, locale, {
      name: pet.name,
      personality: dominantPersonality(pet.personality),
      avoid: recentLines,
      vars,
    });
    set({
      bubble: { id: ++bubbleSeq, text, kind, sticker: pickSticker(kind) },
      recentLines: [text, ...recentLines].slice(0, 4),
    });
  },

  clearBubble: () => set({ bubble: null }),

  tutorialNext: () => {
    const pet = get().pet;
    if (!pet || pet.tutorialStep >= 3) return;
    const next = { ...pet, tutorialStep: pet.tutorialStep + 1 };
    saveRaw(next);
    set({ pet: next });
  },

  reset: () => {
    saveRaw(null);
    set({
      pet: null,
      anim: null,
      bubble: null,
      recentLines: [],
      tapStamps: [],
      chatMessages: [],
      chatFallbackUsed: false,
    });
  },

  setVariant: (variant) => {
    const pet = get().pet;
    if (!pet) return;
    if (!pet.variantOwned.includes(variant)) return; // 未购买配色不可切换
    const next = { ...pet, variant, customSkinId: undefined };
    saveRaw(next);
    set({ pet: next });
  },

  applySkin: (skinId) => {
    const pet = get().pet;
    if (!pet) return;
    const next: PetState = { ...pet };
    if (skinId) next.customSkinId = skinId;
    else delete next.customSkinId;
    saveRaw(next);
    set({ pet: next, burst: { id: ++burstSeq, kind: 'sparkle' } });
  },

  addCustomSkin: async (record) => {
    await saveSkinRecord(record);
    const list = await listSkinRecords().catch(() => [record]);
    set({ customSkins: list.sort((a, b) => b.createdAt - a.createdAt) });
    get().applySkin(record.id);
  },

  removeCustomSkin: async (skinId) => {
    await deleteSkinRecord(skinId).catch(() => {});
    const list = await listSkinRecords().catch(() => []);
    set({ customSkins: list.sort((a, b) => b.createdAt - a.createdAt) });
    if (get().pet?.customSkinId === skinId) get().applySkin(null);
  },

  resolvedSkin: () => {
    const { pet, customSkins } = get();
    if (!pet?.customSkinId) return null;
    const rec = customSkins.find((s) => s.id === pet.customSkinId);
    if (!rec) return null;
    const src = rec.imageDataUrl ?? rec.url;
    if (!src) return null;
    return { src, faceOverlay: rec.faceOverlay };
  },

  sendChat: async (text) => {
    const trimmed = text.trim();
    const pet = get().pet;
    if (!trimmed || !pet || get().chatBusy) return;
    const userMsg: ChatMsg = { role: 'user', text: trimmed };
    set({ chatMessages: [...get().chatMessages, userMsg], chatBusy: true });
    try {
      const settings = loadAiSettings();
      if (!aiReady(settings)) throw new Error('ai not configured');
      const locale = useLocale.getState().locale;
      const history = get()
        .chatMessages.slice(-12)
        .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.text }));
      const reply = await chatComplete(settings, [
        { role: 'system', content: buildSystemPrompt({ ...pet, dominantPersonality: dominantPersonality(pet.personality) }, locale) },
        ...history,
      ]);
      const cur = get().pet;
      if (cur) {
        const withChat: PetState = withDiary(
          { ...cur, counters: { ...cur.counters, aiChat: cur.counters.aiChat + 1 } },
          'chat'
        );
        saveRaw(withChat);
        set({ pet: withChat });
      }
      set({
        chatMessages: [...get().chatMessages, { role: 'gugu', text: reply }],
        chatBusy: false,
      });
      get().grantAchievements();
    } catch {
      // AI 不可用 → 本地台词兜底
      const locale = useLocale.getState().locale;
      const fallback = pickLine('idle', locale, {
        name: pet.name,
        personality: dominantPersonality(pet.personality),
        avoid: get().recentLines,
      });
      set({
        chatMessages: [...get().chatMessages, { role: 'gugu', text: fallback, fallback: true }],
        chatBusy: false,
        chatFallbackUsed: true,
      });
    }
  },

  clearChat: () => set({ chatMessages: [], chatFallbackUsed: false }),

  grantAchievements: () => {
    const pet = get().pet;
    if (!pet) return;
    const earned = checkAchievements(pet);
    if (!earned.length) return;
    const withD = earned.reduce((acc, id) => withDiary(acc, 'ach:' + (achievementById(id)?.zh ?? id)), pet);
    const next: PetState = { ...withD, achievements: [...withD.achievements, ...earned] };
    saveRaw(next);
    set({ pet: next, burst: { id: ++burstSeq, kind: 'sparkle' } });
    sfx.fanfare();
    const l2 = useLocale.getState().locale;
    notify(
      l2 === 'zh' ? `🏆 ${pet.name}解锁新成就` : '🏆 New achievement',
      l2 === 'zh' ? achievementById(earned[0])?.zh ?? '' : achievementById(earned[0])?.en ?? ''
    );
    const locale = useLocale.getState().locale;
    const def = achievementById(earned[0]);
    get().say('achUnlock', { a: def ? (locale === 'zh' ? def.zh : def.en) : earned[0] });
  },

  rename: (name) => {
    const pet = get().pet;
    if (!pet) return;
    const trimmed = name.trim().slice(0, 12);
    if (!trimmed) return;
    const next = { ...pet, name: trimmed };
    saveRaw(next);
    set({ pet: next });
  },

  exportBackup: () => {
    const pet = get().pet;
    if (!pet) return null;
    return { save: pet, skins: get().customSkins, exportedAt: Date.now() };
  },

  importBackup: async (data) => {
    try {
      const d = data as { save?: { saveVersion?: number } & Record<string, unknown>; skins?: CustomSkinRecord[] };
      const pet = d.save ? normalizeRaw(d.save) : null;
      if (!pet) return false;
      saveRaw(pet);
      for (const skin of d.skins ?? []) {
        await saveSkinRecord({ ...skin, id: skin.id || crypto.randomUUID() }).catch(() => {});
      }
      const list = await listSkinRecords().catch(() => []);
      set({ pet, customSkins: list.sort((a, b) => b.createdAt - a.createdAt) });
      return true;
    } catch {
      return false;
    }
  },

  setMode: (mode) => {
    const pet = get().pet;
    if (!pet) return;
    const next = { ...pet, mode };
    saveRaw(next);
    set({ pet: next });
  },

  equipAccessory: (id) => {
    const pet = get().pet;
    if (!pet) return;
    if (id && !pet.accessories.includes(id)) return;
    const next = { ...pet, equippedAccessory: id };
    saveRaw(next);
    set({ pet: next, burst: { id: ++burstSeq, kind: 'sparkle' } });
  },

  setScene: (id) => {
    const pet = get().pet;
    if (!pet) return;
    if (id && !pet.sceneOwned.includes(id)) return; // 未购买场景不可选择
    const next = { ...pet, sceneId: id };
    saveRaw(next);
    set({ pet: next });
  },

  toggleDecoration: (id) => {
    const pet = get().pet;
    if (!pet || !pet.decoOwned.includes(id)) return;
    const placed = pet.decorations.includes(id)
      ? pet.decorations.filter((d) => d !== id)
      : [...pet.decorations, id].slice(0, 7);
    const next = { ...pet, decorations: placed };
    saveRaw(next);
    set({ pet: next });
  },

  packProvision: (p) => {
    const pet = get().pet;
    if (!pet) return;
    const next = { ...pet, packedProvision: p };
    saveRaw(next);
    set({ pet: next, burst: { id: ++burstSeq, kind: 'sparkle' } });
  },

  dismissTrip: () => {
    const pet = get().pet;
    if (!pet?.trip) return;
    const next = { ...pet, trip: null };
    saveRaw(next);
    set({ pet: next });
  },

  pokeActivity: () => {
    set({ lastActivityAt: Date.now() });
  },
}));
