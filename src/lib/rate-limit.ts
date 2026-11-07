import "server-only";

/**
 * จำกัดจำนวนครั้งต่อช่วงเวลา (กันสแปมรีวิว/ข้อความ/สร้างภาพ)
 * เก็บในหน่วยความจำของเซิร์ฟเวอร์ — พอสำหรับเซิร์ฟเวอร์เดียว/serverless ต่อ instance
 */
type Bucket = { hits: number[] };
const g = globalThis as unknown as { __cnRate?: Map<string, Bucket> };
const store: Map<string, Bucket> = (g.__cnRate ??= new Map<string, Bucket>());

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = store.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= max) {
    store.set(key, b);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - b.hits[0])) / 1000) };
  }
  b.hits.push(now);
  store.set(key, b);
  if (store.size > 20000) for (const [k, v] of store) if (!v.hits.some((t) => now - t < 3_600_000)) store.delete(k);
  return { ok: true, retryAfter: 0 };
}

/** IP ของผู้ใช้ (หลัง proxy) */
export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
