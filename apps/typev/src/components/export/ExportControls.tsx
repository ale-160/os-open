'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useExportSettings } from '@/hooks/useExportSettings';
import { startRecording, stopRecording, downloadBlob } from './MediaRecorderExport';

interface ExportControlsProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isCanvasReady: boolean;
  isSettingsOpen: boolean;
  onRecordingChange?: (isRecording: boolean) => void;
}

/**
 * 录制控制组件（仅负责录制功能）
 */
export default function ExportControls({ 
  canvasRef, 
  isCanvasReady,
  isSettingsOpen,
  onRecordingChange 
}: ExportControlsProps) {
  const { settings } = useExportSettings();
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  /**
   * 检查浏览器是否支持 MediaRecorder
   */
  const checkBrowserSupport = (): boolean => {
    if (!window.MediaRecorder) {
      setError('您的浏览器不支持 MediaRecorder API');
      return false;
    }

    // 检查是否支持指定的 MIME 类型
    const mimeType = settings.format === 'webm' ? 'video/webm' : 'video/gif';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      setError(`您的浏览器不支持 ${settings.format} 格式`);
      return false;
    }

    return true;
  };

  /**
   * 处理开始/停止录制
   */
  const handleToggleRecording = async () => {
    if (isRecording) {
      // 停止录制
      try {
        if (recorderRef.current) {
          const blob = await stopRecording(recorderRef.current);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `typev-导出-${timestamp}.${settings.format}`;
          downloadBlob(blob, filename);
          setIsRecording(false);
          recorderRef.current = null;
          setError(null);
          onRecordingChange?.(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '录制失败');
        setIsRecording(false);
        recorderRef.current = null;
        onRecordingChange?.(false);
      }
    } else {
      // 开始录制
      if (!canvasRef.current) {
        setError('Canvas 元素未就绪');
        return;
      }

      if (!checkBrowserSupport()) {
        return;
      }

      try {
        const mimeType = settings.format === 'webm' ? 'video/webm' : 'video/gif';
        recorderRef.current = startRecording(
          canvasRef.current,
          settings.frameRate,
          mimeType
        );
        setIsRecording(true);
        setError(null);
        onRecordingChange?.(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : '启动录制失败');
      }
    }
  };

  // 如果浏览器不支持，显示错误提示
  if (error && !isRecording) {
    return (
      <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <button
      onClick={handleToggleRecording}
      disabled={!isCanvasReady}
      className="p-2 rounded transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      title={isRecording ? '停止录制' : '开始录制'}
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
  );
}
