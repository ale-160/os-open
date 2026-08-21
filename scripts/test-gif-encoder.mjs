/**
 * GIF 编码器往返验证脚本（Node 环境，不依赖浏览器）。
 *
 * 用法：
 *   node node_modules/typescript/bin/tsc src/utils/gifEncoder.ts --outDir .test-tmp --module commonjs --target es2020
 *   node scripts/test-gif-encoder.mjs
 *
 * 原理：用一份按 GIF89a 规范独立实现的参考解码器解析编码器输出，
 * 逐像素比对还原结果——精确颜色场景要求完全一致，量化场景校验结构有效性。
 */
import { createRequire } from 'node:module';
import assert from 'node:assert';

const require_ = createRequire(process.cwd() + '/package.json');
const { encodeGIF, encodeAnimatedGIF } = require_('./.test-tmp/gifEncoder.js');

// ─────────────────────────────────────────────────────────────────────────────
// 参考解码器（独立实现，不与编码器共享任何代码）
// ─────────────────────────────────────────────────────────────────────────────

function lzwDecode(data, minCodeSize, maxPixels) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let table = [];
  const resetTable = () => {
    // CLEAR 同时重置码表与码宽（GIF 规范）
    codeSize = minCodeSize + 1;
    table = [];
    for (let i = 0; i < clear; i++) table.push([i]);
    table.push(null); // clear 占位
    table.push(null); // eoi 占位
  };
  resetTable();

  let bitPos = 0;
  const readCode = () => {
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = data[bitPos >> 3];
      code |= ((byte >> (bitPos & 7)) & 1) << i;
      bitPos++;
    }
    return code;
  };

  const out = [];
  let prev = null;
  for (;;) {
    const code = readCode();
    if (code === clear) { resetTable(); prev = null; continue; }
    if (code === eoi) break;

    let entry;
    if (code < table.length && table[code]) {
      entry = table[code];
    } else if (code === table.length && prev) {
      entry = [...prev, prev[0]]; // KwKwK 特例
    } else {
      throw new Error(`invalid LZW code ${code} at pixel ${out.length}`);
    }

    for (const v of entry) {
      out.push(v);
      if (out.length > maxPixels * 2) throw new Error('output overflow');
    }

    // 表满（4096）后冻结，等待 CLEAR —— 与编码器行为对齐
    if (prev && table.length < 4096) {
      table.push([...prev, entry[0]]);
      if (table.length === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  if (out.length !== maxPixels) {
    throw new Error(`pixel count mismatch: got ${out.length}, want ${maxPixels}`);
  }
  return out;
}

function decodeGIF(buffer) {
  const b = Buffer.from(buffer);
  assert.ok(b.subarray(0, 6).toString('latin1') === 'GIF89a', 'bad header');
  const width = b.readUInt16LE(6);
  const height = b.readUInt16LE(8);
  const packed = b[10];
  const gctEntries = (packed >> 7) & 1 ? 2 ** ((packed & 0x07) + 1) : 0;

  let p = 13;
  const gct = [];
  for (let i = 0; i < gctEntries; i++) gct.push([b[p++], b[p++], b[p++]]);

  const frames = [];
  let hasLoop = false;
  let pendingGce = null; // { transparentIndex, delayCs }
  for (;;) {
    const block = b[p++];
    if (block === 0x3b) break; // trailer
    if (block === 0x21) {
      const label = b[p++];
      if (label === 0xf9) {
        // GCE: size(4) flags delay(2) tindex terminator
        const size = b[p++];
        const flags = b[p];
        pendingGce = {
          disposal: (flags >> 2) & 0x07,
          transparentIndex: (flags & 0x01) === 1 ? b[p + 3] : -1,
          delayCs: b.readUInt16LE(p + 1),
        };
        p += size;
        assert.strictEqual(b[p], 0, 'bad GCE terminator');
        p++;
      } else {
        // 应用/注释等扩展：标识块 + 子块序列
        let identifier = '';
        if (label === 0xff) {
          const size = b[p++];
          identifier = b.subarray(p, p + size).toString('latin1');
          p += size;
          if (identifier === 'NETSCAPE2.0') hasLoop = true;
        }
        while (b[p] !== 0) p += 1 + b[p];
        p++;
      }
    } else if (block === 0x2c) {
      const left = b.readUInt16LE(p);
      const top = b.readUInt16LE(p + 2);
      const iw = b.readUInt16LE(p + 4);
      const ih = b.readUInt16LE(p + 6);
      const descPacked = b[p + 8];
      p += 9;

      // 局部色表（若有）
      let table = gct;
      if ((descPacked >> 7) & 1) {
        const lctEntries = 2 ** ((descPacked & 0x07) + 1);
        table = [];
        for (let i = 0; i < lctEntries; i++) table.push([b[p++], b[p++], b[p++]]);
      }

      const minCodeSize = b[p++];
      const data = [];
      while (b[p] !== 0) {
        const n = b[p++];
        for (let i = 0; i < n; i++) data.push(b[p + i]);
        p += n;
      }
      p++; // 跳过子块结束符 0x00
      const indices = lzwDecode(data, minCodeSize, iw * ih);
      frames.push({
        left, top,
        width: iw, height: ih,
        gct: table,
        transparentIndex: pendingGce?.transparentIndex ?? -1,
        delayCs: pendingGce?.delayCs ?? 0,
        disposal: pendingGce?.disposal ?? 0,
        indices,
      });
      pendingGce = null;
    } else {
      const head = [...b.subarray(0, Math.min(b.length, 48))].map(x => x.toString(16).padStart(2, '0')).join(' ');
      throw new Error(`unknown block 0x${block.toString(16)} at ${p - 1}; total=${b.length}; head=${head}`);
    }
  }
  if (frames.length === 0) throw new Error('no image block found');
  return { width, height, frames, hasLoop };
}

function makeImageData(width, height, fill) {
  const data = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const [r, g, b, a] = fill(p, width, height);
    data[p * 4] = r; data[p * 4 + 1] = g; data[p * 4 + 2] = b; data[p * 4 + 3] = a;
  }
  return { width, height, data };
}

async function roundtrip(name, img, { exact = true } = {}) {
  const blob = encodeGIF(img);
  const buf = Buffer.from(await blob.arrayBuffer());
  assert.strictEqual(
    blob.type, 'image/gif', `${name}: mime mismatch`
  );
  const dec = decodeGIF(buf);
  assert.strictEqual(dec.frames.length, 1, `${name}: single-frame expected`);
  const frame = dec.frames[0];
  const { gct, indices, transparentIndex } = frame;

  for (let p = 0; p < dec.width * dec.height; p++) {
    const idx = indices[p];
    assert.ok(idx >= 0 && idx < gct.length, `${name}: index ${idx} out of range`);
    const x = p % dec.width, y = Math.floor(p / dec.width);

    if (transparentIndex >= 0 && idx === transparentIndex) {
      // 必须对应原图的透明像素（checker 场景）
      assert.strictEqual(
        img.data[p * 4 + 3] < 128, true,
        `${name}: pixel ${x},${y} transparent but source opaque`
      );
      continue;
    }
    const [pr, pg, pb] = gct[idx];
    if (exact) {
      assert.deepStrictEqual(
        [pr, pg, pb],
        [img.data[p * 4], img.data[p * 4 + 1], img.data[p * 4 + 2]],
        `${name}: pixel ${x},${y} color mismatch`
      );
      assert.strictEqual(img.data[p * 4 + 3] >= 128, true, `${name}: pixel ${x},${y} should be opaque`);
    }
  }
  console.log(`  ok  ${name} (${dec.width}x${dec.height}, palette<=${gct.length}, transparent=${transparentIndex})`);
}

async function roundtripAnimated(name, framesIn, { loop = true } = {}) {
  const blob = encodeAnimatedGIF(framesIn, { loop });
  const buf = Buffer.from(await blob.arrayBuffer());
  const dec = decodeGIF(buf);

  assert.strictEqual(dec.frames.length, framesIn.length, `${name}: frame count`);
  assert.strictEqual(dec.hasLoop, loop, `${name}: NETSCAPE loop flag`);

  for (let f = 0; f < framesIn.length; f++) {
    const src = framesIn[f].imageData;
    const fr = dec.frames[f];

    // 帧延时（毫秒 → 厘秒，下限 2cs）
    const expectedCs = Math.max(2, Math.round(framesIn[f].delayMs / 10));
    assert.strictEqual(fr.delayCs, expectedCs, `${name}: frame ${f} delay`);

    // 全画布帧位置与尺寸
    assert.strictEqual(fr.left, 0, `${name}: frame ${f} left`);
    assert.strictEqual(fr.top, 0, `${name}: frame ${f} top`);
    assert.strictEqual(fr.width, src.width, `${name}: frame ${f} width`);
    assert.strictEqual(fr.height, src.height, `${name}: frame ${f} height`);

    const { gct, indices, transparentIndex } = fr;
    for (let p = 0; p < src.width * src.height; p++) {
      const idx = indices[p];
      assert.ok(idx >= 0 && idx < gct.length, `${name}: frame ${f} index ${idx} out of range`);
      if (transparentIndex >= 0 && idx === transparentIndex) {
        assert.strictEqual(src.data[p * 4 + 3] < 128, true, `${name}: frame ${f} pixel ${p} should be transparent`);
        continue;
      }
      assert.deepStrictEqual(
        [...gct[idx]],
        [src.data[p * 4], src.data[p * 4 + 1], src.data[p * 4 + 2]],
        `${name}: frame ${f} pixel ${p} color mismatch`
      );
    }
  }

  const sizes = new Set(dec.frames.map(f => `${f.width}x${f.height}@${f.delayCs}ms`));
  console.log(`  ok  ${name} (${dec.frames.length} frames, loop=${dec.hasLoop}, ${[...sizes].join(', ')})`);
}

console.log('GIF encoder roundtrip tests');

// 1. 纯色小图
await roundtrip('solid 4x4', makeImageData(4, 4, () => [255, 0, 0, 255]));

// 2. 双像素最小图
await roundtrip('two pixels', makeImageData(2, 1, (p) => (p === 0 ? [10, 200, 30, 255] : [200, 10, 30, 255])));

// 3. 精确 256 色边界
await roundtrip('exact 256 colors', makeImageData(16, 16, (p) => [p & 0xff, (p * 7) & 0xff, (p * 13) & 0xff, 255]));

// 4. 透明棋盘（半透明 alpha=64 应并入透明）
await roundtrip('transparent checker', makeImageData(8, 8, (p) => {
  const checker = ((p % 8) + Math.floor(p / 8)) % 2 === 0;
  return checker ? [255, 0, 0, 255] : [0, 0, 255, 64];
}));

// 5. 随机噪声（>256 色 → 中位切分；长序列 → LZW 12 位封顶 + CLEAR 重置路径）
let seed = 42;
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
await roundtrip('noise 128x128 (>256 colors)', makeImageData(128, 128, () => [
  Math.floor(rand() * 256), Math.floor(rand() * 256), Math.floor(rand() * 256), 255,
]), { exact: false });

// 6. 渐变（连续色调 + 大量重复序列，覆盖字典增长与码宽递增）
await roundtrip('gradient 100x100', makeImageData(100, 100, (p, w) => [
  Math.floor((p % w) * 255 / w), Math.floor(Math.floor(p / w) * 255 / w), 128, 255,
]), { exact: false });

// 7. 半透明混合（透明 + 不透明共存，验证透明索引槽位保留）
await roundtrip('mixed alpha 32x32', makeImageData(32, 32, (p) => {
  const alpha = p % 3 === 0 ? 20 : 255;
  return [(p * 5) & 0xff, (p * 11) & 0xff, (p * 17) & 0xff, alpha];
}), { exact: false });

console.log('animated GIF tests');

// 8. 三帧纯色动画：精确色 + 帧延时 + 循环扩展
await roundtripAnimated('3 solid frames', [
  { imageData: makeImageData(6, 4, () => [255, 0, 0, 255]), delayMs: 200 },
  { imageData: makeImageData(6, 4, () => [0, 255, 0, 255]), delayMs: 500 },
  { imageData: makeImageData(6, 4, () => [0, 0, 255, 255]), delayMs: 1000 },
]);

// 9. 混合内容动画：不透明帧 + 含透明帧（disposal 切换）
await roundtripAnimated('opaque + transparent frames', [
  { imageData: makeImageData(8, 8, () => [10, 20, 30, 255]), delayMs: 100 },
  { imageData: makeImageData(8, 8, (p) => {
      const checker = ((p % 8) + Math.floor(p / 8)) % 2 === 0;
      return checker ? [200, 100, 50, 255] : [0, 0, 0, 0];
    }), delayMs: 300 },
]);

// 10. 多帧渐变动画（量化路径 + 局部色表独立性）
{
  const mk = (phase) => makeImageData(24, 24, (p) => {
    const v = Math.floor((p / 96 + phase) * 64) & 0xff;
    return [v, 128, 255 - v, 255];
  });
  await roundtripAnimated('4 gradient frames (quantized)', [
    { imageData: mk(0), delayMs: 80 },   // 8cs 下限
    { imageData: mk(0.25), delayMs: 120 },
    { imageData: mk(0.5), delayMs: 120 },
    { imageData: mk(0.75), delayMs: 120 },
  ]);
}

// 11. 关闭循环
await roundtripAnimated('no-loop single frame', [
  { imageData: makeImageData(5, 5, () => [1, 2, 3, 255]), delayMs: 250 },
], { loop: false });

// 12. 尺寸不一致必须抛错
await assert.rejects(
  async () => encodeAnimatedGIF([
    { imageData: makeImageData(4, 4, () => [0, 0, 0, 255]), delayMs: 100 },
    { imageData: makeImageData(5, 5, () => [0, 0, 0, 255]), delayMs: 100 },
  ]),
  /same canvas size/
);
console.log('  ok  mismatched frame size rejected');

// 13. 空帧列表必须抛错
await assert.rejects(async () => encodeAnimatedGIF([]), /no frames/);
console.log('  ok  empty frames rejected');

console.log('all tests passed');
