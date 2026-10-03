'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface ImageState {
  file: File;
  url: string;
  width: number;
  height: number;
  name: string;
  size: number;
}

export interface UseImageEditorReturn {
  originalImages: ImageState[];
  previewImage: ImageState | null;
  currentIndex: number;
  addImages: (files: FileList | File[]) => void;
  removeImage: (index: number) => void;
  clearImages: () => void;
  setPreviewFromOriginal: (index: number) => void;
  updatePreview: (imageData: string, width: number, height: number) => void;
  updatePreviewName: (newName: string) => void;
  resetPreview: () => void;
  getOriginalFormat: () => string | null;
}

/**
 * 加载图片并测量尺寸。
 * 内部创建的 ObjectURL 在加载结束（成功或失败）后立即释放，避免泄漏。
 */
function measureImage(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to decode image: ${file.name}`));
    };
    img.src = url;
  });
}

export function useImageEditor(): UseImageEditorReturn {
  const [originalImages, setOriginalImages] = useState<ImageState[]>([]);
  const [previewImage, setPreviewImage] = useState<ImageState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 追踪所有需要释放的 blob: URL；dataURL 无需 revoke，交给 GC
  const trackedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 复制引用，避免 cleanup 时 ref 已变化的告警
    const tracked = trackedUrlsRef.current;
    return () => {
      tracked.forEach(url => URL.revokeObjectURL(url));
      tracked.clear();
    };
  }, []);

  const trackUrl = useCallback((url: string) => {
    trackedUrlsRef.current.add(url);
  }, []);

  const untrackUrl = useCallback((url: string) => {
    if (trackedUrlsRef.current.delete(url) && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const addImages = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const added: ImageState[] = [];

    for (const file of fileArray) {
      try {
        const { width, height } = await measureImage(file);
        added.push({
          file,
          url: URL.createObjectURL(file),
          width,
          height,
          name: file.name,
          size: file.size,
        });
      } catch {
        // 跳过无法解码的文件
      }
    }

    if (added.length === 0) return;

    added.forEach(item => trackUrl(item.url));
    setOriginalImages(prev => [...prev, ...added]);
    // 仅在没有预览时设置默认预览（复用原图条目，不额外创建 URL）
    setPreviewImage(prev => prev ?? added[0]);
  }, [trackUrl]);

  const removeImage = useCallback((index: number) => {
    const removed = originalImages[index];
    if (!removed) return;

    untrackUrl(removed.url);
    const next = originalImages.filter((_, i) => i !== index);
    setOriginalImages(next);

    // 若被删除的是当前预览，则回退到相邻原图
    if (previewImage && previewImage.url === removed.url) {
      const fallbackIndex = Math.max(0, Math.min(index, next.length - 1));
      setCurrentIndex(fallbackIndex);
      setPreviewImage(next[fallbackIndex] ?? null);
    }
  }, [originalImages, previewImage, untrackUrl]);

  const clearImages = useCallback(() => {
    trackedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    trackedUrlsRef.current.clear();
    setOriginalImages([]);
    setPreviewImage(null);
    setCurrentIndex(0);
  }, []);

  const setPreviewFromOriginal = useCallback((index: number) => {
    setOriginalImages(prev => {
      if (index >= 0 && index < prev.length) {
        setCurrentIndex(index);
        setPreviewImage(prev[index]);
      }
      return prev;
    });
  }, []);

  const updatePreview = useCallback((imageData: string, width: number, height: number) => {
    if (!previewImage) return;
    // 旧预览若独占一个 blob: URL（非共享原图 URL），先释放
    const sharedWithOriginal = originalImages.some(o => o.url === previewImage.url);
    if (previewImage.url.startsWith('blob:') && !sharedWithOriginal) {
      untrackUrl(previewImage.url);
    }
    setPreviewImage({ ...previewImage, url: imageData, width, height });
  }, [previewImage, originalImages, untrackUrl]);

  const updatePreviewName = useCallback((newName: string) => {
    setPreviewImage(prev => (prev ? { ...prev, name: newName } : prev));
  }, []);

  const resetPreview = useCallback(() => {
    const original = originalImages[currentIndex];
    if (original) {
      setPreviewImage({ ...original });
    }
  }, [originalImages, currentIndex]);

  const getOriginalFormat = useCallback((): string | null => {
    if (originalImages.length === 0) return null;
    const fileName = originalImages[currentIndex].name.toLowerCase();
    if (fileName.includes('.jpg') || fileName.includes('.jpeg')) return 'jpeg';
    if (fileName.includes('.png')) return 'png';
    if (fileName.includes('.webp')) return 'webp';
    if (fileName.includes('.gif')) return 'gif';
    if (fileName.includes('.bmp')) return 'bmp';
    if (fileName.includes('.tiff') || fileName.includes('.tif')) return 'tiff';
    return 'jpeg'; // 默认jpeg
  }, [originalImages, currentIndex]);

  return {
    originalImages,
    previewImage,
    currentIndex,
    addImages,
    removeImage,
    clearImages,
    setPreviewFromOriginal,
    updatePreview,
    updatePreviewName,
    resetPreview,
    getOriginalFormat,
  };
}
