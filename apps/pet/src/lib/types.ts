/** 咕咕 GuGu 核心类型定义 */

export type Locale = 'zh' | 'en';

/** 官方三配色变体 */
export type VariantId = 'cream' | 'mint' | 'sakura';

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
}

/** 小游戏种类（GameDialog 与结算共用） */
export type GameKind = 'snack' | 'whack' | 'memory' | 'race' | 'toss' | 'sing';

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
  dest: DestId;
  provision: Provision | null;
  /** 已寄回的照片文案序号 */
  photos: number[];
  souvenir: boolean;
}

/** 相册照片（旅行寄回） */
export interface AlbumPhoto {
  dest: DestId;
  cap: number;
  at: number;
}

/** 手信收藏 */
export interface AlbumSouvenir {
  dest: DestId;
  at: number;
}

/** 宠物存档（localStorage `ale-pet-save`，版本化） */
export interface PetState {
  saveVersion: 6;
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
}

/** 商店商品（买即用，无库存） */
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
