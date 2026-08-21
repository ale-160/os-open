'use client';

import React, { useState, useCallback, useEffect } from 'react';

/**
 * 通用的拖拽文件处理 Hook
 */
export function useDragDrop(onFilesDropped: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false);

  // 从拖拽事件中提取文件
  const extractFiles = useCallback((e: DragEvent | React.DragEvent): File[] => {
    const items = e.dataTransfer?.items;
    let filesToProcess: File[] = [];

    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            filesToProcess.push(file);
          }
        }
      }
    }

    if (filesToProcess.length === 0) {
      filesToProcess = Array.from(e.dataTransfer?.files ?? []);
    }

    return filesToProcess;
  }, []);

  // 拖拽事件处理
  const handleDragOver = useCallback((e: DragEvent | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = extractFiles(e);
    if (files.length > 0) {
      onFilesDropped(files);
    }
  }, [extractFiles, onFilesDropped]);

  // 注册全局拖拽事件监听
  useEffect(() => {
    const handleNativeDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleNativeDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // 仅在真正离开窗口时取消状态；
      // 在窗口内元素间移动也会触发 dragleave（relatedTarget 非空），忽略以避免指示器闪烁
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleNativeDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = extractFiles(e);
      if (files.length > 0) {
        onFilesDropped(files);
      }
    };

    window.addEventListener('dragover', handleNativeDragOver);
    window.addEventListener('dragleave', handleNativeDragLeave);
    window.addEventListener('drop', handleNativeDrop);

    return () => {
      window.removeEventListener('dragover', handleNativeDragOver);
      window.removeEventListener('dragleave', handleNativeDragLeave);
      window.removeEventListener('drop', handleNativeDrop);
    };
  }, [extractFiles, onFilesDropped]);

  // React 事件处理器（参数类型为联合类型，可直接赋值给 React 的拖拽事件属性）
  const dragHandlers = {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  return {
    isDragging,
    dragHandlers,
  };
}
