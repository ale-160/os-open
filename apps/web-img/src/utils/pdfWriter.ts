/**
 * 自研零依赖最小 PDF 写入器：多张图片合成一份 PDF。
 *
 * 设计要点：
 * - JPEG 输入可原始字节直嵌（/Filter /DCTDecode），零重编码、零质量损失
 * - 其余输入以原始 RGB 字节 + deflate（zlib 格式）嵌入（/Filter /FlateDecode），
 *   可选携带独立透明通道（/SMask，DeviceGray FlateDecode），保留透明度
 * - 本模块只负责 PDF 结构组装，压缩在调用方完成
 *   （浏览器端用 CompressionStream('deflate')，Node 测试用 zlib.deflateSync）
 * - 每页一张图，图片按 contain 等比缩放并在页面内居中
 */

/** 一个待嵌入的图像 */
export interface PdfImageInput {
  width: number;
  height: number;
  /**
   * DCTDecode：完整 JPEG 文件字节；
   * FlateDecode：已 deflate 的 RGB 序列（每像素 3 字节）
   */
  data: Uint8Array;
  filter: 'DCTDecode' | 'FlateDecode';
  /** FlateDecode 模式的透明通道：已 deflate 的 width*height 灰度字节 */
  alpha?: Uint8Array | null;
}

/** 单页页面尺寸（PDF 点，1pt = 1/72 英寸） */
export interface PdfPageSize {
  width: number;
  height: number;
}

export interface PdfBuildItem {
  image: PdfImageInput;
  page: PdfPageSize;
  /** 页边距（pt）：图片在四边留白内 contain 放置，默认 0 */
  margin?: number;
}

/* ────────────────────────── 基础工具 ────────────────────────── */

const encoder = new TextEncoder();

function strBytes(s: string): Uint8Array {
  return encoder.encode(s);
}

function concatBytes(parts: Array<Uint8Array | string>): Uint8Array {
  const resolved = parts.map(p => (typeof p === 'string' ? strBytes(p) : p));
  let total = 0;
  for (const p of resolved) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of resolved) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** 数字格式化：最多两位小数，去掉多余的 0（PDF 内容流用） */
function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace(/0+$/, '').replace(/\.$/, '');
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

/* ────────────────────── EXIF 方向检测 ────────────────────── */

/**
 * 读取 JPEG EXIF Orientation（1–8）；无 EXIF 或解析失败返回 1。
 * 仅做最小化解析：APP1 → "Exif\0\0" → TIFF 头 → IFD0 的 0x0112 标签。
 * 方向 ≠ 1 时调用方应改走 canvas 重编码路径（浏览器解码会自动应用方向）。
 */
export function getJpegOrientation(bytes: Uint8Array): number {
  try {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;

    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) return 1;
      const marker = bytes[offset + 1];
      // SOS 之后是压缩数据，不再有 APP 段
      if (marker === 0xda) return 1;

      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segLen < 2 || offset + 2 + segLen > bytes.length) return 1;

      if (marker === 0xe1 && segLen >= 8) {
        // APP1：校验 "Exif\0\0"
        const exifStart = offset + 4;
        if (
          bytes[exifStart] === 0x45 && bytes[exifStart + 1] === 0x78 &&
          bytes[exifStart + 2] === 0x69 && bytes[exifStart + 3] === 0x66 &&
          bytes[exifStart + 4] === 0x00 && bytes[exifStart + 5] === 0x00
        ) {
          return parseTiffOrientation(bytes, exifStart + 6);
        }
      }
      offset += 2 + segLen;
    }
    return 1;
  } catch {
    return 1;
  }
}

function parseTiffOrientation(bytes: Uint8Array, tiffStart: number): number {
  if (tiffStart + 8 > bytes.length) return 1;
  const bigEndian =
    bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d; // "MM"，否则 "II"
  const u16 = (pos: number) =>
    bigEndian
      ? (bytes[pos] << 8) | bytes[pos + 1]
      : bytes[pos] | (bytes[pos + 1] << 8);
  const u32 = (pos: number) =>
    bigEndian
      ? ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0
      : (bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24)) >>> 0;

  if (u16(tiffStart + 2) !== 42) return 1;
  const ifdOffset = u32(tiffStart + 4);
  const ifdPos = tiffStart + ifdOffset;
  if (ifdPos + 2 > bytes.length) return 1;

  const entryCount = u16(ifdPos);
  for (let i = 0; i < entryCount; i++) {
    const entryPos = ifdPos + 2 + i * 12;
    if (entryPos + 12 > bytes.length) return 1;
    if (u16(entryPos) === 0x0112) {
      const orientation = u16(entryPos + 8);
      return orientation >= 1 && orientation <= 8 ? orientation : 1;
    }
  }
  return 1;
}

/* ────────────────────────── PDF 组装 ────────────────────────── */

/**
 * 合成 PDF。对象编号布局：
 *   1=Catalog, 2=Pages；之后每个条目按需占用 3~4 个对象
 *   （含 SMask：img/smask/content/page；不含：img/content/page）
 */
export function buildPdf(items: PdfBuildItem[]): Uint8Array {
  if (items.length === 0) {
    throw new Error('buildPdf requires at least one image');
  }

  items.forEach(({ image, page, margin }, i) => {
    assertPositive(`image[${i}].width`, image.width);
    assertPositive(`image[${i}].height`, image.height);
    assertPositive(`page[${i}].width`, page.width);
    assertPositive(`page[${i}].height`, page.height);
    if (margin !== undefined && (!Number.isFinite(margin) || margin < 0 || margin * 2 >= Math.min(page.width, page.height))) {
      throw new Error(`Invalid margin for page[${i}]: ${margin}`);
    }
    if (image.filter === 'FlateDecode' && image.alpha && image.alpha.length === 0) {
      throw new Error(`Empty alpha channel for image[${i}]`);
    }
  });

  interface PendingObj {
    num: number;
    body: Array<Uint8Array | string>;
  }
  const objects: PendingObj[] = [];
  const pageObjNums: number[] = [];

  let nextNum = 3;
  items.forEach(({ image, page, margin = 0 }, i) => {
    const imgNum = nextNum++;

    // 图像 XObject 字典内部字段（不含 << >> 与 /Length，由 buildStreamBody 补全）
    let smaskNum = 0;
    const imgDictInner =
      `/Type /XObject /Subtype /Image ` +
      `/Width ${image.width} /Height ${image.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
      (image.filter === 'DCTDecode' ? '/Filter /DCTDecode' : '/Filter /FlateDecode');
    let imgDict = imgDictInner;
    if (image.alpha) {
      smaskNum = nextNum++;
      imgDict += ` /SMask ${smaskNum} 0 R`;
    }

    const contentNum = nextNum++;
    const pageNum = nextNum++;

    // contain 居中放置（在页边距内缩）
    const availW = page.width - margin * 2;
    const availH = page.height - margin * 2;
    const scale = Math.min(availW / image.width, availH / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;
    const dx = (page.width - dw) / 2;
    const dy = (page.height - dh) / 2;

    const content =
      `q\n${fmt(dw)} 0 0 ${fmt(dh)} ${fmt(dx)} ${fmt(dy)} cm\n/Im${i} Do\nQ\n`;

    objects.push({ num: imgNum, body: buildStreamBody(imgDict, image.data) });

    if (image.alpha && smaskNum) {
      objects.push({
        num: smaskNum,
        body: buildStreamBody(
          `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}` +
            ' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode',
          image.alpha
        ),
      });
    }

    objects.push({
      num: contentNum,
      body: buildStreamBody('', strBytes(content)),
    });

    objects.push({
      num: pageNum,
      body: [
        `<< /Type /Page /Parent 2 0 R\n` +
          `/MediaBox [0 0 ${fmt(page.width)} ${fmt(page.height)}]\n` +
          `/Resources << /XObject << /Im${i} ${imgNum} 0 R >> >>\n` +
          `/Contents ${contentNum} 0 R >>`,
      ],
    });
    pageObjNums.push(pageNum);
  });

  // Catalog 与 Pages 固定为 1、2 号对象
  const kids = pageObjNums.map(n => `${n} 0 R`).join(' ');
  objects.unshift({ num: 1, body: ['<< /Type /Catalog /Pages 2 0 R >>'] });
  objects.splice(1, 0, {
    num: 2,
    body: [`<< /Type /Pages /Kids [${kids}] /Count ${items.length} >>`],
  });
  objects.sort((a, b) => a.num - b.num);

  // 序列化：header → body（记录偏移）→ xref → trailer
  // 注意 header 含非 ASCII 注释字节，偏移必须按编码后字节数累计
  const headerBytes = strBytes('%PDF-1.7\n%âãÏÓ\n');
  const chunks: Uint8Array[] = [headerBytes];
  let offset = headerBytes.length;
  const offsets = new Map<number, number>();

  for (const obj of objects) {
    offsets.set(obj.num, offset);
    const head = strBytes(`${obj.num} 0 obj\n`);
    const tail = strBytes('\nendobj\n');
    chunks.push(head);
    offset += head.length;
    for (const part of obj.body) {
      const bytes = typeof part === 'string' ? strBytes(part) : part;
      chunks.push(bytes);
      offset += bytes.length;
    }
    chunks.push(tail);
    offset += tail.length;
  }

  const xrefOffset = offset;
  const size = objects.length + 1;
  const xrefLines: string[] = [`xref\n0 ${size}\n0000000000 65535 f \n`];
  for (let n = 1; n < size; n++) {
    xrefLines.push(`${String(offsets.get(n)).padStart(10, '0')} 00000 n \n`);
  }
  const trailer =
    `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  chunks.push(strBytes(xrefLines.join('')), strBytes(trailer));
  return concatBytes(chunks);
}

/** 构造 `<< dict /Length N >>\nstream\n…\nendstream` 形式的对象体 */
function buildStreamBody(dictInner: string, data: Uint8Array): Array<Uint8Array | string> {
  const lengthLine = dictInner ? ` /Length ${data.length} >>\nstream\n` : `/Length ${data.length} >>\nstream\n`;
  return [`<< ${dictInner}${lengthLine}`, data, '\nendstream'];
}
