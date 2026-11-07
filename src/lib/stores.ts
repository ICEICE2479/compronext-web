import "server-only";
import { readDb, type ChatThreadRecord, type PartnerRecord, type RuntimeDatabase } from "@/lib/data/store";

/** คีย์ร้านใน URL: ตัวอักษร/ตัวเลขทุกภาษา คั่นด้วย - */
export function storeKeyOf(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface StoreInfo {
  key: string;
  name: string;
  productCount: number;
  partner: PartnerRecord | null;
}

export interface RatingSummary {
  avg: number;
  count: number;
  /** จำนวนรีวิวของดาว 1..5 (index 0 = 1 ดาว) */
  dist: number[];
}

export function listStores(db: RuntimeDatabase = readDb()): StoreInfo[] {
  const map = new Map<string, StoreInfo>();
  for (const p of db.products) {
    if (p.published === false) continue;
    const name = (p.storeName || p.platform || "").trim();
    if (!name) continue;
    const key = storeKeyOf(name);
    const cur = map.get(key);
    if (cur) cur.productCount++;
    else map.set(key, { key, name, productCount: 1, partner: null });
  }
  for (const partner of db.partners) {
    if (!partner.active) continue;
    const key = storeKeyOf(partner.name);
    const cur = map.get(key);
    if (cur) cur.partner = partner;
    else map.set(key, { key, name: partner.name, productCount: 0, partner });
  }
  return [...map.values()].sort((a, b) => b.productCount - a.productCount);
}

export function getStore(key: string, db: RuntimeDatabase = readDb()): StoreInfo | null {
  return listStores(db).find((s) => s.key === key) ?? null;
}

export function ratingSummary(key: string, db: RuntimeDatabase = readDb()): RatingSummary {
  const list = db.reviews.filter((r) => r.storeKey === key);
  const dist = [0, 0, 0, 0, 0];
  for (const r of list) dist[Math.min(5, Math.max(1, r.rating)) - 1]++;
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return { avg: Math.round(avg * 10) / 10, count: list.length, dist };
}

/** ร้านพาร์ตเนอร์ของผู้ใช้ (ถ้าเป็น) → ใช้ตอบรีวิว/แชท */
export function partnerStoreKey(partner: PartnerRecord | null): string | null {
  return partner ? storeKeyOf(partner.name) : null;
}

export function unreadFor(thread: ChatThreadRecord, side: "user" | "store"): number {
  const last = side === "user" ? thread.userLastRead : thread.storeLastRead;
  const other = side === "user" ? "store" : "user";
  return thread.messages.filter((m) => m.from === other && m.at > last).length;
}
