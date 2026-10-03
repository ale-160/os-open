import { Metadata } from "next";

export const METADATA_ZH = {
  title: "Ale OS · 个人网页操作系统",
  description: "一个美观的操作系统风格浏览器主页，支持拖拽、文件夹、暗色模式、自定义壁纸和多页管理。完全本地存储，注重隐私。",
  keywords: [
    "Ale OS",
    "浏览器主页",
    "起始页",
    "新标签页",
    "书签管理器",
    "桌面风格",
    "拖拽",
    "暗色模式",
    "隐私保护",
    "本地存储",
    "自定义壁纸"
  ],
  authors: [{ name: "Ale", url: "https://ale160.com" }],
  creator: "Ale",
  publisher: "Ale",
  openGraph: {
    title: "Ale OS · 个人网页操作系统",
    description: "一个美观的操作系统风格浏览器主页，支持拖拽、文件夹、暗色模式、自定义壁纸和多页管理。",
    url: "https://os.ale160.com/",
    siteName: "Ale OS",
    locale: "zh_CN",
    type: "website" as const,
    images: [
      {
        url: "https://ale160.com/images/logo-icon.png",
        width: 1200,
        height: 630,
        alt: "Ale OS 预览图"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Ale OS · 个人网页操作系统",
    description: "一个美观的操作系统风格浏览器主页，支持拖拽、文件夹、暗色模式、自定义壁纸和多页管理。",
    images: ["https://ale160.com/images/logo-icon.png"],
    creator: "@ale160"
  },
  alternates: {
    canonical: "https://os.ale160.com/"
  }
};

export const METADATA_EN = {
  title: "Ale OS · Personal Web OS",
  description: "A beautiful OS-style browser homepage with drag-and-drop, folders, dark mode, custom wallpapers, and multi-page management. 100% local, privacy-focused.",
  keywords: [
    "Ale OS",
    "browser homepage",
    "start page",
    "new tab",
    "bookmark manager",
    "desktop style",
    "drag and drop",
    "dark mode",
    "privacy focused",
    "local storage",
    "custom wallpaper"
  ],
  authors: [{ name: "Ale", url: "https://ale160.com" }],
  creator: "Ale",
  publisher: "Ale",
  openGraph: {
    title: "Ale OS · Personal Web OS",
    description: "A beautiful OS-style browser homepage with drag-and-drop, folders, dark mode, custom wallpapers, and multi-page management.",
    url: "https://os.ale160.com/",
    siteName: "Ale OS",
    locale: "en_US",
    type: "website" as const,
    images: [
      {
        url: "https://ale160.com/images/logo-icon.png",
        width: 1200,
        height: 630,
        alt: "Ale OS Preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Ale OS · Personal Web OS",
    description: "A beautiful OS-style browser homepage with drag-and-drop, folders, dark mode, custom wallpapers, and multi-page management.",
    images: ["https://ale160.com/images/logo-icon.png"],
    creator: "@ale160"
  },
  alternates: {
    canonical: "https://os.ale160.com/"
  }
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
      icon: "https://ale160.com/favicon.png"
    },
    formatDetection: {
      email: false,
      telephone: false
    },
    openGraph: metadata.openGraph,
    twitter: metadata.twitter,
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    },
    alternates: metadata.alternates
  };
}

// Viewport 配置
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3b82f6"
};
