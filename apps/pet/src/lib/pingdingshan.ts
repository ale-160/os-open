/**
 * 平顶山文旅目的地（与鹰悦拍 yyp.joydove.cn 联动）：
 * 数据来自鹰悦拍场景库 API（190+ 实景拍摄场景），精选 8 个文旅代表地。
 * 咕咕"出远门"旅行会去这些地方，寄回真实景点的明信片并引导用户去鹰悦拍查看。
 */

import { BASE_PATH } from './skins';
import { assetUrl } from './assetUrl';

export type PingdingshanDestId =
  | 'yaoshan'
  | 'buddha'
  | 'xiangshan'
  | 'baiguihu'
  | 'huameigu'
  | 'majie'
  | 'sansuyuan'
  | 'linfengzhai';

export interface PdsDestination {
  id: PingdingshanDestId;
  /** 鹰悦拍场景名（搜索用） */
  sceneName: string;
  district: string;
  zh: string;
  en: string;
  /** 鹰悦拍实景图路径（yyp.joydove.cn 域名） */
  photo: string;
  /** 联动插画（本地 AI 生成，GO 出发场景用） */
  scene: string;
  zhDesc: string;
  enDesc: string;
  /** 手信 */
  souvenirZh: string;
  souvenirEn: string;
  souvenirIcon: string;
  /** 咕咕旅行文案 */
  capsZh: [string, string];
  capsEn: [string, string];
}

export const YYP_BASE = 'https://yyp.joydove.cn';
export const YYP_URL = 'https://yyp.joydove.cn';

export const PDS_DESTS: PdsDestination[] = [
  {
    id: 'yaoshan',
    sceneName: '尧山风景区',
    district: '鲁山县',
    zh: '尧山',
    en: 'Mount Yao',
    photo: '/static/images/scenes/lushan/yaoshanfengjingqu.jpeg',
    scene: 'misc/scene-pds-yaoshan.png',
    zhDesc: '石人云海，四季风光',
    enDesc: 'Sea of clouds all year round',
    souvenirZh: '尧山云海石',
    souvenirEn: 'Cloud Stone',
    souvenirIcon: '🪨',
    capsZh: ['爬上尧山啦，云海就在脚下！', '山顶的风把羽毛都吹乱啦'],
    capsEn: ['Climbed Mount Yao! Clouds under my feet', 'The wind ruffled my feathers'],
  },
  {
    id: 'buddha',
    sceneName: '中原大佛（佛泉寺）',
    district: '鲁山县',
    zh: '中原大佛',
    en: 'Grand Buddha',
    photo: '/static/images/scenes/lushan/zhongyuandafufuquansi.jpeg',
    scene: 'misc/scene-pds-buddha.png',
    zhDesc: '世界第一高佛',
    enDesc: 'The tallest Buddha statue',
    souvenirZh: '祈福铃铛',
    souvenirEn: 'Prayer Bell',
    souvenirIcon: '🔔',
    capsZh: ['大佛好高好高，我仰头看得脖子酸', '在佛泉寺许了个愿，咕咕保佑你'],
    capsEn: ['The Buddha is SO tall! My neck hurts', 'Made a wish for you at Foquan Temple'],
  },
  {
    id: 'xiangshan',
    sceneName: '香山寺',
    district: '新华区',
    zh: '香山寺',
    en: 'Xiangshan Temple',
    photo: '/static/images/scenes/xinhua/xiangshansi.jpeg',
    scene: 'misc/scene-pds-xiangshan.png',
    zhDesc: '千年古刹钟声',
    enDesc: 'Thousand-year temple bells',
    souvenirZh: '平安符',
    souvenirEn: 'Amulet',
    souvenirIcon: '🧿',
    capsZh: ['寺里的钟声咚—咚—，好安静', '古树底下捡了一片好叶子'],
    capsEn: ['Temple bells: dong—dong—. So quiet', 'Found a perfect leaf under the old tree'],
  },
  {
    id: 'baiguihu',
    sceneName: '白龟湖国家湿地公园',
    district: '城乡一体化示范区',
    zh: '白龟湖',
    en: 'Baigui Lake',
    photo: '/static/images/scenes/shifanqu/baiguihuguojiashidigongy.jpeg',
    scene: 'misc/scene-pds-baiguihu.png',
    zhDesc: '白鹭翩翩的湖畔湿地',
    enDesc: 'Wetland with egrets',
    souvenirZh: '白鹭羽毛',
    souvenirEn: 'Egret Feather',
    souvenirIcon: '🪶',
    capsZh: ['湖边好多白鹭！学它们单腿站了好久', '湖水亮晶晶的，像撒了碎银子'],
    capsEn: ['So many egrets! I stood on one leg too', 'The lake sparkles like scattered silver'],
  },
  {
    id: 'huameigu',
    sceneName: '画眉谷/龙潭峡/十八垛',
    district: '鲁山县',
    zh: '画眉谷',
    en: 'Huamei Valley',
    photo: '/static/images/scenes/lushan/huameigulongtanxiashibad.jpeg',
    scene: 'misc/scene-pds-huameigu.png',
    zhDesc: '溪瀑成群的山谷',
    enDesc: 'Valley of streams and falls',
    souvenirZh: '溪谷石子',
    souvenirEn: 'Valley Pebble',
    souvenirIcon: '🪨',
    capsZh: ['瀑布的声音哗哗哗，嗓子都盖过了', '谷里的杜鹃花开得漫山都是'],
    capsEn: ['The waterfalls drown out my singing', 'Azaleas bloom all over the valley'],
  },
  {
    id: 'majie',
    sceneName: '马街书会景区',
    district: '宝丰县',
    zh: '马街书会',
    en: 'Majie Book Fair',
    photo: '/static/images/scenes/baofeng/majieshuhuijingqu.jpeg',
    scene: 'misc/scene-pds-majie.png',
    zhDesc: '七百年曲艺盛会',
    enDesc: '700-year folk art fair',
    souvenirZh: '曲艺折扇',
    souvenirEn: 'Storyteller Fan',
    souvenirIcon: '🪭',
    capsZh: ['麦田里说书的人真多，我也唱了一段！', '700 年的传统，太厉害了咕'],
    capsEn: ['Storytellers everywhere in the wheat field', '700 years of tradition. Amazing!'],
  },
  {
    id: 'sansuyuan',
    sceneName: '三苏园（三苏坟）景区',
    district: '郏县',
    zh: '三苏园',
    en: 'Sansu Garden',
    photo: '/static/images/scenes/jiaxian/sansuyuansansufenjingqu.jpeg',
    scene: 'misc/scene-pds-sansu.png',
    zhDesc: '苏东坡长眠之地',
    enDesc: 'Resting place of Su Shi',
    souvenirZh: '诗文书签',
    souvenirEn: 'Poem Bookmark',
    souvenirIcon: '📜',
    capsZh: ['古柏好庄严，我小声念了句诗', '三苏父子的故事讲不完'],
    capsEn: ['The cypresses are solemn. I whispered a poem', 'The Su family stories never end'],
  },
  {
    id: 'linfengzhai',
    sceneName: '临沣寨（中原第一红石古寨）',
    district: '郏县',
    zh: '临沣寨',
    en: 'Linfeng Village',
    photo: '/static/images/scenes/jiaxian/linfengzhaizhongyuandiyi.jpeg',
    scene: 'misc/scene-pds-linfengzhai.png',
    zhDesc: '中原第一红石古寨',
    enDesc: 'Red-stone ancient fortress',
    souvenirZh: '红石拓片',
    souvenirEn: 'Stone Rubbing',
    souvenirIcon: '🧱',
    capsZh: ['红石墙暖烘烘的，我贴了好久', '古寨的门洞里有回声！'],
    capsEn: ['The red-stone walls are warm. I leaned a while', 'The gate arch has an echo!'],
  },
];

export function pdsDestById(id: PingdingshanDestId): PdsDestination {
  return PDS_DESTS.find((d) => d.id === id) ?? PDS_DESTS[0];
}

/** 鹰悦拍场景实景图完整 URL */
export function yypPhotoUrl(d: PdsDestination): string {
  return `${YYP_BASE}${d.photo}`;
}

/** 联动插画完整 URL（本地素材） */
export function pdsSceneSrc(d: PdsDestination): string {
  return assetUrl(`${BASE_PATH}/skins/gugu/${d.scene}`);
}

/** 鹰悦拍场景详情搜索链接（分享/引导） */
export function yypScenesUrl(): string {
  return YYP_URL;
}
