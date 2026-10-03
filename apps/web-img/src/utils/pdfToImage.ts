/**
 * PDF 相关的通用工具函数。
 *
 * 历史遗留的 pdfToImage / getPdfPageCount / downloadImage 等占位实现已移除：
 * 实际的 PDF 解析与渲染统一在 PdfMainPage 中通过 pdfjs-dist 完成。
 */

/**
 * 检查文件是否为PDF
 * @param file 文件
 * @returns 是否为PDF文件
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
