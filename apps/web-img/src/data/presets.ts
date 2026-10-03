export interface PresetGroup {
  id: string;
  name: string;
  nameEn: string;
  /** 是否为固定分组（不可删除） */
  isSystem?: boolean;
}

/** 内置分组定义（不可删除、不可改名） */
export const PRESET_GROUPS: PresetGroup[] = [
  { id: 'pinned',    name: '固定',     nameEn: 'Pinned',     isSystem: true },
  { id: 'custom',   name: '自定义',   nameEn: 'Custom',     isSystem: true },
  { id: 'wechat',   name: '微信',     nameEn: 'WeChat' },
  { id: 'weibo',    name: '微博',     nameEn: 'Weibo' },
  { id: 'rednote',  name: '小红书',   nameEn: 'RedNote' },
  { id: 'douyin',   name: '抖音',     nameEn: 'Douyin' },
  { id: 'bilibili', name: '哔哩哔哩', nameEn: 'Bilibili' },
  { id: 'zhihu',    name: '知乎',     nameEn: 'Zhihu' },
  { id: 'taobao',   name: '淘宝/天猫', nameEn: 'Taobao/Tmall' },
  { id: 'youtube',  name: 'YouTube',  nameEn: 'YouTube' },
  { id: 'twitter',  name: 'X (Twitter)', nameEn: 'X (Twitter)' },
  { id: 'instagram',name: 'Instagram',nameEn: 'Instagram' },
  { id: 'facebook', name: 'Facebook', nameEn: 'Facebook' },
  { id: 'linkedin', name: 'LinkedIn', nameEn: 'LinkedIn' },
  { id: 'general',  name: '通用尺寸', nameEn: 'General' },
  { id: 'ecommerce',name: '电商/广告', nameEn: 'E-commerce/Ad' },
];

export interface SizePreset {
  id: string;
  name: string;
  nameEn: string;
  width?: number;
  height?: number;
  label: string;
  labelEn: string;
  /** 是否已固定（显示在侧边栏快捷入口） */
  fixed: boolean;
  /** 所属分组 id，对应 PRESET_GROUPS */
  group: string;
}

export interface WatermarkPreset {
  id: string;
  text: string;
  pattern: 'tile' | 'single' | 'diagonal';
  opacity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 预设尺寸 — 真实平台规范（2024 年）
// ─────────────────────────────────────────────────────────────────────────────
export const sizePresets: SizePreset[] = [
  // ── 固定（默认固定，显示在侧边栏）────────────────────────────────────────
  {
    id: 'avatar',
    name: '头像',
    nameEn: 'Avatar',
    width: 200,
    height: 200,
    label: '头像 200×200',
    labelEn: 'Avatar 200×200',
    fixed: true,
    group: 'general',
  },
  {
    id: 'portrait',
    name: '横屏 16:9',
    nameEn: 'Landscape 16:9',
    width: 1920,
    height: 1080,
    label: '横屏 1920×1080',
    labelEn: 'Desktop 1920×1080',
    fixed: true,
    group: 'general',
  },
  {
    id: 'square',
    name: '方形 1:1',
    nameEn: 'Square 1:1',
    width: 1080,
    height: 1080,
    label: '方形 1080×1080',
    labelEn: 'Square 1080×1080',
    fixed: true,
    group: 'general',
  },

  // ── 微信 ─────────────────────────────────────────────────────────────────
  {
    id: 'wechat_friend_cover',
    name: '朋友圈封面',
    nameEn: 'WeChat Moments Cover',
    width: 1080,
    height: 1920,
    label: '朋友圈封面 1080×1920',
    labelEn: 'WeChat Moments Cover 1080×1920',
    fixed: false,
    group: 'wechat',
  },
  {
    id: 'wechat_article_cover',
    name: '公众号封面大图',
    nameEn: 'WeChat Article Cover',
    width: 900,
    height: 500,
    label: '公众号封面 900×500',
    labelEn: 'WeChat Article Cover 900×500',
    fixed: false,
    group: 'wechat',
  },
  {
    id: 'wechat_article_cover_small',
    name: '公众号封面小图',
    nameEn: 'WeChat Article Cover Small',
    width: 200,
    height: 200,
    label: '公众号封面小图 200×200',
    labelEn: 'WeChat Article Cover Small 200×200',
    fixed: false,
    group: 'wechat',
  },
  {
    id: 'wechat_miniapp_cover',
    name: '小程序封面',
    nameEn: 'WeChat MiniApp Cover',
    width: 1280,
    height: 720,
    label: '小程序封面 1280×720',
    labelEn: 'WeChat MiniApp Cover 1280×720',
    fixed: false,
    group: 'wechat',
  },
  {
    id: 'wechat_video_cover',
    name: '视频号封面',
    nameEn: 'WeChat Video Cover',
    width: 1080,
    height: 1440,
    label: '视频号封面 1080×1440',
    labelEn: 'WeChat Video Cover 1080×1440',
    fixed: false,
    group: 'wechat',
  },

  // ── 微博 ─────────────────────────────────────────────────────────────────
  {
    id: 'weibo_cover',
    name: '个人封面',
    nameEn: 'Weibo Cover',
    width: 920,
    height: 300,
    label: '微博个人封面 920×300',
    labelEn: 'Weibo Cover 920×300',
    fixed: false,
    group: 'weibo',
  },
  {
    id: 'weibo_post',
    name: '配图',
    nameEn: 'Weibo Post',
    width: 1024,
    height: 1024,
    label: '微博配图 1024×1024',
    labelEn: 'Weibo Post 1024×1024',
    fixed: false,
    group: 'weibo',
  },

  // ── 小红书 ────────────────────────────────────────────────────────────────
  {
    id: 'rednote_cover',
    name: '封面',
    nameEn: 'RedNote Cover',
    width: 1242,
    height: 1660,
    label: '小红书封面 1242×1660',
    labelEn: 'RedNote Cover 1242×1660',
    fixed: false,
    group: 'rednote',
  },
  {
    id: 'rednote_detail',
    name: '正文图',
    nameEn: 'RedNote Detail',
    width: 1242,
    height: 1242,
    label: '小红书正文图 1242×1242',
    labelEn: 'RedNote Detail 1242×1242',
    fixed: false,
    group: 'rednote',
  },
  {
    id: 'rednote_avatar',
    name: '头像',
    nameEn: 'RedNote Avatar',
    width: 400,
    height: 400,
    label: '小红书头像 400×400',
    labelEn: 'RedNote Avatar 400×400',
    fixed: false,
    group: 'rednote',
  },

  // ── 抖音 / TikTok ─────────────────────────────────────────────────────────
  {
    id: 'douyin_cover',
    name: '封面',
    nameEn: 'Douyin Cover',
    width: 1080,
    height: 1920,
    label: '抖音封面 1080×1920',
    labelEn: 'Douyin Cover 1080×1920',
    fixed: false,
    group: 'douyin',
  },
  {
    id: 'douyin_horizontal',
    name: '横版封面',
    nameEn: 'Douyin Landscape Cover',
    width: 1920,
    height: 1080,
    label: '抖音横版封面 1920×1080',
    labelEn: 'Douyin Landscape Cover 1920×1080',
    fixed: false,
    group: 'douyin',
  },

  // ── 哔哩哔哩 ─────────────────────────────────────────────────────────────
  {
    id: 'bilibili_cover',
    name: '视频封面',
    nameEn: 'Bilibili Cover',
    width: 1146,
    height: 717,
    label: 'B站视频封面 1146×717',
    labelEn: 'Bilibili Cover 1146×717',
    fixed: false,
    group: 'bilibili',
  },
  {
    id: 'bilibili_avatar',
    name: '头像',
    nameEn: 'Bilibili Avatar',
    width: 400,
    height: 400,
    label: 'B站头像 400×400',
    labelEn: 'Bilibili Avatar 400×400',
    fixed: false,
    group: 'bilibili',
  },
  {
    id: 'bilibili_space_banner',
    name: '空间横幅',
    nameEn: 'Bilibili Space Banner',
    width: 1920,
    height: 540,
    label: 'B站空间横幅 1920×540',
    labelEn: 'Bilibili Space Banner 1920×540',
    fixed: false,
    group: 'bilibili',
  },

  // ── 知乎 ─────────────────────────────────────────────────────────────────
  {
    id: 'zhihu_article',
    name: '文章封面',
    nameEn: 'Zhihu Article Cover',
    width: 690,
    height: 388,
    label: '知乎文章封面 690×388',
    labelEn: 'Zhihu Article Cover 690×388',
    fixed: false,
    group: 'zhihu',
  },
  {
    id: 'zhihu_answer',
    name: '回答配图',
    nameEn: 'Zhihu Answer Image',
    width: 1080,
    height: 720,
    label: '知乎回答配图 1080×720',
    labelEn: 'Zhihu Answer Image 1080×720',
    fixed: false,
    group: 'zhihu',
  },

  // ── 淘宝 / 天猫 ───────────────────────────────────────────────────────────
  {
    id: 'taobao_main',
    name: '主图',
    nameEn: 'Taobao Main Image',
    width: 800,
    height: 800,
    label: '淘宝主图 800×800',
    labelEn: 'Taobao Main Image 800×800',
    fixed: false,
    group: 'taobao',
  },
  {
    id: 'taobao_banner',
    name: '店铺横幅',
    nameEn: 'Taobao Store Banner',
    width: 1920,
    height: 500,
    label: '淘宝店铺横幅 1920×500',
    labelEn: 'Taobao Store Banner 1920×500',
    fixed: false,
    group: 'taobao',
  },

  // ── YouTube ───────────────────────────────────────────────────────────────
  {
    id: 'youtube_thumbnail',
    name: '缩略图',
    nameEn: 'YouTube Thumbnail',
    width: 1280,
    height: 720,
    label: 'YouTube 缩略图 1280×720',
    labelEn: 'YouTube Thumbnail 1280×720',
    fixed: false,
    group: 'youtube',
  },
  {
    id: 'youtube_channel_banner',
    name: '频道横幅',
    nameEn: 'YouTube Channel Banner',
    width: 2560,
    height: 1440,
    label: 'YouTube 频道横幅 2560×1440',
    labelEn: 'YouTube Channel Banner 2560×1440',
    fixed: false,
    group: 'youtube',
  },

  // ── X (Twitter) ───────────────────────────────────────────────────────────
  {
    id: 'twitter_post',
    name: '推文配图',
    nameEn: 'X Post Image',
    width: 1200,
    height: 675,
    label: 'X 推文配图 1200×675',
    labelEn: 'X Post Image 1200×675',
    fixed: false,
    group: 'twitter',
  },
  {
    id: 'twitter_cover',
    name: '主页横幅',
    nameEn: 'X Profile Banner',
    width: 1500,
    height: 500,
    label: 'X 主页横幅 1500×500',
    labelEn: 'X Profile Banner 1500×500',
    fixed: false,
    group: 'twitter',
  },

  // ── Instagram ─────────────────────────────────────────────────────────────
  {
    id: 'instagram_post',
    name: '方形帖子',
    nameEn: 'Instagram Square',
    width: 1080,
    height: 1080,
    label: 'Instagram 方形 1080×1080',
    labelEn: 'Instagram Square 1080×1080',
    fixed: false,
    group: 'instagram',
  },
  {
    id: 'instagram_portrait',
    name: '竖图',
    nameEn: 'Instagram Portrait',
    width: 1080,
    height: 1350,
    label: 'Instagram 竖图 1080×1350',
    labelEn: 'Instagram Portrait 1080×1350',
    fixed: false,
    group: 'instagram',
  },
  {
    id: 'instagram_story',
    name: 'Stories / Reels',
    nameEn: 'Instagram Stories / Reels',
    width: 1080,
    height: 1920,
    label: 'Instagram Stories/Reels 1080×1920',
    labelEn: 'Instagram Stories/Reels 1080×1920',
    fixed: false,
    group: 'instagram',
  },

  // ── Facebook ──────────────────────────────────────────────────────────────
  {
    id: 'facebook_post',
    name: '动态配图',
    nameEn: 'Facebook Post',
    width: 1200,
    height: 630,
    label: 'Facebook 动态配图 1200×630',
    labelEn: 'Facebook Post 1200×630',
    fixed: false,
    group: 'facebook',
  },
  {
    id: 'facebook_cover',
    name: '主页封面',
    nameEn: 'Facebook Cover',
    width: 820,
    height: 312,
    label: 'Facebook 主页封面 820×312',
    labelEn: 'Facebook Cover 820×312',
    fixed: false,
    group: 'facebook',
  },

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  {
    id: 'linkedin_post',
    name: '动态配图',
    nameEn: 'LinkedIn Post',
    width: 1200,
    height: 627,
    label: 'LinkedIn 动态配图 1200×627',
    labelEn: 'LinkedIn Post 1200×627',
    fixed: false,
    group: 'linkedin',
  },
  {
    id: 'linkedin_banner',
    name: '个人横幅',
    nameEn: 'LinkedIn Banner',
    width: 1584,
    height: 396,
    label: 'LinkedIn 个人横幅 1584×396',
    labelEn: 'LinkedIn Banner 1584×396',
    fixed: false,
    group: 'linkedin',
  },

  // ── 通用尺寸 ──────────────────────────────────────────────────────────────
  {
    id: 'hd_720p',
    name: 'HD 720p',
    nameEn: 'HD 720p',
    width: 1280,
    height: 720,
    label: 'HD 720p 1280×720',
    labelEn: 'HD 720p 1280×720',
    fixed: false,
    group: 'general',
  },
  {
    id: 'fhd_1080p',
    name: 'Full HD 1080p',
    nameEn: 'Full HD 1080p',
    width: 1920,
    height: 1080,
    label: 'FHD 1080p 1920×1080',
    labelEn: 'Full HD 1080p 1920×1080',
    fixed: false,
    group: 'general',
  },
  {
    id: 'qhd_2k',
    name: 'QHD 2K',
    nameEn: 'QHD 2K',
    width: 2560,
    height: 1440,
    label: 'QHD 2K 2560×1440',
    labelEn: 'QHD 2K 2560×1440',
    fixed: false,
    group: 'general',
  },
  {
    id: 'uhd_4k',
    name: 'UHD 4K',
    nameEn: 'UHD 4K',
    width: 3840,
    height: 2160,
    label: 'UHD 4K 3840×2160',
    labelEn: 'UHD 4K 3840×2160',
    fixed: false,
    group: 'general',
  },

  // ── 电商 / 广告图 ─────────────────────────────────────────────────────────
  {
    id: 'banner_full',
    name: '全屏横幅',
    nameEn: 'Full-width Banner',
    width: 1920,
    height: 600,
    label: '全屏横幅 1920×600',
    labelEn: 'Full-width Banner 1920×600',
    fixed: false,
    group: 'ecommerce',
  },
  {
    id: 'og_image',
    name: 'OG / SEO 分享图',
    nameEn: 'OG / SEO Share Image',
    width: 1200,
    height: 630,
    label: 'OG 分享图 1200×630',
    labelEn: 'OG Share Image 1200×630',
    fixed: false,
    group: 'ecommerce',
  },
  {
    id: 'app_icon_1024',
    name: 'App Store 图标',
    nameEn: 'App Store Icon',
    width: 1024,
    height: 1024,
    label: 'App Store 图标 1024×1024',
    labelEn: 'App Store Icon 1024×1024',
    fixed: false,
    group: 'ecommerce',
  },
  {
    id: 'play_store_feature',
    name: 'Google Play 特色图片',
    nameEn: 'Google Play Feature Graphic',
    width: 1024,
    height: 500,
    label: 'Google Play 特色图片 1024×500',
    labelEn: 'Google Play Feature Graphic 1024×500',
    fixed: false,
    group: 'ecommerce',
  },
];

export const watermarkPresets: WatermarkPreset[] = [
  { id: 'resume', text: '仅供XX公司入职使用', pattern: 'tile', opacity: 0.3 },
  { id: 'copyright', text: '© 版权所有 未经许可转载', pattern: 'single', opacity: 0.5 },
  { id: 'sample', text: '样稿 SAMPLE', pattern: 'diagonal', opacity: 0.4 },
  { id: 'confidential', text: '内部资料 请勿外传', pattern: 'tile', opacity: 0.3 },
  { id: 'personal', text: '个人使用', pattern: 'single', opacity: 0.4 },
  { id: 'wechat', text: '微信号: xxxxx', pattern: 'single', opacity: 0.5 },
];

export type ToolTab = 'adjust' | 'watermark' | 'merge';

export interface FormatPreset {
  id: string;
  name: string;
  nameEn: string;
  extension: string;
  mimeType: string;
  /** 是否需要质量参数（0–1） */
  hasQuality: boolean;
  /** Canvas toDataURL 是否可靠支持；false = 需提示限制 */
  canvasSupported: boolean;
  description: string;
  descriptionEn: string;
  fixed: boolean;
}

/**
 * 支持的导出格式（仅 Canvas 原生可靠支持）
 * JPEG / PNG / WebP — 覆盖 95%+ 使用场景，无额外依赖，可在纯前端/Cloudflare Pages 部署
 */
export const exportFormats: FormatPreset[] = [
  {
    id: 'jpeg',
    name: 'JPEG',
    nameEn: 'JPEG',
    extension: '.jpg',
    mimeType: 'image/jpeg',
    hasQuality: true,
    canvasSupported: true,
    description: '有损压缩，文件小，适合照片',
    descriptionEn: 'Lossy, small file, ideal for photos',
    fixed: true,
  },
  {
    id: 'png',
    name: 'PNG',
    nameEn: 'PNG',
    extension: '.png',
    mimeType: 'image/png',
    hasQuality: false,
    canvasSupported: true,
    description: '无损压缩，支持透明通道',
    descriptionEn: 'Lossless, supports transparency',
    fixed: true,
  },
  {
    id: 'webp',
    name: 'WebP',
    nameEn: 'WebP',
    extension: '.webp',
    mimeType: 'image/webp',
    hasQuality: true,
    canvasSupported: true,
    description: '有损/无损双模式，体积比 JPEG 小 25-35%',
    descriptionEn: 'Lossy/lossless, ~25-35% smaller than JPEG',
    fixed: true,
  },
];

export type ExportFormat = typeof exportFormats[number]['id'];
