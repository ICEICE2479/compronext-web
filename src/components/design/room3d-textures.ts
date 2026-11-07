import * as THREE from "three";

/**
 * ลายวัสดุความละเอียดสูงสำหรับห้อง 3D (Photorealistic Procedural Textures)
 * ไม้ธรรมชาติ · หนังพรีเมียม · ผ้าทอ · พรมบาอุส · หน้าจอดิสเพลย์ 4K · ปุ่มคีย์บอร์ดเรืองแสง · ลำโพงเคฟลาร์ · ตะแกรงเคส PC
 */
const cache = new Map<string, THREE.CanvasTexture>();

function make(
  key: string,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  srgb = true
) {
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
  try {
    const c = new THREE.Color(hex);
    c.multiplyScalar(k);
    return `#${c.getHexString()}`;
  } catch {
    return hex;
  }
}

/** ไม้ธรรมชาติสมจริง: เสี้ยนไม้ละเอียด + วงปี + ตาไม้อ่อน + รูพรุนเสี้ยนตามยาว */
export function woodTex(base: string) {
  return make(`wood-v2-${base}`, 512, 512, (g, w, h) => {
    const r = rng(23);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // 1) เส้นแถบลายไม้หลัก (Wood annual growth bands)
    for (let i = 0; i < 35; i++) {
      const y = (i / 35) * h + (r() - 0.5) * 12;
      const bandAlpha = Math.round((0.08 + r() * 0.14) * 255)
        .toString(16)
        .padStart(2, "0");
      g.strokeStyle = shade(base, 0.72 + r() * 0.22) + bandAlpha;
      g.lineWidth = 4 + r() * 9;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const wave = Math.sin(x / 65 + i * 0.4) * 5 + Math.sin(x / 25) * 2;
        if (x === 0) g.moveTo(x, y + wave);
        else g.lineTo(x, y + wave);
      }
      g.stroke();
    }

    // 2) เสี้ยนไม้ละเอียดยาว (Fine wood grain capillaries)
    for (let i = 0; i < 280; i++) {
      const y = r() * h;
      const alphaHex = Math.round((0.15 + r() * 0.35) * 255)
        .toString(16)
        .padStart(2, "0");
      g.strokeStyle = (r() > 0.45 ? shade(base, 0.65) : shade(base, 1.25)) + alphaHex;
      g.lineWidth = 0.5 + r() * 1.5;
      g.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const offset = Math.sin(x / (35 + r() * 45) + i) * (1.2 + r() * 3.5);
        if (x === 0) g.moveTo(x, y + offset);
        else g.lineTo(x, y + offset);
      }
      g.stroke();
    }

    // 3) ตาไม้ธรรมชาติ (Organic wood knots)
    for (let k = 0; k < 2; k++) {
      const cx = (0.2 + r() * 0.6) * w;
      const cy = (0.2 + r() * 0.6) * h;
      const radius = 18 + r() * 16;
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, radius);
      gr.addColorStop(0, shade(base, 0.45) + "bb");
      gr.addColorStop(0.35, shade(base, 0.58) + "88");
      gr.addColorStop(0.7, shade(base, 0.8) + "33");
      gr.addColorStop(1, shade(base, 1.0) + "00");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(cx, cy, radius * 1.2, radius * 0.7, r() * 0.4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** หนังพรีเมียมสำหรับเก้าอี้และของตกแต่ง (Pebbled Leather Texture) */
export function leatherTex(base: string) {
  return make(`leather-${base}`, 256, 256, (g, w, h) => {
    const r = rng(41);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // เม็ดหนังเล็กละเอียด (Cellular pebble grain)
    for (let i = 0; i < 3200; i++) {
      const x = r() * w;
      const y = r() * h;
      const sz = 1.2 + r() * 2.2;
      const isHigh = r() > 0.5;
      g.fillStyle = isHigh ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
      g.beginPath();
      g.arc(x, y, sz / 2, 0, Math.PI * 2);
      g.fill();
    }

    // รอยย่นตามธรรมชาติ (Subtle organic creases)
    g.strokeStyle = "rgba(0,0,0,0.06)";
    g.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const x0 = r() * w;
      const y0 = r() * h;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(x0 + (r() - 0.5) * 30, y0 + (r() - 0.5) * 30, x0 + (r() - 0.5) * 50, y0 + (r() - 0.5) * 50);
      g.stroke();
    }
  });
}

/** ผ้าทอละเอียด (Woven Linen & Twill) */
export function fabricTex(base: string) {
  return make(`fabric-v2-${base}`, 256, 256, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 3) {
      g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.04})`;
      g.fillRect(0, y, w, 1.2);
    }
    for (let x = 0; x < w; x += 3) {
      g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.05})`;
      g.fillRect(x, 0, 1.2, h);
    }
    // สลับลายทอทแยง (Diagonal weave accent)
    for (let i = 0; i < w + h; i += 6) {
      g.strokeStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i - h, h);
      g.stroke();
    }
  });
}

/** โลหะปัดเงา (Brushed Anodized Aluminum / Stainless Steel) */
export function metalBrushedTex(color = "#334155") {
  return make(`metal-brushed-${color}`, 256, 256, (g, w, h) => {
    const r = rng(77);
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);

    for (let i = 0; i < 350; i++) {
      const y = r() * h;
      const alpha = 0.04 + r() * 0.08;
      g.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      g.lineWidth = 0.6 + r() * 1.2;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  });
}

/** แผ่นรองโต๊ะ Deskmat สไตล์ Topographic (Contour Map + Stitched Border) */
export function deskmatTex(base: string) {
  return make(`deskmat-${base}`, 512, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // เส้นโครงระดับความสูง (Topographic contour lines)
    g.lineWidth = 1.6;
    for (let k = 0; k < 9; k++) {
      const alpha = (0.12 + (k % 3) * 0.05).toFixed(2);
      g.strokeStyle = `rgba(255,255,255,${alpha})`;
      g.beginPath();
      for (let x = 0; x <= w; x += 14) {
        const y = h * 0.5 + Math.sin(x / 45 + k * 0.8) * (20 + k * 8) + Math.cos(x / 90) * 15;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }

    // ตะเข็บเย็บขอบกันลุ่ย (Overlock dashed stitched border)
    g.strokeStyle = "rgba(255,255,255,0.45)";
    g.lineWidth = 2.5;
    g.setLineDash([4, 4]);
    g.strokeRect(6, 6, w - 12, h - 12);
    g.setLineDash([]);
  });
}

/** ดอกลำโพง Kevlar Woven Cone + กรวยตรงกลาง */
export function speakerConeTex() {
  return make("speaker-cone-v1", 256, 256, (g, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 8;

    // ขอบยางด้านนอก (Outer rubber roll surround)
    const grEdge = g.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
    grEdge.addColorStop(0, "#18181b");
    grEdge.addColorStop(0.5, "#383c44");
    grEdge.addColorStop(1, "#09090b");
    g.fillStyle = grEdge;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();

    // ตัวกรวย Kevlar ทอสีเหลืองทองอมดำ (Woven Kevlar weave cone)
    const grCone = g.createRadialGradient(cx, cy, r * 0.28, cx, cy, r * 0.78);
    grCone.addColorStop(0, "#27272a");
    grCone.addColorStop(0.6, "#d97706");
    grCone.addColorStop(1, "#78350f");
    g.fillStyle = grCone;
    g.beginPath();
    g.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
    g.fill();

    // เส้นสานใยเคฟลาร์ (Kevlar woven grid)
    g.strokeStyle = "rgba(0,0,0,0.3)";
    g.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r * 0.28, cy + Math.sin(a) * r * 0.28);
      g.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
      g.stroke();
    }

    // ฝาครอบกันฝุ่นตรงกลาง (Center dust cap)
    const grDust = g.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, r * 0.32);
    grDust.addColorStop(0, "#3f3f46");
    grDust.addColorStop(0.8, "#18181b");
    grDust.addColorStop(1, "#09090b");
    g.fillStyle = grDust;
    g.beginPath();
    g.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
    g.fill();
  });
}

/** ตะแกรงรวงผึ้งระบายอากาศเคสคอมพิวเตอร์ (Hex Airflow Mesh) */
export function pcMeshTex() {
  return make("pc-mesh-hex", 128, 128, (g, w, h) => {
    g.fillStyle = "#111317";
    g.fillRect(0, 0, w, h);

    g.fillStyle = "#272a31";
    const r = 4;
    const dy = r * 1.732;
    for (let y = 0; y < h + dy; y += dy) {
      const row = Math.floor(y / dy);
      const shift = (row % 2) * (r * 1.5);
      for (let x = 0; x < w + r * 3; x += r * 3) {
        g.beginPath();
        g.arc(x + shift, y, r * 0.72, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
}

/** หน้าจอระดับ 4K แสดงสภาพแวดล้อม Desktop สุดล้ำ (VS Code + Visualizer + Widgets) */
export function screenTex(night: boolean) {
  return make(`screen-v2-${night}`, 1024, 576, (g, w, h) => {
    // 1) ภาพพื้นหลัง Wallpaper สุดงดงาม (Synthwave Dusk / Cyber Gradient)
    const bg = g.createLinearGradient(0, 0, w, h);
    if (night) {
      bg.addColorStop(0, "#090d16");
      bg.addColorStop(0.4, "#1e1b4b");
      bg.addColorStop(0.75, "#4c1d95");
      bg.addColorStop(1, "#be185d");
    } else {
      bg.addColorStop(0, "#082f49");
      bg.addColorStop(0.35, "#0284c7");
      bg.addColorStop(0.7, "#38bdf8");
      bg.addColorStop(1, "#f43f5e");
    }
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // ภูเขาเรขาคณิตในพื้นหลัง (Minimalist Vector Mountains)
    g.fillStyle = night ? "rgba(15, 23, 42, 0.75)" : "rgba(12, 74, 110, 0.55)";
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(w * 0.25, h * 0.65);
    g.lineTo(w * 0.5, h * 0.85);
    g.lineTo(w * 0.75, h * 0.6);
    g.lineTo(w, h);
    g.fill();

    // พระจันทร์/พระอาทิตย์ทรงกลมเรืองแสง
    const sunGrad = g.createRadialGradient(w * 0.75, h * 0.45, 10, w * 0.75, h * 0.45, 90);
    sunGrad.addColorStop(0, night ? "rgba(244, 114, 182, 0.9)" : "rgba(254, 240, 138, 0.95)");
    sunGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = sunGrad;
    g.beginPath();
    g.arc(w * 0.75, h * 0.45, 90, 0, Math.PI * 2);
    g.fill();

    // 2) หน้าต่างโปรแกรม VS Code Editor ด้านซ้าย
    const winX = w * 0.06;
    const winY = h * 0.08;
    const winW = w * 0.54;
    const winH = h * 0.78;

    // กรอบหน้าต่าง Glassmorphism
    g.fillStyle = "rgba(15, 23, 42, 0.88)";
    g.strokeStyle = "rgba(255, 255, 255, 0.15)";
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(winX, winY, winW, winH, 12);
    g.fill();
    g.stroke();

    // แถบ Title bar + ปุ่มวงกลม 3 สี (Mac-style window dots)
    g.fillStyle = "rgba(30, 41, 59, 0.95)";
    g.beginPath();
    g.roundRect(winX, winY, winW, 28, [12, 12, 0, 0]);
    g.fill();

    g.fillStyle = "#ef4444";
    g.beginPath();
    g.arc(winX + 16, winY + 14, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#eab308";
    g.beginPath();
    g.arc(winX + 32, winY + 14, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#22c55e";
    g.beginPath();
    g.arc(winX + 48, winY + 14, 5, 0, Math.PI * 2);
    g.fill();

    // แท็บไฟล์ด้านบน
    g.fillStyle = "rgba(51, 65, 85, 0.8)";
    g.beginPath();
    g.roundRect(winX + 70, winY + 4, 110, 24, [6, 6, 0, 0]);
    g.fill();
    g.fillStyle = "#38bdf8";
    g.fillRect(winX + 80, winY + 12, 14, 8);
    g.fillStyle = "#e2e8f0";
    g.fillRect(winX + 100, winY + 13, 65, 6);

    // บรรทัดโค้ดหลากสี (Syntax highlighted code lines)
    const codeColors = ["#38bdf8", "#c084fc", "#4ade80", "#facc15", "#f43f5e", "#94a3b8"];
    const startY = winY + 44;
    for (let line = 0; line < 15; line++) {
      const ly = startY + line * 24;
      // เลขบรรทัด
      g.fillStyle = "rgba(100, 116, 139, 0.6)";
      g.fillRect(winX + 14, ly + 2, 16, 6);

      // โทเค็นคำสั่งในโค้ด
      let curX = winX + 44;
      const numTokens = 3 + (line % 4);
      for (let t = 0; t < numTokens; t++) {
        const tokenW = 20 + ((line * 17 + t * 31) % 55);
        g.fillStyle = codeColors[(line + t) % codeColors.length];
        g.beginPath();
        g.roundRect(curX, ly, tokenW, 10, 3);
        g.fill();
        curX += tokenW + 10;
        if (curX > winX + winW - 30) break;
      }
    }

    // 3) หน้าต่าง Audio Spectrum Visualizer & System Metrics ด้านขวา
    const w2X = w * 0.64;
    const w2Y = h * 0.12;
    const w2W = w * 0.3;
    const w2H = h * 0.38;

    g.fillStyle = "rgba(15, 23, 42, 0.82)";
    g.strokeStyle = "rgba(56, 189, 248, 0.35)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(w2X, w2Y, w2W, w2H, 12);
    g.fill();
    g.stroke();

    // คลื่นเสียง Spectrum Waveform Bars
    const numBars = 18;
    const barW = (w2W - 40) / numBars;
    for (let b = 0; b < numBars; b++) {
      const barH = 14 + Math.sin(b * 0.45) * 28 + ((b * 7) % 35);
      const bx = w2X + 20 + b * barW;
      const by = w2Y + w2H - 24 - barH;
      const bGrad = g.createLinearGradient(0, by, 0, by + barH);
      bGrad.addColorStop(0, "#38bdf8");
      bGrad.addColorStop(1, "#a855f7");
      g.fillStyle = bGrad;
      g.beginPath();
      g.roundRect(bx + 2, by, barW - 4, barH, 2);
      g.fill();
    }

    // 4) แถบ Dock ล่างสุดของหน้าจอ
    const dockW = w * 0.42;
    const dockH = 34;
    const dockX = (w - dockW) / 2;
    const dockY = h - dockH - 12;

    g.fillStyle = "rgba(15, 23, 42, 0.75)";
    g.strokeStyle = "rgba(255, 255, 255, 0.25)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.roundRect(dockX, dockY, dockW, dockH, 16);
    g.fill();
    g.stroke();

    // ไอคอนใน Dock
    const numIcons = 8;
    const iconW = 20;
    const gap = (dockW - numIcons * iconW) / (numIcons + 1);
    const iconColors = ["#38bdf8", "#34d399", "#fbbf24", "#f43f5e", "#a855f7", "#ec4899", "#6366f1", "#f97316"];
    for (let i = 0; i < numIcons; i++) {
      g.fillStyle = iconColors[i % iconColors.length];
      g.beginPath();
      g.roundRect(dockX + gap + i * (iconW + gap), dockY + 7, iconW, iconW, 5);
      g.fill();
    }
  });
}

/** ปุ่มคีย์บอร์ดแมคคานิคอลสมจริง (Dual-tone PBT Keycaps + Accents + RGB) */
export function keysTex() {
  return make("keys-mechanical-v2", 1024, 320, (g, w, h) => {
    g.fillStyle = "#0f172a";
    g.fillRect(0, 0, w, h);

    const rows = 5;
    const rowH = (h - 16) / rows;

    for (let r = 0; r < rows; r++) {
      const y = 8 + r * rowH;
      const numKeys = r === 4 ? 8 : r === 0 ? 15 : 14;
      const kw = (w - 20) / 15;
      let curX = 10;

      for (let k = 0; k < numKeys; k++) {
        let keyWidth = kw;
        let keyColor = "#334155"; // สีกรมท่า/เทาเข้ม
        let textColor = "#94a3b8";

        // ปุ่มพิเศษต่าง ๆ (Spacebar, Shift, Enter, ESC)
        if (r === 0 && k === 0) {
          // ESC Key สีส้มสว่างเด่น
          keyColor = "#ea580c";
          textColor = "#ffffff";
        } else if (r === 2 && k === numKeys - 1) {
          // Enter Key สีเขียวอมฟ้า Teal
          keyWidth = kw * 1.8;
          keyColor = "#0d9488";
          textColor = "#ffffff";
        } else if (r === 4 && k === 3) {
          // Spacebar กว้าง
          keyWidth = kw * 5.2;
          keyColor = "#475569";
        } else if ((r === 1 || r === 3) && (k === 0 || k === numKeys - 1)) {
          // Tab / Caps / Shift
          keyWidth = kw * 1.5;
          keyColor = "#1e293b";
        }

        // ตัวปุ่มทรงนูน 3D (Sculpted keycap top with beveled edges)
        g.fillStyle = "#090d16";
        g.beginPath();
        g.roundRect(curX + 2, y + 2, keyWidth - 4, rowH - 4, 5);
        g.fill();

        g.fillStyle = keyColor;
        g.beginPath();
        g.roundRect(curX + 4, y + 4, keyWidth - 8, rowH - 8, 4);
        g.fill();

        // ไฮไลต์แสงตกกระทบด้านบนปุ่ม
        g.fillStyle = "rgba(255, 255, 255, 0.15)";
        g.beginPath();
        g.roundRect(curX + 6, y + 5, keyWidth - 12, 4, 2);
        g.fill();

        // ตัวอักษรย่อบนปุ่ม
        g.fillStyle = textColor;
        g.fillRect(curX + 8, y + 8, Math.min(keyWidth - 16, 8), 4);

        curX += keyWidth;
        if (curX > w - 10) break;
      }
    }
  });
}

/** ผนังฉาบปูน */
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

/** พรมปูพื้น Bauhaus / Nordic Geometric */
export function rugTex(base: string) {
  return make(`rug-v2-${base}`, 512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // ลายเรขาคณิตโมเดิร์น
    g.fillStyle = shade(base, 1.2);
    g.beginPath();
    g.arc(w * 0.35, h * 0.35, 120, 0, Math.PI);
    g.fill();

    g.fillStyle = shade(base, 0.8);
    g.beginPath();
    g.roundRect(w * 0.45, h * 0.25, 140, 220, 30);
    g.fill();

    g.strokeStyle = shade(base, 1.35);
    g.lineWidth = 12;
    g.strokeRect(20, 20, w - 40, h - 40);

    // ชายครุยพรม (Tassels) ที่หัวท้าย
    g.fillStyle = "rgba(255,255,255,0.7)";
    for (let x = 24; x < w - 24; x += 8) {
      g.fillRect(x, 4, 3, 14);
      g.fillRect(x, h - 18, 3, 14);
    }

    // จุดเนื้อสัมผัสพรม
    const r = rng(9);
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}
