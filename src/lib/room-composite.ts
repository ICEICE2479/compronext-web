/**
 * ภาพจำลองแบบ "วางสินค้าลงในรูปห้อง" (ไม่ใช้ AI — ทำในเบราว์เซอร์)
 * ใช้ตอนบริการสร้างภาพ AI ใช้ไม่ได้ ลูกค้ายังเห็นภาพห้องพร้อมของที่แนะนำ และแตะจุดเพื่อดู/ซื้อได้ครบ
 */
import type { Spot } from "./hotspots";
import { displayImageSrc } from "./own-storage";

/** ความกว้างของสินค้าเทียบกับความกว้างภาพ (ประมาณจากมุมกล้องระดับสายตา) */
const WIDTH_FRAC: Record<string, number> = {
  desk: 0.5,
  chair: 0.2,
  monitor: 0.22,
  monitor_arm: 0.12,
  keyboard: 0.17,
  mouse: 0.045,
  mousepad: 0.22,
  speaker: 0.07,
  headphone: 0.08,
  microphone: 0.06,
  webcam: 0.05,
  lighting: 0.1,
  storage: 0.18,
  wardrobe: 0.22,
  bed: 0.5,
  rug: 0.55,
  decor: 0.08,
  fake_plant: 0.1,
  real_plant: 0.1,
  plant_pot: 0.08,
  computer: 0.13,
};
const DEFAULT_FRAC = 0.12;
/** ของที่วางบนพื้น/ผนังด้านหลังให้วาดก่อน (ของชิ้นเล็กบนโต๊ะทับทีหลัง) */
const LAYER: Record<string, number> = { rug: 0, wardrobe: 1, storage: 1, bed: 1, desk: 2, chair: 4 };

export interface CompositeItem {
  id: string;
  category: string;
  imageUrl: string | null;
}

/** รูปจากร้านภายนอกต้องผ่าน /api/cutout (ตัดพื้นหลัง + อยู่โดเมนเดียวกัน วาดลง canvas ได้) */
export function compositeSrc(url: string): string {
  return displayImageSrc(url);
}

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const t = window.setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      window.clearTimeout(t);
      resolve(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      resolve(null);
    };
    img.src = src;
  });
}

/** รูปพื้นขาว (ยังไม่ได้ตัดพื้นหลัง) → ทำพื้นขาวให้โปร่ง ขอบนุ่ม */
function keyWhite(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  try {
    const d = g.getImageData(0, 0, w, h);
    const px = d.data;
    const corner = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      return px[i + 3] > 200 && px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235;
    };
    if (corner(0, 0) && corner(w - 1, 0) && corner(0, h - 1) && corner(w - 1, h - 1)) {
      for (let i = 0; i < px.length; i += 4) {
        const m = Math.min(px[i], px[i + 1], px[i + 2]);
        if (m > 244) px[i + 3] = 0;
        else if (m > 228) px[i + 3] = Math.round(px[i + 3] * ((244 - m) / 16));
      }
      g.putImageData(d, 0, 0);
    }
  } catch {
    /* รูปข้ามโดเมน อ่านพิกเซลไม่ได้ → ใช้ตามเดิม */
  }
  return c;
}

/**
 * วาดภาพห้อง + สินค้า → คืน data URL (JPEG) หรือ null ถ้าวาดไม่ได้เลย
 * spot = จุดกึ่งกลางของสินค้า (% ของภาพ) เดียวกับจุดแตะบนภาพ
 */
export async function composeRoomPreview(photoUrl: string, items: CompositeItem[], spots: Record<string, Spot>, maxSide = 1400): Promise<string | null> {
  const room = await load(photoUrl);
  if (!room) return null;
  const k = Math.min(1, maxSide / Math.max(room.naturalWidth, room.naturalHeight));
  const W = Math.round(room.naturalWidth * k);
  const H = Math.round(room.naturalHeight * k);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.drawImage(room, 0, 0, W, H);

  const list = items
    .filter((it) => it.imageUrl && spots[it.id])
    .sort((a, b) => (LAYER[a.category] ?? 3) - (LAYER[b.category] ?? 3) || spots[a.id].y - spots[b.id].y);
  const loaded = await Promise.all(list.map((it) => load(compositeSrc(it.imageUrl!))));
  let drawn = 0;

  // คำนวณตำแหน่งโต๊ะหลักล่วงหน้า (เพราะพรม LAYER=0 วาดก่อนโต๊ะ LAYER=2)
  let deskBox: { cx: number; topY: number; bottomY: number; w: number } | null = null;
  const deskIdx = list.findIndex((it) => it.category === "desk");
  if (deskIdx >= 0 && loaded[deskIdx]) {
    const dIt = list[deskIdx]!;
    const dImg = loaded[deskIdx]!;
    const dSp = spots[dIt.id]!;
    const dDepth = 0.85 + (dSp.y / 100) * 0.35;
    const dW = Math.round(W * (WIDTH_FRAC.desk ?? DEFAULT_FRAC) * dDepth);
    const dH = Math.round((dW * dImg.naturalHeight) / dImg.naturalWidth);
    const dCx = (dSp.x / 100) * W;
    const dCy = Math.max(H * 0.64, Math.min(H * 0.78, (dSp.y / 100) * H));
    deskBox = { cx: dCx, topY: dCy - dH * 0.42, bottomY: dCy + dH * 0.48, w: dW };
  }

  list.forEach((it, i) => {
    const img = loaded[i];
    if (!img) return;
    const sp = spots[it.id];
    const isDesktopItem = ["monitor", "monitor_arm", "keyboard", "mouse", "mousepad", "speaker", "headphone", "lighting", "decor"].includes(it.category);
    const depth = 0.85 + (sp.y / 100) * 0.35;
    const w = Math.round(W * (WIDTH_FRAC[it.category] ?? DEFAULT_FRAC) * depth);
    const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
    if (w < 8 || h < 8) return;

    let cx = (sp.x / 100) * W;
    let cy = (sp.y / 100) * H;

    if (it.category === "desk") {
      cy = Math.max(H * 0.64, Math.min(H * 0.78, cy));
    } else if (it.category === "chair" && deskBox) {
      cx = deskBox.cx + W * 0.02;
      cy = Math.min(H - h * 0.48, deskBox.bottomY - h * 0.12);
    } else if (it.category === "rug" && deskBox) {
      cx = deskBox.cx;
      cy = Math.min(H - h * 0.35, deskBox.bottomY + h * 0.12);
    } else if (it.category === "storage" && deskBox) {
      const side = sp.x < deskBox.cx / W * 100 ? -1 : 1;
      cx = Math.max(w * 0.6, Math.min(W - w * 0.6, deskBox.cx + side * (deskBox.w * 0.62 + w * 0.45)));
      cy = Math.max(h * 0.55, deskBox.bottomY - h * 0.48);
    } else if (isDesktopItem && deskBox) {
      if (it.category === "monitor" || it.category === "monitor_arm") {
        cx = deskBox.cx;
        cy = deskBox.topY - h * 0.32;
      } else if (it.category === "lighting") {
        cx = deskBox.cx - deskBox.w * 0.36;
        cy = deskBox.topY - h * 0.28;
      } else if (it.category === "speaker") {
        cx = deskBox.cx + deskBox.w * 0.34;
        cy = deskBox.topY - h * 0.18;
      } else {
        cy = deskBox.topY + h * 0.05;
      }
    }

    const x = Math.round(Math.max(8, Math.min(W - w - 8, cx - w / 2)));
    const y = Math.round(Math.min(H - h - 4, Math.max(8, cy - h / 2)));

    // เงาสัมผัสพื้น/โต๊ะสมจริง
    g.save();
    g.globalAlpha = it.category === "rug" ? 0.18 : 0.34;
    g.fillStyle = "#090d16";
    g.filter = "blur(12px)";
    g.beginPath();
    g.ellipse(x + w / 2, y + h - h * 0.04, w * 0.44, Math.max(5, h * 0.07), 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    g.save();
    g.shadowColor = "rgba(15,23,42,0.28)";
    g.shadowBlur = 14;
    g.shadowOffsetY = 5;
    g.drawImage(keyWhite(img, w, h), x, y, w, h);
    g.restore();
    drawn++;
  });
  if (!drawn) return null;
  try {
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null; // canvas ติด taint จากรูปข้ามโดเมน
  }
}
