import * as THREE from "three";
import { displayPhotoSrc } from "@/lib/own-storage";
import { isGuessedColor, type PlanItem } from "@/lib/room-planner";

/**
 * “หน้าตาจริง” ของสินค้าจากรูปสินค้าจริง → ใส่ให้โมเดล 3D ในห้อง
 * - สีตัวสินค้า (สีที่เยอะที่สุดในรูป ไม่นับพื้นหลัง) → แทนสีเดาจากหมวด
 * - รูปที่ครอปเฉพาะตัวของ → ใช้เป็นลายพรม / รูปในกรอบรูป-โปสเตอร์
 * โหลดครั้งเดียวต่อสินค้า (แคชในหน่วยความจำ) แล้วแจ้งให้ห้อง 3D สร้างชิ้นนั้นใหม่
 */
export interface ProductLook {
  /** สีหลักของตัวสินค้า (#rrggbb) */
  body: string;
  /** สีกลาง (ดำ/ขาว/เทา/เงิน) ไหม — จอ/เคสคอมใช้เฉพาะสีกลาง กันสีจากภาพหน้าจอ/ไฟ RGB */
  neutral: boolean;
  /** รูปเฉพาะตัวของ (ตัดขอบพื้นหลังออก) */
  photo: THREE.CanvasTexture | null;
}

const cache = new Map<string, ProductLook | "loading" | "fail">();
const listeners = new Set<() => void>();

export function subscribeLooks(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** หน้าตาจริงของสินค้า (ยังไม่มี = เริ่มโหลด แล้วแจ้งผ่าน subscribeLooks) */
export function lookFor(it: Pick<PlanItem, "productId" | "imageUrl">): ProductLook | null {
  const url = it.imageUrl;
  if (!url || !/^https?:\/\//.test(url) || typeof window === "undefined") return null;
  const key = it.productId || url;
  const got = cache.get(key);
  if (got === undefined) {
    cache.set(key, "loading");
    load(url)
      .then((look) => cache.set(key, look ?? "fail"))
      .catch(() => cache.set(key, "fail"))
      .finally(() => listeners.forEach((f) => f()));
    return null;
  }
  return typeof got === "object" ? got : null;
}

/** หมวดที่สีจากรูป = สีตัวของจริง (เฟอร์นิเจอร์/ของแต่ง/อุปกรณ์) */
const COLOR_FROM_PHOTO = new Set(["chair", "bed", "wardrobe", "storage", "desk", "decor", "lighting", "speaker", "headphone", "mouse", "keyboard", "mousepad", "keyboard_pad", "rug", "microphone", "webcam", "plant_pot", "monitor_arm", "other"]);
/** หมวดที่รับเฉพาะสีกลาง (รูปมีจอเปิดภาพ/ไฟ RGB ปน) */
const NEUTRAL_ONLY = new Set(["monitor", "computer"]);

/** ชิ้นที่ใช้สร้างโมเดล: สีเดาจากหมวด → สีจริงจากรูป (สีจากชื่อสินค้า เช่น WHITE/BLACK หรือสีที่ผู้ใช้เลือกเอง ไม่ทับ) */
export function withLook(it: PlanItem, look: ProductLook | null): PlanItem {
  if (!look || !isGuessedColor(it)) return it;
  if (COLOR_FROM_PHOTO.has(it.category) || (NEUTRAL_ONLY.has(it.category) && look.neutral)) return { ...it, color: look.body };
  return it;
}

async function load(url: string): Promise<ProductLook | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = displayPhotoSrc(url);
  await img.decode();
  return analyze(img);
}

const S = 96;

function analyze(img: HTMLImageElement): ProductLook | null {
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  // วาดแบบคงสัดส่วนบนพื้นขาว (รูป PNG โปร่งใส = พื้นขาว)
  const k = Math.min(S / img.naturalWidth, S / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, S, S);
  g.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
  const px = g.getImageData(0, 0, S, S).data;

  // พื้นหลัง = สีที่มุมทั้ง 4
  const at = (x: number, y: number) => (y * S + x) * 4;
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (const [x, y] of [[1, 1], [S - 2, 1], [1, S - 2], [S - 2, S - 2]]) {
    const i = at(x, y);
    br += px[i] / 4;
    bg += px[i + 1] / 4;
    bb += px[i + 2] / 4;
  }
  const isBg = (i: number) => Math.abs(px[i] - br) + Math.abs(px[i + 1] - bg) + Math.abs(px[i + 2] - bb) < 42;

  // นับสีตัวของ (ปัดเป็นกลุ่ม 8 ระดับ/สี) + กรอบที่มีของ
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let x0 = S;
  let y0 = S;
  let x1 = -1;
  let y1 = -1;
  let total = 0;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = at(x, y);
      if (isBg(i)) continue;
      total++;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      const key = ((px[i] >> 5) << 6) | ((px[i + 1] >> 5) << 3) | (px[i + 2] >> 5);
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++;
      e.r += px[i];
      e.g += px[i + 1];
      e.b += px[i + 2];
      buckets.set(key, e);
    }
  if (total < S * S * 0.03) return null; // แทบไม่มีของในรูป
  const top = [...buckets.values()].sort((p, q) => q.n - p.n)[0];
  const r = Math.round(top.r / top.n);
  const gg = Math.round(top.g / top.n);
  const b = Math.round(top.b / top.n);
  const mx = Math.max(r, gg, b);
  const mn = Math.min(r, gg, b);
  const neutral = mx - mn < 28;
  const hex = `#${[r, gg, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

  // ครอปเฉพาะตัวของจากรูปเต็ม (ความละเอียดสูงกว่า) สำหรับลายพรม/รูปในกรอบ
  let photo: THREE.CanvasTexture | null = null;
  if (x1 > x0 && y1 > y0) {
    const sx = ((x0 - (S - dw) / 2) / k) | 0;
    const sy = ((y0 - (S - dh) / 2) / k) | 0;
    const sw = Math.min(img.naturalWidth - Math.max(0, sx), ((x1 - x0 + 1) / k) | 0);
    const sh = Math.min(img.naturalHeight - Math.max(0, sy), ((y1 - y0 + 1) / k) | 0);
    if (sw > 8 && sh > 8) {
      const kk = Math.min(1, 512 / Math.max(sw, sh));
      const cc = document.createElement("canvas");
      cc.width = Math.round(sw * kk);
      cc.height = Math.round(sh * kk);
      cc.getContext("2d")?.drawImage(img, Math.max(0, sx), Math.max(0, sy), sw, sh, 0, 0, cc.width, cc.height);
      photo = new THREE.CanvasTexture(cc);
      photo.colorSpace = THREE.SRGBColorSpace;
      photo.anisotropy = 4;
    }
  }
  return { body: hex, neutral, photo };
}
