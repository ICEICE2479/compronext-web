import { NextResponse } from "next/server";
import { getAllCatalogProducts, getAllCategories, getAllRooms } from "@/lib/data/store";
import { queryCatalog, type SortMode } from "@/lib/catalog-query";

/** ค้นหา/กรองสินค้าแบบแบ่งหน้า — หน้าแคตตาล็อกโหลดทีละ 24 ชิ้น */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  // ?ids=a,b,c → ข้อมูลย่อสำหรับเช็กความเข้ากัน (ของในตะกร้า) สูงสุด 50 ชิ้น
  const ids = sp.get("ids");
  if (ids) {
    const want = new Set(ids.split(",").slice(0, 50));
    const items = getAllCatalogProducts()
      .filter((p) => want.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, category: p.category, placement: p.placement, dimensions: p.dimensions, ports: p.ports }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=60" } });
  }
  const roomSlugs: Record<string, string> = {};
  for (const room of [...getAllRooms()].sort((a, b) => a.popularity - b.popularity)) {
    for (const it of room.items) roomSlugs[it.productId] = room.slug;
  }
  const result = queryCatalog(
    getAllCatalogProducts(),
    getAllCategories(false),
    {
      macro: sp.get("macro"),
      cat: sp.get("cat"),
      sub: sp.get("sub"),
      q: sp.get("q")?.slice(0, 100),
      brand: sp.get("brand"),
      maxPrice: Number(sp.get("maxPrice")) || null,
      sort: (sp.get("sort") as SortMode) || "popular",
      offset: Number(sp.get("offset")) || 0,
      limit: Number(sp.get("limit")) || 24,
    },
    roomSlugs
  );
  return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
}
