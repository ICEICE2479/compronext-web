import type { Dimensions } from "./types";

/**
 * ดึงขนาดสินค้าจากชื่อ/รายละเอียด/สเปก (ข้อมูลร้านส่วนใหญ่เขียนขนาดไว้ในชื่อ)
 * รองรับ: "117x55x176 ซม." · "120 x 60 x 75 cm" · "W120 D60 H75" · "กว้าง 120 ลึก 60 สูง 75 ซม." · "160x200" (เตียง/พรม) · หน่วย มม./ม.
 * คืนเป็น ซม. หรือ null ถ้าไม่แน่ใจ (ไม่เดามั่ว)
 */
const UNIT: Record<string, number> = { mm: 0.1, "มม": 0.1, "มม.": 0.1, cm: 1, "ซม": 1, "ซม.": 1, "ซ.ม.": 1, m: 100, "ม.": 100, "เมตร": 100 };

function unitK(u: string | undefined, fallback: number): number {
  if (!u) return fallback;
  return UNIT[u.toLowerCase()] ?? fallback;
}

const clean = (n: number) => Math.round(n * 10) / 10;

/** ของทรงสูง: ถ้าเขียนแค่ 2 ค่า (เช่น IKEA "117x176 ซม.") = กว้าง × สูง */
const TALL = new Set(["wardrobe", "storage", "lighting", "fake_plant", "real_plant"]);
/** หมวดที่ชื่อมีตัวเลขสเปกเยอะ (1x16GB, 3x120) — รับเฉพาะที่มีหน่วยกำกับ */
const SPEC_HEAVY = new Set(["computer", "keyboard", "mouse", "headphone", "microphone", "webcam", "speaker"]);

export function extractDimensions(text: string, category?: string): Dimensions | null {
  const t = text.replace(/,/g, "").replace(/×|\*|X/g, "x");
  // 1) W/D/H หรือ กว้าง/ลึก/สูง
  const lab = (re: RegExp) => {
    const m = t.match(re);
    return m ? Number(m[1]) : null;
  };
  const W = lab(/(?:(?<![\w-])W|กว้าง)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const D = lab(/(?:(?<![\w-])D|(?<![\w-])L(?=\s*\d)|ลึก|ยาว)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const H = lab(/(?:(?<![\w-])H|สูง)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (W && D) {
    const u = t.match(/(?:สูง|H)\s*\d+(?:\.\d+)?\s*(mm|cm|m|มม\.?|ซม\.?|ม\.|เมตร)/i)?.[1] ?? t.match(/\d\s*(mm|cm|มม\.?|ซม\.?)/i)?.[1];
    const k = unitK(u, 1);
    return sane({ width: clean(W * k), depth: clean(D * k), height: H ? clean(H * k) : null, unit: "cm" });
  }
  // 2) AxBxC หน่วย (ต้องมีตัว x อย่างน้อย 1 ตัว)
  //    ไม่มีหน่วย: ต้องไม่ติดตัวอักษร (1x16GB = จำนวนแรม) · ทุกค่า ≥ 15 · ไม่ใช่อุปกรณ์คอม (ตัวเลขในชื่อรุ่น/สเปก)
  const re = /(?<![\w.])(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*(\d+(?:\.\d+)?))?\s*(mm|cm|m\b|มม\.?|ซม\.?|ซ\.ม\.|ม\.|เมตร)?/gi;
  const m = [...t.matchAll(re)].find((x) => {
    if (x[4]) return true;
    const after = t.slice((x.index ?? 0) + x[0].length);
    const vals = [x[1], x[2], x[3]].filter(Boolean).map(Number);
    return !/^[a-z0-9ก-๙]/i.test(after) && vals.every((v) => v >= 15) && !(category && SPEC_HEAVY.has(category));
  });
  if (!m) return null;
  const nums = [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null];
  // ไม่มีหน่วย: เดาแบบระวัง — ตัวเลขใหญ่ (≥ 300) น่าจะเป็น มม. · ขนาดจอ/ความละเอียด (1920x1080) ไม่ใช่ขนาดของ
  if (!m[4] && nums.some((n) => n !== null && n >= 1000)) return null;
  const k = unitK(m[4], nums.every((n) => n === null || n < 300) ? 1 : 0.1);
  const [a, b, c] = nums.map((n) => (n === null ? null : clean(n * k)));
  if (c === null && category && TALL.has(category)) return sane({ width: a, depth: null, height: b, unit: "cm" });
  return sane({ width: a, depth: b, height: c, unit: "cm" });
}

/** ตัดค่าที่เป็นไปไม่ได้สำหรับเฟอร์นิเจอร์/อุปกรณ์ (เล็กกว่า 1 ซม. หรือใหญ่กว่า 6 ม.) */
function sane(d: Dimensions): Dimensions | null {
  const v = [d.width, d.depth, d.height].filter((x): x is number => x !== null);
  if (v.length < 2 || v.some((x) => x < 1 || x > 600)) return null;
  return d;
}
