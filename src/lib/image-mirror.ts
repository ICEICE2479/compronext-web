import "server-only";
import { readDb, writeDb } from "@/lib/data/store";
import { cutoutProductImage } from "@/lib/image-cutout";
import { fetchPublicBytes } from "@/lib/safe-fetch";
import { isReadOnlyServerless, saveUpload } from "@/lib/storage";
import { isOwnStorageUrl } from "@/lib/own-storage";

/**
 * เก็บรูปสินค้าจากเว็บร้าน → ตัดพื้นหลัง → เก็บในที่เก็บไฟล์ของเรา (Vercel Blob / เครื่อง)
 * รูปไม่หายเมื่อร้านเปลี่ยนลิงก์ และโหลดเร็ว (ไม่ต้องตัดพื้นหลังใหม่ทุกครั้งที่เซิร์ฟเวอร์รีสตาร์ท)
 */
const RETRY_MS = 7 * 24 * 3_600_000;

export function mirrorPending(): number {
  return readDb().products.filter((p) => needsMirror(p.imageUrl)).length;
}

function needsMirror(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//.test(url) && !isOwnStorageUrl(url);
}

function retryable(p: { imageMirrorFailedAt?: string }, now: number) {
  return !p.imageMirrorFailedAt || now - Date.parse(p.imageMirrorFailedAt) > RETRY_MS;
}

export async function mirrorBatch(opts: { limit?: number; budgetMs?: number } = {}): Promise<{ done: number; failed: number; left: number; error?: string }> {
  if (isReadOnlyServerless() && !process.env.BLOB_READ_WRITE_TOKEN) return { done: 0, failed: 0, left: mirrorPending(), error: "ยังไม่ได้ตั้ง BLOB_READ_WRITE_TOKEN" };
  const limit = opts.limit ?? 20;
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const db = readDb();
  const now = Date.now();
  const todo = db.products.filter((p) => needsMirror(p.imageUrl) && retryable(p, now)).slice(0, limit);
  const updates = new Map<string, { imageUrl: string; sourceImageUrl: string }>();
  const failedIds = new Set<string>();
  // ทีละ 4 รูปพร้อมกัน ไม่ถล่มเว็บร้าน
  for (let i = 0; i < todo.length && Date.now() < deadline; i += 4) {
    await Promise.all(
      todo.slice(i, i + 4).map(async (p) => {
        try {
          const src = await fetchPublicBytes(p.imageUrl!, 8 * 1024 * 1024, 12_000);
          if (!src) throw new Error("fetch");
          const { buffer } = await cutoutProductImage(src.bytes);
          const saved = await saveUpload(buffer, "image", "products");
          updates.set(p.id, { imageUrl: saved.url, sourceImageUrl: p.imageUrl! });
        } catch {
          failedIds.add(p.id);
        }
      })
    );
  }
  if (updates.size || failedIds.size) {
    // อ่านใหม่ก่อนเขียน กันทับการแก้ไขที่เกิดระหว่างรอ
    const fresh = readDb();
    const at = new Date().toISOString();
    for (const p of fresh.products) {
      const u = updates.get(p.id);
      if (u && p.imageUrl === u.sourceImageUrl) {
        Object.assign(p, u);
        delete p.imageMirrorFailedAt;
      } else if (failedIds.has(p.id)) p.imageMirrorFailedAt = at;
    }
    writeDb(fresh);
  }
  return { done: updates.size, failed: failedIds.size, left: mirrorPending() };
}
