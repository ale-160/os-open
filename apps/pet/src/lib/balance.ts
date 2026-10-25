/**
 * 数值平衡表 —— 所有手感的唯一出处，调参只改这里。
 *
 * 设计基准（无限养成、真实时间流逝）：
 * - 清醒时不喂食，饱食约 14 小时耗尽；全部挂机约 2 天进入"生病"边缘
 * - 睡觉回精力，约 7 小时充满；离线结算打 5 折且最多按 12 小时计（宽容）
 */

import type { ActionId, GrowthStage, PersonalityKey, ShopItem } from './types';

/** 每小时衰减/恢复速率 */
export const DECAY_PER_HOUR = {
  /** 饱食（清醒） */
  satiety: 7,
  /** 饱食（睡觉，消耗减半） */
  satietyAsleep: 3.5,
  /** 清洁 */
  cleanliness: 5,
  /** 心情基础 */
  mood: 3,
  /** 饥饿或脏污时的心情额外消耗 */
  moodDistress: 2.5,
  /** 精力（清醒） */
  energyAwake: 4,
  /** 精力（睡觉恢复） */
  energyRecover: 14,
  /** 生病时健康消耗 */
  healthSick: 6,
  /** 状态良好时健康回复 */
  healthRegen: 1.5,
  /** 状态糟糕（饿/脏）时健康缓慢消耗 */
  healthPoor: 1,
  /** 状态全优（>60）时被动成长 */
  passiveGrowth: 0.8,
} as const;

/** 离线结算：速率折扣与最长结算时长 */
export const OFFLINE = {
  /** 超过该毫秒数视为"离开过"（走离线折扣） */
  thresholdMs: 2 * 60 * 1000,
  rate: 0.5,
  capHours: 12,
} as const;

/** 状态阈值 */
export const THRESHOLD = {
  hungry: 20,
  dirty: 20,
  sleepy: 18,
  /** 饿+脏同时低于该值 → 生病 */
  sick: 12,
  /** 生病恢复条件 */
  recover: 40,
  /** 心情高/低的表现分界（表情用） */
  happyFace: 70,
  sadFace: 30,
} as const;

/** 成长阶段门槛（成长值） */
export const STAGE_THRESHOLDS: Record<GrowthStage, number> = {
  egg: 0,
  baby: 0,
  teen: 60,
  adult: 200,
};

export const STAGE_ORDER: GrowthStage[] = ['egg', 'baby', 'teen', 'adult'];

/** 照顾动作效果（即时生效） */
export interface ActionDef {
  id: ActionId;
  /** 冷却毫秒 */
  cooldownMs: number;
  /** 动作演出时长毫秒（anim 状态保持） */
  animMs: number;
  satiety?: number;
  cleanliness?: number;
  mood?: number;
  energy?: number;
  growth?: number;
  personality?: Partial<Record<PersonalityKey, number>>;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  feed: {
    id: 'feed',
    cooldownMs: 45_000,
    animMs: 2_400,
    satiety: 28,
    mood: 2,
    energy: -1,
    growth: 1,
    personality: { foodie: 3 },
  },
  wash: {
    id: 'wash',
    cooldownMs: 90_000,
    animMs: 2_800,
    cleanliness: 100,
    mood: 2,
    energy: -2,
    growth: 1,
    personality: { chill: 2 },
  },
  play: {
    id: 'play',
    cooldownMs: 60_000,
    animMs: 3_200,
    mood: 16,
    energy: -8,
    satiety: -3,
    cleanliness: -4,
    growth: 2,
    personality: { lively: 4 },
  },
};

/** 摸摸头（点击咕咕）恢复心情与冷却上限 */
export const PET_TAP = {
  mood: 1.5,
  /** 每分钟内最多生效的摸摸次数 */
  maxPerMinute: 6,
} as const;

/** 蛋阶段：啄壳次数 */
export const HATCH_TAPS = 5;

/** 初始元宝（破壳时携带） */
export const INITIAL_COINS = 20;

/** 打工：赚元宝，耗精力 */
export const WORK = {
  cooldownMs: 5 * 60_000,
  energyCost: 30,
  coinsBase: 14,
  /** 心情 > 阈值时的加成倍率 */
  happyThreshold: 60,
  happyMultiplier: 1.5,
  animMs: 3_000,
} as const;

/** 学习：耗精力换成长值与文艺性格 */
export const STUDY = {
  cooldownMs: 3 * 60_000,
  energyCost: 20,
  growth: 5,
  personalityArtsy: 3,
  animMs: 3_200,
} as const;

/** 商店（买即用，无库存） */
export const SHOP_ITEMS: ShopItem[] = [
  { id: 'cookie', icon: '🍪', zh: '小饼干', en: 'Cookie', price: 3, satiety: 22 },
  { id: 'cake', icon: '🍰', zh: '奶油蛋糕', en: 'Cake', price: 8, satiety: 45, mood: 3 },
  { id: 'bento', icon: '🍱', zh: '元气便当', en: 'Bento', price: 15, satiety: 100, health: 10 },
  { id: 'soap', icon: '🧼', zh: '香香皂', en: 'Soap', price: 5, cleanliness: 100, mood: 1 },
  { id: 'balloon', icon: '🎈', zh: '气球', en: 'Balloon', price: 4, mood: 18 },
  { id: 'medicine', icon: '💊', zh: '感冒药', en: 'Medicine', price: 12, cure: true, health: 35 },
  // 第 6 批季节道具
  { id: 'snow-cone', icon: '🍧', zh: '雪花冰沙', en: 'Snow Cone', price: 14, satiety: 18, mood: 6 },
  { id: 'strawberry-daifuku', icon: '🍓', zh: '草莓大福', en: 'Strawberry Daifuku', price: 18, satiety: 22, mood: 5 },
  { id: 'honey-toast', icon: '🍞', zh: '蜂蜜吐司', en: 'Honey Toast', price: 16, satiety: 20, energy: 5 },
  { id: 'peach-soda', icon: '🥤', zh: '蜜桃汽水', en: 'Peach Soda', price: 15, mood: 10, energy: 5 },
  { id: 'pumpkin-pie', icon: '🥧', zh: '南瓜派', en: 'Pumpkin Pie', price: 20, satiety: 24, mood: 4 },
  { id: 'chestnut-cake', icon: '🌰', zh: '栗子蛋糕', en: 'Chestnut Cake', price: 22, satiety: 20, mood: 8 },
  { id: 'ginger-tea', icon: '🍵', zh: '姜茶', en: 'Ginger Tea', price: 18, mood: 4, health: 6 },
  { id: 'snowman-cookie', icon: '⛄', zh: '雪人饼干', en: 'Snowman Cookie', price: 14, satiety: 16, mood: 7 },
  { id: 'sakura-mochi', icon: '🌸', zh: '樱花麻糬', en: 'Sakura Mochi', price: 16, satiety: 18, mood: 6 },
  { id: 'sunflower-seeds', icon: '🌻', zh: '向日葵瓜子', en: 'Sunflower Seeds', price: 8, satiety: 10, mood: 3 },
  { id: 'ocean-smoothie', icon: '🌊', zh: '海洋奶昔', en: 'Ocean Smoothie', price: 20, satiety: 20, energy: 8 },
  { id: 'wish-star-candy', icon: '⭐', zh: '许愿星糖', en: 'Wish Star Candy', price: 12, mood: 8, energy: 4 },
];

/** 接点心小游戏 */
export const MINIGAME = {
  durationMs: 30_000,
  /** 每分奖励 */
  coinsPerPoint: 0.5,
  moodPerPoint: 1.2,
  /** 单局奖励上限 */
  maxCoins: 25,
  maxMood: 25,
  /** 障碍物（接到扣分）概率 */
  bombRate: 0.12,
  fallSpeedStart: 32, // %/s
  fallSpeedEnd: 58,
  spawnIntervalStart: 900, // ms
  spawnIntervalEnd: 480,
} as const;

/** 随机小事件（在线 tick 概率触发） */
export const RANDOM_EVENTS = {
  /** 每次 tick 概率 */
  chance: 0.008,
  coinsMin: 3,
  coinsMax: 8,
  moodUp: 5,
  moodDown: 5,
} as const;

/** 性格积累上限（各维度 0..100） */
export const PERSONALITY_CAP = 100;

/** 成为"主导性格"的最低积累 */
export const PERSONALITY_DOMINANT_MIN = 25;

export const clamp01 = (v: number) => Math.min(100, Math.max(0, v));

/** 打工/学习/照顾动作统一的冷却查询 id */
export type CareActionId = ActionId | 'work' | 'study';

/** 各动作冷却（ms） */
export const COOLDOWNS: Record<CareActionId, number> = {
  feed: ACTIONS.feed.cooldownMs,
  wash: ACTIONS.wash.cooldownMs,
  play: ACTIONS.play.cooldownMs,
  work: WORK.cooldownMs,
  study: STUDY.cooldownMs,
};

/** 冷却剩余毫秒（时间戳 0 表示从未做过，视为无冷却） */
export function cooldownRemaining(action: CareActionId, state: { lastFedAt: number; lastWashedAt: number; lastPlayedAt: number; lastWorkedAt: number; lastStudiedAt: number }, now: number): number {
  const last =
    action === 'feed'
      ? state.lastFedAt
      : action === 'wash'
        ? state.lastWashedAt
        : action === 'play'
          ? state.lastPlayedAt
          : action === 'work'
            ? state.lastWorkedAt
            : state.lastStudiedAt;
  if (!last) return 0;
  return Math.max(0, COOLDOWNS[action] - (now - last));
}

/** 小游戏得分 → 奖励（封顶） */
export function minigameReward(score: number): { coins: number; mood: number } {
  const coins = Math.min(MINIGAME.maxCoins, Math.round(score * MINIGAME.coinsPerPoint));
  const mood = Math.min(MINIGAME.maxMood, Math.round(score * MINIGAME.moodPerPoint));
  return { coins, mood };
}
