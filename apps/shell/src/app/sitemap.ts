import type { MetadataRoute } from "next";

const SITE_URL = "https://os.ale160.com";

// 静态导出要求显式声明
export const dynamic = "force-static";

/**
 * 构建时自动生成 sitemap.xml（替代手写 public/sitemap.xml）
 * 单语言路由：根目录即中文站，无 /zh 变体
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
