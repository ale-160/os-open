import "./globals.css";
import { Toaster } from "sonner";
import React from "react";
import { viewport } from "@/config/metadata";

export { viewport };

/**
 * 首帧前同步应用主题，避免暗色用户看到亮色闪烁。
 * 读取顺序与 useTheme 保持一致：localStorage 优先，其次系统偏好。
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('web-img-theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://ale160.com" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}

