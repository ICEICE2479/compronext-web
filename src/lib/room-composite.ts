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
  list.forEach((it, i) => {
    const img = loaded[i];
    if (!img) return;
    const sp = spots[it.id];
    // ของที่อยู่ล่างภาพ (ใกล้กล้อง) ใหญ่ขึ้นนิด ให้ดูมีระยะ
    const depth = 0.8 + (sp.y / 100) * 0.4;
    const w = Math.round(W * (WIDTH_FRAC[it.category] ?? DEFAULT_FRAC) * depth);
    const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
    if (w < 8 || h < 8) return;
    const cx = (sp.x / 100) * W;
    const cy = (sp.y / 100) * H;
    const x = Math.round(cx - w / 2);
    const y = Math.round(Math.min(H - h, Math.max(0, cy - h / 2)));
    // เงาใต้ของ
    g.save();
    g.globalAlpha = 0.28;
    g.fillStyle = "#000";
    g.filter = "blur(10px)";
    g.beginPath();
    g.ellipse(cx, y + h - h * 0.03, w * 0.42, Math.max(4, h * 0.06), 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.save();
    g.shadowColor = "rgba(0,0,0,0.25)";
    g.shadowBlur = 12;
    g.shadowOffsetY = 4;
    g.drawImage(keyWhite(img, w, h), x, y, w, h);
    g.restore();
    drawn++;
  });
  if (!drawn) return null;
  try {
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return null; // canvas ติด taint จากรูปข้ามโดเมน
  }
}
