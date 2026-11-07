import type { ProductCategory } from "@/lib/types";

/**
 * "ซื้ออะไรก่อน" — แบ่งรายการเป็น ควรซื้อก่อน / ซื้อทีหลังได้ ตามผลต่อห้องและงบ
 * ใช้ได้ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์ (pure function)
 */

/** ของที่ผู้ใช้มีอยู่แล้ว (เลือกได้หลายอย่าง) */
export const OWNED_OPTIONS: Array<{ category: ProductCategory; label: string }> = [
  { category: "keyboard", label: "คีย์บอร์ด" },
  { category: "lighting", label: "โคมไฟ" },
  { category: "mouse", label: "เมาส์" },
  { category: "monitor", label: "จอ" },
  { category: "desk", label: "โต๊ะ" },
  { category: "chair", label: "เก้าอี้" },
  { category: "headphone", label: "หูฟัง" },
];

/** 1–10: ชิ้นนี้เปลี่ยนหน้าตา/การใช้งานห้องได้มากแค่ไหน */
export const CATEGORY_IMPACT: Partial<Record<ProductCategory, number>> = {
  desk: 10,
  chair: 9,
  lighting: 8,
  monitor: 8,
  bed: 7,
  computer: 7,
  monitor_arm: 6,
  storage: 6,
  rug: 6,
  wardrobe: 5,
  keyboard: 5,
  real_plant: 4,
  mouse: 4,
  headphone: 4,
  speaker: 4,
  fake_plant: 3,
  decor: 3,
  webcam: 3,
  microphone: 3,
  other: 3,
  plant_pot: 2,
  mousepad: 2,
  keyboard_pad: 2,
};

const FIRST_MIN_IMPACT = 6;

const DEFAULT_REASON: Partial<Record<ProductCategory, string>> = {
  desk: "โต๊ะคือฐานของห้อง เปลี่ยนแล้วเห็นผลทันที",
  chair: "นั่งทุกวัน ช่วยเรื่องท่านั่งและความสบาย",
  lighting: "แสงดีห้องดูดีขึ้นทันที และถนอมสายตา",
  monitor: "จอใหม่เปลี่ยนการใช้งานและหน้าตาโต๊ะมาก",
  bed: "ชิ้นใหญ่ในห้อง เปลี่ยนบรรยากาศได้มาก",
  computer: "หัวใจของการใช้งาน ถ้ายังไม่มีควรซื้อก่อน",
  monitor_arm: "เพิ่มพื้นที่โต๊ะ ปรับระดับจอได้",
  storage: "ช่วยให้ห้องเป็นระเบียบ ดูโล่งขึ้น",
  rug: "ผืนเดียวเปลี่ยนโทนห้องได้",
  wardrobe: "ช่วยเก็บของ แต่รอได้ถ้ายังมีที่เก็บ",
  keyboard: "ใช้ทุกวัน แต่ของเดิมยังใช้ต่อได้",
  real_plant: "เพิ่มความสดชื่น ซื้อเพิ่มทีหลังได้",
  mouse: "อัปเกรดได้ทีหลัง ถ้าของเดิมยังใช้ได้",
  headphone: "ซื้อทีหลังได้ ไม่ค่อยเปลี่ยนหน้าตาห้อง",
  speaker: "เสริมความบันเทิง ซื้อทีหลังได้",
  fake_plant: "ของแต่งเพิ่มบรรยากาศ ค่อยเติมทีหลัง",
  decor: "ของแต่งเพิ่มบรรยากาศ ค่อยเติมทีหลัง",
  webcam: "ซื้อเมื่อจำเป็นต้องใช้งาน",
  microphone: "ซื้อเมื่อจำเป็นต้องใช้งาน",
  other: "ของเสริม ค่อยซื้อทีหลังได้",
  plant_pot: "ของแต่งชิ้นเล็ก ค่อยเติมทีหลัง",
  mousepad: "ชิ้นเล็ก ราคาไม่แพง ค่อยเติมทีหลัง",
  keyboard_pad: "ชิ้นเล็ก ค่อยเติมทีหลัง",
};

const UNKNOWN_REASON = "ของที่คุณเลือกไว้";

export interface PlanInput {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  category?: string;
}

export interface PlanItem {
  id: string;
  name: string;
  category: string | null;
  price: number;
  quantity: number;
  reason: string;
}

export interface BuyPlan {
  first: PlanItem[];
  later: PlanItem[];
  total: number;
  firstTotal: number;
  budget: number | null;
  overBudget: number;
}

function impactOf(category: string | undefined): number | null {
  if (!category) return null;
  return (CATEGORY_IMPACT as Record<string, number | undefined>)[category] ?? null;
}

export function planPurchases(items: PlanInput[], budget: number | null, reasons?: Record<string, string>): BuyPlan {
  const cap = typeof budget === "number" && Number.isFinite(budget) && budget > 0 ? budget : null;
  const rows = items.map((it, index) => {
    const impact = impactOf(it.category);
    const quantity = Math.max(1, Math.floor(it.quantity ?? 1) || 1);
    const price = Number.isFinite(it.price) && it.price > 0 ? it.price : 0;
    const item: PlanItem = {
      id: it.id,
      name: it.name,
      category: it.category || null,
      price,
      quantity,
      reason:
        reasons?.[it.id] ??
        (impact === null ? UNKNOWN_REASON : (DEFAULT_REASON as Record<string, string | undefined>)[it.category!] ?? UNKNOWN_REASON),
    };
    return { item, impact, index, cost: price * quantity };
  });
  // หมวดไม่รู้จัก: ถือว่าต้องซื้อ (ไม่ย้ายไปซื้อทีหลัง) และเรียงเหมือน impact ขั้นต่ำของกลุ่มซื้อก่อน
  rows.sort((a, b) => (b.impact ?? FIRST_MIN_IMPACT) - (a.impact ?? FIRST_MIN_IMPACT) || a.index - b.index);

  let remaining = cap ?? Number.POSITIVE_INFINITY;
  const first: typeof rows = [];
  const later: typeof rows = [];
  for (const row of rows) {
    if (row.impact === null) {
      first.push(row);
      remaining -= row.cost;
    } else if (row.impact >= FIRST_MIN_IMPACT && row.cost <= remaining) {
      first.push(row);
      remaining -= row.cost;
    } else {
      later.push(row);
    }
  }
  if (first.length === 0 && later.length > 0) first.push(later.shift()!);

  const total = rows.reduce((s, r) => s + r.cost, 0);
  const firstTotal = first.reduce((s, r) => s + r.cost, 0);
  return {
    first: first.map((r) => r.item),
    later: later.map((r) => r.item),
    total,
    firstTotal,
    budget: cap,
    overBudget: cap === null ? 0 : Math.max(0, total - cap),
  };
}
