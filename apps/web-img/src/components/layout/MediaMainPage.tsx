'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { convertMedia, loadFFmpeg, mediaOutputName, MEDIA_OUTPUT_PRESETS, type MediaOutputFormat } from '@/utils/mediaConvert';
import { downloadFile, formatFileSize } from '@/utils/file';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import {
  ArrowLeft, Loader2, Download, Trash2, Music,
  PackageCheck, CheckCircle2, XCircle, X, FileAudio, FileVideo,
} from 'lucide-react';
import JSZip from 'jszip';

interface MediaItem {
  id: string;
  file: File;
  status: 'pending' | 'converting' | 'done' | 'error';
  progress: number;
  result?: { blob: Blob; filename: string };
}

export default function MediaMainPage() {
  const router = useRouter();
  // 界面语言实时跟随系统共享语言（ale-os-language）
  const { language: lang } = useLanguage();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [target, setTarget] = useState<MediaOutputFormat>('mp3');
  const [isConverting, setIsConverting] = useState(false);
  const [isLoadingCore, setIsLoadingCore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVideoTarget = MEDIA_OUTPUT_PRESETS.find((p) => p.id === target)?.kind === 'video';

  const addFiles = useCallback((files: File[]) => {
    const valid = files.filter(
      (f) => f.type.startsWith('audio/') || f.type.startsWith('video/') ||
        /\.(mp4|webm|mov|avi|mkv|m4v|mp3|wav|ogg|oga|flac|m4a|aac|opus|wma|aiff)$/i.test(f.name)
    );
    if (valid.length === 0) {
      toast.error(lang === 'zh' ? '仅支持音频/视频文件' : 'Only audio/video files are supported');
      return;
    }
    if (valid.length < files.length) toast.warning(lang === 'zh' ? `已跳过 ${files.length - valid.length} 个不支持的文件` : `Skipped ${files.length - valid.length} unsupported file(s)`);
    setItems((prev) => [...prev, ...valid.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: 'pending' as const,
      progress: 0,
    }))]);
  }, []);

  const handleConvertAll = useCallback(async () => {
    const pending = items.filter((i) => i.status !== 'converting');
    if (pending.length === 0 || isConverting) return;
    setIsConverting(true);
    setIsLoadingCore(true);

    // 首次转换前加载核心（约 31MB，带缓存）
    try {
      await loadFFmpeg();
    } catch (e) {
      setIsLoadingCore(false);
      setIsConverting(false);
      toast.error(lang === 'zh' ? `解码核心加载失败：${e instanceof Error ? e.message : '网络不可用'}（首次使用需联网下载约 31MB）` : `Decoder core failed to load: ${e instanceof Error ? e.message : 'network unavailable'} (first use needs network for ~31MB)`);
      return;
    }
    setIsLoadingCore(false);

    for (const item of pending) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'converting', progress: 0 } : i)));
      try {
        const blob = await convertMedia(item.file, target, (ratio) => {
          setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, progress: ratio } : i)));
        });
        setItems((prev) => prev.map((i) => (i.id === item.id
          ? { ...i, status: 'done', result: { blob, filename: mediaOutputName(item.file.name, target) } }
          : i)));
      } catch (e) {
        toast.error(`${item.file.name}: ${e instanceof Error ? e.message : (lang === 'zh' ? '转换失败' : 'conversion failed')}`);
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'error' } : i)));
      }
    }
    setIsConverting(false);
  }, [items, isConverting, target]);

  const handleDownloadAll = useCallback(async () => {
    const done = items.filter((i) => i.status === 'done' && i.result);
    if (done.length === 0) return;
    if (done.length === 1) {
      downloadFile(done[0].result!.blob, done[0].result!.filename);
      return;
    }
    const zip = new JSZip();
    const used = new Set<string>();
    for (const item of done) {
      let name = item.result!.filename;
      let n = 1;
      while (used.has(name.toLowerCase())) {
        const dot = item.result!.filename.lastIndexOf('.');
        name = `${item.result!.filename.slice(0, dot)}(${n})${item.result!.filename.slice(dot)}`;
        n++;
      }
      used.add(name.toLowerCase());
      zip.file(name, item.result!.blob);
    }
    downloadFile(await zip.generateAsync({ type: 'blob' }), `web-img-media-${Date.now()}.zip`);
  }, [items]);

  const doneCount = items.filter((i) => i.status === 'done').length;

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
            <span>{lang === 'zh' ? '返回' : 'Back'}</span>
          </button>
          <h1 className="text-lg font-bold text-primary">{lang === 'zh' ? '音视频转换' : 'Media Converter'}</h1>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setItems([])}
            disabled={isConverting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>{lang === 'zh' ? '清空' : 'Clear'}</span>
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* 设置面板 */}
        <aside className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card p-4 space-y-5 overflow-y-auto scrollbar-thin">
          <div>
            <label className="block text-sm font-medium mb-2">{lang === 'zh' ? '目标格式' : 'Target format'}</label>
            <div className="grid grid-cols-2 gap-1.5">
              {MEDIA_OUTPUT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTarget(p.id)}
                  disabled={isConverting}
                  title={lang === 'zh' ? p.note.zh : p.note.en}
                  className={cn(
                    'text-left px-3 py-2 rounded-lg transition-all',
                    target === p.id
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                      : 'bg-muted hover:bg-muted/80',
                    isConverting && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium uppercase">{p.id}</span>
                    <span className="text-xs opacity-70 font-mono">{p.ext}</span>
                  </div>
                  <div className="text-xs opacity-70 leading-tight mt-0.5">
                    {p.kind === 'audio' ? '🎵 ' : '🎬 '}{lang === 'zh' ? p.note.zh : p.note.en}
                  </div>
                </button>
              ))}
            </div>
            {isVideoTarget && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                {lang === 'zh' ? '⚠ 视频目标需要视频输入；从音频转视频目标会失败' : '⚠ Video targets need a video input; audio → video target will fail'}
              </p>
            )}
            {!isVideoTarget && (
              <p className="text-xs text-muted-foreground mt-2">
                {lang === 'zh' ? '💡 音频目标对视频输入同样有效（自动提取音轨）' : '💡 Audio targets also work on video inputs (audio track is extracted)'}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <button
              onClick={() => void handleConvertAll()}
              disabled={items.length === 0 || isConverting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {isLoadingCore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'zh' ? '加载解码核心（首次约 31MB）…' : 'Loading decoder core (~31MB, first time)…'}</span>
                </>
              ) : isConverting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'zh' ? '转换中…' : 'Converting…'}</span>
                </>
              ) : (
                <>
                  <Music className="w-4 h-4" />
                  <span>{lang === 'zh' ? '开始转换' : 'Convert'}</span>
                </>
              )}
            </button>
            <button
              onClick={() => void handleDownloadAll()}
              disabled={doneCount === 0 || isConverting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {doneCount > 1 ? <PackageCheck className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              <span>{lang === 'zh' ? '下载' : 'Download'}{doneCount > 1 ? (lang === 'zh' ? '全部（ZIP）' : ' all (ZIP)') : ''}{doneCount > 0 ? ` (${doneCount})` : ''}</span>
            </button>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            {lang === 'zh' ? 'ℹ️ 首次使用需联网加载 ffmpeg 解码核心（约 31MB，来自公共 CDN，浏览器缓存后离线可用）；转码全程在本地完成，文件不上传。视频转码为 WebAssembly 软解，速度显著慢于原生工具。' : 'ℹ️ First use downloads the ffmpeg core (~31MB) from a public CDN; cached by the browser and works offline afterwards. Transcoding runs fully locally. Video transcoding is software-decoded in WebAssembly — much slower than native tools.'}
          </div>
        </aside>

        {/* 文件列表 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center p-8">
              <div
                className="relative flex flex-col items-center justify-center w-full max-w-xl border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 py-14 hover:border-primary/50 hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileAudio className="w-10 h-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium">{lang === 'zh' ? '选择或拖入音频/视频文件' : 'Select or drop audio/video files'}</p>
                <p className="text-xs text-muted-foreground mt-1">MP4 / WebM / MOV / MKV / MP3 / WAV / OGG / FLAC / M4A…</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="relative overflow-hidden flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                  {item.status === 'converting' && (
                    <span aria-hidden="true" className="progress-indeterminate" />
                  )}
                  <div className="shrink-0">
                    {item.file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(item.file.name)
                      ? <FileVideo className="w-5 h-5 text-muted-foreground" />
                      : <FileAudio className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(item.file.size)}
                      {item.status === 'converting' && ` · ${Math.round(item.progress * 100)}%`}
                      {item.status === 'done' && item.result && ` → ${formatFileSize(item.result.blob.size)}`}
                    </div>
                    {item.status === 'converting' && (
                      <div className="h-1 mt-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {item.status === 'pending' && <span className="text-xs text-muted-foreground">{lang === 'zh' ? '待转换' : 'Pending'}</span>}
                    {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {item.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'done' && item.result && (
                      <button
                        onClick={() => downloadFile(item.result!.blob, item.result!.filename)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title={lang === 'zh' ? '下载' : 'Download'}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                      disabled={isConverting}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title={lang === 'zh' ? '移除' : 'Remove'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {!isConverting && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 text-sm text-muted-foreground transition-colors"
                >
                  + {lang === 'zh' ? '继续添加文件' : 'Add more files'}
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*,.mkv,.mov,.avi,.flac,.m4a,.opus"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
        className="hidden"
      />

      <footer className="px-4 py-2 border-t border-border bg-muted/10 text-xs text-muted-foreground text-center shrink-0">
        {lang === 'zh' ? '🔒 转码在浏览器本地（WebAssembly）完成，文件不会上传到服务器' : '🔒 Transcoding runs locally in your browser (WebAssembly) — files never leave your device'}
      </footer>
    </div>
  );
}
