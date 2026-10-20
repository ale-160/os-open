'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { convertSheetFile, SHEET_OUTPUT_FORMATS, SHEET_INPUT_EXTENSIONS, type SheetOutputFormat, type SheetConversion } from '@/utils/sheetConvert';
import { extractPdfText } from '@/utils/pdfText';
import { downloadFile, formatFileSize } from '@/utils/file';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Loader2, Download, Trash2, FileSpreadsheet,
  PackageCheck, FileText, Table2,
} from 'lucide-react';
import JSZip from 'jszip';

interface ResultItem {
  id: string;
  sourceName: string;
  results: SheetConversion[];
}


/** 结果列表（独立组件，避免渲染期创建组件） */
function ResultList({ items, onDownloadAll, count, emptyHint }: {
  items: ResultItem[];
  onDownloadAll: () => void;
  count: number;
  emptyHint: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">{emptyHint}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="p-2.5 rounded-lg bg-card border border-border space-y-1">
          <div className="text-sm font-medium truncate">{item.sourceName}</div>
          {item.results.map((r) => (
            <div key={r.filename} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate flex-1">{r.filename}</span>
              <span className="shrink-0">{formatFileSize(r.blob.size)}</span>
              <button
                onClick={() => downloadFile(r.blob, r.filename)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="下载"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ))}
      <button
        onClick={onDownloadAll}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm font-medium"
      >
        {count > 1 ? <PackageCheck className="w-4 h-4" /> : <Download className="w-4 h-4" />}
        下载{count > 1 ? '全部（ZIP）' : ''}（{count}）
      </button>
    </div>
  );
}

export default function SheetMainPage() {
  const router = useRouter();

  // ── 表格转换 ──
  const [sheetFiles, setSheetFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<SheetOutputFormat>('xlsx');
  const [sheetResults, setSheetResults] = useState<ResultItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  // ── PDF 提取文本 ──
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [pdfResults, setPdfResults] = useState<ResultItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const isSheetInput = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    return SHEET_INPUT_EXTENSIONS.some((ext) => name.endsWith(ext));
  }, []);

  const addSheetFiles = useCallback((files: File[]) => {
    const valid = files.filter(isSheetInput);
    if (valid.length === 0) {
      toast.error('仅支持 XLSX / XLS / CSV / TSV / ODS / JSON 文件');
      return;
    }
    if (valid.length < files.length) toast.warning(`已跳过 ${files.length - valid.length} 个不支持的文件`);
    setSheetFiles((prev) => [...prev, ...valid]);
    setSheetResults([]);
  }, [isSheetInput]);

  const addPdfFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (valid.length === 0) {
      toast.error('仅支持 PDF 文件');
      return;
    }
    setPdfFiles((prev) => [...prev, ...valid]);
    setPdfResults([]);
  }, []);

  /** 表格批量转换：每个输入文件产生 1..N 个输出（多表拆分） */
  const handleConvertSheets = useCallback(async () => {
    if (sheetFiles.length === 0 || isConverting) return;
    setIsConverting(true);
    const out: ResultItem[] = [];
    let ok = 0;
    let fail = 0;
    for (const file of sheetFiles) {
      try {
        const results = await convertSheetFile(file, format);
        out.push({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, sourceName: file.name, results });
        ok++;
      } catch (e) {
        fail++;
        toast.error(`${file.name}：${e instanceof Error ? e.message : '转换失败'}`);
      }
    }
    setSheetResults(out);
    setIsConverting(false);
    if (ok > 0) toast.success(`已转换 ${ok} 个文件`);
    if (fail > 0) toast.warning(`${fail} 个文件转换失败`);
  }, [sheetFiles, format, isConverting]);

  /** PDF 批量提取文本 */
  const handleExtractPdfs = useCallback(async () => {
    if (pdfFiles.length === 0 || isExtracting) return;
    setIsExtracting(true);
    const out: ResultItem[] = [];
    let ok = 0;
    let fail = 0;
    for (const file of pdfFiles) {
      try {
        const text = await extractPdfText(file, (page, total) =>
          setPdfProgress(`${file.name}（${page}/${total} 页）`)
        );
        out.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          sourceName: file.name,
          results: [
            {
              filename: `${file.name.replace(/\.pdf$/i, '')}.txt`,
              blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
              sheetName: 'text',
            },
          ],
        });
        ok++;
      } catch (e) {
        fail++;
        toast.error(`${file.name}：${e instanceof Error ? e.message : '提取失败'}`);
      }
    }
    setPdfProgress('');
    setPdfResults(out);
    setIsExtracting(false);
    if (ok > 0) toast.success(`已提取 ${ok} 个 PDF`);
    if (fail > 0) toast.warning(`${fail} 个 PDF 提取失败`);
  }, [pdfFiles, isExtracting]);

  /** 下载单个面板的全部结果（多于 1 个文件时打包 ZIP） */
  const downloadAll = useCallback(async (items: ResultItem[], zipName: string) => {
    const files = items.flatMap((item) => item.results);
    if (files.length === 0) return;
    if (files.length === 1) {
      downloadFile(files[0].blob, files[0].filename);
      return;
    }
    const zip = new JSZip();
    const used = new Set<string>();
    for (const f of files) {
      let name = f.filename;
      let n = 1;
      while (used.has(name.toLowerCase())) {
        const dot = f.filename.lastIndexOf('.');
        name = `${f.filename.slice(0, dot)}(${n})${f.filename.slice(dot)}`;
        n++;
      }
      used.add(name.toLowerCase());
      zip.file(name, f.blob);
    }
    downloadFile(await zip.generateAsync({ type: 'blob' }), `${zipName}-${Date.now()}.zip`);
  }, []);

  const sheetCount = sheetResults.reduce((sum, r) => sum + r.results.length, 0);
  const pdfCount = pdfResults.reduce((sum, r) => sum + r.results.length, 0);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* 顶部导航 */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </button>
          <h1 className="text-lg font-bold text-primary">数据转换</h1>
        </div>
        {(sheetFiles.length > 0 || pdfFiles.length > 0) && (
          <button
            onClick={() => {
              setSheetFiles([]);
              setSheetResults([]);
              setPdfFiles([]);
              setPdfResults([]);
            }}
            disabled={isConverting || isExtracting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>清空</span>
          </button>
        )}
      </header>

      <main className="flex-1 grid lg:grid-cols-2 gap-4 p-4 max-w-5xl w-full mx-auto">
        {/* ── 表格转换 ── */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-4 self-start">
          <div className="flex items-center gap-2">
            <Table2 className="w-4.5 h-4.5 text-primary" />
            <h2 className="font-semibold">表格转换</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            XLSX / XLS / CSV / TSV / ODS / JSON / YAML / TOML / HTML 表格互转；多表工作簿导出 CSV 等按表拆分，XLSX/ODS 保留全部表；YAML/TOML 配置对象自动转键值表或行表
          </p>

          <div
            className="relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
            onClick={() => sheetInputRef.current?.click()}
          >
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">选择或拖入表格文件</p>
            <p className="text-xs text-muted-foreground mt-1">支持批量 · {sheetFiles.length > 0 ? `已选 ${sheetFiles.length} 个` : '零依赖本地转换'}</p>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {SHEET_OUTPUT_FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                disabled={isConverting}
                title={f.note.zh}
                className={cn(
                  'px-2 py-1.5 rounded-lg transition-all text-center',
                  format === f.id
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                    : 'bg-muted hover:bg-muted/80',
                  isConverting && 'opacity-60 cursor-not-allowed'
                )}
              >
                <div className="text-sm font-medium uppercase">{f.id}</div>
                <div className="text-[10px] opacity-70 font-mono">{f.ext}</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => void handleConvertSheets()}
            disabled={sheetFiles.length === 0 || isConverting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isConverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Table2 className="w-4 h-4" />}
            {isConverting ? '转换中...' : '开始转换'}
          </button>

          <ResultList
            items={sheetResults}
            count={sheetCount}
            onDownloadAll={() => void downloadAll(sheetResults, 'web-img-sheet')}
            emptyHint="转换结果将显示在这里"
          />
        </section>

        {/* ── PDF 提取文本 ── */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-4 self-start">
          <div className="flex items-center gap-2">
            <FileText className="w-4.5 h-4.5 text-primary" />
            <h2 className="font-semibold">PDF 提取文本</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            从 PDF 中提取文字为 TXT（逐页保留顺序，多页带页码标记）；本地解析，文件不上传
          </p>

          <div
            className="relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
            onClick={() => pdfInputRef.current?.click()}
          >
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">选择或拖入 PDF 文件</p>
            <p className="text-xs text-muted-foreground mt-1">支持批量 · {pdfFiles.length > 0 ? `已选 ${pdfFiles.length} 个` : '扫描件无文字层将得到空文本'}</p>
          </div>

          <button
            onClick={() => void handleExtractPdfs()}
            disabled={pdfFiles.length === 0 || isExtracting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {isExtracting ? (pdfProgress || '提取中...') : '提取文本'}
          </button>

          <ResultList
            items={pdfResults}
            count={pdfCount}
            onDownloadAll={() => void downloadAll(pdfResults, 'web-img-pdf-text')}
            emptyHint="提取的文本将显示在这里"
          />
        </section>
      </main>

      {/* 隐藏文件选择器 */}
      <input
        ref={sheetInputRef}
        type="file"
        multiple
        accept={SHEET_INPUT_EXTENSIONS.join(',')}
        onChange={(e) => {
          if (e.target.files?.length) addSheetFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={pdfInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        onChange={(e) => {
          if (e.target.files?.length) addPdfFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
        className="hidden"
      />

      <footer className="px-4 py-2 border-t border-border bg-muted/10 text-xs text-muted-foreground text-center shrink-0">
        🔒 所有转换在浏览器本地完成，文件不会上传到服务器
      </footer>
    </div>
  );
}
