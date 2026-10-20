/**
 * TIFF 编码器往返验证脚本（Node 环境，不依赖浏览器）。
 *
 * 用法：
 *   node node_modules/typescript/bin/tsc src/utils/imageEncoders.ts --outDir .test-tmp --module commonjs --target es2020
 *   node scripts/test-tiff-encoder.mjs
 *
 * 原理：用一份按 TIFF 6.0 规范独立实现的参考解析器读取编码器输出，
 * 校验文件头/IFD 结构/外部数据布局，并逐像素比对还原结果。
 */
import { createRequire } from 'node:module';
import assert from 'node:assert';

const require_ = createRequire(process.cwd() + '/package.json');
const { encodeTIFF } = require_('./.test-tmp/imageEncoders.js');

// ─────────────────────────────────────────────────────────────────────────────
// 参考解析器（独立实现，不与编码器共享任何代码）
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 11: 4, 12: 8 };

function parseTIFF(bufferOrBytes) {
  const bytes = bufferOrBytes instanceof Uint8Array
    ? bufferOrBytes
    : new Uint8Array(bufferOrBytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // 文件头
  assert.strictEqual(view.getUint8(0), 0x49, 'byte order II');
  assert.strictEqual(view.getUint8(1), 0x49, 'byte order II');
  assert.strictEqual(view.getUint16(2, true), 42, 'magic 42');
  const ifdOffset = view.getUint32(4, true);

  // IFD
  const entryCount = view.getUint16(ifdOffset, true);
  const tags = new Map();
  for (let i = 0; i < entryCount; i++) {
    const e = ifdOffset + 2 + i * 12;
    const tag = view.getUint16(e, true);
    const type = view.getUint16(e + 2, true);
    const count = view.getUint32(e + 4, true);
    const valueField = e + 8;
    let value;
    if (type === 3 && count === 1) {
      value = view.getUint16(valueField, true); // SHORT 内联（低 2 字节）
    } else if (type === 4 && count === 1) {
      value = view.getUint32(valueField, true); // LONG 内联
    } else {
      const offset = view.getUint32(valueField, true);
      const size = TYPE_SIZE[type] * count;
      if (type === 5) {
        // RATIONAL：每个元素 = 分子/分母两个 LONG
        value = [];
        for (let j = 0; j < count; j++) {
          value.push([
            view.getUint32(offset + j * 8, true),
            view.getUint32(offset + j * 8 + 4, true),
          ]);
        }
      } else {
        value = [];
        const step = TYPE_SIZE[type];
        for (let j = 0; j < count; j++) {
          value.push(type === 3 ? view.getUint16(offset + j * step, true) : view.getUint32(offset + j * step, true));
        }
      }
      if (size % 2 !== 0) assert.fail(`tag ${tag} 外部数据未按字对齐`);
    }
    tags.set(tag, { type, count, value });
  }
  // 无下一 IFD
  assert.strictEqual(view.getUint32(ifdOffset + 2 + entryCount * 12, true), 0, 'next IFD offset = 0');

  const width = tags.get(256).value;
  const height = tags.get(257).value;
  const bits = tags.get(258).value;
  const compression = tags.get(259).value;
  const photometric = tags.get(262).value;
  const stripOffset = tags.get(273).value;
  const spp = tags.get(277).value;
  const rowsPerStrip = tags.get(278).value;
  const stripByteCounts = tags.get(279).value;
  const xRes = tags.get(282).value;
  const yRes = tags.get(283).value;
  const resUnit = tags.get(296).value;
  const extraSamples = tags.get(338)?.value;

  // 结构断言
  assert.strictEqual(compression, 1, '无压缩');
  assert.strictEqual(photometric, 2, 'RGB 光度解释');
  assert.strictEqual(spp, bits.length, 'SamplesPerPixel = BitsPerSample 数长度');
  assert.ok(spp === 3 || spp === 4, '3 或 4 采样');
  for (const b of bits) assert.strictEqual(b, 8, '每采样 8 位');
  assert.strictEqual(rowsPerStrip, height, '单条带');
  assert.strictEqual(stripByteCounts, width * height * spp, '条带字节数');
  assert.strictEqual(resUnit, 2, '分辨率单位英寸');
  assert.deepStrictEqual(xRes, [[72, 1]], 'XResolution 72/1');
  assert.deepStrictEqual(yRes, [[72, 1]], 'YResolution 72/1');
  if (spp === 4) {
    const extraVal = Array.isArray(extraSamples) ? extraSamples : [extraSamples];
    assert.deepStrictEqual(extraVal, [2], 'alpha 为未关联 ExtraSamples');
  } else {
    assert.strictEqual(extraSamples, undefined, 'RGB 无 ExtraSamples');
  }

  // 像素还原（自顶向下逐行）
  const pixels = new Uint8Array(width * height * spp);
  pixels.set(bytes.subarray(stripOffset, stripOffset + stripByteCounts));

  return { width, height, spp, pixels };
}

// ─────────────────────────────────────────────────────────────────────────────
// 用例
// ─────────────────────────────────────────────────────────────────────────────

function makeImageData(width, height, fill) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b, a] = fill(i, x => x);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return { width, height, data };
}

async function blobBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

async function main() {
  // 1. 全不透明 → 3 采样 RGB，逐像素往返一致（奇数宽度覆盖行步进）
  {
    const w = 3, h = 2;
    const src = makeImageData(w, h, i => [i * 7 % 256, 255 - i, (i * 13) % 256, 255]);
    const blob = encodeTIFF(src);
    assert.strictEqual(blob.type, 'image/tiff');
    const { width, height, spp, pixels } = parseTIFF(await blobBytes(blob));
    assert.strictEqual(width, w);
    assert.strictEqual(height, h);
    assert.strictEqual(spp, 3);
    for (let i = 0; i < w * h; i++) {
      assert.deepStrictEqual(
        [pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]],
        [src.data[i * 4], src.data[i * 4 + 1], src.data[i * 4 + 2]],
        `RGB 像素 ${i}`
      );
    }
    console.log('✓ RGB（全不透明）3 采样往返一致');
  }

  // 2. 存在 alpha<255 → 4 采样 RGBA + ExtraSamples，逐像素含 alpha 往返一致
  {
    const w = 2, h = 2;
    const src = makeImageData(w, h, i => [10 * i, 20, 30, i === 0 ? 255 : 128]);
    const blob = encodeTIFF(src);
    const { spp, pixels } = parseTIFF(await blobBytes(blob));
    assert.strictEqual(spp, 4);
    for (let i = 0; i < w * h; i++) {
      assert.deepStrictEqual(
        [pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2], pixels[i * 4 + 3]],
        [src.data[i * 4], src.data[i * 4 + 1], src.data[i * 4 + 2], src.data[i * 4 + 3]],
        `RGBA 像素 ${i}`
      );
    }
    console.log('✓ RGBA（含透明）4 采样往返一致，ExtraSamples=2');
  }

  // 3. 大图尺寸字段与布局：2×3 转置场景 + 确定性（同输入同输出）
  {
    const w = 5, h = 4;
    const src = makeImageData(w, h, i => [(i * 31) % 256, (i * 3) % 256, 90, 255]);
    const b1 = await blobBytes(encodeTIFF(src));
    const b2 = await blobBytes(encodeTIFF(src));
    assert.deepStrictEqual(Array.from(b1), Array.from(b2), '编码确定性');
    const parsed = parseTIFF(b1);
    assert.strictEqual(parsed.width, 5);
    assert.strictEqual(parsed.height, 4);
    console.log('✓ 布局确定性 + 尺寸正确');
  }

  console.log('\n全部 TIFF 编码器用例通过');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
