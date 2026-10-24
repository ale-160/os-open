/**
 * 旅行系统数据（参考《旅行青蛙》：自主出门、寄回照片、带回手信）。
 * 目的地文案与手信为静态数据；偏好看便当柜里装的行李。
 */

import type { DestId, Provision } from './types';

export type { DestId };

export interface Destination {
  id: DestId;
  icon: string;
  zh: string;
  en: string;
  /** 场景卡的底色渐变（照片渲染用） */
  scene: string;
  /** 场景点缀 emoji（照片渲染用） */
  scenery: string[];
  capsZh: [string, string];
  capsEn: [string, string];
  souvenirZh: string;
  souvenirEn: string;
  souvenirIcon: string;
  /** 水壶偏好：自然系目的地 */
  nature?: boolean;
}

export const DESTS: Destination[] = [
  {
    id: 'mountain',
    icon: '🏔️',
    zh: '山顶',
    en: 'Mountaintop',
    scene: 'from-[#a8c8f0] to-[#e8f0ff]',
    scenery: ['🏔️', '☁️', '🌄'],
    capsZh: ['山顶的风好大，云都在脚下！', '日出把天空染成了橘子色～'],
    capsEn: ['The wind up here! Clouds below my feet!', 'Sunrise painted the sky orange!'],
    souvenirZh: '山顶石子',
    souvenirEn: 'Peak Stone',
    souvenirIcon: '🪨',
  },
  {
    id: 'beach',
    icon: '🏖️',
    zh: '海边',
    en: 'Seaside',
    scene: 'from-[#8fd0e8] to-[#e0f6ff]',
    scenery: ['🏖️', '🌊', '🐚'],
    capsZh: ['捡了一整天的贝壳！', '海风咸咸的，浪花追着我跑'],
    capsEn: ['Collected shells all day!', 'Salty breeze, chasing waves'],
    souvenirZh: '贝壳手链',
    souvenirEn: 'Shell Bracelet',
    souvenirIcon: '🐚',
    nature: true,
  },
  {
    id: 'forest',
    icon: '🌲',
    zh: '森林',
    en: 'Forest',
    scene: 'from-[#9fd0a0] to-[#e6f5e6]',
    scenery: ['🌲', '🍄', '🦌'],
    capsZh: ['蘑菇家族在开会，嘘……', '苔藓软软的，像大地毯'],
    capsEn: ['The mushroom family is meeting, shh...', 'Moss is so soft, like a carpet'],
    souvenirZh: '蘑菇摆件',
    souvenirEn: 'Mushroom Charm',
    souvenirIcon: '🍄',
    nature: true,
  },
  {
    id: 'town',
    icon: '🏮',
    zh: '古镇',
    en: 'Old Town',
    scene: 'from-[#f0c98a] to-[#fff0d6]',
    scenery: ['🏮', '🧧', '🌉'],
    capsZh: ['灯笼一盏一盏亮起来了', '石板路走起来哒哒响'],
    capsEn: ['Lanterns lighting up one by one', 'Tap tap on the stone roads'],
    souvenirZh: '小纸灯',
    souvenirEn: 'Paper Lantern',
    souvenirIcon: '🏮',
  },
  {
    id: 'onsen',
    icon: '♨️',
    zh: '温泉',
    en: 'Hot Spring',
    scene: 'from-[#e8b8c8] to-[#ffeef5]',
    scenery: ['♨️', '🗻', '🥚'],
    capsZh: ['泡完羽毛亮亮的！', '温泉蛋好好吃，留了一个给你'],
    capsEn: ['Feathers all shiny after the soak!', 'Eggs here are tasty — saved you one'],
    souvenirZh: '温泉蛋',
    souvenirEn: 'Onsen Egg',
    souvenirIcon: '🥚',
    nature: true,
  },
  {
    id: 'camp',
    icon: '⛺',
    zh: '星空营地',
    en: 'Star Camp',
    scene: 'from-[#3d4a7a] to-[#8a7fae]',
    scenery: ['⛺', '🌌', '🦉'],
    capsZh: ['银河像撒了一地糖', '帐篷外有猫头鹰在跟我打招呼'],
    capsEn: ['The Milky Way like spilled sugar', 'An owl said hello outside the tent'],
    souvenirZh: '星图明信片',
    souvenirEn: 'Star Map',
    souvenirIcon: '🌌',
  },
  {
    id: 'field',
    icon: '🌾',
    zh: '稻田',
    en: 'Rice Field',
    scene: 'from-[#d0e08a] to-[#f6ffe0]',
    scenery: ['🌾', '🎃', '🐦'],
    capsZh: ['风把稻子吹成了波浪啦', '稻草人对我点了点头'],
    capsEn: ['Wind turned rice into waves!', 'The scarecrow nodded at me'],
    souvenirZh: '稻草哨子',
    souvenirEn: 'Straw Whistle',
    souvenirIcon: '🌾',
    nature: true,
  },
  {
    id: 'plaza',
    icon: '🎡',
    zh: '城市广场',
    en: 'City Plaza',
    scene: 'from-[#c8b8f0] to-[#f0eaff]',
    scenery: ['🎡', '🎈', '🕊️'],
    capsZh: ['摩天轮上能看见我们家！', '广场鸽一点都不怕我哎'],
    capsEn: ['You can see our home from the ferris wheel!', 'Plaza pigeons are not scared of me'],
    souvenirZh: '彩色气球',
    souvenirEn: 'Balloon',
    souvenirIcon: '🎈',
  },
];

export function destById(id: DestId): Destination {
  return DESTS.find((d) => d.id === id) ?? DESTS[0];
}

export const PROVISIONS: { id: Provision; icon: string; zh: string; en: string; zhDesc: string; enDesc: string }[] = [
  {
    id: 'bento',
    icon: '🍙',
    zh: '饭团便当',
    en: 'Bento',
    zhDesc: '走得久一点，照片更多',
    enDesc: 'Longer trips, more photos',
  },
  {
    id: 'bottle',
    icon: '🥤',
    zh: '小水壶',
    en: 'Water Bottle',
    zhDesc: '偏爱大自然目的地',
    enDesc: 'Prefers nature spots',
  },
  {
    id: 'charm',
    icon: '🧿',
    zh: '护身符',
    en: 'Charm',
    zhDesc: '手信一定带得回来',
    enDesc: 'Guarantees a souvenir',
  },
];

/** 按行李偏向选目的地 */
export function pickDest(provision: Provision | null): DestId {
  if (provision === 'bottle') {
    const nature = DESTS.filter((d) => d.nature);
    return nature[Math.floor(Math.random() * nature.length)].id;
  }
  return DESTS[Math.floor(Math.random() * DESTS.length)].id;
}

/** 照片文案（cap 序号取模） */
export function photoCaption(dest: DestId, cap: number, locale: 'zh' | 'en'): string {
  const d = destById(dest);
  const caps = locale === 'zh' ? d.capsZh : d.capsEn;
  return caps[((cap % caps.length) + caps.length) % caps.length];
}
