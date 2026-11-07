import "server-only";
import { readDb, writeDb } from "@/lib/data/store";
import { fetchPublicBytes } from "@/lib/safe-fetch";
import type { Product } from "@/lib/types";
import { pickImageFromHtml } from "@/lib/real-image-parse";

/**
 * สินค้าที่ยังใช้รูปวาด (/furniture, /lighting) → เปิดหน้าสินค้าของร้าน (buyUrl) อ่านรูปหลัก (og:image / JSON-LD)
 * แล้วเปลี่ยนเป็นรูปจริง · จากนั้นงานเก็บรูป (image-mirror) จะตัดพื้นหลัง + เก็บเข้า Blob ให้เอง
 */
const RETRY_MS = 7 * 24 * 3_600_000;
const ILLUSTRATION = /^\/(furniture|lighting)\//;

export function isIllustration(url: string | null | undefined): boolean {
  return !!url && ILLUSTRATION.test(url);
}

/** รูปที่สินค้าหลายชิ้น (≥3) ใช้ร่วมกัน = รูปแทน ไม่ใช่รูปจริงของชิ้นนั้น */
function sharedImages(products: Product[]): Set<string> {
  const n = new Map<string, number>();
  for (const p of products) if (p.imageUrl) n.set(p.imageUrl, (n.get(p.imageUrl) ?? 0) + 1);
  return new Set([...n].filter(([, c]) => c >= 3).map(([u]) => u));
}

/** หน้าร้านที่เปิดอ่านรูปได้ (ลิงก์ค้นหา Google เปิดไม่ได้) */
const shopPage = (u: string | undefined) => /^https?:\/\//.test(u ?? "") && !/\/\/(www\.)?google\./.test(u ?? "");

function needsReal(p: Product, shared: Set<string>): boolean {
  return shopPage(p.buyUrl) && (isIllustration(p.imageUrl) || (!!p.imageUrl && shared.has(p.imageUrl)));
}

export function realImagePending(): number {
  const ps = readDb().products;
  const shared = sharedImages(ps);
  return ps.filter((p) => needsReal(p, shared)).length;
}

export async function findRealImagesBatch(opts: { limit?: number; budgetMs?: number } = {}): Promise<{ done: number; failed: number; left: number }> {
  const limit = opts.limit ?? 30;
  const deadline = Date.now() + (opts.budgetMs ?? 40_000);
  const now = Date.now();
  const db = readDb();
  const shared = sharedImages(db.products);
  const todo = db.products
    .filter(
      (p) =>
        needsReal(p, shared) &&
        (!p.realImageFailedAt || now - Date.parse(p.realImageFailedAt) > RETRY_MS)
    )
    .slice(0, limit);
  const found = new Map<string, string>();
  const failed = new Set<string>();
  for (let i = 0; i < todo.length && Date.now() < deadline; i += 3) {
    await Promise.all(
      todo.slice(i, i + 3).map(async (p: Product) => {
        const page = await fetchPublicBytes(p.buyUrl!, 4 * 1024 * 1024, 10_000).catch(() => null);
        const img = page ? pickImageFromHtml(page.bytes.toString("utf8"), p.buyUrl!) : null;
        if (img) found.set(p.id, img);
        else failed.add(p.id);
      })
    );
  }
  if (found.size || failed.size) {
    const fresh = readDb();
    const at = new Date().toISOString();
    for (const p of fresh.products) {
      const img = found.get(p.id);
      if (img && (isIllustration(p.imageUrl) || (p.imageUrl && shared.has(p.imageUrl)))) {
        p.illustrationUrl = p.imageUrl ?? undefined;
        p.imageUrl = img;
        delete p.realImageFailedAt;
        delete p.imageMirrorFailedAt;
      } else if (failed.has(p.id)) p.realImageFailedAt = at;
    }
    writeDb(fresh);
  }
  const after = readDb().products;
  const sharedNow = sharedImages(after);
  const left = after.filter((p) => needsReal(p, sharedNow) && !p.realImageFailedAt).length;
  return { done: found.size, failed: failed.size, left };
}
