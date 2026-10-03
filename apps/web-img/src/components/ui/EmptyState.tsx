'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export type EmptyVariant = 'image' | 'convert' | 'pdf' | 'gif' | 'frames';

interface EmptyStateProps {
  variant?: EmptyVariant;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * 空状态插画：全部为自绘内联 SVG，零图片资源。
 * 颜色取自主题 CSS 变量，自动适配亮色/暗色模式；
 * 装饰元素带轻微漂浮动画（prefers-reduced-motion 时自动关闭）。
 */
export function EmptyState({
  variant = 'image',
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  // useId 可能含非法字符，清洗后用作 SVG 内部 id 前缀，避免多实例冲突
  const uid = 'es' + useId().replace(/[^a-zA-Z0-9]/g, '');

  return (
    <div className={cn('flex flex-col items-center justify-center text-center select-none', className)}>
      <div aria-hidden="true" className={size === 'sm' ? 'w-40 max-w-full' : 'w-56 max-w-full'}>
        {variant === 'image' && <ImageArt uid={uid} />}
        {variant === 'convert' && <ConvertArt uid={uid} />}
        {variant === 'pdf' && <PdfArt />}
        {variant === 'gif' && <GifArt />}
        {variant === 'frames' && <FramesArt uid={uid} />}
      </div>
      <p className={cn('mt-4 font-medium text-muted-foreground', size === 'sm' ? 'text-xs' : 'text-sm')}>
        {title}
      </p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground/70 max-w-60 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── 通用小元素 ── */

/** 四角星闪光 */
function Sparkle({ cx, cy, s, opacity = 0.6 }: { cx: number; cy: number; s: number; opacity?: number }) {
  const k = s * 0.28;
  return (
    <path
      d={`M${cx} ${cy - s} L${cx + k} ${cy - k} L${cx + s} ${cy} L${cx + k} ${cy + k} L${cx} ${cy + s} L${cx - k} ${cy + k} L${cx - s} ${cy} L${cx - k} ${cy - k} Z`}
      fill="var(--primary)"
      opacity={opacity}
    />
  );
}

/* ── 图片：相框与山景 ── */
function ImageArt({ uid }: { uid: string }) {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-auto" role="img" aria-hidden="true">
      {/* 背景卡片 */}
      <rect x="30" y="24" width="100" height="78" rx="10" fill="var(--muted)" opacity="0.7" transform="rotate(-6 80 63)" />
      {/* 前景照片 */}
      <rect x="62" y="42" width="106" height="86" rx="10" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
      <clipPath id={`${uid}-ph`}>
        <rect x="70" y="50" width="90" height="58" rx="6" />
      </clipPath>
      <g clipPath={`url(#${uid}-ph)`}>
        <rect x="70" y="50" width="90" height="58" fill="var(--primary)" opacity="0.07" />
        <circle cx="139" cy="67" r="8" fill="#fbbf24" opacity="0.9" />
        <path d="M70 108 L94 79 L111 98 L124 85 L160 108 Z" fill="var(--primary)" opacity="0.26" />
        <path d="M70 108 L88 88 L103 103 L113 95 L160 108 Z" fill="var(--primary)" opacity="0.48" />
      </g>
      {/* 说明条 */}
      <rect x="74" y="115" width="46" height="5" rx="2.5" fill="var(--muted-foreground)" opacity="0.3" />
      <rect x="74" y="123" width="28" height="5" rx="2.5" fill="var(--muted-foreground)" opacity="0.18" />
      {/* 漂浮装饰 */}
      <g className="animate-float">
        <Sparkle cx={34} cy={64} s={9} opacity={0.75} />
        <circle cx="174" cy="36" r="3" fill="var(--primary)" opacity="0.4" />
        <Sparkle cx={170} cy={120} s={7} opacity={0.5} />
      </g>
    </svg>
  );
}

/* ── 格式转换：双文档循环箭头 ── */
function ConvertArt({ uid }: { uid: string }) {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-auto" role="img" aria-hidden="true">
      {/* 左侧文档（文字页） */}
      <g transform="rotate(-8 66 78)">
        <rect x="30" y="46" width="56" height="72" rx="8" fill="var(--muted)" />
        <rect x="38" y="38" width="56" height="72" rx="8" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
        <rect x="47" y="52" width="34" height="4.5" rx="2.25" fill="var(--muted-foreground)" opacity="0.3" />
        <rect x="47" y="62" width="26" height="4.5" rx="2.25" fill="var(--muted-foreground)" opacity="0.2" />
        <rect x="47" y="72" width="30" height="4.5" rx="2.25" fill="var(--muted-foreground)" opacity="0.25" />
        <rect x="47" y="88" width="26" height="12" rx="6" fill="var(--primary)" opacity="0.14" />
      </g>
      {/* 右侧文档（图片页） */}
      <g transform="rotate(7 136 78)">
        <rect x="112" y="44" width="56" height="72" rx="8" fill="var(--muted)" />
        <rect x="106" y="38" width="56" height="72" rx="8" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
        <clipPath id={`${uid}-cv`}>
          <rect x="114" y="46" width="40" height="32" rx="4" />
        </clipPath>
        <g clipPath={`url(#${uid}-cv)`}>
          <rect x="114" y="46" width="40" height="32" fill="var(--primary)" opacity="0.09" />
          <circle cx="146" cy="55" r="4" fill="#fbbf24" opacity="0.9" />
          <path d="M114 78 L128 62 L137 71 L143 66 L154 78 Z" fill="var(--primary)" opacity="0.42" />
        </g>
        <rect x="115" y="86" width="30" height="4.5" rx="2.25" fill="var(--muted-foreground)" opacity="0.22" />
        <rect x="115" y="95" width="20" height="4.5" rx="2.25" fill="var(--muted-foreground)" opacity="0.14" />
      </g>
      {/* 中央循环徽章 */}
      <circle cx="100" cy="79" r="17" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
      <path d="M92.2 74.5 A9 9 0 0 1 107.8 74.5" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
      <polyline points="104,70.5 108.5,75 113,70.5" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M107.8 84.5 A9 9 0 0 1 92.2 84.5" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
      <polyline points="96,88.5 91.5,84 87,88.5" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 漂浮装饰 */}
      <g className="animate-float">
        <Sparkle cx={178} cy={52} s={7} opacity={0.5} />
        <circle cx="24" cy="46" r="3" fill="var(--primary)" opacity="0.4" />
        <Sparkle cx={28} cy={122} s={8} opacity={0.55} />
      </g>
    </svg>
  );
}

/* ── PDF：折角文档与下载徽章 ── */
function PdfArt() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-auto" role="img" aria-hidden="true">
      {/* 后方散页 */}
      <rect x="58" y="34" width="72" height="96" rx="8" fill="var(--muted)" opacity="0.55" transform="rotate(-9 94 82)" />
      <rect x="76" y="30" width="72" height="96" rx="8" fill="var(--muted)" opacity="0.8" transform="rotate(8 112 78)" />
      {/* 主文档（右上折角） */}
      <path
        d="M78 26 H120 L142 48 V118 a8 8 0 0 1 -8 8 H78 a8 8 0 0 1 -8 -8 V34 a8 8 0 0 1 8 -8 Z"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <path d="M120 26 L142 48 H126 a6 6 0 0 1 -6 -6 Z" fill="var(--muted)" stroke="var(--border)" strokeWidth="1.5" strokeLinejoin="round" />
      {/* 文本行 */}
      <rect x="82" y="56" width="44" height="5" rx="2.5" fill="var(--muted-foreground)" opacity="0.28" />
      <rect x="82" y="67" width="34" height="5" rx="2.5" fill="var(--muted-foreground)" opacity="0.2" />
      <rect x="82" y="78" width="44" height="5" rx="2.5" fill="var(--muted-foreground)" opacity="0.25" />
      <rect x="82" y="89" width="26" height="5" rx="2.5" fill="var(--muted-foreground)" opacity="0.16" />
      {/* 高亮块 */}
      <rect x="82" y="102" width="40" height="12" rx="4" fill="var(--primary)" opacity="0.13" />
      {/* 下载徽章（漂浮） */}
      <g className="animate-float-delayed">
        <circle cx="140" cy="116" r="14" fill="var(--primary)" />
        <line x1="140" y1="109" x2="140" y2="121" stroke="var(--primary-foreground)" strokeWidth="2.5" strokeLinecap="round" />
        <polyline points="135,117 140,122 145,117" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* 漂浮装饰 */}
      <g className="animate-float">
        <Sparkle cx={172} cy={44} s={8} opacity={0.55} />
        <circle cx="30" cy="52" r="3" fill="var(--primary)" opacity="0.4" />
        <Sparkle cx={36} cy={126} s={7} opacity={0.5} />
      </g>
    </svg>
  );
}

/* ── GIF：胶片条 ── */
function GifArt() {
  const holes = [36, 51, 66, 81, 96, 111, 126, 141, 156];
  return (
    <svg viewBox="0 0 200 160" className="w-full h-auto" role="img" aria-hidden="true">
      <g transform="rotate(-4 100 80)">
        <rect x="28" y="52" width="144" height="56" rx="8" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
        {/* 齿孔 */}
        {holes.map((x) => (
          <rect key={`t${x}`} x={x} y="57.5" width="5" height="5" rx="1.5" fill="var(--muted)" />
        ))}
        {holes.map((x) => (
          <rect key={`b${x}`} x={x} y="97.5" width="5" height="5" rx="1.5" fill="var(--muted)" />
        ))}
        {/* 帧 1：山景 */}
        <rect x="38" y="66" width="40" height="28" rx="3" fill="var(--primary)" opacity="0.08" />
        <path d="M41 92 L51 79 L58 86 L63 82 L74 92 Z" fill="var(--primary)" opacity="0.4" />
        {/* 帧 2：播放 */}
        <rect x="86" y="66" width="40" height="28" rx="3" fill="var(--primary)" opacity="0.1" />
        <polygon points="102,72 102,88 115,80" fill="var(--primary)" opacity="0.75" />
        {/* 帧 3：太阳与横条 */}
        <rect x="134" y="66" width="40" height="28" rx="3" fill="var(--primary)" opacity="0.08" />
        <circle cx="165" cy="74" r="3.5" fill="#fbbf24" opacity="0.9" />
        <rect x="140" y="84" width="24" height="4" rx="2" fill="var(--primary)" opacity="0.3" />
      </g>
      {/* 漂浮装饰 */}
      <g className="animate-float">
        <Sparkle cx={180} cy={40} s={8} opacity={0.55} />
        <circle cx="22" cy="46" r="3" fill="var(--primary)" opacity="0.4" />
        <Sparkle cx={26} cy={124} s={7} opacity={0.5} />
      </g>
    </svg>
  );
}

/* ── 帧序列：三张拍立得 ── */
function FramesArt({ uid }: { uid: string }) {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-auto" role="img" aria-hidden="true">
      {/* 左拍立得 */}
      <g transform="rotate(-10 70 84)">
        <rect x="44" y="52" width="52" height="62" rx="6" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
        <rect x="49" y="57" width="42" height="40" rx="3" fill="var(--primary)" opacity="0.12" />
        <rect x="53" y="103" width="24" height="4" rx="2" fill="var(--muted-foreground)" opacity="0.25" />
        <rect x="58" y="46" width="18" height="8" rx="2" fill="var(--primary)" opacity="0.18" transform="rotate(-4 67 50)" />
      </g>
      {/* 右拍立得 */}
      <g transform="rotate(9 132 82)">
        <rect x="106" y="50" width="52" height="62" rx="6" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
        <rect x="111" y="55" width="42" height="40" rx="3" fill="#fbbf24" opacity="0.22" />
        <rect x="115" y="101" width="24" height="4" rx="2" fill="var(--muted-foreground)" opacity="0.25" />
        <rect x="120" y="44" width="18" height="8" rx="2" fill="var(--primary)" opacity="0.18" transform="rotate(4 129 48)" />
      </g>
      {/* 中间主拍立得 */}
      <rect x="74" y="44" width="56" height="66" rx="6" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
      <clipPath id={`${uid}-fr`}>
        <rect x="79" y="49" width="46" height="44" rx="3" />
      </clipPath>
      <g clipPath={`url(#${uid}-fr)`}>
        <rect x="79" y="49" width="46" height="44" fill="var(--primary)" opacity="0.07" />
        <circle cx="113" cy="61" r="5" fill="#fbbf24" opacity="0.9" />
        <path d="M79 93 L94 74 L104 85 L111 79 L125 93 Z" fill="var(--primary)" opacity="0.42" />
      </g>
      <rect x="84" y="99" width="28" height="4.5" rx="2.25" fill="var(--muted-foreground)" opacity="0.28" />
      {/* 漂浮装饰 */}
      <g className="animate-float">
        <Sparkle cx={182} cy={56} s={7} opacity={0.5} />
        <circle cx="20" cy="60" r="3" fill="var(--primary)" opacity="0.4" />
        <Sparkle cx={30} cy={130} s={8} opacity={0.55} />
      </g>
    </svg>
  );
}
