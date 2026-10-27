'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Modal } from './modal';
import { Button } from './button';
import { ConfigManager } from '@/lib/configManager';
import { getStrings, getBrowserLanguage } from '@/data/i18n';
import type { UserConfig } from '@/lib/configManager';
import {
  APP_URL_SCHEME,
  OS_APPS,
  groupAppsByCategory
} from '@/config/apps';
import { Upload, Globe, Sparkles, Check } from 'lucide-react';

interface SetupGuideProps {
  isOpen: boolean;
  onComplete: (config: UserConfig) => void;
}

/**
 * 首次使用引导组件
 * 使用默认配置时先挑选要放到桌面的应用，再完成初始化；
 * 导入 JSON / URL 两种方式保持原样。
 */
export function SetupGuide({ isOpen, onComplete }: SetupGuideProps) {
  const [step, setStep] = useState<'choice' | 'url' | 'apps'>('choice');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [defaultConfig, setDefaultConfig] = useState<UserConfig | null>(null);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());

  // 获取浏览器语言和文案
  const browserLang = getBrowserLanguage();
  const STRINGS = getStrings(browserLang);
  const zh = browserLang === 'zh';

  /**
   * 使用默认配置：先加载，再进入应用挑选步骤
   */
  const handleUseDefault = useCallback(async () => {
    setLoading(true);
    try {
      const config = await ConfigManager.loadDefaultConfig(browserLang);
      if (config) {
        setDefaultConfig(config);
        setSelectedAppIds(new Set(OS_APPS.map(app => app.id)));
        setStep('apps');
      } else {
        toast.error('Failed to load default configuration');
      }
    } catch (_error) {
      toast.error('Failed to load default configuration');
    } finally {
      setLoading(false);
    }
  }, [browserLang]);

  /**
   * 按勾选结果过滤默认配置：保留非应用图标与勾选的应用图标，
   * 未在注册表中的 app:// 入口原样保留以免丢数据。
   */
  const handleConfirmApps = useCallback(() => {
    if (!defaultConfig) return;
    const knownAppIds = new Set(OS_APPS.map(app => app.id));
    const keptIcons = defaultConfig.icons.filter(icon => {
      if (!icon.url.startsWith(APP_URL_SCHEME)) return true;
      const appId = icon.url.slice(APP_URL_SCHEME.length);
      if (!knownAppIds.has(appId)) return true;
      return selectedAppIds.has(appId);
    });
    const keptIconIds = new Set(keptIcons.map(icon => icon.id));
    onComplete({
      ...defaultConfig,
      icons: keptIcons,
      pages: defaultConfig.pages.map(page => ({
        ...page,
        iconIds: page.iconIds.filter(id => keptIconIds.has(id))
      })),
      rootOrder: defaultConfig.rootOrder.filter(id => keptIconIds.has(id))
    });
    toast.success(STRINGS.setupComplete || 'Setup complete');
  }, [defaultConfig, selectedAppIds, onComplete, STRINGS]);

  const toggleApp = useCallback((appId: string) => {
    setSelectedAppIds(prev => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  }, []);

  const groupedApps = useMemo(() => groupAppsByCategory(OS_APPS), []);

  /**
   * 从文件导入配置
   */
  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    try {
      const config = await ConfigManager.importFromFile(file);
      if (config) {
        onComplete(config);
        toast.success(STRINGS.importSuccess);
      } else {
        toast.error(STRINGS.importError);
      }
    } catch (_error) {
      toast.error(STRINGS.importError);
    } finally {
      setFileLoading(false);
    }
  }, [onComplete, STRINGS]);

  /**
   * 使用 URL 配置
   */
  const handleUseUrl = useCallback(() => {
    setStep('url');
  }, []);

  /**
   * 从 URL 加载配置
   */
  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) {
      toast.error(STRINGS.invalidUrl);
      return;
    }

    setLoading(true);
    try {
      // 临时设置 URL
      ConfigManager.setServerConfigUrl(urlInput.trim());

      const config = await ConfigManager.loadServerConfig();
      if (config) {
        // 保存配置和 URL
        ConfigManager.saveConfig(config);
        onComplete(config);
        toast.success(STRINGS.setupComplete || 'Setup complete');
      } else {
        toast.error(STRINGS.importError);
        // 清除 URL
        ConfigManager.setServerConfigUrl(null);
      }
    } catch (_error) {
      toast.error(STRINGS.importError);
      ConfigManager.setServerConfigUrl(null);
    } finally {
      setLoading(false);
    }
  }, [urlInput, onComplete, STRINGS]);

  /**
   * 返回选择页面
   */
  const handleBack = useCallback(() => {
    setStep('choice');
    setUrlInput('');
    setDefaultConfig(null);
    setSelectedAppIds(new Set());
  }, []);

  // 应用挑选页面（默认配置的第二步）
  if (step === 'apps' && defaultConfig) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title={STRINGS.selectApps || 'Choose Apps'} size="lg" hideCloseButton>
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold text-foreground">
              {STRINGS.selectApps || 'Choose Apps to Add'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {STRINGS.selectAppsDesc || 'Select the apps you want on your desktop'}
            </p>
          </div>

          <div className="max-h-[46vh] overflow-y-auto space-y-4 pr-1">
            {groupedApps.map(group => (
              <div key={group.category.id} className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground px-1">
                  {zh ? group.category.name : group.category.nameEn}
                </h3>
                {group.apps.map(app => {
                  const checked = selectedAppIds.has(app.id);
                  return (
                    <button
                      key={app.id}
                      onClick={() => toggleApp(app.id)}
                      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        checked
                          ? 'border-primary bg-primary/5'
                          : 'border-border/60 hover:bg-accent/50'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          checked
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border'
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <img
                        src={app.icon}
                        alt=""
                        className="h-10 w-10 rounded-lg border border-border/50 object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-sm truncate">
                          {zh ? app.name : app.nameEn}
                        </span>
                        <span className="block text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {zh ? app.description : app.descriptionEn}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedAppIds(new Set(OS_APPS.map(app => app.id)))}
            >
              {STRINGS.selectAppsAll || 'Select All'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedAppIds(new Set())}
            >
              {STRINGS.selectAppsClear || 'Clear All'}
            </Button>
            <Button className="ml-auto" onClick={handleConfirmApps}>
              {STRINGS.selectAppsConfirm || 'Get Started'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // 选择页面
  if (step === 'choice') {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title={STRINGS.welcome || 'Welcome'} size="lg" hideCloseButton>
        <div className="space-y-6">
          {/* 欢迎信息 */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              {STRINGS.welcomeTitle || 'Welcome to Ale OS'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {STRINGS.welcomeDesc || 'Choose how you want to initialize your configuration'}
            </p>
          </div>

          {/* 选择卡片 */}
          <div className="grid gap-4">
            {/* 使用默认配置 */}
            <button
              onClick={handleUseDefault}
              disabled={loading}
              className="p-6 border border-border rounded-lg hover:border-primary hover:bg-accent/50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">
                    {STRINGS.useDefault || 'Use Default Configuration'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {STRINGS.useDefaultDesc || 'Start with the default configuration and customize it later'}
                  </p>
                </div>
              </div>
            </button>

            {/* 导入 JSON 文件 */}
            <label
              className="p-6 border border-border rounded-lg hover:border-primary hover:bg-accent/50 transition-all cursor-pointer"
            >
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                disabled={fileLoading}
                className="hidden"
              />
              <div className="flex items-start gap-4">
                <div className="p-3 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
                  <Upload className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">
                    {STRINGS.importJson || 'Import JSON File'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {STRINGS.importJsonDesc || 'Import a previously exported configuration file'}
                  </p>
                </div>
              </div>
            </label>

            {/* 使用 URL */}
            <button
              onClick={handleUseUrl}
              className="p-6 border border-border rounded-lg hover:border-primary hover:bg-accent/50 transition-all text-left"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
                  <Globe className="w-6 h-6 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">
                    {STRINGS.useUrl || 'Use URL'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {STRINGS.useUrlDesc || 'Load configuration from a remote URL (supports cloud sync)'}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // URL 输入页面
  return (
    <Modal isOpen={isOpen} onClose={() => {}} title={STRINGS.useUrl || 'Use URL'} size="lg" hideCloseButton>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            {STRINGS.enterConfigUrl || 'Enter Configuration URL'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {STRINGS.enterConfigUrlDesc || 'Provide a URL to a JSON configuration file'}
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={STRINGS.serverConfigUrlPlaceholder}
            className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            disabled={loading}
          />

          <div className="flex gap-3">
            <Button
              onClick={handleBack}
              variant="secondary"
              className="flex-1"
              disabled={loading}
            >
              {STRINGS.back || 'Back'}
            </Button>
            <Button
              onClick={handleUrlSubmit}
              className="flex-1"
              disabled={!urlInput.trim() || loading}
            >
              {loading ? (STRINGS.loading || 'Loading...') : (STRINGS.confirm || 'Confirm')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
