'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useScript } from '@/hooks/useScript';

interface PlaybackSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 播放设置模态框组件
 */
export default function PlaybackSettingsModal({ isOpen, onClose }: PlaybackSettingsModalProps) {
  const { script, setScript } = useScript();

  /**
   * 处理背景颜色变化
   */
  const handleBackgroundChange = (color: string) => {
    if (script) {
      setScript({
        ...script,
        background: color
      });
    }
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
      title="播放设置"
      size="md"
    >
      <div className="space-y-6">
        {/* 背景颜色选择 */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            背景颜色
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={script?.background || '#1e1e2e'}
              onChange={(e) => handleBackgroundChange(e.target.value)}
              className="w-12 h-12 rounded cursor-pointer border border-gray-700"
            />
            <span className="text-gray-400 text-sm font-mono">
              {script?.background || '#1e1e2e'}
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            更改将立即在预览中生效
          </p>
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
