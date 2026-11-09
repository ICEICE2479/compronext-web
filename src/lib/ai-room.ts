import "server-only";
import { isSpot, snapSpotsToDetections, type Detection, type Spot } from "@/lib/hotspots";
import fs from "node:fs/promises";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { Product, ProductCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/format";
import { fetchPublicBytes } from "@/lib/safe-fetch";
import { LOCAL_UPLOAD_DIR } from "@/lib/storage";
import { readDb } from "@/lib/data/store";

/**
 * AI จัดห้อง: วิเคราะห์รูปห้อง + ข้อความลูกค้า → เลือกสินค้าจากร้านพาร์ตเนอร์ → สร้างภาพห้องที่จัดแล้ว
 *
 * - วิเคราะห์/เลือกสินค้า: Claude (ANTHROPIC_API_KEY) — ถ้าไม่มีคีย์ใช้ตัวจับคำสำคัญแทน
 * - สร้างภาพ: Gemini image (GEMINI_API_KEY) — ถ้าไม่มีคีย์จะไม่สร้างภาพ แต่ยังแนะนำสินค้าได้
 */

export interface RoomAnalysis {
  roomType: string;
  styleSummary: string;
  picks: Array<{ id: string; reason: string; spot?: Spot | null }>;
  tips: string[];
}

export const AI_TEXT_MODEL = process.env.AI_TEXT_MODEL || "claude-sonnet-5-5";
export const AI_IMAGE_MODEL = process.env.AI_IMAGE_MODEL || "gemini-2.5-flash-image";

const FURNISHING_CATEGORIES: ProductCategory[] = [
  "desk", "chair", "monitor", "lighting", "storage", "rug", "fake_plant", "decor",
  "bed", "wardrobe", "monitor_arm", "keyboard", "mouse", "mousepad", "speaker", "headphone",
  "real_plant", "plant_pot",
] as ProductCategory[];

const CATEGORY_KEYWORDS: Array<[RegExp, ProductCategory[]]> = [
  [/ห้องนอน|เตียง|นอน|bed/i, ["bed", "wardrobe", "desk", "chair", "lighting", "rug", "decor"] as ProductCategory[]],
  [/ทำงาน|โต๊ะ|work|office|desk|เรียน|อ่านหนังสือ|โปรดักทีฟ/i, ["desk", "chair", "monitor", "lighting", "storage", "rug", "fake_plant"] as ProductCategory[]],
  [/เกม|gaming|สตรีม|stream|ครีเอเตอร์|creator|ตัดต่อ/i, ["desk", "chair", "monitor", "lighting", "speaker", "keyboard", "mouse", "headphone", "rug"] as ProductCategory[]],
  [/มินิมอล|minimal|คลีน|สะอาดตา|โล่ง/i, ["desk", "chair", "monitor", "lighting", "storage", "rug", "fake_plant"] as ProductCategory[]],
  [/อบอุ่น|cozy|โทนส้ม|ไม้|ธรรมชาติ/i, ["desk", "chair", "lighting", "rug", "storage", "fake_plant", "decor"] as ProductCategory[]],
  [/สุขภาพ|ergonomic|ปวดหลัง|ปรับระดับ/i, ["desk", "chair", "monitor", "monitor_arm", "lighting", "rug"] as ProductCategory[]],
  [/ต้นไม้|plant|เขียว/i, ["fake_plant", "real_plant"] as ProductCategory[]],
  [/เก็บของ|ชั้น|ตู้|storage|shelf/i, ["storage", "wardrobe"] as ProductCategory[]],
  [/พรม|rug/i, ["rug"] as ProductCategory[]],
  [/ไฟ|โคม|แสง|light|rgb/i, ["lighting"] as ProductCategory[]],
  [/เก้าอี้|chair/i, ["chair"] as ProductCategory[]],
  [/จอ|monitor/i, ["monitor", "monitor_arm"] as ProductCategory[]],
  [/ตกแต่ง|แต่ง|decor/i, ["decor", "lighting", "rug"] as ProductCategory[]],
];

const COLOR_WORDS: Array<[RegExp, string[]]> = [
  [/ขาว|white|มินิมอล|minimal|คลีน/i, ["ขาว", "white", "ครีม", "เบจ"]],
  [/ดำ|black|มืด|ดาร์ก|เกม/i, ["ดำ", "black", "เทาเข้ม"]],
  [/ไม้|wood|โอ๊ค|oak|ธรรมชาติ|อบอุ่น|cozy/i, ["ไม้", "โอ๊ค", "wood", "oak", "บีช", "วอลนัท", "ธรรมชาติ"]],
  [/เทา|gray|grey/i, ["เทา", "gray", "grey"]],
  [/เบจ|beige|ครีม/i, ["เบจ", "beige", "ครีม"]],
  [/ชมพู|pink/i, ["ชมพู", "pink"]],
  [/ฟ้า|น้ำเงิน|blue/i, ["ฟ้า", "น้ำเงิน", "blue"]],
  [/เขียว|green/i, ["เขียว", "green"]],
];

/** ดึงงบประมาณจากข้อความ เช่น "งบ 30000", "3 หมื่น", "30k" */
export function parseBudget(text: string): number | null {
  const t = text.replace(/,/g, "");
  const man = t.match(/(\d+(?:\.\d+)?)\s*หมื่น/);
  if (man) return Math.round(Number(man[1]) * 10000);
  const sen = t.match(/(\d+(?:\.\d+)?)\s*แสน/);
  if (sen) return Math.round(Number(sen[1]) * 100000);
  const k = t.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return Math.round(Number(k[1]) * 1000);
  const n = t.match(/(?:งบ|budget|ไม่เกิน)\s*(\d{3,7})/i) || t.match(/(\d{4,7})\s*(?:บาท|฿)/);
  return n ? Number(n[1]) : null;
}

/** ลำดับความสำคัญของหมวดเฟอร์นิเจอร์หลัก เพื่อไม่ให้ได้แต่ของจุกจิก */
const ANCHOR_ORDER: Record<string, number> = {
  bed: 1,
  desk: 2,
  chair: 3,
  monitor: 4,
  wardrobe: 5,
  storage: 6,
  lighting: 7,
  rug: 8,
  speaker: 9,
  keyboard: 10,
  headphone: 11,
  mouse: 12,
  monitor_arm: 13,
  fake_plant: 14,
  real_plant: 15,
  decor: 16,
  mousepad: 17,
  plant_pot: 18,
};

/** คัดสินค้าที่เกี่ยวกับการแต่งห้องและพร้อมขาย เพื่อส่งให้ AI เลือก */
export function selectCandidates(products: Product[], prompt: string, limitPerCategory = 25): Product[] {
  const isBedroom = /ห้องนอน|เตียง|นอน|bed/i.test(prompt);
  const noRug = /ไม่เอาพรม|ไม่มีพรม|ไม่ต้องมีพรม/i.test(prompt);
  const noPlant = /ไม่เอาต้นไม้|ไม่มีต้นไม้/i.test(prompt);
  const wanted = new Set<ProductCategory>();
  for (const [re, cats] of CATEGORY_KEYWORDS) {
    if (re.test(prompt)) cats.forEach((c) => wanted.add(c));
  }
  // บังคับให้มีชุดเฟอร์นิเจอร์หลักครบเสมอ (โต๊ะ+เก้าอี้+ไฟ+ของแต่ง หรือ เตียง+โต๊ะ+เก้าอี้)
  const coreDefaults: ProductCategory[] = isBedroom
    ? ["bed", "wardrobe", "desk", "chair", "lighting", "rug", "fake_plant"]
    : ["desk", "chair", "monitor", "lighting", "storage", "rug", "fake_plant"];
  for (const c of coreDefaults) wanted.add(c);
  if (!isBedroom) {
    wanted.delete("bed");
    wanted.delete("wardrobe");
  }
  if (noRug) wanted.delete("rug");
  if (noPlant) {
    wanted.delete("fake_plant");
    wanted.delete("real_plant");
    wanted.delete("plant_pot");
  }

  const cats = Array.from(wanted).sort((a, b) => (ANCHOR_ORDER[a] ?? 99) - (ANCHOR_ORDER[b] ?? 99));
  const colorTerms = COLOR_WORDS.filter(([re]) => re.test(prompt)).flatMap(([, w]) => w);

  const out: Product[] = [];
  for (const cat of cats) {
    const pool = products
      .filter((p) => p.category === cat && p.status === "available" && p.published !== false && p.imageUrl && !ACCESSORY_RE.test(p.name))
      .map((p) => ({
        p,
        score:
          colorTerms.filter((w) => p.name.toLowerCase().includes(w.toLowerCase()) || p.colors?.some((c) => c.toLowerCase().includes(w.toLowerCase()))).length * 3 +
          (p.featured ? 1.5 : 0) +
          (p.dimensions?.width ? 1 : 0) +
          (p.modelUrl ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score || a.p.price - b.p.price)
      .slice(0, limitPerCategory)
      .map((x) => x.p);
    out.push(...pool);
  }
  return out;
}

// สัดส่วนงบโดยประมาณต่อหมวด (ใช้เลือกของชิ้นหลักแทนของจุกจิก)
const BUDGET_SHARE: Record<string, number> = {
  bed: 0.32, desk: 0.24, chair: 0.2, wardrobe: 0.22, monitor: 0.22, storage: 0.12, lighting: 0.07,
  rug: 0.07, decor: 0.05, monitor_arm: 0.06, keyboard: 0.06, mouse: 0.03, headphone: 0.06,
  fake_plant: 0.03, real_plant: 0.03, plant_pot: 0.02, speaker: 0.06, mousepad: 0.02,
};
// ชื่อที่บอกว่าเป็นอะไหล่/ของเสริม ไม่ใช่ชิ้นหลักของหมวด
const ACCESSORY_RE = /อะไหล่|ที่แบ่งช่อง|ปลอก|ไส้|ขาตั้งสำหรับ|เช็ดเท้า|ชุดต่อ|ตัวต่อ|ฝาปิด|บานพับ|มือจับ|ขา(?!ตั้ง)|กล่องเก็บของใต้|สายไฟ|รางปลั๊ก|แผ่นรองขา|หลอดไฟ|สวิตช์|คีย์แคป|keycap/i;

const REASON_BY_CAT: Record<string, string> = {
  desk: "โต๊ะหลักขนาดพอดีผนัง วางจอและอุปกรณ์ได้ไม่อึดอัด",
  chair: "เก้าอี้รองรับสรีระ นั่งทำงาน/เล่นเกมต่อเนื่องได้สบาย",
  monitor: "หน้าจอคมชัดขนาดเหมาะกับระยะสายตาบนโต๊ะ",
  lighting: "โคมไฟช่วยเพิ่มมิติแสงและถนอมสายตาเวลาใช้งาน",
  storage: "ชั้นวางช่วยจัดระเบียบของใช้ให้ห้องดูโปร่งสะอาดตา",
  rug: "พรมช่วยคุมโทนสีพื้นห้องและแบ่งโซนมุมโต๊ะให้ชัดเจน",
  fake_plant: "ต้นไม้ประดับช่วยเติมความสดชื่นและตัดโทนสีห้องให้ดูมีชีวิตชีวา",
  bed: "เตียงนอนดีไซน์เข้ากับโทนห้อง วางชิดผนังเปิดทางเดินโล่ง",
  wardrobe: "ตู้เสื้อผ้าขนาดกะทัดรัด เก็บของได้ครบโดยไม่กินพื้นที่",
  speaker: "ลำโพงตั้งโต๊ะดีไซน์คลีน ให้มิติเสียงครบทั้งทำงานและดูหนัง",
  keyboard: "คีย์บอร์ดขนาดกะทัดรัด ประหยัดพื้นที่บนโต๊ะ",
};

type PaletteGroup = "white-oak" | "dark" | "walnut" | "clean-white" | "neutral";

function detectProductPalette(p: Product): PaletteGroup {
  const text = `${p.name} ${(p.colors ?? []).join(" ")} ${(p.materials ?? []).join(" ")}`.toLowerCase();
  if (/วอลนัท|walnut|น้ำตาลเข้ม|ไม้เข้ม/.test(text)) return "walnut";
  if (/ดำ|black|ดาร์ก|charcoal|เทาเข้ม|คาร์บอน/.test(text)) return "dark";
  if (/ไม้|โอ๊ค|oak|บีช|beech|ธรรมชาติ|ครีม|เบจ|beige/.test(text)) return "white-oak";
  if (/ขาว|white/.test(text)) return "clean-white";
  return "neutral";
}

function paletteHarmonyScore(itemPalette: PaletteGroup, anchorPalette: PaletteGroup | null, isGamingPrompt: boolean): number {
  if (!anchorPalette || anchorPalette === "neutral" || itemPalette === "neutral") return 0;
  if (itemPalette === anchorPalette) return 2.4;
  if (
    (anchorPalette === "white-oak" && itemPalette === "clean-white") ||
    (anchorPalette === "clean-white" && itemPalette === "white-oak")
  ) {
    return 1.8;
  }
  if (
    (anchorPalette === "walnut" && itemPalette === "dark") ||
    (anchorPalette === "dark" && itemPalette === "walnut")
  ) {
    return 1.4;
  }
  if (!isGamingPrompt && (anchorPalette === "white-oak" || anchorPalette === "clean-white") && itemPalette === "dark") {
    return -1.5;
  }
  return -0.5;
}

/** เลือกสินค้าแบบคุมโทนเข้าชุดกัน (Cohesive Set): ยึดโทนสีจากโต๊ะ/เตียงหลักหรือของที่ลูกค้าล็อกไว้ */
export function heuristicAnalysis(
  candidates: Product[],
  prompt: string,
  budget: number | null,
  lockedProducts: Product[] = []
): RoomAnalysis {
  const colorTerms = COLOR_WORDS.filter(([re]) => re.test(prompt)).flatMap(([, w]) => w);
  const isGamingPrompt = /เกม|gaming|สตรีม|rgb|ดำ|ดาร์ก/i.test(prompt);
  const byCat = new Map<string, Product[]>();
  for (const p of candidates) (byCat.get(p.category) ?? byCat.set(p.category, []).get(p.category)!).push(p);

  const sortedCats = Array.from(byCat.keys()).sort((a, b) => (ANCHOR_ORDER[a] ?? 99) - (ANCHOR_ORDER[b] ?? 99));
  let remaining = budget ?? Number.POSITIVE_INFINITY;
  const picks: RoomAnalysis["picks"] = [];
  const pickedCats = new Set<string>();
  let hasPlant = false;
  let anchorPalette: PaletteGroup | null = null;

  // 1) ใส่สินค้าที่ลูกค้าล็อกไว้ก่อนเสมอ
  for (const lp of lockedProducts) {
    if (picks.length >= 6) break;
    picks.push({
      id: lp.id,
      reason: `สินค้าที่คุณล็อกไว้ (${REASON_BY_CAT[lp.category] ?? "เข้าชุดกับห้อง"})`,
    });
    pickedCats.add(lp.category);
    remaining = Math.max(0, remaining - lp.price);
    if (lp.category === "fake_plant" || lp.category === "real_plant" || lp.category === "plant_pot") hasPlant = true;
    if (!anchorPalette && (lp.category === "desk" || lp.category === "bed" || lp.category === "chair")) {
      const pal = detectProductPalette(lp);
      if (pal !== "neutral") anchorPalette = pal;
    }
  }

  for (const cat of sortedCats) {
    if (picks.length >= 6) break;
    if (pickedCats.has(cat)) continue;
    if ((cat === "fake_plant" || cat === "real_plant" || cat === "plant_pot") && hasPlant) continue;
    const list = byCat.get(cat) ?? [];
    const target = budget ? budget * (BUDGET_SHARE[cat] ?? 0.08) : null;
    const minReasonablePrice = cat === "desk" || cat === "chair" || cat === "bed" || cat === "monitor" ? 900 : 120;
    const ranked = list
      .filter((p) => p.price <= remaining && p.price >= minReasonablePrice && !ACCESSORY_RE.test(p.name))
      .map((p) => {
        const itemPal = detectProductPalette(p);
        const harmony = cat === "monitor" ? 0 : paletteHarmonyScore(itemPal, anchorPalette, isGamingPrompt);
        const briefFeatureBonus =
          (/ตัวแอล|l-shape|เข้ามุม/i.test(prompt) && /ตัวแอล|l-shape|เข้ามุม/i.test(p.name) ? 3.5 : 0) +
          (/ปรับระดับ|ไฟฟ้า|standing/i.test(prompt) && /ปรับระดับ|ไฟฟ้า|standing/i.test(p.name) ? 3.5 : 0) +
          (/ตาข่าย|mesh|สุขภาพ|ergonomic/i.test(prompt) && /ตาข่าย|mesh|สุขภาพ|ergonomic/i.test(p.name) ? 2.8 : 0) +
          (/โค้ง|ultrawide/i.test(prompt) && /โค้ง|curved|ultrawide/i.test(p.name) ? 3.0 : 0);
        return {
          p,
          score:
            colorTerms.filter((w) => p.name.toLowerCase().includes(w.toLowerCase()) || p.colors?.some((c) => c.toLowerCase().includes(w.toLowerCase()))).length * 2.8 +
            harmony +
            briefFeatureBonus +
            (p.featured ? 1 : 0) -
            (target ? Math.abs(Math.log(Math.max(p.price, 1) / target)) : 0),
        };
      })
      .sort((a, b) => b.score - a.score);
    const item = ranked[0]?.p ?? list.find((p) => p.price <= remaining && !ACCESSORY_RE.test(p.name));
    if (!item) continue;
    remaining -= item.price;
    pickedCats.add(cat);
    if (!anchorPalette && (cat === "desk" || cat === "bed")) {
      const pal = detectProductPalette(item);
      if (pal !== "neutral") anchorPalette = pal;
    }
    if (cat === "fake_plant" || cat === "real_plant" || cat === "plant_pot") hasPlant = true;
    picks.push({
      id: item.id,
      reason: REASON_BY_CAT[cat] ?? `${(CATEGORY_LABELS as Record<string, string>)[cat] ?? cat} ที่เข้ากับโทนและขนาดห้อง`,
    });
  }
  return {
    roomType: /นอน|bed/i.test(prompt) ? "ห้องนอน & มุมโต๊ะคอม" : /เกม|gaming|สตรีม/i.test(prompt) ? "มุมเกมมิ่ง & สตรีมเมอร์" : "มุมโต๊ะคอม & ทำงาน",
    styleSummary: prompt.slice(0, 180),
    picks,
    tips: [],
  };
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** ให้ Claude ดูรูปห้อง + ความต้องการ แล้วเลือกสินค้าจากรายการ */
/** วิเคราะห์โทนสีและแสงจริงจากรูปห้องด้วย Sharp เมื่อไม่มีคีย์ Claude */
async function analyzePhotoTone(
  roomJpegBase64: string,
  prompt: string,
  budget: number | null,
  candidates: Product[],
  lockedProducts: Product[] = []
): Promise<RoomAnalysis | null> {
  try {
    const stats = await sharp(Buffer.from(roomJpegBase64, "base64")).stats();
    const r = stats.channels[0]?.mean ?? 128;
    const g = stats.channels[1]?.mean ?? 128;
    const b = stats.channels[2]?.mean ?? 128;
    const brightness = (r + g + b) / 3;
    const warmth = r - b;

    let toneHint = "";
    let toneDesc = "โทนโมเดิร์นสมดุลแสงธรรมชาติ";
    const tips: string[] = [];

    if (brightness > 165) {
      toneHint = "ขาว มินิมอล ไม้";
      toneDesc = "ห้องสว่างโทนคลีนมินิมอล";
      tips.push("ห้องมีแสงสว่างดีมาก แนะนำใช้โต๊ะท็อปไม้หรือสีขาวตัดกับเก้าอี้สีเทา/ดำเพื่อเพิ่มมิติ");
    } else if (brightness < 95) {
      toneHint = "ดำ เทา RGB";
      toneDesc = "ห้องโทนเข้มขรึมเหมาะกับสายเกมมิ่ง/สตรีมเมอร์";
      tips.push("แสงในห้องค่อนข้างน้อย แนะนำเพิ่มโคมไฟตั้งโต๊ะหรือไฟ Ambient หลังจอเพื่อถนอมสายตา");
    } else if (warmth > 16) {
      toneHint = "ไม้ โอ๊ค เบจ อบอุ่น";
      toneDesc = "ห้องโทนอบอุ่นสบายตา (Warm Cozy)";
      tips.push("โทนห้องมีความอบอุ่น แนะนำจับคู่เฟอร์นิเจอร์ลายไม้โอ๊คกับต้นไม้ประดับช่วยเพิ่มความสดชื่น");
    } else {
      toneHint = "ขาว เทา ไม้";
      tips.push("วางโต๊ะชิดผนังด้านที่รับแสงด้านข้าง เพื่อลดแสงสะท้อนบนหน้าจอคอมพิวเตอร์");
    }
    tips.push("เว้นระยะห่างหลังเก้าอี้ประมาณ 75–90 ซม. เพื่อให้เลื่อนเข้าออกและหมุนตัวได้สะดวก");
    tips.push("🔌 วางโต๊ะชิดผนังฝั่งที่มีเต้ารับปลั๊กไฟ เพื่อให้ซ่อนสายไฟและปลั๊กพ่วงได้เนี๊ยบใต้โต๊ะ ไม่ต้องเดินสายเกะกะข้ามห้อง");

    const base = heuristicAnalysis(candidates, `${prompt} ${toneHint}`.trim(), budget, lockedProducts);
    return {
      ...base,
      styleSummary: `วิเคราะห์จากแสงและโทนสีจริงในรูป (${toneDesc})${prompt ? ` · ${prompt.slice(0, 120)}` : ""}`,
      tips,
    };
  } catch {
    return null;
  }
}

export function getAnthropicKey(): string | null {
  try {
    const fromDb = readDb().aiConfig?.anthropicApiKey?.trim().replace(/^["']|["']$/g, "");
    if (fromDb) return fromDb;
  } catch {
    // ignore
  }
  const raw = (process.env.ANTHROPIC_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  return raw || null;
}

export async function claudeAnalysis(
  roomJpegBase64: string,
  prompt: string,
  budget: number | null,
  candidates: Product[],
  lockedProducts: Product[] = []
): Promise<RoomAnalysis | null> {
  const key = getAnthropicKey();
  if (!key) return analyzePhotoTone(roomJpegBase64, prompt, budget, candidates, lockedProducts);

  const catalog = candidates
    .map((p) => `${p.id} | ${p.category} | ${p.price} | ${p.name.slice(0, 90)}`)
    .join("\n");

  const lockedNote =
    lockedProducts.length > 0
      ? `\nสินค้าที่ลูกค้าล็อกไว้แล้ว (ต้องใส่ใน picks เสมอ ห้ามตัดออก): ${lockedProducts.map((p) => `${p.id} (${p.name})`).join(", ")}`
      : "";

  const instruction = `คุณคือนักออกแบบตกแต่งภายในมืออาชีพ ดูรูปห้องของลูกค้าแล้วเลือกชุดเฟอร์นิเจอร์ที่โทนสีและวัสดุเข้าชุดกันจากรายการด้านล่างเท่านั้น
บรีฟความต้องการของลูกค้า: """${prompt}"""
งบประมาณรวม: ${budget ? `${budget} บาท (ห้ามเกิน)` : "ไม่ระบุ"}${lockedNote}

หลักการจัดห้อง:
1. เลือก 4-6 ชิ้นที่คุมโทนสีและวัสดุไปในทิศทางเดียวกัน (เช่น ขาว-ไม้โอ๊ค, ดำด้าน-เทาเข้ม, วอลนัทอบอุ่น)
2. วางตำแหน่ง (x, y) ให้สมจริงตามหลักสถาปัตยกรรมภายใน: โต๊ะชิดผนังหรือริมหน้าต่างตามบรีฟ, จออยู่กึ่งกลางบนโต๊ะ, เก้าอี้วางหน้าโต๊ะ, ชั้นวางอยู่ข้างโต๊ะ, พรมปูรองใต้โต๊ะและเก้าอี้

รายการสินค้า (id | หมวด | ราคา | ชื่อ):
${catalog}

ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น:
{"roomType":"ประเภทห้องที่เห็น","styleSummary":"สรุปสไตล์และการคุมโทนที่จะจัด 1-2 ประโยค ภาษาไทย","picks":[{"id":"รหัสจากรายการ","reason":"เหตุผลสั้นๆ ภาษาไทย","x":50,"y":60}],"tips":["คำแนะนำการจัดวาง สั้นๆ ภาษาไทย"]}
x,y = ตำแหน่งที่ควรวางชิ้นนั้นในรูปนี้ เป็น % จากซ้ายและจากบน (0-100)`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: AI_TEXT_MODEL,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: roomJpegBase64 } },
              { type: "text", text: instruction },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      console.error("[ai-room] Claude error", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.filter((c) => c.type === "text").map((c) => c.text).join("") ?? "";
    const parsed = extractJson(text) as Partial<RoomAnalysis> | null;
    if (!parsed || !Array.isArray(parsed.picks)) return null;

    const valid = new Set([...candidates.map((p) => p.id), ...lockedProducts.map((p) => p.id)]);
    const parsedPicks = parsed.picks
      .filter((x) => x && typeof x.id === "string" && valid.has(x.id))
      .slice(0, 8)
      .map((x) => {
        const raw = x as { x?: unknown; y?: unknown };
        const spot = { x: Number(raw.x), y: Number(raw.y) };
        return { id: x.id, reason: String(x.reason ?? "").slice(0, 200), spot: isSpot(spot) ? spot : null };
      });
    for (const lp of lockedProducts) {
      if (!parsedPicks.some((pk) => pk.id === lp.id)) {
        parsedPicks.unshift({ id: lp.id, reason: "สินค้าที่คุณล็อกไว้", spot: null });
      }
    }
    return {
      roomType: String(parsed.roomType ?? "ห้องของคุณ").slice(0, 60),
      styleSummary: String(parsed.styleSummary ?? "").slice(0, 400),
      picks: parsedPicks.slice(0, 7),
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 5).map((t) => String(t).slice(0, 200)) : [],
    };
  } catch (err) {
    console.error("[ai-room] Claude request failed", err);
    return null;
  }
}

async function readProductImageBuffer(imageUrl: string): Promise<Buffer | null> {
  try {
    if (imageUrl.startsWith("/api/files/")) {
      const name = path.basename(imageUrl.split("?")[0]);
      if (!/^[a-z0-9]+-[a-f0-9]{12}\.(jpg|png|webp)$/.test(name)) return null;
      return await fs.readFile(path.join(LOCAL_UPLOAD_DIR, name));
    }
    if (imageUrl.startsWith("/")) {
      const publicDir = path.join(process.cwd(), "public");
      const file = path.normalize(path.join(publicDir, decodeURIComponent(imageUrl.split("?")[0])));
      if (!file.startsWith(publicDir + path.sep)) return null;
      return await fs.readFile(file);
    }
    return (await fetchPublicBytes(imageUrl, 6 * 1024 * 1024, 10000))?.bytes ?? null;
  } catch {
    return null;
  }
}

/** วิเคราะห์สีจริงของตัวสินค้าจากพิกเซลที่ไม่ใช่พื้นหลังสีขาว เพื่อให้ AI วาดสีตรงกับรูปสินค้าจริง */
async function sampleProductForegroundColorEn(bytes: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(bytes)
      .flatten({ background: "#ffffff" })
      .resize(48, 48, { fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i] ?? 255;
      const g = data[i + 1] ?? 255;
      const b = data[i + 2] ?? 255;
      // ข้ามพิกเซลพื้นหลังสีขาว/เทาอ่อนริมขอบ
      if (r > 236 && g > 236 && b > 236) continue;
      rSum += r;
      gSum += g;
      bSum += b;
      count++;
    }
    if (count < 16) return "clean white";
    const r = rSum / count;
    const g = gSum / count;
    const b = bSum / count;
    const lum = (r + g + b) / 3;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC - minC;

    if (lum < 58) return "matte jet black / dark charcoal";
    if (lum > 205 && sat < 24) return "clean off-white / light cream";
    if (sat < 20) return lum < 120 ? "dark slate grey" : "neutral modern grey";
    // โทนไม้/น้ำตาล/เบจ (r > g > b)
    if (r > g && g >= b - 8 && r - b > 22) {
      if (lum > 155) return "light natural oak / warm beige wood";
      if (lum > 100) return "warm medium honey oak wood";
      return "rich dark walnut brown wood";
    }
    if (g > r + 14 && g > b + 12) return "natural botanical green";
    if (b > r + 16 && b > g + 8) return "deep navy / cool blue";
    if (r > g + 25 && b > g + 10) return "soft pastel rose pink";
    return null;
  } catch {
    return null;
  }
}

/** อ่านรูปสินค้า (ไฟล์ใน public/ หรือ URL สาธารณะ) แล้วย่อเป็น JPEG */
export async function loadProductImage(imageUrl: string, maxSize = 640): Promise<string | null> {
  try {
    const bytes = await readProductImageBuffer(imageUrl);
    if (!bytes) return null;
    const out = await sharp(bytes).flatten({ background: "#ffffff" }).resize(maxSize, maxSize, { fit: "inside" }).jpeg({ quality: 86 }).toBuffer();
    return out.toString("base64");
  } catch {
    return null;
  }
}

async function loadProductAsset(p: Product, maxSize = 640): Promise<{ p: Product; b64: string; sampledColorEn: string | null } | null> {
  if (!p.imageUrl) return null;
  try {
    const bytes = await readProductImageBuffer(p.imageUrl);
    if (!bytes) return null;
    const [out, sampledColorEn] = await Promise.all([
      sharp(bytes).flatten({ background: "#ffffff" }).resize(maxSize, maxSize, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer(),
      sampleProductForegroundColorEn(bytes),
    ]);
    return { p, b64: out.toString("base64"), sampledColorEn };
  } catch {
    return null;
  }
}

export interface ImageGenResult {
  image: string | null;
  /** บริการที่สร้างภาพสำเร็จ */
  provider?: "gemini" | "cloudflare";
  /** รหัสสาเหตุเมื่อสร้างภาพไม่สำเร็จ */
  error?: "no_key" | "generation_failed" | "no_image_returned" | "no_products";
  /** ข้อความจาก Gemini (ไม่มีคีย์ปนอยู่) ใช้แสดงให้ผู้ดูแลรู้สาเหตุ */
  detail?: string;
}

/** คีย์ Gemini — อ่านจากหน้าตั้งค่าหลังบ้าน (aiConfig) ก่อน แล้วค่อยอ่านจาก process.env */
export function getGeminiKey(): string | null {
  try {
    const fromDb = readDb().aiConfig?.geminiApiKey?.trim().replace(/^["']|["']$/g, "");
    if (fromDb) return fromDb;
  } catch {
    // ignore
  }
  const raw =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_KEY ||
    "";
  const key = raw.trim().replace(/^["']|["']$/g, "");
  return key || null;
}

/** ข้อมูลบัญชี Cloudflare Workers AI (ฟรีวันละ 10,000 Neurons) */
export function getCloudflareCreds(): { account: string; token: string } | null {
  const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "");
  const account = clean(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID);
  const token = clean(process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN);
  return account && token ? { account, token } : null;
}

/** ตรวจหาวัตถุในภาพด้วย Cloudflare DETR — กล่องเป็นสัดส่วน 0..1 · ใช้ไม่ได้ = null */
export async function detectObjects(buf: Buffer): Promise<Detection[] | null> {
  const creds = getCloudflareCreds();
  if (!creds) return null;
  try {
    const meta = await sharp(buf).metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (!W || !H) return null;
    const jpg = await sharp(buf).jpeg({ quality: 85 }).toBuffer();
    const apiBase = process.env.CF_API_BASE || "https://api.cloudflare.com";
    const res = await fetch(`${apiBase}/client/v4/accounts/${encodeURIComponent(creds.account)}/ai/run/@cf/facebook/detr-resnet-50`, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.token}`, "Content-Type": "application/octet-stream" },
      body: new Uint8Array(jpg),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn("[detect] Cloudflare", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { result?: Array<{ label?: string; score?: number; box?: { xmin: number; ymin: number; xmax: number; ymax: number } }> };
    return (data.result ?? [])
      .filter((d) => d.box && d.label && typeof d.score === "number")
      .map((d) => ({
        label: String(d.label).toLowerCase(),
        score: d.score as number,
        box: { x0: d.box!.xmin / W, y0: d.box!.ymin / H, x1: d.box!.xmax / W, y1: d.box!.ymax / H },
      }))
      .filter((d) => d.box.x1 > d.box.x0 && d.box.y1 > d.box.y0 && d.box.x1 <= 1.05 && d.box.y1 <= 1.05);
  } catch (err) {
    console.warn("[detect] failed", (err as Error).message);
    return null;
  }
}

/** วางจุดตัวเลขลงบนของที่ตรวจเจอจริงในภาพที่ AI สร้าง · ใช้ไม่ได้ = จุดเดิม */
export async function spotsOnImage(
  dataUrl: string,
  items: Array<{ id: string; category: string }>,
  base: Record<string, Spot>
): Promise<Record<string, Spot>> {
  const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(dataUrl);
  if (!m) return base;
  const dets = await detectObjects(Buffer.from(m[1], "base64"));
  return dets ? snapSpotsToDetections(items, base, dets) : base;
}

export function imageGenerationAvailable(): boolean {
  return Boolean(getGeminiKey() || getCloudflareCreds());
}

// Gemini ตอบ 429 (บัญชีฟรีไม่มีโควตาสร้างภาพ) → ข้ามไปใช้ Cloudflare ช่วงหนึ่ง ไม่ต้องเรียกซ้ำทุกครั้ง
let geminiSkipUntil = 0;

/** คำไทยที่ใช้บ่อย → คำอังกฤษ ให้ FLUX เข้าใจบรีฟจัดห้องอย่างละเอียด (FLUX อ่านไทยไม่ค่อยออก) */
const TH_HINTS: Array<[RegExp, string]> = [
  [/ชิดผนังกลาง|กลางห้อง|ผนังหลัก/, "desk centered flush against the main focal wall"],
  [/ริมหน้าต่างขวา|ข้างหน้าต่างขวา|ฝั่งขวา/, "desk positioned on the right side near the window with natural side daylight"],
  [/ริมหน้าต่างซ้าย|ข้างหน้าต่างซ้าย|ฝั่งซ้าย|เข้ามุมซ้าย/, "desk tucked neatly into the left corner / left side wall"],
  [/เข้ามุม|มุมห้อง/, "corner desk layout maximizing floor space"],
  [/มินิมอล|minimal/i, "minimalist Japandi Scandinavian style"],
  [/อบอุ่น|cozy/i, "warm cozy inviting atmosphere"],
  [/วอลนัท|walnut|ไม้เข้ม/i, "rich dark walnut wood tone"],
  [/โอ๊ค|oak|ไม้สีอ่อน|บีช/i, "light natural oak wood tone"],
  [/ไม้/, "natural wood grain texture"],
  [/ขาวคลีน|ขาวล้วน/, "all-white clean monochrome aesthetic"],
  [/ขาว/, "clean matte white"],
  [/ดำด้าน|เทาเข้ม|ดาร์ก|มืด/, "matte black and dark charcoal grey aesthetic"],
  [/ดำ/, "matte black"],
  [/เทา/, "modern neutral grey"],
  [/เบจ|ครีม/, "warm cream beige"],
  [/เขียว/, "sage botanical green"],
  [/ต้นไม้|ธรรมชาติ/, "lush indoor potted plants"],
  [/แสงธรรมชาติ|กลางวัน|โปร่ง/, "bright soft natural daylight through window"],
  [/ไฟอุ่น|แสงอุ่น|โทนส้ม|ตอนเย็น|ยามเย็น/, "warm 3000K golden-hour ambient lamp lighting"],
  [/RGB|ไฟเกมมิ่ง|นีออน/i, "subtle tasteful ambient RGB LED backlight glow behind desk and monitor"],
  [/สว่างคมชัด|ไฟสตูดิโอ|ทำงานชัด/, "crisp bright 4500K studio task lighting"],
  [/เกม|gaming|สตรีม/i, "modern pro gaming and streaming battlestation"],
  [/ทำงาน|โปรดักทีฟ|ออฟฟิศ/, "clean productive ergonomic home office workspace"],
  [/ครีเอเตอร์|ตัดต่อ|สตูดิโอ/, "professional content creator studio desk setup"],
  [/ergonomic|สุขภาพ|ปวดหลัง/i, "ergonomic mesh office chair and height-adjustable standing desk"],
  [/จอคู่|2\s*จอ|สองจอ|dual\s*monitor/i, "dual side-by-side frameless widescreen monitors on the desk"],
  [/จอโค้ง|ultrawide/i, "curved ultrawide monitor centered on the desk"],
  [/ซ่อนสายไฟ|จัดสายไฟ|ไร้สาย|เนี๊ยบ/, "ultra-clean hidden cable management with zero visible wires"],
  [/ชั้นวางโชว์|ที่เก็บของเยอะ|ชั้นวาง|ตู้เก็บของ/, "organized vertical bookshelf and display shelving beside the desk"],
  [/เพกบอร์ด|pegboard/i, "wall-mounted pegboard organizer above the desk"],
  [/ไม่รก|สะอาดตา|โล่ง/, "clean uncluttered minimalist surface with open floor space"],
  [/ไม่มีพรม|ไม่เอาพรม|เอาพรมออก/, "bare clean floor with no rug"],
  [/ห้องนอน/, "cozy bedroom with integrated desk corner"],
  [/พรม/, "soft woven area rug under desk"],
  [/ผนัง/, "wall"],
  [/พื้นไม้/, "warm wooden parquet floor"],
  [/พื้น/, "floor"],
  [/เตียง/, "platform bed with neat bedding"],
  [/โต๊ะตัวแอล|l-shape/i, "L-shaped corner desk"],
  [/โต๊ะปรับระดับ|standing desk/i, "motorized standing desk"],
  [/โต๊ะ/, "computer desk"],
  [/เก้าอี้สุขภาพ|เก้าอี้ตาข่าย/, "ergonomic breathable mesh office chair"],
  [/เก้าอี้/, "office chair"],
  [/ม่าน/, "sheer window curtains"],
  [/โคมไฟติดจอ|screenbar|lightbar/i, "monitor lightbar mounted on top of screen"],
  [/โคม/, "desk lamp"],
  [/ลำโพง/, "pair of desktop speakers"],
  [/อ่อน/, "soft light pastel tone"],
  [/เข้ม/, "deep dark tone"],
  [/ปลั๊กไฟ|เต้ารับ|ชิดปลั๊ก|ใกล้ปลั๊ก|outlet/i, "desk aligned close to wall power outlet for concealed under-desk cable management"],
  [/กลางคืน|โหมดกลางคืน|ค่ำ|night|nighttime/i, "nighttime cozy atmosphere, warm 2700K golden lamp glow, glowing monitor backlights, dark night outside window"],
  [/กลางวัน|โหมดกลางวัน|daytime|daylight/i, "bright daytime interior, clear soft natural sunlight streaming through window"],
  [/เอา.*ออก|ลบ/, "remove"],
];

function englishHints(text: string): string {
  return TH_HINTS.filter(([re]) => re.test(text)).map(([, en]) => en).join(", ");
}

function buildLayoutZonePlanEn(prompt: string): string {
  const outletHint = /ปลั๊กไฟ|เต้ารับ|outlet/i.test(prompt)
    ? " Anchor the desk flush with the wall right next to the room's electrical power outlet, routing all device power cables into an invisible under-desk cable management tray."
    : "";
  if (/ห้องนอน|เตียง|bed/i.test(prompt)) {
    return `Interior Layout Plan: Place the bed flush against the left/back bedroom wall, position the computer desk and ergonomic chair neatly on the right side wall, place the storage/wardrobe against the side wall, and lay the area rug flat on the floor.${outletHint}`;
  }
  if (/ริมหน้าต่างขวา|ข้างหน้าต่างขวา|ฝั่งขวา|ชิดขวา|มุมขวา|window-right/i.test(prompt)) {
    return `Interior Layout Plan: Position the main computer desk setup on the right side of the room near the right wall/window so natural side-light illuminates the desk, with the ergonomic chair tucked in front, storage shelf on the left side of the desk, and area rug flat beneath the desk and chair.${outletHint}`;
  }
  if (/ริมหน้าต่างซ้าย|ข้างหน้าต่างซ้าย|ฝั่งซ้าย|ชิดซ้าย|มุมซ้าย|เข้ามุม|window-left/i.test(prompt)) {
    return `Interior Layout Plan: Position the main computer desk tucked neatly into the left side wall / left corner of the room, with the ergonomic chair in front facing the monitor, storage shelf standing to the right of the desk, and area rug flat underneath.${outletHint}`;
  }
  return `Interior Layout Plan: Center the main computer desk flush against the primary back wall, mount/place the monitor centered on the desk, tuck the ergonomic chair neatly in front of the desk, stand the storage shelf vertically against the wall right beside the desk, place the indoor plant in the corner, and lay the area rug flat on the floor under the desk and chair.${outletHint}`;
}

const PLACEMENT_EN: Record<string, string> = {
  desk: "placed flush against the wall on the floor as the main workstation anchor",
  chair: "positioned on the floor directly in front of the desk facing the monitor",
  monitor: "centered on top of the desk surface facing the chair",
  monitor_arm: "clamped to the back edge of the desk holding the monitor floating above the desktop",
  lighting: "placed at the side of the desk casting warm illumination across the workspace",
  storage: "standing neatly against the wall right beside the desk",
  wardrobe: "standing flush against the side wall",
  bed: "placed flush against the bedroom wall with headboard touching the wall",
  rug: "laid flat on the floor directly underneath the desk and chair",
  fake_plant: "placed in the corner beside the desk for a natural botanical accent",
  real_plant: "placed in the corner beside the desk",
  plant_pot: "placed on the corner of the desk or floor",
  speaker: "placed symmetrically on the left and right sides of the monitor on the desk",
  keyboard: "placed neatly centered on the desk in front of the monitor",
  mouse: "placed on the desk to the right of the keyboard",
  mousepad: "laid flat on the center of the desk surface under the keyboard and mouse",
  headphone: "resting on a stand at the corner of the desk",
  decor: "arranged neatly on the desk or shelf",
};

function colorEnFromProduct(p: Product, sampledColorEn?: string | null): string {
  const joined = `${p.name} ${(p.colors ?? []).join(" ")} ${(p.materials ?? []).join(" ")}`.toLowerCase();
  const cols: string[] = [];
  if (/ขาว|white|ครีม|เบจ|beige/.test(joined)) cols.push("clean matte white / warm cream");
  if (/ดำ|black|เทาเข้ม|charcoal|ดาร์ก/.test(joined)) cols.push("matte black / dark charcoal");
  if (/วอลนัท|walnut|น้ำตาลเข้ม/.test(joined)) cols.push("rich dark walnut wood");
  else if (/ไม้|โอ๊ค|wood|oak|บีช|ธรรมชาติ/.test(joined)) cols.push("natural warm oak wood grain");
  if (/เทา|gray|grey|เงิน|silver/.test(joined)) cols.push("modern neutral grey");
  if (/ชมพู|pink/.test(joined)) cols.push("soft pastel pink");
  if (/เขียว|green/.test(joined)) cols.push("sage botanical green");
  if (/ฟ้า|น้ำเงิน|blue/.test(joined)) cols.push("deep navy blue");
  if (cols.length === 0 && sampledColorEn) cols.push(sampledColorEn);
  else if (sampledColorEn && !cols.join(" ").includes(sampledColorEn.split(" ")[0] ?? "")) {
    cols.push(sampledColorEn);
  }
  return cols.slice(0, 2).join(" with ") || "clean modern finish";
}

function specificShapeEnFromProduct(p: Product, prompt = ""): string {
  const text = `${p.name} ${p.description ?? ""} ${(p.materials ?? []).join(" ")}`.toLowerCase();
  switch (p.category) {
    case "desk": {
      const shape = /ตัวแอล|l-shape|เข้ามุม/.test(text)
        ? "L-shaped corner computer desk"
        : /ปรับระดับ|ไฟฟ้า|standing|ergonomic/.test(text)
          ? "motorized height-adjustable standing desk"
          : "rectangular flat-top computer office desk";
      const legs = /ขาเหล็ก|โครงเหล็ก|steel|โลหะ/.test(text)
        ? "with powder-coated steel frame legs"
        : /ขาไม้|ไม้แท้|solid wood/.test(text)
          ? "with solid wooden legs"
          : "with clean minimalist legs";
      const extra = /ลิ้นชัก|drawer/.test(text)
        ? " and built-in under-desk drawers"
        : /ชั้นวางจอ|วางจอ/.test(text)
          ? " and elevated monitor riser shelf"
          : "";
      return `${shape} ${legs}${extra}`;
    }
    case "chair": {
      if (/เกมมิ่ง|gaming|เรซซิ่ง|racing/.test(text)) {
        return "high-back racing-style gaming chair with contoured side bolsters, headrest pillow, and 5-star caster base";
      }
      if (/ตาข่าย|mesh|สุขภาพ|ergonomic/.test(text)) {
        return "ergonomic breathable mesh office chair with adjustable headrest, contoured lumbar support, armrests, and 5-star rolling base";
      }
      if (/หนัง|leather/.test(text)) {
        return "upholstered mid/high-back leather executive office chair with padded armrests and wheeled base";
      }
      return "modern ergonomic task office chair with padded seat and 5-star caster base";
    }
    case "monitor": {
      if (/จอคู่|2\s*จอ|สองจอ|dual/i.test(prompt) || /คู่|dual/.test(text)) {
        return "pair of matching frameless widescreen IPS desktop monitors mounted side-by-side";
      }
      if (/โค้ง|curved|ultrawide|34|49/.test(text)) {
        return "curved ultrawide frameless widescreen monitor on sleek stand";
      }
      if (/32|27/.test(text)) {
        return "27-inch frameless 4K flat IPS desktop monitor with ultra-thin bezels";
      }
      return "frameless widescreen flat desktop monitor on minimalist stand";
    }
    case "lighting": {
      if (/คล้องจอ|ติดจอ|หัวจอ|screenbar|lightbar/.test(text)) {
        return "sleek LED monitor lightbar clamped on top of the monitor casting warm downward task light onto the desk";
      }
      if (/ตั้งพื้น|floor/.test(text)) {
        return "tall minimalist standing floor lamp positioned beside the desk casting soft warm ambient glow";
      }
      if (/ไฟเส้น|strip|rgb|นีออน|neon|ไฟติดผนัง/.test(text)) {
        return "ambient LED light strip / wall light casting a soft diffused glow behind the desk";
      }
      return "modern articulated architectural LED desk lamp on the desk corner";
    }
    case "storage": {
      if (/เพกบอร์ด|pegboard|ติดผนัง|แขวนผนัง/.test(text)) {
        return "wall-mounted pegboard organizer panel with small shelves mounted on the wall above the desk";
      }
      if (/ลิ้นชัก|ตู้ลิ้นชัก|ใต้โต๊ะ/.test(text)) {
        return "compact rolling drawer storage cabinet tucked neatly beside/under the desk";
      }
      return "tall multi-tier open bookshelf storage rack standing neatly against the wall beside the desk";
    }
    case "rug": {
      if (/กลม|วงกลม|round/.test(text)) {
        return "round soft woven floor rug laid beneath the chair and desk";
      }
      if (/ขนยาว|ขนฟู|shaggy/.test(text)) {
        return "plush soft shaggy rectangular floor area rug under the desk and chair";
      }
      return "flat-woven rectangular floor area rug laid neatly beneath the desk and chair";
    }
    case "fake_plant":
    case "real_plant": {
      if (/มอนสเตอร่า|monstera/.test(text)) {
        return "indoor potted green Monstera deliciosa plant in a minimalist ceramic planter";
      }
      if (/ไทรใบสัก|ยางอินเดีย|ต้นใหญ่|ตั้งพื้น/.test(text)) {
        return "tall indoor potted fiddle-leaf fig / rubber tree standing in a floor planter pot";
      }
      return "lush indoor potted green plant in a clean minimalist pot";
    }
    case "bed":
      return "modern platform bed frame with headboard and neatly styled cozy duvet bedding";
    case "wardrobe":
      return "modern tall vertical bedroom wardrobe closet with clean flat doors";
    case "speaker":
      return "pair of compact desktop bookshelf studio monitors/speakers placed left and right of the screen";
    case "keyboard":
      return "compact wireless mechanical keyboard with clean keycaps on the desk";
    default:
      return "modern interior furniture piece";
  }
}

/** แปลงข้อมูลสินค้าเป็นภาษาอังกฤษระดับ Interior Architecture เพื่อให้ FLUX / Gemini วาดตรงกับสินค้าจริง 100% */
function productToEnglishDesc(
  p: Product,
  spot?: Spot,
  refLabel?: string,
  sampledColorEn?: string | null,
  prompt = ""
): string {
  const shapeEn = specificShapeEnFromProduct(p, prompt);
  const colorEn = colorEnFromProduct(p, sampledColorEn);
  const dim =
    p.dimensions?.width && p.dimensions?.depth
      ? `, exact dimensions ${p.dimensions.width}cm wide × ${p.dimensions.depth}cm deep${p.dimensions.height ? ` × ${p.dimensions.height}cm high` : ""}`
      : "";
  const place = PLACEMENT_EN[p.category] ?? "placed naturally in the room";
  const coord = spot ? ` at target frame position (x=${Math.round(spot.x)}%, y=${Math.round(spot.y)}%)` : "";
  const refTag = refLabel ? ` [MUST match exact design, proportions, and color from ${refLabel}]` : "";
  return `${colorEn} ${shapeEn}${dim}${refTag}, ${place}${coord}`;
}

/** รวมภาพสินค้าชิ้นที่ 3..6 เป็นแผ่นภาพอ้างอิง 2x2 แผ่นเดียว เพื่อให้ FLUX (จำกัด 4 รูป) มองเห็นสินค้าครบทุกชิ้น */
async function buildAccessoryCollageB64(items: Array<{ b64: string }>): Promise<string | null> {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0]!.b64;
  try {
    const cell = 252;
    const size = cell * 2;
    const composites: OverlayOptions[] = [];
    for (const [idx, item] of items.slice(0, 4).entries()) {
      const tile = await sharp(Buffer.from(item.b64, "base64"))
        .flatten({ background: "#ffffff" })
        .resize(cell - 12, cell - 12, { fit: "contain", background: "#ffffff" })
        .jpeg({ quality: 88 })
        .toBuffer();
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      composites.push({
        input: tile,
        left: col * cell + 6,
        top: row * cell + 6,
      });
    }
    const sheet = await sharp({
      create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .composite(composites)
      .jpeg({ quality: 88 })
      .toBuffer();
    return sheet.toString("base64");
  } catch {
    return items[0]?.b64 ?? null;
  }
}

const COMPOSITE_WIDTH_FRAC: Record<string, number> = {
  desk: 0.50,
  chair: 0.22,
  monitor: 0.24,
  monitor_arm: 0.12,
  keyboard: 0.17,
  mouse: 0.05,
  mousepad: 0.20,
  speaker: 0.08,
  headphone: 0.08,
  lighting: 0.11,
  storage: 0.18,
  wardrobe: 0.24,
  bed: 0.52,
  rug: 0.55,
  fake_plant: 0.12,
  real_plant: 0.12,
  plant_pot: 0.09,
  decor: 0.08,
  computer: 0.14,
};

const COMPOSITE_LAYER: Record<string, number> = {
  rug: 0,
  wardrobe: 1,
  storage: 1,
  bed: 1,
  desk: 2,
  lighting: 3,
  monitor: 3,
  monitor_arm: 3,
  speaker: 3,
  keyboard: 3,
  mousepad: 3,
  mouse: 3,
  headphone: 3,
  decor: 3,
  computer: 3,
  chair: 4,
  fake_plant: 5,
  real_plant: 5,
  plant_pot: 5,
};

async function cutoutWhiteToPng(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]!;
    const g = px[i + 1]!;
    const b = px[i + 2]!;
    const m = Math.min(r, g, b);
    if (m > 244) {
      px[i + 3] = 0;
    } else if (m > 228) {
      px[i + 3] = Math.round(px[i + 3]! * ((244 - m) / 16));
    }
  }
  return sharp(px, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** สร้างภาพจำลองการจัดห้องเสมือนจริง (Spatial Layout Guide) บนเซิร์ฟเวอร์ด้วย sharp เพื่อส่งให้ AI เห็นของจริงและตำแหน่งจริงครบทุกชิ้น */
export async function buildServerCompositeGuide(
  roomJpegBase64: string,
  items: Array<{ p: Product; b64: string }>,
  spots: Record<string, Spot>,
  targetWidth = 1024
): Promise<string | null> {
  try {
    const roomBuf = Buffer.from(roomJpegBase64, "base64");
    const meta = await sharp(roomBuf).metadata();
    const origW = meta.width ?? 1024;
    const origH = meta.height ?? 768;
    const scale = targetWidth / origW;
    const W = targetWidth;
    const H = Math.round(origH * scale);

    const baseRoom = await sharp(roomBuf).resize(W, H, { fit: "fill" }).toBuffer();

    const positioned = items
      .filter((it) => spots[it.p.id])
      .sort((a, b) => (COMPOSITE_LAYER[a.p.category] ?? 3) - (COMPOSITE_LAYER[b.p.category] ?? 3) || spots[a.p.id]!.y - spots[b.p.id]!.y);

    if (positioned.length === 0) return null;

    let deskBox: { cx: number; topY: number; bottomY: number; w: number } | null = null;
    const deskItem = positioned.find((it) => it.p.category === "desk");
    if (deskItem) {
      const dSp = spots[deskItem.p.id]!;
      const dMeta = await sharp(Buffer.from(deskItem.b64, "base64")).metadata();
      const dDepth = 0.85 + (dSp.y / 100) * 0.35;
      const dW = Math.round(W * (COMPOSITE_WIDTH_FRAC.desk ?? 0.5) * dDepth);
      const dH = Math.round((dW * (dMeta.height ?? 300)) / (dMeta.width ?? 400));
      const dCx = (dSp.x / 100) * W;
      const dCy = Math.max(H * 0.64, Math.min(H * 0.78, (dSp.y / 100) * H));
      deskBox = { cx: dCx, topY: dCy - dH * 0.42, bottomY: dCy + dH * 0.48, w: dW };
    }

    const overlays: OverlayOptions[] = [];

    for (const it of positioned) {
      const sp = spots[it.p.id]!;
      const itemRaw = Buffer.from(it.b64, "base64");
      const iMeta = await sharp(itemRaw).metadata();
      const iwOrig = iMeta.width ?? 300;
      const ihOrig = iMeta.height ?? 300;
      const depth = 0.85 + (sp.y / 100) * 0.35;
      const w = Math.round(W * (COMPOSITE_WIDTH_FRAC[it.p.category] ?? 0.14) * depth);
      const h = Math.round((w * ihOrig) / iwOrig);
      if (w < 12 || h < 12) continue;

      let cx = (sp.x / 100) * W;
      let cy = (sp.y / 100) * H;

      const isDesktopItem = ["monitor", "monitor_arm", "keyboard", "mouse", "mousepad", "speaker", "headphone", "lighting", "decor"].includes(it.p.category);

      if (it.p.category === "desk") {
        cy = Math.max(H * 0.64, Math.min(H * 0.78, cy));
      } else if (it.p.category === "chair" && deskBox) {
        cx = deskBox.cx + W * 0.02;
        cy = Math.min(H - h * 0.48, deskBox.bottomY - h * 0.12);
      } else if (it.p.category === "rug" && deskBox) {
        cx = deskBox.cx;
        cy = Math.min(H - h * 0.35, deskBox.bottomY + h * 0.12);
      } else if (it.p.category === "storage" && deskBox) {
        const side = sp.x < (deskBox.cx / W) * 100 ? -1 : 1;
        cx = Math.max(w * 0.6, Math.min(W - w * 0.6, deskBox.cx + side * (deskBox.w * 0.62 + w * 0.45)));
        cy = Math.max(h * 0.55, deskBox.bottomY - h * 0.48);
      } else if (isDesktopItem && deskBox) {
        if (it.p.category === "monitor" || it.p.category === "monitor_arm") {
          cx = deskBox.cx;
          cy = deskBox.topY - h * 0.32;
        } else if (it.p.category === "lighting") {
          cx = deskBox.cx - deskBox.w * 0.36;
          cy = deskBox.topY - h * 0.28;
        } else if (it.p.category === "speaker") {
          cx = deskBox.cx + deskBox.w * 0.34;
          cy = deskBox.topY - h * 0.18;
        } else {
          cy = deskBox.topY + h * 0.05;
        }
      }

      const left = Math.round(Math.max(4, Math.min(W - w - 4, cx - w / 2)));
      const top = Math.round(Math.max(4, Math.min(H - h - 4, cy - h / 2)));

      const cutoutPng = await cutoutWhiteToPng(itemRaw);
      const resizedItem = await sharp(cutoutPng).resize(w, h, { fit: "fill" }).toBuffer();

      overlays.push({
        input: resizedItem,
        left,
        top,
      });
    }

    if (overlays.length === 0) return null;

    const outBuf = await sharp(baseRoom)
      .composite(overlays)
      .jpeg({ quality: 90 })
      .toBuffer();

    return outBuf.toString("base64");
  } catch (err) {
    console.warn("[ai-room] buildServerCompositeGuide failed:", (err as Error).message);
    return null;
  }
}

function mimeOfBase64(b64: string): string {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

/** FLUX.2 บน Cloudflare Workers AI — รับรูปอ้างอิงได้ 4 รูป พร้อมส่งทั้ง image_i และ input_image_i เพื่อความเข้ากันได้ 100% */
async function callCloudflareImage(prompt: string, imagesB64: string[]): Promise<ImageGenResult> {
  const creds = getCloudflareCreds();
  if (!creds) return { image: null, error: "no_key" };
  const model = process.env.CF_IMAGE_MODEL || "@cf/black-forest-labs/flux-2-klein-4b";
  try {
    const first = Buffer.from(imagesB64[0], "base64");
    const meta = await sharp(first).metadata();
    const w0 = meta.width ?? 1024;
    const h0 = meta.height ?? 768;
    const scale = 1024 / Math.max(w0, h0);
    const r16 = (n: number) => Math.max(256, Math.round((n * scale) / 16) * 16);

    const form = new FormData();
    form.append("prompt", prompt.slice(0, 2000));
    form.append("width", String(r16(w0)));
    form.append("height", String(r16(h0)));
    for (const [i, b64] of imagesB64.slice(0, 4).entries()) {
      // รูปที่ 0 ใช้ความละเอียดสูงขึ้นเพื่อรักษาโครงสร้างผนัง แสงเงา และเลย์เอาต์ให้คมชัด
      const targetSide = i === 0 ? 768 : 504;
      const small = await sharp(Buffer.from(b64, "base64"))
        .flatten({ background: "#ffffff" })
        .resize(targetSide, targetSide, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: i === 0 ? 92 : 88 })
        .toBuffer();
      const blob = new Blob([new Uint8Array(small)], { type: "image/jpeg" });
      form.append(`image_${i}`, blob, `image_${i}.jpg`);
      form.append(`input_image_${i}`, blob, `image_${i}.jpg`);
      if (i === 0) {
        form.append("image", blob, "image_0.jpg");
        form.append("input_image", blob, "image_0.jpg");
      }
    }

    const base = process.env.CF_API_BASE || "https://api.cloudflare.com";
    const res = await fetch(`${base}/client/v4/accounts/${encodeURIComponent(creds.account)}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.token}` },
      body: form,
      signal: AbortSignal.timeout(120000),
    });
    const raw = await res.text();
    let data: { success?: boolean; result?: { image?: string }; image?: string; errors?: Array<{ message?: string }> } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      // ไม่ใช่ JSON
    }
    if (!res.ok || data.success === false) {
      const msg = data.errors?.map((e) => e.message).filter(Boolean).join("; ") || raw.slice(0, 200);
      console.error("[ai-room] Cloudflare error", res.status, msg);
      return { image: null, error: "generation_failed", detail: `Cloudflare ${res.status}: ${msg.slice(0, 240)}` };
    }
    const b64 = data.result?.image ?? data.image;
    if (!b64) return { image: null, error: "no_image_returned", detail: "Cloudflare: ไม่มีภาพในคำตอบ" };
    return { image: `data:${mimeOfBase64(b64)};base64,${b64}`, provider: "cloudflare" };
  } catch (err) {
    console.error("[ai-room] Cloudflare request failed", err);
    return { image: null, error: "generation_failed", detail: `เชื่อมต่อ Cloudflare ไม่ได้: ${(err as Error).message}` };
  }
}

/** สร้างภาพ: ลอง Gemini 2.5 Flash Image ก่อน (ถ้ามีคีย์) ไม่ได้ค่อยใช้ Cloudflare FLUX ฟรี */
async function generateImage(
  geminiText: string,
  fluxText: string,
  geminiImagesB64: string[],
  fluxImagesB64: string[] = geminiImagesB64
): Promise<ImageGenResult> {
  const cf = getCloudflareCreds();
  let pref: "auto" | "gemini" | "cloudflare" = "auto";
  try {
    pref = readDb().aiConfig?.preferredImageProvider || "auto";
  } catch {
    // ignore
  }
  let gem: ImageGenResult | null = null;
  if (pref !== "cloudflare" && getGeminiKey() && (pref === "gemini" || Date.now() > geminiSkipUntil || !cf)) {
    gem = await callGeminiImage(geminiText, geminiImagesB64);
    if (gem.image) return { ...gem, provider: "gemini" };
    if (cf && /Gemini 429|quota|billing/i.test(gem.detail ?? "")) geminiSkipUntil = Date.now() + 30 * 60 * 1000;
  }
  if (cf && pref !== "gemini") {
    const r = await callCloudflareImage(fluxText, fluxImagesB64);
    if (r.image || !gem) return r;
    return { ...r, detail: [gem.detail, r.detail].filter(Boolean).join(" | ") };
  }
  return gem ?? { image: null, error: "no_key" };
}

/** เรียก Gemini image ด้วยข้อความ + รูปหลายรูป */
async function callGeminiImage(text: string, imagesB64: string[]): Promise<ImageGenResult> {
  const key = getGeminiKey();
  if (!key) return { image: null, error: "no_key" };

  const parts: Array<Record<string, unknown>> = [
    { text },
    ...imagesB64.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } })),
  ];
  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });
  const model = encodeURIComponent(AI_IMAGE_MODEL);
  // คีย์แบบ AIza… = Gemini API (AI Studio), คีย์แบบ AQ.… = Vertex AI express mode
  const geminiUrl = `${process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com"}/v1beta/models/${model}:generateContent`;
  const vertexUrl = `${process.env.VERTEX_API_BASE || "https://aiplatform.googleapis.com"}/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const endpoints = key.startsWith("AQ.") ? [vertexUrl, geminiUrl] : [geminiUrl, vertexUrl];

  try {
    let res: Response | null = null;
    for (const url of endpoints) {
      res = await fetch(url, {
        method: "POST",
        headers: url === geminiUrl
          ? { "x-goog-api-key": key, "content-type": "application/json" }
          : { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(120000),
      });
      // คีย์ใช้กับปลายทางนี้ไม่ได้ → ลองอีกที่
      if (res.ok || ![400, 401, 403, 404].includes(res.status)) break;
      const peek = await res.clone().text();
      if (!/api key|API_KEY|unauthenticated|permission|not found|NOT_FOUND/i.test(peek)) break;
      console.warn("[ai-room] image endpoint rejected key, trying next:", res.status, peek.slice(0, 160));
    }
    if (!res) return { image: null, error: "generation_failed" };
    if (!res.ok) {
      const errText = await res.text();
      let message = errText.slice(0, 300);
      try {
        message = (JSON.parse(errText) as { error?: { message?: string } }).error?.message ?? message;
      } catch {
        // ไม่ใช่ JSON
      }
      console.error("[ai-room] Gemini error", res.status, message);
      return { image: null, error: "generation_failed", detail: `Gemini ${res.status}: ${message.slice(0, 240)}` };
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } }> };
      }>;
      promptFeedback?: { blockReason?: string };
    };
    const cand = data.candidates?.[0];
    for (const part of cand?.content?.parts ?? []) {
      const d = part.inlineData ?? (part.inline_data && { mimeType: part.inline_data.mime_type, data: part.inline_data.data });
      if (d?.data) return { image: `data:${d.mimeType || "image/png"};base64,${d.data}` };
    }
    const why =
      data.promptFeedback?.blockReason ||
      cand?.finishReason ||
      cand?.content?.parts?.map((p) => p.text).filter(Boolean).join(" ").slice(0, 200) ||
      "ไม่มีภาพในคำตอบ";
    console.error("[ai-room] Gemini returned no image:", why);
    return { image: null, error: "no_image_returned", detail: `Gemini: ${why}` };
  } catch (err) {
    console.error("[ai-room] Gemini request failed", err);
    return { image: null, error: "generation_failed", detail: `เชื่อมต่อ Gemini ไม่ได้: ${(err as Error).message}` };
  }
}

const VARIANT_HINTS = [
  "",
  "Variation: use a slightly different ergonomic desk angle and accent decor placement while keeping the room architecture identical.",
  "Variation: emphasise cozy warm golden-hour ambient lighting and soft desk lamp glow while keeping the same products.",
];

/** สร้างภาพห้องที่จัดแล้ว — วิเคราะห์สี/รูปทรงจริงของสินค้า + ผสานภาพคัตเอาต์จัดวางจริง + กำกับสไตล์มัณฑนากรระดับโปร */
export async function generateRoomImage(
  roomJpegBase64: string,
  prompt: string,
  products: Product[],
  variant = 0,
  spots: Record<string, Spot> = {}
): Promise<ImageGenResult> {
  if (!imageGenerationAvailable()) return { image: null, error: "no_key" };
  if (products.length === 0) return { image: null, error: "no_products" };

  // เรียงสินค้าชิ้นหลัก (โต๊ะ/เตียง -> เก้าอี้ -> จอ -> ชั้นวาง -> โคมไฟ -> พรม -> ต้นไม้)
  const orderedProducts = [...products].sort(
    (a, b) => (ANCHOR_ORDER[a.category] ?? 99) - (ANCHOR_ORDER[b.category] ?? 99)
  );

  const refs = (
    await Promise.all(orderedProducts.slice(0, 6).map((p) => loadProductAsset(p)))
  ).filter((x): x is { p: Product; b64: string; sampledColorEn: string | null } => !!x);

  const isFrom3DPlan = /Turn this 3D room mock-up/i.test(prompt);
  const roomDimsMatch = prompt.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*ม\./);
  const roomSizeEn = roomDimsMatch ? ` (real room dimensions: ${roomDimsMatch[1]}m wide by ${roomDimsMatch[2]}m deep)` : "";
  const hints = englishHints(prompt) || "modern clean ergonomic workspace, balanced natural lighting";
  const layoutPlanEn = buildLayoutZonePlanEn(prompt);

  // สร้างภาพผสานเลย์เอาต์เสมือนจริงบนห้องจริง (Spatial Composite Guide) เพื่อให้ AI มองเห็นจุดวางและสินค้าจริงทุกชิ้นก่อนเรนเดอร์
  const serverCompositeB64 = !isFrom3DPlan ? await buildServerCompositeGuide(roomJpegBase64, refs, spots) : null;
  const primaryRoomB64 = serverCompositeB64 || roomJpegBase64;

  const checklistItems = orderedProducts.map((p, idx) => {
    const s = spots[p.id];
    const catLabel = (CATEGORY_LABELS as Record<string, string>)[p.category] ?? p.category;
    const posStr = s ? `at target coordinates (x=${Math.round(s.x)}%, y=${Math.round(s.y)}%)` : "positioned ergonomically in the room";
    return `  [REQUIRED ITEM ${idx + 1} - ${catLabel.toUpperCase()}]: "${p.name}" (${posStr}, MUST be clearly visible in final render)`;
  }).join("\n");

  const list = refs
    .map((r, i) => {
      const s = variant === 0 ? spots[r.p.id] : undefined;
      return `${i + 2}. "${r.p.name}" — ${productToEnglishDesc(r.p, s, `Reference Image ${i + 2}`, r.sampledColorEn, prompt)}`;
    })
    .join("\n");

  const designerRules = `
PROFESSIONAL INTERIOR ARCHITECT DESIGN RULES:
1. MANDATORY PRODUCT FIDELITY: Every single furniture piece MUST faithfully match the real catalog reference image (exact color finish, natural wood grain/matte metal texture, leg frame design, and real proportions).
2. NO MISSING ITEMS: ALL of the following ${orderedProducts.length} items MUST be visibly placed and rendered in the room:
${checklistItems}
3. CLEAN WIRE MANAGEMENT: Ultra-clean hidden cable routing with zero loose or tangled cords on the floor or desk.
4. BALANCED 3-TIER LIGHTING: Soft natural daylight from room windows + warm 3000K task lamp illumination + gentle warm ambient backlight glow creating depth and separation.
5. REALISTIC CONTACT & DEPTH: Natural ambient occlusion, soft directional contact shadows under desk legs, chair wheels, and rug edges.
6. COMPOSITION: Straight eye-level architectural 1-point/2-point perspective, clutter-free surfaces, 8k photorealistic DSLR editorial photography, sharp focus, no text or watermarks.`;

  const text = isFrom3DPlan
    ? `Image 1 is a 3D architectural layout mockup of a room${roomSizeEn}. Images 2+ are the exact real furniture products selected by the customer:
${list}

Transform the 3D layout in Image 1 into an ultra-realistic, magazine-worthy DSLR interior photograph.
${designerRules}
User Brief & Style: ${hints}. (${prompt})
${VARIANT_HINTS[variant] ?? ""}
Output one photorealistic interior photograph with no text or watermarks.`
    : `Image 1 is the customer's real room${roomSizeEn}. ${serverCompositeB64 ? "Image 2 is the spatial composite guide showing all selected furniture items mapped to their target positions. " : ""}Images ${serverCompositeB64 ? "3+" : "2+"} are the exact real furniture products selected from our catalog:
${list}

Redecorate the customer's room into an award-winning architectural interior photograph designed by a luxury interior architect:
${designerRules}
${layoutPlanEn}
User Brief & Atmosphere: ${hints}. (${prompt})
${VARIANT_HINTS[variant] ?? ""}
Output one high-resolution photorealistic interior photograph with no text or watermarks.`;

  // สำหรับ FLUX: Image 0 = รูปห้องพร้อมผสานเลย์เอาต์ (หรือรูปห้องจริง), Image 1 = โต๊ะหลัก, Image 2 = เก้าอี้หลัก, Image 3 = แผ่นรวมสินค้าประกอบ (จอ, โคมไฟ, ชั้นวาง, พรม)
  const primaryTwo = refs.slice(0, 2);
  const restRefs = refs.slice(2, 6);
  const slot3B64 = await buildAccessoryCollageB64(restRefs);
  const fluxImagesB64 = [
    primaryRoomB64,
    ...primaryTwo.map((r) => r.b64),
    ...(slot3B64 ? [slot3B64] : []),
  ];

  const quadrantLabels = ["top-left of Image 3", "top-right of Image 3", "bottom-left of Image 3", "bottom-right of Image 3"];
  const fluxList = [
    ...primaryTwo.map((r, i) => {
      const s = variant === 0 ? spots[r.p.id] : undefined;
      return `- ${productToEnglishDesc(r.p, s, `Image ${i + 1}`, r.sampledColorEn, prompt)}`;
    }),
    ...restRefs.map((r, idx) => {
      const s = variant === 0 ? spots[r.p.id] : undefined;
      const refLabel = restRefs.length === 1 ? "Image 3" : (quadrantLabels[idx] ?? "Image 3");
      return `- ${productToEnglishDesc(r.p, s, refLabel, r.sampledColorEn, prompt)}`;
    }),
  ].join("\n");

  const fluxText = isFrom3DPlan
    ? `Image 0 is a 3D room layout mockup${roomSizeEn}. Transform Image 0 into an ultra-realistic architectural interior photograph keeping the exact room walls, windows, and floor. Render all furniture pieces faithfully matching catalog references from Images 1-3:
${fluxList}
MANDATORY: DO NOT OMIT ANY ITEM. All ${orderedProducts.length} pieces must be visibly present.
Style & Design: ${hints}. Professional interior architect styling: 60-30-10 color harmony, hidden cable management, soft natural daylight, warm 3000K lamp glow, realistic floor contact shadows, 8k photorealistic DSLR interior photography, sharp focus, no text.`
    : `Image 0 is an interior layout reference of the customer's room${roomSizeEn} with planned furniture arrangement. Transform Image 0 into a breathtaking, award-winning interior design photograph. Every furniture item MUST faithfully match its catalog reference in Images 1-3 (exact colors, natural wood/metal finishes, and proportions):
${fluxList}
${layoutPlanEn}
MANDATORY: DO NOT OMIT ANY ITEM. All ${orderedProducts.length} pieces from Image 0 must be visibly rendered in the final room.
Professional interior styling: ${hints}, zero visible wires, clean minimalist surfaces, realistic contact shadows and global illumination, 8k DSLR architectural photography, sharp details, no text or watermarks.`;

  const geminiImagesB64 = [
    roomJpegBase64,
    ...(serverCompositeB64 ? [serverCompositeB64] : []),
    ...refs.map((r) => r.b64),
  ];

  return generateImage(text, fluxText, geminiImagesB64, fluxImagesB64);
}

/** แก้ภาพที่ AI สร้างไว้แล้วตามคำสั่งใหม่ เช่น "เปลี่ยนเตียงเป็นสีเข้ม" */
export async function refineRoomImage(baseJpegBase64: string, instruction: string): Promise<ImageGenResult> {
  const hints = englishHints(instruction);
  const text = `Edit this room photo according to the user's brief: ${instruction}${hints ? ` (${hints})` : ""}
Keep everything else (room walls, windows, camera angle, other furniture, lighting) strictly the same. High-resolution photorealistic interior photo, no text.`;
  const fluxText = `Edit Image 0 interior photograph: ${hints || instruction}. Strictly preserve the exact room walls, windows, floor, camera perspective, lighting, and all other furniture in Image 0. 8k photorealistic interior photography, no text.`;
  return generateImage(text, fluxText, [baseJpegBase64]);
}

/** แปลงรูปห้องที่ลูกค้าอัปโหลดเป็น JPEG ขนาดพอเหมาะ (ตัด EXIF/ตำแหน่ง GPS ทิ้ง) */
export async function normalizeRoomPhoto(input: Buffer): Promise<string> {
  const out = await sharp(input).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  return out.toString("base64");
}
