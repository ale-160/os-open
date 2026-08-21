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
const { encodeGIF } = require_('./.test-tmp/gifEncoder.js');

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

  let transparentIndex = -1;
  for (;;) {
    const block = b[p++];
    if (block === 0x3b) throw new Error('no image block found');
    if (block === 0x21) {
      const label = b[p++];
      const size = b[p++];
      if (label === 0xf9 && (b[p] & 0x01) === 1) {
        transparentIndex = b[p + 3];
      }
      p += size;
      if (b[p] !== 0) throw new Error('bad extension terminator');
      p++;
    } else if (block === 0x2c) {
      const iw = b.readUInt16LE(p + 4);
      const ih = b.readUInt16LE(p + 6);
      assert.strictEqual(iw, width, 'image width mismatch');
      assert.strictEqual(ih, height, 'image height mismatch');
      p += 9;
      const minCodeSize = b[p++];
      const data = [];
      while (b[p] !== 0) {
        const n = b[p++];
        for (let i = 0; i < n; i++) data.push(b[p + i]);
        p += n;
      }
      const indices = lzwDecode(data, minCodeSize, iw * ih);
      return { width, height, gct, transparentIndex, indices };
    } else {
      throw new Error(`unknown block 0x${block.toString(16)} at ${p - 1}`);
    }
  }
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

  for (let p = 0; p < dec.width * dec.height; p++) {
    const idx = dec.indices[p];
    assert.ok(idx >= 0 && idx < dec.gct.length, `${name}: index ${idx} out of range`);
    const x = p % dec.width, y = Math.floor(p / dec.width);

    if (dec.transparentIndex >= 0 && idx === dec.transparentIndex) {
      // 必须对应原图的透明像素（checker 场景）
      assert.strictEqual(
        img.data[p * 4 + 3] < 128, true,
        `${name}: pixel ${x},${y} transparent but source opaque`
      );
      continue;
    }
    const [pr, pg, pb] = dec.gct[idx];
    if (exact) {
      assert.deepStrictEqual(
        [pr, pg, pb],
        [img.data[p * 4], img.data[p * 4 + 1], img.data[p * 4 + 2]],
        `${name}: pixel ${x},${y} color mismatch`
      );
      assert.strictEqual(img.data[p * 4 + 3] >= 128, true, `${name}: pixel ${x},${y} should be opaque`);
    }
  }
  console.log(`  ok  ${name} (${dec.width}x${dec.height}, palette<=${dec.gct.length}, transparent=${dec.transparentIndex})`);
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

console.log('all tests passed');
