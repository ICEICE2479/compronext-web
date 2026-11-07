import "server-only";
import type { RuntimeDatabase } from "@/lib/data/store";

/** ข้อมูลทั้งหมดของสมาชิกหนึ่งคน (สิทธิ์ขอรับข้อมูลตาม PDPA มาตรา 31) */
export function exportUserData(db: RuntimeDatabase, userId: string, email: string | null) {
  const e = email?.toLowerCase() ?? null;
  return {
    exportedAt: new Date().toISOString(),
    profile: db.users.find((u) => u.id === userId || (e && u.email.toLowerCase() === e)) ?? null,
    cart: db.carts[userId] ?? [],
    saved: db.saved[userId] ?? { rooms: [], builds: [] },
    priceWatches: db.priceWatches.filter((w) => w.userId === userId),
    reviews: db.reviews.filter((r) => r.userId === userId),
    chats: db.chats.filter((c) => c.userId === userId),
    designs: db.designs.filter((d) => d.userId === userId),
    communityPosts: db.community.filter((c) => c.userId === userId).map((c) => ({ ...c, reports: undefined, likes: undefined, likeCount: c.likes.length })),
    digest: db.digestSubs[userId] ?? null,
    pushDevices: (db.pushSubs[userId] ?? []).map((s) => ({ addedAt: s.at })),
    roomPlans: db.roomPlans[userId] ?? [],
    aiCredits: db.aiCredits[userId] ?? 0,
    creditOrders: db.creditOrders.filter((o) => o.userId === userId),
  };
}

/** ลบบัญชีและข้อมูลที่ผูกกับสมาชิก (สิทธิ์ขอลบตาม PDPA มาตรา 33) — คืนจำนวนรายการที่ลบ */
export function deleteUserData(db: RuntimeDatabase, userId: string, email: string | null): number {
  const e = email?.toLowerCase() ?? null;
  let n = 0;
  const drop = <T>(list: T[], hit: (x: T) => boolean) => {
    const keep = list.filter((x) => !hit(x));
    n += list.length - keep.length;
    return keep;
  };
  db.users = drop(db.users, (u) => u.id === userId || (!!e && u.email.toLowerCase() === e));
  db.priceWatches = drop(db.priceWatches, (w) => w.userId === userId);
  db.reviews = drop(db.reviews, (r) => r.userId === userId);
  db.chats = drop(db.chats, (c) => c.userId === userId);
  db.designs = drop(db.designs, (d) => d.userId === userId);
  db.community = drop(db.community, (c) => c.userId === userId);
  for (const c of db.community) {
    c.likes = c.likes.filter((x) => x !== userId);
    c.reports = c.reports.filter((x) => x !== userId);
  }
  for (const map of [db.carts, db.saved, db.pushSubs, db.digestSubs, db.roomPlans] as Array<Record<string, unknown>>) {
    if (userId in map) {
      delete map[userId];
      n++;
    }
  }
  return n;
}
