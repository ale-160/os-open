/**
 * 第 5 批素材接线回归：场景时态图 / 大富翁第二季地块 / 各游戏素材文件必须齐全。
 * 这些素材不入 git（构建时本地生成），用存在性断言防止接线到不存在的文件。
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCENES, SCENE_VARIANTS, sceneVariantFor } from './scenes';
import { CLASSIC_TILES, VENUES, buildSeasonBoard } from './monopoly';
import { ACCESSORIES, DECORATIONS } from './accessories';
import { VISITORS } from './visitors';
import { EXTRA_FACES } from './stickers';
import { sceneShopItems, variantShopItems } from './shop-extra';
import { VARIANTS } from './skins';

const ROOT = path.join(process.cwd(), 'public', 'skins', 'gugu');
const GAME_DIR = path.join(ROOT, 'game');
const SCENE_DIR = path.join(ROOT, 'scene');

const game = (file: string) => path.join(GAME_DIR, file);
const scene = (file: string) => path.join(SCENE_DIR, file);
const asset = (file: string) => path.join(ROOT, file);
/** CI 不携带素材（public 不入库）：仅本地有素材时跑存在性断言 */
const HAS_ASSETS = existsSync(SCENE_DIR);
const assetIt = HAS_ASSETS ? it : it.skip;
const assetDescribe = HAS_ASSETS ? describe : describe.skip;

describe('场景时态变体', () => {
  assetIt('每个场景 × 每种时态都有图', () => {
    const missing: string[] = [];
    for (const s of SCENES) {
      for (const v of SCENE_VARIANTS) {
        const file = `${s.id}-${v}.png`;
        if (!existsSync(scene(file))) missing.push(file);
      }
    }
    expect(missing).toEqual([]);
  });

  it('天气优先：雨/雪天用对应变体', () => {
    const d = new Date(2026, 5, 10, 12, 0, 0);
    expect(['rain', 'storm']).toContain(sceneVariantFor(d, 'rain'));
    expect(sceneVariantFor(d, 'snow')).toBe('snow');
  });

  it('节日优先于时段（非坏天气时）', () => {
    expect(sceneVariantFor(new Date(2026, 0, 1, 12), 'sunny')).toBe('festival');
    expect(sceneVariantFor(new Date(2026, 9, 1, 15), 'cloudy')).toBe('festival');
  });

  it('同一时刻结果稳定', () => {
    const d = new Date(2026, 9, 25, 21, 30);
    expect(sceneVariantFor(d, 'sunny')).toBe(sceneVariantFor(d, 'sunny'));
  });
});

describe('小游戏素材接线', () => {
  assetIt('消消乐宝石素材 28 张齐全', () => {
    const ids = ['ruby', 'emerald', 'sapphire', 'amethyst', 'topaz', 'opal', 'garnet', 'peridot',
      'aquamarine', 'citrine', 'tourmaline', 'moonstone', 'onyx', 'jade', 'lapis', 'turquoise',
      'spinel', 'zircon', 'tanzanite', 'morganite', 'alexandrite', 'labradorite', 'rose-quartz',
      'obsidian', 'amber', 'smoky-quartz', 'sunstone', 'fluorite'];
    expect(ids.filter((id) => !existsSync(game(`m3b-${id}.png`)))).toEqual([]);
  });

  assetIt('连连看森林素材 48 张 + 甜点 24 张齐全', () => {
    const forest = ['mushroom-fly', 'mushroom-puffball', 'mushroom-coral', 'mushroom-porcini',
      'mushroom-blue', 'mushroom-amber', 'mushroom-chanterelle', 'mushroom-purple',
      'cone-spruce', 'cone-larch', 'cone-pine', 'cone-sweetgum',
      'nut-acorn', 'nut-walnut', 'nut-hazelnut', 'nut-chestnut',
      'leaf-ginkgo', 'leaf-ivy', 'leaf-maple', 'leaf-birch', 'leaf-fern', 'leaf-oak', 'leaf-aspen', 'leaf-willow',
      'berry-strawberry', 'berry-blueberry', 'berry-lingonberry', 'berry-blackberry',
      'berry-rosehip', 'berry-elderberry', 'berry-currant', 'berry-rowan',
      'flower-violet', 'flower-thistle', 'flower-snowdrop', 'flower-lily-valley',
      'flower-clover', 'flower-daisy', 'flower-dandelion', 'flower-poppy',
      'forest-log', 'forest-amber', 'forest-moss-rock', 'forest-nest',
      'forest-snail-shell', 'forest-stump', 'forest-feather', 'forest-wood-slice'];
    expect(forest.length).toBe(48);
    expect(forest.filter((id) => !existsSync(game(`llk2-${id}.png`)))).toEqual([]);
    const bakery = ['taiyaki', 'dango', 'tart', 'macaron', 'pudding2', 'croissant', 'pretzel', 'waffle',
      'candy-apple', 'mochi', 'senbei', 'melonbread', 'crepe', 'parfait', 'shortcake', 'eclair',
      'madeleine', 'biscuit', 'jam-toast', 'cinnamon-roll', 'strawberry-pocky', 'chocolate-cornet',
      'lemon-tart', 'cream puff'];
    expect(bakery.filter((id) => !existsSync(game(`llk-${id}.png`)))).toEqual([]);
  });

  assetIt('幻咕合成 8 系 × 1/3/5 阶图片齐全', () => {
    const families = ['shadow', 'light', 'thunder', 'frost', 'blossom', 'rock', 'gale', 'abyss'];
    const missing: string[] = [];
    for (const f of families) for (const lv of [1, 3, 5]) {
      if (!existsSync(game(`merge2-${f}-${lv}.png`))) missing.push(`merge2-${f}-${lv}.png`);
    }
    expect(missing).toEqual([]);
  });

  assetIt('季节棋盘背景 4 张齐全', () => {
    for (const s of ['spring', 'summer', 'autumn', 'winter']) {
      expect(existsSync(game(`bg2-${s}-day.png`))).toBe(true);
    }
  });
});

describe('大富翁第二季棋盘', () => {
  assetIt('60 个景点素材齐全', () => {
    expect(VENUES.length).toBe(60);
    expect(VENUES.filter((v) => !existsSync(game(`mono2-${v.id}.png`)))).toEqual([]);
  });

  it('第二季保留 22 格与事件格位置，14 个地产格来自景点池', () => {
    const board = buildSeasonBoard();
    expect(board.tiles.length).toBe(CLASSIC_TILES.length);
    const eventIds = ['start', 'luck', 'bus', 'tax', 'river', 'chest', 'festival', 'hospital'];
    eventIds.forEach((id) => {
      const idx = CLASSIC_TILES.findIndex((t) => t.id === id);
      expect(board.tiles[idx].id).toBe(id);
      expect(board.tiles[idx].price).toBeNull();
    });
    const properties = board.tiles.filter((t) => t.price !== null);
    expect(properties.length).toBe(14);
    expect(properties.every((t) => t.art?.startsWith('mono2-'))).toBe(true);
    // 地产格不重复
    expect(new Set(properties.map((t) => t.id)).size).toBe(14);
  });

  assetIt('经典棋盘图片齐全', () => {
    expect(CLASSIC_TILES.filter((t) => !existsSync(game(`${t.art ?? `mono-${t.id}`}.png`)))).toEqual([]);
  });
});

assetDescribe('第 5 批装扮 / 装饰 / 表情 / 访客', () => {
  it('新装扮 80 件齐全且 id 不重复', () => {
    const items = ACCESSORIES.filter((a) => a.id.startsWith('b4b-'));
    expect(items.length).toBe(80);
    expect(items.filter((a) => !existsSync(asset(a.file)))).toEqual([]);
    expect(new Set(ACCESSORIES.map((a) => a.id)).size).toBe(ACCESSORIES.length);
  });

  it('新装饰 60 件齐全且 id 不重复', () => {
    const items = DECORATIONS.filter((d) => d.id.startsWith('b4b-'));
    expect(items.length).toBe(60);
    expect(items.filter((d) => !existsSync(asset(d.file)))).toEqual([]);
    expect(new Set(DECORATIONS.map((d) => d.id)).size).toBe(DECORATIONS.length);
  });

  it('场景表情 40 张齐全', () => {
    expect(EXTRA_FACES.length).toBe(40);
    expect(EXTRA_FACES.filter((name) => !existsSync(asset(`face/${name}.png`)))).toEqual([]);
  });

  it('传说访客 20 只齐全', () => {
    const legend = VISITORS.filter((v) => v.id.startsWith('v3-'));
    expect(legend.length).toBe(20);
    expect(legend.filter((v) => !existsSync(asset(`vis/${v.id}.png`)))).toEqual([]);
  });

  it('全部访客素材齐全且 id 不重复', () => {
    expect(new Set(VISITORS.map((v) => v.id)).size).toBe(VISITORS.length);
    expect(VISITORS.filter((v) => !existsSync(asset(`vis/${v.id}.png`))).map((v) => v.id)).toEqual([]);
  });
});
describe('商店配色 / 场景', () => {
  it('每个配色与场景都有购买项（价格 > 0、id 唯一）', () => {
    const variants = variantShopItems();
    const scenes = sceneShopItems();
    expect(variants.length).toBe(VARIANTS.length);
    expect(scenes.length).toBe(SCENES.length);
    expect(variants.every((i) => i.kind === 'variant' && !!i.variant && i.price > 0)).toBe(true);
    expect(scenes.every((i) => i.kind === 'scene' && !!i.scene && i.price > 0)).toBe(true);
    expect(new Set([...variants, ...scenes].map((i) => i.id)).size).toBe(VARIANTS.length + SCENES.length);
  });

  assetIt('配色蛋图与场景图齐全', () => {
    expect(VARIANTS.filter((v) => !existsSync(asset(`${v.id}-egg.png`)))).toEqual([]);
    expect(SCENES.filter((s) => !existsSync(asset(s.file)))).toEqual([]);
  });
});
