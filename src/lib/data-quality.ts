import type { Product } from "@/lib/types";
import { isSafeHttpUrl } from "@/lib/links";

export type IssueKey = "sample" | "noImage" | "stale" | "badLink" | "duplicate" | "priceOutlier" | "noDescription" | "outOfStock";
export const ISSUE_LABELS: Record<IssueKey, string> = {
  sample: "ข้อมูลทดลอง (ยังไม่ตรวจกับร้านจริง)",
  noImage: "ไม่มีรูป",
  stale: "ราคาเก่าเกิน 30 วัน",
  badLink: "ลิงก์ร้านใช้ไม่ได้/ไม่ปลอดภัย",
  duplicate: "ชื่อซ้ำกับสินค้าอื่น",
  priceOutlier: "ราคาผิดปกติ (เทียบหมวดเดียวกัน)",
  noDescription: "ไม่มีคำอธิบาย",
  outOfStock: "หมดสต็อก (ยังเผยแพร่อยู่)",
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ]/gu, "").trim();

/** ตรวจคุณภาพข้อมูลสินค้า — คืนรายการปัญหาต่อหัวข้อ (เฉพาะสินค้าที่เผยแพร่อยู่) */
export function auditProducts(products: Product[], now = Date.now()): Record<IssueKey, Product[]> {
  const live = products.filter((p) => p.published !== false);
  const out = Object.fromEntries(Object.keys(ISSUE_LABELS).map((k) => [k, [] as Product[]])) as Record<IssueKey, Product[]>;
  const byName = new Map<string, Product[]>();
  const byCat = new Map<string, number[]>();
  for (const p of live) {
    const n = norm(p.name);
    byName.set(n, [...(byName.get(n) ?? []), p]);
    byCat.set(p.category, [...(byCat.get(p.category) ?? []), p.price]);
  }
  const median = new Map([...byCat].map(([c, list]) => [c, [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)]]));
  for (const p of live) {
    if (p.isSample) out.sample.push(p);
    if (!p.imageUrl) out.noImage.push(p);
    const checked = Date.parse(p.priceCheckedAt ?? p.priceUpdatedAt ?? "");
    if (!checked || now - checked > 30 * 86_400_000) out.stale.push(p);
    if (!isSafeHttpUrl(p.buyUrl)) out.badLink.push(p);
    if ((byName.get(norm(p.name))?.length ?? 0) > 1) out.duplicate.push(p);
    const m = median.get(p.category) ?? 0;
    if (p.price <= 0 || ((byCat.get(p.category)?.length ?? 0) >= 8 && m > 0 && (p.price > m * 15 || p.price < m / 15))) out.priceOutlier.push(p);
    if (!p.description || p.description.trim().length < 10) out.noDescription.push(p);
    if (p.status !== "available") out.outOfStock.push(p);
  }
  return out;
}
