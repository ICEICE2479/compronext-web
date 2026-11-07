import type { Metadata } from "next";
import type { Product } from "@/lib/types";

/** ที่อยู่เว็บจริง: NEXT_PUBLIC_SITE_URL → โดเมนหลักของ Vercel (ตั้งให้อัตโนมัติ) → localhost */
export function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return "http://localhost:3000";
  // ใส่ https:// ให้ถ้าพิมพ์มาแค่โดเมน (เช่น your-app.vercel.app) — ไม่งั้น new URL() พังตอน build
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** แปลงพาธ/ลิงก์รูปเป็นลิงก์เต็ม (โซเชียลต้องการลิงก์เต็ม) */
export function absUrl(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  if (/^https?:\/\//.test(u)) return u;
  return `${siteUrl()}${u.startsWith("/") ? "" : "/"}${u}`;
}

/** ข้อมูลตอนแชร์ลิงก์ (LINE / Facebook / X) + ลิงก์หลักของหน้า */
export function shareMeta(opts: { title: string; description: string; path: string; image?: string | null; type?: "website" | "article" }): Metadata {
  const image = absUrl(opts.image);
  const description = opts.description.replace(/\s+/g, " ").trim().slice(0, 160);
  return {
    title: opts.title,
    description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: opts.title,
      description,
      url: opts.path,
      type: opts.type ?? "website",
      siteName: "ComproNext",
      locale: "th_TH",
      ...(image ? { images: [{ url: image, alt: opts.title }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: opts.title, description, ...(image ? { images: [image] } : {}) },
  };
}

/** ข้อมูลสินค้าแบบ schema.org ให้ Google โชว์ราคา/สถานะของ/ดาว ในผลค้นหา */
export function productJsonLd(p: Product, extra: { brand?: string; storeName: string; rating?: { avg: number; count: number } | null }) {
  const image = absUrl(p.imageUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description.slice(0, 500),
    sku: p.id,
    ...(image ? { image: [image] } : {}),
    ...(extra.brand ? { brand: { "@type": "Brand", name: extra.brand } } : {}),
    offers: {
      "@type": "Offer",
      url: `${siteUrl()}/products/${p.id}`,
      priceCurrency: "THB",
      price: p.price,
      availability: p.status === "available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: extra.storeName },
      priceValidUntil: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    },
    ...(extra.rating && extra.rating.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: extra.rating.avg, reviewCount: extra.rating.count } }
      : {}),
  };
}

/** ใส่ JSON-LD ในหน้า (กัน </script> ในข้อความ) */
export function jsonLdHtml(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

