/**
 * 咕咕模拟器 —— 全部为纯函数，便于单测与离线结算。
 * 时间推进只发生在 simulate()；动作只改瞬时数值，推进交给下一次 simulate。
 */

import {
  ACTIONS,
  clamp01,
  cooldownRemaining,
  DECAY_PER_HOUR,
  HATCH_TAPS,
  INITIAL_COINS,
  OFFLINE,
  PERSONALITY_CAP,
  PERSONALITY_DOMINANT_MIN,
  STAGE_ORDER,
  STAGE_THRESHOLDS,
  STUDY,
  THRESHOLD,
  WORK,
} from './balance';
import type {
  ActionId,
  ActionOutcome,
  PersonalityKey,
  PetState,
  ShopItem,
  SimEvent,
  SimResult,
  VariantId,
} from './types';

const MS_PER_HOUR = 3_600_000;

/** 领养：创建蛋状态 */
export function createPet(variant: VariantId, name: string, now: number): PetState {
  return {
    saveVersion: 7,
    name: name.trim() || '咕咕',
    variant,
    stage: 'egg',
    bornAt: now,
    hatchedAt: 0,
    updatedAt: now,
    satiety: 80,
    cleanliness: 90,
    mood: 70,
    energy: 80,
    health: 100,
    growth: 0,
    coins: INITIAL_COINS,
    personality: { foodie: 0, lively: 0, artsy: 0, chill: 0 },
    counters: { feed: 0, wash: 0, play: 0, work: 0, study: 0, tap: 0, heal: 0, aiChat: 0 },
    bests: { snack: 0, whack: 0, memory: 0, race: 0, toss: 0, sing: 0, lianliankan: 0, match3: 0, monopoly: 0, merge: 0 },
    trip: null,
    album: { photos: [], souvenirs: [] },
    diary: {},
    accessories: [],
    equippedAccessory: null,
    decoOwned: [],
    decorations: [],
    variantOwned: [variant],
    sceneOwned: [],
    achievements: [],
    sleeping: false,
    sick: false,
    alive: true,
    mode: 'casual',
    tapsToHatch: HATCH_TAPS,
    lastFedAt: 0,
    lastWashedAt: 0,
    lastPlayedAt: 0,
    lastWorkedAt: 0,
    lastStudiedAt: 0,
    tutorialStep: 0,
  };
}

/** 破壳 */
export function hatchEgg(prev: PetState, now: number): PetState {
  return { ...prev, stage: 'baby', tapsToHatch: 0, hatchedAt: now, mood: clamp01(prev.mood + 10) };
}

/**
 * 时间推进：数值衰减/恢复、生病判定、睡觉、成长阶段。
 * - 超过 OFFLINE.thresholdMs 视为离线：速率打 OFFLINE.rate 折，且最多按 OFFLINE.capHours 结算（宽容设计，
 *   长期挂机不会惨死）；阈值事件（饿了/脏了）只在在线 tick 中触发，离线统一由"回来啦"事件代述。
 */
export function simulate(prev: PetState, now: number): SimResult {
  const events: SimEvent[] = [];
  if (!prev.alive) return { next: prev, events };

  const elapsedMs = Math.max(0, now - prev.updatedAt);
  if (elapsedMs === 0) return { next: prev, events };

  const away = elapsedMs > OFFLINE.thresholdMs;
  const rawHours = elapsedMs / MS_PER_HOUR;
  const hours =
    Math.min(rawHours, away ? OFFLINE.capHours : Number.POSITIVE_INFINITY) *
    (away ? OFFLINE.rate : 1);

  const s: PetState = { ...prev, personality: { ...prev.personality } };
  const cross = (
    was: number,
    value: number,
    threshold: number,
    kind: SimEvent['kind']
  ) => {
    if (!away && !s.sleeping && was >= threshold && value < threshold) {
      events.push({ kind, at: now });
    }
  };

  const wasSatiety = s.satiety;
  const wasCleanliness = s.cleanliness;
  const wasEnergy = s.energy;

  if (s.sleeping) {
    s.satiety = clamp01(s.satiety - DECAY_PER_HOUR.satietyAsleep * hours);
    s.energy = clamp01(s.energy + DECAY_PER_HOUR.energyRecover * hours);
    s.mood = clamp01(s.mood - DECAY_PER_HOUR.mood * 0.5 * hours);
    if (s.energy >= 100) {
      s.sleeping = false;
      events.push({ kind: 'wake', at: now });
    }
  } else {
    s.satiety = clamp01(s.satiety - DECAY_PER_HOUR.satiety * hours);
    s.cleanliness = clamp01(s.cleanliness - DECAY_PER_HOUR.cleanliness * hours);
    s.energy = clamp01(s.energy - DECAY_PER_HOUR.energyAwake * hours);
    const distress =
      (s.satiety < THRESHOLD.hungry ? DECAY_PER_HOUR.moodDistress : 0) +
      (s.cleanliness < THRESHOLD.dirty ? DECAY_PER_HOUR.moodDistress : 0);
    s.mood = clamp01(s.mood - (DECAY_PER_HOUR.mood + distress) * hours);
  }

  cross(wasSatiety, s.satiety, THRESHOLD.hungry, 'hungry');
  cross(wasCleanliness, s.cleanliness, THRESHOLD.dirty, 'dirty');
  if (!away && !s.sleeping && wasEnergy >= THRESHOLD.sleepy && s.energy < THRESHOLD.sleepy) {
    events.push({ kind: 'sleepy', at: now });
  }

  // 生病：又饿又脏；痊愈：吃饱喝足干净
  if (!s.sick && s.satiety < THRESHOLD.sick && s.cleanliness < THRESHOLD.sick) {
    s.sick = true;
    events.push({ kind: 'sick', at: now });
  } else if (
    s.sick &&
    s.satiety >= THRESHOLD.recover &&
    s.cleanliness >= THRESHOLD.recover &&
    s.health >= 50
  ) {
    s.sick = false;
    s.counters = { ...s.counters, heal: s.counters.heal + 1 };
    events.push({ kind: 'recover', at: now });
  }

  // 健康：生病掉、良好回、糟糕缓降；休闲模式保底 5，经典模式无保底（归零离世）
  const floorHealth = s.mode === 'classic' ? 0 : 5;
  if (s.sick) {
    s.health = Math.max(floorHealth, s.health - DECAY_PER_HOUR.healthSick * hours);
  } else if (s.satiety > 30 && s.cleanliness > 30) {
    s.health = clamp01(s.health + DECAY_PER_HOUR.healthRegen * hours);
  } else {
    s.health = Math.max(floorHealth, s.health - DECAY_PER_HOUR.healthPoor * hours);
  }
  if (s.mode === 'classic' && s.health <= 0) {
    s.alive = false;
    events.push({ kind: 'dead', at: now });
  }

  // 被动成长：状态全优时缓慢增加
  if (
    s.stage !== 'egg' &&
    !s.sick &&
    s.satiety > 60 &&
    s.cleanliness > 60 &&
    s.mood > 60 &&
    s.health > 60
  ) {
    s.growth += DECAY_PER_HOUR.passiveGrowth * hours;
  }

  // 阶段提升（蛋 → 幼年由破壳触发，这里只处理后续）
  const stageIdx = STAGE_ORDER.indexOf(s.stage);
  const nextStage = STAGE_ORDER[stageIdx + 1];
  if (nextStage && s.growth >= STAGE_THRESHOLDS[nextStage]) {
    s.stage = nextStage;
    events.push({ kind: 'stageUp', at: now });
  }

  s.updatedAt = now;
  return { next: s, events };
}

/** 应用照顾动作（含冷却校验） */
export function applyAction(prev: PetState, id: ActionId, now: number): ActionOutcome {
  if (!prev.alive) return { ok: false, next: prev, reason: 'dead' };
  if (prev.sleeping) return { ok: false, next: prev, reason: 'sleeping' };

  const def = ACTIONS[id];
  if (cooldownRemaining(id, prev, now) > 0) return { ok: false, next: prev, reason: 'cooldown' };

  const next: PetState = { ...prev, personality: { ...prev.personality }, counters: { ...prev.counters } };
  if (def.satiety !== undefined) next.satiety = clamp01(next.satiety + def.satiety);
  if (def.cleanliness !== undefined) next.cleanliness = clamp01(next.cleanliness + def.cleanliness);
  if (def.mood !== undefined) next.mood = clamp01(next.mood + def.mood);
  if (def.energy !== undefined) next.energy = clamp01(next.energy + def.energy);
  if (def.growth !== undefined) next.growth += def.growth;
  if (def.personality) {
    for (const [k, v] of Object.entries(def.personality)) {
      const key = k as PersonalityKey;
      next.personality[key] = Math.min(
        PERSONALITY_CAP,
        next.personality[key] + (v ?? 0)
      );
    }
  }
  if (id === 'feed') {
    next.counters.feed += 1;
    next.lastFedAt = now;
  }
  if (id === 'wash') {
    next.counters.wash += 1;
    next.lastWashedAt = now;
  }
  if (id === 'play') {
    next.counters.play += 1;
    next.lastPlayedAt = now;
  }
  next.updatedAt = now;

  return { ok: true, next };
}

/** 打工：耗精力赚元宝，心情好有加成 */
export function applyWork(prev: PetState, now: number): ActionOutcome {
  if (!prev.alive) return { ok: false, next: prev, reason: 'dead' };
  if (prev.sleeping) return { ok: false, next: prev, reason: 'sleeping' };
  if (cooldownRemaining('work', prev, now) > 0) return { ok: false, next: prev, reason: 'cooldown' };
  if (prev.energy < WORK.energyCost) return { ok: false, next: prev, reason: 'tired' };

  const base = WORK.coinsBase;
  const earned = Math.round(
    prev.mood > WORK.happyThreshold ? base * WORK.happyMultiplier : base
  );
  const next: PetState = {
    ...prev,
    energy: clamp01(prev.energy - WORK.energyCost),
    coins: prev.coins + earned,
    mood: clamp01(prev.mood + 1),
    cleanliness: clamp01(prev.cleanliness - 2),
    counters: { ...prev.counters, work: prev.counters.work + 1 },
    lastWorkedAt: now,
    updatedAt: now,
  };
  return { ok: true, next };
}

/** 学习：耗精力换成长值与文艺倾向 */
export function applyStudy(prev: PetState, now: number): ActionOutcome {
  if (!prev.alive) return { ok: false, next: prev, reason: 'dead' };
  if (prev.sleeping) return { ok: false, next: prev, reason: 'sleeping' };
  if (cooldownRemaining('study', prev, now) > 0) return { ok: false, next: prev, reason: 'cooldown' };
  if (prev.energy < STUDY.energyCost) return { ok: false, next: prev, reason: 'tired' };

  const next: PetState = {
    ...prev,
    personality: { ...prev.personality, artsy: Math.min(PERSONALITY_CAP, prev.personality.artsy + STUDY.personalityArtsy) },
    counters: { ...prev.counters, study: prev.counters.study + 1 },
    energy: clamp01(prev.energy - STUDY.energyCost),
    growth: prev.growth + STUDY.growth,
    lastStudiedAt: now,
    updatedAt: now,
  };
  return { ok: true, next };
}

/** 商店购买（买即用）；用品当前用不上时拒绝（如没生病买药） */
export function buyItem(prev: PetState, item: ShopItem, now: number): ActionOutcome {
  if (!prev.alive) return { ok: false, next: prev, reason: 'dead' };
  if (prev.coins < item.price) return { ok: false, next: prev, reason: 'poor' };
  if (item.cure && !prev.sick) return { ok: false, next: prev, reason: 'useless' };

  const next: PetState = { ...prev, personality: { ...prev.personality } };
  next.coins = prev.coins - item.price;
  if (item.satiety !== undefined) next.satiety = clamp01(next.satiety + item.satiety);
  if (item.cleanliness !== undefined) next.cleanliness = clamp01(next.cleanliness + item.cleanliness);
  if (item.mood !== undefined) next.mood = clamp01(next.mood + item.mood);
  if (item.health !== undefined) next.health = clamp01(next.health + item.health);
  if (item.energy !== undefined) next.energy = clamp01(next.energy + item.energy);
  if (item.cure) next.sick = false;
  next.updatedAt = now;
  return { ok: true, next };
}

/** 主导性格（达到门槛的最高分；无则 null） */
export function dominantPersonality(p: Record<PersonalityKey, number>): PersonalityKey | null {
  let best: PersonalityKey | null = null;
  let bestV = 0;
  (Object.keys(p) as PersonalityKey[]).forEach((k) => {
    if (p[k] > bestV) {
      best = k;
      bestV = p[k];
    }
  });
  return bestV >= PERSONALITY_DOMINANT_MIN ? best : null;
}

/** 到下一阶段所需成长值（null = 已满级） */
export function nextStageGap(stage: GrowthStageLike, growth: number): number | null {
  const idx = STAGE_ORDER.indexOf(stage);
  const nextStage = STAGE_ORDER[idx + 1];
  if (!nextStage) return null;
  return Math.max(0, STAGE_THRESHOLDS[nextStage] - growth);
}

type GrowthStageLike = PetState['stage'];
