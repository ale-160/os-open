'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { Home } from 'lucide-react';
import { getAppByPath, getAppById, getAppLocalePath, OsApp } from '@/config/apps';

/**
 * App 窗口系统：桌面图标通过 openApp 以全屏窗口打开内嵌应用，
 * 窗口状态与浏览器历史双向同步（pushState / popstate），
 * 桌面按 Home 键或 Esc 收起应用回到桌面。
 */

interface AppWindowContextValue {
  activeApp: OsApp | null;
  openApp: (app: OsApp) => void;
  closeApp: () => void;
}

// Provider 外的兜底实现：在新标签打开应用路径，保证上下文缺失时行为可用
const FALLBACK_CONTEXT: AppWindowContextValue = {
  activeApp: null,
  openApp: app => window.open(app.path, '_blank'),
  closeApp: () => {}
};

const AppWindowContext = createContext<AppWindowContextValue>(FALLBACK_CONTEXT);

export function useAppWindow(): AppWindowContextValue {
  return useContext(AppWindowContext);
}

const CLOSE_ANIMATION_MS = 220;

export function AppWindowProvider({ children }: { children: React.ReactNode }) {
  const [activeApp, setActiveApp] = useState<OsApp | null>(null);
  // 当前窗口是否由 pushState 打开（决定收起时走 history.back 还是直接复位）
  const pushedRef = useRef(false);

  // 支持深链接直接落在应用路径（如开发环境下打开 /img/）
  // 挂载期读取 location 初始化窗口状态，SSR 首帧渲染为桌面，无水印不匹配
  useEffect(() => {
    const app = getAppByPath(window.location.pathname);
    if (app) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载期一次性初始化
      setActiveApp(app);
      window.history.replaceState({ osApp: app.id }, '');
    }
  }, []);

  // 浏览器前进/后退与窗口状态双向同步
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { osApp?: string } | null;
      const app = state?.osApp ? getAppById(state.osApp) : null;
      pushedRef.current = !!app;
      setActiveApp(app);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openApp = useCallback((app: OsApp) => {
    setActiveApp(app);
    window.history.pushState({ osApp: app.id }, '', app.path);
    pushedRef.current = true;
  }, []);

  const finishClose = useCallback(() => {
    setActiveApp(null);
    pushedRef.current = false;
    if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const closeApp = useCallback(() => {
    if (pushedRef.current) {
      // 回退到打开前的桌面入口，保持历史栈一致（popstate 中完成收起）
      window.history.back();
    } else {
      finishClose();
    }
  }, [finishClose]);

  return (
    <AppWindowContext.Provider value={{ activeApp, openApp, closeApp }}>
      {children}
    </AppWindowContext.Provider>
  );
}

interface AppWindowProps {
  language?: 'zh' | 'en';
}

/**
 * 全屏应用窗口：挂载在桌面之上，应用关闭动画期间保留 iframe 避免闪断
 */
export function AppWindow({ language = 'zh' }: AppWindowProps) {
  const { activeApp, closeApp } = useAppWindow();
  // 关闭动画期间仍渲染的应用（延迟卸载 iframe 避免闪断）
  const [rendered, setRendered] = useState<OsApp | null>(null);
  // 打开：渲染期同步派生（React 官方推荐的渲染中调整状态模式）
  if (activeApp && activeApp !== rendered) {
    setRendered(activeApp);
  }
  // 窗口展开态直接由 activeApp 派生：打开即展开（进場由 animate-in 播放），
  // 收起立即切换过渡类，配合下方延迟卸载播放退场过渡
  const shown = activeApp != null;

  // 关闭动画结束后再真正卸载 iframe
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!activeApp && rendered) {
      const timer = window.setTimeout(() => setRendered(null), CLOSE_ANIMATION_MS);
      return () => window.clearTimeout(timer);
    }
  }, [activeApp]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!activeApp) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeApp();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeApp, closeApp]);

  if (!rendered) return null;

  return (
    <div
      data-os-app-window
      className={`fixed inset-0 z-50 bg-background animate-in fade-in zoom-in-95 duration-200 ease-out transition-[opacity,transform] ${
        shown ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
      }`}
    >
      <iframe
        data-os-app-frame
        key={rendered.id}
        src={getAppLocalePath(rendered, language)}
        title={language === 'zh' ? rendered.name : rendered.nameEn}
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write"
      />
      <button
        type="button"
        onClick={closeApp}
        aria-label={language === 'zh' ? '返回桌面' : 'Back to home'}
        title={language === 'zh' ? '返回桌面 (Esc)' : 'Back to home (Esc)'}
        className="absolute bottom-4 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-black/35 text-white shadow-lg backdrop-blur transition-colors hover:bg-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <Home className="h-5 w-5" />
      </button>
    </div>
  );
}
