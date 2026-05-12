import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeScript } from "@/components/theme/theme-script";
import {
  getLocaleDirection,
  LOCALE_COOKIE,
  normalizeLocale,
} from "@/lib/i18n/config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Store OMS",
  description: "Order management for high-volume eCommerce",
  applicationName: "Store OMS",
  appleWebApp: {
    capable: true,
    title: "Store OMS",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2383e2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1419" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const dir = getLocaleDirection(locale);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased font-sans`}
        dir={dir}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
