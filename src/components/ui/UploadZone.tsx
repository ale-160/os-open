'use client';

import React, { useCallback, useState } from 'react';
import { Upload, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';

interface UploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  multiple?: boolean;
  accept?: string;
  compact?: boolean;
}

// 支持的图片扩展名
const supportedImageExtensions = [
  '.jpg', '.jpeg', '.png', '.bmp', '.webp', '.svg',
  '.tiff', '.tif', '.ico', '.raw', '.dng', '.cr2', '.nef',
  '.arw', '.orf', '.sr2', '.heic', '.heif'
];

// 检查是否为图片文件（基于扩展名，因为有些raw格式MIME类型不标准）
const isImageFile = (file: File): boolean => {
  if (file.type.startsWith('image/') && !file.type.includes('gif')) return true;
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  return supportedImageExtensions.includes(ext);
};

// 检查是否为PDF文件
const isPdfFile = (file: File): boolean => {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
};

export function UploadZone({ onFilesSelected, multiple = true, accept = 'image/*,application/pdf', compact = false }: UploadZoneProps) {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
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

    if (filesToProcess.length === 0 && e.dataTransfer.files.length > 0) {
      filesToProcess = Array.from(e.dataTransfer.files);
    }

    if (filesToProcess.length > 0) {
      const validImageFiles = filesToProcess.filter(file => isImageFile(file) || isPdfFile(file));

      if (validImageFiles.length > 0) {
        onFilesSelected(validImageFiles);
      } else if (filesToProcess.length > 0) {
        toast.error(t('imageOnly'));
      }
    }
  }, [onFilesSelected, t]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const validFiles = Array.from(files).filter(file => isImageFile(file) || isPdfFile(file));
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      } else {
        toast.error(t('imageOnly'));
      }
    }
    e.target.value = '';
  }, [onFilesSelected, t]);

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center w-full
        border-2 border-dashed rounded-lg cursor-pointer
        transition-colors duration-200
        ${compact ? 'h-24' : 'h-48'}
        ${isDragging 
          ? 'border-primary bg-primary/10' 
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        {isDragging ? (
          <ImagePlus className={compact ? 'w-8 h-8' : 'w-12 h-12'} />
        ) : (
          <Upload className={compact ? 'w-8 h-8' : 'w-12 h-12'} />
        )}
        <p className={compact ? 'text-xs font-medium' : 'text-sm font-medium'}>
          {isDragging ? t('dropHere') : t('uploadTitle')}
        </p>
        {!compact && (
          <p className="text-xs">{t('uploadHint')}</p>
        )}
      </div>
    </div>
  );
}
