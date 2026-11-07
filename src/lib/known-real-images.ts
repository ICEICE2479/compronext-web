import data from "./data/real-images.json";

/**
 * รูปจริงที่เก็บมาจากหน้าสินค้าของร้าน (og:image) สำหรับสินค้าที่เคยใช้รูปแทน (รูปเคสตัวเดียวกันทั้งร้าน / รูปวาด)
 * ใช้ตอนอ่านฐานข้อมูล → ขึ้นเว็บทันทีโดยไม่ต้องรอ cron
 */
const MAP = data.map as Record<string, string>;
const FROM = new Set<string>(data.from);
const ILLUSTRATION = /^\/(furniture|lighting)\//;

export function knownRealImage(p: { id: string; imageUrl?: string | null; sourceImageUrl?: string | null }): string | null {
  const real = MAP[p.id];
  if (!real) return null;
  const u = p.imageUrl ?? "";
  if (!u || ILLUSTRATION.test(u) || FROM.has(u) || (p.sourceImageUrl && FROM.has(p.sourceImageUrl))) return real;
  return null;
}

/** ยังเป็นรูปแทน (รูปเดียวกันทั้งร้าน / รูปวาด) — ไม่ใช่รูปจริงของชิ้นนั้น */
export function isPlaceholderImage(url: string | null | undefined): boolean {
  return !url || ILLUSTRATION.test(url) || FROM.has(url);
}
