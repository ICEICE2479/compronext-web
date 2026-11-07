import type { Product } from "./types";

/**
 * จับคู่ "สินค้ารุ่นเดียวกัน" จากหลายร้าน — ใช้รหัสรุ่น (คำที่มีตัวเลข/ชื่อรุ่นภาษาอังกฤษ) + หมวด
 * เช่น "GeForce RTX 4070 SUPER 12GB" กับ "การ์ดจอ RTX4070 Super Gaming OC" → rtx|4070|super
 */
const STOP = new Set([
  "the", "and", "for", "with", "new", "gaming", "edition", "black", "white", "silver", "grey", "gray", "pink", "blue", "red", "green",
  "oc", "pro", "plus", "series", "official", "store", "shop", "free", "ship", "ของแท้", "ประกัน", "ศูนย์", "ไทย", "ส่งฟรี", "พร้อมส่ง",
]);

const SPEC = /^\d+(gb|tb|mhz|ghz|hz|w|mm|cm|inch|in|k)$/;

export function modelKey(name: string): string | null {
  const s = name
    .toLowerCase()
    .replace(/(\d)\s*x\s*(\d)/g, "$1x$2") // ขนาด 117x55 ให้อยู่ติดกัน
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-wyz][a-z]{2,})/g, "$1 $2");
  const tokens = s.split(/[^a-z0-9x]+/).filter((w) => w.length >= 2 && !STOP.has(w));
  // ตัวเลขรุ่น = คำที่มีตัวเลข แต่ไม่ใช่สเปก (12gb, 165hz) หรือขนาด (117x55x176)
  const idx = tokens.findIndex((w) => /\d/.test(w) && !SPEC.test(w) && !/\dx\d/.test(w));
  if (idx < 0) return null;
  const core = [tokens[idx]];
  const before = tokens[idx - 1];
  const after = tokens[idx + 1];
  if (before && !/\d/.test(before)) core.push(before);
  if (after && !/\d/.test(after) && !SPEC.test(after)) core.push(after);
  const second = tokens.slice(idx + 1).find((w) => /\d/.test(w) && !SPEC.test(w) && !/\dx\d/.test(w));
  if (second) core.push(second);
  return core.sort().join("|");
}

export interface PriceOffer {
  id: string;
  name: string;
  storeName: string;
  price: number;
  buyUrl: string;
}

/** ร้านอื่นที่ขายรุ่นเดียวกัน (ราคาถูกสุดก่อน, ร้านละ 1 รายการ) */
export function sameModelOffers(product: Product, catalog: Product[], limit = 5): PriceOffer[] {
  const key = modelKey(product.name);
  if (!key) return [];
  const myStore = (product.storeName || product.platform || "").toLowerCase();
  const best = new Map<string, Product>();
  for (const p of catalog) {
    if (p.id === product.id || p.category !== product.category || p.status !== "available" || p.published === false) continue;
    const store = (p.storeName || p.platform || "").toLowerCase();
    if (!store || store === myStore) continue;
    if (modelKey(p.name) !== key) continue;
    const cur = best.get(store);
    if (!cur || p.price < cur.price) best.set(store, p);
  }
  return [...best.values()]
    .sort((a, b) => a.price - b.price)
    .slice(0, limit)
    .map((p) => ({ id: p.id, name: p.name, storeName: p.storeName || p.platform, price: p.price, buyUrl: p.buyUrl }));
}
