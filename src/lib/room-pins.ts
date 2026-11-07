import "server-only";
import { readDb, writeDb } from "@/lib/data/store";
import { detectObjects } from "@/lib/ai-room";
import { snapSpotsToDetections, type Spot } from "@/lib/hotspots";
import { siteUrl } from "@/lib/seo";

/**
 * จุดตัวเลขบนรูปห้อง (ไอเดียห้อง): ตรวจหาของจริงในรูปด้วย AI แล้ววางจุดลงบนของ (จอ คีย์บอร์ด เมาส์ เก้าอี้ โต๊ะ ต้นไม้ ...)
 * ของที่ตรวจไม่เจอใช้ตำแหน่งเดิม · ทำห้องละครั้ง (pinsDetectedAt)
 */
type RoomWithPins = { pinsDetectedAt?: string };

export function roomPinsPending(): number {
  return readDb().rooms.filter((r) => !(r as RoomWithPins).pinsDetectedAt && r.images.length > 0 && r.items.length > 0).length;
}

async function loadImage(src: string): Promise<Buffer | null> {
  const url = /^https?:\/\//.test(src) ? src : `${siteUrl()}${src.startsWith("/") ? "" : "/"}${src}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function detectRoomPins(opts: { limit?: number; budgetMs?: number } = {}): Promise<{ done: number; moved: number; left: number; error?: string }> {
  const limit = opts.limit ?? 10;
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  const db = readDb();
  const byId = new Map(db.products.map((p) => [p.id, p]));
  const todo = db.rooms.filter((r) => !(r as RoomWithPins).pinsDetectedAt && r.images.length > 0 && r.items.length > 0).slice(0, limit);
  let done = 0;
  let moved = 0;
  let error: string | undefined;
  for (const room of todo) {
    if (Date.now() > deadline) break;
    // ทีละรูปของห้อง (มุมที่ 1, 2, ...)
    for (let idx = 0; idx < room.images.length; idx++) {
      const items = room.items.filter((it) => (it.imageIndex ?? 0) === idx);
      if (!items.length) continue;
      const buf = await loadImage(room.images[idx]);
      if (!buf) continue;
      const dets = await detectObjects(buf);
      if (!dets) {
        error = "ตรวจรูปไม่ได้ (เช็ก CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN)";
        break;
      }
      const list = items.map((it) => ({ id: it.productId, category: byId.get(it.productId)?.category ?? "other" }));
      const base: Record<string, Spot> = Object.fromEntries(items.map((it) => [it.productId, { x: it.x ?? 50, y: it.y ?? 50 }]));
      const out = snapSpotsToDetections(list, base, dets);
      for (const it of items) {
        const s = out[it.productId];
        if (s && (s.x !== it.x || s.y !== it.y)) {
          it.x = s.x;
          it.y = s.y;
          moved++;
        }
      }
    }
    if (error) break;
    (room as RoomWithPins).pinsDetectedAt = new Date().toISOString();
    done++;
  }
  if (done) writeDb(db);
  return { done, moved, left: roomPinsPending(), error };
}
