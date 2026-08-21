import type { MetadataRoute } from "next";

// 站点地图：每次构建自动生成 out/sitemap.xml，无需手动维护
const BASE_URL = "https://web-img.ale160.com";

// output: export 模式要求 metadata 路由显式静态
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: {
          en: `${BASE_URL}/`,
          zh: `${BASE_URL}/zh/`,
          "x-default": `${BASE_URL}/`,
        },
      },
    },
    {
      url: `${BASE_URL}/pdf/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
      alternates: {
        languages: {
          en: `${BASE_URL}/pdf/`,
          zh: `${BASE_URL}/zh/pdf/`,
          "x-default": `${BASE_URL}/pdf/`,
        },
      },
    },
    {
      url: `${BASE_URL}/zh/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: {
        languages: {
          en: `${BASE_URL}/`,
          zh: `${BASE_URL}/zh/`,
          "x-default": `${BASE_URL}/`,
        },
      },
    },
    {
      url: `${BASE_URL}/zh/pdf/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: {
        languages: {
          en: `${BASE_URL}/pdf/`,
          zh: `${BASE_URL}/zh/pdf/`,
          "x-default": `${BASE_URL}/pdf/`,
        },
      },
    },
    {
      url: `${BASE_URL}/convert/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: {
        languages: {
          en: `${BASE_URL}/convert/`,
          zh: `${BASE_URL}/zh/convert/`,
          "x-default": `${BASE_URL}/convert/`,
        },
      },
    },
    {
      url: `${BASE_URL}/zh/convert/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: {
          en: `${BASE_URL}/convert/`,
          zh: `${BASE_URL}/zh/convert/`,
          "x-default": `${BASE_URL}/convert/`,
        },
      },
    },
    {
      url: `${BASE_URL}/gif/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: {
          en: `${BASE_URL}/gif/`,
          zh: `${BASE_URL}/zh/gif/`,
          "x-default": `${BASE_URL}/gif/`,
        },
      },
    },
    {
      url: `${BASE_URL}/zh/gif/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: {
          en: `${BASE_URL}/gif/`,
          zh: `${BASE_URL}/zh/gif/`,
          "x-default": `${BASE_URL}/gif/`,
        },
      },
    },
  ];
}
