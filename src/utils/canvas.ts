/**
 * 浏览器 Canvas 原生可靠输出格式（跨主流浏览器均支持）
 * - jpeg：有损压缩，适合照片
 * - png：无损，支持透明
 * - webp：有损/无损双模式，体积优于 jpeg
 */
export type ImageFormat = 'jpeg' | 'png' | 'webp';
export type ResizeMode = 'stretch' | 'crop';

export function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    img.src = url;
  });
}

export function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, format: ImageFormat = 'png', quality = 0.95): string {
  return canvas.toDataURL(`image/${format}`, quality);
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat = 'png', quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error(`Failed to encode image as ${format}`));
      }
    }, `image/${format}`, quality);
  });
}

function prepareAndSaveImage(
  img: HTMLImageElement,
  outputWidth: number,
  outputHeight: number,
  format: ImageFormat,
  quality: number,
  sourceX = 0,
  sourceY = 0,
  sourceWidth?: number,
  sourceHeight?: number
): Promise<Blob> {
  const { canvas, ctx } = createCanvas(outputWidth, outputHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  if (sourceWidth !== undefined && sourceHeight !== undefined) {
    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
  } else {
    ctx.drawImage(img, 0, 0, outputWidth, outputHeight);
  }

  // ObjectURL 已由 loadImage 在加载完成后释放
  return canvasToBlob(canvas, format, quality / 100);
}

export async function compressImage(
  file: File,
  quality: number,
  maxWidth?: number,
  maxHeight?: number,
  format: ImageFormat = 'jpeg',
  resizeMode: ResizeMode = 'stretch',
  cropX?: number,
  cropY?: number
): Promise<Blob> {
  const img = await loadImage(file);
  let { width, height } = img;

  // 如果设置了目标尺寸
  if (maxWidth || maxHeight) {
    if (resizeMode === 'stretch') {
      // 拉伸模式：使用目标尺寸
      if (maxWidth && maxHeight) {
        width = maxWidth;
        height = maxHeight;
      } else if (maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = Math.round(height * ratio);
      } else if (maxHeight) {
        const ratio = maxHeight / height;
        height = maxHeight;
        width = Math.round(width * ratio);
      }
      return prepareAndSaveImage(img, width, height, format, quality);
    } else {
      // 裁剪模式
      const finalWidth = maxWidth || width;
      const finalHeight = maxHeight || height;

      // 使用用户提供的裁剪位置，或者默认居中
      let offsetX = cropX !== undefined ? cropX : (width - finalWidth) / 2;
      let offsetY = cropY !== undefined ? cropY : (height - finalHeight) / 2;

      // 确保裁剪位置在有效范围内
      offsetX = Math.max(0, Math.min(offsetX, width - finalWidth));
      offsetY = Math.max(0, Math.min(offsetY, height - finalHeight));

      return prepareAndSaveImage(img, finalWidth, finalHeight, format, quality, offsetX, offsetY, finalWidth, finalHeight);
    }
  }

  return prepareAndSaveImage(img, width, height, format, quality);
}
export function addTextWatermark(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: {
    color?: string;
    fontSize?: number;
    opacity?: number;
    rotation?: number;
    pattern?: 'tile' | 'single' | 'diagonal';
    gapX?: number;
    gapY?: number;
    x?: number;
    y?: number;
  }
): void {
  const {
    color = '#ffffff',
    fontSize = 20,
    opacity = 0.5,
    rotation = 0,
    pattern = 'single',
    gapX = 50,
    gapY = 50,
    x,
    y,
  } = options;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.rotate((rotation * Math.PI) / 180);

  const textWidth = ctx.measureText(text).width;
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  if (pattern === 'tile') {
    const cols = Math.ceil(canvasWidth / (textWidth + gapX)) + 1;
    const rows = Math.ceil(canvasHeight / (fontSize + gapY)) + 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tx = col * (textWidth + gapX) - textWidth / 2;
        const ty = row * (fontSize + gapY);
        ctx.fillText(text, tx, ty);
      }
    }
  } else if (pattern === 'diagonal') {
    const diagonalLength = Math.sqrt(canvasWidth ** 2 + canvasHeight ** 2);
    const steps = Math.ceil(diagonalLength / Math.max(textWidth, fontSize));

    for (let i = -steps; i <= steps; i++) {
      const tx = i * (textWidth + gapX) + canvasWidth / 2;
      const ty = (-i * (textWidth + gapY)) + canvasHeight / 2;
      ctx.fillText(text, tx, ty);
    }
  } else {
    const tx = x ?? canvasWidth / 2;
    const ty = y ?? canvasHeight / 2;
    ctx.fillText(text, tx, ty);
  }

  ctx.restore();
}

export function addImageWatermark(
  ctx: CanvasRenderingContext2D,
  watermarkImg: HTMLImageElement,
  options: {
    opacity?: number;
    scale?: number;
    x?: number;
    y?: number;
    pattern?: 'tile' | 'single' | 'diagonal';
    gapX?: number;
    gapY?: number;
  }
): void {
  const {
    opacity = 0.5,
    scale = 0.1,
    x,
    y,
    pattern = 'single',
    gapX = 100,
    gapY = 100,
  } = options;

  ctx.save();
  ctx.globalAlpha = opacity;

  const wmWidth = watermarkImg.width * scale;
  const wmHeight = watermarkImg.height * scale;
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  if (pattern === 'tile') {
    const cols = Math.ceil(canvasWidth / (wmWidth + gapX)) + 1;
    const rows = Math.ceil(canvasHeight / (wmHeight + gapY)) + 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.drawImage(watermarkImg, col * (wmWidth + gapX), row * (wmHeight + gapY), wmWidth, wmHeight);
      }
    }
  } else if (pattern === 'diagonal') {
    const diagonalLength = Math.sqrt(canvasWidth ** 2 + canvasHeight ** 2);
    const steps = Math.ceil(diagonalLength / Math.max(wmWidth, wmHeight));

    for (let i = -steps; i <= steps; i++) {
      const tx = i * (wmWidth + gapX) + canvasWidth / 2;
      const ty = (-i * (wmWidth + gapY)) + canvasHeight / 2;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(Math.atan2(canvasHeight, canvasWidth));
      ctx.drawImage(watermarkImg, -wmWidth / 2, -wmHeight / 2, wmWidth, wmHeight);
      ctx.restore();
    }
  } else {
    const tx = x ?? canvasWidth / 2 - wmWidth / 2;
    const ty = y ?? canvasHeight / 2 - wmHeight / 2;
    ctx.drawImage(watermarkImg, tx, ty, wmWidth, wmHeight);
  }

  ctx.restore();
}

export function embedInvisibleWatermark(
  ctx: CanvasRenderingContext2D,
  text: string
): void {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = imageData.data;

  const binaryText = textToBinary(text) + '00000000';
  let bitIndex = 0;

  for (let i = 0; i < data.length && bitIndex < binaryText.length; i += 4) {
    for (let channel = 0; channel < 3 && bitIndex < binaryText.length; channel++) {
      data[i + channel] = (data[i + channel] & 0xfe) | parseInt(binaryText[bitIndex], 2);
      bitIndex++;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
function textToBinary(text: string): string {
  return text.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join('');
}
function calculateGridLayout(
  images: HTMLImageElement[],
  gridCols: number,
  gap: number
): { colWidths: number[]; rowHeights: number[]; totalWidth: number; totalHeight: number } {
  const rows = Math.ceil(images.length / gridCols);
  const colWidths: number[] = Array(gridCols).fill(0);
  const rowHeights: number[] = Array(rows).fill(0);

  images.forEach((img, index) => {
    const col = index % gridCols;
    const row = Math.floor(index / gridCols);
    colWidths[col] = Math.max(colWidths[col], img.width);
    rowHeights[row] = Math.max(rowHeights[row], img.height);
  });

  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + (gridCols - 1) * gap;
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + (rows - 1) * gap;
  
  return { colWidths, rowHeights, totalWidth, totalHeight };
}

export function mergeImages(
  images: HTMLImageElement[],
  layout: 'horizontal' | 'vertical' | 'grid',
  options: {
    gridCols?: number;
    gap?: number;
  } = {}
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const { gridCols = 2, gap = 0 } = options;

  let totalWidth: number;
  let totalHeight: number;
  let colWidths: number[] | undefined;
  let rowHeights: number[] | undefined;

  if (layout === 'horizontal') {
    totalWidth = images.reduce((sum, img) => sum + img.width, 0) + (images.length - 1) * gap;
    totalHeight = Math.max(...images.map(img => img.height));
  } else if (layout === 'vertical') {
    totalHeight = images.reduce((sum, img) => sum + img.height, 0) + (images.length - 1) * gap;
    totalWidth = Math.max(...images.map(img => img.width));
  } else {
    const gridLayout = calculateGridLayout(images, gridCols, gap);
    colWidths = gridLayout.colWidths;
    rowHeights = gridLayout.rowHeights;
    totalWidth = gridLayout.totalWidth;
    totalHeight = gridLayout.totalHeight;
  }

  const { canvas, ctx } = createCanvas(totalWidth, totalHeight);

  if (layout === 'horizontal') {
    let currentX = 0;
    images.forEach(img => {
      ctx.drawImage(img, currentX, 0);
      currentX += img.width + gap;
    });
  } else if (layout === 'vertical') {
    let currentY = 0;
    images.forEach(img => {
      ctx.drawImage(img, 0, currentY);
      currentY += img.height + gap;
    });
  } else if (colWidths && rowHeights) {
    images.forEach((img, index) => {
      const col = index % gridCols;
      const row = Math.floor(index / gridCols);
      let currentX = 0;
      for (let c = 0; c < col; c++) {
        currentX += colWidths[c] + gap;
      }
      let currentY = 0;
      for (let r = 0; r < row; r++) {
        currentY += rowHeights[r] + gap;
      }
      ctx.drawImage(img, currentX, currentY);
    });
  }

  return { canvas, width: totalWidth, height: totalHeight };
}

export function replaceColor(
  ctx: CanvasRenderingContext2D,
  targetColor: { r: number; g: number; b: number },
  replacementColor: { r: number; g: number; b: number },
  tolerance: number
): void {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = Math.sqrt(
      Math.pow(r - targetColor.r, 2) +
      Math.pow(g - targetColor.g, 2) +
      Math.pow(b - targetColor.b, 2)
    );

    if (distance < tolerance) {
      data[i] = replacementColor.r;
      data[i + 1] = replacementColor.g;
      data[i + 2] = replacementColor.b;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
