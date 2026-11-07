import type { Metadata } from "next";
import { getAllCatalogProducts, getAllCategories, getAllRooms } from "@/lib/data/store";
import { MACRO_CATEGORIES, type MacroCategorySlug } from "@/lib/catalog-taxonomy";
import { catalogFacets, queryCatalog } from "@/lib/catalog-query";
import { CategoriesCatalogClient } from "@/components/CategoriesCatalogClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "สินค้า",
  description: "เลือกดูสินค้าคอมพิวเตอร์และอุปกรณ์ไอทีตามหมวดหมู่ เปรียบเทียบราคาจากหลายร้านค้า",
};

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; macro?: string; sub?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const products = getAllCatalogProducts();
  const dbCategories = getAllCategories(false);

  const initialMacro =
    sp.macro && MACRO_CATEGORIES.some((m) => m.slug === sp.macro) ? (sp.macro as MacroCategorySlug) : null;

  const roomSlugs: Record<string, string> = {};
  for (const room of [...getAllRooms()].sort((a, b) => a.popularity - b.popularity)) {
    for (const it of room.items) roomSlugs[it.productId] = room.slug;
  }

  // ส่งแค่หน้าแรก 24 ชิ้น — ที่เหลือโหลดผ่าน /api/products ตอนเลื่อน
  const first = queryCatalog(
    products,
    dbCategories,
    { macro: initialMacro, cat: sp.cat, sub: sp.sub, q: sp.q, offset: 0, limit: 24 },
    roomSlugs
  );

  return (
    <CategoriesCatalogClient
      initialItems={first.items}
      initialTotal={first.total}
      facets={catalogFacets(products, dbCategories)}
      initialMacro={initialMacro}
      initialCat={sp.cat ?? null}
      initialSub={sp.sub ?? null}
      initialQuery={sp.q ?? ""}
    />
  );
}
