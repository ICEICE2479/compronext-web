import "server-only";
import { getAllCatalogProducts } from "@/lib/data/store";
import { extractProductBrand } from "@/lib/catalog-taxonomy";
import { extractSpecs, isComparable, partKind } from "@/lib/spec-extract";
import { isPlaceholderImage } from "@/lib/known-real-images";
import type { CompareItem } from "@/components/CompareClient";

/** ลิงก์ไปหน้าร้านจริง (ไม่ใช่หน้าค้น Google) */
const shopLink = (u: string | undefined) => /^https?:\/\//.test(u ?? "") && !/\/\/(www\.)?google\./.test(u ?? "");

/** รูปเดียวกันโผล่ในสินค้า ≥3 หมวด (เช่นรูปไมค์บนคีย์บอร์ด/เมาส์/หูฟัง) = รูปตัวอย่าง ไม่ใช่รูปจริง */
function stockImages(ps: Array<{ category: string; imageUrl: string | null; sourceImageUrl?: string | null }>): Set<string> {
  const cats = new Map<string, Set<string>>();
  for (const p of ps) {
    const k = p.sourceImageUrl || p.imageUrl;
    if (k) cats.set(k, (cats.get(k) ?? new Set()).add(p.category));
  }
  return new Set([...cats].filter(([, c]) => c.size >= 3).map(([u]) => u));
}

/** รายการสินค้าที่เทียบได้ (ข้อมูลย่อ) — ส่งผ่าน /api/compare-items แยกจากหน้า ให้หน้าเปิดไว
 *  เฉพาะของที่มีรูปจริง + ลิงก์ร้านจริง (ซ่อนสินค้าตัวอย่าง/เลิกขายที่ยังใช้รูปแทน) */
export function buildCompareItems(): CompareItem[] {
  const ps = getAllCatalogProducts().filter((p) => isComparable(p.category) && p.status === "available");
  const stock = stockImages(ps);
  return ps
    .filter((p) => {
      const img = p.sourceImageUrl || p.imageUrl;
      return shopLink(p.buyUrl) && !isPlaceholderImage(p.imageUrl) && !isPlaceholderImage(img) && !stock.has(img!);
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      imageUrl: p.imageUrl,
      ...(p.sourceImageUrl ? { sourceImageUrl: p.sourceImageUrl } : {}),
      store: p.storeName || p.platform,
      brand: extractProductBrand(p.name, p.category, p.platform),
      kind: partKind(p),
      specs: extractSpecs(p),
      hasBuyUrl: Boolean(p.buyUrl),
    }));
}
