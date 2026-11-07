import * as THREE from "three";

/**
 * หน้าจอคอมในฉาก 3D: ปิด → บูต (โลโก้ + เช็กชิ้นส่วน) → เกมเดโม + ตัวนับ FPS ตามสเปกที่เลือก
 * วาดลง canvas แล้วอัปเดตเป็นเท็กซ์เจอร์ (~30 ครั้ง/วิ)
 */
export type PowerState = "off" | "on";

export interface ScreenGame {
  title: string;
  fps: number;
  low: number;
}

export interface ScreenSim {
  texture: THREE.CanvasTexture;
  /** เรียกทุกเฟรม: t = วินาทีตั้งแต่เปิดเครื่อง (ติดลบ = ปิดอยู่) */
  draw: (t: number, now: number, info: { parts: string[]; game: ScreenGame | null }) => void;
  /** ความสว่างจอ 0..1 (ไว้คุมแสงจอที่ส่องห้อง) */
  brightness: () => number;
  dispose: () => void;
}

export const BOOT_SECONDS = 3.2;

export function createScreenSim(width = 512, height = 288): ScreenSim {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d")!;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  let last = -1;
  let bright = 0;
  let fpsShown = 0;
  let fpsNext = 0;

  const W = width;
  const H = height;

  function black() {
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
  }

  function boot(t: number, parts: string[]) {
    black();
    // โลโก้ค่อยๆ สว่าง
    const a = Math.min(1, t / 0.6);
    g.globalAlpha = a;
    g.fillStyle = "#e2e8f0";
    g.font = "bold 40px sans-serif";
    g.textAlign = "center";
    g.fillText("Compro", W / 2 - 40, H * 0.36);
    g.fillStyle = "#38bdf8";
    g.fillText("Next", W / 2 + 78, H * 0.36);
    g.globalAlpha = 1;
    // เช็กชิ้นส่วนทีละบรรทัด
    g.textAlign = "left";
    g.font = "12px monospace";
    const lines = parts.slice(0, 6);
    lines.forEach((p, i) => {
      if (t < 0.5 + i * 0.28) return;
      g.fillStyle = "#94a3b8";
      g.fillText(p.length > 56 ? `${p.slice(0, 55)}…` : p, 40, H * 0.48 + i * 17);
      g.fillStyle = "#4ade80";
      g.fillText("OK", W - 50, H * 0.48 + i * 17);
    });
    // แถบโหลด
    const p = Math.min(1, t / BOOT_SECONDS);
    g.fillStyle = "#1e293b";
    g.fillRect(W * 0.3, H - 34, W * 0.4, 6);
    g.fillStyle = "#38bdf8";
    g.fillRect(W * 0.3, H - 34, W * 0.4 * p, 6);
  }

  /** เกมเดโม: ขับรถบนถนนนีออนวิ่งเข้าหาพระอาทิตย์ */
  function game(t: number, now: number, info: ScreenGame | null) {
    const hor = H * 0.52;
    const sky = g.createLinearGradient(0, 0, 0, hor);
    sky.addColorStop(0, "#0b0326");
    sky.addColorStop(1, "#4c1d95");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, hor);
    // พระอาทิตย์ลายแถบ
    const sunR = H * 0.24;
    const sg = g.createLinearGradient(0, hor - sunR * 2, 0, hor);
    sg.addColorStop(0, "#fde047");
    sg.addColorStop(1, "#f43f5e");
    g.fillStyle = sg;
    g.beginPath();
    g.arc(W / 2, hor, sunR, Math.PI, 0);
    g.fill();
    g.fillStyle = "#3b0764";
    for (let i = 0; i < 6; i++) g.fillRect(W / 2 - sunR, hor - sunR * 0.55 + i * i * 2.2 + i * 5, sunR * 2, 2 + i * 1.3);
    // ภูเขา
    g.fillStyle = "#1e0b3a";
    g.beginPath();
    g.moveTo(0, hor);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, hor - 18 - Math.abs(Math.sin(x * 0.013 + 1.3)) * 46 - Math.sin(x * 0.041) * 8);
    g.lineTo(W, hor);
    g.fill();
    // พื้น + ตาราง perspective เลื่อนเข้าหา
    g.fillStyle = "#12001f";
    g.fillRect(0, hor, W, H - hor);
    g.strokeStyle = "#e879f9";
    g.lineWidth = 1.5;
    const speed = (now * 1.6) % 1;
    for (let i = 0; i < 14; i++) {
      const z = (i + speed) / 14;
      const y = hor + (H - hor) * z * z;
      g.globalAlpha = 0.25 + z * 0.75;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = -10; i <= 10; i++) {
      g.beginPath();
      g.moveTo(W / 2 + i * 8, hor);
      g.lineTo(W / 2 + i * 90, H);
      g.stroke();
    }
    // ถนน
    g.fillStyle = "rgba(15,23,42,0.85)";
    g.beginPath();
    g.moveTo(W / 2 - 10, hor);
    g.lineTo(W / 2 + 10, hor);
    g.lineTo(W / 2 + 190, H);
    g.lineTo(W / 2 - 190, H);
    g.fill();
    g.fillStyle = "#22d3ee";
    for (let i = 0; i < 6; i++) {
      const z = ((i + speed * 2) % 6) / 6;
      const y = hor + (H - hor) * z * z;
      g.fillRect(W / 2 - 1.5 - z * 3, y, 3 + z * 6, 4 + z * 14);
    }
    // รถ (เอียงซ้ายขวาเบาๆ)
    const sway = Math.sin(now * 1.3) * 26;
    const cx = W / 2 + sway;
    const cy = H - 54;
    g.fillStyle = "#0f172a";
    g.fillRect(cx - 62, cy - 4, 124, 34);
    g.fillStyle = "#f43f5e";
    g.fillRect(cx - 58, cy, 116, 26);
    g.fillStyle = "#1e293b";
    g.fillRect(cx - 40, cy - 22, 80, 22);
    g.fillStyle = "#fb7185";
    g.fillRect(cx - 54, cy + 6, 22, 7);
    g.fillRect(cx + 32, cy + 6, 22, 7);
    // HUD
    g.textAlign = "left";
    g.font = "bold 15px sans-serif";
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillRect(10, 10, 210, 50);
    if (info) {
      if (now > fpsNext) {
        fpsShown = Math.max(1, Math.round(info.fps * (0.95 + Math.random() * 0.08)));
        fpsNext = now + 0.4;
      }
      g.fillStyle = fpsShown >= 60 ? "#4ade80" : fpsShown >= 40 ? "#facc15" : "#f87171";
      g.fillText(`FPS ${fpsShown}`, 18, 30);
      g.fillStyle = "#cbd5e1";
      g.font = "12px sans-serif";
      g.fillText(`1% low ${info.low}  ·  ${info.title.slice(0, 22)}`, 18, 50);
    } else {
      g.fillStyle = "#cbd5e1";
      g.fillText("เลือกซีพียู + การ์ดจอ", 18, 30);
      g.font = "12px sans-serif";
      g.fillText("เพื่อดู FPS จริง", 18, 50);
    }
    // ความเร็วรถ
    g.textAlign = "right";
    g.font = "bold 28px sans-serif";
    g.fillStyle = "#f8fafc";
    g.fillText(`${Math.round(180 + Math.sin(now * 0.7) * 20)}`, W - 20, H - 24);
    g.font = "12px sans-serif";
    g.fillText("km/h", W - 20, H - 10);
    void t;
  }

  return {
    texture,
    draw(t, now, info) {
      // จำกัด ~20 ครั้ง/วิ (ประหยัดเครื่อง)
      if (now - last < 1 / 20) return;
      last = now;
      if (t < 0) {
        bright = 0;
        black();
      } else if (t < BOOT_SECONDS) {
        bright = 0.35;
        boot(t, info.parts);
      } else {
        bright = 1;
        game(t, now, info.game);
      }
      texture.needsUpdate = true;
    },
    brightness: () => bright,
    dispose: () => texture.dispose(),
  };
}
