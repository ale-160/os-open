import type { MetadataRoute } from "next";

const SITE_URL = "https://os.ale160.com";

// 静态导出要求显式声明
export const dynamic = "force-static";

/**
 * 构建时自动生成 sitemap.xml（替代手写 public/sitemap.xml）
 * 单语言路由：根目录即中文站，无 /zh 变体
 * 路径与 scripts/compose.mjs 的子应用部署路径保持一致
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const routes: { url: string; priority: number }[] = [
    { url: `${SITE_URL}/`, priority: 1 },
    { url: `${SITE_URL}/pet/`, priority: 0.9 },
    { url: `${SITE_URL}/img/`, priority: 0.7 },
    { url: `${SITE_URL}/text/`, priority: 0.7 },
    { url: `${SITE_URL}/chat/`, priority: 0.7 },
    { url: `${SITE_URL}/typev/`, priority: 0.7 },
  ];

  return routes.map((r) => ({
    url: r.url,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: r.priority,
  }));
}
