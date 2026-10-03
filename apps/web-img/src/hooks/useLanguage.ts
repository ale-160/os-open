'use client';

import { createContext, useContext } from 'react';

export type Language = 'zh' | 'en';
// ── 翻译表类型 ──
export interface Translations {
  appName: string;
  tagline: string;
  compress: string;
  convert: string;
  gifMaker: string;
  edit: string;
  watermark: string;
  merge: string;
  replaceColor: string;
  uploadTitle: string;
  uploadHint: string;
  quality: string;
  maxWidth: string;
  maxHeight: string;
  targetFormat: string;
  crop: string;
  rotate: string;
  flip: string;
  flipH: string;
  flipV: string;
  draw: string;
  filter: string;
  brightness: string;
  contrast: string;
  saturate: string;
  blur: string;
  textWatermark: string;
  imageWatermark: string;
  invisibleWatermark: string;
  watermarkText: string;
  opacity: string;
  rotation: string;
  pattern: string;
  patternTile: string;
  patternSingle: string;
  patternDiagonal: string;
  layout: string;
  horizontal: string;
  vertical: string;
  grid: string;
  gridCols: string;
  gap: string;
  targetColor: string;
  replacementColor: string;
  tolerance: string;
  undo: string;
  redo: string;
  download: string;
  downloadAll: string;
  clearAll: string;
  processing: string;
  original: string;
  preview: string;
  apply: string;
  reset: string;
  settings: string;
  theme: string;
  language: string;
  help: string;
  originalSize: string;
  previewSize: string;
  previewName: string;
  originalName: string;
  originalDimensions: string;
  previewDimensions: string;
  width: string;
  height: string;
  preserveRatio: string;
  addImage: string;
  noImage: string;
  drawingColor: string;
  brushSize: string;
  clearCanvas: string;
  selectArea: string;
  extractText: string;
  privacyNote: string;
  enterWatermarkText: string;
  embedData: string;
  extractData: string;
  embedSuccess: string;
  extractSuccess: string;
  noDataFound: string;
  noImagesToMerge: string;
  save: string;
  cancel: string;
  close: string;
  confirm: string;
  delete: string;
  editFileName: string;
  hideOriginal: string;
  showOriginal: string;
  fullscreenPreview: string;
  confirmReplace: string;
  confirmReplaceDesc: string;
  pinPanel: string;
  unpinPanel: string;
  closePanel: string;
  rotateSuccess: string;
  flipSuccess: string;
  languageSwitched: string;
  processSuccess: string;
  processFailed: string;
  imageOnly: string;
  pdfProcessing: string;
  pdfConverted: string;
  watermarkFailed: string;
  mergeFailed: string;
  dropHere: string;
  imageAdjust: string;
  watermarkProcess: string;
  imageMerge: string;
  toolPanel: string;
  preset: string;
  fontSize: string;
  invisibleHelp: string;
  invisibleHelpText: string;
  imagesAdded: string;
  underDevelopment: string;
  gotIt: string;
  tryBeta: string;
  betaWarning: string;
  adjust: string;
  manageFormats: string;
  managePresets: string;
  presetSize: string;
  custom: string;
  applyCustomSize: string;
  resizeMode: string;
  stretchMode: string;
  cropMode: string;
  compressQuality: string;
  imageEffects: string;
  rgbAdjustments: string;
  ale160Link: string;
  githubRepo: string;
  sponsor: string;
  pinGroup: string;
  pinGroupDesc: string;
}

export const zhStrings: Record<keyof Translations, string> = {
  appName: 'web-img',
  tagline: '纯前端图片处理工具',
  compress: '压缩',
  convert: '转换',
  gifMaker: 'GIF 合成',
  edit: '编辑',
  watermark: '水印',
  merge: '合并',
  replaceColor: '颜色',
  uploadTitle: '拖拽图片到此处',
  uploadHint: '或点击选择文件',
  quality: '质量',
  maxWidth: '最大宽度',
  maxHeight: '最大高度',
  targetFormat: '目标格式',
  crop: '裁剪',
  rotate: '旋转',
  flip: '翻转',
  flipH: '水平翻转',
  flipV: '垂直翻转',
  draw: '涂鸦',
  filter: '滤镜',
  brightness: '亮度',
  contrast: '对比度',
  saturate: '饱和度',
  blur: '模糊',
  textWatermark: '文字水印',
  imageWatermark: '图片水印',
  invisibleWatermark: '隐形水印',
  watermarkText: '水印文字',
  opacity: '透明度',
  rotation: '旋转角度',
  pattern: '排列方式',
  patternTile: '平铺',
  patternSingle: '单个',
  patternDiagonal: '对角线',
  layout: '布局',
  horizontal: '横向',
  vertical: '纵向',
  grid: '网格',
  gridCols: '列数',
  gap: '间距',
  targetColor: '目标颜色',
  replacementColor: '替换颜色',
  tolerance: '容差',
  undo: '撤回',
  redo: '重做',
  download: '下载',
  downloadAll: '批量下载',
  clearAll: '清空',
  processing: '处理中...',
  original: '原图',
  preview: '预览',
  apply: '应用',
  reset: '重置',
  settings: '设置',
  theme: '主题',
  language: '语言',
  help: '帮助',
  originalSize: '原图大小',
  previewSize: '预览大小',
  previewName: '预览名称',
  originalName: '原图名称',
  originalDimensions: '原图尺寸',
  previewDimensions: '预览尺寸',
  width: '宽度',
  height: '高度',
  preserveRatio: '保持比例',
  addImage: '添加图片',
  noImage: '请先上传图片',
  drawingColor: '画笔颜色',
  brushSize: '画笔大小',
  clearCanvas: '清空画布',
  selectArea: '选择区域',
  extractText: '提取文字',
  privacyNote: '所有图片在本地处理，不会上传到服务器',
  enterWatermarkText: '请输入水印文字',
  embedData: '嵌入信息',
  extractData: '提取信息',
  embedSuccess: '信息嵌入成功',
  extractSuccess: '信息提取成功',
  noDataFound: '未找到嵌入信息',
  noImagesToMerge: '请先添加要合并的图片',
  save: '保存',
  cancel: '取消',
  close: '关闭',
  confirm: '确认',
  delete: '删除',
  editFileName: '编辑文件名',
  hideOriginal: '隐藏原图',
  showOriginal: '显示原图',
  fullscreenPreview: '全屏预览',
  confirmReplace: '确认替换',
  confirmReplaceDesc: '是否清空工作区内容？当前已有的操作将不会保存。',
  pinPanel: '固定面板',
  unpinPanel: '取消固定',
  closePanel: '关闭面板',
  rotateSuccess: '旋转成功',
  flipSuccess: '镜像成功',
  languageSwitched: '语言已切换',
  processSuccess: '处理完成',
  processFailed: '处理失败',
  imageOnly: '仅支持图片和PDF文件格式',
  pdfProcessing: '正在处理PDF...',
  pdfConverted: 'PDF已转为图片',
  watermarkFailed: '水印处理失败',
  mergeFailed: '合并处理失败',
  dropHere: '释放图片',
  imageAdjust: '图片调整',
  watermarkProcess: '水印处理',
  imageMerge: '图片合并',
  toolPanel: '工具面板',
  preset: '预设',
  fontSize: '字体大小',
  invisibleHelp: '隐形水印说明',
  invisibleHelpText: '隐形水印将信息隐藏在图片像素中，肉眼不可见，可通过提取功能还原',
  imagesAdded: '已添加图片',
  underDevelopment: '功能开发中，敬请期待…',
  gotIt: '知道了',
  tryBeta: '试用 Beta',
  betaWarning: '当前功能为 Beta 版本，可能存在不稳定或异常情况',
  adjust: '调整',
  manageFormats: '管理格式',
  managePresets: '管理预设',
  presetSize: '预设尺寸',
  custom: '自定义',
  applyCustomSize: '应用自定义尺寸',
  resizeMode: '调整方式',
  stretchMode: '拉伸',
  cropMode: '裁剪',
  compressQuality: '压缩质量',
  imageEffects: '图像效果',
  rgbAdjustments: 'RGB 通道微调',
  ale160Link: '阿乐一百六',
  githubRepo: 'GitHub 仓库',
  sponsor: '赞赏支持',
  pinGroup: '固定分组',
  pinGroupDesc: '将该分组内所有预设批量固定，替换「固定」分组中现有内容。原固定预设将被移除。',
};

export const enStrings: Record<keyof Translations, string> = {
  appName: 'web-img',
  tagline: 'Pure Frontend Image Tool',
  compress: 'Compress',
  convert: 'Convert',
  gifMaker: 'GIF Maker',
  edit: 'Edit',
  watermark: 'Watermark',
  merge: 'Merge',
  replaceColor: 'Color',
  uploadTitle: 'Drag images here',
  uploadHint: 'Or click to select files',
  quality: 'Quality',
  maxWidth: 'Max Width',
  maxHeight: 'Max Height',
  targetFormat: 'Target Format',
  crop: 'Crop',
  rotate: 'Rotate',
  flip: 'Flip',
  flipH: 'Flip Horizontal',
  flipV: 'Flip Vertical',
  draw: 'Draw',
  filter: 'Filter',
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturate: 'Saturate',
  blur: 'Blur',
  textWatermark: 'Text Watermark',
  imageWatermark: 'Image Watermark',
  invisibleWatermark: 'Invisible Watermark',
  watermarkText: 'Watermark Text',
  opacity: 'Opacity',
  rotation: 'Rotation',
  pattern: 'Pattern',
  patternTile: 'Tile',
  patternSingle: 'Single',
  patternDiagonal: 'Diagonal',
  layout: 'Layout',
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  grid: 'Grid',
  gridCols: 'Columns',
  gap: 'Gap',
  targetColor: 'Target Color',
  replacementColor: 'Replacement Color',
  tolerance: 'Tolerance',
  undo: 'Undo',
  redo: 'Redo',
  download: 'Download',
  downloadAll: 'Batch Download',
  clearAll: 'Clear',
  processing: 'Processing...',
  original: 'Original',
  preview: 'Preview',
  apply: 'Apply',
  reset: 'Reset',
  settings: 'Settings',
  theme: 'Theme',
  language: 'Language',
  help: 'Help',
  originalSize: 'Original Size',
  previewSize: 'Preview Size',
  previewName: 'Preview Name',
  originalName: 'Original Name',
  originalDimensions: 'Original Dimensions',
  previewDimensions: 'Preview Dimensions',
  width: 'Width',
  height: 'Height',
  preserveRatio: 'Preserve Ratio',
  addImage: 'Add Image',
  noImage: 'Please upload image first',
  drawingColor: 'Brush Color',
  brushSize: 'Brush Size',
  clearCanvas: 'Clear Canvas',
  selectArea: 'Select Area',
  extractText: 'Extract Text',
  privacyNote: 'All images are processed locally, never uploaded to server',
  enterWatermarkText: 'Please enter watermark text',
  embedData: 'Embed Data',
  extractData: 'Extract Data',
  embedSuccess: 'Data embedded successfully',
  extractSuccess: 'Data extracted successfully',
  noDataFound: 'No embedded data found',
  noImagesToMerge: 'Please add images to merge first',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  confirm: 'Confirm',
  delete: 'Delete',
  editFileName: 'Edit File Name',
  hideOriginal: 'Hide Original',
  showOriginal: 'Show Original',
  fullscreenPreview: 'Fullscreen Preview',
  confirmReplace: 'Confirm Replace',
  confirmReplaceDesc: 'Clear the workspace? Current changes will not be saved.',
  pinPanel: 'Pin Panel',
  unpinPanel: 'Unpin Panel',
  closePanel: 'Close Panel',
  rotateSuccess: 'Rotated successfully',
  flipSuccess: 'Flipped successfully',
  languageSwitched: 'Language switched',
  processSuccess: 'Processing complete',
  processFailed: 'Processing failed',
  imageOnly: 'Only image and PDF files are supported',
  pdfProcessing: 'Processing PDF...',
  pdfConverted: 'PDF converted to image',
  watermarkFailed: 'Watermark failed',
  mergeFailed: 'Merge failed',
  dropHere: 'Drop images here',
  imageAdjust: 'Image Adjust',
  watermarkProcess: 'Watermark',
  imageMerge: 'Image Merge',
  toolPanel: 'Tool Panel',
  preset: 'Preset',
  fontSize: 'Font Size',
  invisibleHelp: 'Invisible Watermark',
  invisibleHelpText: 'Invisible watermarks embed data into image pixels. Visually undetectable and can be extracted later.',
  imagesAdded: 'Images Added',
  underDevelopment: 'This feature is under development. Stay tuned…',
  gotIt: 'Got it',
  tryBeta: 'Try Beta',
  betaWarning: 'This feature is in Beta and may be unstable.',
  adjust: 'Adjust',
  manageFormats: 'Manage Formats',
  managePresets: 'Manage Presets',
  presetSize: 'Preset Size',
  custom: 'Custom',
  applyCustomSize: 'Apply Custom Size',
  resizeMode: 'Resize Mode',
  stretchMode: 'Stretch',
  cropMode: 'Crop',
  compressQuality: 'Quality',
  imageEffects: 'Image Effects',
  rgbAdjustments: 'RGB Adjustments',
  ale160Link: 'ale160',
  githubRepo: 'GitHub Repo',
  sponsor: 'Sponsor',
  pinGroup: 'Pin Group',
  pinGroupDesc: 'Pin all presets in this group, replacing the current pinned presets. Existing pinned presets will be removed.',
};

// ── Context ──
export interface LanguageContextValue {
  language: Language;
  t: (key: keyof Translations) => string;
  toggleLanguage: () => void;
  isMounted: boolean;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within <LanguageProvider>');
  }
  return ctx;
}

// LanguageProvider is exported from @/components/providers/LanguageProvider (tsx file)
