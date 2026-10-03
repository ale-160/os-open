import JSZip from 'jszip';

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function downloadFile(data: string | Blob, filename: string): void {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof data !== 'string') {
    URL.revokeObjectURL(url);
  }
}

export async function downloadBatch(
  images: { data: string | Blob; filename: string }[]
): Promise<void> {
  const zip = new JSZip();
  
  images.forEach(img => {
    if (typeof img.data === 'string') {
      const base64Data = img.data.split(',')[1];
      if (base64Data) {
        zip.file(img.filename, base64Data, { base64: true });
      }
    } else {
      zip.file(img.filename, img.data);
    }
  });

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `web-img-batch-${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function generateFilename(originalName: string, newExtension: string): string {
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return `${baseName}.${newExtension}`;
}
