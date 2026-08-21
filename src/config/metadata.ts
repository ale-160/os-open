import { Metadata } from "next";

export const METADATA_ZH = {
  title: "web-img · 在线图片处理工具 - 压缩、水印、格式转换",
  description: "纯前端在线图片处理工具箱，支持图片压缩、格式转换、图片水印、裁剪、旋转、镜像、RGB调色等功能。所有图片在本地处理，不会上传到服务器，保护您的隐私安全。",
  keywords: [
    "web-img",
    "图片处理",
    "图片压缩",
    "在线压缩",
    "图片水印",
    "格式转换",
    "PNG转WebP",
    "JPG压缩",
    "在线工具",
    "隐私保护",
    "无需注册",
    "无需服务器",
    "纯前端",
    "裁剪",
    "旋转",
    "镜像",
  ],
  authors: [{ name: "Ale", url: "https://ale160.com" }],
  creator: "Ale",
  publisher: "Ale",
  openGraph: {
    title: "web-img · 在线图片处理工具",
    description: "纯前端在线图片处理工具箱，支持压缩、水印、格式转换。所有图片本地处理，保护隐私。",
    url: "https://web-img.ale160.com/zh/",
    siteName: "web-img 官方网站",
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: "https://ale160.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "web-img 预览图"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "web-img · 在线图片处理工具",
    description: "纯前端在线图片处理工具箱，支持压缩、水印、格式转换。所有图片本地处理。",
    images: ["https://ale160.com/og-image.png"],
    creator: "@ale160"
  },
  alternates: {
    canonical: "https://web-img.ale160.com/zh/",
    languages: {
      "en": "https://web-img.ale160.com/",
      "zh-CN": "https://web-img.ale160.com/zh/",
      "x-default": "https://web-img.ale160.com/"
    }
  }
};

export const METADATA_EN = {
  title: "web-img · Online Image Tool - Compress, Watermark, Convert",
  description: "A privacy-focused online image toolbox with compression, format conversion, watermark, crop, rotate, flip, and RGB adjustment. All images are processed locally — never uploaded to any server.",
  keywords: [
    "web-img",
    "image processing",
    "image compression",
    "online compress",
    "watermark",
    "format conversion",
    "PNG to WebP",
    "JPG compress",
    "online tool",
    "privacy focused",
    "no registration",
    "no server",
    "client-side",
    "crop",
    "rotate",
    "flip",
  ],
  authors: [{ name: "Ale", url: "https://ale160.com" }],
  creator: "Ale",
  publisher: "Ale",
  openGraph: {
    title: "web-img · Online Image Tool",
    description: "A privacy-focused online image toolbox with compression, watermark, and format conversion. All images processed locally.",
    url: "https://web-img.ale160.com/",
    siteName: "web-img Official Website",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://ale160.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "web-img Preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "web-img · Online Image Tool",
    description: "A privacy-focused online image toolbox with compression, watermark, and format conversion. All images processed locally.",
    images: ["https://ale160.com/og-image.png"],
    creator: "@ale160"
  },
  alternates: {
    canonical: "https://web-img.ale160.com/",
    languages: {
      "en": "https://web-img.ale160.com/",
      "zh-CN": "https://web-img.ale160.com/zh/",
      "x-default": "https://web-img.ale160.com/"
    }
  }
};

// PDF 页面元数据
export const PDF_METADATA_ZH = {
  title: "web-img · PDF 转图片 - 在线 PDF 转换工具",
  description: "免费在线 PDF 转图片工具，支持将 PDF 页面转换为 PNG、JPEG、WebP 格式。多页批量转换，高分辨率渲染，纯前端本地处理，保护隐私。",
  keywords: [
    "PDF转图片",
    "PDF转换",
    "PDF to Image",
    "PDF to PNG",
    "PDF to JPEG",
    "在线PDF工具",
    "web-img",
  ],
};

export const PDF_METADATA_EN = {
  title: "web-img · PDF to Image - Online PDF Converter",
  description: "Free online PDF to image converter. Convert PDF pages to PNG, JPEG, or WebP format. Batch conversion, high resolution rendering, all processed locally for privacy.",
  keywords: [
    "PDF to image",
    "PDF converter",
    "PDF to PNG",
    "PDF to JPEG",
    "online PDF tool",
    "web-img",
  ],
};

// 图片格式转换页元数据
export const CONVERT_METADATA_ZH = {
  title: "web-img · 图片格式转换 - 批量转换 JPG PNG WebP BMP ICO",
  description: "免费在线图片格式转换工具，支持批量将图片转换为 JPG、PNG、WebP、BMP、ICO 格式，可调质量和尺寸。支持 JPG、PNG、WebP、GIF、BMP、SVG、ICO、AVIF 输入。纯前端本地处理，图片不会上传服务器。",
  keywords: [
    "图片格式转换",
    "格式转换器",
    "PNG转JPG",
    "JPG转WebP",
    "HEIC转JPG",
    "图片转ICO",
    "批量转换",
    "在线转换工具",
    "web-img",
  ],
};

export const CONVERT_METADATA_EN = {
  title: "web-img · Image Converter - Batch Convert JPG PNG WebP BMP ICO",
  description: "Free online image format converter. Batch convert images to JPG, PNG, WebP, BMP, or ICO with quality and size control. Accepts JPG, PNG, WebP, GIF, BMP, SVG, ICO, AVIF input. All processed locally — files never leave your device.",
  keywords: [
    "image converter",
    "format converter",
    "PNG to JPG",
    "JPG to WebP",
    "image to ICO",
    "batch convert",
    "online converter",
    "web-img",
  ],
};

export function getMetadata(lang: string = "en"): Metadata {
  const metadata = lang === "en" ? METADATA_EN : METADATA_ZH;

  return {
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    authors: metadata.authors,
    creator: metadata.creator,
    publisher: metadata.publisher,
    icons: {
      icon: "/favicon.png",
    },
    formatDetection: {
      email: false,
      telephone: false,
    },
    openGraph: metadata.openGraph,
    twitter: metadata.twitter,
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    alternates: metadata.alternates,
  };
}

export function getPdfMetadata(lang: string = "en"): Metadata {
  const pdfMeta = lang === "en" ? PDF_METADATA_EN : PDF_METADATA_ZH;
  const base = lang === "en" ? METADATA_EN : METADATA_ZH;

  return {
    title: pdfMeta.title,
    description: pdfMeta.description,
    keywords: pdfMeta.keywords,
    authors: base.authors,
    creator: base.creator,
    publisher: base.publisher,
    icons: {
      icon: "/favicon.png",
    },
    formatDetection: {
      email: false,
      telephone: false,
    },
    openGraph: {
      ...base.openGraph,
      title: pdfMeta.title,
      description: pdfMeta.description,
      url: lang === "en" ? "https://web-img.ale160.com/pdf/" : "https://web-img.ale160.com/zh/pdf/",
      locale: lang === "en" ? "en_US" : "zh_CN",
    },
    twitter: {
      ...base.twitter,
      title: pdfMeta.title,
      description: pdfMeta.description,
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    alternates: {
      canonical: lang === "en" ? "https://web-img.ale160.com/pdf/" : "https://web-img.ale160.com/zh/pdf/",
      languages: {
        "en": "https://web-img.ale160.com/pdf/",
        "zh-CN": "https://web-img.ale160.com/zh/pdf/",
      },
    },
  };
}

export function getConvertMetadata(lang: string = "en"): Metadata {
  const convertMeta = lang === "en" ? CONVERT_METADATA_EN : CONVERT_METADATA_ZH;
  const base = lang === "en" ? METADATA_EN : METADATA_ZH;
  const url = lang === "en" ? "https://web-img.ale160.com/convert/" : "https://web-img.ale160.com/zh/convert/";

  return {
    title: convertMeta.title,
    description: convertMeta.description,
    keywords: convertMeta.keywords,
    authors: base.authors,
    creator: base.creator,
    publisher: base.publisher,
    icons: {
      icon: "/favicon.png",
    },
    formatDetection: {
      email: false,
      telephone: false,
    },
    openGraph: {
      ...base.openGraph,
      title: convertMeta.title,
      description: convertMeta.description,
      url,
      locale: lang === "en" ? "en_US" : "zh_CN",
    },
    twitter: {
      ...base.twitter,
      title: convertMeta.title,
      description: convertMeta.description,
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    alternates: {
      canonical: url,
      languages: {
        "en": "https://web-img.ale160.com/convert/",
        "zh-CN": "https://web-img.ale160.com/zh/convert/",
      },
    },
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
};
