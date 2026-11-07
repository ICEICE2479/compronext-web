import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL ? siteUrl() : null;
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/partner", "/api/", "/account", "/cart", "/credits"] },
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
