import { CATEGORY_IMPACT } from "@/lib/buy-plan";
import type { Product } from "@/lib/types";

/** ตัดให้อยู่ในงบ: เก็บชิ้นที่เปลี่ยนห้องมากก่อน แล้วคงลำดับเดิมของ AI */
export function capToBudget(products: Product[], budget: number | null): Product[] {
  if (!budget) return products;
  const impact = (p: Product) => CATEGORY_IMPACT[p.category] ?? 0;
  const ranked = products.map((p, i) => ({ p, i })).sort((a, b) => impact(b.p) - impact(a.p) || a.i - b.i);
  let remaining = budget;
  const keep = new Set<string>();
  for (const { p } of ranked) {
    if (p.price > remaining) continue;
    keep.add(p.id);
    remaining -= p.price;
  }
  return products.filter((p) => keep.has(p.id));
}

/** สร้างภาพใหม่จากชุดเดิม: เก็บเฉพาะชิ้นที่ยังขายอยู่และไม่อยู่ในหมวดที่มีแล้ว ตามลำดับ ids แล้วตัดตามงบ */
export function pickRegenerated(
  ids: string[],
  byId: Map<string, Product>,
  owned: Set<string>,
  budget: number | null
): Product[] {
  const kept = ids
    .map((id) => byId.get(id))
    .filter((p): p is Product => !!p && p.status === "available" && !owned.has(p.category));
  return capToBudget(kept, budget);
}
