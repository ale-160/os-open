/**
 * PDF → 纯文本提取：复用项目内已有的 pdfjs-dist（按需动态加载）。
 * 逐页 getTextContent 后按行拼接，输出 .txt（多份 PDF 逐文件输出）。
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';

type PdfjsModule = typeof import('pdfjs-dist');

let modulePromise: Promise<PdfjsModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  modulePromise ??= import('pdfjs-dist').then((pdfjs) => {
    // 部署子路径（如 /img/）下指向 public/ 内的 worker；根路径部署时为 ''
    const base = (process.env as { __NEXT_ROUTER_BASEPATH?: string }).__NEXT_ROUTER_BASEPATH ?? '';
    pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;
    return pdfjs;
  });
  return modulePromise;
}

export async function extractPdfText(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<string> {
  const pdfjs = await loadPdfjs();
  const pdf: PDFDocumentProxy = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

  const pages: string[] = [];
  for (let num = 1; num <= pdf.numPages; num++) {
    const page = await pdf.getPage(num);
    const content = await page.getTextContent();
    // 同一 transform 行的 item 以空格连接，跨行换行
    let pageText = '';
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        pageText += '\n';
      } else if (pageText && !pageText.endsWith('\n') && item.str) {
        pageText += ' ';
      }
      pageText += item.str;
      lastY = y;
    }
    pages.push(pageText.trim());
    page.cleanup();
    onProgress?.(num, pdf.numPages);
  }
  await pdf.destroy();

  return pages.map((text, idx) => {
    const header = pdf.numPages > 1 ? `── 第 ${idx + 1} 页 ──\n` : '';
    return header + text;
  }).join('\n\n');
}
