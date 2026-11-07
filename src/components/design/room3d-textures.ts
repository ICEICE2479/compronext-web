import * as THREE from "three";

/**
 * ลายวัสดุสำหรับห้อง 3D (วาดด้วย canvas ครั้งเดียว แคชไว้ใช้ซ้ำ ไม่ต้องโหลดไฟล์)
 * ไม้ · ผ้า · ผนังฉาบ · พรม · หน้าจอ · ปุ่มคีย์บอร์ด · ใบไม้
 */
const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/** ไม้: เสี้ยนยาว + ปุ่มไม้ ตามสีฐาน */
export function woodTex(base: string) {
  return make(`wood-${base}`, 512, 512, (g, w, h) => {
    const r = rng(17);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const y = r() * h;
      g.strokeStyle = shade(base, 0.7 + r() * 0.25) + Math.round(30 + r() * 60).toString(16).padStart(2, "0");
      g.lineWidth = 0.6 + r() * 2;
      g.beginPath();
      for (let x = 0; x <= w; x += 12) g.lineTo(x, y + Math.sin(x / (40 + r() * 60) + i) * (1.5 + r() * 4));
      g.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const cx = r() * w;
      const cy = r() * h;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 22);
      gr.addColorStop(0, shade(base, 0.55) + "99");
      gr.addColorStop(1, shade(base, 0.55) + "00");
      g.fillStyle = gr;
      g.fillRect(cx - 30, cy - 30, 60, 60);
    }
  });
}

/** ผ้า: ลายทอละเอียด */
export function fabricTex(base: string) {
  return make(`fabric-${base}`, 256, 256, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
      g.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) {
      g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`;
      g.fillRect(x, 0, 1, h);
    }
  });
}

/** ผนังฉาบ: จุดด่างอ่อนๆ ให้ไม่แบนเรียบเกินจริง */
export function plasterTex(base: string) {
  return make(`plaster-${base}`, 512, 512, (g, w, h) => {
    const r = rng(29);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)";
      const s = 1 + r() * 3;
      g.fillRect(r() * w, r() * h, s, s);
    }
  });
}

/** พรม: ขอบ + ลายเรขาคณิต */
export function rugTex(base: string) {
  return make(`rug-${base}`, 512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = shade(base, 1.25);
    g.lineWidth = 14;
    g.strokeRect(24, 24, w - 48, h - 48);
    g.strokeStyle = shade(base, 0.75);
    g.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(70, 80 + i * 70);
      for (let x = 70; x <= w - 70; x += 40) g.lineTo(x, 80 + i * 70 + ((x / 40) % 2 ? 20 : -20));
      g.stroke();
    }
    const r = rng(3);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

/** หน้าจอ: วอลเปเปอร์ + หน้าต่างโปรแกรม */
export function screenTex(night: boolean) {
  return make(`screen-${night}`, 512, 288, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, night ? "#1e1b4b" : "#0c4a6e");
    bg.addColorStop(1, night ? "#7c3aed" : "#38bdf8");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.88)";
    g.fillRect(w * 0.12, h * 0.16, w * 0.5, h * 0.55);
    g.fillStyle = "rgba(15,23,42,0.85)";
    g.fillRect(w * 0.12, h * 0.16, w * 0.5, 14);
    g.fillStyle = "rgba(37,99,235,0.6)";
    for (let i = 0; i < 4; i++) g.fillRect(w * 0.15, h * 0.28 + i * 26, w * (0.2 + (i % 2) * 0.15), 12);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(0, h - 18, w, 18);
  });
}

/** ปุ่มคีย์บอร์ด */
export function keysTex() {
  return make("keys", 512, 160, (g, w, h) => {
    g.fillStyle = "#16181c";
    g.fillRect(0, 0, w, h);
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const n = r === 4 ? 7 : 14;
      let x = 4;
      const kw = (w - 8) / n;
      for (let i = 0; i < n; i++) {
        const ww = r === 4 && i === 3 ? kw * 4 : kw;
        g.fillStyle = "#3b4048";
        g.beginPath();
        g.roundRect(x + 2, r * (h / rows) + 3, ww - 4, h / rows - 6, 4);
        g.fill();
        x += ww;
        if (x > w - 8) break;
      }
    }
  });
}
