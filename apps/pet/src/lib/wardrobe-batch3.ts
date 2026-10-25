/**
 * 第 5 批装扮（acc/<英文名>.png）与房间装饰（deco/<英文名>.png）。
 * id 用 b4b-<n> 保持内部稳定；文件名统一按英文名生成 kebab-case，便于在目录/R2 中辨认。
 */

import type { AccessoryDef, DecoDef } from './accessories';
import type { AccessoryId, DecoId } from './types';

/** 英文名 → 文件名（与 tools/rename-b4b.mjs 保持一致） */
export function assetSlug(en: string): string {
  return en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** [素材序号, 中文名, 英文名, icon, 锚点, 价格, 中文说明, 英文说明] */
type AccRow = readonly [number, string, string, string, AccessoryDef['anchor'], number, string, string];

const ACC_ROWS: readonly AccRow[] = [
  // 春 1-12
  [1, '樱花发夹', 'Sakura Clip', '🌸', 'side', 16, '春日限定的小花瓣', 'Spring petals'],
  [2, '郁金香帽针', 'Tulip Pin', '🌷', 'side', 14, '把春天别在头上', 'Spring on your head'],
  [3, '蝶翼发夹', 'Butterfly Clip', '🦋', 'side', 16, '会跟着咕咕一起扇动', 'Flutter along'],
  [4, '四叶草胸针', 'Clover Brooch', '🍀', 'scarf', 15, '幸运值悄悄 +1', 'A little luck'],
  [5, '嫩芽发带', 'Sprout Band', '🌱', 'head', 15, '刚冒头的小嫩芽', 'Just sprouted'],
  [6, '紫藤胸花', 'Wisteria Corsage', '💜', 'scarf', 16, '一串温柔的紫色', 'Gentle purple'],
  [7, '彩虹别针', 'Rainbow Pin', '🌈', 'scarf', 14, '雨后天晴的颜色', 'After the rain'],
  [8, '波点雨帽', 'Rain Bonnet', '☔', 'head', 18, '下雨天也要可爱', 'Cute in the rain'],
  [9, '雏菊手链', 'Daisy Bracelet', '🌼', 'side', 12, '小小的白色花瓣', 'Tiny white petals'],
  [10, '绿叶围巾', 'Leaf Scarf', '🍃', 'scarf', 18, '像把春天围在脖子上', 'Wear the spring'],
  [11, '兔耳兜帽', 'Bunny Hood', '🐰', 'head', 20, '耳朵会跟着抖', 'Fluffy ears'],
  [12, '樱花绒球发绳', 'Sakura Pom', '🎀', 'side', 12, '软软的粉色绒球', 'Soft pink pom'],
  // 夏 13-24
  [13, '贝壳发夹', 'Shell Clip', '🐚', 'side', 14, '装着海浪的声音', 'Sound of waves'],
  [14, '海星发针', 'Starfish Pin', '⭐', 'side', 13, '五角星的小海星', 'A tiny starfish'],
  [15, '西瓜渔夫帽', 'Melon Hat', '🍉', 'head', 20, '夏天的味道', 'Taste of summer'],
  [16, '棕榈草帽', 'Palm Straw Hat', '🌴', 'head', 20, '海岛度假风', 'Island vacation'],
  [17, '浮潜面罩', 'Snorkel Mask', '🤿', 'eyes', 18, '准备下水看鱼', 'Ready to dive'],
  [18, '救生圈', 'Life Ring', '🛟', 'scarf', 16, '安全第一', 'Safety first'],
  [19, '花环项链', 'Flower Lei', '🌺', 'scarf', 16, '热情的夏威夷风', 'Aloha vibes'],
  [20, '海浪围巾', 'Wave Scarf', '🌊', 'scarf', 18, '蓝色波浪纹', 'Blue waves'],
  [21, '水母挂针', 'Jellyfish Pin', '🪼', 'side', 15, '透明的小水母', 'Translucent jelly'],
  [22, '珊瑚发针', 'Coral Pin', '🪸', 'side', 14, '粉橙色小珊瑚', 'Pink coral'],
  [23, '冰棒发夹', 'Ice Pop Clip', '🍧', 'side', 12, '看着就凉快', 'Cooling look'],
  [24, '帆船别针', 'Sailboat Pin', '⛵', 'scarf', 14, '向海风出发', 'Set sail'],
  // 秋 25-36
  [25, '枫叶发针', 'Maple Pin', '🍁', 'side', 14, '秋天落在头发上', 'Autumn in your hair'],
  [26, '橡果贝雷帽', 'Acorn Beret', '🌰', 'head', 18, '松鼠最爱的帽子', 'Squirrel favorite'],
  [27, '狐狸耳发箍', 'Fox Ear Band', '🦊', 'head', 18, '秋天的橙色耳朵', 'Autumn orange ears'],
  [28, '南瓜毛线帽', 'Pumpkin Beanie', '🎃', 'head', 18, '带一片小叶子', 'With a leaf stem'],
  [29, '麦穗花环', 'Wheat Wreath', '🌾', 'head', 20, '丰收的颜色', 'Harvest gold'],
  [30, '蘑菇胸针', 'Mushroom Brooch', '🍄', 'scarf', 15, '森林系小蘑菇', 'Forest mushroom'],
  [31, '松果项链', 'Pinecone Necklace', '🌲', 'scarf', 16, '松木的香气', 'Pine scent'],
  [32, '栗子胸针', 'Chestnut Brooch', '🌰', 'scarf', 14, '圆滚滚的栗子', 'Round chestnut'],
  [33, '橙色格纹围巾', 'Plaid Orange Scarf', '🧣', 'scarf', 18, '暖烘烘的格纹', 'Warm plaid'],
  [34, '琥珀项链', 'Amber Necklace', '🟠', 'scarf', 18, '里面藏着阳光', 'Sunlight inside'],
  [35, '银杏发针', 'Ginkgo Pin', '🍂', 'side', 14, '小扇子一样的叶子', 'Fan-shaped leaf'],
  [36, '橡果小包', 'Acorn Bag', '👜', 'side', 20, '装几颗小坚果', 'Full of nuts'],
  // 冬 37-48
  [37, '冰蓝雪花发夹', 'Snowflake Clip', '❄️', 'side', 15, '不会融化的雪花', 'Never melts'],
  [38, '白色绒球帽', 'White Pom Beanie', '⚪', 'head', 18, '软乎乎的白色', 'Fluffy white'],
  [39, '白色毛绒披风', 'Fur Cape', '🧥', 'scarf', 24, '像裹了一条云', 'Wrapped in a cloud'],
  [40, '雪花球项链', 'Snow Globe Necklace', '🔮', 'scarf', 18, '摇一摇会下雪', 'Shake for snow'],
  [41, '冰晶发针', 'Icicle Pin', '🧊', 'side', 16, '亮晶晶的冰棱', 'Sparkling ice'],
  [42, '北极熊耳发箍', 'Polar Band', '🐻‍❄️', 'head', 18, '圆圆的白色耳朵', 'Round white ears'],
  [43, '手套挂绳', 'Mittens', '🧤', 'scarf', 14, '再也不会丢', 'Never lose them'],
  [44, '水晶雪花胸针', 'Crystal Snow Brooch', '💠', 'scarf', 17, '六角形的光', 'Hexagonal light'],
  [45, '冬青果发针', 'Holly Pin', '🎄', 'side', 14, '红果配绿叶', 'Berries and leaves'],
  [46, '雪人纽扣胸针', 'Snowman Brooch', '⛄', 'scarf', 14, '三个小纽扣', 'Three buttons'],
  [47, '拐杖糖发夹', 'Candy Cane Clip', '🍬', 'side', 12, '甜甜的红白条纹', 'Sweet stripes'],
  [48, '极光薄纱', 'Aurora Veil', '🌌', 'side', 22, '会变色的薄纱', 'Color-shifting veil'],
  // 角色 49-64
  [49, '骑士头盔', 'Knight Helmet', '🛡️', 'head', 26, '带羽毛的银色头盔', 'Silver with plume'],
  [50, '公主皇冠', 'Princess Tiara', '👑', 'head', 28, '粉钻小皇冠', 'Pink gem tiara'],
  [51, '女巫帽', 'Witch Hat', '🧙', 'head', 24, '星星扣带', 'Star buckle'],
  [52, '海盗三角帽', 'Pirate Hat', '🏴‍☠️', 'head', 24, '骷髅标记', 'Skull mark'],
  [53, '海盗眼罩', 'Eye Patch', '🏴‍☠️', 'eyes', 12, '帅气的黑眼罩', 'Dashing patch'],
  [54, '皇家披风', 'Royal Cape', '👑', 'scarf', 26, '红丝绒白毛边', 'Red velvet trim'],
  [55, '厨师围裙', 'Chef Apron', '👨‍🍳', 'scarf', 20, '口袋里装着食谱', 'Recipe in pocket'],
  [56, '消防头盔', 'Fire Helmet', '🚒', 'head', 24, '红色小头盔', 'Little red helmet'],
  [57, '警帽', 'Police Cap', '🚓', 'head', 22, '带徽章的藏青帽', 'Navy with badge'],
  [58, '水手帽', 'Sailor Cap', '⚓', 'head', 20, '白色水手帽', 'White sailor cap'],
  [59, '探险头盔', 'Pith Helmet', '🗺️', 'head', 22, '去丛林探险', 'Jungle explorer'],
  [60, '矿工头盔', 'Miner Helmet', '⛏️', 'head', 22, '前面的小灯会亮', 'Headlamp ready'],
  [61, '飞行帽', 'Aviator Cap', '🥽', 'head', 22, '皮质飞行帽', 'Leather aviator'],
  [62, '牛仔帽', 'Cowboy Hat', '🤠', 'head', 22, '棕色宽檐帽', 'Brown wide brim'],
  [63, '忍者头带', 'Ninja Band', '🥷', 'head', 18, '红色带子飘呀飘', 'Red tails'],
  [64, '魔术棒', 'Magic Wand', '🪄', 'side', 20, '星星会发光', 'Glowing star'],
  // 幻想 65-80
  [65, '羽毛披肩', 'Feather Shawl', '🪶', 'scarf', 22, '轻飘飘的白色羽毛', 'Soft white feathers'],
  [66, '彩虹羽发针', 'Rainbow Feather', '🌈', 'side', 16, '七彩羽毛', 'Rainbow plume'],
  [67, '水晶发冠', 'Crystal Crown', '💎', 'head', 26, '石英晶簇', 'Quartz cluster'],
  [68, '冰晶翅膀', 'Ice Wings', '❄️', 'side', 28, '透明的小翅膀', 'Translucent wings'],
  [69, '木雕叶发针', 'Wood Leaf Pin', '🪵', 'side', 14, '手工木雕叶子', 'Carved leaf'],
  [70, '草编小包', 'Straw Bag', '👜', 'side', 20, '编着小花', 'Woven with flowers'],
  [71, '玻璃鞋别针', 'Slipper Pin', '👠', 'scarf', 16, '亮晶晶的玻璃鞋', 'Glassy slipper'],
  [72, '青花瓷发针', 'Porcelain Pin', '🏺', 'side', 16, '蓝白花纹', 'Blue and white'],
  [73, '金线刺绣围巾', 'Gold Scarf', '✨', 'scarf', 20, '金线绣的小花', 'Gold embroidery'],
  [74, '银铃手链', 'Silver Bell', '🔔', 'side', 14, '走一步响一下', 'Jingle jingle'],
  [75, '果冻发夹', 'Jelly Pin', '🍮', 'side', 14, '半透明的果冻', 'Translucent jelly'],
  [76, '葡萄紫丝绒蝴蝶结', 'Grape Bow', '🎀', 'side', 15, '丝绒质地', 'Velvet texture'],
  [77, '蕾丝领', 'Lace Collar', '🤍', 'scarf', 16, '白色蕾丝花边', 'White lace'],
  [78, '牛仔小帽', 'Denim Cap', '🧢', 'head', 16, '复古水洗蓝', 'Washed blue'],
  [79, '大理石珠项链', 'Marble Necklace', '⚪', 'scarf', 18, '每颗纹理都不同', 'Unique marbles'],
  [80, '闪纱小头纱', 'Tulle Veil', '✨', 'side', 20, '亮片薄纱', 'Glitter tulle'],
];

export const ACCESSORIES_BATCH3: AccessoryDef[] = ACC_ROWS.map(
  ([n, zh, en, icon, anchor, price, zhDesc, enDesc]) => ({
    id: `b4b-${n}` as AccessoryId,
    file: `acc/${assetSlug(en)}.png`,
    anchor,
    icon,
    zh,
    en,
    zhDesc,
    enDesc,
    price,
  }),
);

/** [素材序号, 中文名, 英文名, icon, 价格, 中文说明, 英文说明] */
type DecoRow = readonly [number, string, string, string, number, string, string];

const DECO_ROWS: readonly DecoRow[] = [
  // 春 1-12
  [1, '盆栽樱花树', 'Potted Sakura', '🌸', 30, '满开的粉色小树', 'Full bloom'],
  [2, '郁金香花圃', 'Tulip Bed', '🌷', 24, '木边小花圃', 'Wooden border'],
  [3, '白栅栏蘑菇', 'Picket Fence', '🚧', 22, '栅栏上长着小蘑菇', 'With mushroom caps'],
  [4, '蝴蝶喂食台', 'Butterfly Feeder', '🦋', 20, '放着水果的小台子', 'Fruit feeder'],
  [5, '紫藤花架', 'Wisteria Arch', '💜', 28, '垂下来的紫色花', 'Hanging purple'],
  [6, '小花车', 'Flower Cart', '🌼', 26, '装满花束的小推车', 'Full of bouquets'],
  [7, '雨靴花盆', 'Boot Planter', '🌧️', 20, '雨靴里种着花', 'Flowers in boots'],
  [8, '圆形小泳池', 'Round Pool', '🏊', 28, '带小梯子', 'With a ladder'],
  [9, '遮阳伞躺椅', 'Parasol Set', '⛱️', 24, '晒太阳全套', 'Sunbathing set'],
  [10, '彩虹洒水器', 'Sprinkler', '💦', 18, '喷出彩虹水珠', 'Rainbow drops'],
  [11, '水管花盆', 'Hose Pot', '🪣', 16, '卷起来的水管', 'Coiled hose'],
  [12, '贝壳风铃', 'Shell Chime', '🐚', 18, '海风的声音', 'Ocean breeze'],
  // 夏 13-24
  [13, '西瓜小桌', 'Melon Table', '🍉', 24, '配两只小凳', 'With two stools'],
  [14, '柠檬水摊', 'Lemonade Stand', '🍋', 24, '现榨柠檬水', 'Fresh lemonade'],
  [15, '落叶堆', 'Leaf Pile', '🍂', 16, '可以跳进去', 'Jump right in'],
  [16, '南瓜收获车', 'Pumpkin Cart', '🎃', 24, '装满南瓜', 'Full of pumpkins'],
  [17, '橡果篮子', 'Acorn Basket', '🌰', 16, '松鼠的存粮', 'Squirrel stash'],
  [18, '枫叶拱门', 'Maple Arch', '🍁', 28, '红枫搭的门', 'Maple gate'],
  [19, '圆形干草捆', 'Hay Bale', '🌾', 18, '农场味道', 'Farm vibes'],
  [20, '灯笼果灌木', 'Berry Bush', '🫐', 20, '果实会发光', 'Glowing berries'],
  [21, '稻草人', 'Scarecrow', '🧑‍🌾', 24, '戴着草帽', 'Straw hat'],
  [22, '雪人小屋', 'Snow Playhouse', '⛄', 32, '胡萝卜鼻子门', 'Carrot nose door'],
  [23, '雪松灯树', 'Snow Pine', '🌲', 24, '挂着小灯', 'With lights'],
  [24, '冰灯雕塑', 'Ice Lantern', '🧊', 20, '会透出蓝光', 'Glowing blue'],
  // 秋冬 25-38
  [25, '木雪橇', 'Wooden Sled', '🛷', 18, '靠在雪边', 'Leaning on snow'],
  [26, '手套围巾架', 'Mitten Stand', '🧤', 16, '出门前取用', 'Grab and go'],
  [27, '结冰鸟浴盆', 'Frozen Birdbath', '⛲', 20, '冰花纹路', 'Ice patterns'],
  [28, '雪人一家三口', 'Snowman Family', '⛄', 28, '三个雪人', 'Three snowmen'],
  [29, '红灯笼串', 'Lantern String', '🏮', 22, '一串红灯笼', 'Red lanterns'],
  [30, '金色中国结', 'Lucky Knot', '🧧', 18, '挂着的福气', 'Hanging luck'],
  [31, '红包树', 'Envelope Tree', '🧧', 26, '挂满小红包', 'Full of packets'],
  [32, '鞭炮挂饰', 'Firecracker String', '🧨', 18, '噼里啪啦', 'Pop pop'],
  [33, '舞龙头手偶', 'Dragon Puppet', '🐉', 24, '举着会摇头', 'Wiggly dragon'],
  [34, '纸扇墙饰', 'Fan Wall', '🪭', 18, '一排小纸扇', 'Paper fan row'],
  [35, '兔子纸灯', 'Rabbit Lantern', '🐰', 20, '圆圆的兔子灯', 'Round rabbit'],
  [36, '月饼茶摊', 'Mooncake Stand', '🥮', 24, '配一壶茶', 'With tea'],
  [37, '纸月亮灯', 'Paper Moon Lamp', '🌕', 22, '会发光的大月亮', 'Glowing moon'],
  [38, '桂花盆栽', 'Osmanthus Pot', '🌼', 18, '香香的小黄花', 'Fragrant blooms'],
  // 节日/游乐 39-60
  [39, '幽灵气球串', 'Ghost Balloons', '👻', 20, '飘着的小幽灵', 'Floating ghosts'],
  [40, '女巫坩埚', 'Witch Cauldron', '🧪', 22, '冒绿泡泡', 'Green bubbles'],
  [41, '南瓜糖碗', 'Candy Bowl', '🍬', 16, '南瓜脸糖碗', 'Pumpkin face'],
  [42, '蝙蝠拉花', 'Bat Garland', '🦇', 16, '一排小蝙蝠', 'Bat banner'],
  [43, '鬼屋拱门', 'Spooky Arch', '🎃', 28, '带南瓜的拱门', 'Pumpkin arch'],
  [44, '礼物堆', 'Gift Pile', '🎁', 24, '系着丝带', 'Ribbon wrapped'],
  [45, '拐杖糖栅栏', 'Candy Cane Fence', '🍬', 20, '红白条纹', 'Red and white'],
  [46, '姜饼屋', 'Gingerbread House', '🏠', 30, '糖霜屋顶', 'Icing roof'],
  [47, '驯鹿雪橇', 'Reindeer Sleigh', '🦌', 28, '装满礼物', 'Full of gifts'],
  [48, '花环灯柱', 'Wreath Post', '🎄', 22, '挂着花环的路灯', 'Wreath lamp'],
  [49, '木秋千架', 'Swing Frame', '🌳', 24, '吱呀吱呀', 'Creaky swing'],
  [50, '小蹦床', 'Trampoline', '🤸', 22, '弹跳快乐', 'Bounce fun'],
  [51, '粉彩滑梯', 'Playground Slide', '🛝', 26, '粉色小滑梯', 'Pastel slide'],
  [52, '粉彩跷跷板', 'Seesaw', '⚖️', 22, '一上一下', 'Up and down'],
  [53, '木沙坑', 'Sandbox', '🏖️', 20, '带小铲子', 'With toys'],
  [54, '攀爬架', 'Climb Frame', '🧗', 26, '带绳网', 'With rope net'],
  [55, '吊环', 'Gym Rings', '💍', 18, '一对小吊环', 'A pair of rings'],
  [56, '绳梯', 'Rope Ladder', '🪜', 18, '晃晃悠悠', 'Wobbly climb'],
  [57, '海洋球池', 'Ball Pit', '🎈', 24, '粉彩小球', 'Pastel balls'],
  [58, '平衡木', 'Balance Beam', '🪵', 18, '走稳一点', 'Walk steady'],
  [59, '迷你旋转木马', 'Mini Carousel', '🎠', 30, '会慢慢转', 'Slowly spins'],
  [60, '小篮球架', 'Basketball Hoop', '🏀', 22, '投一个试试', 'Take a shot'],
];

export const DECORATIONS_BATCH3: DecoDef[] = DECO_ROWS.map(
  ([n, zh, en, icon, price]) => ({
    id: `b4b-${n}` as DecoId,
    file: `deco/${assetSlug(en)}.png`,
    icon,
    zh,
    en,
    price,
  }),
);