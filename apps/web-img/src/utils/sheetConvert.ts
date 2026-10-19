/**
 * 表格/数据转换核心（纯函数层，Worker 与主线程通用）。
 *
 * 输入：XLSX / XLS / CSV / TSV / ODS（SheetJS 解析）与 JSON（对象数组）。
 * 输出：XLSX / ODS（整簿保留多表）、CSV / TSV / JSON / HTML（多表时按表拆分为多个文件）。
 *
 * SheetJS 采用官方 CDN 构建版（0.20.3，含 npm 0.18.5 之后的
 * ReDoS / 原型污染安全修复——本地解析不可信文件必须用修复版）。
 */
import type { WorkBook } from 'xlsx';

export type SheetInputFormat = 'xlsx' | 'xls' | 'csv' | 'tsv' | 'ods' | 'json';
export type SheetOutputFormat = 'xlsx' | 'csv' | 'tsv' | 'ods' | 'json' | 'html';

export const SHEET_INPUT_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.tsv', '.ods', '.json'];

export const SHEET_OUTPUT_FORMATS: {
  id: SheetOutputFormat;
  ext: string;
  note: { zh: string; en: string };
}[] = [
  { id: 'xlsx', ext: '.xlsx', note: { zh: 'Excel 工作簿，保留多表', en: 'Excel workbook, keeps sheets' } },
  { id: 'csv', ext: '.csv', note: { zh: '纯文本表格（UTF-8 BOM，Excel 友好）', en: 'Plain text table (UTF-8 BOM)' } },
  { id: 'tsv', ext: '.tsv', note: { zh: '制表符分隔', en: 'Tab-separated values' } },
  { id: 'ods', ext: '.ods', note: { zh: 'OpenDocument 表格', en: 'OpenDocument spreadsheet' } },
  { id: 'json', ext: '.json', note: { zh: '行对象数组', en: 'Array of row objects' } },
  { id: 'html', ext: '.html', note: { zh: '网页表格', en: 'HTML table' } },
];

const MIME: Record<SheetOutputFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  tsv: 'text/tab-separated-values;charset=utf-8',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  json: 'application/json;charset=utf-8',
  html: 'text/html;charset=utf-8',
};

/** 动态加载 SheetJS（纯 JS，零依赖；只在进入表格转换时加载） */
export async function loadXlsx(): Promise<typeof import('xlsx')> {
  return import('xlsx');
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

function isSheetInput(name: string): boolean {
  return SHEET_INPUT_EXTENSIONS.includes(extOf(name));
}

/** 工作簿是否只有单个（可见）工作表 */
function sheetNames(wb: WorkBook): string[] {
  return wb.SheetNames.filter(Boolean);
}

/** CSV/TSV 加 UTF-8 BOM，保证 Excel 直接打开不乱码 */
function withBom(text: string): string {
  return '\uFEFF' + text;
}

/**
 * 把任意输入解析为 SheetJS 工作簿。
 * - XLSX/XLS/CSV/TSV/ODS：SheetJS 原生解析（CSV/TSV 按字符串读取保证 UTF-8）
 * - JSON：顶层必须是「对象数组」，每个对象为一行
 */
export async function parseToWorkbook(file: File): Promise<WorkBook> {
  const XLSX = await loadXlsx();
  const name = file.name.toLowerCase();

  if (name.endsWith('.json')) {
    const text = await file.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('JSON 解析失败：文件不是合法 JSON');
    }
    if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== 'object' || data[0] === null) {
      throw new Error('JSON 需为非空的对象数组（每项一行，键为列名）');
    }
    const ws = XLSX.utils.json_to_sheet(data as Record<string, unknown>[]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return wb;
  }

  if (name.endsWith('.csv') || name.endsWith('.tsv')) {
    const text = await file.text();
    return XLSX.read(text, { type: 'string', raw: false, FS: name.endsWith('.tsv') ? '\t' : undefined });
  }

  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: 'array' });
}

export interface SheetConversion {
  /** 输出文件名（多表拆分时含表名） */
  filename: string;
  blob: Blob;
  /** 来源工作表名 */
  sheetName: string;
}

function safeSheetName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 64) || 'Sheet';
}

/** 单个（多）工作表 → 目标格式文件（xlsx/ods 返回整簿单文件） */
export async function convertWorkbook(
  wb: WorkBook,
  target: SheetOutputFormat,
  baseName: string
): Promise<SheetConversion[]> {
  const XLSX = await loadXlsx();
  const names = sheetNames(wb);
  if (names.length === 0) throw new Error('文件中没有工作表');

  // 整簿格式：全表保留在一个文件里
  if (target === 'xlsx' || target === 'ods') {
    const out = XLSX.write(wb, { bookType: target, type: 'array' });
    return [
      {
        filename: `${baseName}${target === 'xlsx' ? '.xlsx' : '.ods'}`,
        blob: new Blob([out], { type: MIME[target] }),
        sheetName: names[0],
      },
    ];
  }

  // 按表拆分格式
  const out: SheetConversion[] = [];
  const multi = names.length > 1;
  for (const sheetName of names) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const suffix = multi ? `.${safeSheetName(sheetName)}` : '';
    let blob: Blob;
    if (target === 'csv' || target === 'tsv') {
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: target === 'tsv' ? '\t' : ',' });
      blob = new Blob([withBom(csv)], { type: MIME[target] });
    } else if (target === 'json') {
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
      blob = new Blob([JSON.stringify(rows, null, 2)], { type: MIME[target] });
    } else {
      blob = new Blob([XLSX.utils.sheet_to_html(ws)], { type: MIME[target] });
    }
    out.push({ filename: `${baseName}${suffix}.${target}`, blob, sheetName });
  }
  return out;
}

/** 输入文件 → 目标格式（组合入口，含文件名处理） */
export async function convertSheetFile(
  file: File,
  target: SheetOutputFormat
): Promise<SheetConversion[]> {
  if (!isSheetInput(file.name)) {
    throw new Error('仅支持 XLSX / XLS / CSV / TSV / ODS / JSON 输入');
  }
  const wb = await parseToWorkbook(file);
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  return convertWorkbook(wb, target, baseName);
}
