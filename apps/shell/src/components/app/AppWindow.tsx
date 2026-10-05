'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { Home, X } from 'lucide-react';
import { getAppByPath, getAppById, OsApp } from '@/config/apps';

/**
 * App 窗口系统（多任务）：
 * - 桌面图标通过 openApp 以全屏窗口打开内嵌应用；
 * - 「回桌面」（Home 键 / Esc / 圆形按键）只是最小化，应用保持运行（iframe 保活），
 *   再次点击桌面图标或 dock 图标即时回到应用，不重载不丢状态；
 * - 桌面 dock 展示运行中的应用，可切回，也可从 dock 关闭（卸载）应用；
 * - 窗口状态与浏览器历史双向同步（pushState / popstate），应用路径可直链；
 * - 首次打开显示加载骨架，iframe onLoad 后揭示应用。
 */

interface AppWindowContextValue {
  runningApps: readonly OsApp[];
  activeApp: OsApp | null;
  openApp: (app: OsApp) => void;
  goHome: () => void;
  killApp: (id: string) => void;
}

// Provider 外的兜底实现：在新标签打开应用路径，保证上下文缺失时行为可用
const FALLBACK_CONTEXT: AppWindowContextValue = {
  runningApps: [],
  activeApp: null,
  openApp: app => window.open(app.path, '_blank'),
  goHome: () => {},
  killApp: () => {}
};

const AppWindowContext = createContext<AppWindowContextValue>(FALLBACK_CONTEXT);

export function useAppWindow(): AppWindowContextValue {
  return useContext(AppWindowContext);
}

export function AppWindowProvider({ children }: { children: React.ReactNode }) {
  const [runningApps, setRunningApps] = useState<OsApp[]>([]);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [loadedIds, setLoadedIds] = useState<Record<string, boolean>>({});
  // 当前窗口是否由 pushState 打开（决定收起时走 history.back 还是直接复位）
  const pushedRef = useRef(false);

  const activate = useCallback((app: OsApp) => {
    setRunningApps(prev =>
      prev.some(running => running.id === app.id) ? prev : [...prev, app]
    );
    setActiveAppId(app.id);
  }, []);

  // 支持深链接直接落在应用路径（如开发环境下打开 /img/）
  useEffect(() => {
    const app = getAppByPath(window.location.pathname);
    if (app) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载期一次性初始化
      activate(app);
      window.history.replaceState({ osApp: app.id }, '');
    }
  }, [activate]);

  // 浏览器前进/后退与窗口状态双向同步
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { osApp?: string } | null;
      const app = state?.osApp ? getAppById(state.osApp) : null;
      pushedRef.current = !!app;
      if (app) {
        activate(app);
      } else {
        setActiveAppId(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [activate]);

  const openApp = useCallback(
    (app: OsApp) => {
      activate(app);
      if (activeAppId !== app.id) {
        window.history.pushState({ osApp: app.id }, '', app.path);
        pushedRef.current = true;
      }
    },
    [activate, activeAppId]
  );

  const goHome = useCallback(() => {
    setActiveAppId(null);
    if (pushedRef.current) {
      // 回退到打开前的桌面入口，保持历史栈一致（popstate 中完成收起）
      window.history.back();
    } else if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const killApp = useCallback(
    (id: string) => {
      setRunningApps(prev => prev.filter(app => app.id !== id));
      setLoadedIds(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activeAppId === id) {
        setActiveAppId(null);
        if (pushedRef.current) {
          window.history.back();
        } else if (window.location.pathname !== '/') {
          window.history.replaceState({}, '', '/');
        }
      }
    },
    [activeAppId]
  );

  const markLoaded = useCallback((id: string) => {
    setLoadedIds(prev => ({ ...prev, [id]: true }));
  }, []);

  return (
    <AppWindowContext.Provider
      value={{
        runningApps,
        activeApp: runningApps.find(app => app.id === activeAppId) ?? null,
        openApp,
        goHome,
        killApp
      }}
    >
      {children}
      <AppWindowView markLoaded={markLoaded} loadedIds={loadedIds} />
    </AppWindowContext.Provider>
  );
}

/**
 * 渲染层：所有运行中的应用窗口（保活）+ 桌面 dock
 */
function AppWindowView({
  markLoaded,
  loadedIds
}: {
  markLoaded: (id: string) => void;
  loadedIds: Record<string, boolean>;
}) {
  const { runningApps, activeApp, goHome, killApp, openApp } = useAppWindow();
  const language = 'zh';

  // Esc 收起当前应用回桌面
  useEffect(() => {
    if (!activeApp) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') goHome();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeApp, goHome]);

  return (
    <>
      {runningApps.map(app => {
        const isActive = activeApp?.id === app.id;
        const isLoaded = !!loadedIds[app.id];
        return (
          <div
            key={app.id}
            data-os-app-window={app.id}
            data-active={isActive}
            inert={!isActive}
            className={`fixed inset-0 z-50 bg-background transition-[opacity,transform] duration-200 ease-out ${
              isActive
                ? 'scale-100 opacity-100'
                : 'pointer-events-none scale-95 opacity-0'
            }`}
          >
            <iframe
              data-os-app-frame
              src={app.path}
              title={language === 'zh' ? app.name : app.nameEn}
              className="h-full w-full border-0"
              allow="clipboard-read; clipboard-write"
              onLoad={() => markLoaded(app.id)}
            />
            {!isLoaded && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background">
                <img
                  src={app.icon}
                  alt=""
                  className="h-16 w-16 animate-pulse rounded-2xl shadow-md"
                />
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? `正在打开 ${app.name}…` : `Opening ${app.nameEn}…`}
                </p>
              </div>
            )}
            {isActive && (
              <button
                type="button"
                onClick={goHome}
                aria-label={language === 'zh' ? '返回桌面' : 'Back to home'}
                title={language === 'zh' ? '返回桌面 (Esc)' : 'Back to home (Esc)'}
                className="absolute bottom-4 left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-black/35 text-white shadow-lg backdrop-blur transition-colors hover:bg-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <Home className="h-5 w-5" />
              </button>
            )}
          </div>
        );
      })}

      {/* 桌面 dock：展示运行中的应用（手机多任务形态） */}
      {!activeApp && runningApps.length > 0 && (
        <div
          data-os-dock
          className="glass fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl p-2.5 shadow-xl"
        >
          {runningApps.map(app => (
            <div key={app.id} className="group relative">
              <button
                type="button"
                onClick={() => openApp(app)}
                aria-label={language === 'zh' ? `打开 ${app.name}` : `Open ${app.nameEn}`}
                title={language === 'zh' ? app.name : app.nameEn}
                className="block h-11 w-11 overflow-hidden rounded-xl border border-border/50 transition-transform hover:scale-105 active:scale-95"
              >
                <img src={app.icon} alt="" className="h-full w-full object-cover" />
              </button>
              <span
                data-os-dock-running
                className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-foreground/70"
              />
              <button
                type="button"
                onClick={() => killApp(app.id)}
                aria-label={language === 'zh' ? `关闭 ${app.name}` : `Close ${app.nameEn}`}
                title={language === 'zh' ? `关闭 ${app.name}` : `Close ${app.nameEn}`}
                className="absolute -right-1.5 -top-1.5 hidden h-4.5 w-4.5 place-items-center rounded-full bg-foreground text-background shadow group-hover:grid focus:grid focus:outline-none"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
