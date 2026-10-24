/**
 * 图鉴成就：定义与纯函数判定。
 * 计数器（PetCounters）由各动作/tick 累加，checkAchievements 输出"新解锁"id 列表，
 * 由 store 追加进 pet.achievements（sticky，只解锁不回收）。
 */

import type { PetState } from './types';

export interface AchievementDef {
  id: string;
  icon: string;
  zh: string;
  en: string;
  zhDesc: string;
  enDesc: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'hatch', icon: '🐣', zh: '初次见面', en: 'First Meeting', zhDesc: '迎接咕咕破壳', enDesc: 'Witness the hatch' },
  { id: 'feed10', icon: '🍪', zh: '按时开饭', en: 'Meal Time', zhDesc: '喂食 10 次', enDesc: 'Feed 10 times' },
  { id: 'wash10', icon: '🫧', zh: '洗白白', en: 'Squeaky Clean', zhDesc: '洗澡 10 次', enDesc: 'Bathe 10 times' },
  { id: 'play10', icon: '🎾', zh: '最佳玩伴', en: 'Playmate', zhDesc: '玩耍 10 次', enDesc: 'Play 10 times' },
  { id: 'work5', icon: '💼', zh: '打工魂', en: 'Work Ethic', zhDesc: '打工 5 次', enDesc: 'Work 5 times' },
  { id: 'study5', icon: '📖', zh: '好学咕咕', en: 'Bookworm', zhDesc: '学习 5 次', enDesc: 'Study 5 times' },
  { id: 'tap50', icon: '🫶', zh: '摸头杀', en: 'Head Pats', zhDesc: '摸摸咕咕 50 次', enDesc: 'Pet GuGu 50 times' },
  { id: 'teen', icon: '🌿', zh: '长大了', en: 'All Grown', zhDesc: '进入少年阶段', enDesc: 'Reach the teen stage' },
  { id: 'adult', icon: '🌳', zh: '成年礼', en: 'Adulthood', zhDesc: '进入成年阶段', enDesc: 'Reach the adult stage' },
  { id: 'rich', icon: '🪙', zh: '小金库', en: 'Nest Egg', zhDesc: '持有 100 元宝', enDesc: 'Hold 100 coins' },
  { id: 'heal', icon: '💊', zh: '满血复活', en: 'Full Recovery', zhDesc: '从生病中痊愈', enDesc: 'Recover from sickness' },
  { id: 'game12', icon: '🎮', zh: '接点心大师', en: 'Snack Master', zhDesc: '接点心单局得 12 分', enDesc: 'Score 12 in one Snack Catch' },
  { id: 'aiChat', icon: '💬', zh: 'AI 好友', en: 'AI Buddy', zhDesc: '与咕咕 AI 聊过天', enDesc: 'Chat with AI GuGu' },
  { id: 'travel1', icon: '🎒', zh: '第一次旅行', en: 'First Trip', zhDesc: '咕咕旅行归来', enDesc: 'GuGu returns from a trip' },
  { id: 'album6', icon: '📸', zh: '旅行摄影师', en: 'Shutterbug', zhDesc: '相册集齐 6 张照片', enDesc: 'Collect 6 travel photos' },
  { id: 'souvenir4', icon: '🎁', zh: '手信收藏家', en: 'Collector', zhDesc: '收集 4 种不同手信', enDesc: 'Collect 4 different souvenirs' },
];

/** 判定新解锁（纯函数；返回未解锁且条件已达成的 id 列表） */
export function checkAchievements(pet: PetState): string[] {
  const done = new Set(pet.achievements);
  const c = pet.counters;
  const earned: string[] = [];
  const add = (id: string, cond: boolean) => {
    if (cond && !done.has(id)) earned.push(id);
  };
  add('hatch', pet.hatchedAt > 0);
  add('feed10', c.feed >= 10);
  add('wash10', c.wash >= 10);
  add('play10', c.play >= 10);
  add('work5', c.work >= 5);
  add('study5', c.study >= 5);
  add('tap50', c.tap >= 50);
  add('teen', pet.stage === 'teen' || pet.stage === 'adult');
  add('adult', pet.stage === 'adult');
  add('rich', pet.coins >= 100);
  add('heal', c.heal >= 1);
  add('game12', pet.bests.snack >= 12);
  add('aiChat', c.aiChat >= 1);
  add('travel1', pet.album.photos.length >= 1);
  add('album6', pet.album.photos.length >= 6);
  add('souvenir4', new Set(pet.album.souvenirs.map((s) => s.dest)).size >= 4);
  return earned;
}

/** 按 id 找成就定义 */
export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
