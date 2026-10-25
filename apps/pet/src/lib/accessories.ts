/**
 * 装扮配件与房间装饰目录：素材、锚点分类、商店扩展、舞台槽位。
 * 配件按锚点分类渲染（见 PetSprite）：head=头顶 / side=侧头 / scarf=胸前 / eyes=眼部（跟随表情布局）。
 */

import { BASE_PATH } from './skins';
import { assetUrl } from './assetUrl';
import type { AccessoryId, DecoId, ShopItem } from './types';
import { ACCESSORIES_BATCH2, DECORATIONS_BATCH2 } from './wardrobe-batch2';

export interface AccessoryDef {
  id: AccessoryId;
  file: string;
  /** 渲染锚点 */
  anchor: 'head' | 'side' | 'scarf' | 'eyes';
  icon: string;
  zh: string;
  en: string;
  zhDesc: string;
  enDesc: string;
  price: number;
}

const ACCESSORIES_BASE: AccessoryDef[] = [
  { id: 'beanie', file: 'acc/beanie.png', anchor: 'head', icon: '🧢', zh: '绒球毛线帽', en: 'Pom Beanie', zhDesc: '冬天戴最暖和', enDesc: 'Cozy for winter', price: 18 },
  { id: 'strawhat', file: 'acc/strawhat.png', anchor: 'head', icon: '👒', zh: '丝带草帽', en: 'Straw Hat', zhDesc: '出门旅行的标配', enDesc: 'A traveler classic', price: 20 },
  { id: 'crown', file: 'acc/crown.png', anchor: 'head', icon: '👑', zh: '小皇冠', en: 'Tiny Crown', zhDesc: '咕咕之王', enDesc: 'King GuGu', price: 30 },
  { id: 'party', file: 'acc/party.png', anchor: 'head', icon: '🥳', zh: '派对 cone 帽', en: 'Party Hat', zhDesc: '过生日要戴', enDesc: 'Birthday must', price: 15 },
  { id: 'scarf-star', file: 'acc/scarf-star.png', anchor: 'scarf', icon: '🧣', zh: '星星围巾', en: 'Star Scarf', zhDesc: '蓝色，绣着小星星', enDesc: 'Blue with little stars', price: 22 },
  { id: 'scarf-plaid', file: 'acc/scarf-plaid.png', anchor: 'scarf', icon: '🧣', zh: '格纹围巾', en: 'Plaid Scarf', zhDesc: '暖烘烘的格纹', enDesc: 'Warm tartan', price: 20 },
  { id: 'bow', file: 'acc/bow.png', anchor: 'side', icon: '🎀', zh: '粉色蝴蝶结', en: 'Pink Bow', zhDesc: '歪着戴最好看', enDesc: 'Best worn tilted', price: 12 },
  { id: 'flower', file: 'acc/flower.png', anchor: 'side', icon: '🌻', zh: '向日葵发夹', en: 'Sunflower Clip', zhDesc: '永远朝着太阳', enDesc: 'Always facing the sun', price: 14 },
  { id: 'glasses', file: 'acc/glasses.png', anchor: 'eyes', icon: '👓', zh: '圆框眼镜', en: 'Round Glasses', zhDesc: '学习后气质 +1', enDesc: 'Scholar vibes', price: 16 },
  { id: 'backpack', file: 'acc/backpack.png', anchor: 'side', icon: '🎒', zh: '旅行小背包', en: 'Travel Pack', zhDesc: '说走就走的勇气', enDesc: 'Ready to wander', price: 25 },
];

export interface DecoDef {
  id: DecoId;
  file: string;
  icon: string;
  zh: string;
  en: string;
  price: number;
  /** 地毯类垫在脚下（z 更低） */
  underlay?: boolean;
}

const DECORATIONS_BASE: DecoDef[] = [
  { id: 'nest', file: 'deco/nest.png', icon: '🪹', zh: '草编小窝', en: 'Cozy Nest', price: 24 },
  { id: 'bowl', file: 'deco/bowl.png', icon: '🍚', zh: '小鱼食盆', en: 'Food Bowl', price: 14 },
  { id: 'ball', file: 'deco/ball.png', icon: '🧶', zh: '毛线球', en: 'Yarn Ball', price: 12 },
  { id: 'plant', file: 'deco/plant.png', icon: '🪴', zh: '多肉盆栽', en: 'Succulent', price: 16 },
  { id: 'picture', file: 'deco/picture.png', icon: '🖼️', zh: '风景挂画', en: 'Little Painting', price: 18 },
  { id: 'rug', file: 'deco/rug.png', icon: '🟫', zh: '编织圆毯', en: 'Braided Rug', price: 20, underlay: true },
  { id: 'lamp', file: 'deco/lamp.png', icon: '💡', zh: '蘑菇小灯', en: 'Mushroom Lamp', price: 22 },
  { id: 'teddy', file: 'deco/teddy.png', icon: '🧸', zh: '泰迪小熊', en: 'Teddy Bear', price: 15 },
];

/** 舞台装饰槽位（百分比；最多 6 件，地毯不占槽垫底） */
export const DECO_SLOTS: { x: number; y: number; w: number }[] = [
  { x: 13, y: 62, w: 15 }, // 左墙（挂画/灯）
  { x: 12, y: 80, w: 16 }, // 左地面
  { x: 30, y: 82, w: 14 }, // 左前
  { x: 70, y: 82, w: 14 }, // 右前
  { x: 87, y: 79, w: 16 }, // 右地面
  { x: 88, y: 60, w: 14 }, // 右墙
];

export function accessoryById(id: AccessoryId): AccessoryDef | undefined {
  return ACCESSORIES.find((a) => a.id === id);
}

export function decoById(id: DecoId): DecoDef | undefined {
  return DECORATIONS.find((d) => d.id === id);
}

export function accessorySrc(id: AccessoryId): string {
  return assetUrl(`${BASE_PATH}/skins/gugu/${accessoryById(id)?.file ?? ''}`);
}

export function decoSrc(id: DecoId): string {
  return assetUrl(`${BASE_PATH}/skins/gugu/${decoById(id)?.file ?? ''}`);
}

export const ACCESSORIES: AccessoryDef[] = [...ACCESSORIES_BASE, ...ACCESSORIES_BATCH2];
export const DECORATIONS: DecoDef[] = [...DECORATIONS_BASE, ...DECORATIONS_BATCH2];

/** 装扮 + 装饰的商品条目（供商店与 SHOP_ITEMS 合并） */
export function wardrobeShopItems(): ShopItem[] {
  return [
    ...ACCESSORIES.map<ShopItem>((a) => ({
      id: `acc-${a.id}`,
      icon: a.icon,
      iconSrc: `${BASE_PATH}/skins/gugu/${a.file}`,
      zh: a.zh,
      en: a.en,
      price: a.price,
      kind: 'accessory',
      accessory: a.id,
    })),
    ...DECORATIONS.map<ShopItem>((d) => ({
      id: `deco-${d.id}`,
      icon: d.icon,
      iconSrc: `${BASE_PATH}/skins/gugu/${d.file}`,
      zh: d.zh,
      en: d.en,
      price: d.price,
      kind: 'decoration',
      deco: d.id,
    })),
  ];
}
