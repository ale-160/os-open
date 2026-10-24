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
  ActionId,
  ActivityState,
  BurstData,
  GameBests,
  GameKind,
  PetCounters,
  PetState,
  ShopItem,
  SimEventKind,
  VariantId,
} from './types';

const STORAGE_KEY = 'ale-pet-save';
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
const ZERO_BESTS: GameBests = { snack: 0, whack: 0, memory: 0, race: 0, toss: 0, sing: 0 };

interface BubbleData {
  id: number;
  text: string;
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
}

/** v1 → v4 迁移：补元宝、冷却、成就系统与逐游戏最高分 */
function migrateV1(raw: Record<string, unknown>): PetState {
  return {
    ...(raw as unknown as PetState),
    saveVersion: 4,
    coins: INITIAL_COINS,
    lastWorkedAt: 0,
    lastStudiedAt: 0,
    counters: { ...ZERO_COUNTERS },
    bests: { ...ZERO_BESTS },
    achievements: [],
  };
}

/** v2 → v4 迁移：补成就系统与逐游戏最高分 */
function migrateV2(raw: Record<string, unknown>): PetState {
  return {
    ...(raw as unknown as PetState),
    saveVersion: 4,
    counters: { ...ZERO_COUNTERS },
    bests: { ...ZERO_BESTS },
    achievements: [],
  };
}

/** v3 → v4 迁移：共享最高分拆分为逐游戏最高分（接点心继承旧值） */
function migrateV3(raw: Record<string, unknown>): PetState {
  const legacyCounters = (raw.counters ?? {}) as Partial<PetCounters> & { minigameBest?: number };
  const { minigameBest = 0, ...restCounters } = legacyCounters;
  return {
    ...(raw as unknown as PetState),
    saveVersion: 4,
    counters: { ...ZERO_COUNTERS, ...restCounters },
    bests: { ...ZERO_BESTS, snack: minigameBest },
    achievements: Array.isArray(raw.achievements) ? (raw.achievements as string[]) : [],
  };
}

function normalizeRaw(parsed: { saveVersion?: number } & Record<string, unknown>): PetState | null {
  if (parsed.saveVersion === 1) return migrateV1(parsed);
  if (parsed.saveVersion === 2) return migrateV2(parsed);
  if (parsed.saveVersion === 3) return migrateV3(parsed);
  if (parsed.saveVersion !== 4 || typeof parsed.updatedAt !== 'number') return null;
  return parsed as unknown as PetState;
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
};

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

  init: () => {
    if (get().ready || typeof window === 'undefined') return;
    const raw = loadRaw();
    if (raw) {
      const now = Date.now();
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
          ...next,
          lastCheckinDate: today,
          checkinStreak: streak,
          coins: next.coins + 10,
        };
        saveRaw(checkinNext);
        set({ pet: checkinNext });
        get().say('checkin', { n: 10, s: streak });
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
        const remotePet =
          remote.saveVersion === 1
            ? migrateV1(remote)
            : remote.saveVersion === 2
              ? migrateV2(remote)
              : remote.saveVersion === 3
                ? migrateV3(remote)
                : (remote as unknown as PetState);
        if (
          remotePet?.saveVersion === 4 &&
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
    const next = hatchEgg(pet, Date.now());
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
    saveRaw(next);
    const anim = ACTION_ANIM[id];
    set({
      pet: next,
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
    saveRaw(next);
    set({
      pet: next,
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
    saveRaw(next);
    set({
      pet: next,
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
    const { ok, next } = buyItem(pet, item, Date.now());
    if (!ok) return;
    saveRaw(next);
    set({
      pet: next,
      burst: { id: ++burstSeq, kind: item.cure ? 'sparkle' : 'heart' },
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
    saveRaw(next);
    set({ pet: next, burst: { id: ++burstSeq, kind: 'heart' } });
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
        if (remote?.saveVersion === 2 && (remote.updatedAt ?? 0) > pet.updatedAt + 2000) {
          const latest = loadRaw();
          if (latest) set({ pet: latest });
          return;
        }
      }
    } catch {
      /* 忽略坏数据，继续本页模拟 */
    }
    const now = Date.now();
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
    // 偶发闲聊（睡觉时安静）；小概率插播时段问候或长按/右键菜单提示
    if (!next.sleeping && Math.random() < 0.07) {
      const roll = Math.random();
      const h = new Date().getHours();
      const greet = h >= 5 && h < 8 ? 'greetDawn' : h >= 8 && h < 17 ? 'greetDay' : h >= 17 && h < 20 ? 'greetDusk' : 'greetNight';
      if (roll < 0.12) get().say('hintMenu');
      else if (roll < 0.3) get().say(greet);
      else get().say('idle');
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
      bubble: { id: ++bubbleSeq, text },
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
        const withChat: PetState = {
          ...cur,
          counters: { ...cur.counters, aiChat: cur.counters.aiChat + 1 },
        };
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
    const next: PetState = { ...pet, achievements: [...pet.achievements, ...earned] };
    saveRaw(next);
    set({ pet: next, burst: { id: ++burstSeq, kind: 'sparkle' } });
    sfx.fanfare();
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
}));
