/**
 * 文本相关的纯函数（字数统计、图片插入、文件名处理）
 */

const CJK_RE = /[一-鿿぀-ヿ가-힯]/g;
const LATIN_WORD_RE = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
const MD_EXT_RE = /\.(md|markdown|txt)$/i;

/**
 * 字数统计：中文（含日文假名、韩文）按字、英文/数字按词。
 * chars 按 Unicode 码点计数（emoji 等代理对算 1 个字符）。
 */
export function countText(text: string): { chars: number; words: number } {
  const chars = text.length - (text.match(SURROGATE_PAIR_RE) || []).length;
  const cjk = (text.match(CJK_RE) || []).length;
  const latin = (text.match(LATIN_WORD_RE) || []).length;
  return { chars, words: cjk + latin };
}

/** 在文档末尾追加一张 Markdown 图片（alt 去掉会破坏语法的方括号） */
export function appendMarkdownImage(content: string, dataUrl: string, name: string): string {
  const safeName = name.replace(/[[\]]/g, '');
  const markdownImage = `![${safeName}](${dataUrl})`;
  return content ? `${content}\n\n${markdownImage}\n` : `${markdownImage}\n`;
}

/** 是否为可导入的文本文件（.md / .markdown / .txt，大小写不敏感） */
export function isMarkdownFileName(fileName: string): boolean {
  return MD_EXT_RE.test(fileName);
}

/** 由文件名得到文档名：去掉 .md / .markdown / .txt 扩展名 */
export function docNameFromFileName(fileName: string): string {
  return fileName.replace(MD_EXT_RE, '');
}

/** 导出 .md 时补全扩展名（已有 .md 后缀则原样返回，大小写不敏感） */
export function ensureMdExtension(fileName: string): string {
  return /\.md$/i.test(fileName) ? fileName : `${fileName}.md`;
}
