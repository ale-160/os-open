/**
 * 文本片段接口
 */
export interface TextSegment {
  text: string;
  style?: Record<string, string>;
}

/**
 * 脚本行接口
 */
export interface ScriptLine {
  id: string;
  segments: TextSegment[];
  effect: 'centerTypewriter' | 'jumpScale' | 'fadeIn' | 'bounceIn' | 'rotateIn' | 'scaleIn' | 'colorWave';
  duration: number;
  highlight?: number[];
  animation?: string;
}

/**
 * 脚本接口
 */
export interface Script {
  lines: ScriptLine[];
  background: string;
  resolution: {
    width: number;
    height: number;
  };
  frameRate: number;
  globalStyle?: Record<string, string>;
}

/**
 * 导出设置接口
 */
export interface ExportSettings {
  format: 'webm' | 'gif';
  quality: number;
  frameRate: number;
  resolution: {
    width: number;
    height: number;
  };
}
