/**
 * เช็กคุณภาพรูปห้อง + ปรับแสงอัตโนมัติ (ทำในเบราว์เซอร์ ไม่ส่งรูปไปไหน)
 * ช่วยคนที่กล้องมือถือไม่ดี / ถ่ายในห้องมืด
 */

export interface PhotoStats {
  /** ความสว่างเฉลี่ย 0–255 */
  brightness: number;
  /** ความต่างแสง (ส่วนเบี่ยงเบน) */
  contrast: number;
  /** ความคม (ความแปรปรวนของขอบภาพ) — ต่ำ = เบลอ */
  sharpness: number;
  width: number;
  height: number;
}

export interface PhotoAdvice {
  dark: boolean;
  flat: boolean;
  blurry: boolean;
  small: boolean;
  /** ควรปรับแสงอัตโนมัติไหม */
  enhance: boolean;
  tips: string[];
}

/** แปลงค่าสถิติเป็นคำแนะนำ (แยกจาก DOM เพื่อทดสอบได้) */
export function adviseFromStats(s: PhotoStats): PhotoAdvice {
  const dark = s.brightness < 85;
  const flat = s.contrast < 38;
  const blurry = s.sharpness < 60;
  const small = Math.max(s.width, s.height) < 640;
  const tips: string[] = [];
  if (dark) tips.push("รูปมืด — ระบบปรับแสงให้แล้ว ถ้าถ่ายใหม่ลองเปิดไฟ/ม่านก่อน");
  else if (flat) tips.push("รูปซีดจาง — ระบบเพิ่มความคมชัดของสีให้แล้ว");
  if (blurry) tips.push("รูปเบลอ — ถือมือถือนิ่งๆ 1 วินาที เช็ดเลนส์ หรือใช้ “ห้อง 3D จัดเอง” แทน");
  if (small) tips.push("รูปเล็ก/ความละเอียดต่ำ — AI จะเห็นรายละเอียดห้องน้อย");
  return { dark, flat, blurry, small, enhance: dark || flat, tips };
}

/** ค่า brightness/contrast ที่จะใช้ปรับ (จำกัดไม่ให้แรงเกินจนภาพแตก) */
export function enhanceParams(s: Pick<PhotoStats, "brightness" | "contrast">): { brightness: number; contrast: number; saturate: number } {
  const brightness = Math.min(1.7, Math.max(1, 118 / Math.max(30, s.brightness)));
  const contrast = Math.min(1.35, Math.max(1, 52 / Math.max(20, s.contrast)));
  return { brightness: Math.round(brightness * 100) / 100, contrast: Math.round(contrast * 100) / 100, saturate: 1.08 };
}

async function bitmapOf(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export async function measurePhoto(file: Blob): Promise<PhotoStats> {
  const bmp = await bitmapOf(file);
  const S = 160;
  const k = S / Math.max(bmp.width, bmp.height);
  const w = Math.max(8, Math.round(bmp.width * k));
  const h = Math.max(8, Math.round(bmp.height * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const v = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    lum[i] = v;
    sum += v;
  }
  const mean = sum / (w * h);
  let varSum = 0;
  for (let i = 0; i < w * h; i++) varSum += (lum[i] - mean) ** 2;
  // Laplacian variance = ความคม
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = lum[i - 1] + lum[i + 1] + lum[i - w] + lum[i + w] - 4 * lum[i];
      lapSum += l;
      lapSq += l * l;
      n++;
    }
  const lapMean = lapSum / n;
  const out = { brightness: mean, contrast: Math.sqrt(varSum / (w * h)), sharpness: lapSq / n - lapMean * lapMean, width: bmp.width, height: bmp.height };
  bmp.close();
  return out;
}

/** ปรับแสง/สีทั้งรูป แล้วคืนไฟล์ JPEG ใหม่ */
export async function enhancePhoto(file: Blob, s: PhotoStats): Promise<Blob> {
  const bmp = await bitmapOf(file);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const g = c.getContext("2d")!;
  const p = enhanceParams(s);
  g.filter = `brightness(${p.brightness}) contrast(${p.contrast}) saturate(${p.saturate})`;
  g.drawImage(bmp, 0, 0);
  bmp.close();
  return new Promise((resolve) => c.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.9));
}
