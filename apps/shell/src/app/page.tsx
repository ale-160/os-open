import MainPage from '@/components/layout/MainPage';
import {JsonLd} from '@/components/seo/json-ld';
import { Metadata } from 'next';
import { getMetadata } from '@/config/metadata';

export const metadata: Metadata = getMetadata('zh');

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ale OS",
  url: "https://os.ale160.com/",
  description:
    "美观的操作系统风格个人网页操作系统：桌面、文件夹、暗色模式、自定义壁纸、多页管理，并以内嵌应用的方式集成了图片工具箱与 Markdown 编辑器。完全本地存储，注重隐私。",
  applicationCategory: "BrowserApplication",
  operatingSystem: "Any",
  inLanguage: "zh-CN",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD"
  },
  author: {
    "@type": "Person",
    name: "Ale",
    url: "https://ale160.com"
  }
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={appJsonLd}/>
      <MainPage lang="zh" />
    </>
  );
}
