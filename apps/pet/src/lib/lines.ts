/**
 * 咕咕台词库（本地兜底，M2 起 AI 台词在其上叠加）。
 * 索引维度：事件/状态 × 性格 × 语言；{name} 会被宠物名替换。
 */

import type { Locale, PersonalityKey } from './types';

export type LineKind =
  | 'tapEgg'
  | 'hatchWelcome'
  | 'tap'
  | 'feed'
  | 'wash'
  | 'play'
  | 'work'
  | 'study'
  | 'buy'
  | 'tired'
  | 'sleep'
  | 'wake'
  | 'hungry'
  | 'dirty'
  | 'sleepy'
  | 'sick'
  | 'recover'
  | 'back'
  | 'stageUp'
  | 'eventCoin'
  | 'eventMoodUp'
  | 'eventMoodDown'
  | 'gameGreat'
  | 'gameOk'
  | 'gameMeh'
  | 'achUnlock'
  | 'idle';

const LINES: Record<Locale, Record<LineKind, string[]>> = {
  zh: {
    tapEgg: [
      "咚咚…好像有什么在动！",
      "壳里暖暖的，再敲敲看？",
      "咕噜咕噜…是我在翻身呀",
      "快了快了，我马上出来！",
    ],
    hatchWelcome: [
      "咕咕！我出来啦～以后请多关照！",
      "哇，外面的世界好亮！你就是我的家人吗？",
      "咕咕报到！记住我的名字哦",
    ],
    tap: [
      "咕咕？",
      "嘿嘿，好痒～",
      "再摸摸嘛",
      "咕！",
      "最喜欢 {name} 了",
      "羽毛都被摸顺啦",
    ],
    feed: [
      "开动！咕咕咕～",
      "好好吃！还想再来一口",
      "咔嚓咔嚓…咦，这么快就吃完了？",
      "唔，肚子终于不叫啦",
      "这个味道，我要记在小本本上",
    ],
    wash: [
      "泡泡好好玩！咕噜咕噜～",
      "搓搓翅膀，亮晶晶！",
      "水暖暖的，差点睡着…",
      "洗完香香，抱起来更舒服了吧",
    ],
    play: [
      "耶！再来再来！",
      "接住啦！咕咕厉害吧",
      "和你玩最开心了！",
      "追气球咯～扑棱扑棱",
      "哈…哈…玩累了，但是好开心",
    ],
    work: [
      "搬砖咕…认真打工中！",
      "咕咕是最努力的！",
      "这份元宝，是我挣来的！",
      "加油打工，为了好吃的！",
      "呼…打工可比玩耍累多啦",
    ],
    study: [
      "咕咕要变聪明！",
      "这个字念…咕！",
      "学习使我快乐（真的）",
      "今天也要读一页书",
      "学完感觉自己升华了",
    ],
    buy: ["哇！给我的吗？！", "眼睛都亮了！", "宠我爱对了！", "咕咕收下啦～"],
    tired: ["咕…没力气了…让我缓缓…", "累了累了，要休息一下…"],
    sleep: ["晚安…呼…呼…", "眼皮好重…咕咕先睡啦", "被子借我一角好不好…"],
    wake: ["咕咕！睡饱啦！", "伸个懒腰～今天做什么呢？", "我做了一个好吃的梦！"],
    hungry: ["咕…肚子咕咕叫了…", "{name}，我饿了嘛…", "闻到好吃的了吗？快喂我！"],
    dirty: ["羽毛乱糟糟的…想洗澡澡…", "咕…身上黏黏的，不舒服…"],
    sleepy: ["呼啊…眼睛睁不开了…", "哈欠～可以睡觉了吗？"],
    sick: ["咕…不舒服…想休息…", "阿嚏！好像着凉了…别担心我…"],
    recover: ["咕咕！满血复活！", "又是活蹦乱跳的一天！"],
    back: [
      "{name}回来啦！我等你好久了！",
      "咕咕！你不在的时候我乖乖的哦",
      "想你了！蹭蹭你",
    ],
    stageUp: ["咕咕！感觉身体里有力量涌出来！", "我…我好像长大了一点！"],
    eventCoin: ["捡到 {n} 个元宝！咕咕发财啦！", "地上有 {n} 元宝！咕咕眼尖吧！", "咕噜噜～滚出来 {n} 个元宝！"],
    eventMoodUp: ["今天心情超级好！", "阳光真好，咕咕想唱歌！", "莫名开心，蹭蹭你！"],
    eventMoodDown: ["呜…有点小委屈…", "忽然有点想静静…", "咕…今天有点丧…"],
    gameGreat: ["无敌了！点心一颗都没跑！", "咕咕是接点心大师！", "太爽啦！再来挑战！"],
    gameOk: ["还不错！咕咕有认真接！", "接住好多！差一点点就完美", "好玩！下次接更多！"],
    gameMeh: ["呜…点心都躲着我…", "再来一次，咕咕要认真了！", "手滑了…不算不算！"],
    achUnlock: ["🏆 达成成就「{a}」！", "咕咕解锁了新成就「{a}」！", "恭喜！获得成就「{a}」！"],
    idle: [
      "咕咕咕～哼哼歌",
      "歪头看你",
      "在发呆…咦？看我干嘛",
      "啄啄地上，咦这里有什么",
      "扑棱翅膀晒太阳",
      "今天的云好像棉花糖",
    ],
  },
  en: {
    tapEgg: [
      "Knock knock... something moved!",
      "So warm in here. Tap again?",
      "Gurgle gurgle... just rolling over!",
      "Almost out, hang on!",
    ],
    hatchWelcome: [
      "Gugu! I'm out! Please take care of me!",
      "Wow, it's so bright out here! Are you my family?",
      "GuGu reporting in! Remember my name, okay?",
    ],
    tap: [
      "Gugu?",
      "Hehe, that tickles~",
      "More pats, please!",
      "Gu!",
      "I love {name}!",
      "Feathers all fluffy now",
    ],
    feed: [
      "Chow time! Gugu gugu~",
      "Yummy! One more bite?",
      "Munch munch... wait, it's gone already?",
      "My tummy finally stopped rumbling!",
      "This taste is going in my diary",
    ],
    wash: [
      "Bubbles! So fun! Splish splash~",
      "Scrub scrub, shiny wings!",
      "Warm water... almost fell asleep...",
      "Squeaky clean! Cozy to hug now",
    ],
    play: [
      "Yay! Again, again!",
      "Caught it! I'm good, right?",
      "Playing with you is the best!",
      "Chasing the balloon! Flap flap",
      "Phew... tired but SO happy",
    ],
    work: [
      "Working hard, gugu style!",
      "Nobody works harder than me!",
      "These coins? I earned them!",
      "Work hard, snack harder!",
      "Whew... work is way harder than play",
    ],
    study: [
      "Gugu is getting smarter!",
      "This word reads... gu!",
      "Learning is fun (really!)",
      "One page a day, every day",
      "I feel upgraded!",
    ],
    buy: ["Wow! For me?!", "My eyes are sparkling!", "Best family ever!", "Gugu accepts it~"],
    tired: ["Gugu... too tired... need a break...", "So sleepy... let me rest..."],
    sleep: ["Night night... zzz...", "Eyelids so heavy... gugu sleeps now", "Save me a corner of the blanket..."],
    wake: ["Gugu! Slept so well!", "Big stretch~ what's for today?", "I dreamed of something yummy!"],
    hungry: ["Gugu... tummy's rumbling...", "{name}, I'm hungry...", "Smell anything tasty? Feed me!"],
    dirty: ["Feathers all messy... bath time?", "Gugu... feeling sticky..."],
    sleepy: ["Yawwwn... can't keep my eyes open...", "So sleepy... nap time?"],
    sick: ["Gugu... not feeling well...", "Achoo! Caught a chill... don't worry..."],
    recover: ["Gugu! Back to full power!", "Bouncy and healthy again!"],
    back: [
      "{name} is back! I waited so long!",
      "Gugu! I was good while you were away!",
      "Missed you! Nuzzle nuzzle",
    ],
    stageUp: ["Gugu! I feel power welling up!", "I... I think I grew a little!"],
    eventCoin: ["Found {n} coins! I'm rich!", "{n} coins on the ground! Sharp eyes, right?", "Rattle rattle~ {n} coins rolled out!"],
    eventMoodUp: ["Feeling SUPER good today!", "Nice sunshine, wanna sing!", "Happy for no reason! Nuzzle!"],
    eventMoodDown: ["Sniff... feeling a bit down...", "Wanna be alone for a bit...", "Gugu... a little blue today..."],
    gameGreat: ["Unstoppable! Not one snack escaped!", "I'm the snack-catching master!", "So good! One more round!"],
    gameOk: ["Not bad! I caught a lot!", "So close to perfect!", "Fun! I'll catch more next time!"],
    gameMeh: ["Sniff... the snacks dodged me...", "One more round, I'll focus!", "Slipped... that doesn't count!"],
    achUnlock: ["🏆 Achievement unlocked: {a}!", "GuGu just earned \"{a}\"!", "Congrats! New achievement: {a}!"],
    idle: [
      "Gugu gugu~ humming a song",
      "Tilts head at you",
      "Zoning out... huh? What?",
      "Peck peck... what's this on the ground?",
      "Flap flap, sunbathing",
      "Clouds today look like cotton candy",
    ],
  },
};

/** 性格闲聊台词（积累到主导性格后混入 idle 池） */
const IDLE_BY_PERSONALITY: Record<Locale, Record<PersonalityKey, string[]>> = {
  zh: {
    foodie: [
      "做梦都在想烤红薯的味道",
      "要是每顿都有小饼干就好了",
      "刚才那个，可以再来十份吗",
    ],
    lively: ["蹦蹦跳跳！停不下来！", "我们去冒险吧！现在！", "看我的新舞步！咕恰恰"],
    artsy: ["今天想画一朵云", "咕咕的诗：咕，咕咕，咕～", "月亮出来的时候要唱歌"],
    chill: ["慢一点也没关系嘛", "趴着看天空…真好", "不急不急，咕咕等你"],
  },
  en: {
    foodie: [
      "Dreaming of roasted sweet potato...",
      "Life needs more cookies",
      "That snack? Ten more, please",
    ],
    lively: ["Bounce bounce! Can't sit still!", "Adventure time! Right now!", "Check my new dance! Gu-cha-cha"],
    artsy: ["Wanna paint a cloud today", "A gugu poem: gu, gugu, gu~", "Singing when the moon comes out"],
    chill: ["No rush, no rush", "Lying here, watching sky... nice", "Take it slow, gugu waits"],
  },
};

export interface PickLineOptions {
  name?: string;
  personality?: PersonalityKey | null;
  /** 最近说过的话（避免复读） */
  avoid?: string[];
  /** 模板变量（{n} 等） */
  vars?: Record<string, string | number>;
}

/** 随机挑一条台词：优先过滤最近说过的，避免复读 */
export function pickLine(kind: LineKind, locale: Locale, opts: PickLineOptions = {}): string {
  let pool = [...LINES[locale][kind]];
  if (kind === 'idle' && opts.personality) {
    pool = pool.concat(IDLE_BY_PERSONALITY[locale][opts.personality]);
  }
  const fresh = pool.filter((l) => !opts.avoid?.includes(l));
  const source = fresh.length > 0 ? fresh : pool;
  const line = source[Math.floor(Math.random() * source.length)];
  const vars: Record<string, string | number> = {
    name: opts.name ?? (locale === 'zh' ? '咕咕' : 'GuGu'),
    ...(opts.vars ?? {}),
  };
  return line.replaceAll(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
