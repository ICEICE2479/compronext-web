import "server-only";
import crypto from "node:crypto";
import type { RuntimeDatabase } from "@/lib/data/store";
import { getSecret } from "@/lib/auth";
import { formatTHB } from "@/lib/format";
import { siteUrl } from "@/lib/seo";

/** ลิงก์ยกเลิกรับอีเมล (เซ็นด้วย HMAC ไม่ต้องล็อกอิน) */
export function unsubscribeToken(userId: string): string {
  return crypto.createHmac("sha256", `digest:${getSecret()}`).update(userId).digest("base64url").slice(0, 24);
}
export function verifyUnsubscribe(userId: string, token: string): boolean {
  const a = Buffer.from(unsubscribeToken(userId));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** เนื้อหาอีเมลสรุปรายสัปดาห์ของสมาชิกหนึ่งคน (null = ไม่มีอะไรใหม่ ไม่ต้องส่ง) */
export function buildDigest(db: RuntimeDatabase, userId: string) {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const byId = new Map(db.products.map((p) => [p.id, p]));
  const lines: string[] = [];
  for (const w of db.priceWatches.filter((x) => x.userId === userId)) {
    const p = byId.get(w.productId);
    const hist = p?.priceHistory?.filter((h) => h.d >= since) ?? [];
    if (!p || hist.length === 0) continue;
    const before = p.priceHistory!.filter((h) => h.d < since).at(-1)?.p ?? hist[0].p;
    if (p.price < before) lines.push(`ลดราคา: ${p.name.slice(0, 60)} เหลือ ${formatTHB(p.price)} (จาก ${formatTHB(before)}) — ${siteUrl()}/products/${p.id}`);
  }
  const rooms = db.rooms.filter((r) => (r.createdAt ?? "") >= since).slice(0, 3);
  for (const r of rooms) lines.push(`ห้องใหม่: ${r.name} — ${siteUrl()}/rooms/${r.slug}`);
  const posts = db.community
    .filter((c) => c.status === "visible" && c.createdAt >= since)
    .sort((a, b) => b.likes.length - a.likes.length)
    .slice(0, 3);
  for (const c of posts) lines.push(`ชุมชนชอบ: ${c.title} (${c.likes.length} ถูกใจ) — ${siteUrl()}/community/${c.id}`);
  if (!lines.length) return null;
  return lines;
}
