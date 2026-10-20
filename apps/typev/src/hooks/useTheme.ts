import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * 主题设置接口
 */
export interface ThemeSettings {
  mode: 'light' | 'dark';
  primaryColor: string;
  gridSpacing: number;
  iconSize: 'small' | 'medium' | 'large';
  wallpaperUrl?: string;
  fontColor?: string;
}

/**
 * 默认主题配置
 */
const defaultTheme: ThemeSettings = {
  mode: 'light',
  primaryColor: '#3b82f6',
  gridSpacing: 16,
  iconSize: 'medium'
};

/**
 * 自定义 Hook：用于管理主题设置
 * @returns 包含主题状态和操作方法的对象
 */
export function useTheme() {
  // 使用 useLocalStorage Hook 管理主题状态
  const [theme, setTheme] = useLocalStorage<ThemeSettings>('app-theme', defaultTheme);

  /**
   * 切换亮暗模式
   */
  const toggleMode = useCallback(() => {
    setTheme(prev => ({
      ...prev,
      mode: prev.mode === 'light' ? 'dark' : 'light'
    }));
  }, [setTheme]);

  /**
   * 设置主题
   * @param partial - 部分主题设置对象
   */
  const updateTheme = useCallback((partial: Partial<ThemeSettings>) => {
    setTheme(prev => ({
      ...prev,
      ...partial
    }));
  }, [setTheme]);

  /**
   * 应用主题到文档根元素
   */
  const applyThemeToDocument = useCallback((currentTheme: ThemeSettings) => {
    // 服务端环境不执行
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    
    // 移除旧的模式类
    root.classList.remove('light', 'dark');
    
    // 添加新的模式类
    root.classList.add(currentTheme.mode);
    
    // 设置 CSS 自定义属性
    root.style.setProperty('--primary-color', currentTheme.primaryColor);
    root.style.setProperty('--grid-spacing', `${currentTheme.gridSpacing}px`);
    
    // 设置图标大小类
    root.classList.remove('icon-small', 'icon-medium', 'icon-large');
    root.classList.add(`icon-${currentTheme.iconSize}`);
    
    // 设置壁纸（如果存在）
    if (currentTheme.wallpaperUrl) {
      if (currentTheme.wallpaperUrl.startsWith('linear-gradient')) {
        root.style.setProperty('--wallpaper-url', currentTheme.wallpaperUrl);
      } else {
        root.style.setProperty('--wallpaper-url', `url(${currentTheme.wallpaperUrl})`);
      }
      root.style.setProperty('--wallpaper-display', 'block');
    } else {
      root.style.removeProperty('--wallpaper-url');
      root.style.setProperty('--wallpaper-display', 'none');
    }
    
    // 设置字体颜色
    if (currentTheme.fontColor) {
      root.style.setProperty('--font-color', currentTheme.fontColor);
      // 注入样式覆盖 Tailwind 的颜色类名（使用 CSS 变量优先级）
      let styleEl = document.getElementById('app-font-color-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'app-font-color-style';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        :where(body),
        :where(.text-gray-900), :where(.text-gray-700), :where(.text-gray-600), :where(.text-gray-500),
        :where(.text-gray-400), :where(.text-gray-300), :where(.text-gray-200), :where(.text-gray-100),
        :where(.dark\\:text-gray-100), :where(.dark\\:text-gray-300), :where(.dark\\:text-gray-400),
        :where(.placeholder-gray-500), :where(.dark\\:placeholder-gray-400) {
          color: var(--font-color);
        }
      `;
    } else {
      root.style.removeProperty('--font-color');
      // 移除自定义样式
      const styleEl = document.getElementById('app-font-color-style');
      if (styleEl) {
        styleEl.remove();
      }
      // 恢复默认颜色
      if (currentTheme.mode === 'dark') {
        root.style.setProperty('--font-color', '#ffffff');
      } else {
        root.style.setProperty('--font-color', '#212529');
      }
    }
    
    // 设置主题颜色变量（参考 IntelliJ IDEA Darcula 主题）
    if (currentTheme.mode === 'dark') {
      // 暗色主题
      root.style.setProperty('--bg-primary', '#1e1e1e');
      root.style.setProperty('--bg-secondary', '#2b2b2b');
      root.style.setProperty('--bg-tertiary', '#3c3c3c');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#cccccc');
      root.style.setProperty('--border-color', '#444444');
    } else {
      // 亮色主题
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f8f9fa');
      root.style.setProperty('--bg-tertiary', '#e9ecef');
      root.style.setProperty('--text-primary', '#212529');
      root.style.setProperty('--text-secondary', '#6c757d');
      root.style.setProperty('--border-color', '#dee2e6');
    }
  }, []);

  // 强类型默认值保底：检查 theme.mode 是否为非法值
  useEffect(() => {
    if (theme.mode !== 'light' && theme.mode !== 'dark') {
      console.warn('检测到非法主题模式，重置为默认值:', theme.mode);
      setTheme(prev => ({
        ...prev,
        mode: defaultTheme.mode
      }));
    }
  }, [theme.mode, setTheme, defaultTheme.mode]);

  // 初始化时同步 DOM：确保在页面 Hydration 完成的瞬间，DOM 上的 class 与初始 React 状态同步
  useEffect(() => {
    applyThemeToDocument(theme);
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 监听主题变化并应用到文档
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme, applyThemeToDocument]);

  return {
    theme,
    toggleMode,
    setTheme: updateTheme,
    isDarkMode: theme.mode === 'dark',
    isLightMode: theme.mode === 'light'
  };
}
