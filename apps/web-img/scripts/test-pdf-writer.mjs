/**
 * PDF 写入器验证脚本（Node 环境，不依赖浏览器）。
 *
 * 用法：
 *   node node_modules/typescript/bin/tsc src/utils/gifEncoder.ts src/utils/pdfWriter.ts --outDir .test-tmp --module commonjs --target es2020
 *   node scripts/test-pdf-writer.mjs
 *
 * 原理：
 * - 结构与语义：用 pdfjs-dist（已有依赖）实际解析生成的 PDF，
 *   校验页数、MediaBox 尺寸、内容流放置矩阵、xref/trailer 完整性
 * - EXIF 方向检测：手工构造含 APP1/Exif 段的 JPEG 字节夹具做断言
 */
import { createRequire } from 'node:module';
import assert from 'node:assert';
import zlib from 'node:zlib';

const require_ = createRequire(process.cwd() + '/package.json');
const { buildPdf, getJpegOrientation } = require_('./.test-tmp/pdfWriter.js');

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

/** 从 PDF 字节中提取可读字符串（latin1），便于结构断言 */
function asLatin1(bytes) {
  return Buffer.from(bytes).toString('latin1');
}

async function parseWithPdfjs(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: bytes.slice(), // pdfjs 会转移缓冲区，传副本
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  return doc;
}

/** 构造原始 RGB 像素并 deflate（zlib 格式，与浏览器 CompressionStream('deflate') 同格式） */
function flateRGB(pixels) {
  return zlib.deflateSync(Buffer.from(pixels));
}

/** 构造含 EXIF Orientation 的最小 JPEG 字节夹具 */
function buildExifJpeg(orientation, endian = 'little') {
  const le = endian === 'little';
  const tiff = [];
  tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d])); // "II" / "MM"
  tiff.push(...(le ? [0x2a, 0x00] : [0x00, 0x2a])); // magic 42
  tiff.push(...(le ? [0x08, 0, 0, 0] : [0, 0, 0, 0x08])); // IFD0 偏移
  tiff.push(...(le ? [0x01, 0x00] : [0x00, 0x01])); // 条目数 = 1
  // 条目：tag 0x0112 (Orientation), type 3 (SHORT), count 1, value
  tiff.push(...(le ? [0x12, 0x01] : [0x01, 0x12]));
  tiff.push(...(le ? [0x03, 0x00] : [0x00, 0x03]));
  tiff.push(...(le ? [0x01, 0, 0, 0] : [0, 0, 0, 0x01]));
  tiff.push(...(le ? [orientation, 0, 0, 0] : [0, orientation, 0, 0]));
  tiff.push(0, 0, 0, 0); // 下一 IFD = 0

  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0"
  const segLen = payload.length + 2;
  const bytes = [0xff, 0xd8]; // SOI
  bytes.push(0xff, 0xe1, (segLen >> 8) & 0xff, segLen & 0xff, ...payload);
  bytes.push(0xff, 0xda, 0x00, 0x02, 0x11, 0x22); // 最小 SOS
  return new Uint8Array(bytes);
}

// ─────────────────────────────────────────────────────────────────────────────
// 用例
// ─────────────────────────────────────────────────────────────────────────────

console.log('结构校验');

ok('空输入抛错', () => {
  assert.throws(() => buildPdf([]), /at least one image/);
});

ok('非法尺寸抛错', () => {
  assert.throws(
    () => buildPdf([{ image: { width: 0, height: 10, data: new Uint8Array(3), filter: 'FlateDecode' }, page: { width: 100, height: 100 } }]),
    /Invalid/
  );
});

ok('输出以 %PDF 开头、%%EOF 结尾', () => {
  const bytes = buildPdf([{
    image: { width: 1, height: 1, data: flateRGB([10, 20, 30]), filter: 'FlateDecode' },
    page: { width: 100, height: 100 },
  }]);
  const s = asLatin1(bytes);
  assert.ok(s.startsWith('%PDF-1.7'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
});

ok('contain 居中放置矩阵正确（200×100 → 100×100 页）', () => {
  const pixels = new Array(200 * 100 * 3).fill(128);
  const bytes = buildPdf([{
    image: { width: 200, height: 100, data: flateRGB(pixels), filter: 'FlateDecode' },
    page: { width: 100, height: 100 },
  }]);
  // 缩放 min(100/200, 100/100)=0.5 → 100×50，居中偏移 (0, 25)
  assert.ok(asLatin1(bytes).includes('100 0 0 50 0 25 cm'), '应包含 cm 矩阵 100 0 0 50 0 25');
});

ok('页边距内缩放置矩阵正确（100×100 图 → 200×200 页，边距 25）', () => {
  const bytes = buildPdf([{
    image: { width: 100, height: 100, data: flateRGB(new Array(300).fill(1)), filter: 'FlateDecode' },
    page: { width: 200, height: 200 },
    margin: 25,
  }]);
  // 可用区 150×150 → 缩放 1.5 → 150×150，居中偏移 (25, 25)
  assert.ok(asLatin1(bytes).includes('150 0 0 150 25 25 cm'), '应包含 cm 矩阵 150 0 0 150 25 25');
});

ok('边距过大抛错', () => {
  assert.throws(
    () => buildPdf([{
      image: { width: 10, height: 10, data: flateRGB(new Array(300).fill(1)), filter: 'FlateDecode' },
      page: { width: 100, height: 100 },
      margin: 50,
    }]),
    /Invalid margin/
  );
});

console.log('pdfjs 解析校验');

// 用例间串行执行
const pdfjsChecks = [
  ['FlateDecode 单页：页数与 MediaBox', async () => {
    const bytes = buildPdf([{
      image: { width: 2, height: 2, data: flateRGB([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0]), filter: 'FlateDecode' },
      page: { width: 595.28, height: 841.89 }, // A4 pt
    }]);
    const doc = await parseWithPdfjs(bytes);
    assert.equal(doc.numPages, 1);
    const page = await doc.getPage(1);
    assert.deepEqual(
      page.view.map(v => Math.round(v * 100) / 100),
      [0, 0, 595.28, 841.89]
    );
  }],

  ['FlateDecode + SMask 透明通道', async () => {
    const bytes = buildPdf([{
      image: { width: 2, height: 1, data: flateRGB([1, 2, 3, 4, 5, 6]), filter: 'FlateDecode', alpha: zlib.deflateSync(Buffer.from([255, 0])) },
      page: { width: 60, height: 60 },
    }]);
    assert.ok(asLatin1(bytes).includes('/SMask'), '图像字典应引用 SMask');
    const doc = await parseWithPdfjs(bytes);
    assert.equal(doc.numPages, 1);
  }],

  ['多页混合 DCT + Flate：顺序与尺寸', async () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // 结构性占位（仅校验透传）
    const pages = [
      { page: { width: 200, height: 300 } },
      { page: { width: 400, height: 400 } },
      { page: { width: 150, height: 250 } },
    ];
    const bytes = buildPdf([
      { image: { width: 10, height: 10, data: fakeJpeg, filter: 'DCTDecode' }, ...pages[0] },
      { image: { width: 20, height: 10, data: flateRGB(new Array(600).fill(9)), filter: 'FlateDecode' }, ...pages[1] },
      { image: { width: 5, height: 5, data: flateRGB(new Array(75).fill(7)), filter: 'FlateDecode', alpha: zlib.deflateSync(Buffer.from(new Array(25).fill(128))) }, ...pages[2] },
    ]);
    const doc = await parseWithPdfjs(bytes);
    assert.equal(doc.numPages, 3);
    for (let i = 1; i <= 3; i++) {
      const p = await doc.getPage(i);
      const [, , w, h] = p.view;
      assert.equal(w, pages[i - 1].page.width, `第 ${i} 页宽度`);
      assert.equal(h, pages[i - 1].page.height, `第 ${i} 页高度`);
    }
    // JPEG 字节原样透传
    assert.ok(asLatin1(bytes).includes('\xff\xd8\xff\xd9'), 'JPEG 字节应原样嵌入');
  }],

  ['每页独立内容流引用对应图像', async () => {
    const mk = i => ({
      image: { width: 4, height: 4, data: flateRGB(new Array(48).fill(i)), filter: 'FlateDecode' },
      page: { width: 80, height: 80 },
    });
    const bytes = buildPdf([mk(1), mk(2), mk(3), mk(4)]);
    const s = asLatin1(bytes);
    for (let i = 0; i < 4; i++) {
      assert.ok(s.includes(`/Im${i} Do`), `缺少 /Im${i} Do`);
    }
    const doc = await parseWithPdfjs(bytes);
    assert.equal(doc.numPages, 4);
  }],
];

for (const [name, fn] of pdfjsChecks) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('EXIF 方向检测');

ok('小端 II 夹具读取 Orientation=6', () => {
  assert.equal(getJpegOrientation(buildExifJpeg(6, 'little')), 6);
});

ok('大端 MM 夹具读取 Orientation=8', () => {
  assert.equal(getJpegOrientation(buildExifJpeg(8, 'big')), 8);
});

ok('无 EXIF 返回 1', () => {
  assert.equal(getJpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02])), 1);
});

ok('非 JPEG 字节返回 1', () => {
  assert.equal(getJpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), 1);
});

ok('截断/损坏数据安全返回 1（不抛异常）', () => {
  const truncated = buildExifJpeg(3, 'little').slice(0, 14);
  assert.equal(getJpegOrientation(truncated), 1);
  assert.equal(getJpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x50])), 1);
});

console.log(`\n全部通过：${passed} 个用例`);
