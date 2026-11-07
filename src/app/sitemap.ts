import type { MetadataRoute } from "next";
import { getAllCatalogProducts, getAllRooms } from "@/lib/data/store";
import { listStores } from "@/lib/stores";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages = ["", "/design", "/rooms", "/categories", "/builder", "/builder/guide", "/monitors", "/compare", "/stores", "/community", "/privacy", "/terms", "/about"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "weekly" as const,
  }));
  const rooms = getAllRooms().map((r) => ({ url: `${base}/rooms/${r.slug}`, lastModified: r.updatedAt }));
  const products = getAllCatalogProducts()
    .filter((p) => p.status === "available")
    .map((p) => ({ url: `${base}/products/${p.id}`, lastModified: p.priceUpdatedAt }));
  const stores = listStores().map((s) => ({ url: `${base}/stores/${encodeURIComponent(s.key)}` }));
  return [...pages, ...rooms, ...products, ...stores];
}
