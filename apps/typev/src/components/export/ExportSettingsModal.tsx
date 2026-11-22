'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useExportSettings } from '@/hooks/useExportSettings';
import { useLocale } from '@/hooks/useLocale';
import { GIF_MAX_EDGE, GIF_MAX_FPS, GIF_MAX_FRAMES } from '@/lib/gifPlan';
import type { ExportSettings } from '@/types/script';

interface ExportSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 导出设置模态框组件
 */
export default function ExportSettingsModal({ isOpen, onClose }: ExportSettingsModalProps) {
  const { settings, setSettings } = useExportSettings();
  const { locale } = useLocale();
  const zh = locale === 'zh';

  /**
   * 处理分辨率变化
   */
  const handleResolutionChange = (value: string) => {
    const [width, height] = value.split('x').map(Number);
    setSettings({
      ...settings,
      resolution: { width, height }
    });
  };

  /**
   * 处理帧率变化
   */
  const handleFrameRateChange = (value: number) => {
    setSettings({
      ...settings,
      frameRate: value
    });
  };

  /**
   * 处理导出格式变化
   */
  const handleFormatChange = (value: ExportSettings['format']) => {
    setSettings({
      ...settings,
      format: value
    });
  };

  /**
   * 处理保存设置
   */
  const handleSave = () => {
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="导出设置"
      size="md"
    >
      <div className="space-y-6">
        {/* 参数设置面板 */}
        <div className="grid grid-cols-1 gap-6">
          {/* 分辨率选择 */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              分辨率
            </label>
            <select
              value={`${settings.resolution.width}x${settings.resolution.height}`}
              onChange={(e) => handleResolutionChange(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="1920x1080">1920 x 1080 (Full HD)</option>
              <option value="1280x720">1280 x 720 (HD)</option>
            </select>
          </div>

          {/* 帧率选择 */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              帧率 (FPS)
            </label>
            <select
              value={settings.frameRate}
              onChange={(e) => handleFrameRateChange(Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value={24}>24 FPS</option>
              <option value={30}>30 FPS</option>
              <option value={60}>60 FPS</option>
            </select>
          </div>

          {/* 格式选择 */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              {zh ? '导出格式' : 'Export Format'}
            </label>
            <select
              value={settings.format}
              onChange={(e) => handleFormatChange(e.target.value as ExportSettings['format'])}
              className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="webm">{zh ? 'WebM 视频（实时录制）' : 'WebM video (live recording)'}</option>
              <option value="gif">{zh ? 'GIF 动图（逐帧渲染整段动画）' : 'GIF (renders the whole animation)'}</option>
            </select>
            {settings.format === 'gif' && (
              <p className="text-gray-500 text-xs mt-1">
                {zh
                  ? `GIF 帧率最高 ${GIF_MAX_FPS} FPS、最长边 ≤ ${GIF_MAX_EDGE}px、最多 ${GIF_MAX_FRAMES} 帧`
                  : `GIF is capped at ${GIF_MAX_FPS} FPS, ${GIF_MAX_EDGE}px on the long edge and ${GIF_MAX_FRAMES} frames`}
              </p>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end pt-4 border-t border-gray-700">
          <Button
            variant="primary"
            onClick={handleSave}
            size="md"
          >
            保存设置
          </Button>
        </div>
      </div>
    </Modal>
  );
}
