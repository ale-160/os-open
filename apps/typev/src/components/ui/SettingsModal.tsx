'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import StyleGuideModal from '@/components/guide/StyleGuideModal';
import { useExportSettings } from '@/hooks/useExportSettings';
import { useScript } from '@/hooks/useScript';
import { useLocale } from '@/hooks/useLocale';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingTab = 'export' | 'playback';

interface MenuCategory {
  id: string;
  label: string;
  cultivationLabel: string;
  items: { id: SettingTab; label: string; cultivationLabel: string; icon: React.ReactNode }[];
}

/**
 * 统一设置模态框组件
 * 左侧菜单 + 右侧内容的布局
 */
export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingTab>('export');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const { settings, setSettings } = useExportSettings();
  const { script, setScript } = useScript();
  const { locale, setLocale } = useLocale();

  /**
   * 处理导出设置变化
   */
  const handleResolutionChange = (value: string) => {
    const [width, height] = value.split('x').map(Number);
    setSettings({
      ...settings,
      resolution: { width, height }
    });
  };

  const handleFrameRateChange = (value: number) => {
    setSettings({
      ...settings,
      frameRate: value
    });
  };

  /**
   * 处理播放设置变化
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
   * 处理最大可见句数变化
   */
  const handleMaxVisibleChange = (value: number) => {
    if (script) {
      setScript({
        ...script,
        globalStyle: {
          ...script.globalStyle,
          maxVisible: value.toString()
        }
      });
    }
  };

  /**
   * 切换分类折叠状态
   */
  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  /**
   * 菜单分类配置
   */
  const menuCategories: MenuCategory[] = [
    {
      id: 'general',
      label: '通用设置',
      cultivationLabel: '外门杂务',
      items: [
        {
          id: 'export',
          label: '导出设置',
          cultivationLabel: '飞升凭证',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )
        },
        {
          id: 'playback',
          label: '播放设置',
          cultivationLabel: '内观洞府',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )
        }
      ]
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="设置"
      size="lg"
    >
      <div className="flex h-[500px] bg-gray-950">
        {/* 左侧菜单栏 */}
        <div className="w-48 bg-gray-950 border-r border-gray-800 p-4 flex flex-col">
          <nav className="space-y-2 flex-1">
            {menuCategories.map((category) => (
              <div key={category.id}>
                {/* 分类标题 */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full bg-gray-800 text-gray-300 px-4 py-2 rounded-lg text-left cursor-pointer flex items-center justify-between hover:bg-gray-700 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {category.label}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${collapsedCategories[category.id] ? '' : 'rotate-180'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 子菜单项 */}
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    collapsedCategories[category.id] ? 'max-h-0' : 'max-h-40'
                  }`}
                >
                  <div className="mt-1 space-y-1">
                    {category.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          activeTab === item.id
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        <span className={activeTab === item.id ? 'text-white' : 'text-gray-300'}>
                          {item.icon}
                        </span>
                        <span className="text-sm font-medium">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>

          {/* 词典按钮和语言设置 */}
          <div className="pt-4 border-t border-gray-800 mt-4 space-y-2">
            {/* 词典按钮 */}
            <button
              onClick={() => {
                setIsGuideOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-all text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              词典
            </button>
            
            {/* 界面语言设置 */}
            <div>
              <label className="block text-gray-400 text-xs mb-1">界面语言</label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as 'zh' | 'en')}
                className="w-full px-3 py-2 bg-gray-900 text-white border border-gray-800 rounded-lg text-sm focus:border-blue-500 outline-none"
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-950">
          {/* 导出设置面板 */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <h3 className="text-white text-lg font-semibold">导出设置</h3>
              
              {/* 分辨率选择 */}
              <div>
                <label className="block text-gray-200 text-sm font-medium mb-2">
                  分辨率
                </label>
                <select
                  value={`${settings.resolution.width}x${settings.resolution.height}`}
                  onChange={(e) => handleResolutionChange(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 text-white border border-gray-800 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="1920x1080">1920 x 1080 (Full HD)</option>
                  <option value="1280x720">1280 x 720 (HD)</option>
                </select>
              </div>

              {/* 帧率选择 */}
              <div>
                <label className="block text-gray-200 text-sm font-medium mb-2">
                  帧率 (FPS)
                </label>
                <select
                  value={settings.frameRate}
                  onChange={(e) => handleFrameRateChange(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-900 text-white border border-gray-800 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value={24}>24 FPS</option>
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>
              </div>

              {/* 格式选择 */}
              <div>
                <label className="block text-gray-200 text-sm font-medium mb-2">
                  导出格式
                </label>
                <select
                  value={settings.format}
                  disabled
                  className="w-full px-4 py-2 bg-gray-900 text-gray-500 border border-gray-800 rounded-lg cursor-not-allowed"
                >
                  <option value="webm">WebM (可用)</option>
                  <option value="gif">GIF (暂不可用)</option>
                </select>
                <p className="text-gray-500 text-xs mt-1">GIF 格式暂未实现</p>
              </div>
            </div>
          )}

          {/* 播放设置面板 */}
          {activeTab === 'playback' && (
            <div className="space-y-6">
              <h3 className="text-white text-lg font-semibold">播放设置</h3>
              
              {/* 背景颜色选择 */}
              <div>
                <label className="block text-gray-200 text-sm font-medium mb-2">
                  背景颜色
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={script?.background || '#1e1e2e'}
                    onChange={(e) => handleBackgroundChange(e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border border-gray-800"
                  />
                  <span className="text-gray-300 text-sm font-mono">
                    {script?.background || '#1e1e2e'}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  更改将立即在预览中生效
                </p>
              </div>

              {/* 最大可见句数 */}
              <div>
                <label className="block text-gray-200 text-sm font-medium mb-2">
                  最大可见句数
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={parseInt(script?.globalStyle?.maxVisible || '2', 10)}
                  onChange={(e) => handleMaxVisibleChange(parseInt(e.target.value, 10))}
                  disabled={!script}
                  className="w-full px-4 py-2 bg-gray-900 text-white border border-gray-800 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-gray-500 text-xs mt-2">
                  控制同时显示的已完成句子数量（1-10）
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 样式指南模态框 */}
      <StyleGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialCategory="cultivation"
      />
    </Modal>
  );
}
