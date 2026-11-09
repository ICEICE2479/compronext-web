"use client";

import QRCode from "qrcode";
import { CATEGORY_LABELS, formatTHB } from "@/lib/format";
import {
  autoLayout,
  DEFAULT_ROOM,
  fitsRoom,
  footprint,
  itemFromProduct,
  placeNew,
  type PlanItem,
  type RoomSize,
} from "@/lib/room-planner";

export interface StudioCatalogProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string | null;
  dimensions?: { width: number; depth: number; height: number; unit: string };
  colors?: string[];
  storeName?: string;
  platform?: string;
  buyUrl?: string;
}

export interface AutoFurnishPreset {
  id: "work" | "gaming" | "condo" | "dream";
  label: string;
  desc: string;
  defaultBudget: number;
  categories: string[];
}

export const AUTO_FURNISH_PRESETS: AutoFurnishPreset[] = [
  {
    id: "work",
    label: "💼 มุมทำงานมินิมอล",
    desc: "โต๊ะทำงาน เก้าอี้ จอ โคมไฟ ชั้นวาง และต้นไม้ประดับ",
    defaultBudget: 18000,
    categories: ["desk", "chair", "monitor", "keyboard", "mouse", "lighting", "storage", "fake_plant"],
  },
  {
    id: "gaming",
    label: "🎮 ห้องเกมเมอร์ & สตรีมเมอร์",
    desc: "โต๊ะเกมมิ่ง เก้าอี้ คอมเคสใส จอ คีย์บอร์ด เมาส์ แผ่นรอง ไฟ RGB พรม",
    defaultBudget: 38000,
    categories: [
      "desk",
      "chair",
      "monitor",
      "computer",
      "keyboard",
      "mouse",
      "mousepad",
      "headphone",
      "lighting",
      "rug",
      "fake_plant",
    ],
  },
  {
    id: "condo",
    label: "🛏️ ห้องนอนคอนโดครบเซ็ต",
    desc: "เตียงนอน ตู้เสื้อผ้า โต๊ะคอม เก้าอี้ จอ โคมไฟ พรม และต้นไม้",
    defaultBudget: 45000,
    categories: ["bed", "wardrobe", "desk", "chair", "monitor", "lighting", "rug", "fake_plant"],
  },
  {
    id: "dream",
    label: "✨ จัดเต็มสตูดิโอระดับโปร",
    desc: "ครบชุดโต๊ะ คอม จอ ลำโพง ไมค์สตรีม ชั้นโชว์ ไฟบรรยากาศ และพรม",
    defaultBudget: 75000,
    categories: [
      "desk",
      "chair",
      "monitor",
      "computer",
      "keyboard",
      "mouse",
      "mousepad",
      "speaker",
      "microphone",
      "lighting",
      "storage",
      "rug",
      "fake_plant",
    ],
  },
];

const SHARE_WEIGHTS: Record<string, number> = {
  bed: 0.26,
  wardrobe: 0.2,
  computer: 0.28,
  desk: 0.2,
  chair: 0.18,
  monitor: 0.2,
  storage: 0.1,
  speaker: 0.08,
  microphone: 0.06,
  keyboard: 0.06,
  headphone: 0.06,
  lighting: 0.06,
  rug: 0.06,
  mouse: 0.04,
  mousepad: 0.02,
  fake_plant: 0.03,
};

/**
 * 1-Click AI Auto-Furnish: ดึงสินค้าจริงจากคลังตามหมวดและงบประมาณ แล้วจัดวางลงห้อง 3D อัตโนมัติ
 */
export async function buildAutoFurnishLayout(
  presetId: AutoFurnishPreset["id"],
  budgetInput: number | null,
  room: RoomSize
): Promise<{ items: PlanItem[]; pickedProducts: StudioCatalogProduct[]; totalPrice: number }> {
  const preset = AUTO_FURNISH_PRESETS.find((p) => p.id === presetId) ?? AUTO_FURNISH_PRESETS[1];
  const targetBudget = budgetInput && budgetInput >= 5000 ? budgetInput : preset.defaultBudget;

  // ดึงสินค้าแต่ละหมวดแบบขนานเพื่อให้ได้สินค้าครบทุกหมวด
  const fetchedLists = await Promise.all(
    preset.categories.map(async (cat) => {
      try {
        const res = await fetch(`/api/planner/products?cat=${encodeURIComponent(cat)}&limit=24`);
        if (!res.ok) return { cat, list: [] as StudioCatalogProduct[] };
        const data = (await res.json()) as { products?: StudioCatalogProduct[] };
        return { cat, list: data.products ?? [] };
      } catch {
        return { cat, list: [] as StudioCatalogProduct[] };
      }
    })
  );

  const totalWeight = preset.categories.reduce((s, c) => s + (SHARE_WEIGHTS[c] ?? 0.06), 0) || 1;
  let remaining = targetBudget;
  const pickedProducts: StudioCatalogProduct[] = [];

  for (const { cat, list } of fetchedLists) {
    if (!list.length) continue;
    const idealPrice = targetBudget * ((SHARE_WEIGHTS[cat] ?? 0.06) / totalWeight);
    const fitting = list.filter((p) => p.price > 0 && fitsRoom(p.dimensions, room));
    const pool = fitting.length > 0 ? fitting : list;

    const affordable = pool.filter((p) => p.price <= Math.max(remaining, idealPrice * 1.35));
    const candidates = affordable.length > 0 ? affordable : pool;

    // เลือกชิ้นที่ราคาใกล้เคียงสัดส่วนงบที่สุด และมีรูปสินค้าจริง
    const sorted = [...candidates].sort((a, b) => {
      const aHasImg = a.imageUrl ? 0 : 1;
      const bHasImg = b.imageUrl ? 0 : 1;
      if (aHasImg !== bHasImg) return aHasImg - bHasImg;
      return Math.abs(a.price - idealPrice) - Math.abs(b.price - idealPrice);
    });

    const chosen = sorted[0];
    if (chosen) {
      pickedProducts.push(chosen);
      remaining = Math.max(0, remaining - chosen.price);
    }
  }

  const rawItems = pickedProducts.map((prod) =>
    itemFromProduct({
      id: prod.id,
      name: prod.name,
      category: prod.category,
      price: prod.price,
      dimensions: prod.dimensions,
      colors: prod.colors,
      imageUrl: prod.imageUrl,
    })
  );

  const placedItems = autoLayout(rawItems, room);
  const totalPrice = pickedProducts.reduce((sum, p) => sum + (p.price || 0), 0);

  return {
    items: placedItems,
    pickedProducts,
    totalPrice,
  };
}

/**
 * สร้าง QR Code แบบ SVG คมชัดสูงสำหรับสแกนเปิดห้อง 3D บนมือถือทันที
 */
export async function generateRoomQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 240,
    color: {
      dark: "#0a192f",
      light: "#ffffff",
    },
  });
}

/**
 * วาดภาพ Shareable Setup Card (PNG) รวมภาพมุมกล้อง 3D ปัจจุบัน + รายการสินค้า + ราคารวมทั้งห้อง
 */
export async function renderShareableSetupCard(
  snapshotBlob: Blob,
  room: RoomSize,
  items: PlanItem[],
  totalPrice: number
): Promise<Blob | null> {
  const imgUrl = URL.createObjectURL(snapshotBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imgUrl;
    });

    const W = 1600;
    const H = 960;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 1. พื้นหลังธีม ComproNext Official Paper (#f4f8fc)
    ctx.fillStyle = "#f4f8fc";
    ctx.fillRect(0, 0, W, H);

    // แถบหัวสีน้ำเงิน Royal Blue ด้านบนสุด
    const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
    headerGrad.addColorStop(0, "#0a192f");
    headerGrad.addColorStop(0.55, "#0050ff");
    headerGrad.addColorStop(1, "#003ecb");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, 84);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 28px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
    ctx.fillText("COMPRONEXT · 3D ROOM SETUP STUDIO", 40, 52);

    const roomDimText = `ขนาดห้อง ${(room.w / 100).toFixed(2)} × ${(room.d / 100).toFixed(2)} ม. (สูง ${(room.h / 100).toFixed(2)} ม.)`;
    ctx.font = "600 20px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
    ctx.fillStyle = "#dbeafe";
    const dimWidth = ctx.measureText(roomDimText).width;
    ctx.fillText(roomDimText, W - dimWidth - 40, 52);

    // 2. กรอบภาพห้อง 3D ด้านซ้าย (980 x 800)
    const imgBoxX = 36;
    const imgBoxY = 112;
    const imgBoxW = 980;
    const imgBoxH = 812;

    ctx.save();
    roundRect(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, 24);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.clip();

    // วาดภาพ 3D แบบ cover เต็มกรอบ
    const scale = Math.max(imgBoxW / img.width, imgBoxH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = imgBoxX + (imgBoxW - dw) / 2;
    const dy = imgBoxY + (imgBoxH - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    // เส้นขอบกรอบภาพ 3D
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    roundRect(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, 24);
    ctx.stroke();

    // 3. การ์ดสรุปรายการสินค้าและราคาด้านขวา (516 x 812)
    const cardX = 1044;
    const cardY = 112;
    const cardW = 520;
    const cardH = 812;

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fill();
    ctx.strokeStyle = "#dbe3ef";
    ctx.lineWidth = 2;
    ctx.stroke();

    // กล่องราคารวมด้านบนการ์ดขวา
    ctx.fillStyle = "#e8f1ff";
    roundRect(ctx, cardX + 24, cardY + 24, cardW - 48, 112, 18);
    ctx.fill();

    const validItems = items.filter((i) => i.category !== "door" && i.price > 0);
    ctx.fillStyle = "#1e3a5f";
    ctx.font = "700 18px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
    ctx.fillText(`งบประมาณรวมทั้งห้อง (${validItems.length} ชิ้น)`, cardX + 44, cardY + 62);

    ctx.fillStyle = "#0050ff";
    ctx.font = "900 38px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
    ctx.fillText(formatTHB(totalPrice), cardX + 44, cardY + 114);

    // รายการสินค้าแต่ละชิ้น
    ctx.fillStyle = "#0a192f";
    ctx.font = "800 20px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
    ctx.fillText("รายการเฟอร์นิเจอร์และอุปกรณ์ในห้อง", cardX + 28, cardY + 176);

    const maxRows = 9;
    const displayItems = validItems.slice(0, maxRows);
    let rowY = cardY + 200;

    if (displayItems.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "500 17px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
      ctx.fillText("ยังไม่มีรายการสินค้าที่มีราคาในห้องนี้", cardX + 28, rowY + 30);
    } else {
      displayItems.forEach((it, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
        roundRect(ctx, cardX + 24, rowY, cardW - 48, 56, 12);
        ctx.fill();

        const catLabel = (CATEGORY_LABELS as Record<string, string>)[it.category] || it.category;
        ctx.fillStyle = "#0050ff";
        ctx.font = "700 14px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
        ctx.fillText(`${idx + 1}. [${catLabel}]`, cardX + 36, rowY + 23);

        const cleanName = it.name.length > 34 ? `${it.name.slice(0, 34)}…` : it.name;
        ctx.fillStyle = "#0f172a";
        ctx.font = "600 15px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
        ctx.fillText(cleanName, cardX + 36, rowY + 44);

        const priceStr = formatTHB(it.price);
        ctx.fillStyle = "#0050ff";
        ctx.font = "800 16px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
        const pw = ctx.measureText(priceStr).width;
        ctx.fillText(priceStr, cardX + cardW - 38 - pw, rowY + 35);

        rowY += 60;
      });

      if (validItems.length > maxRows) {
        ctx.fillStyle = "#475569";
        ctx.font = "600 15px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
        ctx.fillText(`+ และสินค้าอื่นๆ ในห้องอีก ${validItems.length - maxRows} ชิ้น`, cardX + 36, rowY + 24);
      }
    }

    // แถบด้านล่างของการ์ดขวา
    ctx.fillStyle = "#64748b";
    ctx.font = "600 14px system-ui, -apple-system, 'Noto Sans Thai', sans-serif";
    ctx.fillText("ออกแบบห้อง 3D & เช็กราคาจริงได้ที่ ComproNext", cardX + 28, cardY + cardH - 24);

    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 0.95));
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export interface ErgonomicReport {
  eyeDistanceCm: number;
  deskWidthCm: number;
  deskDepthCm: number;
  deskHeightCm: number;
  chairClearanceCm: number;
  status: "good" | "warn";
  headline: string;
  tips: string[];
}

/**
 * คำนวณระยะสายตาถึงจอ (Eye-to-Monitor Distance) และหลักสรีรศาสตร์จากตำแหน่งจริงในห้อง 3D
 */
export function analyzeErgonomics(items: PlanItem[], room: RoomSize): ErgonomicReport {
  const desk = items.find((i) => i.category === "desk");
  const monitor = items.find((i) => i.category === "monitor");
  const chair = items.find((i) => i.category === "chair");

  const deskW = desk ? Math.round(desk.w) : 120;
  const deskD = desk ? Math.round(desk.d) : 60;
  const deskH = desk ? Math.round(desk.h) : 75;

  let eyeDistanceCm = Math.round(deskD * 0.85 + 12);
  if (chair && monitor) {
    const dist = Math.hypot(chair.x - monitor.x, chair.z - monitor.z);
    if (dist >= 30 && dist <= 160) {
      eyeDistanceCm = Math.round(dist);
    }
  } else if (chair && desk) {
    const dist = Math.hypot(chair.x - desk.x, chair.z - desk.z);
    if (dist >= 35 && dist <= 150) {
      eyeDistanceCm = Math.round(dist + deskD * 0.22);
    }
  }

  // ระยะถอยเก้าอี้ถึงผนังหรือของชิ้นหลัง
  let chairClearanceCm = 90;
  if (chair) {
    const minWall = Math.min(chair.x, room.w - chair.x, chair.z, room.d - chair.z);
    chairClearanceCm = Math.max(25, Math.round(minWall));
  }

  const tips: string[] = [];
  let status: "good" | "warn" = "good";

  if (eyeDistanceCm < 50) {
    status = "warn";
    tips.push(`ระยะสายตาถึงจอ ${eyeDistanceCm} ซม. ใกล้เกินไป (ควรห่าง 55–75 ซม.) แนะนำเลือกโต๊ะลึก 60–75 ซม. หรือติดขาจับจอ (Monitor Arm)`);
  } else if (eyeDistanceCm > 95) {
    status = "warn";
    tips.push(`ระยะสายตาถึงจอ ${eyeDistanceCm} ซม. ไกลไปนิด แนะนำเลื่อนเก้าอี้หรือจอเข้ามาให้ห่างราว 60–75 ซม.`);
  } else {
    tips.push(`ระยะสายตาถึงจอ ~${eyeDistanceCm} ซม. เหมาะสมตามหลัก Ergonomics สำหรับจอ 24–32 นิ้ว ลดอาการตาล้า`);
  }

  const seatMin = Math.round(deskH - 30);
  const seatMax = Math.round(deskH - 26);
  tips.push(`โต๊ะสูง ${deskH} ซม. · แนะนำปรับความสูงเบาะเก้าอี้ที่ ${seatMin}–${seatMax} ซม. ให้ข้อศอกทำมุม 90° พอดี`);

  if (chairClearanceCm < 55) {
    status = "warn";
    tips.push(`พื้นที่ถอยเก้าอี้เหลือ ~${chairClearanceCm} ซม. ค่อนข้างแคบ (ควรมีอย่างน้อย 65 ซม. เพื่อลุก-นั่งสะดวก)`);
  } else {
    tips.push(`พื้นที่ขยับเก้าอี้ด้านหลัง ~${chairClearanceCm} ซม. ลุกนั่งและหมุนตัวได้สบาย`);
  }

  const headline =
    status === "good"
      ? `✅ ระยะสายตา ${eyeDistanceCm} ซม. · โต๊ะ ${deskW}×${deskD} ซม. นั่งสบายตามหลักสรีรศาสตร์`
      : `⚠️ ระยะสายตา ${eyeDistanceCm} ซม. · มีจุดควรปรับเพื่อลดปวดหลัง/ตาล้า`;

  return {
    eyeDistanceCm,
    deskWidthCm: deskW,
    deskDepthCm: deskD,
    deskHeightCm: deskH,
    chairClearanceCm,
    status,
    headline,
    tips,
  };
}

export interface PowerEstimate {
  totalWatts: number;
  plugCount: number;
  usbCount: number;
  monthlyUnitKwh: number;
  monthlyCostThb: number;
  recommendation: string;
  breakdown: Array<{ name: string; category: string; watts: number; plugs: number }>;
}

const POWER_SPECS: Record<string, { watts: number; plugs: number; usb: number }> = {
  computer: { watts: 450, plugs: 1, usb: 0 },
  monitor: { watts: 45, plugs: 1, usb: 0 },
  speaker: { watts: 30, plugs: 1, usb: 0 },
  lighting: { watts: 15, plugs: 1, usb: 1 },
  microphone: { watts: 8, plugs: 0, usb: 1 },
  keyboard: { watts: 5, plugs: 0, usb: 1 },
  mouse: { watts: 3, plugs: 0, usb: 1 },
  headphone: { watts: 5, plugs: 0, usb: 1 },
};

/**
 * คำนวณจำนวนปลั๊กไฟ กำลังไฟรวม (Watts) และค่าไฟโดยประมาณของอุปกรณ์ในห้อง 3D
 */
export function estimateRoomPower(items: PlanItem[]): PowerEstimate {
  let totalWatts = 0;
  let plugCount = 0;
  let usbCount = 0;
  const breakdown: Array<{ name: string; category: string; watts: number; plugs: number }> = [];

  for (const it of items) {
    const spec = POWER_SPECS[it.category];
    if (spec) {
      totalWatts += spec.watts;
      plugCount += spec.plugs;
      usbCount += spec.usb;
      breakdown.push({ name: it.name, category: it.category, watts: spec.watts, plugs: spec.plugs });
    } else if (it.category === "desk" && /ปรับระดับ|ไฟฟ้า|motor|ergonomic/i.test(it.name)) {
      totalWatts += 80;
      plugCount += 1;
      breakdown.push({ name: it.name, category: it.category, watts: 80, plugs: 1 });
    }
  }

  // ถ้ายังไม่มีอุปกรณ์ไฟฟ้าเลย ให้ค่าเริ่มต้นของเซ็ตมาตรฐาน
  if (plugCount === 0 && totalWatts === 0) {
    totalWatts = 350;
    plugCount = 3;
    usbCount = 2;
  }

  // คิดค่าไฟเฉลี่ยใช้งานวันละ 6 ชม. × 30 วัน (หน่วยละ 4.4 บาท)
  const monthlyUnitKwh = Math.round(((totalWatts * 0.65 * 6 * 30) / 1000) * 10) / 10;
  const monthlyCostThb = Math.round(monthlyUnitKwh * 4.4);

  const recommendedSockets = Math.max(4, plugCount + 2);
  const recommendation =
    totalWatts > 1200
      ? `แนะนำรางปลั๊กไฟ มอก. ${recommendedSockets} ช่อง รองรับ 2,500W–3,500W (สายไฟขนาด 1.5 sq.mm.) + UPS สำรองไฟ`
      : `แนะนำรางปลั๊กไฟ มอก. ${recommendedSockets} ช่อง (เผื่อชาร์จมือถือ/อะแดปเตอร์) รองรับ 2,300W ขึ้นไป`;

  return {
    totalWatts,
    plugCount,
    usbCount,
    monthlyUnitKwh,
    monthlyCostThb,
    recommendation,
    breakdown,
  };
}

/**
 * สร้างใบเสนอราคา & แปลนห้อง 2D+3D สำหรับสั่งพิมพ์หรือบันทึกเป็น PDF A4 (1-Click Quotation & Blueprint PDF)
 */
export async function openPrintableQuotationPdf(
  snapshotBlob: Blob | null,
  room: RoomSize,
  items: PlanItem[],
  totalPrice: number
): Promise<void> {
  let dataUrl = "";
  if (snapshotBlob) {
    dataUrl = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => resolve("");
      fr.readAsDataURL(snapshotBlob);
    });
  }

  const erg = analyzeErgonomics(items, room);
  const pwr = estimateRoomPower(items);
  const validItems = items.filter((i) => i.category !== "door");
  const areaSqm = ((room.w * room.d) / 10000).toFixed(2);
  const dateStr = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // วาดแปลน 2D SVG พร้อมขนาด
  const svgW = 360;
  const svgH = 270;
  const pad = 28;
  const scale = Math.min((svgW - pad * 2) / room.w, (svgH - pad * 2) / room.d);
  const rw = Math.round(room.w * scale);
  const rd = Math.round(room.d * scale);
  const ox = Math.round((svgW - rw) / 2);
  const oy = Math.round((svgH - rd) / 2);

  const rectsSvg = validItems
    .map((it, idx) => {
      const fp = footprint(it);
      const iw = Math.max(12, Math.round(fp.w * scale));
      const id = Math.max(12, Math.round(fp.d * scale));
      const ix = Math.round(ox + it.x * scale - iw / 2);
      const iy = Math.round(oy + it.z * scale - id / 2);
      return `<g>
        <rect x="${ix}" y="${iy}" width="${iw}" height="${id}" rx="4" fill="#dbeafe" stroke="#0050ff" stroke-width="1.5" />
        <text x="${ix + iw / 2}" y="${iy + id / 2 + 4}" font-size="10" font-weight="700" text-anchor="middle" fill="#0a192f">${idx + 1}</text>
      </g>`;
    })
    .join("");

  const rowsHtml = validItems
    .map((it, idx) => {
      const catLabel = (CATEGORY_LABELS as Record<string, string>)[it.category] || it.category;
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0050ff;">${idx + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${catLabel}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${it.name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#475569;">${Math.round(it.w)}×${Math.round(it.d)}×${Math.round(it.h)} ซม.</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0f172a;">${it.price > 0 ? formatTHB(it.price) : "ของเดิมในห้อง"}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบสรุปแปลนห้อง 3D & ใบเสนอราคา — ComproNext</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: system-ui, -apple-system, 'Noto Sans Thai', sans-serif; color: #0f172a; margin: 0; padding: 16px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0050ff; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-size: 22px; font-weight: 900; color: #0a192f; letter-spacing: -0.02em; }
    .sub { font-size: 12px; color: #475569; margin-top: 2px; }
    .grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; margin-bottom: 14px; }
    .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px; background: #f8fafc; }
    .box-title { font-size: 12px; font-weight: 800; color: #1e3a5f; margin-bottom: 6px; text-transform: uppercase; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
    .stat { border: 1px solid #dbeafe; background: #eff6ff; border-radius: 10px; padding: 8px 12px; }
    .stat-label { font-size: 11px; color: #1e40af; font-weight: 700; }
    .stat-val { font-size: 15px; font-weight: 900; color: #0a192f; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #0a192f; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; }
    .total-bar { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; background: #e8f1ff; border: 2px solid #0050ff; border-radius: 12px; padding: 12px 16px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:12px;display:flex;justify-content:flex-end;gap:8px;">
    <button onclick="window.print()" style="background:#0050ff;color:#fff;border:none;border-radius:99px;padding:8px 18px;font-weight:700;cursor:pointer;">🖨️ พิมพ์ / บันทึกเป็น PDF</button>
    <button onclick="window.close()" style="background:#e2e8f0;color:#0f172a;border:none;border-radius:99px;padding:8px 16px;font-weight:600;cursor:pointer;">ปิดหน้าต่าง</button>
  </div>
  <div class="header">
    <div>
      <div class="brand">COMPRONEXT · 3D ROOM BLUEPRINT & QUOTATION</div>
      <div class="sub">ใบสรุปแปลนจัดห้อง 3D รายการเฟอร์นิเจอร์ และการคำนวณระยะสรีรศาสตร์</div>
    </div>
    <div style="text-align:right;font-size:12px;">
      <div><strong>วันที่ออกเอกสาร:</strong> ${dateStr}</div>
      <div><strong>ขนาดห้องจริง:</strong> ${(room.w / 100).toFixed(2)} × ${(room.d / 100).toFixed(2)} × ${(room.h / 100).toFixed(2)} ม. (${areaSqm} ตร.ม.)</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="box-title">1. ภาพจำลองมุมมอง 3D (3D Perspective Render)</div>
      ${dataUrl ? `<img src="${dataUrl}" style="width:100%;height:230px;object-fit:cover;border-radius:8px;border:1px solid #cbd5e1;" />` : `<div style="height:230px;display:flex;align-items:center;justify-content:center;color:#64748b;">ไม่มีภาพตัวอย่าง</div>`}
    </div>
    <div class="box">
      <div class="box-title">2. แปลนห้องมุมสูง 2D ตามสัดส่วนจริง (ตัวเลขตรงตามตาราง)</div>
      <svg width="100%" height="230" viewBox="0 0 ${svgW} ${svgH}" style="background:#fff;border-radius:8px;border:1px solid #cbd5e1;">
        <rect x="${ox}" y="${oy}" width="${rw}" height="${rd}" fill="#f8fafc" stroke="#0f172a" stroke-width="2.5" />
        <text x="${ox + rw / 2}" y="${oy - 8}" font-size="11" font-weight="700" text-anchor="middle" fill="#0f172a">กว้าง ${(room.w / 100).toFixed(2)} ม. (${room.w} ซม.)</text>
        <text x="${ox - 8}" y="${oy + rd / 2}" font-size="11" font-weight="700" text-anchor="middle" fill="#0f172a" transform="rotate(-90 ${ox - 8} ${oy + rd / 2})">ลึก ${(room.d / 100).toFixed(2)} ม. (${room.d} ซม.)</text>
        ${rectsSvg}
      </svg>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">👁️ ระยะสายตาถึงจอ (Ergonomics)</div>
      <div class="stat-val">~${erg.eyeDistanceCm} ซม. (${erg.status === "good" ? "เหมาะสม" : "ควรปรับระยะ"})</div>
    </div>
    <div class="stat">
      <div class="stat-label">⚡ กำลังไฟรวม & ปลั๊กไฟที่ใช้</div>
      <div class="stat-val">~${pwr.totalWatts} W · ใช้ปลั๊ก ${pwr.plugCount} ช่อง</div>
    </div>
    <div class="stat">
      <div class="stat-label">🔌 คำแนะนำระบบไฟ</div>
      <div class="stat-val" style="font-size:12px;font-weight:700;">รางปลั๊ก มอก. อย่างน้อย ${Math.max(4, pwr.plugCount + 2)} ช่อง (~${pwr.monthlyCostThb} ฿/เดือน)</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:36px;">#</th>
        <th style="width:110px;">หมวดหมู่</th>
        <th>รายการเฟอร์นิเจอร์ / อุปกรณ์</th>
        <th style="width:130px;text-align:center;">ขนาดจริง (ก×ล×ส)</th>
        <th style="width:110px;text-align:right;">ราคาประมาณการ</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="5" style="padding:16px;text-align:center;color:#64748b;">ยังไม่มีรายการเฟอร์นิเจอร์ในห้อง</td></tr>`}
    </tbody>
  </table>

  <div class="total-bar">
    <div>
      <div style="font-size:13px;font-weight:700;color:#1e3a5f;">งบประมาณรวมทั้งห้อง (${validItems.length} รายการ)</div>
      <div style="font-size:11px;color:#475569;">${erg.tips[0] || ""}</div>
    </div>
    <div style="font-size:24px;font-weight:900;color:#0050ff;">${formatTHB(totalPrice)}</div>
  </div>
  <script>setTimeout(() => { window.print(); }, 350);</script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=960,height=800");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

const SHARED_PLAN_KEY = "cn-room-plan-v1";

/**
 * ส่งสินค้าชิ้นเดียวจากหน้าสินค้า (/products/[id]) เข้าไปวางในห้อง 3D ของลูกค้าทันที
 */
export function addProductToSaved3DRoom(prod: {
  id: string;
  name: string;
  category: string;
  price?: number;
  imageUrl?: string | null;
  dimensions?: { width: number | null; depth: number | null; height: number | null; unit?: string } | null;
  colors?: string[];
}): { room: RoomSize; items: PlanItem[]; addedItem: PlanItem } {
  let room: RoomSize = DEFAULT_ROOM;
  let existingItems: PlanItem[] = [];
  let roomSet = false;
  try {
    const raw = window.localStorage.getItem(SHARED_PLAN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { room?: RoomSize; items?: PlanItem[]; roomSet?: boolean };
      if (parsed.room && typeof parsed.room.w === "number") room = parsed.room;
      if (Array.isArray(parsed.items)) existingItems = parsed.items;
      roomSet = !!parsed.roomSet;
    }
  } catch {
    /* ignore */
  }

  const newItem = itemFromProduct(prod);
  const placed = placeNew(existingItems, [newItem], room);
  const nextItems = [...existingItems, ...placed];

  try {
    window.localStorage.setItem(
      SHARED_PLAN_KEY,
      JSON.stringify({ room, roomSet: roomSet || true, items: nextItems, at: Date.now() })
    );
  } catch {
    /* ignore */
  }

  return { room, items: nextItems, addedItem: placed[0] ?? newItem };
}

/**
 * ก๊อปปี้เซ็ตสินค้าทั้งห้องจากหน้าไอเดียห้อง (/rooms/[slug]) เข้าไปจัดเรียงในขนาดห้อง 3D ของลูกค้าทันที
 */
export function copyRoomSetToSaved3DRoom(
  products: Array<{
    id: string;
    name: string;
    category: string;
    price?: number;
    imageUrl?: string | null;
    dimensions?: { width: number | null; depth: number | null; height: number | null; unit?: string } | null;
    colors?: string[];
  }>
): { room: RoomSize; items: PlanItem[] } {
  let room: RoomSize = DEFAULT_ROOM;
  let roomSet = false;
  try {
    const raw = window.localStorage.getItem(SHARED_PLAN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { room?: RoomSize; roomSet?: boolean };
      if (parsed.room && typeof parsed.room.w === "number") room = parsed.room;
      roomSet = !!parsed.roomSet;
    }
  } catch {
    /* ignore */
  }

  const rawItems = products.map((p) => itemFromProduct(p));
  const placedItems = autoLayout(rawItems, room);

  try {
    window.localStorage.setItem(
      SHARED_PLAN_KEY,
      JSON.stringify({ room, roomSet: roomSet || true, items: placedItems, at: Date.now() })
    );
  } catch {
    /* ignore */
  }

  return { room, items: placedItems };
}
