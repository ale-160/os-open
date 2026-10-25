import { describe, expect, it } from 'vitest';

import { ACHIEVEMENTS, achievementById, checkAchievements } from './achievements';
import { applyAction, applyStudy, applyWork, createPet, hatchEgg, simulate } from './sim';

describe('成就定义', () => {
  it('id 唯一', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('按 id 可查', () => {
    expect(achievementById('feed10')?.zh).toBe('按时开饭');
    expect(achievementById('nope')).toBeUndefined();
  });
});

describe('checkAchievements', () => {
  it('蛋阶段只有 0 项新解锁', () => {
    const pet = createPet('cream', '咕咕', 0);
    expect(checkAchievements(pet)).toEqual([]);
  });

  it('破壳解锁 hatch，且不重复', () => {
    let pet = hatchEgg(createPet('cream', '咕咕', 0), 1000);
    expect(checkAchievements(pet)).toEqual(['hatch']);
    pet = { ...pet, achievements: ['hatch'] };
    expect(checkAchievements(pet)).toEqual([]);
  });

  it('喂食 10 次解锁，9 次不行', () => {
    let pet = hatchEgg(createPet('cream', '咕咕', 0), 0);
    for (let i = 0; i < 9; i++) {
      pet = applyAction(pet, 'feed', (i + 1) * 60_000).next;
    }
    expect(checkAchievements(pet)).toEqual([]);
    pet = applyAction(pet, 'feed', 10 * 60_000).next;
    expect(pet.counters.feed).toBe(10);
    expect(checkAchievements(pet)).toContain('feed10');
  });

  it('少年/成年阶段解锁', () => {
    let pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), growth: 60 };
    pet = simulate(pet, 1000).next;
    expect(pet.stage).toBe('teen');
    expect(checkAchievements(pet)).toContain('teen');
    expect(checkAchievements(pet)).not.toContain('adult');

    pet = { ...pet, growth: 200 };
    pet = simulate(pet, 2000).next;
    expect(pet.stage).toBe('adult');
    const earned = checkAchievements(pet);
    expect(earned).toContain('teen');
    expect(earned).toContain('adult');
  });

  it('持有 100 元宝解锁小金库', () => {
    const pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), coins: 100 };
    expect(checkAchievements(pet)).toContain('rich');
  });

  it('打工/学习计数与精力门槛', () => {
    let pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), energy: 100 };
    for (let i = 0; i < 5; i++) {
      pet = { ...pet, energy: 100 }; // 打工耗 30，每轮补满以隔离精力门槛
      pet = applyWork(pet, (i + 1) * 6 * 60_000).next;
    }
    expect(pet.counters.work).toBe(5);
    expect(checkAchievements(pet)).toContain('work5');
    for (let i = 0; i < 5; i++) {
      pet = { ...pet, energy: 100 };
      pet = applyStudy(pet, 60 * 60_000 * 10 + (i + 1) * 4 * 60_000).next;
    }
    expect(pet.counters.study).toBe(5);
    expect(checkAchievements(pet)).toContain('study5');
  });

  it('病愈计数由 simulate 累加', () => {
    let pet = { ...hatchEgg(createPet('cream', '咕咕', 0), 0), satiety: 5, cleanliness: 5 };
    pet = simulate(pet, 1000).next;
    expect(pet.sick).toBe(true);
    pet = { ...pet, satiety: 80, cleanliness: 80, health: 80 };
    pet = simulate(pet, 2000).next;
    expect(pet.counters.heal).toBe(1);
    expect(checkAchievements(pet)).toContain('heal');
  });

  it('小游戏最高分与 AI 计数', () => {
    const pet = {
      ...hatchEgg(createPet('cream', '咕咕', 0), 0),
      counters: { feed: 0, wash: 0, play: 0, work: 0, study: 0, tap: 0, heal: 0, aiChat: 1 },
      bests: { snack: 12, whack: 0, memory: 0, race: 0, toss: 0, sing: 0, lianliankan: 0, match3: 0, monopoly: 0, merge: 0 },
    };
    const earned = checkAchievements(pet);
    expect(earned).toContain('game12');
    expect(earned).toContain('aiChat');
  });
});
