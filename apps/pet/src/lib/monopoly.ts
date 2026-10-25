/**
 * 大富翁棋盘数据：经典「咕咕镇」22 格 + 第二季「环游小镇」（14 个地产格从 60 个景点池随机抽取）。
 * 事件格（起点/幸运星/公交/税/溪流/宝箱/灯会/医院）位置与效果固定，地产格价位沿用经典棋盘。
 */

export interface TileDef {
  id: string;
  zh: string;
  en: string;
  /** 可买地价；null = 起点/事件格不可买 */
  price: number | null;
  rent: number | null;
  emoji: string;
  /** 素材文件名（不含 .png）；缺省 = mono-<id>.png */
  art?: string;
}

export const CLASSIC_TILES: TileDef[] = [
  { id: 'start', zh: '起点', en: 'Start', price: null, rent: null, emoji: '🚩', art: 'mono-start-gate' },
  { id: 'park', zh: '公园', en: 'Park', price: 60, rent: 12, emoji: '🌳' },
  { id: 'bakery', zh: '面包房', en: 'Bakery', price: 80, rent: 16, emoji: '🥖' },
  { id: 'library', zh: '图书馆', en: 'Library', price: 90, rent: 18, emoji: '📚' },
  { id: 'fountain', zh: '喷泉广场', en: 'Fountain', price: 100, rent: 20, emoji: '⛲' },
  { id: 'luck', zh: '幸运星', en: 'Lucky Star', price: null, rent: null, emoji: '⭐', art: 'mono-luck-star' },
  { id: 'toy', zh: '玩具店', en: 'Toy Shop', price: 110, rent: 22, emoji: '🧸', art: 'mono-toy-shop' },
  { id: 'pond', zh: '池塘', en: 'Pond', price: 70, rent: 14, emoji: '🪷' },
  { id: 'hill', zh: '小山丘', en: 'Hill', price: 90, rent: 18, emoji: '⛰️' },
  { id: 'bus', zh: '公交站', en: 'Bus Stop', price: null, rent: null, emoji: '🚌', art: 'mono-bus-stop' },
  { id: 'museum', zh: '博物馆', en: 'Museum', price: 130, rent: 26, emoji: '🏛️' },
  { id: 'tax', zh: '税务局', en: 'Tax Office', price: null, rent: null, emoji: '🏦', art: 'mono-tax-office' },
  { id: 'flower', zh: '花店', en: 'Flower Shop', price: 100, rent: 20, emoji: '💐', art: 'mono-flower-shop' },
  { id: 'camp', zh: '营地', en: 'Camp', price: 120, rent: 24, emoji: '⛺', art: 'mono-camp-site' },
  { id: 'river', zh: '溪流', en: 'Creek', price: null, rent: null, emoji: '🏞️' },
  { id: 'chest', zh: '宝箱', en: 'Treasure Box', price: null, rent: null, emoji: '🎁', art: 'mono-bonus-chest' },
  { id: 'train', zh: '火车站', en: 'Station', price: 140, rent: 28, emoji: '🚉', art: 'mono-train-station' },
  { id: 'observatory', zh: '天文台', en: 'Observatory', price: 150, rent: 30, emoji: '🔭' },
  { id: 'beach', zh: '海滩', en: 'Beach', price: 130, rent: 26, emoji: '🏖️' },
  { id: 'farm', zh: '农场', en: 'Farm', price: 110, rent: 22, emoji: '🌾' },
  { id: 'festival', zh: '灯会', en: 'Lantern Fair', price: null, rent: null, emoji: '🏮' },
  { id: 'hospital', zh: '医院', en: 'Hospital', price: null, rent: null, emoji: '🏥' },
];

/** 第二季景点池（60 个，对应 game/mono2-<id>.png） */
export interface VenueDef {
  id: string;
  zh: string;
  en: string;
  emoji: string;
}

export const VENUES: VenueDef[] = [
  { id: 'cinema', zh: '电影院', en: 'Cinema', emoji: '🎬' },
  { id: 'arcade', zh: '街机厅', en: 'Arcade', emoji: '🕹️' },
  { id: 'zoo', zh: '动物园', en: 'Zoo', emoji: '🦒' },
  { id: 'aquarium', zh: '水族馆', en: 'Aquarium', emoji: '🐠' },
  { id: 'ramen-shop', zh: '拉面馆', en: 'Ramen Shop', emoji: '🍜' },
  { id: 'sushi-bar', zh: '寿司店', en: 'Sushi Bar', emoji: '🍣' },
  { id: 'airport', zh: '机场', en: 'Airport', emoji: '✈️' },
  { id: 'harbor', zh: '港口', en: 'Harbor', emoji: '⚓' },
  { id: 'lighthouse', zh: '灯塔', en: 'Lighthouse', emoji: '🗼' },
  { id: 'temple', zh: '寺庙', en: 'Temple', emoji: '🏯' },
  { id: 'shrine', zh: '神社', en: 'Shrine', emoji: '⛩️' },
  { id: 'pagoda', zh: '五重塔', en: 'Pagoda', emoji: '🛕' },
  { id: 'castle-gate', zh: '城堡门', en: 'Castle Gate', emoji: '🏰' },
  { id: 'candy-shop', zh: '糖果店', en: 'Candy Shop', emoji: '🍭' },
  { id: 'chocolate-factory', zh: '巧克力工厂', en: 'Chocolate Factory', emoji: '🍫' },
  { id: 'coffee-cafe', zh: '咖啡馆', en: 'Coffee Cafe', emoji: '☕' },
  { id: 'tea-house', zh: '茶馆', en: 'Tea House', emoji: '🍵' },
  { id: 'grand-hotel', zh: '大酒店', en: 'Grand Hotel', emoji: '🏨' },
  { id: 'inn', zh: '小旅馆', en: 'Inn', emoji: '🛏️' },
  { id: 'school', zh: '学校', en: 'School', emoji: '🏫' },
  { id: 'university', zh: '大学', en: 'University', emoji: '🎓' },
  { id: 'stadium', zh: '体育场', en: 'Stadium', emoji: '🏟️' },
  { id: 'ice-rink', zh: '溜冰场', en: 'Ice Rink', emoji: '⛸️' },
  { id: 'bowling-alley', zh: '保龄球馆', en: 'Bowling Alley', emoji: '🎳' },
  { id: 'karaoke-box', zh: '卡拉OK', en: 'Karaoke Box', emoji: '🎤' },
  { id: 'hot-spring', zh: '温泉', en: 'Hot Spring', emoji: '♨️' },
  { id: 'public-bath', zh: '公共浴场', en: 'Public Bath', emoji: '🛁' },
  { id: 'ferris-wheel', zh: '摩天轮', en: 'Ferris Wheel', emoji: '🎡' },
  { id: 'carousel', zh: '旋转木马', en: 'Carousel', emoji: '🎠' },
  { id: 'roller-coaster', zh: '过山车', en: 'Roller Coaster', emoji: '🎢' },
  { id: 'haunted-house', zh: '鬼屋', en: 'Haunted House', emoji: '👻' },
  { id: 'fun-house', zh: '哈哈屋', en: 'Fun House', emoji: '🤡' },
  { id: 'maze-garden', zh: '迷宫花园', en: 'Maze Garden', emoji: '🌿' },
  { id: 'vineyard', zh: '葡萄园', en: 'Vineyard', emoji: '🍇' },
  { id: 'tea-plantation', zh: '茶园', en: 'Tea Plantation', emoji: '🍃' },
  { id: 'bee-apiary', zh: '蜜蜂农场', en: 'Bee Apiary', emoji: '🐝' },
  { id: 'cheese-dairy', zh: '奶酪坊', en: 'Cheese Dairy', emoji: '🧀' },
  { id: 'fish-market', zh: '鱼市', en: 'Fish Market', emoji: '🐟' },
  { id: 'flower-market', zh: '花市', en: 'Flower Market', emoji: '🌷' },
  { id: 'antique-shop', zh: '古董店', en: 'Antique Shop', emoji: '🕰️' },
  { id: 'book-cafe', zh: '书吧', en: 'Book Cafe', emoji: '📖' },
  { id: 'art-studio', zh: '画室', en: 'Art Studio', emoji: '🎨' },
  { id: 'music-hall', zh: '音乐厅', en: 'Music Hall', emoji: '🎼' },
  { id: 'theater', zh: '剧院', en: 'Theater', emoji: '🎭' },
  { id: 'opera-house', zh: '歌剧院', en: 'Opera House', emoji: '🎪' },
  { id: 'planetarium', zh: '天文馆', en: 'Planetarium', emoji: '🪐' },
  { id: 'science-lab', zh: '科学实验室', en: 'Science Lab', emoji: '🔬' },
  { id: 'clinic', zh: '诊所', en: 'Clinic', emoji: '🩺' },
  { id: 'fire-station', zh: '消防站', en: 'Fire Station', emoji: '🚒' },
  { id: 'police-box', zh: '派出所', en: 'Police Box', emoji: '🚓' },
  { id: 'post-office', zh: '邮局', en: 'Post Office', emoji: '📮' },
  { id: 'bank', zh: '银行', en: 'Bank', emoji: '🏦' },
  { id: 'courthouse', zh: '法院', en: 'Courthouse', emoji: '⚖️' },
  { id: 'city-hall', zh: '市政厅', en: 'City Hall', emoji: '🏛️' },
  { id: 'clock-tower', zh: '钟楼', en: 'Clock Tower', emoji: '🕰️' },
  { id: 'skyscraper', zh: '摩天楼', en: 'Skyscraper', emoji: '🏙️' },
  { id: 'apartment', zh: '公寓', en: 'Apartment', emoji: '🏢' },
  { id: 'subway-station', zh: '地铁站', en: 'Subway Station', emoji: '🚇' },
  { id: 'cable-car', zh: '缆车', en: 'Cable Car', emoji: '🚠' },
  { id: 'tram-stop', zh: '电车站', en: 'Tram Stop', emoji: '🚋' },
];

export interface BoardDef {
  kind: 'classic' | 'season2';
  tiles: TileDef[];
  nameZh: string;
  nameEn: string;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 第二季：地产格替换为随机 14 个景点，价位/租金沿用经典棋盘同位置 */
export function buildSeasonBoard(): BoardDef {
  const picked = shuffle(VENUES).slice(0, CLASSIC_TILES.filter((t) => t.price !== null).length);
  let k = 0;
  const tiles = CLASSIC_TILES.map((tile) => {
    if (tile.price === null) return tile;
    const venue = picked[k++];
    return {
      id: venue.id,
      zh: venue.zh,
      en: venue.en,
      price: tile.price,
      rent: tile.rent,
      emoji: venue.emoji,
      art: `mono2-${venue.id}`,
    };
  });
  return { kind: 'season2', tiles, nameZh: '环游小镇', nameEn: 'Tour Town' };
}

/** 开局随机：经典咕咕镇 / 第二季环游小镇 */
export function buildBoard(): BoardDef {
  if (Math.random() < 0.5) {
    return { kind: 'classic', tiles: CLASSIC_TILES, nameZh: '咕咕镇', nameEn: 'GuGu Town' };
  }
  return buildSeasonBoard();
}