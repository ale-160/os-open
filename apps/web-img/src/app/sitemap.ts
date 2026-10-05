import type { MetadataRoute } from "next";

// 站点地图：每次构建自动生成 out/sitemap.xml，无需手动维护
const BASE_URL = "https://os.ale160.com/img";

// output: export 模式要求 metadata 路由显式静态
export const dynamic = "force-static";

// 单语言路由：根目录即中文站，无 /zh 变体
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/convert/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/gif/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/pdf/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
