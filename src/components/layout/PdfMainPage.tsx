'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useDragDrop } from '@/hooks/useDragDrop';
import { isPdfFile } from '@/utils/pdfToImage';
import { canvasToBlob, type ImageFormat } from '@/utils/canvas';
import { downloadFile } from '@/utils/file';
import { FileText, ArrowLeft, Download, X, Loader2 } from 'lucide-react';
import JSZip from 'jszip';

/** 渲染倍率：高分辨率渲染保证导出清晰度 */
const PAGE_SCALE = 2.0;

/**
 * 按需加载 pdfjs（仅浏览器端）。
 * 动态导入可避免 Node 预渲染时加载浏览器版 pdfjs 产生的告警，
 * 同时将约 1.4MB 的解析推迟到用户真正导入 PDF 时。
 */
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjs;
}

interface PdfMainPageProps {
  lang: 'en' | 'zh';
}

export default function PdfMainPage({ lang }: PdfMainPageProps) {
  // 动态设置 <html lang> 属性
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const router = useRouter();
  const [currentPdfFile, setCurrentPdfFile] = useState<File | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF 文档相关
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderLockRef = useRef(false);

  // 下载模态框
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<ImageFormat>('png');
  const [downloadQuality, setDownloadQuality] = useState('100'); // 默认最佳质量
  const [pageRangeInput, setPageRangeInput] = useState('1');
  const [converting, setConverting] = useState(false);

  const handleShowDownloadModal = () => {
    setPageRangeInput(currentPage.toString());
    setShowDownloadModal(true);
  };

  // 清理资源
  useEffect(() => {
    return () => {
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
      }
    };
  }, [pdfObjectUrl]);

  // 渲染指定页面
  const renderPage = useCallback(async (pageNum: number, doc: PDFDocumentProxy | null = pdfDoc) => {
    if (!doc || !canvasRef.current) return;

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: PAGE_SCALE });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      setCurrentPage(pageNum);
    } catch (err) {
      // 用户快速翻页时 pdfjs 会以 RenderingCancelledException 中断旧渲染，属正常现象
      if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
        console.error('渲染页面失败:', err);
        setError(lang === 'zh' ? '渲染页面失败' : 'Failed to render page');
      }
    }
  }, [pdfDoc, lang]);

  // 监听 pdfDoc 变化，渲染第一页（解决首次加载不显示问题）
  useEffect(() => {
    if (pdfDoc && canvasRef.current && !renderLockRef.current) {
      renderLockRef.current = true;
      renderPage(1, pdfDoc).finally(() => {
        renderLockRef.current = false;
      });
    }
  }, [pdfDoc, renderPage]);

  // 加载 PDF 文档
  const loadPdfDocument = useCallback(async (file: File) => {
    try {
      const pdfjs = await loadPdfjs();
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      // 第一页渲染由 useEffect 处理
    } catch (err) {
      console.error('加载 PDF 失败:', err);
      setError(lang === 'zh' ? '加载 PDF 失败，请重试' : 'Failed to load PDF, please try again');
    }
  }, [lang]);

  // 处理文件选择
  const handleFilesSelected = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const pdfFile = fileArray.find(isPdfFile);

    if (!pdfFile) {
      setError(lang === 'zh' ? '请选择 PDF 文件' : 'Please select a PDF file');
      return;
    }

    setLoading(true);
    setError(null);

    // 清理之前的资源
    if (pdfObjectUrl) {
      URL.revokeObjectURL(pdfObjectUrl);
    }

    const objectUrl = URL.createObjectURL(pdfFile);
    setCurrentPdfFile(pdfFile);
    setPdfObjectUrl(objectUrl);

    // 加载 PDF 文档
    await loadPdfDocument(pdfFile);
    setLoading(false);
  }, [pdfObjectUrl, loadPdfDocument, lang]);

  // 处理拖拽文件（过滤 PDF）
  const handleDragFiles = useCallback((files: File[]) => {
    const validPdfFiles = files.filter(isPdfFile);
    if (validPdfFiles.length > 0) {
      void handleFilesSelected(validPdfFiles);
    } else {
      setError(lang === 'zh' ? '请选择 PDF 文件' : 'Please select a PDF file');
    }
  }, [handleFilesSelected, lang]);

  // 使用通用的拖拽处理 Hook
  const { isDragging, dragHandlers } = useDragDrop(handleDragFiles);

  // 上一页
  const handlePrevPage = () => {
    if (currentPage > 1) {
      void renderPage(currentPage - 1);
    }
  };

  // 下一页
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      void renderPage(currentPage + 1);
    }
  };

  // 解析页面范围输入
  const parsePageRange = (input: string): number[] => {
    const result: number[] = [];
    // 同时兼容英文逗号和中文逗号
    const parts = input.replace(/，/g, ',').split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(s => parseInt(s.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i > 0 && i <= totalPages) {
              result.push(i);
            }
          }
        }
      } else {
        const num = parseInt(trimmed);
        if (!isNaN(num) && num > 0 && num <= totalPages) {
          result.push(num);
        }
      }
    }

    // 去重并排序
    return [...new Set(result)].sort((a, b) => a - b);
  };

  // 转换并下载
  const handleConvertAndDownload = async () => {
    if (!pdfDoc || !currentPdfFile) return;

    const pages = parsePageRange(pageRangeInput);
    if (pages.length === 0) {
      setError(lang === 'zh' ? '请输入有效的页面范围' : 'Please enter a valid page range');
      return;
    }

    setConverting(true);

    try {
      const baseName = currentPdfFile.name.replace(/\.pdf$/i, '');
      const quality = parseInt(downloadQuality) / 100;

      // 创建临时画布进行渲染
      const tempCanvas = document.createElement('canvas');
      const rendered: { filename: string; blob: Blob }[] = [];

      for (const pageNum of pages) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: PAGE_SCALE });

        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;

        const context = tempCanvas.getContext('2d');
        if (!context) continue;

        await page.render({ canvasContext: context, viewport }).promise;

        const filename = pages.length === 1
          ? `${baseName}.${downloadFormat === 'jpeg' ? 'jpg' : downloadFormat}`
          : `${baseName}_page${pageNum}.${downloadFormat === 'jpeg' ? 'jpg' : downloadFormat}`;

        const blob = await canvasToBlob(tempCanvas, downloadFormat, quality);
        rendered.push({ filename, blob });
      }

      if (rendered.length === 0) {
        throw new Error('No pages rendered');
      }

      if (rendered.length === 1) {
        // 单页直接下载
        downloadFile(rendered[0].blob, rendered[0].filename);
      } else {
        // 多页打包为 ZIP，避免浏览器拦截连续多次下载
        const zip = new JSZip();
        for (const item of rendered) {
          zip.file(item.filename, item.blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadFile(zipBlob, `${baseName}-images.zip`);
      }

      setShowDownloadModal(false);
    } catch (err) {
      console.error('转换失败:', err);
      setError(lang === 'zh' ? '转换失败，请重试' : 'Conversion failed, please try again');
    } finally {
      setConverting(false);
    }
  };

  // 关闭 PDF
  const handleClose = () => {
    if (pdfObjectUrl) {
      URL.revokeObjectURL(pdfObjectUrl);
    }
    // 释放 pdfjs 文档占用的内存
    void pdfDoc?.destroy();
    setCurrentPdfFile(null);
    setPdfObjectUrl(null);
    setPdfDoc(null);
    setError(null);
    setCurrentPage(1);
    setTotalPages(0);
  };

  const t = {
    back: lang === 'zh' ? '返回' : 'Back',
    pdfTool: lang === 'zh' ? 'PDF 转换工具' : 'PDF Converter',
    uploadTitle: lang === 'zh' ? '上传您的 PDF 文件' : 'Upload Your PDF File',
    uploadHint: lang === 'zh' ? '选择或拖拽一个 PDF 文件进行转换' : 'Select or drag a PDF file to convert',
    dragHere: lang === 'zh' ? '拖拽 PDF 到此处' : 'Drag PDF here',
    clickSelect: lang === 'zh' ? '或点击选择文件' : 'Or click to select file',
    pages: lang === 'zh' ? '页' : 'pages',
    convertDownload: lang === 'zh' ? '转换并下载' : 'Convert & Download',
    downloadFormat: lang === 'zh' ? '下载格式' : 'Download Format',
    imageQuality: lang === 'zh' ? '图片质量 (1-100)' : 'Image Quality (1-100)',
    pageRange: lang === 'zh' ? '页面范围' : 'Page Range',
    pageRangeHint: lang === 'zh' ? '单页: 1 · 范围: 1-3 · 多个: 1,3,5' : 'Single: 1 · Range: 1-3 · Multiple: 1,3,5',
    cancel: lang === 'zh' ? '取消' : 'Cancel',
    download: lang === 'zh' ? '下载' : 'Download',
    converting: lang === 'zh' ? '转换中...' : 'Converting...',
    best: lang === 'zh' ? '最佳 (100%)' : 'Best (100%)',
    high: lang === 'zh' ? '高 (90%)' : 'High (90%)',
    medium: lang === 'zh' ? '中 (75%)' : 'Medium (75%)',
    low: lang === 'zh' ? '低 (50%)' : 'Low (50%)',
    loading: lang === 'zh' ? '正在加载 PDF...' : 'Loading PDF...',
    multiPage: lang === 'zh' ? '支持多页转换 · 使用高分辨率渲染确保转换效果最佳' : 'Multi-page support · High resolution rendering for best results',
    png: lang === 'zh' ? 'PNG - 便携式网络图形' : 'PNG - Portable Network Graphics',
    jpeg: lang === 'zh' ? 'JPEG - 联合图像专家组' : 'JPEG - Joint Photographic Experts Group',
    webp: lang === 'zh' ? 'WebP - Google 格式' : 'WebP - Google Format',
  };

  return (
    <div
      className={`flex flex-col min-h-screen bg-background text-foreground transition-colors duration-200 ${
        isDragging && !currentPdfFile ? 'bg-primary/5' : ''
      }`}
      {...dragHandlers}
    >
      {/* 全局拖拽指示器 */}
      {isDragging && !currentPdfFile && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 pointer-events-none">
          <div className="bg-card p-8 rounded-xl shadow-2xl border-2 border-dashed border-primary flex flex-col items-center gap-4">
            <FileText className="w-16 h-16 text-primary" />
            <p className="text-lg font-semibold">{t.dragHere}</p>
          </div>
        </div>
      )}

      {/* 顶部导航 */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.back}</span>
          </button>
          <h1 className="text-lg font-bold text-primary">{t.pdfTool}</h1>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 flex flex-col">
        {!currentPdfFile ? (
          // 上传区域
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-8">
                <FileText className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h2 className="text-2xl font-bold mb-2">{t.uploadTitle}</h2>
                <p className="text-muted-foreground">
                  {t.uploadHint}
                </p>
              </div>

              {/* 自定义上传区域 */}
              <div className="relative flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 h-48 hover:border-primary/50 hover:bg-muted/50">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      const validFiles = Array.from(files).filter(isPdfFile);
                      if (validFiles.length > 0) {
                        void handleFilesSelected(validFiles);
                      }
                    }
                    e.target.value = '';
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileText className="w-12 h-12" />
                  <p className="text-sm font-medium">
                    {t.dragHere}
                  </p>
                  <p className="text-xs">{t.clickSelect}</p>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
                  {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          // PDF 预览区域
          <div className="flex-1 flex flex-col">
            {/* 工具栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-semibold truncate max-w-md">
                  {currentPdfFile.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({totalPages} {t.pages})
                </span>
              </div>
              <div className="flex items-center gap-3">
                {pdfDoc && (
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                    <button
                      onClick={handlePrevPage}
                      disabled={currentPage <= 1}
                      className="px-3 py-1.5 rounded hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      ‹
                    </button>
                    <span className="text-sm text-muted-foreground min-w-20 text-center">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage >= totalPages}
                      className="px-3 py-1.5 rounded hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      ›
                    </button>
                  </div>
                )}
                <button
                  onClick={handleShowDownloadModal}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.convertDownload}</span>
                </button>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PDF 渲染区域 */}
            <div className="flex-1 overflow-auto bg-[#1a1a1a] p-8 flex items-start justify-center">
              {loading ? (
                <div className="flex items-center justify-center h-full text-white">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
                    <p>{t.loading}</p>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-none flex items-start justify-center">
                  <div className="bg-white shadow-2xl rounded-lg overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-auto"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  </div>
                </div>
              )}
              {error && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 下载模态框 */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-lg font-semibold">{t.convertDownload}</h3>
              <button
                onClick={() => setShowDownloadModal(false)}
                disabled={converting}
                className="p-2 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t.downloadFormat}</label>
                <select
                  value={downloadFormat}
                  onChange={(e) => setDownloadFormat(e.target.value as ImageFormat)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  disabled={converting}
                >
                  <option value="png">{t.png}</option>
                  <option value="jpeg">{t.jpeg}</option>
                  <option value="webp">{t.webp}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t.imageQuality}</label>
                <select
                  value={downloadQuality}
                  onChange={(e) => setDownloadQuality(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  disabled={converting}
                >
                  <option value="100">{t.best}</option>
                  <option value="90">{t.high}</option>
                  <option value="75">{t.medium}</option>
                  <option value="50">{t.low}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t.pageRange}</label>
                <input
                  type="text"
                  value={pageRangeInput}
                  onChange={(e) => setPageRangeInput(e.target.value)}
                  placeholder="e.g. 1-3, 5"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  disabled={converting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t.pageRangeHint}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
              <button
                onClick={() => setShowDownloadModal(false)}
                disabled={converting}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConvertAndDownload}
                disabled={converting}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {converting && <Loader2 className="w-4 h-4 animate-spin" />}
                {converting ? t.converting : t.download}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 功能说明 */}
      <div className="px-4 py-3 border-t border-border bg-muted/10 text-xs text-muted-foreground text-center">
        {t.multiPage}
      </div>
    </div>
  );
}
