import { ConsentBanner } from "@/components/ConsentBanner";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Cormorant_Garamond, IBM_Plex_Sans_Thai, Sarabun } from "next/font/google";
import "./globals.css";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FloatingCompareBar } from "@/components/FloatingCompareBar";
import { CartDrawer } from "@/components/CartDrawer";
import { Toaster } from "@/components/Toaster";
import { AppShellEffects } from "@/components/AppShellEffects";
import { getAllCategories, getSiteSettings } from "@/lib/data/store";
import { siteUrl } from "@/lib/seo";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-plex-thai",
});

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sarabun",
});

const DEFAULT_TITLE = "ComproNext — ไอเดียจัดห้องคอม & จัดสเปกคอม 3D";
const DEFAULT_DESCRIPTION =
  "แพลตฟอร์มตัวกลางรวบรวมสินค้า คัดสรรไอเดียจัดห้องคอมพิวเตอร์ เปรียบเทียบสเปก ประกอบคอม 3D และเชื่อมต่อลิงก์สั่งซื้อไปยังร้านค้าต้นทางโดยตรง";
const DEFAULT_OG_IMAGE = "/rooms/real-01-a.jpg";

export function generateMetadata(): Metadata {
  const settings = getSiteSettings();
  const title = settings.seoTitle || DEFAULT_TITLE;
  const description = settings.seoDescription || DEFAULT_DESCRIPTION;
  const image = settings.ogImageUrl || DEFAULT_OG_IMAGE;
  return {
    title: {
      default: title,
      template: "%s | ComproNext",
    },
    description,
    keywords: settings.seoKeywords || undefined,
    metadataBase: new URL(siteUrl()),
    applicationName: "ComproNext",
    // Google Search Console: ตั้ง GOOGLE_SITE_VERIFICATION = รหัสจากแท็ก meta ที่ Google ให้มา
    verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
    appleWebApp: { capable: true, title: "ComproNext", statusBarStyle: "default" },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/icon.png", sizes: "192x192", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: "/icons/apple-icon.png",
    },
    openGraph: {
      type: "website",
      locale: "th_TH",
      siteName: "ComproNext",
      title,
      description,
      images: [{ url: image, alt: "ComproNext" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteSettings = getSiteSettings();
  const categories = getAllCategories(false);

  return (
    <html lang="th" className={`${cormorant.variable} ${plexThai.variable} ${sarabun.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col overflow-x-clip antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-info focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-pop"
        >
          ข้ามไปเนื้อหาหลัก
        </a>
        <SiteHeader
          siteSettings={siteSettings}
          categories={categories}
        />
        <main id="main" tabIndex={-1} className="flex-1 pb-20 outline-none lg:pb-0">{children}</main>
        <FloatingCompareBar />
        <CartDrawer />
        <Toaster />
        <ConsentBanner />
        <Suspense fallback={null}>
          <AppShellEffects />
        </Suspense>
        <SiteFooter siteSettings={siteSettings} />
      </body>
    </html>
  );
}


