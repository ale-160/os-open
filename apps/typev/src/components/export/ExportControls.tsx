'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { saveAsset } from '@os/shared/os-assets';
import { useExportSettings } from '@/hooks/useExportSettings';
import { useScript } from '@/hooks/useScript';
import { useLocale } from '@/hooks/useLocale';
import { baseMimeType, buildExportFilename } from '@/lib/gifPlan';
import { startRecording, stopRecording, downloadBlob } from './MediaRecorderExport';
import { exportScriptAsGif } from './GifExport';

interface ExportControlsProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isCanvasReady: boolean;
  isSettingsOpen: boolean;
  /** 与预览一致的最大可见句数（GIF 离线渲染用） */
  maxVisibleLines?: number;
  onRecordingChange?: (isRecording: boolean) => void;
}

/** 最近一次导出的产物（供「保存到图库」使用） */
interface ExportResult {
  blob: Blob;
  filename: string;
}

/** Blob → dataURL（与 web-img 一致：图库存可持久化的 dataURL，blob: URL 跨文档无效） */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 导出控制组件
 * - WebM：MediaRecorder 实时录制画布（点击开始 / 再次点击停止并下载）
 * - GIF：离线逐帧渲染整段动画并编码（显示进度，导出中再次点击取消）
 * - 导出完成后可「保存到图库」（Ale OS 系统资产库）
 */
export default function ExportControls({
  canvasRef,
  isCanvasReady,
  maxVisibleLines = 2,
  onRecordingChange
}: ExportControlsProps) {
  const { settings } = useExportSettings();
  const { script } = useScript();
  const { locale } = useLocale();
  const zh = locale === 'zh';

  const [isRecording, setIsRecording] = useState(false);
  const [gifProgress, setGifProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const gifAbortRef = useRef<AbortController | null>(null);

  const isGif = settings.format === 'gif';
  const isExportingGif = gifProgress !== null;

  // 卸载时取消进行中的 GIF 导出
  useEffect(() => () => gifAbortRef.current?.abort(), []);

  /** 导出完成：下载 + 记录产物以便存入图库 */
  const finishExport = (blob: Blob, extension: string) => {
    const filename = buildExportFilename(extension);
    downloadBlob(blob, filename);
    setLastExport({ blob, filename });
    setError(null);
  };

  /**
   * 检查浏览器是否支持 WebM 录制
   */
  const checkRecorderSupport = (): boolean => {
    if (!window.MediaRecorder) {
      setError(zh ? '您的浏览器不支持 MediaRecorder API' : 'MediaRecorder API is not supported in this browser');
      return false;
    }
    if (!MediaRecorder.isTypeSupported('video/webm')) {
      setError(zh ? '您的浏览器不支持 WebM 格式' : 'WebM is not supported in this browser');
      return false;
    }
    return true;
  };

  /**
   * WebM：开始/停止录制
   */
  const handleToggleRecording = async () => {
    if (isRecording) {
      try {
        if (recorderRef.current) {
          const blob = await stopRecording(recorderRef.current);
          finishExport(blob, 'webm');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : (zh ? '录制失败' : 'Recording failed'));
      } finally {
        setIsRecording(false);
        recorderRef.current = null;
        onRecordingChange?.(false);
      }
      return;
    }

    if (!canvasRef.current) {
      setError(zh ? 'Canvas 元素未就绪' : 'Canvas is not ready');
      return;
    }
    if (!checkRecorderSupport()) {
      return;
    }

    try {
      recorderRef.current = startRecording(canvasRef.current, settings.frameRate, 'video/webm');
      setIsRecording(true);
      setError(null);
      onRecordingChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : (zh ? '启动录制失败' : 'Failed to start recording'));
    }
  };

  /**
   * GIF：开始导出 / 导出中再次点击取消
   */
  const handleGifExport = async () => {
    if (isExportingGif) {
      gifAbortRef.current?.abort();
      return;
    }
    if (!script) {
      setError(zh ? '请先在编辑器中创建脚本' : 'Create a script in the editor first');
      return;
    }

    const controller = new AbortController();
    gifAbortRef.current = controller;
    setError(null);
    setGifProgress(0);
    try {
      const blob = await exportScriptAsGif({
        script,
        maxVisibleLines,
        resolution: settings.resolution,
        frameRate: settings.frameRate,
        signal: controller.signal,
        onProgress: setGifProgress
      });
      finishExport(blob, 'gif');
      toast.success(zh ? 'GIF 导出完成' : 'GIF exported');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast(zh ? '已取消 GIF 导出' : 'GIF export cancelled');
      } else {
        setError(err instanceof Error ? err.message : (zh ? 'GIF 导出失败' : 'GIF export failed'));
      }
    } finally {
      if (gifAbortRef.current === controller) gifAbortRef.current = null;
      setGifProgress(null);
    }
  };

  /**
   * 保存最近一次导出到系统图库（与 web-img 一致：dataURL + saveAsset + toast）
   */
  const handleSaveToGallery = async () => {
    if (!lastExport) return;
    setIsSaving(true);
    try {
      const { blob, filename } = lastExport;
      const fallback = filename.endsWith('.gif') ? 'image/gif' : 'video/webm';
      // MediaRecorder 的 mimeType 可能带 codecs 参数，入库前归一化为主类型
      const normalized = new Blob([blob], { type: baseMimeType(blob.type, fallback) });
      const dataUrl = await blobToDataUrl(normalized);
      await saveAsset({ name: filename, dataUrl });
      toast.success(zh ? '已保存到图库' : 'Saved to gallery');
    } catch {
      toast.error(zh ? '保存失败：存储空间不足或不可用' : 'Save failed: storage is full or unavailable');
    } finally {
      setIsSaving(false);
    }
  };

  const busy = isRecording || isExportingGif;
  const progressPercent = gifProgress === null ? 0 : Math.round(gifProgress * 100);

  return (
    <div className="flex items-center gap-2">
      {/* 录制进行中即使切换了格式，也保留停止按钮 */}
      {isGif && !isRecording ? (
        <button
          onClick={handleGifExport}
          disabled={!isCanvasReady || !script}
          className="flex items-center gap-1.5 p-2 rounded transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={isExportingGif ? (zh ? '取消 GIF 导出' : 'Cancel GIF export') : (zh ? '导出 GIF' : 'Export GIF')}
          aria-label={isExportingGif ? (zh ? '取消 GIF 导出' : 'Cancel GIF export') : (zh ? '导出 GIF' : 'Export GIF')}
        >
          <span
            className={`rounded border px-1 text-[10px] font-bold leading-4 ${
              isExportingGif ? 'border-red-500 text-red-500' : 'border-white text-white'
            }`}
          >
            GIF
          </span>
          {isExportingGif && (
            <span className="text-xs text-gray-300 tabular-nums">{progressPercent}%</span>
          )}
        </button>
      ) : (
        <button
          onClick={handleToggleRecording}
          disabled={!isCanvasReady}
          className="p-2 rounded transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={isRecording ? (zh ? '停止录制' : 'Stop recording') : (zh ? '开始录制' : 'Start recording')}
          aria-label={isRecording ? (zh ? '停止录制' : 'Stop recording') : (zh ? '开始录制' : 'Start recording')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            className={isRecording ? 'text-red-500' : 'text-white'}
          >
            <circle
              cx="12"
              cy="12"
              r="8"
              fill={isRecording ? 'currentColor' : 'none'}
              stroke={isRecording ? 'none' : 'currentColor'}
              strokeWidth="2"
            />
          </svg>
        </button>
      )}

      {/* GIF 导出进度条 */}
      {isExportingGif && (
        <div
          className="h-1.5 w-24 overflow-hidden rounded bg-gray-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div className="h-full bg-blue-500 transition-[width]" style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      {/* 保存最近一次导出到系统图库 */}
      {lastExport && !busy && (
        <button
          onClick={handleSaveToGallery}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-gray-200 transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={lastExport.filename}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          {zh ? '保存到图库' : 'Save to Gallery'}
        </button>
      )}

      {error && !busy && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-white text-sm"
            aria-label={zh ? '关闭错误提示' : 'Dismiss error'}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
