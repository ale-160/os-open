/**
 * EPUB → 纯文本提取：EPUB 本质是 ZIP + XHTML，
 * 复用项目内已有的 JSZip 解包 + 浏览器原生 DOMParser 解析，零新依赖。
 *
 * 流程：META-INF/container.xml → OPF 清单 → spine 阅读顺序 →
 * 逐章提取 XHTML 文本（块级元素边界转换行），按阅读顺序拼接。
 */
import JSZip from 'jszip';

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style').forEach((el) => el.remove());
  // 块级元素尾部补换行，保留段落/标题/列表结构
  doc.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,tr,blockquote,section,article').forEach((el) =>
    el.append('\n')
  );
  return (doc.body?.textContent ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractEpubText(
  file: File,
  onProgress?: (section: number, total: number) => void
): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer()).catch(() => {
    throw new Error('EPUB 解包失败：文件不是合法的 ZIP 容器');
  });

  // 1. container.xml → OPF 路径
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('不是有效的 EPUB（缺少 container.xml）');
  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
  const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') ?? '';
  const opfXml = opfPath ? await zip.file(opfPath)?.async('string') : undefined;
  if (!opfXml) throw new Error('EPUB 缺少 OPF 清单文件');

  // 2. OPF → 书名 / manifest（id→href）/ spine（阅读顺序）
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');
  const title = opfDoc.querySelector('title')?.textContent?.trim() ?? '';
  const manifest = new Map<string, string>();
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const type = item.getAttribute('media-type') ?? '';
    if (id && href && /xhtml|html/i.test(type)) manifest.set(id, href);
  });
  const spine = [...opfDoc.querySelectorAll('spine > itemref')]
    .map((ref) => ref.getAttribute('idref') ?? '')
    .filter(Boolean);
  if (spine.length === 0) throw new Error('EPUB spine 为空，没有章节可提取');

  // 3. 逐章提取（href 相对 OPF 所在目录）
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const sections: string[] = [];
  let done = 0;
  for (const idref of spine) {
    const href = manifest.get(idref);
    if (!href) continue;
    const entry = zip.file(decodeURIComponent(opfDir + href));
    if (!entry) continue;
    const text = htmlToText(await entry.async('string'));
    done++;
    if (text) {
      const label = title ? `${title} · 第 ${sections.length + 1} 节` : `第 ${sections.length + 1} 节`;
      sections.push(`── ${label} ──\n${text}`);
    }
    onProgress?.(done, spine.length);
  }

  if (sections.length === 0) throw new Error('EPUB 中没有可提取的文本');
  return sections.join('\n\n');
}
