import "server-only";
import { isSpot, snapSpotsToDetections, type Detection, type Spot } from "@/lib/hotspots";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Product, ProductCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/format";
import { fetchPublicBytes } from "@/lib/safe-fetch";
import { LOCAL_UPLOAD_DIR } from "@/lib/storage";

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
  "desk", "chair", "lighting", "storage", "wardrobe", "bed", "rug", "decor",
  "fake_plant", "real_plant", "plant_pot", "monitor", "monitor_arm", "keyboard", "mouse",
  "mousepad", "speaker", "headphone",
] as ProductCategory[];

const CATEGORY_KEYWORDS: Array<[RegExp, ProductCategory[]]> = [
  [/ห้องนอน|เตียง|นอน|bed/i, ["bed", "wardrobe", "lighting", "rug", "decor"] as ProductCategory[]],
  [/ทำงาน|โต๊ะ|work|office|desk|เรียน|อ่านหนังสือ/i, ["desk", "chair", "lighting", "storage"] as ProductCategory[]],
  [/เกม|gaming|สตรีม|stream/i, ["desk", "chair", "monitor", "keyboard", "mouse", "headphone", "lighting"] as ProductCategory[]],
  [/ต้นไม้|ธรรมชาติ|plant|เขียว/i, ["fake_plant", "real_plant", "plant_pot"] as ProductCategory[]],
  [/เก็บของ|ชั้น|ตู้|storage|shelf/i, ["storage", "wardrobe"] as ProductCategory[]],
  [/พรม|rug/i, ["rug"] as ProductCategory[]],
  [/ไฟ|โคม|แสง|light|rgb/i, ["lighting"] as ProductCategory[]],
  [/เก้าอี้|chair/i, ["chair"] as ProductCategory[]],
  [/จอ|monitor/i, ["monitor", "monitor_arm"] as ProductCategory[]],
  [/ตกแต่ง|แต่ง|decor|อบอุ่น|cozy/i, ["decor", "lighting", "rug"] as ProductCategory[]],
];

const COLOR_WORDS: Array<[RegExp, string[]]> = [
  [/ขาว|white|มินิมอล|minimal/i, ["ขาว", "white"]],
  [/ดำ|black|มืด/i, ["ดำ", "black"]],
  [/ไม้|wood|โอ๊ค|oak|ธรรมชาติ|อบอุ่น/i, ["ไม้", "โอ๊ค", "wood", "oak", "บีช", "วอลนัท"]],
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

/** คัดสินค้าที่เกี่ยวกับการแต่งห้องและพร้อมขาย เพื่อส่งให้ AI เลือก */
export function selectCandidates(products: Product[], prompt: string, limitPerCategory = 25): Product[] {
  const wanted = new Set<ProductCategory>();
  for (const [re, cats] of CATEGORY_KEYWORDS) if (re.test(prompt)) cats.forEach((c) => wanted.add(c));
  const cats = wanted.size > 0 ? Array.from(wanted) : FURNISHING_CATEGORIES;
  const colorTerms = COLOR_WORDS.filter(([re]) => re.test(prompt)).flatMap(([, w]) => w);

  const out: Product[] = [];
  for (const cat of cats) {
    const pool = products
      .filter((p) => p.category === cat && p.status === "available" && p.published !== false && p.imageUrl)
      .map((p) => ({
        p,
        score:
          colorTerms.filter((w) => p.name.toLowerCase().includes(w.toLowerCase())).length * 2 +
          (p.featured ? 1 : 0) +
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
  bed: 0.35, desk: 0.25, chair: 0.2, wardrobe: 0.25, monitor: 0.25, storage: 0.12, lighting: 0.08,
  rug: 0.08, decor: 0.05, monitor_arm: 0.06, keyboard: 0.06, mouse: 0.03, headphone: 0.06,
  fake_plant: 0.03, real_plant: 0.03, plant_pot: 0.02, speaker: 0.05, mousepad: 0.02,
};
// ชื่อที่บอกว่าเป็นอะไหล่/ของเสริม ไม่ใช่ชิ้นหลักของหมวด
const ACCESSORY_RE = /อะไหล่|ที่แบ่งช่อง|ปลอก|ไส้|ขาตั้งสำหรับ|เช็ดเท้า|ชุดต่อ|ตัวต่อ|ฝาปิด|บานพับ|มือจับ|ขา(?!ตั้ง)|กล่องเก็บของใต้/;

/** เลือกสินค้าแบบไม่ใช้ AI: หมวดละ 1 ชิ้น เน้นชิ้นหลักที่ราคาเหมาะกับงบ */
export function heuristicAnalysis(candidates: Product[], prompt: string, budget: number | null): RoomAnalysis {
  const colorTerms = COLOR_WORDS.filter(([re]) => re.test(prompt)).flatMap(([, w]) => w);
  const byCat = new Map<string, Product[]>();
  for (const p of candidates) (byCat.get(p.category) ?? byCat.set(p.category, []).get(p.category)!).push(p);

  let remaining = budget ?? Number.POSITIVE_INFINITY;
  const picks: RoomAnalysis["picks"] = [];
  for (const [cat, list] of byCat) {
    if (picks.length >= 6) break;
    const target = budget ? budget * (BUDGET_SHARE[cat] ?? 0.08) : null;
    const ranked = list
      .filter((p) => p.price <= remaining && !ACCESSORY_RE.test(p.name))
      .map((p) => ({
        p,
        score:
          colorTerms.filter((w) => p.name.toLowerCase().includes(w.toLowerCase())).length * 2 -
          (target ? Math.abs(Math.log(Math.max(p.price, 1) / target)) : 0),
      }))
      .sort((a, b) => b.score - a.score);
    const item = ranked[0]?.p;
    if (!item) continue;
    remaining -= item.price;
    picks.push({ id: item.id, reason: `${(CATEGORY_LABELS as Record<string, string>)[cat] ?? cat} ที่เข้ากับสไตล์ที่ขอ` });
  }
  return {
    roomType: /นอน|bed/i.test(prompt) ? "ห้องนอน" : /ทำงาน|work|office/i.test(prompt) ? "มุมทำงาน" : "ห้องของคุณ",
    styleSummary: prompt.slice(0, 140),
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
export async function claudeAnalysis(
  roomJpegBase64: string,
  prompt: string,
  budget: number | null,
  candidates: Product[]
): Promise<RoomAnalysis | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const catalog = candidates
    .map((p) => `${p.id} | ${p.category} | ${p.price} | ${p.name.slice(0, 90)}`)
    .join("\n");

  const instruction = `คุณคือนักออกแบบตกแต่งภายใน ดูรูปห้องของลูกค้าแล้วเลือกสินค้าจากรายการด้านล่างเท่านั้น
ความต้องการของลูกค้า: """${prompt}"""
งบประมาณรวม: ${budget ? `${budget} บาท (ห้ามเกิน)` : "ไม่ระบุ"}

เลือก 3-7 ชิ้นที่เข้ากับห้องจริง (ขนาดพื้นที่ โทนสี แสง) และความต้องการ ไม่เลือกของหมวดซ้ำกันถ้าไม่จำเป็น

รายการสินค้า (id | หมวด | ราคา | ชื่อ):
${catalog}

ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น:
{"roomType":"ประเภทห้องที่เห็น","styleSummary":"สรุปสไตล์ที่จะจัด 1-2 ประโยค ภาษาไทย","picks":[{"id":"รหัสจากรายการ","reason":"เหตุผลสั้นๆ ภาษาไทย","x":50,"y":60}],"tips":["คำแนะนำการจัดวาง สั้นๆ ภาษาไทย"]}
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

    const valid = new Set(candidates.map((p) => p.id));
    return {
      roomType: String(parsed.roomType ?? "ห้องของคุณ").slice(0, 60),
      styleSummary: String(parsed.styleSummary ?? "").slice(0, 400),
      picks: parsed.picks
        .filter((x) => x && typeof x.id === "string" && valid.has(x.id))
        .slice(0, 8)
        .map((x) => {
          const raw = x as { x?: unknown; y?: unknown };
          const spot = { x: Number(raw.x), y: Number(raw.y) };
          return { id: x.id, reason: String(x.reason ?? "").slice(0, 200), spot: isSpot(spot) ? spot : null };
        }),
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 5).map((t) => String(t).slice(0, 200)) : [],
    };
  } catch (err) {
    console.error("[ai-room] Claude request failed", err);
    return null;
  }
}

/** อ่านรูปสินค้า (ไฟล์ใน public/ หรือ URL สาธารณะ) แล้วย่อเป็น JPEG */
export async function loadProductImage(imageUrl: string, maxSize = 640): Promise<string | null> {
  try {
    let bytes: Buffer | null = null;
    if (imageUrl.startsWith("/api/files/")) {
      // ไฟล์ที่ร้านอัปโหลดไว้ในเครื่อง (.data/uploads)
      const name = path.basename(imageUrl.split("?")[0]);
      if (!/^[a-z0-9]+-[a-f0-9]{12}\.(jpg|png|webp)$/.test(name)) return null;
      bytes = await fs.readFile(path.join(LOCAL_UPLOAD_DIR, name));
    } else if (imageUrl.startsWith("/")) {
      const publicDir = path.join(process.cwd(), "public");
      const file = path.normalize(path.join(publicDir, decodeURIComponent(imageUrl.split("?")[0])));
      if (!file.startsWith(publicDir + path.sep)) return null;
      bytes = await fs.readFile(file);
    } else {
      bytes = (await fetchPublicBytes(imageUrl, 6 * 1024 * 1024, 10000))?.bytes ?? null;
    }
    if (!bytes) return null;
    const out = await sharp(bytes).flatten({ background: "#ffffff" }).resize(maxSize, maxSize, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
    return out.toString("base64");
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

/** คีย์ Gemini — รองรับชื่อตัวแปรที่คนชอบตั้งผิด และตัดช่องว่าง/เครื่องหมายคำพูดที่ติดมา */
export function getGeminiKey(): string | null {
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

/** คำไทยที่ใช้บ่อย → คำอังกฤษ ให้ FLUX เข้าใจสไตล์ (FLUX อ่านไทยไม่ค่อยออก) */
const TH_HINTS: Array<[RegExp, string]> = [
  [/มินิมอล/, "minimalist"],
  [/อบอุ่น/, "warm cozy"],
  [/ไม้/, "natural wood"],
  [/ขาว/, "white"],
  [/ดำ/, "black"],
  [/เทา/, "grey"],
  [/เขียว/, "green"],
  [/ต้นไม้/, "indoor plants"],
  [/ไฟอุ่น|โทนส้ม/, "warm lighting"],
  [/RGB/i, "RGB lighting"],
  [/เกม/, "gaming setup"],
  [/ทำงาน/, "home office desk setup"],
  [/ครีเอเตอร์|ตัดต่อ/, "content creator studio"],
  [/ergonomic|สุขภาพ/i, "ergonomic chair, standing desk"],
  [/ห้องนอน/, "bedroom"],
  [/ไม่รก|สะอาดตา|โล่ง/, "clean uncluttered"],
  [/ที่เก็บของ/, "storage shelves"],
  [/พรม/, "rug"],
  [/ผนัง/, "wall"],
  [/พื้น/, "floor"],
  [/เตียง/, "bed"],
  [/โต๊ะ/, "desk"],
  [/เก้าอี้/, "chair"],
  [/ม่าน/, "curtains"],
  [/โคม/, "lamp"],
  [/อ่อน/, "light pastel"],
  [/เข้ม/, "dark"],
  [/เอา.*ออก|ลบ/, "remove"],
];
function englishHints(text: string): string {
  return TH_HINTS.filter(([re]) => re.test(text)).map(([, en]) => en).join(", ");
}

function mimeOfBase64(b64: string): string {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

/** FLUX.2 บน Cloudflare Workers AI — รับรูปอ้างอิงได้ 4 รูป (ต้องเล็กกว่า 512px) */
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
      const small = await sharp(Buffer.from(b64, "base64")).resize(504, 504, { fit: "inside" }).jpeg({ quality: 86 }).toBuffer();
      form.append(`input_image_${i}`, new Blob([new Uint8Array(small)], { type: "image/jpeg" }), `image_${i}.jpg`);
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

/** สร้างภาพ: ลอง Gemini ก่อน (ถ้ามีคีย์) ไม่ได้ค่อยใช้ Cloudflare FLUX ฟรี */
async function generateImage(geminiText: string, fluxText: string, imagesB64: string[]): Promise<ImageGenResult> {
  const cf = getCloudflareCreds();
  let gem: ImageGenResult | null = null;
  if (getGeminiKey() && (Date.now() > geminiSkipUntil || !cf)) {
    gem = await callGeminiImage(geminiText, imagesB64);
    if (gem.image) return { ...gem, provider: "gemini" };
    if (cf && /Gemini 429|quota|billing/i.test(gem.detail ?? "")) geminiSkipUntil = Date.now() + 30 * 60 * 1000;
  }
  if (cf) {
    const r = await callCloudflareImage(fluxText, imagesB64);
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
  "Variation: use a different furniture arrangement and slightly different accent decor placement than a typical layout.",
  "Variation: emphasise lighting mood (warm evening light) while keeping the same products.",
];

/** สร้างภาพห้องที่จัดแล้ว — variant 0,1,2 ให้ผลต่างกันเล็กน้อย */
export async function generateRoomImage(
  roomJpegBase64: string,
  prompt: string,
  products: Product[],
  variant = 0,
  spots: Record<string, Spot> = {}
): Promise<ImageGenResult> {
  if (!imageGenerationAvailable()) return { image: null, error: "no_key" };
  if (products.length === 0) return { image: null, error: "no_products" };

  const refs = (
    await Promise.all(products.slice(0, 6).map(async (p) => ({ p, b64: p.imageUrl ? await loadProductImage(p.imageUrl) : null })))
  ).filter((x): x is { p: Product; b64: string } => !!x.b64);

  const list = refs
    .map((r, i) => {
      const s = variant === 0 ? spots[r.p.id] : undefined;
      return `${i + 2}. ${r.p.name}${s ? ` (place around x ${Math.round(s.x)}%, y ${Math.round(s.y)}% of the frame)` : ""}`;
    })
    .join("\n");
  const text = `Image 1 is a photo of the customer's real room. Images 2+ are real products from our partner stores:
${list}

Redecorate the room in image 1 by placing these exact products naturally (correct scale, perspective, lighting and shadows).
Keep the room's walls, windows, floor, camera angle and size the same. Do not add other branded items or any text.
Customer request: ${prompt}
${VARIANT_HINTS[variant] ?? ""}
Output one photorealistic image.`;

  // FLUX รับรูปได้ 4 รูป: รูปห้อง + สินค้า 3 ชิ้นแรก ที่เหลือบอกเป็นชื่อ
  const fluxRefs = refs.slice(0, 3);
  const fluxList = [
    ...fluxRefs.map((r, i) => `- ${r.p.name} (shown in image ${i + 1})`),
    ...products.filter((p) => !fluxRefs.some((r) => r.p.id === p.id)).slice(0, 4).map((p) => `- ${p.name}`),
  ].join("\n");
  const hints = englishHints(prompt);
  const fluxText = `Image 0 is a photo of a real room. Redecorate the room in image 0 by placing these products naturally with correct scale, perspective and soft shadows:
${fluxList}
Keep the same walls, windows, floor, camera angle and room size from image 0.
Style: ${hints || "modern, tidy"}. ${prompt}
Photorealistic interior photograph, natural light, no text.${variant ? " Use a slightly different arrangement." : ""}`;

  return generateImage(text, fluxText, [roomJpegBase64, ...fluxRefs.map((r) => r.b64)]);
}

/** แก้ภาพที่ AI สร้างไว้แล้วตามคำสั่งใหม่ เช่น "เปลี่ยนเตียงเป็นสีเข้ม" */
export async function refineRoomImage(baseJpegBase64: string, instruction: string): Promise<ImageGenResult> {
  const text = `Edit this room photo: ${instruction}
Keep everything else (room shape, camera angle, other furniture, lighting) the same. Photorealistic, no text.`;
  const hints = englishHints(instruction);
  const fluxText = `Edit image 0: ${instruction}${hints ? ` (${hints})` : ""}. Keep everything else in image 0 the same: room shape, camera angle, other furniture and lighting. Photorealistic, no text.`;
  return generateImage(text, fluxText, [baseJpegBase64]);
}

/** แปลงรูปห้องที่ลูกค้าอัปโหลดเป็น JPEG ขนาดพอเหมาะ (ตัด EXIF/ตำแหน่ง GPS ทิ้ง) */
export async function normalizeRoomPhoto(input: Buffer): Promise<string> {
  const out = await sharp(input).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return out.toString("base64");
}
