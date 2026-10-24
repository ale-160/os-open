import { describe, expect, it } from 'vitest';

import { buildImagePrompt, buildSystemPrompt, joinUrl } from './ai';
import { decodeSkinCode, encodeSkinCode, faceLayoutFor } from './skins';

// 1x1 透明 PNG
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('ai prompt 构建', () => {
  it('中文 system prompt 含名字/阶段/性格/状态与回复约束', () => {
    const p = buildSystemPrompt(
      {
        name: '咕咕',
        stage: 'baby',
        satiety: 70.4,
        cleanliness: 80,
        mood: 30,
        energy: 60,
        health: 90,
        sick: false,
        dominantPersonality: 'foodie',
      },
      'zh'
    );
    expect(p).toContain('咕咕');
    expect(p).toContain('幼年');
    expect(p).toContain('吃货');
    expect(p).toContain('饱食 70');
    expect(p).toContain('不要自称 AI');
  });

  it('生病时提示虚弱语气', () => {
    const p = buildSystemPrompt(
      { name: 'GuGu', stage: 'teen', satiety: 10, cleanliness: 10, mood: 10, energy: 10, health: 20, sick: true, dominantPersonality: null },
      'en'
    );
    expect(p).toContain('sick');
  });

  it('图像 prompt 保留玩家句子并统一风格约束', () => {
    const p = buildImagePrompt('  一只蓝色戴围巾的咕咕  ');
    expect(p).toContain('一只蓝色戴围巾的咕咕');
    expect(p).toContain('kawaii flat sticker');
  });

  it('超长句子被截断到 120 字', () => {
    const p = buildImagePrompt('咕'.repeat(200));
    expect(p.startsWith('咕'.repeat(120))).toBe(true);
  });

  it('端点拼接容忍尾部斜杠', () => {
    expect(joinUrl('https://api.example.com/v1/', '/chat/completions')).toBe(
      'https://api.example.com/v1/chat/completions'
    );
  });
});

describe('皮肤分享码', () => {
  it('dataURL 皮肤编解码往返', () => {
    const skin = { name: '我的咕咕', imageDataUrl: TINY_PNG, faceOverlay: true };
    const code = encodeSkinCode(skin);
    expect(code.startsWith('guguskin1.')).toBe(true);
    expect(decodeSkinCode(code)).toEqual(skin);
  });

  it('URL 皮肤编解码往返（faceOverlay 缺省补 false）', () => {
    const code = encodeSkinCode({ name: 'remote', url: 'https://example.com/skin.png', faceOverlay: false });
    expect(decodeSkinCode(code)).toEqual({
      name: 'remote',
      url: 'https://example.com/skin.png',
      faceOverlay: false,
    });
  });

  it('非法输入抛错', () => {
    expect(() => decodeSkinCode('not-a-code')).toThrow();
    expect(() => decodeSkinCode('guguskin1.eyJmb28iOjF9')).toThrow();
  });
});

describe('分阶段表情定位', () => {
  it('蛋阶段回落到幼年布局；少年/成年与幼年不同', () => {
    expect(faceLayoutFor('mint', 'egg')).toEqual(faceLayoutFor('mint', 'baby'));
    expect(faceLayoutFor('cream', 'teen')).not.toEqual(faceLayoutFor('cream', 'baby'));
    expect(faceLayoutFor('sakura', 'adult').eyeY).toBeLessThan(faceLayoutFor('sakura', 'baby').eyeY);
  });
});
