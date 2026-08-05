import "./globals.css";
import { Toaster } from "sonner";
import React from "react";
import { viewport } from "@/config/metadata";
import { ClientProviders } from "@/components/providers/ClientProviders";

export { viewport };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://ale160.com" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ClientProviders>
          {children}
        </ClientProviders>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
