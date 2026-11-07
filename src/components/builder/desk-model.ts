import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { MonitorSpec } from "@/lib/builder/types";
import type { CaseDimensionsMm } from "@/lib/builder/case-sizes";
import { DEFAULT_DESK, monitorDimensionsCm, type CasePlacement, type DeskSize } from "@/lib/builder/desk";
import { MODEL_FLOOR_Y, MODEL_SCALE as S } from "./pc-model";

/**
 * โต๊ะคอม + จอ + คีย์บอร์ด + เมาส์ + แผ่นรอง (สเกลจริงเท่าเคส ลายวัสดุวาดด้วยโค้ด)
 * แกนเดียวกับโมเดลคอม: x = ความกว้างโต๊ะ (ซ้าย − / ขวา +), y = ขึ้น, z = ความลึกโต๊ะ (หลัง − / หน้า + ฝั่งคนนั่ง)
 * รวม geometry ต่อวัสดุ → มีไม่กี่ mesh วาดเร็ว
 */

type MatKey = "wood" | "metal" | "plastic" | "keys" | "screen" | "mat" | "alu" | "rubber" | "rgb" | "mesh" | "ceramic";

export interface DeskModel {
  root: THREE.Group;
  /** จอ/คีย์บอร์ด/เมาส์ (เลื่อนซ้ายขวาตามตำแหน่งเคส) */
  gear: THREE.Group;
  monitorWidthMm: number;
  monitorTopMm: number;
  /** กลางจอ (มม. ในพิกัดของ gear) */
  screenCenterMm: [number, number, number];
  desk: DeskSize;
  dispose: () => void;
}

const DEFAULT_MONITOR = { sizeInch: 24, aspectW: 16, aspectH: 9 };
const TOP_T = 25; // ความหนาท็อปโต๊ะ
const STAND_GAP = 110; // ขอบล่างจอสูงจากโต๊ะ
const BEZEL = 9; // กรอบรวม (ขอบบาง 3 ด้าน + คางล่าง)

/* ---------- ลายวัสดุ (วาดด้วยโค้ด ไม่ต้องโหลดไฟล์) ---------- */
function tex(size: [number, number], draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const c = document.createElement("canvas");
  [c.width, c.height] = size;
  draw(c.getContext("2d")!, size[0], size[1]);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** ลายไม้โอ๊ค: เสี้ยนยาวตามความกว้างโต๊ะ + ปุ่มไม้จางๆ */
function woodTex() {
  return tex([1024, 512], (g, w, h) => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = "#c79f72";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      const y = r() * h;
      const amp = 2 + r() * 6;
      const tone = 0.55 + r() * 0.4;
      g.strokeStyle = `rgba(${Math.round(120 * tone)},${Math.round(80 * tone)},${Math.round(45 * tone)},${0.08 + r() * 0.16})`;
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / (60 + r() * 90) + i) * amp);
      g.stroke();
    }
    for (let k = 0; k < 3; k++) {
      const cx = r() * w;
      const cy = r() * h;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 30 + r() * 30);
      grad.addColorStop(0, "rgba(90,55,25,0.35)");
      grad.addColorStop(1, "rgba(90,55,25,0)");
      g.fillStyle = grad;
      g.fillRect(cx - 70, cy - 70, 140, 140);
    }
  });
}

/** วอลเปเปอร์บนจอ (เปิดจออยู่ → เรืองแสงจริง) */
function screenTex() {
  return tex([512, 288], (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#0b1a3d");
    bg.addColorStop(0.55, "#1e3a8a");
    bg.addColorStop(1, "#0e7490");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = `rgba(147,197,253,${0.12 + i * 0.05})`;
      g.lineWidth = 18 - i * 3;
      g.beginPath();
      for (let x = -10; x <= w + 10; x += 8) g.lineTo(x, h * (0.62 - i * 0.07) + Math.sin(x / 70 + i * 0.9) * 22);
      g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,0.10)";
    g.fillRect(0, h - 16, w, 16); // แถบงาน
    for (let i = 0; i < 6; i++) g.fillRect(w / 2 - 66 + i * 22, h - 12, 14, 8);
  });
}

/** ปุ่มคีย์บอร์ด (ช่องดำ + ตัวอักษรจางๆ) ปูบนแผ่นปุ่ม */
function keysTex() {
  return tex([1024, 288], (g, w, h) => {
    g.fillStyle = "#15171b";
    g.fillRect(0, 0, w, h);
    const rows = 6;
    const ch = h / rows;
    const pad = 4;
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let row = 0; row < rows; row++) {
      let x = 0;
      const n = row === 5 ? 9 : 15;
      while (x < w - 2) {
        let kw = w / n;
        if (row === 5 && x > w * 0.28 && x < w * 0.3) kw = w * 0.36; // spacebar
        if (row > 0 && row < 5 && x === 0) kw = (w / n) * (1.2 + row * 0.15);
        kw = Math.min(kw, w - x);
        const grad = g.createLinearGradient(0, row * ch, 0, row * ch + ch);
        grad.addColorStop(0, "#40454d");
        grad.addColorStop(1, "#2a2e34");
        g.fillStyle = grad;
        g.beginPath();
        g.roundRect(x + pad, row * ch + pad, kw - pad * 2, ch - pad * 2, 6);
        g.fill();
        if (r() > 0.3) {
          g.fillStyle = "rgba(230,232,236,0.55)";
          g.fillRect(x + pad + 7, row * ch + pad + 7, 7, 2);
        }
        x += kw;
      }
    }
  });
}

/** แผ่นรองเมาส์ผ้า: ลายผ้าละเอียด + ขอบเย็บ */
function feltTex() {
  return tex([512, 256], (g, w, h) => {
    g.fillStyle = "#2a2d33";
    g.fillRect(0, 0, w, h);
    let seed = 5;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.06)";
      g.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
    g.strokeStyle = "rgba(150,155,165,0.5)";
    g.setLineDash([6, 4]);
    g.lineWidth = 2;
    g.strokeRect(6, 6, w - 12, h - 12);
  });
}

function makeMaterials(screenOverride?: THREE.Texture, rgb?: THREE.MeshStandardMaterial): { mats: Record<MatKey, THREE.MeshStandardMaterial>; textures: THREE.Texture[] } {
  const wood = woodTex();
  const screen = screenOverride ?? screenTex();
  const keys = keysTex();
  const felt = feltTex();
  return {
    textures: screenOverride ? [wood, keys, felt] : [wood, screen, keys, felt],
    mats: {
      wood: new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.55, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
      metal: new THREE.MeshStandardMaterial({ color: "#1d2024", roughness: 0.42, metalness: 0.75 }),
      plastic: new THREE.MeshStandardMaterial({ color: "#16181c", roughness: 0.38, metalness: 0.15 }),
      keys: new THREE.MeshStandardMaterial({ map: keys, roughness: 0.55, metalness: 0 }),
      screen: new THREE.MeshStandardMaterial({ map: screen, emissiveMap: screen, emissive: "#ffffff", emissiveIntensity: 0.85, roughness: 0.12, metalness: 0 }),
      mat: new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95, metalness: 0 }),
      alu: new THREE.MeshStandardMaterial({ color: "#9aa1ab", roughness: 0.3, metalness: 0.9 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#0b0c0e", roughness: 0.9, metalness: 0 }),
      rgb: rgb ?? new THREE.MeshStandardMaterial({ color: "#38bdf8", emissive: "#38bdf8", emissiveIntensity: 2 }),
      mesh: new THREE.MeshStandardMaterial({ color: "#2a2d33", roughness: 0.85, metalness: 0.1 }),
      ceramic: new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.35, metalness: 0 }),
    },
  };
}

export function buildDeskModel(
  opts: {
    monitor?: MonitorSpec | null;
    desk?: DeskSize;
    screen?: THREE.Texture;
    rgbMat?: THREE.MeshStandardMaterial;
    /** ความลึกเคส (มม.) ไว้ขยายโต๊ะให้พอวางจอ + เคสบนโต๊ะโดยไม่ทับกัน */
    caseDepthMm?: number;
  } = {}
): DeskModel {
  let desk = opts.desk ?? DEFAULT_DESK;
  const { mats, textures } = makeMaterials(opts.screen, opts.rgbMat);
  // วัสดุ RGB เป็นของฉากหลัก (ใช้ร่วมกับเคส) ไม่ทิ้งที่นี่
  const owned: Array<{ dispose: () => void }> = [...Object.values(mats).filter((m) => m !== opts.rgbMat), ...textures];
  const mon = opts.monitor;
  const dims =
    mon && mon.sizeInch > 0 && mon.resolution?.width > 0 && mon.resolution?.height > 0
      ? monitorDimensionsCm(mon.sizeInch, mon.resolution.width, mon.resolution.height)
      : monitorDimensionsCm(DEFAULT_MONITOR.sizeInch, DEFAULT_MONITOR.aspectW, DEFAULT_MONITOR.aspectH);
  const panelW = dims.widthCm * 10;
  const panelH = dims.heightCm * 10;
  const monW = panelW + BEZEL * 2;
  const monH = panelH + BEZEL * 2;
  // จอใหญ่ + เคสใหญ่ (เช่นชุดเรือธง) วางโต๊ะเดิมไม่พอ → ขยายโต๊ะ (ปัดขึ้นทีละ 10 ซม.) ให้เว้นช่องไม่ทับกัน
  if (opts.caseDepthMm) {
    const needCm = Math.ceil((monW + opts.caseDepthMm + 240) / 100) * 10;
    if (needCm > desk.widthCm) desk = { ...desk, widthCm: Math.min(240, needCm) };
  }
  const deskW = desk.widthCm * 10;
  const deskD = desk.depthCm * 10;
  const deskH = desk.heightCm * 10;

  type Add = {
    box: (k: MatKey, w: number, h: number, d: number, x: number, y: number, z: number) => void;
    rbox: (k: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, r: number) => void;
    sphere: (k: MatKey, sx: number, sy: number, sz: number, x: number, y: number, z: number) => void;
    cyl: (k: MatKey, rx: number, rz: number, h: number, x: number, y: number, z: number, tilt?: number) => void;
  };
  /** สร้างกลุ่มที่ geometry ถูกรวมตามวัสดุ (หน่วยมม. → ย่อด้วย S) — ทุกชิ้นแปลงเป็นแบบไม่มี index ก่อนรวม */
  function group(add: (a: Add) => void) {
    const bins = new Map<MatKey, THREE.BufferGeometry[]>();
    const push = (k: MatKey, g: THREE.BufferGeometry) => {
      const flat = g.index ? g.toNonIndexed() : g;
      if (flat !== g) g.dispose();
      const list = bins.get(k) ?? [];
      list.push(flat);
      bins.set(k, list);
    };
    add({
      box: (k, w, h, d, x, y, z) => push(k, new THREE.BoxGeometry(w, h, d).translate(x, y, z)),
      rbox: (k, w, h, d, x, y, z, r) => push(k, new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)).translate(x, y, z)),
      sphere: (k, sx, sy, sz, x, y, z) => push(k, new THREE.SphereGeometry(0.5, 24, 16).scale(sx, sy, sz).translate(x, y, z)),
      cyl: (k, rx, rz, h, x, y, z, tilt = 0) => push(k, new THREE.CylinderGeometry(1, 1, h, 40).scale(rx, 1, rz).rotateX(tilt).translate(x, y, z)),
    });
    const g = new THREE.Group();
    for (const [k, list] of bins) {
      const merged = mergeGeometries(list, false);
      for (const src of list) src.dispose();
      if (!merged) continue;
      merged.scale(S, S, S);
      owned.push(merged);
      const mesh = new THREE.Mesh(merged, mats[k]);
      mesh.castShadow = k !== "screen" && k !== "rgb";
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }

  // โต๊ะ: ท็อปไม้ขอบมน + ขาเหล็กทรงสี่เหลี่ยม (พ่นสีดำด้าน) + คานหลัง + ปุ่มรองขา (ผิวบนโต๊ะอยู่ที่ y = 0)
  const furniture = group(({ rbox, box }) => {
    rbox("wood", deskW, TOP_T, deskD, 0, -TOP_T / 2, 0, 6);
    const legH = deskH - TOP_T - 12;
    const lx = deskW / 2 - 60;
    const lz = deskD / 2 - 55;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        rbox("metal", 40, legH, 40, sx * lx, -TOP_T - legH / 2, sz * lz, 4);
        box("rubber", 44, 12, 44, sx * lx, -deskH + 6, sz * lz);
      }
      rbox("metal", 46, 26, deskD - 70, sx * lx, -TOP_T - 15, 0, 4); // คานข้างใต้ท็อป
    }
    rbox("metal", deskW - 160, 50, 18, 0, -TOP_T - 45, -lz, 4); // คานหลัง
  });

  // จอ (หันหน้าไปทาง +z) + คีย์บอร์ด + เมาส์ + แผ่นรอง — จุดกึ่งกลาง x = 0
  const monZ = -deskD / 2 + 150;
  const kbZ = deskD / 2 - 170;
  const cy = STAND_GAP + monH / 2;
  const gear = group(({ box, rbox, sphere, cyl }) => {
    // ฐานจอรูปวงรี + คอจอเอียงเล็กน้อย
    cyl("alu", 120, 95, 8, 0, 4, monZ + 10);
    rbox("alu", 46, STAND_GAP + monH * 0.45, 16, 0, (STAND_GAP + monH * 0.45) / 2 + 8, monZ - 14, 6);
    rbox("plastic", monW * 0.42, monH * 0.42, 34, 0, cy, monZ - 6, 14); // กล่องหลังจอ
    // ตัวจอบาง ขอบบาง 3 ด้าน คางล่างหนากว่า
    rbox("plastic", monW, monH, 14, 0, cy, monZ + 12, 4);
    box("screen", panelW, panelH, 1, 0, cy + BEZEL * 0.35, monZ + 19.6);
    // แผ่นรองเมาส์ผ้ายาว (desk mat) ใต้คีย์บอร์ด + เมาส์
    rbox("mat", 820, 3, 320, 40, 1.5, kbZ, 2);
    // คีย์บอร์ด: ตัวเครื่อง + แผ่นปุ่ม
    rbox("plastic", 440, 20, 140, -60, 13, kbZ, 6);
    box("keys", 422, 4, 122, -60, 25, kbZ);
    // เมาส์: ตัวโค้ง + ล้อสกรอลล์ + โลโก้ไฟ
    sphere("plastic", 64, 38, 118, 300, 21, kbZ);
    cyl("rubber", 4, 4, 10, 300, 40, kbZ - 30, Math.PI / 2);
    sphere("rgb", 14, 4, 14, 300, 38, kbZ + 28);
    // ไฟใต้คีย์บอร์ด + ขอบแผ่นรองเรืองแสง
    box("rgb", 432, 3, 3, -60, 4, kbZ + 70);
    box("rgb", 826, 1.5, 2, 40, 3.4, kbZ + 161);
    box("rgb", 826, 1.5, 2, 40, 3.4, kbZ - 161);
    // ไฟแขวนบนจอ (light bar)
    rbox("alu", Math.min(450, monW * 0.7), 18, 22, 0, cy + monH / 2 + 12, monZ + 6, 8);
    box("rgb", Math.min(430, monW * 0.66), 2, 4, 0, cy + monH / 2 + 3, monZ + 14);
    // ซาวด์บาร์ใต้จอ (ตะแกรงผ้า + ไฟ)
    rbox("plastic", 420, 55, 70, -60, 30, kbZ - 125, 12);
    box("mesh", 400, 40, 2, -60, 32, kbZ - 89);
    box("rgb", 380, 2, 2, -60, 3, kbZ - 89);
    // แก้วกาแฟ
    cyl("ceramic", 38, 38, 95, -330, 48, kbZ - 118);
    cyl("ceramic", 9, 22, 6, -330 - 42, 52, kbZ - 118, Math.PI / 2);
  });

  const root = new THREE.Group();
  root.add(furniture, gear);
  return {
    root,
    gear,
    monitorWidthMm: monW,
    monitorTopMm: STAND_GAP + monH,
    screenCenterMm: [0, cy + BEZEL * 0.35, monZ + 20],
    desk,
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}

export interface DeskLayout {
  /** ตำแหน่ง root ของโต๊ะ (หน่วยฉาก) */
  position: [number, number, number];
  /** ตำแหน่ง x ของชุดจอ/คีย์บอร์ด เทียบกับกลางโต๊ะ (หน่วยฉาก) */
  gearX: number;
  /** ระดับพื้นห้อง (หน่วยฉาก) */
  floorY: number;
  /** กรอบรวมโต๊ะ + เคส ไว้จัดกล้อง (หน่วยฉาก) */
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * วางโต๊ะรอบเคส (เคสอยู่กลางพิกัด, ฐานเคสที่ MODEL_FLOOR_Y)
 * - "desk": เคสตั้งบนโต๊ะด้านขวา ผิวโต๊ะ = ฐานเคส
 * - "floor": เคสวางพื้นทางขวาของโต๊ะ
 */
export function deskLayout(model: Pick<DeskModel, "desk" | "monitorWidthMm" | "monitorTopMm">, placement: CasePlacement, caseDims: CaseDimensionsMm): DeskLayout {
  const deskW = model.desk.widthCm * 10;
  const deskD = model.desk.depthCm * 10;
  const deskH = model.desk.heightCm * 10;
  const halfD = caseDims.depthMm / 2;
  const halfW = caseDims.widthMm / 2;
  const onDesk = placement === "desk";
  // ขอบโต๊ะด้านขวา: บนโต๊ะ = เลยเคสไปนิด, วางพื้น = เว้นช่องข้างเคส
  const right = onDesk ? halfD + 60 : -halfD - 120;
  const cx = right - deskW / 2;
  const cz = -halfW - 80 + deskD / 2; // หลังเคสเว้นจากขอบหลังโต๊ะเล็กน้อย
  // ชุดจอ: กลางพื้นที่ว่าง ไม่ทับเคส (ถ้าจอกว้างเกินก็ชิดซ้ายสุด)
  const left = cx - deskW / 2;
  const half = model.monitorWidthMm / 2;
  let gx = cx;
  if (onDesk) {
    const freeMid = (left + 40 + (-halfD - 60)) / 2;
    gx = Math.max(left + half + 20, Math.min(freeMid, -halfD - 40 - half));
  }
  const topY = onDesk ? 0 : deskH; // มม. เหนือฐานเคส
  const floorMm = onDesk ? -deskH : 0;
  const caseTop = caseDims.heightMm;
  const u = (mm: number) => mm * S;
  return {
    position: [u(cx), MODEL_FLOOR_Y + u(topY) - (onDesk ? 0.008 : 0), u(cz)],
    gearX: u(gx - cx),
    floorY: MODEL_FLOOR_Y + u(floorMm),
    min: [u(Math.min(left, -halfD)), MODEL_FLOOR_Y + u(floorMm), u(Math.min(cz - deskD / 2, -halfW))],
    max: [u(Math.max(right, halfD)), MODEL_FLOOR_Y + u(Math.max(caseTop, topY + model.monitorTopMm)), u(Math.max(cz + deskD / 2, halfW))],
  };
}
