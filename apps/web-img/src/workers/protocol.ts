/**
 * 主线程 ⇄ 转换 Worker 的消息协议（两侧共用）。
 */
export type ConvertFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp' | 'ico';

export interface ConvertRequest {
  id: string;
  file: File;
  format: ConvertFormat;
  /** 有损格式的质量（1-100）；无格式忽略 */
  quality?: number;
  maxWidth?: number | null;
  maxHeight?: number | null;
}

export interface ConvertSuccess {
  id: string;
  ok: true;
  blob: Blob;
  width: number;
  height: number;
  filename: string;
}

export interface ConvertFailure {
  id: string;
  ok: false;
  error: string;
}

export type ConvertResponse = ConvertSuccess | ConvertFailure;

/** 目标文件名：原基名 + 格式扩展名 */
export function buildFilename(originalName: string, format: ConvertFormat): string {
  const extMap: Record<ConvertFormat, string> = {
    jpeg: '.jpg',
    png: '.png',
    webp: '.webp',
    gif: '.gif',
    bmp: '.bmp',
    ico: '.ico',
  };
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return `${baseName}${extMap[format]}`;
}
