import "server-only";
import type { RuntimeDatabase } from "@/lib/data/store";

/** ปิดการดันสินค้าที่หมดเวลา (เรียกจาก cron และตอนเปิดหลังบ้าน) — คืน true ถ้ามีการเปลี่ยน */
export function expireBoosts(db: RuntimeDatabase, now = Date.now()): boolean {
  let changed = false;
  for (const b of db.boosts) {
    if (b.status !== "active" || !b.endAt || Date.parse(b.endAt) > now) continue;
    b.status = "ended";
    changed = true;
    const stillBoosted = db.boosts.some((x) => x !== b && x.productId === b.productId && x.status === "active");
    const p = db.products.find((x) => x.id === b.productId);
    if (p && !stillBoosted) p.featured = false;
  }
  return changed;
}
