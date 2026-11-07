import "server-only";
import type { CatalogCategoryRecord, Product } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/format";
import { extractProductBrand, MACRO_CATEGORIES } from "@/lib/catalog-taxonomy";
import { matchScore } from "@/lib/search";

export type SortMode = "popular" | "price_asc" | "price_desc" | "newest";

export interface CatalogQuery {
  macro?: string | null;
  cat?: string | null;
  sub?: string | null;
  q?: string | null;
  brand?: string | null;
  maxPrice?: number | null;
  sort?: SortMode | null;
  offset?: number;
  limit?: number;
}

/** ข้อมูลสินค้าแบบย่อที่ส่งไปการ์ดสินค้า */
export type ProductCard = Pick<
  Product,
  "id" | "name" | "imageUrl" | "price" | "buyUrl" | "storeName" | "platform" | "category" | "status" | "featured" | "modelUrl"
> & { roomSlug?: string; sourceImageUrl?: string | null };

// ลำดับหมวดในโหมด "แนะนำ" (ของแต่งห้องมาก่อน แล้วกระจายหมวดอื่นสลับกัน)
const CATEGORY_PRIORITY = [
  "desk", "chair", "lighting", "bed", "storage", "decor", "rug", "fake_plant", "monitor",
  "monitor_arm", "keyboard", "mouse", "headphone", "speaker", "wardrobe", "computer",
];

function interleaveByCategory(list: Product[]): Product[] {
  const buckets = new Map<string, Product[]>();
  for (const p of list) (buckets.get(p.category) ?? buckets.set(p.category, []).get(p.category)!).push(p);
  const rank = (c: string) => (CATEGORY_PRIORITY.includes(c) ? CATEGORY_PRIORITY.indexOf(c) : CATEGORY_PRIORITY.length);
  const order = Array.from(buckets.keys()).sort((a, b) => rank(a) - rank(b));
  const out: Product[] = [];
  for (let i = 0; out.length < list.length; i++) {
    for (const c of order) {
      const item = buckets.get(c)![i];
      if (item) out.push(item);
    }
  }
  return out;
}

const brandCache = new Map<string, string>();
export function brandOf(p: Product): string {
  const key = `${p.id}|${p.name}|${p.platform}`;
  let b = brandCache.get(key);
  if (!b) {
    b = extractProductBrand(p.name, p.category, p.platform);
    brandCache.set(key, b);
  }
  return b;
}

export function toCard(p: Product, roomSlug?: string): ProductCard {
  return {
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    price: p.price,
    buyUrl: p.buyUrl,
    storeName: p.storeName,
    platform: p.platform,
    category: p.category,
    status: p.status,
    featured: p.featured,
    modelUrl: p.modelUrl ?? null,
    ...(p.sourceImageUrl ? { sourceImageUrl: p.sourceImageUrl } : {}),
    ...(roomSlug ? { roomSlug } : {}),
  };
}

export function queryCatalog(
  products: Product[],
  dbCategories: CatalogCategoryRecord[],
  params: CatalogQuery,
  roomSlugs: Record<string, string> = {}
) {
  const q = (params.q ?? "").trim().toLowerCase();
  const macro = params.macro && params.macro !== "all" ? params.macro : null;
  const group = macro ? MACRO_CATEGORIES.find((m) => m.slug === macro) : null;
  const extraSlugs = macro ? dbCategories.filter((c) => c.macroSlug === macro).map((c) => c.slug) : [];
  const sub = group && params.sub && params.sub !== "all" ? group.subcategories.find((s) => s.slug === params.sub) : null;
  const cat = params.cat && params.cat !== "all" ? params.cat : null;
  const brand = params.brand && params.brand !== "all" ? params.brand : null;
  const maxPrice = params.maxPrice && params.maxPrice > 0 ? params.maxPrice : null;

  const scores = new Map<string, number>();
  const list = products.filter((p) => {
    if (group && !group.mappedCategories.includes(p.category) && !extraSlugs.includes(p.category)) return false;
    if (cat && p.category !== cat) return false;
    if (sub) {
      const hay = `${p.name} ${p.description} ${Object.values(p.specs).join(" ")}`.toLowerCase();
      if (!sub.keywords.some((kw) => hay.includes(kw.toLowerCase()))) return false;
    }
    if (brand && brandOf(p) !== brand) return false;
    if (maxPrice && p.price > maxPrice) return false;
    if (q) {
      const label = (CATEGORY_LABELS as Record<string, string>)[p.category] || p.category;
      const sc = matchScore(q, p.name, `${brandOf(p)} ${label} ${p.storeName} ${p.description}`);
      if (!sc) return false;
      scores.set(p.id, sc);
    }
    return true;
  });

  let sorted: Product[];
  switch (params.sort) {
    case "price_asc":
      sorted = [...list].sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      sorted = [...list].sort((a, b) => b.price - a.price);
      break;
    case "newest":
      sorted = [...list].sort((a, b) => b.priceUpdatedAt.localeCompare(a.priceUpdatedAt));
      break;
    default: {
      if (q) {
        // มีคำค้น → เรียงตามความตรง (ของพร้อมขายก่อน)
        sorted = [...list].sort((a, b) => Number(b.status === "available") - Number(a.status === "available") || (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
        break;
      }
      const available = list.filter((p) => p.status === "available");
      sorted = [
        ...available.filter((p) => p.featured),
        ...interleaveByCategory(available.filter((p) => !p.featured)),
        ...list.filter((p) => p.status !== "available"),
      ];
    }
  }

  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.min(60, Math.max(1, params.limit ?? 24));
  return {
    total: sorted.length,
    items: sorted.slice(offset, offset + limit).map((p) => toCard(p, roomSlugs[p.id])),
  };
}

/** จำนวนสินค้าต่อหมวดหลัก + รายชื่อแบรนด์ (ใช้ทำปุ่มหมวดและตัวกรอง) */
export function catalogFacets(products: Product[], dbCategories: CatalogCategoryRecord[]) {
  const macroCounts: Record<string, number> = {};
  for (const g of MACRO_CATEGORIES) {
    const extra = dbCategories.filter((c) => c.macroSlug === g.slug).map((c) => c.slug);
    macroCounts[g.slug] = products.filter((p) => g.mappedCategories.includes(p.category) || extra.includes(p.category)).length;
  }
  const brands = Array.from(new Set(products.map(brandOf))).sort();
  return { total: products.length, macroCounts, brands };
}
