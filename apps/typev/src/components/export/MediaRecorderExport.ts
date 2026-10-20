/**
 * 扩展 MediaRecorder 接口，添加自定义属性
 */
interface ExtendedMediaRecorder extends MediaRecorder {
  _chunks?: BlobPart[];
}

/**
 * 开始录制 Canvas 动画
 * @param canvas - 要录制的 Canvas 元素
 * @param frameRate - 帧率（fps）
 * @param mimeType - MIME 类型（如 'video/webm'）
 * @returns MediaRecorder 实例
 */
export function startRecording(
  canvas: HTMLCanvasElement,
  frameRate: number,
  mimeType: string
): MediaRecorder {
  // 创建 Canvas 流
  const stream = canvas.captureStream(frameRate);
  
  // 内部数组用于收集数据块
  const chunks: BlobPart[] = [];
  
  // 创建 MediaRecorder
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 5000000 // 5 Mbps
  }) as ExtendedMediaRecorder;

  // 将 chunks 附加到 recorder 对象上
  recorder._chunks = chunks;

  // 监听数据可用事件
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  // 开始录制
  recorder.start();

  return recorder;
}

/**
 * 停止录制并返回 Blob
 * @param recorder - MediaRecorder 实例
 * @returns Promise<Blob> 录制的数据
 */
export function stopRecording(recorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // 设置停止回调
    recorder.onstop = () => {
      // 从 recorder 获取收集的数据
      const extendedRecorder = recorder as ExtendedMediaRecorder;
      if (extendedRecorder._chunks && extendedRecorder._chunks.length > 0) {
        const blob = new Blob(extendedRecorder._chunks, {
          type: recorder.mimeType
        });
        resolve(blob);
      } else {
        reject(new Error('没有录制数据'));
      }
    };

    // 停止录制
    recorder.stop();
  });
}

/**
 * 触发 Blob 下载
 * @param blob - 要下载的 Blob 对象
 * @param filename - 文件名
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
