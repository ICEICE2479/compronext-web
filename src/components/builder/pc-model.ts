import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PcPart } from "@/lib/builder/types";

/**
 * โมเดลคอม 3D แบบละเอียด (สร้างด้วยโค้ด ไม่ต้องโหลดไฟล์ → เปิดไว ไม่หนัก)
 *
 * หน่วย: กำหนดเป็นมิลลิเมตรตามของจริงแล้วย่อด้วย S
 * แกน: x = หน้า(-) → หลัง(+), y = พื้น(0) → บน, z = ฝั่งถาดเมนบอร์ด(-) → ฝั่งกระจก(+)
 * ทุกชิ้นอยู่ใน Group ของตัวเอง (userData.slot) เพื่อกดเลือก/ยก/แยกชิ้นได้
 */

export const MODEL_FLOOR_Y = -1.63;
const S = 3.26 / 415; // เคสอ้างอิง Mid Tower สูง 415 มม. = 3.26 หน่วย
/** หน่วยฉากต่อ 1 มม. (ใช้ร่วมกับโต๊ะ/จอ ให้สเกลเท่าของจริง) */
export const MODEL_SCALE = S;
const u = (mm: number) => mm * S;

// เคสอ้างอิง (NZXT H6 Flow class)
const D = 435; // ลึก
const H = 415; // สูง
const W = 287; // กว้าง
/** ขนาดเคสอ้างอิงในหน่วยฉาก (ไว้วาดเส้นเทียบขนาด/เงา) */
export const MODEL_BOX = { depth: u(D), height: u(H), width: u(W) };

export type FanStyle = "sl_infinity" | "dual_ring" | "argb" | "stealth";

export interface PcModelInput {
  build: {
    cpu?: PcPart | null;
    gpu?: PcPart | null;
    motherboard?: PcPart | null;
    ram?: PcPart | null;
    storage?: PcPart | null;
    cooler?: PcPart | null;
    psu?: PcPart | null;
    case?: PcPart | null;
  };
  ramSticks: number;
  storageCount: number;
  /** ฮาร์ดดิสก์ 3.5" / SSD 2.5" (SATA) จากของเสริม — วางในกรงใต้ฝาครอบ PSU */
  hddCount?: number;
  sataSsdCount?: number;
  gpuCount?: number;
  rgb: string;
  mounts: MountConfig;
  fanStyle: FanStyle;
  isSmallScreen: boolean;
}

export interface PcModel {
  root: THREE.Group;
  /** กลุ่มของแต่ละชิ้น (slot → group) */
  parts: Map<string, THREE.Group>;
  rotors: THREE.Object3D[];
  rgbMeshes: THREE.Mesh[];
  rgbLights: THREE.PointLight[];
  /** จุดกึ่งกลางของแต่ละชิ้น (ใช้วางป้ายข้อมูล) */
  centers: Map<string, THREE.Vector3>;
  /** ชิ้นย่อยของแต่ละชิ้น (แยกละเอียดตอนยกขึ้นมาดู) */
  subs: Map<string, THREE.Group[]>;
  /** ลูกศรทิศลม (ซ่อนไว้ เปิดตอนดูทิศลม) */
  airflow: THREE.Group;
  arrows: Array<{ obj: THREE.Object3D; base: THREE.Vector3; dir: THREE.Vector3 }>;
  /** ช่องจุดยึด (ซ่อนไว้ เปิดตอนเลือกจุดยึด) */
  mountGhosts: THREE.Group;
  mountAnchors: Map<MountId, THREE.Vector3>;
  dispose: () => void;
}

/* ------------------------------------------------------------------ */
/* textures (สร้างครั้งเดียว ใช้ซ้ำทุกโมเดล)                              */
/* ------------------------------------------------------------------ */
const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat?: [number, number]) {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  texCache.set(key, t);
  return t;
}

/** ลายด้านข้างการ์ดจอ: เส้นเหลี่ยมแบบการ์ดจอเกมมิ่ง + ช่องระบายลม (โปร่งใส ซ้อนบนฝาครอบ) */
function gpuSideTex(white: boolean) {
  return canvasTex(`gpuside-${white}`, 512, (g, s) => {
    g.clearRect(0, 0, s, s);
    const line = white ? "rgba(120,128,140,0.55)" : "rgba(200,206,215,0.35)";
    const fill = white ? "rgba(200,205,212,0.55)" : "rgba(60,64,72,0.85)";
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(s * 0.06, s * 0.2);
    g.lineTo(s * 0.42, s * 0.2);
    g.lineTo(s * 0.5, s * 0.5);
    g.lineTo(s * 0.42, s * 0.8);
    g.lineTo(s * 0.06, s * 0.8);
    g.closePath();
    g.fill();
    g.strokeStyle = line;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(s * 0.55, s * 0.18);
    g.lineTo(s * 0.62, s * 0.5);
    g.lineTo(s * 0.55, s * 0.82);
    g.stroke();
    // ช่องระบายลมด้านท้าย
    g.fillStyle = white ? "rgba(90,96,106,0.55)" : "rgba(0,0,0,0.65)";
    for (let i = 0; i < 9; i++) g.fillRect(s * 0.7 + i * 15, s * 0.26, 7, s * 0.48);
  });
}

function pcbTex(dark: boolean) {
  return canvasTex(`pcb-${dark}`, 512, (g, s) => {
    g.fillStyle = dark ? "#14171d" : "#e3e6ea";
    g.fillRect(0, 0, s, s);
    let seed = 11;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.strokeStyle = dark ? "rgba(110,120,140,0.20)" : "rgba(90,100,115,0.22)";
    g.lineWidth = 1;
    for (let i = 0; i < 220; i++) {
      let x = r() * s;
      let y = r() * s;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (r() > 0.5) x += (r() - 0.5) * 120;
        else y += (r() - 0.5) * 120;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = dark ? "rgba(200,205,215,0.35)" : "rgba(40,45,55,0.35)";
    g.font = "bold 9px sans-serif";
    for (let i = 0; i < 26; i++) g.fillText(["C12", "R7", "Q3", "U14", "L2", "PCIE", "M2_1", "CPU_FAN"][i % 8], r() * s, r() * s);
  });
}

function meshTex() {
  // แผงตะแกรงรู (top/front mesh)
  return canvasTex(
    "mesh",
    128,
    (g, s) => {
      g.fillStyle = "#000";
      g.fillRect(0, 0, s, s);
      g.fillStyle = "#fff";
      for (let y = 0; y < s; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < s; x += 8) {
        g.beginPath();
        g.arc(x + 2, y + 2, 2.4, 0, Math.PI * 2);
        g.fill();
      }
    },
    [6, 6]
  );
}

function finTex() {
  // ครีบหม้อน้ำ/ฮีตซิงก์
  return canvasTex(
    "fins",
    128,
    (g, s) => {
      g.fillStyle = "#3a3d42";
      g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 4) {
        g.fillStyle = x % 8 ? "#9aa0a8" : "#cfd3d8";
        g.fillRect(x, 0, 2, s);
      }
    },
    [8, 1]
  );
}

/** โลโก้บนฝาครอบ PSU (ตัวหนังสือนูน) */
function shroudLogoTex(white: boolean) {
  return canvasTex(`shroudLogo:${white}`, 512, (g, sz) => {
    g.clearRect(0, 0, sz, sz);
    g.fillStyle = white ? "rgba(40,44,52,0.55)" : "rgba(235,238,245,0.55)";
    // แผ่นโลโก้กว้าง 150 × สูง 26 มม. → ยืดตัวอักษรในแนวตั้งไว้ก่อน ให้ออกมาสัดส่วนปกติ
    g.translate(sz / 2, sz / 2);
    g.scale(1, 150 / 26);
    g.font = `700 ${Math.round(sz * 0.13)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("COMPRONEXT", 0, 0);
  });
}

function brushedTex() {
  // ลายโลหะขัด (ใช้เป็น roughnessMap ให้แสงสะท้อนเป็นเส้นแบบอะลูมิเนียมจริง)
  return canvasTex(
    "brushed",
    256,
    (g, s) => {
      g.fillStyle = "#8a8a8a";
      g.fillRect(0, 0, s, s);
      let seed = 5;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 900; i++) {
        const v = Math.floor(100 + r() * 90);
        g.fillStyle = `rgba(${v},${v},${v},0.5)`;
        g.fillRect(0, r() * s, s, 0.6 + r());
      }
    },
    [2, 2]
  );
}

let arrowGeo: THREE.BufferGeometry | null = null;
/** ลูกศรทิศลม (แกน +y ยาว 1) */
function arrowGeometry() {
  if (arrowGeo) return arrowGeo;
  const shaft = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 10);
  shaft.translate(0, 0.3, 0);
  const head = new THREE.ConeGeometry(0.2, 0.4, 14);
  head.translate(0, 0.8, 0);
  arrowGeo = mergeGeometries([shaft, head])!;
  shaft.dispose();
  head.dispose();
  return arrowGeo;
}

/* ------------------------------------------------------------------ */
/* shared geometry                                                     */
/* ------------------------------------------------------------------ */
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 24);
const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 10);

const fanGeoCache = new Map<number, { frame: THREE.BufferGeometry; blades: THREE.BufferGeometry; ring: THREE.BufferGeometry }>();
/** พัดลม: แกนหมุน = y, ขนาดตามจริง (มม.) */
function fanGeometry(size: number) {
  const hit = fanGeoCache.get(size);
  if (hit) return hit;
  const half = size / 2;
  const r = half - 4;
  const outer = new THREE.Shape();
  const c = 8;
  outer.moveTo(-half + c, -half);
  outer.lineTo(half - c, -half);
  outer.quadraticCurveTo(half, -half, half, -half + c);
  outer.lineTo(half, half - c);
  outer.quadraticCurveTo(half, half, half - c, half);
  outer.lineTo(-half + c, half);
  outer.quadraticCurveTo(-half, half, -half, half - c);
  outer.lineTo(-half, -half + c);
  outer.quadraticCurveTo(-half, -half, -half + c, -half);
  const hole = new THREE.Path();
  hole.absarc(0, 0, r, 0, Math.PI * 2, true);
  outer.holes.push(hole);
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const h = new THREE.Path();
    h.absarc(sx * (half - 7.5), sy * (half - 7.5), 2.2, 0, Math.PI * 2, true);
    outer.holes.push(h);
  }
  const frame = new THREE.ExtrudeGeometry(outer, { depth: 25, bevelEnabled: false, curveSegments: 20 });
  frame.translate(0, 0, -12.5);
  frame.rotateX(-Math.PI / 2);
  frame.scale(S, S, S);

  // ใบพัดโค้ง 9 ใบ (รวมเป็นชิ้นเดียว → วาดครั้งเดียว)
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const sh = new THREE.Shape();
    sh.moveTo(12, -5);
    sh.quadraticCurveTo(r * 0.6, -14, r - 2, -3);
    sh.quadraticCurveTo(r * 0.7, 9, 12, 6);
    sh.lineTo(12, -5);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false, curveSegments: 6 });
    g.rotateX(0.38); // มุมบิดใบพัด
    g.rotateZ((i / 9) * Math.PI * 2);
    blades.push(g);
  }
  const hub = new THREE.CylinderGeometry(13, 13, 14, 24);
  hub.rotateX(Math.PI / 2);
  blades.push(hub.toNonIndexed());
  hub.dispose();
  const bladesGeo = mergeGeometries(blades)!;
  for (const g of blades) g.dispose();
  bladesGeo.rotateX(-Math.PI / 2);
  bladesGeo.scale(S, S, S);

  const ring = new THREE.TorusGeometry(r - 1, 1.6, 8, 48);
  ring.rotateX(Math.PI / 2);
  ring.scale(S, S, S);

  const out = { frame, blades: bladesGeo, ring };
  fanGeoCache.set(size, out);
  return out;
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* ผังเคส + จุดยึดพัดลม/หม้อน้ำ (ใช้ทั้งวาดโมเดลและเช็กว่าใส่ได้จริง)    */
/* ------------------------------------------------------------------ */
type Axis = "x" | "y" | "z";
type V3 = [number, number, number];
const AX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export type MountId = "top" | "front" | "side" | "rear" | "bottom";
export type MountKind = "none" | "fans" | "rad";
export interface MountSetting {
  kind: MountKind;
  count: number;
  /** เลื่อนตำแหน่งตามแนวจุดยึด (มม., 0 = กึ่งกลาง) */
  offset?: number;
  /** กลับทิศพัดลม (ดูดเข้า ↔ เป่าออก) */
  reverse?: boolean;
}
export type MountConfig = Record<MountId, MountSetting>;

const SHROUD_H = 95;
const SHROUD_TOP = 18 + SHROUD_H + 2;
/** ฝาครอบ PSU เว้นช่องด้านหน้าไว้ให้พัดลม/หม้อน้ำหน้า */
const SHROUD_X0 = -D / 2 + 70;
const MB_TOP = H - 32;

export const MOUNT_IDS: MountId[] = ["top", "front", "side", "rear", "bottom"];
export const MOUNTS: Record<MountId, { label: string; wall: V3; inward: [Axis, 1 | -1]; along: Axis; avail: number; intake: boolean }> = {
  top: { label: "บน", wall: [-12, H - 10, 10], inward: ["y", -1], along: "x", avail: 400, intake: false },
  front: { label: "หน้า", wall: [-D / 2 + 12, (30 + H - 12) / 2, 0], inward: ["x", 1], along: "y", avail: H - 42, intake: true },
  side: { label: "ข้าง", wall: [-D / 2 + 80, (SHROUD_TOP + H - 12) / 2, -W / 2 + 24], inward: ["z", 1], along: "y", avail: H - 12 - SHROUD_TOP, intake: true },
  rear: { label: "หลัง", wall: [D / 2 - 6, MB_TOP - 80, -15], inward: ["x", -1], along: "y", avail: 160, intake: false },
  bottom: { label: "ล่าง", wall: [(SHROUD_X0 + D / 2 - 2) / 2, SHROUD_TOP + 3, 25], inward: ["y", 1], along: "x", avail: D / 2 - 2 - SHROUD_X0 - 1, intake: true },
};

const crossAxis = (id: MountId): Axis => (["x", "y", "z"] as Axis[]).find((a) => a !== MOUNTS[id].along && a !== MOUNTS[id].inward[0])!;
/** จุดในพิกัดของจุดยึด: เลื่อนตามแนววาง / เข้าในเคส / แนวขวาง (มม.) */
function mountAt(id: MountId, alongOff: number, inwardOff: number, crossOff = 0): V3 {
  const m = MOUNTS[id];
  const p: V3 = [...m.wall];
  p[AX[m.along]] += alongOff;
  p[AX[m.inward[0]]] += m.inward[1] * inwardOff;
  p[AX[crossAxis(id)]] += crossOff;
  return p;
}
/** ขนาดกล่อง (x,y,z) จากความยาวตามแนววาง / ความหนา / ความกว้าง */
function mountSize(id: MountId, alongLen: number, thick: number, cross: number): V3 {
  const s: V3 = [0, 0, 0];
  s[AX[MOUNTS[id].along]] = alongLen;
  s[AX[MOUNTS[id].inward[0]]] = thick;
  s[AX[crossAxis(id)]] = cross;
  return s;
}

export const radFanSize = (radMm: number) => (radMm % 140 === 0 ? 140 : 120);
export function mountCaps(id: MountId) {
  const a = MOUNTS[id].avail;
  return { fans: Math.max(1, Math.floor(a / 120)), radMax: Math.floor((a - 37) / 120) * 120 };
}
export const radFits = (id: MountId, radMm: number) => MOUNTS[id].avail >= radMm + 37;

type Parts = PcModelInput["build"];
/** ตำแหน่ง/ขนาดชิ้นหลักในเคส (มม.) */
export function pcLayout(build: Parts, gpuCount = 1) {
  const form = build.motherboard?.specs.formFactor ?? "ATX";
  const mbW = form === "ITX" ? 170 : 244;
  const mbH = form === "ITX" ? 170 : form === "mATX" ? 244 : 305;
  const mbRight = D / 2 - 18;
  const mbTop = MB_TOP;
  const mbX = mbRight - mbW / 2;
  const mbY = mbTop - mbH / 2;
  const mbZ = -W / 2 + 32;
  const sockX = mbRight - (form === "ITX" ? 70 : 95);
  const sockY = mbTop - (form === "ITX" ? 70 : 92);
  const pcieY = mbTop - 150;
  // ช่อง PCIe x16 (ขนาดเต็ม) ห่างกัน 3 สล็อต = 61 มม.
  const x16 = build.motherboard?.specs.pcieX16Slots ?? (form === "ITX" ? 1 : 2);
  const pcieSlotsY = Array.from({ length: x16 }, (_, i) => pcieY - i * 61);
  const gpuN = build.gpu ? Math.max(1, Math.min(gpuCount, x16)) : 1;
  const ramSlots = form === "ITX" ? 2 : build.motherboard?.specs.ramSlots ?? 4;
  const ramX0 = sockX - 52;
  const gpuLenRaw = build.gpu?.specs.lengthMm ?? 300;
  const gpuLen = Math.min(D - 40, gpuLenRaw);
  const gpuThick = (build.gpu?.specs.vramGb ?? 12) >= 16 ? 70 : 56;
  const gpuDepth = 128;
  const gx = D / 2 - 20 - gpuLen / 2;
  const gTop = pcieY - 4;
  const coolerType = build.cooler?.specs.coolerType ?? "aio";
  const radMm = build.cooler?.specs.radiatorMm ?? 240;
  const coolerH = build.cooler?.specs.coolerHeightMm ?? 155;
  const gpuTops = pcieSlotsY.slice(0, gpuN).map((y) => y - 4);
  return { pcieSlotsY, gpuTops, gpuN, form, mbW, mbH, mbRight, mbTop, mbX, mbY, mbZ, sockX, sockY, pcieY, ramSlots, ramX0, gpuLenRaw, gpuLen, gpuThick, gpuDepth, gx, gTop, coolerType, radMm, coolerH };
}

type Box = { min: V3; max: V3 };
const stackLen = (s: MountSetting, radMm: number) => (s.kind === "rad" ? radMm + 37 : s.kind === "fans" ? s.count * 120 : 0);
/** ระยะที่เลื่อนได้ไปแต่ละข้าง (มม.) */
export function mountSlack(id: MountId, s: MountSetting, radMm: number) {
  return Math.max(0, Math.floor((MOUNTS[id].avail - stackLen(s, radMm)) / 2));
}
const clampOffset = (id: MountId, s: MountSetting, radMm: number) => {
  const k = mountSlack(id, s, radMm);
  return Math.max(-k, Math.min(k, s.offset ?? 0));
};
/** ทิศลมจริงของจุดยึด (คิดรวมการกลับทิศ) */
export const mountIntake = (id: MountId, s: MountSetting) => MOUNTS[id].intake !== !!s.reverse;
function stackBox(id: MountId, s: MountSetting, radMm: number): Box | null {
  if (s.kind === "none") return null;
  const rad = s.kind === "rad";
  const fs = rad ? radFanSize(radMm) : 120;
  const len = stackLen(s, radMm);
  const thick = (rad ? 29 : 0) + 27;
  const o = clampOffset(id, s, radMm);
  const a = mountAt(id, o - len / 2, 0, -(fs + 4) / 2);
  const b = mountAt(id, o + len / 2, thick, (fs + 4) / 2);
  return { min: [0, 1, 2].map((i) => Math.min(a[i], b[i])) as V3, max: [0, 1, 2].map((i) => Math.max(a[i], b[i])) as V3 };
}
function partBoxes(L: ReturnType<typeof pcLayout>, build: Parts): Array<{ name: string; box: Box }> {
  const out: Array<{ name: string; box: Box }> = [
    { name: "เมนบอร์ด", box: { min: [L.mbX - L.mbW / 2, L.mbY - L.mbH / 2, L.mbZ - 2], max: [L.mbX + L.mbW / 2, L.mbTop, L.mbZ + 34] } },
    { name: "แรม", box: { min: [L.ramX0 - (L.ramSlots - 1) * 9 - 4, L.sockY - 80, L.mbZ], max: [L.ramX0 + 4, L.sockY + 60, L.mbZ + 47] } },
  ];
  if (build.gpu || !build.cpu?.specs.hasIgpu)
    L.gpuTops.forEach((t, k) =>
      out.push({ name: L.gpuN > 1 ? `การ์ดจอใบที่ ${k + 1}` : "การ์ดจอ", box: { min: [L.gx - L.gpuLen / 2, t - L.gpuThick, L.mbZ + 6], max: [L.gx + L.gpuLen / 2, t + 3, L.mbZ + 8 + L.gpuDepth] } })
    );
  if (L.coolerType === "air") out.push({ name: "ฮีตซิงก์ซีพียู", box: { min: [L.sockX - 55, L.sockY - 56, L.mbZ], max: [L.sockX + 30, L.sockY + 68, L.mbZ + L.coolerH] } });
  else out.push({ name: "ปั๊มน้ำ", box: { min: [L.sockX - 33, L.sockY - 33, L.mbZ], max: [L.sockX + 33, L.sockY + 33, L.mbZ + 45] } });
  return out;
}
const overlap = (a: Box, b: Box, tol: number) => [0, 1, 2].every((i) => a.min[i] < b.max[i] - tol && b.min[i] < a.max[i] - tol);

export interface FitIssue {
  level: "error" | "warn";
  text: string;
  mount?: MountId;
}
/** เช็กว่าประกอบได้จริง: ความยาวการ์ดจอ ความสูงฮีตซิงก์ ขนาดหม้อน้ำ และของในจุดยึดชนชิ้นอื่นไหม */
export function checkFit(build: Parts, mounts: MountConfig, gpuCount = 1): FitIssue[] {
  const L = pcLayout(build, gpuCount);
  const cs = build.case?.specs;
  const out: FitIssue[] = [];
  if (build.gpu && gpuCount > 1) {
    if (gpuCount > L.pcieSlotsY.length)
      out.push({ level: "error", text: `เมนบอร์ดนี้มีช่อง PCIe x16 แค่ ${L.pcieSlotsY.length} ช่อง ใส่การ์ดจอได้สูงสุด ${L.pcieSlotsY.length} ใบ` });
    if (L.gpuN > 1) {
      const slotsThick = (L.gpuThick / 20.32).toFixed(1);
      if (L.gpuThick > 61 - 2) out.push({ level: "error", text: `การ์ดจอหนา ${slotsThick} สล็อต ใส่ 2 ใบติดกันไม่ได้ (ใบบนทับใบล่าง)` });
      const bottom = L.gpuTops[L.gpuN - 1] - L.gpuThick;
      if (bottom < SHROUD_TOP - 3) out.push({ level: "error", text: `การ์ดจอใบล่างชนฝาครอบ PSU ของเคส` });
      out.push({ level: "warn", text: "เกมส่วนใหญ่ไม่รองรับหลายการ์ดแล้ว (SLI/CrossFire เลิกพัฒนา) เหมาะกับงานเรนเดอร์/AI มากกว่า" });
    }
  }
  if (build.gpu && cs?.maxGpuLengthMm && L.gpuLenRaw > cs.maxGpuLengthMm)
    out.push({ level: "error", text: `การ์ดจอยาว ${L.gpuLenRaw} มม. เกินที่เคสรับได้ (${cs.maxGpuLengthMm} มม.)` });
  if (L.coolerType === "air" && build.cooler && cs?.maxCoolerHeightMm && L.coolerH > cs.maxCoolerHeightMm)
    out.push({ level: "error", text: `ฮีตซิงก์สูง ${L.coolerH} มม. เกินที่เคสรับได้ (${cs.maxCoolerHeightMm} มม.)` });
  if (L.coolerType === "aio") {
    if (!MOUNT_IDS.some((id) => mounts[id].kind === "rad"))
      out.push({ level: "error", text: MOUNT_IDS.some((id) => radFits(id, L.radMm)) ? "ยังไม่ได้เลือกที่ติดหม้อน้ำ" : `เคสนี้ไม่มีจุดไหนใส่หม้อน้ำ ${L.radMm} มม. ได้` });
    if (build.cooler && cs?.supportedRadiatorsMm?.length && !cs.supportedRadiatorsMm.includes(L.radMm))
      out.push({ level: "warn", text: `สเปกเคสระบุว่ารองรับหม้อน้ำ ${cs.supportedRadiatorsMm.join("/")} มม.` });
  }
  const parts = partBoxes(L, build);
  for (const id of MOUNT_IDS) {
    const s = mounts[id];
    const label = MOUNTS[id].label;
    if (s.kind === "rad" && !radFits(id, L.radMm)) {
      out.push({ level: "error", text: `หม้อน้ำ ${L.radMm} มม. ใส่ด้าน${label}ไม่ได้ (ยาวสุด ${mountCaps(id).radMax} มม.)`, mount: id });
      continue;
    }
    if (s.kind === "fans" && s.count > mountCaps(id).fans) out.push({ level: "error", text: `ด้าน${label}ใส่พัดลมได้สูงสุด ${mountCaps(id).fans} ตัว`, mount: id });
    const b = stackBox(id, s, L.radMm);
    if (!b) continue;
    const what = s.kind === "rad" ? `หม้อน้ำ ${L.radMm}` : `พัดลมด้าน${label}`;
    for (const p of parts) if (overlap(b, p.box, 3)) out.push({ level: "error", text: `${what}${s.kind === "rad" ? `ด้าน${label}` : ""} ชน${p.name}`, mount: id });
  }
  return out;
}

/** จัดค่าจุดยึดให้ถูกตามชุดระบายความร้อน (ชุดน้ำต้องมีหม้อน้ำ 1 จุด, ซิงก์ลมไม่มีหม้อน้ำ) */
export function normalizeMounts(build: Parts, m: MountConfig, gpuCount = 1): MountConfig {
  const L = pcLayout(build, gpuCount);
  const out = Object.fromEntries(MOUNT_IDS.map((id) => [id, { ...m[id] }])) as MountConfig;
  const asFans = (id: MountId) => ({ kind: "fans" as const, count: Math.min(2, mountCaps(id).fans) });
  if (L.coolerType !== "aio") {
    for (const id of MOUNT_IDS) if (out[id].kind === "rad") out[id] = asFans(id);
  } else {
    const rads = MOUNT_IDS.filter((id) => out[id].kind === "rad");
    for (const id of rads.slice(1)) out[id] = asFans(id);
    const cur = rads[0];
    if (!cur || !radFits(cur, L.radMm)) {
      if (cur) out[cur] = asFans(cur);
      const next = (["top", "front", "bottom", "side", "rear"] as MountId[]).find((id) => radFits(id, L.radMm));
      if (next) out[next] = { kind: "rad", count: L.radMm / radFanSize(L.radMm) };
    }
  }
  for (const id of MOUNT_IDS) if (out[id].kind === "fans") out[id].count = Math.max(1, Math.min(mountCaps(id).fans, out[id].count));
  for (const id of MOUNT_IDS) out[id].offset = clampOffset(id, out[id], L.radMm);
  // พัดลมที่ชนชิ้นอื่นหลังเปลี่ยนชิ้นส่วน → ลดจำนวน/เอาออกให้อัตโนมัติ
  const pb = partBoxes(L, build);
  const hits = (id: MountId) => {
    const b = stackBox(id, out[id], L.radMm);
    return !!b && pb.some((p) => overlap(b, p.box, 3));
  };
  for (const id of MOUNT_IDS) {
    while (out[id].kind === "fans" && hits(id)) {
      if (out[id].count > 1) out[id] = { ...out[id], count: out[id].count - 1, offset: 0 };
      else out[id] = { kind: "none", count: 0 };
    }
  }
  return out;
}

/** ตรวจค่าจุดยึดที่มาจากลิงก์แชร์ (ข้อมูลภายนอก) */
export function sanitizeMounts(x: unknown): MountConfig | null {
  if (!x || typeof x !== "object") return null;
  const src = x as Record<string, Partial<MountSetting>>;
  const out = {} as MountConfig;
  for (const id of MOUNT_IDS) {
    const v = src[id];
    if (!v || !["none", "fans", "rad"].includes(v.kind as string)) return null;
    out[id] = {
      kind: v.kind as MountKind,
      count: Number.isFinite(v.count) ? Math.max(0, Math.min(4, Math.floor(v.count as number))) : 1,
      offset: Number.isFinite(v.offset) ? Math.max(-400, Math.min(400, Number(v.offset))) : 0,
      reverse: v.reverse === true,
    };
  }
  return out;
}

export function defaultMounts(build: Parts, gpuCount = 1): MountConfig {
  const aio = pcLayout(build).coolerType === "aio";
  return normalizeMounts(build, {
    top: aio ? { kind: "rad", count: 0 } : { kind: "fans", count: 2 },
    front: { kind: "none", count: 0 },
    side: { kind: "none", count: 0 },
    rear: { kind: "fans", count: 1 },
    bottom: { kind: "fans", count: 2 },
  }, gpuCount);
}

/** ลมเข้า/ออก และแรงดันในเคส */
export function airflowSummary(build: Parts, mounts: MountConfig) {
  const radMm = pcLayout(build).radMm;
  let intake = 0;
  let exhaust = 0;
  for (const id of MOUNT_IDS) {
    const s = mounts[id];
    const n = s.kind === "fans" ? s.count : s.kind === "rad" ? radMm / radFanSize(radMm) : 0;
    if (mountIntake(id, s)) intake += n;
    else exhaust += n;
  }
  const label = intake > exhaust ? "แรงดันบวก · ฝุ่นเข้าน้อย" : intake < exhaust ? "แรงดันลบ · ฝุ่นเข้าตามร่องได้" : "แรงดันสมดุล";
  return { intake, exhaust, label };
}

export function buildPcModel(input: PcModelInput): PcModel {
  const { build, rgb } = input;
  const root = new THREE.Group();
  const parts = new Map<string, THREE.Group>();
  const rotors: THREE.Object3D[] = [];
  const rgbMeshes: THREE.Mesh[] = [];
  const rgbLights: THREE.PointLight[] = [];
  const centers = new Map<string, THREE.Vector3>();
  const owned: Array<THREE.Material | THREE.BufferGeometry> = [];

  const group = (slot: string) => {
    let g = parts.get(slot);
    if (!g) {
      g = new THREE.Group();
      g.userData.slot = slot;
      parts.set(slot, g);
      root.add(g);
    }
    return g;
  };

  const mat = (p: THREE.MeshStandardMaterialParameters | THREE.MeshPhysicalMaterialParameters, physical = false) => {
    const m = physical ? new THREE.MeshPhysicalMaterial(p) : new THREE.MeshStandardMaterial(p);
    owned.push(m);
    return m;
  };

  const white = (part?: PcPart | null) => part?.color === "white" || part?.color === "silver";

  // ---------- วัสดุ ----------
  const caseWhite = white(build.case);
  const M = {
    chassis: mat({ color: caseWhite ? "#eceef1" : "#16181c", metalness: 0.55, roughness: 0.38 }),
    chassisIn: mat({ color: caseWhite ? "#dfe2e6" : "#101215", metalness: 0.5, roughness: 0.5 }),
    mesh: mat({ color: caseWhite ? "#f2f3f5" : "#1b1d21", metalness: 0.6, roughness: 0.45, alphaMap: meshTex(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
    rubber: mat({ color: "#0b0b0c", roughness: 0.9 }),
    blackPlastic: mat({ color: "#121316", metalness: 0.1, roughness: 0.55 }),
    darkMetal: mat({ color: "#26292e", metalness: 0.85, roughness: 0.32 }),
    silver: mat({ color: "#c7cbd1", metalness: 0.95, roughness: 0.22 }),
    gold: mat({ color: "#d4a94a", metalness: 1, roughness: 0.3 }),
    copper: mat({ color: "#b87346", metalness: 1, roughness: 0.28 }),
    pcbDark: mat({ map: pcbTex(true), metalness: 0.15, roughness: 0.6 }),
    pcbLight: mat({ map: pcbTex(false), metalness: 0.15, roughness: 0.6 }),
    slotBlack: mat({ color: "#0d0e10", roughness: 0.6 }),
    slotGrey: mat({ color: "#6b7078", roughness: 0.5 }),
    fins: mat({ map: finTex(), metalness: 0.8, roughness: 0.35 }),
    sleeve: mat({ color: "#1a1b1e", roughness: 0.75 }),
    sleeveWhite: mat({ color: "#e9ebee", roughness: 0.7 }),
    rgb: mat({ color: rgb, emissive: rgb, emissiveIntensity: 2.2, roughness: 0.4 }),
    glass: mat(
      // กระจกใสจริง: ฝ้าน้อย เงาสะท้อนพอดี (ไม่ให้ข้างในดูเทาหม่น)
      { color: "#dfe4ea", transparent: true, opacity: 0.055, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.85, depthWrite: false },
      true
    ),
    frit: mat({ color: "#050506", roughness: 0.4, metalness: 0.2 }),
    label: mat({ color: "#e6e7e9", roughness: 0.6 }),
  };
  const rgbMat = M.rgb;

  /** กล่องพิกัด มม. (ศูนย์กลาง) */
  const box = (parent: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(BOX, m);
    mesh.scale.set(u(w), u(h), u(d));
    mesh.position.set(u(x), u(y), u(z));
    parent.add(mesh);
    if (m === rgbMat) rgbMeshes.push(mesh);
    return mesh;
  };
  const cyl = (parent: THREE.Object3D, m: THREE.Material, r: number, len: number, x: number, y: number, z: number, axis: "x" | "y" | "z" = "y", lowPoly = false) => {
    const mesh = new THREE.Mesh(lowPoly ? CYL8 : CYL, m);
    mesh.scale.set(u(r), u(len), u(r));
    if (axis === "x") mesh.rotation.z = Math.PI / 2;
    if (axis === "z") mesh.rotation.x = Math.PI / 2;
    mesh.position.set(u(x), u(y), u(z));
    parent.add(mesh);
    return mesh;
  };
  const rounded = (parent: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, r = 3) => {
    const g = new RoundedBoxGeometry(u(w), u(h), u(d), 2, u(r));
    owned.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(u(x), u(y), u(z));
    parent.add(mesh);
    return mesh;
  };
  /** ชิ้นเล็กซ้ำๆ (ตัวเก็บประจุ ครีบ ฯลฯ) วาดเป็นชุดเดียว */
  const instanced = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, items: Array<[number, number, number, number, number, number]>, axis: "y" | "z" = "y") => {
    const im = new THREE.InstancedMesh(geo, m, items.length);
    const o = new THREE.Object3D();
    items.forEach(([x, y, z, sx, sy, sz], i) => {
      o.position.set(u(x), u(y), u(z));
      o.scale.set(u(sx), u(sy), u(sz));
      o.rotation.set(axis === "z" ? Math.PI / 2 : 0, 0, 0);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    parent.add(im);
    return im;
  };
  const tube = (parent: THREE.Object3D, m: THREE.Material, pts: Array<[number, number, number]>, r: number, seg = 20) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(u(x), u(y), u(z))));
    const g = new THREE.TubeGeometry(curve, seg, u(r), 8, false);
    owned.push(g);
    const mesh = new THREE.Mesh(g, m);
    parent.add(mesh);
    return mesh;
  };
  const fan = (parent: THREE.Object3D, size: number, x: number, y: number, z: number, dir: "x" | "-x" | "y" | "-y" | "z" | "-z") => {
    const geo = fanGeometry(size);
    const g = new THREE.Group();
    const stealth = input.fanStyle === "stealth";
    const frameMat = stealth || !caseWhite ? M.blackPlastic : mat({ color: "#eef0f2", roughness: 0.5 });
    g.add(new THREE.Mesh(geo.frame, frameMat));
    const rotor = new THREE.Mesh(geo.blades, stealth ? M.blackPlastic : mat({ color: caseWhite ? "#f4f5f7" : "#202226", roughness: 0.45, transparent: true, opacity: 0.92 }));
    g.add(rotor);
    rotors.push(rotor);
    if (!stealth) {
      const ring = new THREE.Mesh(geo.ring, rgbMat);
      ring.position.y = u(12.6);
      g.add(ring);
      rgbMeshes.push(ring);
      if (input.fanStyle === "dual_ring" || input.fanStyle === "sl_infinity") {
        const ring2 = new THREE.Mesh(geo.ring, rgbMat);
        ring2.position.y = u(-12.6);
        g.add(ring2);
        rgbMeshes.push(ring2);
      }
    }
    const rot: Record<string, [number, number, number]> = {
      y: [0, 0, 0],
      "-y": [Math.PI, 0, 0],
      x: [0, 0, -Math.PI / 2],
      "-x": [0, 0, Math.PI / 2],
      z: [Math.PI / 2, 0, 0],
      "-z": [-Math.PI / 2, 0, 0],
    };
    g.rotation.set(...rot[dir]);
    g.position.set(u(x), u(y), u(z));
    parent.add(g);
    return g;
  };

  /** ชิ้นย่อย: ยกขึ้นมาดูแล้วกระจายออกตามทิศ off (มม.) */
  const subs = new Map<string, THREE.Group[]>();
  const sub = (part: THREE.Group, key: string, label: string, off: V3, hideOnDetail = false) => {
    const slot = part.userData.slot as string;
    const list = subs.get(slot) ?? [];
    const hit = list.find((g) => g.userData.sub === key);
    if (hit) return hit;
    const g = new THREE.Group();
    g.userData = { sub: key, label, off: new THREE.Vector3(u(off[0]), u(off[1]), u(off[2])), hideOnDetail };
    part.add(g);
    list.push(g);
    subs.set(slot, list);
    return g;
  };
  const L = pcLayout(build, input.gpuCount ?? 1);
  const { form, mbW, mbH, mbRight, mbTop, mbX, mbY, mbZ, sockX, sockY, pcieY, ramSlots, ramX0, gpuLen, gpuThick, gpuDepth, gx, coolerType, radMm } = L;
  const shroudH = SHROUD_H;

  /* =============================== เคส =============================== */
  const kase = group("case");
  const T = 1.2; // ความหนาแผ่นเหล็ก
  const cFrame = sub(kase, "frame", "โครงเคส + ถาดเมนบอร์ด", [0, 0, 0]);
  const cTop = sub(kase, "top", "ฝาบน + ตะแกรงกันฝุ่น", [0, 120, 0]);
  const cRear = sub(kase, "rear", "แผงหลัง + ฝาช่อง PCIe", [120, 0, 0]);
  const cShroud = sub(kase, "shroud", "ฝาครอบ PSU (Shroud)", [0, -10, 170]);
  const cPillar = sub(kase, "pillar", "เสาหน้า + แถบไฟ", [-90, 0, 90]);
  rounded(cFrame, M.chassis, D, 18, W, 0, 9 + 12, 0, 4); // ฐาน
  rounded(cTop, M.chassis, D, 10, W, 0, H - 5, 0, 4); // ฝาบน
  box(cTop, M.mesh, D - 60, 1, W - 50, 0, H + 0.2, 0); // ตะแกรงบน
  box(cRear, M.chassis, T * 4, H - 30, W, D / 2 - 2.4, H / 2 + 6, 0); // แผงหลัง
  box(cFrame, M.chassisIn, D, H - 30, T * 3, 0, H / 2 + 6, -W / 2 + 2); // แผงข้าง (ฝั่งถาด)
  box(cFrame, M.chassisIn, D - 30, H - 120, 3, 0, H / 2 + 40, -W / 2 + 22); // ถาดเมนบอร์ด
  // รูร้อยสาย (ยางกันสาย)
  for (let i = 0; i < 3; i++) box(cFrame, M.rubber, 14, 46, 1, mbX - mbW / 2 - 22, sockY - 30 - i * 70, -W / 2 + 24);
  rounded(cPillar, M.chassis, 14, H - 20, 14, -D / 2 + 7, H / 2 + 6, W / 2 - 7, 3);
  box(cPillar, rgbMat, 3, H - 60, 3, -D / 2 + 7, H / 2 + 6, W / 2 + 0.5);
  for (const [fx, fz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) cyl(cFrame, M.rubber, 12, 12, fx * (D / 2 - 40), 6, fz * (W / 2 - 30));
  cyl(cTop, M.silver, 6, 3, -D / 2 + 40, H + 1.5, W / 2 - 40);
  for (let i = 0; i < 2; i++) box(cTop, M.blackPlastic, 13, 1, 6, -D / 2 + 70 + i * 20, H + 0.6, W / 2 - 40);
  box(cTop, M.blackPlastic, 9, 1, 4, -D / 2 + 115, H + 0.6, W / 2 - 40);
  const shW = D / 2 - 2 - SHROUD_X0;
  rounded(cShroud, M.chassis, shW, shroudH, W - 30, SHROUD_X0 + shW / 2, 18 + shroudH / 2 + 2, 2, 3);
  box(cShroud, M.mesh, 120, 1, 90, 40, SHROUD_TOP + 0.6, 30);
  // ด้านข้าง shroud ฝั่งกระจก: โลโก้ + ช่องระบาย + หน้าต่างโชว์ป้าย PSU + เส้นไฟ
  const shFront = W / 2 - 15 + 2 + 0.6;
  const logo = new THREE.Mesh(BOX, mat({ map: shroudLogoTex(caseWhite), roughness: 0.5, metalness: 0.3, transparent: true }));
  logo.scale.set(u(150), u(26), u(0.6));
  logo.position.set(u(SHROUD_X0 + shW * 0.42), u(18 + shroudH * 0.55), u(shFront));
  cShroud.add(logo);
  for (let i = 0; i < 9; i++) box(cShroud, M.frit, 2.4, 30, 0.8, SHROUD_X0 + shW - 30 - i * 6, 18 + shroudH * 0.5, shFront);
  box(cShroud, M.frit, 70, 34, 0.8, SHROUD_X0 + 48, 18 + shroudH * 0.5, shFront); // หน้าต่าง PSU
  box(cShroud, M.label, 40, 14, 0.9, SHROUD_X0 + 48, 18 + shroudH * 0.5, shFront + 0.1); // ป้ายรุ่น PSU
  box(cShroud, rgbMat, shW - 16, 1.4, 1, SHROUD_X0 + shW / 2, SHROUD_TOP - 3, shFront + 0.2);
  // แถบไฟ LED ใต้ฝาบน (ด้านหน้ากระจก) ส่องลงให้เห็นชิ้นข้างใน
  box(cTop, rgbMat, D - 70, 2, 5, 0, H - 13, W / 2 - 18);
  for (let i = 0; i < 7; i++) box(cRear, M.darkMetal, 2, 12, 20, D / 2 + 0.5, 105 + i * 20.3, -W / 2 + 70);
  // กระจกข้าง + ขอบดำ, กระจกหน้า
  const sideGlass = new THREE.Group();
  sideGlass.userData = { slot: "sideglass", noPick: true };
  box(sideGlass, M.glass, D - 8, H - 20, 4, 0, H / 2 + 6, W / 2 + 2);
  box(sideGlass, M.frit, D - 8, 10, 4.2, 0, H - 9, W / 2 + 2);
  box(sideGlass, M.frit, D - 8, 10, 4.2, 0, 21, W / 2 + 2);
  root.add(sideGlass);
  parts.set("sideglass", sideGlass);
  const frontGlass = new THREE.Group();
  frontGlass.userData = { slot: "glass", noPick: true };
  box(frontGlass, M.glass, 4, H - 20, W - 12, -D / 2 - 1, H / 2 + 6, 0);
  root.add(frontGlass);
  parts.set("glass", frontGlass);

  /* ============================ เมนบอร์ด ============================ */
  const mb = group("motherboard");
  const mbWhite = white(build.motherboard);
  const mPcb = sub(mb, "pcb", "แผงวงจรเมนบอร์ด", [0, 0, 0]);
  const mVrm = sub(mb, "vrm", "ฮีตซิงก์ VRM (ภาคจ่ายไฟซีพียู)", [0, 25, 55]);
  const mIo = sub(mb, "io", "ฝาครอบพอร์ตหลัง (I/O)", [35, 0, 70]);
  const mChip = sub(mb, "chipset", "ฮีตซิงก์ชิปเซ็ต", [-20, -20, 45]);
  box(mPcb, mbWhite ? M.pcbLight : M.pcbDark, mbW, mbH, 1.6, mbX, mbY, mbZ - 0.8);
  box(mPcb, M.darkMetal, 58, 58, 4, sockX, sockY, mbZ + 2); // ซ็อกเก็ต
  box(mPcb, M.silver, 6, 50, 3, sockX + 33, sockY, mbZ + 3); // ก้านล็อก
  // ชุดจ่ายไฟ (choke) ใต้ฮีตซิงก์ VRM — เห็นตอนยกฮีตซิงก์ออก
  const chokes: Array<[number, number, number, number, number, number]> = [];
  for (let i = 0; i < 8; i++) chokes.push([sockX - 40 + i * 9, sockY + 52, mbZ + 5, 7, 7, 8]);
  for (let i = 0; i < 6; i++) chokes.push([sockX + 52, sockY - 30 + i * 9, mbZ + 5, 7, 7, 8]);
  instanced(mPcb, BOX, M.slotGrey, chokes);
  const vrmMat = mbWhite ? mat({ color: "#e8eaee", metalness: 0.7, roughness: 0.35, roughnessMap: brushedTex() }) : M.darkMetal;
  rounded(mVrm, vrmMat, 70, 26, 20, sockX - 10, sockY + 52, mbZ + 19, 3);
  rounded(mVrm, vrmMat, 26, 78, 20, sockX + 52, sockY - 8, mbZ + 19, 3);
  instanced(mVrm, BOX, vrmMat, Array.from({ length: 10 }, (_, i) => [sockX - 40 + i * 7, sockY + 52, mbZ + 31, 2, 22, 6] as [number, number, number, number, number, number]));
  rounded(mIo, mbWhite ? vrmMat : M.blackPlastic, 24, 110, 34, mbRight - 12, mbTop - 60, mbZ + 17, 4);
  box(mIo, rgbMat, 1.5, 90, 2, mbRight - 24.5, mbTop - 60, mbZ + 30);
  const caps: Array<[number, number, number, number, number, number]> = [];
  for (let i = 0; i < 8; i++) caps.push([sockX - 35 + i * 9, sockY + 34, mbZ + 4.5, 3.2, 8, 3.2]);
  for (let i = 0; i < 6; i++) caps.push([sockX + 38, sockY - 38 + i * 9, mbZ + 4.5, 3.2, 8, 3.2]);
  instanced(mPcb, CYL8, M.silver, caps, "z");
  const chips: Array<[number, number, number, number, number, number]> = [];
  let seed = 3;
  const rr = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 18; i++) chips.push([mbX - mbW / 2 + 20 + rr() * (mbW - 60), mbY - mbH / 2 + 15 + rr() * (mbH * 0.45), mbZ + 1, 4 + rr() * 8, 4 + rr() * 6, 1.4]);
  instanced(mPcb, BOX, M.blackPlastic, chips);
  for (let i = 0; i < ramSlots; i++) {
    const x = ramX0 - i * 9;
    box(mPcb, i % 2 ? M.slotGrey : M.slotBlack, 6, 140, 7, x, sockY - 10, mbZ + 3.5);
    box(mPcb, M.slotGrey, 6, 6, 9, x, sockY - 10 + 72, mbZ + 4.5);
  }
  box(mPcb, M.slotBlack, 10, 52, 14, mbX - mbW / 2 + 8, sockY - 25, mbZ + 7); // 24-pin
  // น็อตยึดเมนบอร์ด (ตำแหน่งตามมาตรฐาน ATX โดยประมาณ)
  const screws: Array<[number, number, number, number, number, number]> = [];
  for (const [fx, fy] of [[0.04, 0.04], [0.04, 0.5], [0.04, 0.96], [0.5, 0.04], [0.5, 0.96], [0.96, 0.04], [0.96, 0.5], [0.96, 0.96], [0.62, 0.5]])
    screws.push([mbX - mbW / 2 + fx * mbW, mbY - mbH / 2 + fy * mbH, mbZ + 1.2, 3.2, 1.6, 3.2]);
  instanced(mPcb, CYL8, M.silver, screws, "z");
  box(mPcb, M.slotBlack, 18, 9, 12, sockX + 10, mbTop - 6, mbZ + 6); // 8-pin
  box(mPcb, M.silver, 90, 7.5, 9, mbRight - 65, pcieY, mbZ + 4.5); // PCIe x16 เสริมเหล็ก
  if (form !== "ITX") {
    box(mPcb, M.slotBlack, 90, 6, 7, mbRight - 65, pcieY - 60, mbZ + 3.5);
    box(mPcb, M.slotBlack, 25, 6, 7, mbRight - 32, pcieY - 22, mbZ + 3.5);
    box(mPcb, M.blackPlastic, 22, 22, 2, mbX - mbW / 2 + 40, mbY - mbH / 2 + 32, mbZ + 1); // ชิปเซ็ต (ใต้ฮีตซิงก์)
    rounded(mChip, vrmMat, 52, 46, 9, mbX - mbW / 2 + 40, mbY - mbH / 2 + 32, mbZ + 7, 3);
  }
  for (let i = 0; i < 4; i++) box(mPcb, M.slotBlack, 7, 11, 9, mbX - mbW / 2 + 6, mbY - mbH / 2 + 60 + i * 13, mbZ + 4.5); // SATA
  cyl(mPcb, M.silver, 10, 3, mbX + 10, mbY - mbH / 2 + 25, mbZ + 2, "z"); // ถ่าน BIOS
  for (let i = 0; i < 6; i++) box(mIo, M.slotGrey, 8, 14, 13, D / 2 + 1, mbTop - 25 - i * 17, -W / 2 + 60); // พอร์ตหลัง

  /* ============================ M.2 SSD ============================ */
  const ssd = group("storage");
  const sHeat = sub(ssd, "heat", "ฮีตซิงก์ M.2", [0, 0, 35]);
  const sPcb = sub(ssd, "pcb", "แผง SSD (ชิป NAND + คอนโทรลเลอร์)", [0, 0, 0]);
  const ssdPcbMat = mat({ color: "#0f3a24", roughness: 0.6 });
  const nSsd = Math.max(1, Math.min(2, input.storageCount));
  for (let i = 0; i < nSsd; i++) {
    const y = pcieY + (form === "ITX" ? -40 : -30 - i * 60);
    const x = mbRight - 65 - (form === "ITX" ? 0 : 5);
    box(sPcb, ssdPcbMat, 80, 22, 0.8, x, y, mbZ + 1.2);
    box(sPcb, M.blackPlastic, 14, 14, 1.4, x - 22, y, mbZ + 2.2); // คอนโทรลเลอร์
    for (let k = 0; k < 2; k++) box(sPcb, M.blackPlastic, 16, 13, 1.4, x + 2 + k * 20, y, mbZ + 2.2); // NAND
    box(sPcb, M.gold, 4, 20, 0.9, x + 41, y, mbZ + 1.2); // ขาคอนแทค
    rounded(sHeat, mbWhite ? vrmMat : M.darkMetal, 80, 22, 6, x, y, mbZ + 6, 2);
    box(sHeat, M.silver, 60, 1, 1, x, y + 6, mbZ + 9.2);
    box(sHeat, M.silver, 60, 1, 1, x, y - 6, mbZ + 9.2);
  }

  // ฮาร์ดดิสก์ 3.5" + SSD 2.5" (SATA) ในกรงใต้ฝาครอบ PSU ฝั่งหน้า — เห็นตอนแยกชิ้น/เปิดฝาครอบ
  const nHdd = Math.min(2, input.hddCount ?? 0);
  const nSata = Math.min(2, input.sataSsdCount ?? 0);
  if (nHdd + nSata > 0) {
    const sCage = sub(ssd, "cage", `กรงไดรฟ์ (HDD ${nHdd} · SSD SATA ${nSata})`, [0, 0, 60]);
    const cx = SHROUD_X0 - 45;
    const cz = -W / 2 + 95;
    box(sCage, M.chassisIn, 150, 4, 108, cx, 24, cz);
    for (let i = 0; i < nHdd; i++) {
      const y = 28 + i * 32 + 13;
      box(sCage, mat({ color: "#9aa0a8", metalness: 0.85, roughness: 0.35, roughnessMap: brushedTex() }), 147, 26, 101, cx, y, cz);
      box(sCage, M.label, 80, 0.6, 60, cx - 10, y + 13.4, cz);
      box(sCage, ssdPcbMat, 90, 1.6, 70, cx + 10, y - 13.6, cz);
    }
    for (let i = 0; i < nSata; i++) {
      const y = 28 + nHdd * 32 + i * 12 + 4;
      box(sCage, mat({ color: "#1f2328", metalness: 0.5, roughness: 0.4 }), 100, 7, 70, cx, y, cz);
      box(sCage, M.label, 60, 0.4, 40, cx, y + 3.7, cz);
    }
  }

  /* ============================== CPU =============================== */
  const cpu = group("cpu");
  const cSub = sub(cpu, "substrate", "แผงซีพียู + ชิปเล็ต (Die)", [0, 0, 0]);
  const cIhs = sub(cpu, "ihs", "ฝากระจายความร้อน (IHS)", [0, 0, 32]);
  box(cSub, mat({ color: "#1f4d33", roughness: 0.55 }), 40, 40, 1.4, sockX, sockY, mbZ + 4.7);
  box(cSub, M.blackPlastic, 10, 12, 0.8, sockX - 7, sockY + 6, mbZ + 5.8);
  box(cSub, M.blackPlastic, 10, 12, 0.8, sockX - 7, sockY - 8, mbZ + 5.8);
  box(cSub, M.darkMetal, 12, 22, 0.8, sockX + 8, sockY, mbZ + 5.8);
  rounded(cIhs, M.silver, 38, 38, 2.6, sockX, sockY, mbZ + 7.4, 2);
  box(cIhs, M.label, 22, 6, 0.4, sockX, sockY - 6, mbZ + 8.9);

  /* ======================== ชุดระบายความร้อน ======================== */
  const cooler = group("cooler");
  const coolerWhite = white(build.cooler);
  if (coolerType === "air") {
    const cBase = sub(cooler, "base", "ฐานทองแดง", [0, 0, 0]);
    const cTower = sub(cooler, "tower", "ครีบระบายความร้อน + ท่อฮีตไปป์", [0, 0, 45]);
    const cFan = sub(cooler, "fan", "พัดลมฮีตซิงก์", [-70, 0, 45]);
    box(cBase, M.copper, 40, 40, 8, sockX, sockY, mbZ + 13);
    const towerZ = mbZ + L.coolerH - 65;
    for (let i = 0; i < 4; i++) tube(cTower, M.copper, [[sockX - 12 + i * 8, sockY, mbZ + 14], [sockX - 12 + i * 8, sockY + 6, mbZ + 40], [sockX - 12 + i * 8, sockY + 6, towerZ + 60]], 3, 10);
    const finMat = coolerWhite ? mat({ color: "#e9ebef", metalness: 0.75, roughness: 0.3 }) : mat({ color: "#2b2e33", metalness: 0.8, roughness: 0.3 });
    instanced(cTower, BOX, finMat, Array.from({ length: 34 }, (_, i) => [sockX - 26 + i * 1.6, sockY + 6, towerZ, 0.5, 125, 120] as [number, number, number, number, number, number]));
    box(cTower, finMat, 56, 125, 2, sockX + 1, sockY + 6, towerZ + 60);
    fan(cFan, 120, sockX - 42, sockY + 6, towerZ, "x");
  } else {
    const cPump = sub(cooler, "pump", "ปั๊มน้ำ + ฐานทองแดง", [0, 0, 0]);
    const cCap = sub(cooler, "cap", "ฝาปั๊ม (จอ + ไฟ RGB)", [0, 0, 50]);
    const pumpMat = coolerWhite ? mat({ color: "#eceef1", metalness: 0.4, roughness: 0.35 }) : M.blackPlastic;
    box(cPump, M.copper, 40, 40, 3, sockX, sockY, mbZ + 10.5);
    cyl(cPump, pumpMat, 32, 30, sockX, sockY, mbZ + 27, "z");
    const ringMesh = cyl(cCap, rgbMat, 33, 3, sockX, sockY, mbZ + 43.5, "z");
    rgbMeshes.push(ringMesh);
    cyl(cCap, pumpMat, 33, 2, sockX, sockY, mbZ + 46, "z");
    cyl(cCap, mat({ color: "#0a0a0a", metalness: 0.2, roughness: 0.15, emissive: "#1a2b44", emissiveIntensity: 0.6 }), 27, 1.5, sockX, sockY, mbZ + 47.6, "z");
  }

  /* ============================== แรม =============================== */
  const ram = group("ram");
  const ramWhite = white(build.ram);
  const rPcb = sub(ram, "pcb", "แผงแรม + ชิปหน่วยความจำ", [0, 0, 0]);
  const rSpread = sub(ram, "spreader", "ฮีตสเปรดเดอร์ (ฝาครอบแรม)", [0, 0, 40]);
  const rRgb = sub(ram, "rgb", "แถบไฟ RGB", [0, 0, 75]);
  const nRam = Math.max(1, Math.min(ramSlots, input.ramSticks));
  const order = ramSlots >= 4 ? [1, 3, 0, 2] : [0, 1];
  const spreader = ramWhite ? mat({ color: "#eef0f3", metalness: 0.75, roughness: 0.3, roughnessMap: brushedTex() }) : M.darkMetal;
  const ramRgb = build.ram?.specs.hasRgb !== false;
  for (let k = 0; k < nRam; k++) {
    const x = ramX0 - order[k] * 9;
    box(rPcb, M.pcbDark, 1.2, 133, 31, x, sockY - 10, mbZ + 7 + 15.5);
    instanced(rPcb, BOX, M.blackPlastic, Array.from({ length: 8 }, (_, i) => [x, sockY - 10 - 56 + i * 16, mbZ + 7 + 18, 3.2, 11, 10] as [number, number, number, number, number, number]));
    rounded(rSpread, spreader, 6.6, 135, 36, x, sockY - 10, mbZ + 7 + 19, 1.5);
    // ร่องระบายความร้อนบนฝาแรม (ลายนูนแนวเฉียง)
    for (let i = 0; i < 4; i++) rounded(rSpread, spreader, 7.6, 18, 3, x, sockY - 10 - 45 + i * 30, mbZ + 7 + 30, 1);
    if (ramRgb) box(rRgb, rgbMat, 6, 130, 6, x, sockY - 10, mbZ + 7 + 40);
    else rounded(rSpread, spreader, 6.6, 130, 6, x, sockY - 10, mbZ + 7 + 40, 1.5);
  }

  /* ============================= การ์ดจอ ============================= */
  const gpu = group("gpu");
  const gpuWhite = white(build.gpu);
  const gz = mbZ + 8 + gpuDepth / 2;
  const gBack = sub(gpu, "backplate", "แผ่นหลัง (Backplate)", [0, 75, 0]);
  const gPcb = sub(gpu, "pcb", "แผงวงจร + ชิป GPU", [0, 40, 0]);
  const gFins = sub(gpu, "fins", "ฮีตซิงก์ + ท่อฮีตไปป์", [0, 0, 0]);
  const gShroud = sub(gpu, "shroud", "ฝาครอบ (Shroud) + ไฟ", [0, -50, 30]);
  const gFans = sub(gpu, "fans", "พัดลมการ์ดจอ", [0, -95, 0]);
  const gBracket = sub(gpu, "bracket", "แผ่นยึด + พอร์ตจอ", [55, 0, 0]);
  const shroudMat = gpuWhite ? mat({ color: "#eef0f3", metalness: 0.45, roughness: 0.35 }) : mat({ color: "#1c1e22", metalness: 0.55, roughness: 0.35, roughnessMap: brushedTex() });
  const gpuSideMat = mat({ map: gpuSideTex(gpuWhite), transparent: true, alphaTest: 0.05, metalness: 0.4, roughness: 0.4 });
  const backMat = gpuWhite ? mat({ color: "#dfe2e7", metalness: 0.8, roughness: 0.3, roughnessMap: brushedTex() }) : M.darkMetal;
  for (const gT of L.gpuTops) {
    rounded(gBack, backMat, gpuLen, 3, gpuDepth, gx, gT, gz, 2);
    // ช่องระบายบนแผ่นหลัง (flow-through) + แถบโลโก้
    instanced(gBack, BOX, M.blackPlastic, Array.from({ length: 7 }, (_, i) => [gx + gpuLen / 2 - 30 - i * 7, gT + 1.6, gz, 3, 0.6, gpuDepth * 0.6] as [number, number, number, number, number, number]));
    box(gBack, M.label, gpuLen * 0.3, 0.6, 10, gx - gpuLen * 0.15, gT + 1.7, gz + gpuDepth * 0.3);
    box(gPcb, M.pcbDark, gpuLen - 20, 1.6, gpuDepth - 8, gx + 8, gT - 3, gz);
    box(gPcb, M.darkMetal, 30, 1.6, 30, gx + 30, gT - 4.6, gz); // ชิป GPU
    instanced(gPcb, BOX, M.blackPlastic, Array.from({ length: 8 }, (_, i) => [gx + 30 + (i < 4 ? -32 : 32), gT - 4.4, gz - 36 + (i % 4) * 24, 14, 1.2, 12] as [number, number, number, number, number, number]));
    box(gPcb, M.slotBlack, 18, 6, 10, gx + gpuLen * 0.1, gT - 4, mbZ + 8 + gpuDepth + 4); // 12VHPWR
    box(gPcb, M.gold, 89, 1, 8, D / 2 - 20 - 60, gT + 2, mbZ + 4); // ขาเสียบ PCIe
    box(gFins, M.fins, gpuLen - 30, gpuThick - 22, gpuDepth - 14, gx + 6, gT - 4 - (gpuThick - 22) / 2, gz);
    for (let i = 0; i < 4; i++) cyl(gFins, M.copper, 3, gpuLen - 20, gx + 6, gT - 10 - (i % 2) * 14, gz - 30 + i * 20, "x");
    rounded(gShroud, shroudMat, gpuLen, 14, gpuDepth, gx, gT - gpuThick + 7, gz, 4);
    rounded(gShroud, shroudMat, gpuLen, gpuThick - 6, 6, gx, gT - gpuThick / 2, mbZ + 8 + gpuDepth - 3, 3);
    box(gShroud, gpuSideMat, gpuLen * 0.94, gpuThick - 14, 0.3, gx, gT - gpuThick / 2, mbZ + 8 + gpuDepth + 0.2);
    box(gShroud, rgbMat, gpuLen * 0.55, 6, 1.5, gx - gpuLen * 0.1, gT - gpuThick / 2, mbZ + 8 + gpuDepth + 0.6);
    const nGpuFans = gpuLen >= 280 ? 3 : 2;
    const fanStep = (gpuLen - 30) / nGpuFans;
    for (let i = 0; i < nGpuFans; i++) {
      const fx = gx - gpuLen / 2 + 15 + fanStep * (i + 0.5);
      const gf = fan(gFans, Math.min(100, fanStep - 6), fx, gT - gpuThick + 2, gz, "-y");
      gf.children[0].visible = false; // การ์ดจอใช้ช่องกลม ไม่มีกรอบเหลี่ยม
    }
    box(gBracket, M.silver, 2, gpuThick + 6, 18, D / 2 - 2, gT - gpuThick / 2, mbZ + 8);
    for (let i = 0; i < 4; i++) box(gBracket, M.blackPlastic, 2.4, 5, 10, D / 2 - 1, gT - 10 - i * 10, mbZ + 8);
  }

  /* ========================= พาวเวอร์ซัพพลาย ========================= */
  const psu = group("psu");
  const sfx = build.psu?.specs.psuFormFactor === "SFX";
  const pw = sfx ? 125 : 160;
  const ph = sfx ? 63.5 : 86;
  const pd = sfx ? 100 : 150;
  const psuWhite = white(build.psu);
  const px = D / 2 - 6 - pw / 2;
  const py = 20 + ph / 2 + 2;
  const pz = -W / 2 + 18 + pd / 2;
  const pBase = sub(psu, "base", "ฐาน + ตะแกรงพัดลม", [0, 0, 0]);
  const pIn = sub(psu, "inside", "แผงวงจรภายใน (คาปาซิเตอร์ หม้อแปลง ฮีตซิงก์)", [0, 25, 0]);
  const pCover = sub(psu, "cover", "ฝาครอบ PSU", [0, 70, 0]);
  const pMod = sub(psu, "modular", "ช่องเสียบสายแบบถอดได้", [0, 0, 40]);
  const psuMat = psuWhite ? mat({ color: "#eef0f3", metalness: 0.5, roughness: 0.4 }) : mat({ color: "#202226", metalness: 0.6, roughness: 0.45, roughnessMap: brushedTex() });
  const baseH = ph * 0.16;
  const py0 = py - ph / 2;
  rounded(pBase, psuMat, pw, baseH, pd, px, py0 + baseH / 2, pz, 2);
  cyl(pBase, M.mesh, sfx ? 44 : 62, 1, px, py0 - 0.4, pz);
  // ภายใน
  box(pIn, mat({ color: "#2a4d2e", roughness: 0.6 }), pw - 12, 1.6, pd - 12, px, py0 + baseH + 1, pz);
  for (let i = 0; i < 2; i++) box(pIn, mat({ color: "#9aa3ad", metalness: 0.8, roughness: 0.35 }), 4, ph * 0.5, pd * 0.55, px - pw * 0.25 + i * pw * 0.42, py0 + baseH + ph * 0.25, pz);
  for (let i = 0; i < 3; i++) cyl(pIn, mat({ color: "#1d2a52", roughness: 0.4 }), 8, ph * 0.42, px + pw * 0.18, py0 + baseH + ph * 0.21, pz - pd * 0.25 + i * 20, "y");
  box(pIn, mat({ color: "#c9a24a", metalness: 0.4, roughness: 0.5 }), 26, ph * 0.35, 26, px - pw * 0.05, py0 + baseH + ph * 0.18, pz + pd * 0.2);
  // ฝาครอบ (เปิดออกให้เห็นด้านใน)
  const coverH = ph - baseH;
  rounded(pCover, psuMat, pw, coverH, pd, px, py0 + baseH + coverH / 2, pz, 4);
  box(pCover, M.label, pw * 0.6, ph * 0.35, 0.6, px - 8, py, pz + pd / 2 + 0.4);
  box(pCover, rgbMat, pw * 0.5, 2, 1, px - 8, py - ph * 0.3, pz + pd / 2 + 0.5);
  for (let i = 0; i < 6; i++) box(pMod, M.slotBlack, 14, 8, 2, px - pw / 2 + 20 + (i % 3) * 22, py - 14 + Math.floor(i / 3) * 14, pz + pd / 2 + 0.8);

  /* ====================== พัดลม/หม้อน้ำ ตามจุดยึด ====================== */
  const fansG = group("fans");
  const airflow = new THREE.Group();
  airflow.visible = false;
  airflow.userData.noPick = true;
  root.add(airflow);
  const arrows: PcModel["arrows"] = [];
  const intakeMat = new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.85, depthWrite: false });
  const exhaustMat = new THREE.MeshBasicMaterial({ color: "#fb923c", transparent: true, opacity: 0.85, depthWrite: false });
  owned.push(intakeMat, exhaustMat);
  const addArrow = (id: MountId, center: V3) => {
    const m = MOUNTS[id];
    const inward = new THREE.Vector3();
    inward.setComponent(AX[m.inward[0]], m.inward[1]);
    const isIn = mountIntake(id, input.mounts[id]);
    const dir = isIn ? inward.clone() : inward.clone().negate();
    const a = new THREE.Mesh(arrowGeometry(), isIn ? intakeMat : exhaustMat);
    a.scale.setScalar(u(55));
    a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const base = new THREE.Vector3(u(center[0]), u(center[1]), u(center[2])).addScaledVector(inward, u(isIn ? 35 : 10));
    a.position.copy(base);
    airflow.add(a);
    arrows.push({ obj: a, base, dir });
  };
  const mountGhosts = new THREE.Group();
  mountGhosts.visible = false;
  mountGhosts.userData.noPick = true;
  root.add(mountGhosts);
  const mountAnchors = new Map<MountId, THREE.Vector3>();
  let radInlet: { id: MountId; pts: V3[] } | null = null;
  for (const id of MOUNT_IDS) {
    const m = MOUNTS[id];
    const s = input.mounts[id];
    const ax = m.inward[0];
    // ช่องจุดยึด (โชว์ตอนเลือกจุดยึด)
    const ghost = box(mountGhosts, new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.22, depthWrite: false }), ...mountSize(id, m.avail, 4, 124), ...mountAt(id, 0, 3));
    owned.push(ghost.material as THREE.Material);
    ghost.userData.mount = id;
    const an = mountAt(id, 0, 45);
    mountAnchors.set(id, new THREE.Vector3(u(an[0]), u(an[1]), u(an[2])));
    const off = clampOffset(id, s, radMm);
    if (s.kind === "fans") {
      for (let i = 0; i < s.count; i++) {
        const c = mountAt(id, off + (i - (s.count - 1) / 2) * 120, 14.5);
        fan(fansG, 120, ...c, ax);
        addArrow(id, c);
      }
    } else if (s.kind === "rad" && coolerType === "aio") {
      const fs = radFanSize(radMm);
      const n = radMm / fs;
      const len = radMm + 37;
      const outward: V3 = [0, 0, 0];
      outward[AX[ax]] = -m.inward[1] * 70;
      const inwardOff: V3 = [0, 0, 0];
      inwardOff[AX[ax]] = m.inward[1] * 70;
      const rG = sub(cooler, "rad", `หม้อน้ำ ${radMm} มม.`, outward);
      const rfG = sub(cooler, "radfans", `พัดลมหม้อน้ำ ${n} ตัว`, inwardOff);
      const radMat = mat({ map: finTex(), metalness: 0.7, roughness: 0.4, color: coolerWhite ? "#ffffff" : "#8a8f96" });
      const tankMat = coolerWhite ? mat({ color: "#eceef1", metalness: 0.4, roughness: 0.35 }) : M.darkMetal;
      box(rG, radMat, ...mountSize(id, radMm + 2, 27.5, fs - 2), ...mountAt(id, off, 15));
      box(rG, tankMat, ...mountSize(id, len, 27, fs + 4), ...mountAt(id, off, 15));
      for (const e of [-1, 1]) box(rG, tankMat, ...mountSize(id, 17, 31, fs + 8), ...mountAt(id, off + e * (len / 2 - 8.5), 15));
      for (let i = 0; i < n; i++) {
        const c = mountAt(id, off - radMm / 2 + fs / 2 + i * fs, 29 + 2 + 12.5);
        fan(rfG, fs, ...c, ax);
        addArrow(id, c);
      }
      radInlet = { id, pts: [mountAt(id, off - len / 2 + 9, 15, -14), mountAt(id, off - len / 2 + 9, 15, 14)] };
    }
  }
  // ท่อน้ำ: จากปั๊มไปถังหม้อน้ำ (ซ่อนตอนแยกละเอียด)
  if (coolerType === "aio" && radInlet) {
    const tG = sub(cooler, "tubes", "ท่อน้ำ", [0, 0, 0], true);
    const tubeMat = coolerWhite ? M.sleeveWhite : M.sleeve;
    const m = MOUNTS[radInlet.id];
    radInlet.pts.forEach((end, k) => {
      const start: V3 = [sockX + (k ? 15 : -15), sockY + 22, mbZ + 32];
      const inn: V3 = [...end];
      inn[AX[m.inward[0]]] += m.inward[1] * 40;
      const mid: V3 = [(start[0] + inn[0]) / 2, (start[1] + inn[1]) / 2, Math.max(start[2], inn[2]) + 55 + k * 12];
      tube(tG, tubeMat, [start, [start[0], start[1] + 10, start[2] + 30], mid, inn, end], 6, 28);
    });
  }
  fansG.userData.slot = "case"; // พัดลมเคสนับเป็นส่วนของเคส

  /* ============================== สายไฟ ============================== */
  const cables = group("cables");
  const sleeve = caseWhite ? M.sleeveWhite : M.sleeve;
  // 24-pin: จากขอบบอร์ดด้านหน้า ลอดรูถาด
  for (let k = 0; k < 3; k++) {
    tube(cables, sleeve, [[mbX - mbW / 2 + 15, sockY - 40 + k * 15, mbZ + 14], [mbX - mbW / 2 - 12, sockY - 40 + k * 15, mbZ + 16], [mbX - mbW / 2 - 24, sockY - 40 + k * 15, mbZ - 8], [mbX - mbW / 2 - 26, sockY - 40 + k * 15, -W / 2 + 14]], 4.5, 10);
  }
  // ตัวจัดสาย (cable comb) ให้สายเรียงสวยแบบเคสโชว์
  box(cables, M.blackPlastic, 4, 44, 12, mbX - mbW / 2 - 12, sockY - 25, mbZ + 16);
  // 8-pin CPU: มุมบนซ้าย ลอดขึ้นด้านบนหลังถาด
  tube(cables, sleeve, [[sockX + 10, mbTop - 6, mbZ + 12], [sockX + 10, mbTop + 8, mbZ + 12], [sockX + 10, mbTop + 14, -W / 2 + 14]], 4, 8);
  // 12VHPWR การ์ดจอ: ลงไปที่ช่องบน shroud
  for (const gTop of L.gpuTops) tube(cables, sleeve, [[gx + gpuLen * 0.1, gTop - 4, mbZ + 8 + gpuDepth + 9], [gx + gpuLen * 0.1 - 10, gTop - 30, mbZ + 8 + gpuDepth + 20], [gx + gpuLen * 0.1 - 30, 20 + shroudH + 4, mbZ + 8 + gpuDepth + 6], [gx + gpuLen * 0.1 - 34, 20 + shroudH - 6, mbZ + 8 + gpuDepth - 10]], 5, 16);
  cables.userData.noPick = true;

  /* ======================= ไฟ RGB ภายในเคส ======================= */
  for (const [x, y, z, i] of [
    [0, H * 0.62, 40, 1.6],
    [-80, 140, 60, 1.2],
  ]) {
    const l = new THREE.PointLight(rgb, i, u(420), 2);
    l.position.set(u(x), u(y), u(z));
    root.add(l);
    rgbLights.push(l);
  }

  // พิกัดกลางของแต่ละชิ้น (ไว้วางป้าย)
  for (const [slot, g] of parts) {
    const b = new THREE.Box3().setFromObject(g);
    if (!b.isEmpty()) centers.set(slot, b.getCenter(new THREE.Vector3()));
  }

  // จุดกึ่งกลางชิ้นย่อย (ไว้วางป้ายชื่อ)
  for (const list of subs.values())
    for (const g of list) {
      const b = new THREE.Box3().setFromObject(g);
      g.userData.anchor = b.isEmpty() ? new THREE.Vector3() : b.getCenter(new THREE.Vector3());
    }
  // เงาจริง (เปิดใช้เมื่อเลือกคุณภาพสูง)
  root.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    const mt = me.material as THREE.Material;
    const lit = !mt.transparent && !(mt as THREE.MeshBasicMaterial).isMeshBasicMaterial && mt !== rgbMat;
    me.castShadow = lit;
    me.receiveShadow = lit;
  });

  root.position.y = MODEL_FLOOR_Y;

  return {
    root,
    parts,
    rotors,
    rgbMeshes,
    rgbLights,
    centers,
    subs,
    airflow,
    arrows,
    mountGhosts,
    mountAnchors,
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}

/** ทิศที่แต่ละชิ้นลอยออกมาตอนแยกชิ้น/ยกขึ้น (หน่วยฉาก) */
export const PART_LIFT: Record<string, [number, number, number]> = {
  motherboard: [0, 0.05, 2.3],
  cpu: [0.2, 0.55, 2.9],
  cooler: [-0.2, 0.55, 2.7],
  ram: [-0.35, 0.45, 2.75],
  gpu: [0, -0.15, 2.7],
  storage: [0.35, 0, 2.9],
  psu: [0.25, -0.1, 2.9],
  cables: [0, 0, 0],
  case: [0, 0, 0],
  glass: [-0.6, 0, 0],
  sideglass: [0, 0, 1.2],
};
