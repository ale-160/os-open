'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useExportSettings } from '@/hooks/useExportSettings';

interface ExportSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 导出设置模态框组件
 */
export default function ExportSettingsModal({ isOpen, onClose }: ExportSettingsModalProps) {
  const { settings, setSettings } = useExportSettings();

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
              导出格式
            </label>
            <select
              value={settings.format}
              disabled
              className="w-full px-4 py-2 bg-gray-800 text-gray-500 border border-gray-700 rounded-lg cursor-not-allowed"
            >
              <option value="webm">WebM (可用)</option>
              <option value="gif">GIF (暂不可用)</option>
            </select>
            <p className="text-gray-500 text-xs mt-1">GIF 格式暂未实现</p>
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
