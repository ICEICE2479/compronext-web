import type { Product } from "@/lib/types";
import type { RoomSwap } from "@/components/RoomSavings";
import { MACRO_CATEGORIES } from "@/lib/catalog-taxonomy";

/** คำที่บอก "ชนิดย่อย" เพิ่มจากหมวดย่อยของแคตตาล็อก (กันสลับข้ามประเภท เช่น MacBook → โน้ตบุ๊กเกมมิ่ง) */
const EXTRA_KINDS: Array<[string, string[]]> = [
  ["macbook", ["macbook"]],
  ["gaming-laptop", ["gaming", "เกมมิ่ง", "rog", "legion", "omen", "tuf", "nitro", "predator", "katana"]],
  ["standing-desk", ["ปรับระดับ", "standing", "ยืน", "ไฟฟ้า"]],
  ["wireless", ["wireless", "ไร้สาย", "bluetooth"]],
  ["mechanical", ["mechanical", "แมคคานิคอล"]],
  ["table-lamp", ["table lamp", "desk lamp", "โคมไฟตั้งโต๊ะ", "โคมไฟโต๊ะ", "โคมไฟอ่านหนังสือ"]],
  ["floor-lamp", ["floor lamp", "โคมไฟตั้งพื้น", "โคมไฟพื้น"]],
  ["mirror", ["mirror", "กระจกเงา", "กระจกตั้งพื้น"]],
  ["kids", ["เด็ก", "kids", "children"]],
  ["ergonomic", ["ergonomic", "เออร์โกโนมิก", "สุขภาพ"]],
];

/** ชนิดย่อยของสินค้า (หมวดย่อยแคตตาล็อก + คำบอกชนิด) */
export function productKinds(p: Product): Set<string> {
  const hay = `${p.name} ${p.description}`.toLowerCase();
  const kinds = new Set<string>();
  for (const m of MACRO_CATEGORIES) {
    if (!m.mappedCategories.includes(p.category)) continue;
    for (const s of m.subcategories) if (s.keywords.some((k) => hay.includes(k.toLowerCase()))) kinds.add(s.slug);
  }
  for (const [k, words] of EXTRA_KINDS) if (words.some((w) => hay.includes(w))) kinds.add(k);
  return kinds;
}

/** ต้องระบุชนิดได้ทั้งคู่ และชนิดตรงกันทุกตัว — ถ้าระบุไม่ได้ ไม่เสนอสลับ (กันแนะนำของผิดประเภท) */
const sameKinds = (a: Set<string>, b: Set<string>) => a.size > 0 && a.size === b.size && [...a].every((k) => b.has(k));
/** ขนาดใกล้กัน (±25%) เมื่อมีข้อมูลขนาดทั้งคู่ — สำคัญกับโต๊ะ/ชั้น/ตู้ที่ต้องวางในที่เดิม */
function similarSize(a: Product, b: Product): boolean {
  const wa = a.dimensions?.width;
  const wb = b.dimensions?.width;
  if (!wa || !wb || a.dimensions?.unit !== b.dimensions?.unit) return true;
  return Math.abs(wa - wb) / wa <= 0.25;
}

/**
 * หาตัวแทนที่ถูกกว่าในห้อง: หมวดเดียวกัน + ชนิดย่อยเดียวกัน + ขนาดใกล้กัน + มีสีตรงกัน
 * ราคา 45–80% ของเดิม เลือกตัวที่แพงสุดในกลุ่มนั้น (คุณภาพใกล้ของเดิมที่สุด)
 */
export function findCheaperSwaps(items: Array<{ product: Product; quantity: number }>, catalog: Product[]) {
  const used = new Set(items.map((i) => i.product.id));
  const swaps: RoomSwap[] = [];
  const keep: Array<{ product: Product; quantity: number }> = [];
  for (const it of items) {
    const p = it.product;
    const kinds = productKinds(p);
    const alt = catalog
      .filter((c) => c.status === "available" && !used.has(c.id) && c.category === p.category && c.price <= p.price * 0.8 && c.price >= p.price * 0.45)
      .filter((c) => !p.colors.length || c.colors.some((x) => p.colors.includes(x)))
      .filter((c) => sameKinds(kinds, productKinds(c)) && similarSize(p, c))
      .sort((a, b) => b.price - a.price)[0];
    if (alt) {
      swaps.push({ original: p, alt, quantity: it.quantity });
      used.add(alt.id);
    } else keep.push(it);
  }
  swaps.sort((a, b) => (b.original.price - b.alt.price) * b.quantity - (a.original.price - a.alt.price) * a.quantity);
  for (const s of swaps.slice(6)) keep.push({ product: s.original, quantity: s.quantity });
  return { swaps: swaps.slice(0, 6), keep };
}
