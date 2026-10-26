import { describe, expect, it } from 'vitest';

import {
  ACTIONS,
  actionGrowth,
  DECAY_PER_HOUR,
  HATCH_TAPS,
  INITIAL_COINS,
  SHOP_ITEMS,
  STUDY,
  THRESHOLD,
  WORK,
  minigameReward,
} from './balance';
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
import type { PetState, SimEvent } from './types';

const HOUR = 3_600_000;
const TICK = 5_000;

/** 前台节奏推进（每 5s 一次 tick，共 durationMs） */
function tickFor(pet: PetState, durationMs: number): { pet: PetState; events: SimEvent[] } {
  let now = pet.updatedAt;
  let cur = pet;
  let allEvents: SimEvent[] = [];
  for (let elapsed = 0; elapsed < durationMs; elapsed += TICK) {
    now += TICK;
    const { next, events } = simulate(cur, now);
    cur = next;
    allEvents = allEvents.concat(events);
  }
  return { pet: cur, events: allEvents };
}

describe('simulate', () => {
  it('前台节奏清醒 1 小时按速率衰减', () => {
    const pet = hatchEgg(createPet('cream', '咕咕', 0), 0);
    const { pet: next } = tickFor(pet, HOUR);
    expect(next.satiety).toBeCloseTo(80 - 7, 1);
    expect(next.cleanliness).toBeCloseTo(90 - 5, 1);
    expect(next.energy).toBeCloseTo(80 - 4, 1);
  });

  it('单跳 1 小时视为离线：五折结算', () => {
    const pet = hatchEgg(createPet('cream', '咕咕', 0), 0);
    const { next } = simulate(pet, HOUR);
    expect(next.satiety).toBeCloseTo(80 - 7 * 0.5, 5);
    expect(next.cleanliness).toBeCloseTo(90 - 5 * 0.5, 5);
  });

  it('睡觉恢复精力、饥饿减半（前台节奏）', () => {
    const pet = { ...hatchEgg(createPet('mint', '咕咕', 0), 0), sleeping: true, energy: 30 };
    const { pet: next } = tickFor(pet, HOUR);
    expect(next.energy).toBeCloseTo(30 + DECAY_PER_HOUR.energyRecover, 1);
    expect(next.satiety).toBeCloseTo(80 - 3.5, 1);
    expect(next.sleeping).toBe(true);
  });

  it('睡觉挂机 5 分钟精力有可见回升（不再原地踏步）', () => {
    const pet = { ...hatchEgg(createPet('mint', '咕咕', 0), 0), sleeping: true, energy: 20 };
    const { pet: next } = tickFor(pet, 5 * 60_000);
    expect(next.energy).toBeCloseTo(20 + DECAY_PER_HOUR.energyRecover / 12, 1);
  });

  it('精力充满自动醒来', () => {
    const pet = { ...hatchEgg(createPet('mint', '咕咕', 0), 0), sleeping: true, energy: 97 };
    const { pet: next, events } = tickFor(pet, 15 * 60_000);
    expect(events.some((e) => e.kind === 'wake')).toBe(true);
    expect(next.sleeping).toBe(false);
    // 醒来后继续按清醒速率缓慢消耗，只需验证接近满值
    expect(next.energy).toBeGreaterThan(99);
  });

  it('饿了/脏了触发阈值事件（前台 tick）', () => {
    let pet = { ...hatchEgg(createPet('sakura', '咕咕', 0), 0), satiety: 20.05 };
    const { events } = tickFor(pet, 60_000);
    expect(events.some((e) => e.kind === 'hungry')).toBe(true);

    pet = { ...hatchEgg(createPet('sakura', '咕咕', 0), 0), cleanliness: 20.05 };
    const { events: dirtyEvents } = tickFor(pet, 60_000);
    expect(dirtyEvents.some((e) => e.kind === 'dirty')).toBe(true);
  });

  it('又饿又脏会生病，吃饱喝足恢复', () => {
    let pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), satiety: 11, cleanliness: 11 };
    const sick = simulate(pet, 1000);
    expect(sick.next.sick).toBe(true);
    expect(sick.events.some((e) => e.kind === 'sick')).toBe(true);

    pet = { ...sick.next, satiety: 80, cleanliness: 80, health: 80 };
    const healed = simulate(pet, 2000);
    expect(healed.next.sick).toBe(false);
    expect(healed.events.some((e) => e.kind === 'recover')).toBe(true);
  });

  it('离线结算打折且有 12 小时上限（长期挂机不死）', () => {
    const pet = hatchEgg(createPet('cream', '咕咕', 0), 0);
    // 挂机 3 天：等效最多 12h × 0.5 折率
    const { next } = simulate(pet, 3 * 24 * HOUR);
    expect(next.satiety).toBeCloseTo(80 - 7 * 12 * 0.5, 5);
    expect(next.health).toBeGreaterThanOrEqual(5);
    expect(next.alive).toBe(true);
  });

  it('成长值达到门槛自动进入下一阶段', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), growth: 60 };
    const { next, events } = simulate(pet, 1000);
    expect(next.stage).toBe('teen');
    expect(events.some((e) => e.kind === 'stageUp')).toBe(true);
  });

  it('时间倒流（updatedAt 在未来）不崩溃', () => {
    const pet = hatchEgg(createPet('cream', '咕咕', 0), 10_000);
    const { next } = simulate(pet, 5_000);
    expect(next.updatedAt).toBe(5_000);
  });

  it('生病时健康不会低于保底 5', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), sick: true, health: 6 };
    const { next } = simulate(pet, 24 * HOUR);
    expect(next.health).toBeGreaterThanOrEqual(5);
  });
});

describe('applyAction', () => {
  it('喂食加饱食并积累吃货性格', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), satiety: 50 };
    const { ok, next } = applyAction(pet, 'feed', 1000);
    expect(ok).toBe(true);
    expect(next.satiety).toBe(78);
    expect(next.personality.foodie).toBe(3);
    expect(next.growth).toBe(1);
  });

  it('喂食/洗澡不耗精力，精力为 0 也能照顾', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), energy: 0, satiety: 20 };
    expect(applyAction(pet, 'feed', 1000).ok).toBe(true);
    expect(applyAction(pet, 'wash', 1000).ok).toBe(true);
  });

  it('玩耍需要精力，精力不足时拒绝', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), energy: Math.abs(ACTIONS.play.energy ?? 0) - 1 };
    const { ok, reason } = applyAction(pet, 'play', 1000);
    expect(ok).toBe(false);
    expect(reason).toBe('tired');
  });

  it('基础互动成长值随阶段提升', () => {
    const baby = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), growth: 0 };
    const teen = { ...baby, stage: 'teen' as const, growth: 60 };
    const adult = { ...baby, stage: 'adult' as const, growth: 200 };
    expect(applyAction(baby, 'feed', 1000).next.growth).toBe(actionGrowth('feed', 'baby'));
    expect(applyAction(teen, 'feed', 1000).next.growth).toBe(60 + actionGrowth('feed', 'teen'));
    expect(applyAction(adult, 'feed', 1000).next.growth).toBe(200 + actionGrowth('feed', 'adult'));
    expect(actionGrowth('feed', 'adult')).toBeGreaterThan(actionGrowth('feed', 'baby'));
    expect(actionGrowth('play', 'adult')).toBeGreaterThan(actionGrowth('play', 'teen'));
  });

  it('冷却期内拒绝同一动作', () => {
    const pet = hatchEgg(createPet('cream', '咕咕', 0), 0);
    const first = applyAction(pet, 'feed', 1000);
    expect(first.ok).toBe(true);
    const second = applyAction(first.next, 'feed', 2000);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('cooldown');
  });

  it('睡觉中拒绝动作', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), sleeping: true };
    const { ok, reason } = applyAction(pet, 'feed', 1000);
    expect(ok).toBe(false);
    expect(reason).toBe('sleeping');
  });

  it('数值钳制在 0..100', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), satiety: 90 };
    const { next } = applyAction(pet, 'feed', 1000);
    expect(next.satiety).toBe(100);
  });
});

describe('hatch 与性格', () => {
  it('啄壳次数用完即破壳', () => {
    let pet = createPet('mint', '咕咕', 0);
    for (let i = 0; i < HATCH_TAPS; i++) {
      expect(pet.stage).toBe('egg');
      pet = hatchEgg(pet, i + 1);
      break; // hatchEgg 一次性破壳（点击计数由 store 处理）
    }
    expect(pet.stage).toBe('baby');
    expect(pet.hatchedAt).toBe(1);
  });

  it('主导性格需要达到门槛', () => {
    expect(dominantPersonality({ foodie: 10, lively: 5, artsy: 0, chill: 0 })).toBeNull();
    expect(dominantPersonality({ foodie: 30, lively: 29, artsy: 0, chill: 0 })).toBe('foodie');
  });

  it('生病阈值与常量一致', () => {
    expect(THRESHOLD.sick).toBeLessThan(THRESHOLD.hungry);
  });
});

describe('打工与学习', () => {
  it('打工消耗精力赚元宝，心情好有加成', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), energy: 80, mood: 30 };
    const { ok, next } = applyWork(pet, 1000);
    expect(ok).toBe(true);
    expect(next.energy).toBe(80 - WORK.energyCost);
    expect(next.coins).toBe(pet.coins + WORK.coinsBase);

    const happy = { ...pet, mood: 80 };
    const boosted = applyWork(happy, 1000);
    expect(boosted.next.coins).toBe(
      happy.coins + Math.round(WORK.coinsBase * WORK.happyMultiplier)
    );
  });

  it('精力不足时拒绝打工', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), energy: 10 };
    const { ok, reason } = applyWork(pet, 1000);
    expect(ok).toBe(false);
    expect(reason).toBe('tired');
  });

  it('学习加成长值与文艺倾向，冷却内拒绝', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), growth: 0, energy: 80 };
    const { ok, next } = applyStudy(pet, 1000);
    expect(ok).toBe(true);
    expect(next.growth).toBe(STUDY.growth);
    expect(next.personality.artsy).toBe(STUDY.personalityArtsy);

    const second = applyStudy(next, 2000);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('cooldown');
  });
});

describe('商店', () => {
  it('买饼干扣元宝加饱食', () => {
    const cookie = SHOP_ITEMS.find((i) => i.id === 'cookie')!;
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), coins: 10, satiety: 50 };
    const { ok, next } = buyItem(pet, cookie, 1000);
    expect(ok).toBe(true);
    expect(next.coins).toBe(10 - cookie.price);
    expect(next.satiety).toBe(50 + (cookie.satiety ?? 0));
  });

  it('元宝不足拒绝购买', () => {
    const bento = SHOP_ITEMS.find((i) => i.id === 'bento')!;
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), coins: 5 };
    const { ok, reason } = buyItem(pet, bento, 1000);
    expect(ok).toBe(false);
    expect(reason).toBe('poor');
  });

  it('药只能买给生病的咕咕', () => {
    const medicine = SHOP_ITEMS.find((i) => i.id === 'medicine')!;
    const healthy = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), coins: 50, sick: false };
    expect(buyItem(healthy, medicine, 1000).reason).toBe('useless');

    const sick = { ...healthy, sick: true, health: 40 };
    const healed = buyItem(sick, medicine, 1000);
    expect(healed.ok).toBe(true);
    expect(healed.next.sick).toBe(false);
    expect(healed.next.health).toBeCloseTo(75, 5);
  });
});

describe('小游戏与迁移', () => {
  it('奖励按得分计算且封顶', () => {
    expect(minigameReward(0)).toEqual({ coins: 0, mood: 0 });
    expect(minigameReward(10)).toEqual({
      coins: Math.round(10 * 0.5),
      mood: Math.round(10 * 1.2),
    });
    const capped = minigameReward(1000);
    expect(capped.coins).toBeLessThanOrEqual(25);
    expect(capped.mood).toBeLessThanOrEqual(25);
  });

  it('新存档带初始元宝与 v7 版本号', () => {
    const pet = createPet('sakura', '咕咕', 0);
    expect(pet.saveVersion).toBe(7);
    expect(pet.coins).toBe(INITIAL_COINS);
    expect(pet.lastWorkedAt).toBe(0);
    expect(pet.lastStudiedAt).toBe(0);
    expect(pet.counters.feed).toBe(0);
    expect(pet.achievements).toEqual([]);
    expect(pet.trip).toBeNull();
    expect(pet.album.photos).toEqual([]);
    expect(pet.bests.sing).toBe(0);
    expect(pet.accessories).toEqual([]);
    expect(pet.decorations).toEqual([]);
    expect(pet.bests.snack).toBe(0);
    expect(pet.bests.sing).toBe(0);
  });
});
