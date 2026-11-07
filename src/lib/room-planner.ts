import { parseShape, pointInShape, shapeBounds, shapeMetrics, signedArea, type Pt2 } from "./room-shape";
import type { SunSettings } from "./sun-simulation";

/**
 * ห้อง 3D จัดเอง (ตรรกะล้วน ไม่แตะ DOM — ทดสอบได้)
 * หน่วยทั้งหมดเป็น ซม. · จุดเริ่ม (0,0) = มุมห้องด้านหลังซ้าย · x = ความกว้างห้อง (ซ้าย→ขวา) · z = ความลึก (ผนังหลัง→ด้านหน้า)
 */

export interface RoomOpeningSpec {
  id: string;
  edgeIndex?: number;
  /** หากวางประตู/หน้าต่างบนกำแพงกั้นภายในห้อง */
  interiorWallId?: string;
  wall: "top" | "bottom" | "left" | "right";
  pos: number;
  width: number;
}

export interface InteriorWallSpec {
  id: string;
  /** พิกัดจุดเริ่มและจุดจบในหน่วย ซม. เทียบจากมุมบนซ้าย (0,0) ของห้อง */
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface RoomSize {
  /** กว้าง (ผนังหลัง) */
  w: number;
  /** ลึก (ผนังซ้าย) */
  d: number;
  /** สูงถึงฝ้า */
  h: number;
  /** หน้าต่าง: ผนังไหน + ตำแหน่งกึ่งกลาง (0–1 ตามความยาวผนัง) */
  win?: { wall: "back" | "left" | "none"; pos: number };
  /** รูปห้องจริงจากการวัด (แปลน ซม. วนตามลำดับ) · ไม่มี = สี่เหลี่ยม w × d */
  shape?: Pt2[];
  /** ทิศของห้อง (องศาเข็มทิศ 0 - 359): 0° = เหนือ (North) */
  orientation?: number;
  /** การตั้งค่าแสงอาทิตย์และเวลา */
  sunSettings?: SunSettings;
  /** รายการหน้าต่างทั้งหมดตามด้านผนัง */
  windows?: RoomOpeningSpec[];
  /** รายการประตูทั้งหมดตามด้านผนัง */
  doors?: RoomOpeningSpec[];
  /** รายการกำแพงกั้นภายในห้อง (เมื่อลูกค้าลากวาดเข้าไปในตัวห้อง) */
  interiorWalls?: InteriorWallSpec[];
}

export const DEFAULT_ROOM: RoomSize = { w: 300, d: 300, h: 260 };
export const ROOM_LIMITS = { min: 100, max: 1500, hMin: 200, hMax: 450 };

export interface PlanItem {
  uid: string;
  productId: string | null;
  name: string;
  category: string;
  /** ขนาดตอนหมุน 0° (กว้าง × ลึก × สูง) */
  w: number;
  d: number;
  h: number;
  /** ขนาดเดาจากหมวด (สินค้าไม่มีข้อมูลขนาด) */
  estimated: boolean;
  /** จุดกึ่งกลางบนพื้น */
  x: number;
  z: number;
  /** ความสูงจากพื้น (ของวางบนโต๊ะ) */
  y: number;
  /** มุมหมุนรอบแกนตั้ง (0 - 359.9 องศา รองรับทศนิยมและมุมกำแพงเฉียงทุกรูปแบบ) */
  rot: number;
  color: string;
  price: number;
}

/** ปรับค่ามุมหมุนให้อยู่ในช่วง 0 – 359.9 องศา (ความละเอียด 0.1°) */
export function normalizeRotDeg(deg: number): number {
  const raw = Math.round((Number(deg) || 0) * 10) / 10;
  const mod = ((raw % 360) + 360) % 360;
  return mod >= 359.95 ? 0 : Math.round(mod * 10) / 10;
}

/** ขนาดโดยประมาณตามหมวด เมื่อสินค้าไม่มีข้อมูลขนาด (ซม.) */
export const DEFAULT_DIMS: Record<string, [number, number, number]> = {
  desk: [120, 60, 75],
  chair: [60, 60, 110],
  bed: [160, 200, 45],
  wardrobe: [100, 55, 190],
  storage: [80, 35, 120],
  rug: [160, 230, 1],
  monitor: [62, 20, 45],
  monitor_arm: [15, 15, 45],
  keyboard: [44, 14, 4],
  keyboard_pad: [80, 30, 1],
  mouse: [7, 12, 4],
  mousepad: [80, 30, 1],
  speaker: [15, 18, 25],
  headphone: [18, 10, 22],
  microphone: [12, 12, 30],
  webcam: [10, 6, 6],
  lighting: [25, 25, 45],
  computer: [23, 46, 50],
  decor: [20, 20, 30],
  fake_plant: [40, 40, 110],
  real_plant: [40, 40, 110],
  plant_pot: [30, 30, 35],
  other: [40, 40, 40],
  door: [80, 6, 205],
};

/** ของที่วางบนโต๊ะ (ลอยอยู่ที่ความสูงโต๊ะ) */
export const ON_DESK = new Set([
  "monitor",
  "monitor_arm",
  "keyboard",
  "mouse",
  "mousepad",
  "keyboard_pad",
  "speaker",
  "headphone",
  "microphone",
  "webcam",
  "lighting",
]);

const COLOR: Record<string, string> = {
  desk: "#b98b5e",
  chair: "#2f3338",
  bed: "#e7dfd3",
  wardrobe: "#d8c3a5",
  storage: "#cdb595",
  rug: "#9aa6b2",
  monitor: "#16181c",
  computer: "#1c1e22",
  lighting: "#f6e7c8",
  decor: "#c7a27c",
  fake_plant: "#3f7d4a",
  real_plant: "#3f7d4a",
  plant_pot: "#a86f4c",
};

let seq = 0;
export function newUid(): string {
  seq = (seq + 1) % 1_000_000;
  return `it-${Date.now().toString(36)}-${seq}`;
}

/** สร้างชิ้นของในห้องจากสินค้า (ใช้ขนาดจริงถ้ามี ไม่งั้นใช้ขนาดเดาตามหมวด) */
export function itemFromProduct(p: {
  id: string;
  name: string;
  category: string;
  price?: number;
  dimensions?: { width: number | null; depth: number | null; height: number | null; unit?: string } | null;
  colors?: string[];
}): PlanItem {
  const def = DEFAULT_DIMS[p.category] ?? DEFAULT_DIMS.other;
  const k = p.dimensions?.unit === "mm" ? 0.1 : p.dimensions?.unit === "m" ? 100 : 1;
  const real = p.dimensions && p.dimensions.width && p.dimensions.depth && p.dimensions.height;
  const num = (v: number | null | undefined, f: number) => (v && v > 0 ? Math.round(v * k) : f);
  const c = p.colors?.[0];
  const colorHex =
    c === "white"
      ? "#eeeeec"
      : c === "black"
      ? "#1f2125"
      : c === "grey" || c === "gray"
      ? "#8d9299"
      : c === "wood" || c === "oak"
      ? "#b98b5e"
      : undefined;
  return {
    uid: newUid(),
    productId: p.id,
    name: p.name,
    category: p.category,
    w: num(p.dimensions?.width, def[0]),
    d: num(p.dimensions?.depth, def[1]),
    h: num(p.dimensions?.height, def[2]),
    estimated: !real,
    x: 0,
    z: 0,
    y: 0,
    rot: 0,
    color: colorHex ?? COLOR[p.category] ?? "#a8b0ba",
    price: p.price ?? 0,
  };
}

/* ============================================================================
 * ระบบเรขาคณิต 2D Oriented Bounding Box (OBB) & ป้องกันสิ่งของทะลุกำแพง 100%
 * ============================================================================
 * ใน RoomPlanner3D: group.rotation.y = (-it.rot * Math.PI) / 180
 * ดังนั้นเมื่อ θ = it.rot * π / 180:
 *  - แกนความกว้าง (Local +X) บนพื้นโลก = u = (cos θ, sin θ)
 *  - แกนด้านหน้าของสิ่งของ (Local +Z) บนพื้นโลก = v = (-sin θ, cos θ)
 */

interface ItemAxes {
  ux: number;
  uz: number;
  vx: number;
  vz: number;
}

export function getItemAxes(rotDeg: number): ItemAxes {
  const th = ((Number(rotDeg) || 0) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  return { ux: c, uz: s, vx: -s, vz: c };
}

/** ระยะยื่นพิเศษของโมเดล 3D บางหมวด (เช่น หัวเตียง ขอบบัวตู้ ล้อเก้าอี้ 5 แฉก) เพื่อไม่ให้ส่วนยื่นทะลุผนัง */
function modelHalfExtents(it: Pick<PlanItem, "w" | "d" | "category">): { hw: number; hd: number } {
  let hw = it.w / 2;
  let hd = it.d / 2;
  if (it.category === "bed") {
    hw += 2.2; // หัวเตียงกว้าง w + 4 ซม.
    hd += 0.8;
  } else if (it.category === "wardrobe") {
    hw += 1.2; // ขอบคิ้วบน w + 2 ซม.
    hd += 1.8; // มือจับบานตู้ยื่นด้านหน้า
  } else if (it.category === "chair") {
    hw = Math.max(hw, Math.min(30.5, it.w * 0.52));
    hd = Math.max(hd, Math.min(30.5, it.d * 0.52));
  } else if (it.category === "lighting") {
    hw += 2;
    hd += 2;
  }
  return { hw, hd };
}

const OUTER_WALL_CLEARANCE_CM = 2.6; // พ้นบัวพื้น 1.55 ซม. + ระยะปลอดภัย 1.05 ซม.
const OUTER_WALL_CHECK_PAD_CM = 1.6;
const INTERIOR_WALL_CLAMP_HALF_CM = 6.8; // กำแพงกั้นหนาครึ่งละ 5 ซม. + บัวพื้น 1.35 ซม. + เผื่อ 0.45 ซม.
const INTERIOR_WALL_CHECK_HALF_CM = 6.0;

interface WallSeg2D {
  key: string;
  isInterior: boolean;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  mx: number;
  mz: number;
  len: number;
  tx: number;
  tz: number;
  /** เวกเตอร์ตั้งฉากชี้เข้าในห้อง (สำหรับกำแพงนอก) หรือตั้งฉากด้านหนึ่ง (สำหรับกำแพงในห้อง) */
  inx: number;
  inz: number;
}

function getRoomPolygonCCW(room: RoomSize): Pt2[] {
  if (room.shape && room.shape.length >= 3) {
    return signedArea(room.shape) >= 0 ? room.shape : [...room.shape].reverse();
  }
  return [
    [0, 0],
    [room.w, 0],
    [room.w, room.d],
    [0, room.d],
  ];
}

function getRoomWallSegments(room: RoomSize): { poly: Pt2[]; outer: WallSeg2D[]; interior: WallSeg2D[] } {
  const poly = getRoomPolygonCCW(room);
  const outer: WallSeg2D[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 1e-3) continue;
    const tx = (x2 - x1) / len;
    const tz = (z2 - z1) / len;
    // signedArea >= 0: ทิศออกนอกห้อง = (tz, -tx), ทิศเข้าในห้อง = (-tz, tx)
    const inx = -tz;
    const inz = tx;
    outer.push({
      key: `outer:${i}`,
      isInterior: false,
      x1,
      z1,
      x2,
      z2,
      mx: (x1 + x2) * 0.5,
      mz: (z1 + z2) * 0.5,
      len,
      tx,
      tz,
      inx,
      inz,
    });
  }

  const interior: WallSeg2D[] = [];
  if (room.interiorWalls) {
    room.interiorWalls.forEach((iw, idx) => {
      const len = Math.hypot(iw.x2 - iw.x1, iw.z2 - iw.z1);
      if (len < 10) return;
      const tx = (iw.x2 - iw.x1) / len;
      const tz = (iw.z2 - iw.z1) / len;
      interior.push({
        key: `iw:${iw.id || idx}`,
        isInterior: true,
        x1: iw.x1,
        z1: iw.z1,
        x2: iw.x2,
        z2: iw.z2,
        mx: (iw.x1 + iw.x2) * 0.5,
        mz: (iw.z1 + iw.z2) * 0.5,
        len,
        tx,
        tz,
        inx: -tz,
        inz: tx,
      });
    });
  }

  return { poly, outer, interior };
}

/** ดึงจุด (x, z) ที่หลุดออกนอกแปลนหลายเหลี่ยมกลับเข้ามาในขอบเขตห้องที่ใกล้ที่สุด */
function pullPointInsidePolygon(x: number, z: number, poly: Pt2[], outer: WallSeg2D[], pullCm: number): { x: number; z: number } {
  if (pointInShape(x, z, poly)) return { x, z };
  let bestDistSq = Infinity;
  let bestPx = x;
  let bestPz = z;
  let bestInx = 0;
  let bestInz = 0;

  for (let i = 0; i < outer.length; i++) {
    const s = outer[i];
    const rx = x - s.x1;
    const rz = z - s.z1;
    const t = Math.max(0, Math.min(s.len, rx * s.tx + rz * s.tz));
    const px = s.x1 + s.tx * t;
    const pz = s.z1 + s.tz * t;
    const dSq = (x - px) ** 2 + (z - pz) ** 2;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestPx = px;
      bestPz = pz;
      if (t <= 0.5) {
        const prev = outer[(i - 1 + outer.length) % outer.length];
        const bx = prev.inx + s.inx;
        const bz = prev.inz + s.inz;
        const bLen = Math.hypot(bx, bz) || 1;
        bestInx = bx / bLen;
        bestInz = bz / bLen;
      } else if (t >= s.len - 0.5) {
        const next = outer[(i + 1) % outer.length];
        const bx = s.inx + next.inx;
        const bz = s.inz + next.inz;
        const bLen = Math.hypot(bx, bz) || 1;
        bestInx = bx / bLen;
        bestInz = bz / bLen;
      } else {
        bestInx = s.inx;
        bestInz = s.inz;
      }
    }
  }

  for (const step of [pullCm, pullCm * 0.5, 4, 1]) {
    const nx = bestPx + bestInx * step;
    const nz = bestPz + bestInz * step;
    if (pointInShape(nx, nz, poly)) return { x: nx, z: nz };
  }
  // Fallback: เฉลี่ยเข้าหาจุดกึ่งกลางมวลของห้องทีละขั้นจนกว่าจะอยู่ในห้อง
  const cx = poly.reduce((acc, p) => acc + p[0], 0) / poly.length;
  const cz = poly.reduce((acc, p) => acc + p[1], 0) / poly.length;
  for (let alpha = 0.1; alpha <= 1; alpha += 0.1) {
    const nx = bestPx + (cx - bestPx) * alpha;
    const nz = bestPz + (cz - bestPz) * alpha;
    if (pointInShape(nx, nz, poly)) return { x: nx, z: nz };
  }
  return { x: cx, z: cz };
}

/**
 * ตรวจการชนระหว่าง OBB ของสิ่งของ กับ แท่งกำแพง 2D ด้วย Separating Axis Theorem (4 แกน)
 * คืนเวกเตอร์ผลักออกที่สั้นและปลอดภัยที่สุด (หรือ null หากไม่ชน)
 */
function obbVsWallSlabPush(
  cx: number,
  cz: number,
  axes: ItemAxes,
  hw: number,
  hd: number,
  seg: WallSeg2D,
  inwardPadCm: number,
  poly: Pt2[]
): { dx: number; dz: number; overlap: number } | null {
  const hL = seg.len * 0.5;
  const slabOut = seg.isInterior ? inwardPadCm : 26;
  const slabMidInward = seg.isInterior ? 0 : (inwardPadCm - slabOut) * 0.5;
  const slabHalfThick = seg.isInterior ? inwardPadCm : (inwardPadCm + slabOut) * 0.5;

  const mwx = seg.mx + seg.inx * slabMidInward;
  const mwz = seg.mz + seg.inz * slabMidInward;

  const testAxes: Array<[number, number, boolean]> = [
    [seg.inx, seg.inz, true],
    [seg.tx, seg.tz, false],
    [axes.ux, axes.uz, false],
    [axes.vx, axes.vz, false],
  ];

  let best: { dx: number; dz: number; overlap: number } | null = null;
  let normalPush: { dx: number; dz: number; overlap: number } | null = null;

  for (const [ax, az, isWallNormal] of testAxes) {
    const rObb = hw * Math.abs(axes.ux * ax + axes.uz * az) + hd * Math.abs(axes.vx * ax + axes.vz * az);
    const rWall = hL * Math.abs(seg.tx * ax + seg.tz * az) + slabHalfThick * Math.abs(seg.inx * ax + seg.inz * az);
    const delta = (cx - mwx) * ax + (cz - mwz) * az;
    const ov = rObb + rWall - Math.abs(delta);
    if (ov <= 0) return null;

    let sign = delta >= 0 ? 1 : -1;
    // สำหรับกำแพงรอบนอก ห้ามผลักออกนอกห้องเด็ดขาด
    if (!seg.isInterior && isWallNormal) {
      sign = 1;
      const distInward = (cx - seg.mx) * seg.inx + (cz - seg.mz) * seg.inz;
      const exactOv = rObb + inwardPadCm - distInward;
      if (exactOv <= 0) return null;
      normalPush = { dx: seg.inx * exactOv, dz: seg.inz * exactOv, overlap: exactOv };
      if (!best || exactOv < best.overlap) {
        best = normalPush;
      }
      continue;
    }

    const pushDx = ax * sign * ov;
    const pushDz = az * sign * ov;

    if (!seg.isInterior) {
      // ยอมใช้แกนปลายกำแพงเฉพาะกรณีเลี้ยวอ้อมมุมเว้า (เช่น มุมในของห้องตัว L) ที่ผลลัพธ์ยังอยู่ในห้องจริง
      const dotIn = ax * sign * seg.inx + az * sign * seg.inz;
      if (dotIn < -0.15) continue;
      if (!pointInShape(cx + pushDx, cz + pushDz, poly)) continue;
    }

    if (!best || ov < best.overlap) {
      best = { dx: pushDx, dz: pushDz, overlap: ov };
    }
  }

  return best ?? normalPush;
}

/** ตรวจว่าสิ่งของ 2 ชิ้น (OBB หมุนอิสระ) ซ้อนทับกันบนระนาบ 2D หรือไม่ ด้วย 4-axis SAT */
function obbItemsOverlap2D(a: PlanItem, b: PlanItem, marginCm: number): boolean {
  const aa = getItemAxes(a.rot);
  const ab = getItemAxes(b.rot);
  const ha = { hw: Math.max(0.5, a.w * 0.5 + marginCm * 0.5), hd: Math.max(0.5, a.d * 0.5 + marginCm * 0.5) };
  const hb = { hw: Math.max(0.5, b.w * 0.5 + marginCm * 0.5), hd: Math.max(0.5, b.d * 0.5 + marginCm * 0.5) };
  const dx = b.x - a.x;
  const dz = b.z - a.z;

  const axes: Array<[number, number]> = [
    [aa.ux, aa.uz],
    [aa.vx, aa.vz],
    [ab.ux, ab.uz],
    [ab.vx, ab.vz],
  ];
  for (const [ax, az] of axes) {
    const ra = ha.hw * Math.abs(aa.ux * ax + aa.uz * az) + ha.hd * Math.abs(aa.vx * ax + aa.vz * az);
    const rb = hb.hw * Math.abs(ab.ux * ax + ab.uz * az) + hb.hd * Math.abs(ab.vx * ax + ab.vz * az);
    if (Math.abs(dx * ax + dz * az) >= ra + rb) return false;
  }
  return true;
}

/** ขนาดกรอบ AABB บนพื้นหลังหมุน (รองรับทุกองศา 0°–359.9°) */
export function footprint(it: Pick<PlanItem, "w" | "d" | "rot">): { w: number; d: number } {
  const th = ((Number(it.rot) || 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(th));
  const s = Math.abs(Math.sin(th));
  return {
    w: Math.round((it.w * c + it.d * s) * 10) / 10,
    d: Math.round((it.w * s + it.d * c) * 10) / 10,
  };
}

/**
 * ดันสิ่งของให้อยู่ในห้องอย่างแม่นยำ (รองรับหมุนทุกองศา, กำแพงเฉียงสามเหลี่ยม, ห้องตัว L และกำแพงกั้นในห้อง)
 * ไม่ให้มุมหรือขอบของสิ่งของทะลุกำแพงเด็ดขาด
 */
export function clampToRoom<T extends PlanItem>(it: T, room: RoomSize): T {
  if (it.category === "door") {
    const f = footprint(it);
    const hw = Math.min(f.w, room.w) / 2;
    const hd = Math.min(f.d, room.d) / 2;
    return {
      ...it,
      rot: normalizeRotDeg(it.rot),
      x: Math.min(room.w - hw, Math.max(hw, it.x)),
      z: Math.min(room.d - hd, Math.max(hd, it.z)),
    };
  }

  const rot = normalizeRotDeg(it.rot);
  const axes = getItemAxes(rot);
  const { hw, hd } = modelHalfExtents(it);
  const minHalf = Math.min(hw, hd, room.w * 0.45, room.d * 0.45);
  const { poly, outer, interior } = getRoomWallSegments(room);

  let x = Math.min(room.w - minHalf, Math.max(minHalf, it.x));
  let z = Math.min(room.d - minHalf, Math.max(minHalf, it.z));

  const pulled = pullPointInsidePolygon(x, z, poly, outer, minHalf + OUTER_WALL_CLEARANCE_CM);
  x = pulled.x;
  z = pulled.z;

  for (let iter = 0; iter < 8; iter++) {
    let moved = false;

    for (const seg of outer) {
      const push = obbVsWallSlabPush(x, z, axes, hw, hd, seg, OUTER_WALL_CLEARANCE_CM, poly);
      if (push && push.overlap > 0.02) {
        x += push.dx;
        z += push.dz;
        moved = true;
      }
    }

    for (const seg of interior) {
      const push = obbVsWallSlabPush(x, z, axes, hw, hd, seg, INTERIOR_WALL_CLAMP_HALF_CM, poly);
      if (push && push.overlap > 0.02) {
        x += push.dx * 1.02;
        z += push.dz * 1.02;
        moved = true;
      }
    }

    if (!pointInShape(x, z, poly)) {
      const rePulled = pullPointInsidePolygon(x, z, poly, outer, minHalf + OUTER_WALL_CLEARANCE_CM);
      x = rePulled.x;
      z = rePulled.z;
      moved = true;
    }

    if (!moved) break;
  }

  return {
    ...it,
    rot,
    x: Math.round(x * 10) / 10,
    z: Math.round(z * 10) / 10,
  };
}

/**
 * ตรวจสอบว่าสิ่งของทั้งชิ้น (รวมมุมเมื่อหมุนทุกองศา และของบนโต๊ะ y > 0) อยู่ในห้องจริงโดยไม่ทะลุกำแพงนอกหรือกำแพงกั้นในห้อง
 */
export function inRoom(it: PlanItem, room: RoomSize): boolean {
  if (it.category === "door") return true;
  const axes = getItemAxes(it.rot);
  const { hw, hd } = modelHalfExtents(it);
  const { poly, outer, interior } = getRoomWallSegments(room);

  // 1) จุดมุมทั้ง 4 + จุดกึ่งกลางขอบทั้ง 4 + จุดกึ่งกลางของ OBB ต้องอยู่ในแปลนห้องทั้งหมด
  const sampleHw = Math.max(0.5, hw + 0.8);
  const sampleHd = Math.max(0.5, hd + 0.8);
  for (const fx of [-1, 0, 1]) {
    for (const fz of [-1, 0, 1]) {
      const px = it.x + axes.ux * (fx * sampleHw) + axes.vx * (fz * sampleHd);
      const pz = it.z + axes.uz * (fx * sampleHw) + axes.vz * (fz * sampleHd);
      if (!pointInShape(px, pz, poly)) return false;
    }
  }

  // 2) ต้องไม่ชนหรือทะลุกำแพงรอบนอกทุกด้าน (รวมกำแพงเฉียงสามเหลี่ยมและมุมห้องตัว L)
  for (const seg of outer) {
    const hit = obbVsWallSlabPush(it.x, it.z, axes, hw, hd, seg, OUTER_WALL_CHECK_PAD_CM, poly);
    if (hit && hit.overlap > 0.25) return false;
  }

  // 3) ต้องไม่ทะลุกำแพงกั้นภายในห้อง
  for (const seg of interior) {
    const hit = obbVsWallSlabPush(it.x, it.z, axes, hw, hd, seg, INTERIOR_WALL_CHECK_HALF_CM, poly);
    if (hit && hit.overlap > 0.25) return false;
  }

  return true;
}

/**
 * ค้นหากำแพงที่อยู่ใกล้สิ่งของมากที่สุด (ทั้งกำแพงรอบนอก กำแพงเฉียงสามเหลี่ยม และกำแพงกั้นในห้อง)
 * พร้อมคำนวณองศาหมุนอัตโนมัติ (targetRot) ให้ด้านหลังสิ่งของแนบขนานไปกับแนวกำแพงพอดี
 */
export function findNearestWallForItem(
  it: Pick<PlanItem, "x" | "z" | "w" | "d" | "rot" | "category">,
  room: RoomSize,
  maxGapCm = 12
): { key: string; targetRot: number; gapCm: number } | null {
  if (it.category === "door") return null;
  const { outer, interior } = getRoomWallSegments(room);
  const axes = getItemAxes(it.rot);
  const hw = it.w * 0.5;
  const hd = it.d * 0.5;

  let best: { key: string; targetRot: number; gapCm: number; distCenter: number } | null = null;

  for (const seg of [...outer, ...interior]) {
    if (seg.len < 15) continue;
    const rx = it.x - seg.x1;
    const rz = it.z - seg.z1;
    const proj = rx * seg.tx + rz * seg.tz;

    // ต้องอยู่ในช่วงความยาวของผนัง (เผื่อปลายผนังเล็กน้อย 12 ซม. สำหรับเข้ามุมห้อง)
    if (proj < -12 || proj > seg.len + 12) continue;

    const t = Math.max(0, Math.min(seg.len, proj));
    const closeX = seg.x1 + seg.tx * t;
    const closeZ = seg.z1 + seg.tz * t;
    const distToSeg = Math.hypot(it.x - closeX, it.z - closeZ);

    const signedPerp = (it.x - seg.mx) * seg.inx + (it.z - seg.mz) * seg.inz;
    if (!seg.isInterior && signedPerp < -18) continue;

    const sideSign = seg.isInterior ? (signedPerp >= 0 ? 1 : -1) : 1;
    const inx = seg.inx * sideSign;
    const inz = seg.inz * sideSign;

    const wallHalf = seg.isInterior ? 6.2 : 0;
    // รัศมี OBB ของสิ่งของในทิศตั้งฉากกับแนวกำแพง
    const currentObbRadius =
      hw * Math.abs(axes.ux * inx + axes.uz * inz) + hd * Math.abs(axes.vx * inx + axes.vz * inz);
    const currentGap = distToSeg - wallHalf - currentObbRadius;

    // องศาฐานของกำแพง: ด้านหลังสิ่งของแนบกำแพง ด้านหน้า (+Z) หันเข้าในห้อง
    const wallBaseRot = normalizeRotDeg((Math.atan2(-inx, inz) * 180) / Math.PI);

    // ปรับให้สแนปเมื่อขอบสิ่งของเข้าใกล้กำแพงในระยะประชิดจริง (ชิด/ติดกำแพงจริง ไม่สแนปตอนลอยอยู่กลางห้อง)
    const effectiveGap = Math.max(0, currentGap);
    if (effectiveGap > maxGapCm) continue;

    if (!best || distToSeg < best.distCenter) {
      best = {
        key: seg.key,
        targetRot: wallBaseRot,
        gapCm: Math.round(effectiveGap * 10) / 10,
        distCenter: distToSeg,
      };
    }
  }

  return best ? { key: best.key, targetRot: best.targetRot, gapCm: best.gapCm } : null;
}

/** ปรับหมุนสิ่งของเข้าหาองศากำแพงที่ใกล้ที่สุดอัตโนมัติ (ยกเว้นเก้าอี้ที่กำลังวางคู่หน้าโต๊ะคอม) */
export function alignItemToNearestWall<T extends PlanItem>(
  it: T,
  room: RoomSize,
  allItems: PlanItem[] = [],
  maxGapCm = 28
): T {
  if (it.category === "door") return it;
  if (it.category === "chair") {
    const nearDesk = allItems.some(
      (o) =>
        o.uid !== it.uid &&
        o.category === "desk" &&
        Math.hypot(o.x - it.x, o.z - it.z) <= Math.max(o.w, o.d) * 0.72 + 45
    );
    if (nearDesk) return clampToRoom(it, room);
  }
  const near = findNearestWallForItem(it, room, maxGapCm);
  if (!near) return clampToRoom(it, room);
  return clampToRoom({ ...it, rot: near.targetRot }, room);
}

/** หมุนสิ่งของไปยังองศาที่กำหนดอย่างปลอดภัยในจุดเดิม พร้อมดันไม่ให้มุมทะลุกำแพง (ไม่วาปกระโดดไปจุดอื่น) */
export function rotateItemSafely(it: PlanItem, nextRotDeg: number, all: PlanItem[], room: RoomSize): PlanItem {
  const rot = normalizeRotDeg(nextRotDeg);
  const clamped = clampToRoom({ ...it, rot }, room);
  return clamped.y > 0 ? clampToRoom(settleOnTop(clamped, all, room), room) : clamped;
}

/**
 * หมุนสิ่งของเป้าหมายไปยังองศาที่ระบุ และหากเป็นโต๊ะที่มีของวางอยู่ด้านบน (เช่น จอ คีย์บอร์ด เมาส์)
 * จะหมุนของบนโต๊ะตามไปด้วยอย่างเป็นธรรมชาติโดยไม่ทะลุกำแพง
 */
export function rotateItemWithRiders(
  uid: string,
  nextRotDeg: number,
  items: PlanItem[],
  room: RoomSize
): PlanItem[] {
  const target = items.find((i) => i.uid === uid);
  if (!target) return items;

  const riders = items.filter(
    (o) =>
      o.uid !== target.uid &&
      o.y > 0 &&
      Math.abs(o.y - (target.y + target.h)) < 2 &&
      obbItemsOverlap2D(o, target, 0)
  );
  const riderIds = new Set(riders.map((r) => r.uid));
  const nonRiders = items.filter((i) => !riderIds.has(i.uid));

  const rotatedTarget: PlanItem = rotateItemSafely(target, nextRotDeg, nonRiders, room);
  const dRad = (((rotatedTarget.rot - target.rot) * Math.PI) / 180);
  const cosD = Math.cos(dRad);
  const sinD = Math.sin(dRad);

  return items.map((item) => {
    if (item.uid === uid) return rotatedTarget;
    if (!riderIds.has(item.uid)) return item;
    const rx = item.x - target.x;
    const rz = item.z - target.z;
    const nx = rotatedTarget.x + rx * cosD - rz * sinD;
    const nz = rotatedTarget.z + rx * sinD + rz * cosD;
    return clampToRoom(
      {
        ...item,
        x: Math.round(nx * 10) / 10,
        z: Math.round(nz * 10) / 10,
        rot: normalizeRotDeg(item.rot + (rotatedTarget.rot - target.rot)),
      },
      room
    );
  });
}

/** พื้นที่พื้นห้อง (ซม.²) */
export const floorArea = (room: RoomSize) =>
  room.shape ? shapeMetrics(room.shape).areaM2 * 10000 : room.w * room.d;

/** ของ 2 ชิ้นทับกันบนพื้นไหม (ไม่นับพรม และของบนโต๊ะ) */
export function overlaps(a: PlanItem, b: PlanItem, gap = 0): boolean {
  if (a.category === "rug" || b.category === "rug" || a.y > 0 || b.y > 0) return false;
  return obbItemsOverlap2D(a, b, gap * 2);
}

/** สินค้าชิ้นนี้ใส่ห้องนี้ได้ไหม (เผื่อ 10 ซม.) — ไม่มีข้อมูลขนาด = ถือว่าได้ */
export function fitsRoom(
  dim: { width: number | null; depth: number | null; height?: number | null } | null | undefined,
  room: RoomSize
): boolean {
  if (!dim?.width || !dim?.depth) return true;
  const big = Math.max(dim.width, dim.depth);
  const small = Math.min(dim.width, dim.depth);
  const rBig = Math.max(room.w, room.d) - 10;
  const rSmall = Math.min(room.w, room.d) - 10;
  if (dim.height && dim.height > room.h - 5) return false;
  return big <= rBig && small <= rSmall;
}

export interface PlanWarning {
  uid: string;
  text: string;
}

/** หาระยะว่างด้านหน้าสิ่งของไปยังกำแพงที่ใกล้ที่สุดตามแนวหันหน้าจริง (รองรับทุกองศา) */
function clearanceInFrontCm(it: PlanItem, room: RoomSize): number {
  const axes = getItemAxes(it.rot);
  const startX = it.x + axes.vx * (it.d * 0.5);
  const startZ = it.z + axes.vz * (it.d * 0.5);
  const { outer, interior } = getRoomWallSegments(room);
  let minDist = Math.max(room.w, room.d);

  for (const seg of [...outer, ...interior]) {
    const denom = axes.vx * seg.tz - axes.vz * seg.tx;
    if (Math.abs(denom) < 1e-6) continue;
    const qpx = seg.x1 - startX;
    const qpz = seg.z1 - startZ;
    const tRay = (qpx * seg.tz - qpz * seg.tx) / denom;
    const uSeg = (qpx * axes.vz - qpz * axes.vx) / denom;
    if (tRay >= -2 && uSeg >= -1 && uSeg <= seg.len + 1) {
      const dist = Math.max(0, tRay - (seg.isInterior ? 5.5 : 0));
      if (dist < minDist) minDist = dist;
    }
  }
  return minDist;
}

/** ข้อควรระวัง: ทับกัน · ทางเดินหน้าโต๊ะแคบ · ห้องเล็กเกิน */
export function planWarnings(items: PlanItem[], room: RoomSize): PlanWarning[] {
  const out: PlanWarning[] = [];
  const floor = items.filter((i) => i.y === 0 && i.category !== "rug");
  for (let i = 0; i < floor.length; i++)
    for (let j = i + 1; j < floor.length; j++)
      if (overlaps(floor[i], floor[j]) && !isChairDesk(floor[i], floor[j]))
        out.push({ uid: floor[j].uid, text: `${short(floor[i].name)} ทับกับ ${short(floor[j].name)}` });
  for (const desk of items.filter((i) => i.category === "desk")) {
    const front = clearanceInFrontCm(desk, room);
    if (front < 70)
      out.push({
        uid: desk.uid,
        text: `หน้าโต๊ะเหลือที่ถอยเก้าอี้ ${Math.max(0, Math.round(front))} ซม. (ควร ≥ 70)`,
      });
  }
  for (const it of items.filter((i) => i.category !== "rug" && i.category !== "door")) {
    if (!inRoom(it, room)) out.push({ uid: it.uid, text: `${short(it.name)} ชิดหรือล้นขอบกำแพง` });
  }
  const used = floor.reduce((s, i) => s + i.w * i.d, 0);
  const area = floorArea(room);
  if (used > area * 0.6)
    out.push({ uid: "", text: `ของกินพื้นที่ ${Math.round((used / area) * 100)}% ของห้อง อาจดูแน่นไป` });
  return out;
}

/** ชนกันจริงไหม (ข้ามพรม · เก้าอี้ซุกใต้โต๊ะได้ · ของบนโต๊ะเทียบกับของบนโต๊ะระดับเดียวกัน · ใช้ OBB แม่นยำทุกองศา) */
export function collides(a: PlanItem, b: PlanItem): boolean {
  if (a.uid === b.uid || isFlat(a) || isFlat(b) || isChairDesk(a, b)) return false;
  const floorA = a.y === 0;
  const floorB = b.y === 0;
  if (floorA !== floorB) return false;
  if (!floorA && Math.abs(a.y - b.y) > 15) return false;
  return obbItemsOverlap2D(a, b, -0.5);
}

/** ของแบน (พรม แผ่นรองเมาส์) วางทับ/ถูกทับได้ ไม่นับชน */
const isFlat = (i: PlanItem) => i.category === "rug" || i.h <= 2;

const overlap2d = (a: PlanItem, b: PlanItem) => obbItemsOverlap2D(a, b, -0.5);

/** b รองรับ a ได้ไหม: พื้นผิวบนพอ (≥ 1/4 ของฐาน a) · ไม่ใช่ของแบน/ของบนโต๊ะ/เก้าอี้/ต้นไม้ · วางแล้วไม่ทะลุเพดาน */
function canSupport(b: PlanItem, a: PlanItem, room: RoomSize): boolean {
  if (
    isFlat(b) ||
    ON_DESK.has(b.category) ||
    b.category === "chair" ||
    b.category === "door" ||
    /plant/.test(b.category) ||
    isChairDesk(a, b)
  )
    return false;
  if (b.w * b.d < a.w * a.d * 0.25) return false;
  return b.y + b.h + a.h <= room.h;
}

/**
 * ลากของแบบเกม: ลากผ่านของที่รองรับได้ → ขึ้นไปอยู่บนของนั้น · ลากออก → ตกลงพื้น
 * ชนของที่ขึ้นไม่ได้ → ไถลตามขอบ (รวมถึงไถลตามกำแพงเฉียงได้ลื่นไหล) · ไปไม่ได้เลย → อยู่ที่เดิม
 */
export function dragTo(it: PlanItem, to: { x: number; z: number }, all: PlanItem[], room: RoomSize): PlanItem {
  const others = all.filter((o) => o.uid !== it.uid);
  const place = (x: number, z: number): PlanItem | null => {
    const c = clampToRoom({ ...it, x, z }, room);
    const under = others.filter((o) => overlap2d(c, o) && !isFlat(o) && !(o.y > it.y && overlap2d(it, o)));
    const sup = under.filter((o) => canSupport(o, c, room));
    const y = sup.length ? Math.max(...sup.map((o) => o.y + o.h)) : 0;
    const lifted = { ...c, y };
    if (!inRoom(lifted, room)) return null;
    const blocked = others.some((o) => !sup.includes(o) && collides(lifted, o) && !(o.y >= y + it.h - 1.5));
    return blocked ? null : lifted;
  };
  const candidates: Array<[number, number]> = [
    [to.x, to.z],
    [to.x, it.z],
    [it.x, to.z],
    [(it.x + to.x) * 0.5, (it.z + to.z) * 0.5],
  ];
  for (const [x, z] of candidates) {
    const c = place(x, z);
    if (c) return c;
  }
  return clampToRoom(it, room);
}

/** ตอนปล่อยของที่อยู่บนอีกชิ้น: ขยับเข้าไปให้อยู่บนพื้นผิวเต็มตัวตามแกนหมุนจริงของโต๊ะ (ไม่ห้อยขอบและไม่ทะลุกำแพง) */
export function settleOnTop(it: PlanItem, all: PlanItem[], room?: RoomSize): PlanItem {
  if (it.y <= 0) return room ? clampToRoom(it, room) : it;
  const sup = all
    .filter((o) => o.uid !== it.uid && !isFlat(o) && Math.abs(o.y + o.h - it.y) < 1 && overlap2d(it, o))
    .sort((a, b) => b.w * b.d - a.w * a.d)[0];
  if (!sup) return room ? clampToRoom(it, room) : it;

  const sAxes = getItemAxes(sup.rot);
  const iAxes = getItemAxes(it.rot);
  const relRotW =
    it.w * Math.abs(iAxes.ux * sAxes.ux + iAxes.uz * sAxes.uz) +
    it.d * Math.abs(iAxes.vx * sAxes.ux + iAxes.vz * sAxes.uz);
  const relRotD =
    it.w * Math.abs(iAxes.ux * sAxes.vx + iAxes.uz * sAxes.vz) +
    it.d * Math.abs(iAxes.vx * sAxes.vx + iAxes.vz * sAxes.vz);

  const maxLx = Math.max(0, (sup.w - relRotW) * 0.5);
  const maxLz = Math.max(0, (sup.d - relRotD) * 0.5);
  const dx = it.x - sup.x;
  const dz = it.z - sup.z;
  const lx = Math.min(maxLx, Math.max(-maxLx, dx * sAxes.ux + dz * sAxes.uz));
  const lz = Math.min(maxLz, Math.max(-maxLz, dx * sAxes.vx + dz * sAxes.vz));

  let c: PlanItem = {
    ...it,
    x: Math.round((sup.x + sAxes.ux * lx + sAxes.vx * lz) * 10) / 10,
    z: Math.round((sup.z + sAxes.uz * lx + sAxes.vz * lz) * 10) / 10,
  };
  if (room) c = clampToRoom(c, room);
  return all.some((o) => o.uid !== it.uid && o.uid !== sup.uid && collides(c, o)) ? (room ? clampToRoom(it, room) : it) : c;
}

/** หาที่ว่างใกล้ที่สุด (วนออกไปทีละ 4 ซม. ไม่เกิน 2 ม.) ใช้ตอนหมุนหรือวางแล้วชนของอื่น/ขอบกำแพง */
export function nudgeFree(it: PlanItem, all: PlanItem[], room: RoomSize): PlanItem {
  const others = all.filter((o) => o.uid !== it.uid);
  const free = (c: PlanItem) => inRoom(c, room) && !others.some((o) => collides(c, o));
  const base = clampToRoom(it, room);
  if (free(base)) return base;
  for (let r = 4; r <= 200; r += 4)
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const c = clampToRoom(
        {
          ...it,
          x: it.x + Math.cos(ang) * r,
          z: it.z + Math.sin(ang) * r,
        },
        room
      );
      if (free(c)) return c;
    }
  return base;
}

const isChairDesk = (a: PlanItem, b: PlanItem) =>
  (a.category === "chair" && b.category === "desk") || (a.category === "desk" && b.category === "chair");
const short = (s: string) => (s.length > 22 ? `${s.slice(0, 22)}…` : s);

/**
 * AI ช่วยวางเบื้องต้น (กฎตามหมวด + ปรับองศาเข้าหากำแพงที่ชิดอัตโนมัติ) แล้วให้ลูกค้าลากปรับเอง
 */
export function autoLayout(items: PlanItem[], room: RoomSize): PlanItem[] {
  const out: PlanItem[] = [];
  const desk = items.find((i) => i.category === "desk");
  let rightZ = 0;
  let leftZ = 0;
  let corner = 0;
  let deskSlot = 0;
  const corners: Array<[number, number]> = [
    [room.w - 35, 35],
    [35, room.d - 35],
    [room.w - 35, room.d - 35],
    [35, 35],
  ];
  const deskStart = desk ? alignItemToNearestWall(clampToRoom({ ...desk, x: room.w / 2, z: desk.d / 2 + 4, y: 0, rot: 0 }, room), room, []) : null;

  for (const raw of items) {
    let it: PlanItem = { ...raw, rot: 0, y: 0 };
    const c = it.category;
    if (c === "desk" && deskStart) {
      it = { ...it, x: deskStart.x, z: deskStart.z, rot: deskStart.rot };
    } else if (c === "chair" && deskStart && desk) {
      const dAxes = getItemAxes(deskStart.rot);
      it = {
        ...it,
        x: deskStart.x + dAxes.vx * (desk.d * 0.5 + 32),
        z: deskStart.z + dAxes.vz * (desk.d * 0.5 + 32),
        rot: normalizeRotDeg(deskStart.rot + 180),
      };
    } else if (c === "rug") {
      it = { ...it, x: room.w / 2, z: room.d / 2 + 20 };
    } else if (c === "door") {
      it = { ...it, rot: 270, x: it.d / 2 + 1, z: room.d - it.w / 2 - 15 };
    } else if (c === "bed") {
      // ผนังซ้าย (x ≈ 0): หันหัวเตียงชิดผนังซ้าย หันปลายเตียงไปทาง +X (rot = 270°)
      it = alignItemToNearestWall(
        { ...it, rot: 270, x: it.d / 2 + 4, z: room.d - it.w / 2 - 4 - leftZ },
        room,
        out
      );
      leftZ += it.w + 10;
    } else if (c === "wardrobe" || c === "storage") {
      // ผนังขวา (x ≈ room.w): หันหลังตู้ชิดผนังขวา หันหน้าบานประตูเข้าในห้องทาง -X (rot = 90°)
      it = alignItemToNearestWall(
        { ...it, rot: 90, x: room.w - it.d / 2 - 4, z: it.w / 2 + 4 + rightZ },
        room,
        out
      );
      rightZ += it.w + 6;
    } else if (c === "fake_plant" || c === "real_plant" || c === "plant_pot") {
      it = freeSpot(it, corners, out, room, corner++);
    } else if (ON_DESK.has(c) && desk && deskStart) {
      const top = desk.h;
      const dAxes = getItemAxes(deskStart.rot);
      const onDeskAt = (lx: number, lz: number, yVal = top): PlanItem => ({
        ...it,
        x: deskStart.x + dAxes.ux * lx + dAxes.vx * lz,
        z: deskStart.z + dAxes.uz * lx + dAxes.vz * lz,
        y: yVal,
        rot: deskStart.rot,
      });
      if (c === "monitor") it = onDeskAt(0, -desk.d / 2 + it.d / 2 + 6);
      else if (c === "keyboard") it = onDeskAt(-5, desk.d / 2 - it.d / 2 - 8);
      else if (c === "mouse") it = onDeskAt(30, desk.d / 2 - 14);
      else if (c === "mousepad" || c === "keyboard_pad") it = onDeskAt(5, desk.d / 2 - it.d / 2 - 3, top - 0.5);
      else {
        const side = deskSlot++ % 2 ? 1 : -1;
        it = onDeskAt(side * (desk.w / 2 - it.w / 2 - 5), -desk.d / 4);
      }
    } else if (c === "computer" && desk && deskStart) {
      const dAxes = getItemAxes(deskStart.rot);
      it = alignItemToNearestWall(
        {
          ...it,
          x: deskStart.x + dAxes.ux * (desk.w / 2 + it.w / 2 + 8),
          z: deskStart.z + dAxes.uz * (desk.w / 2 + it.w / 2 + 8),
          rot: deskStart.rot,
        },
        room,
        out
      );
    } else {
      it = freeSpot(it, corners, out, room, corner++);
    }
    out.push(nudgeFree(clampToRoom(it, room), out, room));
  }
  return out;
}

/** หามุมที่ยังว่าง (ไม่ทับของที่วางแล้ว) พร้อมหมุนขนานกำแพงใกล้เคียงอัตโนมัติ */
function freeSpot(
  it: PlanItem,
  corners: Array<[number, number]>,
  placed: PlanItem[],
  room: RoomSize,
  start: number
): PlanItem {
  const tries: Array<[number, number]> = [];
  for (let i = 0; i < corners.length; i++) tries.push(corners[(start + i) % corners.length]);
  for (let x = 40; x < room.w; x += 40) tries.push([x, room.d - 32], [x, 32]);
  for (const [x, z] of tries) {
    const cand = alignItemToNearestWall(clampToRoom({ ...it, x, z }, room), room, placed);
    if (inRoom(cand, room) && !placed.some((p) => overlaps(p, cand, 5))) return cand;
  }
  const [x, z] = corners[start % corners.length];
  return alignItemToNearestWall(clampToRoom({ ...it, x, z }, room), room, placed);
}

/**
 * ใส่ของชิ้นใหม่โดยไม่ขยับของเดิม: เริ่มจากตำแหน่งที่ autoLayout แนะนำ
 * หากวางใกล้กำแพงจะปรับหมุนตามองศาของกำแพงให้อัตโนมัติ และไม่ทะลุกำแพง
 */
export function placeNew(existing: PlanItem[], fresh: PlanItem[], room: RoomSize): PlanItem[] {
  const suggested = autoLayout([...existing, ...fresh], room).slice(existing.length);
  const placed = [...existing];
  const out: PlanItem[] = [];
  for (const cand of suggested) {
    let best = alignItemToNearestWall(clampToRoom(cand, room), room, placed);
    if (cand.y === 0 && (!inRoom(best, room) || placed.some((p) => overlaps(p, best, 3)))) {
      let bestD = Infinity;
      for (let x = 10; x <= room.w - 10; x += 12)
        for (let z = 10; z <= room.d - 10; z += 12) {
          const c = alignItemToNearestWall(clampToRoom({ ...cand, x, z }, room), room, placed);
          if (!inRoom(c, room) || placed.some((p) => overlaps(p, c, 3))) continue;
          const d = (c.x - cand.x) ** 2 + (c.z - cand.z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
    }
    best = nudgeFree(best, placed, room);
    placed.push(best);
    out.push(best);
  }
  return out;
}

/** ชุดห้องสำเร็จรูป: เลือกแล้วได้ของทั้งห้อง (ขนาดโดยประมาณ) แล้วค่อยปรับเอง */
export const ROOM_TEMPLATES: Array<{ id: string; label: string; items: string[] }> = [
  {
    id: "gaming",
    label: "ห้องเกม",
    items: ["desk", "chair", "monitor", "keyboard", "mouse", "mousepad", "computer", "lighting", "storage", "rug", "fake_plant", "door"],
  },
  {
    id: "work",
    label: "มุมทำงาน",
    items: ["desk", "chair", "monitor", "keyboard", "mouse", "lighting", "storage", "real_plant", "door"],
  },
  {
    id: "condo",
    label: "ห้องนอนคอนโด",
    items: ["bed", "wardrobe", "desk", "chair", "monitor", "lighting", "rug", "fake_plant", "door"],
  },
  {
    id: "minimal",
    label: "มินิมอล",
    items: ["desk", "chair", "monitor", "keyboard", "lighting", "real_plant", "rug", "door"],
  },
];

/* ---------- แชร์ห้องเป็นลิงก์ (เก็บในลิงก์เลย ไม่ต้องมีเซิร์ฟเวอร์) ---------- */
type Packed = [string | null, string, string, number, number, number, number, number, number, number, string, number, 0 | 1];
export function encodePlan(room: RoomSize, items: PlanItem[]): string {
  const data = {
    r: [room.w, room.d, room.h, room.win?.wall ?? "back", Math.round((room.win?.pos ?? 0.68) * 100)],
    ...(room.shape ? { s: room.shape } : {}),
    i: items.slice(0, 60).map(
      (it): Packed => [
        it.productId,
        it.name.slice(0, 60),
        it.category,
        it.w,
        it.d,
        it.h,
        Math.round(it.x * 10) / 10,
        Math.round(it.z * 10) / 10,
        Math.round(it.y * 10) / 10,
        normalizeRotDeg(it.rot),
        it.color,
        it.price,
        it.estimated ? 1 : 0,
      ]
    ),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePlan(code: string): { room: RoomSize; items: PlanItem[] } | null {
  try {
    const bin = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const d = JSON.parse(json) as { r: [number, number, number, string, number]; i: Packed[]; s?: unknown };
    const room = parseRoomSize(`${d.r[0]},${d.r[1]},${d.r[2]}`);
    if (!room || !Array.isArray(d.i)) return null;
    const shape = d.s === undefined ? null : parseShape(d.s);
    if (shape) {
      const b = shapeBounds(shape);
      if (b.w >= ROOM_LIMITS.min && b.d >= ROOM_LIMITS.min) Object.assign(room, { w: b.w, d: b.d, shape });
    }
    const wall = d.r[3] === "left" || d.r[3] === "none" ? d.r[3] : "back";
    room.win = { wall, pos: Math.min(0.9, Math.max(0.1, Number(d.r[4]) / 100 || 0.68)) };
    const items = d.i.slice(0, 60).map((p): PlanItem => {
      const n = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || 0));
      return {
        uid: newUid(),
        productId: typeof p[0] === "string" ? p[0].slice(0, 120) : null,
        name: String(p[1] ?? "").slice(0, 60),
        category: String(p[2] ?? "other").slice(0, 30),
        w: n(p[3], 1, 1500),
        d: n(p[4], 1, 1500),
        h: n(p[5], 1, 450),
        x: n(p[6], 0, room.w),
        z: n(p[7], 0, room.d),
        y: n(p[8], 0, 300),
        rot: normalizeRotDeg(Number(p[9]) || 0),
        color: /^#[0-9a-f]{6}$/i.test(String(p[10])) ? String(p[10]) : "#a8b0ba",
        price: n(p[11], 0, 10_000_000),
        estimated: p[12] === 1,
      };
    });
    return { room, items };
  } catch {
    return null;
  }
}

export function parseRoomSize(raw: string | null | undefined): RoomSize | null {
  if (!raw) return null;
  const [w, d, h] = raw.split(",").map((x) => Math.round(Number(x)));
  const ok = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;
  if (!ok(w, ROOM_LIMITS.min, ROOM_LIMITS.max) || !ok(d, ROOM_LIMITS.min, ROOM_LIMITS.max)) return null;
  return { w, d, h: ok(h, ROOM_LIMITS.hMin, ROOM_LIMITS.hMax) ? h : DEFAULT_ROOM.h };
}

export function roomLabel(r: RoomSize): string {
  const m = (v: number) => (v / 100).toFixed(v % 100 ? 2 : 1).replace(/\.?0+$/, "");
  if (r.shape) return `ตามแปลน ${shapeMetrics(r.shape).areaM2} ตร.ม. · ${m(r.w)} × ${m(r.d)} ม. (สูง ${m(r.h)} ม.)`;
  return `${m(r.w)} × ${m(r.d)} ม. (สูง ${m(r.h)} ม.)`;
}
