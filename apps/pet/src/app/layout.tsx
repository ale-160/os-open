import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "咕咕 GuGu · 桌宠",
  description:
    "养在网页操作系统里的原创桌宠：喂食、洗澡、逗弄、打工学习，看咕咕慢慢长大",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#fdf3e3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
