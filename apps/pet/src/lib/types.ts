/** 咕咕 GuGu 核心类型定义 */

export type Locale = 'zh' | 'en';

/** 官方三配色变体 */
export type VariantId = 'cream' | 'mint' | 'sakura' | 'choco' | 'lavender' | 'soda' | 'matcha' | 'peach' | 'ocean' | 'grape' | 'lemon' | 'sakura-deep' | 'cotton' | 'charcoal' | 'caramel' | 'mint-deep' | 'coral' | 'sky' | 'rose' | 'olive';

/** 成长阶段：蛋 → 幼年 → 少年 → 成年 */
export type GrowthStage = 'egg' | 'baby' | 'teen' | 'adult';

/** 性格倾向（由互动历史累积） */
export type PersonalityKey = 'foodie' | 'lively' | 'artsy' | 'chill';

/** 玩家可触发的照顾动作 */
export type ActionId = 'feed' | 'wash' | 'play';

/**
 * 咕咕的活动状态（驱动渲染）。
 * eating/washing/playing/working/studying 是动作后的短暂演出，只存在内存（store.anim），不持久化；
 * sleeping/sick 持久化在 PetState 上。
 */
export type ActivityState =
  | 'idle'
  | 'eating'
  | 'washing'
  | 'playing'
  | 'working'
  | 'studying'
  | 'sleeping'
  | 'sick';

/** 模拟器产出的事件（用于气泡与离线报告） */
export type SimEventKind =
  | 'hungry'
  | 'dirty'
  | 'sleepy'
  | 'sick'
  | 'recover'
  | 'wake'
  | 'stageUp'
  | 'dead'
  | 'back';

export interface SimEvent {
  kind: SimEventKind;
  /** 事件发生时刻（ms） */
  at: number;
}

/** 行为计数器（成就系统的数据源） */
export interface PetCounters {
  feed: number;
  wash: number;
  play: number;
  work: number;
  study: number;
  /** 摸摸次数 */
  tap: number;
  /** 病愈次数 */
  heal: number;
  /** AI 对话次数 */
  aiChat: number;
}

/** 各小游戏独立最高分（复玩性追逐的核心） */
export interface GameBests {
  snack: number;
  whack: number;
  memory: number;
  race: number;
  toss: number;
  sing: number;
  lianliankan: number;
  match3: number;
  monopoly: number;
  merge: number;
}

/** 小游戏种类（GameDialog 与结算共用） */
export type GameKind = 'snack' | 'whack' | 'memory' | 'race' | 'toss' | 'sing' | 'lianliankan' | 'match3' | 'monopoly' | 'merge';

/** 旅行目的地 id（见 lib/travel.ts） */
export type DestId =
  | 'mountain'
  | 'beach'
  | 'forest'
  | 'town'
  | 'onsen'
  | 'camp'
  | 'field'
  | 'plaza';

/** 便当柜里的行李（影响旅行时长/目的地倾向/手信） */
export type Provision = 'bento' | 'bottle' | 'charm';

/** 一次旅行（进行中或已归来待播报） */
export interface PetTrip {
  status: 'away' | 'returned';
  departAt: number;
  returnAt: number;
  /** DestId 或平顶山目的地 id（pingdingshan.ts） */
  dest: string;
  provision: Provision | null;
  /** 已寄回的照片文案序号 */
  photos: number[];
  souvenir: boolean;
}

/** 相册照片（旅行寄回） */
export interface AlbumPhoto {
  /** DestId 或平顶山目的地 id */
  dest: string;
  cap: number;
  at: number;
}

/** 手信收藏 */
export interface AlbumSouvenir {
  /** DestId 或平顶山目的地 id */
  dest: string;
  at: number;
}

/** 装扮配件 id（见 lib/accessories.ts） */
export type AccessoryId =
  | 'beanie'
  | 'strawhat'
  | 'crown'
  | 'party'
  | 'scarf-star'
  | 'scarf-plaid'
  | 'bow'
  | 'flower'
  | 'glasses'
  | 'backpack'
  | 'santa' | 'pumpkin' | 'wizard' | 'chef' | 'detective' | 'beret' | 'cap' | 'bucket'
  | 'flower-crown' | 'headphones' | 'earmuffs' | 'space-helmet'
  | 'sunglasses' | 'star-glasses' | 'monocle'
  | 'scarf-red' | 'scarf-yellow' | 'bandana' | 'necklace' | 'bell'
  | 'wings' | 'cape' | 'bag-star' | 'watch' | 'hairpin' | 'pin-wheel' | 'badge-star' | 'umbrella'
  | 'grad-cap' | 'tophat' | 'straw-circle' | 'veil' | 'crown-flower' | 'helmet-wood'
  | 'nightcap' | 'raincoat-hood' | 'crown-ice' | 'mushroom-hat' | 'crown-laurel' | 'bonnet'
  | 'glasses-heart' | 'glasses-3d' | 'visor'
  | 'scarf-check' | 'scarf-rainbow' | 'tie'
  | 'backpack-bear' | 'balloon-hand' | 'camera' | 'icecream' | 'flag' | 'book'
  | `b4b-${number}`;

/** 房间装饰 id（见 lib/accessories.ts） */
export type DecoId = 'nest' | 'bowl' | 'ball' | 'plant' | 'picture' | 'rug' | 'lamp' | 'teddy'
  | 'swing' | 'bookshelf' | 'teapot' | 'cuckoo' | 'fountain' | 'mail' | 'basket-fruit' | 'candle'
  | 'chalkboard' | 'barrel' | 'birdbath' | 'hammock' | 'lantern' | 'clock' | 'desk' | 'shelf-plant'
  | 'watering-can' | 'butterfly-house' | 'mushroom-house' | 'well' | 'horse' | 'xylophone'
  | 'treasure-chest' | 'gramophone'
  | 'sock' | 'wreath' | 'snowman' | 'pumpkin-lamp' | 'moon-lamp' | 'star-jar' | 'boat' | 'kite'
  | 'barometer' | 'vine' | 'binoculars' | 'thermos' | 'radio' | 'cuckoo-owl' | 'bathtub' | 'sign'
  | `b4b-${number}`;

/** 宠物存档（localStorage `ale-pet-save`，版本化） */
export interface PetState {
  saveVersion: 7;
  /** 宠物名（玩家可改，默认咕咕） */
  name: string;
  variant: VariantId;
  stage: GrowthStage;
  /** 领养（产蛋）时刻 */
  bornAt: number;
  /** 破壳时刻 */
  hatchedAt: number;
  /** 上次模拟时刻（离线结算基准） */
  updatedAt: number;

  /** 饱食 0..100 */
  satiety: number;
  /** 清洁 0..100 */
  cleanliness: number;
  /** 心情 0..100 */
  mood: number;
  /** 精力 0..100 */
  energy: number;
  /** 健康 0..100 */
  health: number;

  /** 成长值（阶段提升的唯一来源） */
  growth: number;

  /** 元宝（打工/小游戏/随机事件获得，商店消费） */
  coins: number;

  /** 性格积累（各 0..100） */
  personality: Record<PersonalityKey, number>;

  /** 行为计数器（成就系统） */
  counters: PetCounters;

  /** 各小游戏独立最高分 */
  bests: GameBests;

  /** 已解锁成就 id 列表 */
  achievements: string[];

  sleeping: boolean;
  sick: boolean;
  /** 休闲模式下恒为 true；经典模式（可选）健康归零后离世 */
  alive: boolean;
  mode: 'casual' | 'classic';

  /** 蛋阶段剩余啄壳次数 */
  tapsToHatch: number;

  /** 激活的自定义皮肤 id（IndexedDB ale-pet-db/skins；缺省 = 官方分层形象） */
  customSkinId?: string;

  /** 动作冷却时间戳（ms，0 表示可用） */
  lastFedAt: number;
  lastWashedAt: number;
  lastPlayedAt: number;
  lastWorkedAt: number;
  lastStudiedAt: number;

  /** 新手引导步数（3 = 完成） */
  tutorialStep: number;

  /** 每日签到：最近签到日期（可选字段，v4 内向后兼容） */
  lastCheckinDate?: string;
  /** 连续签到天数 */
  checkinStreak?: number;

  /** 进行中/归来待播报的旅行（null = 在家） */
  trip: PetTrip | null;
  /** 旅行相册（照片与手信，上限 36 条） */
  album: { photos: AlbumPhoto[]; souvenirs: AlbumSouvenir[] };
  /** 便当柜里装好的行李（下次出发生效） */
  packedProvision?: Provision | null;
  /** 上次自主出发时间（冷却用） */
  lastTripAt?: number;
  /** 日记：按日期（toDateString）记录事件 token（见 lib/diary.ts） */
  diary: Record<string, string[]>;

  /** 已拥有的装扮配件 */
  accessories: AccessoryId[];
  /** 当前穿戴的配件（null = 裸装） */
  equippedAccessory: AccessoryId | null;
  /** 已拥有的房间装饰 */
  decoOwned: DecoId[];
  /** 正在摆放的装饰（decoOwned 的子集，最多 6 件按槽位摆） */
  decorations: DecoId[];
  /** 已解锁的官方配色（领养时选中的配色默认解锁，其余需商店购买） */
  variantOwned: VariantId[];
  /** 已解锁的场景（空数组 = 只有每日自动轮换；其余需商店购买） */
  sceneOwned: string[];
  /** 手动选择的场景（null = 每日自动轮换） */
  sceneId?: string | null;
}

/** 商店商品（道具买即用；装扮/装饰买后拥有） */
export interface ShopItem {
  id: string;
  icon: string;
  zh: string;
  en: string;
  price: number;
  satiety?: number;
  cleanliness?: number;
  mood?: number;
  health?: number;
  /** 治愈生病 */
  cure?: boolean;
  /** AI 图标（可选，替代 emoji） */
  iconSrc?: string;
  /** 商品类型：use=即时道具 accessory=装扮 decoration=装饰 variant=官方配色 scene=场景 */
  kind?: 'use' | 'accessory' | 'decoration' | 'variant' | 'scene';
  accessory?: AccessoryId;
  deco?: DecoId;
  variant?: VariantId;
  scene?: string;
}

/** 粒子/演出触发（内存态） */
export type BurstKind = 'heart' | 'bubble' | 'sparkle' | 'wobble' | 'confetti';

export interface BurstData {
  id: number;
  kind: BurstKind;
}

/** 模拟 + 动作应用结果 */
export interface SimResult {
  next: PetState;
  events: SimEvent[];
}

export interface ActionOutcome {
  ok: boolean;
  next: PetState;
  /** 动作失败原因（冷却中/睡觉中/没力气/元宝不够/用了没效果），由调用方决定提示 */
  reason?: 'cooldown' | 'sleeping' | 'dead' | 'tired' | 'poor' | 'useless';
}
