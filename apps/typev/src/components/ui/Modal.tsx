import { useEffect, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

/**
 * 模态框组件
 * @param props - 模态框属性
 */
export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  /**
   * 处理 ESC 键关闭
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  /**
   * 处理遮罩层点击关闭
   */
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  /**
   * 控制 body 滚动
   */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  // 尺寸配置
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-3xl',
    '2xl': 'max-w-4xl',
    '3xl': 'max-w-5xl',
    '4xl': 'max-w-6xl',
    '5xl': 'max-w-7xl'
  };

  // 如果不打开，返回 null
  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity duration-300"
        onClick={handleBackdropClick}
      />
      
      {/* 模态框内容 */}
      <div
        className={`relative bg-gray-950 rounded-lg shadow-xl w-full ${sizeClasses[size]} transform transition-all duration-300 scale-100 opacity-100`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 
            id="modal-title"
            className="text-lg font-semibold text-gray-100"
          >
            {title}
          </h3>
          
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="关闭模态框"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
