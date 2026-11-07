import { parseShape, rectInShape, shapeBounds, shapeMetrics, type Pt2 } from "./room-shape";
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
  rot: 0 | 90 | 180 | 270;
  color: string;
  price: number;
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
export const ON_DESK = new Set(["monitor", "monitor_arm", "keyboard", "mouse", "mousepad", "keyboard_pad", "speaker", "headphone", "microphone", "webcam", "lighting"]);

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
  const colorHex = c === "white" ? "#eeeeec" : c === "black" ? "#1f2125" : c === "grey" || c === "gray" ? "#8d9299" : c === "wood" || c === "oak" ? "#b98b5e" : undefined;
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

/** ขนาดบนพื้นหลังหมุน */
export function footprint(it: Pick<PlanItem, "w" | "d" | "rot">): { w: number; d: number } {
  return it.rot === 90 || it.rot === 270 ? { w: it.d, d: it.w } : { w: it.w, d: it.d };
}

/** ดันของให้อยู่ในห้อง */
export function clampToRoom<T extends PlanItem>(it: T, room: RoomSize): T {
  const f = footprint(it);
  const hw = Math.min(f.w, room.w) / 2;
  const hd = Math.min(f.d, room.d) / 2;
  return { ...it, x: Math.min(room.w - hw, Math.max(hw, it.x)), z: Math.min(room.d - hd, Math.max(hd, it.z)) };
}

/** ของอยู่ในห้องจริงไหม (ห้องตามแปลน เช่นตัว L ต้องไม่ล้นไปมุมที่ไม่มีพื้น) · ของที่วางบนของอื่นนับตามตัวรอง */
export function inRoom(it: PlanItem, room: RoomSize): boolean {
  if (!room.shape || it.y > 0) return true;
  const f = footprint(it);
  return rectInShape(it.x, it.z, f.w, f.d, room.shape);
}

/** พื้นที่พื้นห้อง (ซม.²) */
export const floorArea = (room: RoomSize) => (room.shape ? shapeMetrics(room.shape).areaM2 * 10000 : room.w * room.d);

/** ของ 2 ชิ้นทับกันบนพื้นไหม (ไม่นับพรม และของบนโต๊ะ) */
export function overlaps(a: PlanItem, b: PlanItem, gap = 0): boolean {
  if (a.category === "rug" || b.category === "rug" || a.y > 0 || b.y > 0) return false;
  const fa = footprint(a);
  const fb = footprint(b);
  return Math.abs(a.x - b.x) * 2 < fa.w + fb.w + gap * 2 && Math.abs(a.z - b.z) * 2 < fa.d + fb.d + gap * 2;
}

/** สินค้าชิ้นนี้ใส่ห้องนี้ได้ไหม (เผื่อ 10 ซม.) — ไม่มีข้อมูลขนาด = ถือว่าได้ */
export function fitsRoom(dim: { width: number | null; depth: number | null; height?: number | null } | null | undefined, room: RoomSize): boolean {
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

/** ข้อควรระวัง: ทับกัน · ทางเดินหน้าโต๊ะแคบ · ห้องเล็กเกิน */
export function planWarnings(items: PlanItem[], room: RoomSize): PlanWarning[] {
  const out: PlanWarning[] = [];
  const floor = items.filter((i) => i.y === 0 && i.category !== "rug");
  for (let i = 0; i < floor.length; i++)
    for (let j = i + 1; j < floor.length; j++)
      if (overlaps(floor[i], floor[j]) && !(isChairDesk(floor[i], floor[j]))) out.push({ uid: floor[j].uid, text: `${short(floor[i].name)} ทับกับ ${short(floor[j].name)}` });
  for (const desk of items.filter((i) => i.category === "desk")) {
    // ระยะถอยเก้าอี้หน้าโต๊ะ ≥ 70 ซม.
    const f = footprint(desk);
    const front = desk.rot === 0 ? room.d - (desk.z + f.d / 2) : desk.rot === 180 ? desk.z - f.d / 2 : desk.rot === 90 ? room.w - (desk.x + f.w / 2) : desk.x - f.w / 2;
    if (front < 70) out.push({ uid: desk.uid, text: `หน้าโต๊ะเหลือที่ถอยเก้าอี้ ${Math.max(0, Math.round(front))} ซม. (ควร ≥ 70)` });
  }
  for (const it of floor) if (!inRoom(it, room)) out.push({ uid: it.uid, text: `${short(it.name)} ล้นออกนอกห้อง` });
  const used = floor.reduce((s, i) => s + footprint(i).w * footprint(i).d, 0);
  const area = floorArea(room);
  if (used > area * 0.6) out.push({ uid: "", text: `ของกินพื้นที่ ${Math.round((used / area) * 100)}% ของห้อง อาจดูแน่นไป` });
  return out;
}

/** ชนกันจริงไหม (ข้ามพรม · เก้าอี้ซุกใต้โต๊ะได้ · ของบนโต๊ะเทียบกับของบนโต๊ะระดับเดียวกัน) */
export function collides(a: PlanItem, b: PlanItem): boolean {
  if (a.uid === b.uid || isFlat(a) || isFlat(b) || isChairDesk(a, b)) return false;
  const floorA = a.y === 0;
  const floorB = b.y === 0;
  if (floorA !== floorB) return false;
  if (!floorA && Math.abs(a.y - b.y) > 15) return false;
  const fa = footprint(a);
  const fb = footprint(b);
  return Math.abs(a.x - b.x) * 2 < fa.w + fb.w - 0.5 && Math.abs(a.z - b.z) * 2 < fa.d + fb.d - 0.5;
}

/** ของแบน (พรม แผ่นรองเมาส์) วางทับ/ถูกทับได้ ไม่นับชน */
const isFlat = (i: PlanItem) => i.category === "rug" || i.h <= 2;

const overlap2d = (a: PlanItem, b: PlanItem) => {
  const fa = footprint(a);
  const fb = footprint(b);
  return Math.abs(a.x - b.x) * 2 < fa.w + fb.w - 0.5 && Math.abs(a.z - b.z) * 2 < fa.d + fb.d - 0.5;
};

/** b รองรับ a ได้ไหม: พื้นผิวบนพอ (≥ 1/4 ของฐาน a) · ไม่ใช่ของแบน/ของบนโต๊ะ/เก้าอี้/ต้นไม้ · วางแล้วไม่ทะลุเพดาน */
function canSupport(b: PlanItem, a: PlanItem, room: RoomSize): boolean {
  if (isFlat(b) || ON_DESK.has(b.category) || b.category === "chair" || b.category === "door" || /plant/.test(b.category) || isChairDesk(a, b)) return false;
  const fa = footprint(a);
  const fb = footprint(b);
  if (fb.w * fb.d < fa.w * fa.d * 0.25) return false;
  return b.y + b.h + a.h <= room.h;
}

/**
 * ลากของแบบเกม: ลากผ่านของที่รองรับได้ → ขึ้นไปอยู่บนของนั้น · ลากออก → ตกลงพื้น
 * ชนของที่ขึ้นไม่ได้ → ไถลตามขอบ (เลื่อนแกนเดียว) · ไปไม่ได้เลย → อยู่ที่เดิม
 */
export function dragTo(it: PlanItem, to: { x: number; z: number }, all: PlanItem[], room: RoomSize): PlanItem {
  const others = all.filter((o) => o.uid !== it.uid);
  const place = (x: number, z: number): PlanItem | null => {
    const c = clampToRoom({ ...it, x, z }, room);
    // ของที่ซ้อนอยู่บนตัวที่ลาก ไม่นับเป็นที่รอง
    const under = others.filter((o) => overlap2d(c, o) && !isFlat(o) && !(o.y > it.y && overlap2d(it, o)));
    const sup = under.filter((o) => canSupport(o, c, room));
    const y = sup.length ? Math.max(...sup.map((o) => o.y + o.h)) : 0;
    const lifted = { ...c, y };
    if (!inRoom(lifted, room)) return null;
    // ชนของที่ขึ้นไม่ได้ หรือชนของที่ระดับเดียวกันข้างบน
    const blocked = others.some((o) => !sup.includes(o) && collides(lifted, o) && !(o.y >= y + it.h));
    return blocked ? null : lifted;
  };
  for (const [x, z] of [[to.x, to.z], [to.x, it.z], [it.x, to.z]] as const) {
    const c = place(x, z);
    if (c) return c;
  }
  return it;
}

/** ตอนปล่อยของที่อยู่บนอีกชิ้น: ขยับเข้าไปให้อยู่บนพื้นผิวเต็มตัว (ไม่ห้อยขอบ) */
export function settleOnTop(it: PlanItem, all: PlanItem[]): PlanItem {
  if (it.y <= 0) return it;
  const sup = all
    .filter((o) => o.uid !== it.uid && !isFlat(o) && Math.abs(o.y + o.h - it.y) < 0.5 && overlap2d(it, o))
    .sort((a, b) => footprint(b).w * footprint(b).d - footprint(a).w * footprint(a).d)[0];
  if (!sup) return it;
  const fs = footprint(sup);
  const f = footprint(it);
  const hw = Math.max(0, (fs.w - f.w) / 2);
  const hd = Math.max(0, (fs.d - f.d) / 2);
  const c = { ...it, x: Math.min(sup.x + hw, Math.max(sup.x - hw, it.x)), z: Math.min(sup.z + hd, Math.max(sup.z - hd, it.z)) };
  return all.some((o) => o.uid !== it.uid && o.uid !== sup.uid && collides(c, o)) ? it : c;
}

/** หาที่ว่างใกล้ที่สุด (วนออกไปทีละ 5 ซม. ไม่เกิน 2 ม.) ใช้ตอนหมุนแล้วชนของอื่น */
export function nudgeFree(it: PlanItem, all: PlanItem[], room: RoomSize): PlanItem {
  const others = all.filter((o) => o.uid !== it.uid);
  const free = (c: PlanItem) => inRoom(c, room) && !others.some((o) => collides(c, o));
  const base = it.y > 0 ? it : clampToRoom(it, room);
  if (free(base)) return base;
  for (let r = 5; r <= 200; r += 5)
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const c = it.y > 0 ? { ...it, x: it.x + Math.cos(ang) * r, z: it.z + Math.sin(ang) * r } : clampToRoom({ ...it, x: Math.round(it.x + Math.cos(ang) * r), z: Math.round(it.z + Math.sin(ang) * r) }, room);
      if (free(c)) return c;
    }
  return base;
}

const isChairDesk = (a: PlanItem, b: PlanItem) => (a.category === "chair" && b.category === "desk") || (a.category === "desk" && b.category === "chair");
const short = (s: string) => (s.length > 22 ? `${s.slice(0, 22)}…` : s);

/**
 * AI ช่วยวางเบื้องต้น (กฎง่ายๆ ตามหมวด) แล้วให้ลูกค้าลากปรับเอง
 * โต๊ะชิดผนังหลังกลางห้อง · เก้าอี้หน้าโต๊ะ · เตียงชิดผนังซ้าย · ตู้เสื้อผ้า/ชั้นชิดผนังขวา · พรมกลางห้อง · ต้นไม้มุมห้อง · ของบนโต๊ะเรียงบนโต๊ะ
 */
export function autoLayout(items: PlanItem[], room: RoomSize): PlanItem[] {
  const out: PlanItem[] = [];
  const desk = items.find((i) => i.category === "desk");
  let rightZ = 0;
  let leftZ = 0;
  let corner = 0;
  let deskSlot = 0;
  const corners: Array<[number, number]> = [
    [room.w - 30, 30],
    [30, room.d - 30],
    [room.w - 30, room.d - 30],
    [30, 30],
  ];
  const deskPos = desk ? { x: room.w / 2, z: desk.d / 2 + 2 } : null;
  for (const raw of items) {
    let it: PlanItem = { ...raw, rot: 0, y: 0 };
    const c = it.category;
    if (c === "desk" && deskPos) it = { ...it, ...deskPos };
    else if (c === "chair" && deskPos && desk) it = { ...it, x: deskPos.x, z: desk.d + 25, rot: 180 };
    else if (c === "rug") it = { ...it, x: room.w / 2, z: room.d / 2 + 20 };
    else if (c === "door") it = { ...it, rot: 90, x: it.d / 2 + 1, z: room.d - it.w / 2 - 15 };
    else if (c === "bed") {
      it = { ...it, rot: 90, x: it.d / 2 + 2, z: room.d - it.w / 2 - 2 - leftZ };
      leftZ += it.w + 10;
    } else if (c === "wardrobe" || c === "storage") {
      it = { ...it, rot: 270, x: room.w - it.d / 2 - 2, z: it.w / 2 + 2 + rightZ };
      rightZ += it.w + 5;
    } else if (c === "fake_plant" || c === "real_plant" || c === "plant_pot") {
      it = freeSpot(it, corners, out, room, corner++);
    } else if (ON_DESK.has(c) && desk && deskPos) {
      // เรียงของบนโต๊ะ: จอกลางหลัง, คีย์บอร์ดหน้า, เมาส์ขวา, อื่นๆ ไล่ซ้าย/ขวา
      const top = desk.h;
      if (c === "monitor") it = { ...it, x: deskPos.x, z: deskPos.z - desk.d / 2 + it.d / 2 + 5, y: top };
      else if (c === "keyboard") it = { ...it, x: deskPos.x - 5, z: deskPos.z + desk.d / 2 - it.d / 2 - 8, y: top };
      else if (c === "mouse") it = { ...it, x: deskPos.x + 30, z: deskPos.z + desk.d / 2 - 14, y: top };
      else if (c === "mousepad" || c === "keyboard_pad") it = { ...it, x: deskPos.x + 5, z: deskPos.z + desk.d / 2 - it.d / 2 - 3, y: top - 0.5 };
      else {
        const side = deskSlot++ % 2 ? 1 : -1;
        it = { ...it, x: deskPos.x + side * (desk.w / 2 - it.w / 2 - 4), z: deskPos.z - desk.d / 4, y: top };
      }
    } else if (c === "computer" && desk && deskPos) it = { ...it, x: deskPos.x + desk.w / 2 + it.w / 2 + 6, z: it.d / 2 + 4 };
    else it = freeSpot(it, corners, out, room, corner++);
    // กันทับ: ถ้าตำแหน่งตามกฎชนของที่วางแล้ว เลื่อนไปที่ว่างใกล้สุด
    out.push(nudgeFree(it.y > 0 ? it : clampToRoom(it, room), out, room));
  }
  return out;
}

/** หามุมที่ยังว่าง (ไม่ทับของที่วางแล้ว) · ไม่มีเลย = ไล่หาตามแนวผนังหลัง/หน้า */
function freeSpot(it: PlanItem, corners: Array<[number, number]>, placed: PlanItem[], room: RoomSize, start: number): PlanItem {
  const tries: Array<[number, number]> = [];
  for (let i = 0; i < corners.length; i++) tries.push(corners[(start + i) % corners.length]);
  for (let x = 40; x < room.w; x += 40) tries.push([x, room.d - 30], [x, 30]);
  for (const [x, z] of tries) {
    const cand = clampToRoom({ ...it, x, z }, room);
    if (inRoom(cand, room) && !placed.some((p) => overlaps(p, cand, 5))) return cand;
  }
  const [x, z] = corners[start % corners.length];
  return clampToRoom({ ...it, x, z }, room);
}

/**
 * ใส่ของชิ้นใหม่โดยไม่ขยับของเดิม: เริ่มจากตำแหน่งที่ autoLayout แนะนำ
 * ถ้าทับของเดิม → หาที่ว่างที่ใกล้ที่สุด (ไล่ทีละ 10 ซม.)
 */
export function placeNew(existing: PlanItem[], fresh: PlanItem[], room: RoomSize): PlanItem[] {
  const suggested = autoLayout([...existing, ...fresh], room).slice(existing.length);
  const placed = [...existing];
  const out: PlanItem[] = [];
  for (const cand of suggested) {
    let best = cand;
    if (cand.y === 0 && (!inRoom(cand, room) || placed.some((p) => overlaps(p, cand, 3)))) {
      let bestD = Infinity;
      for (let x = 0; x <= room.w; x += 10)
        for (let z = 0; z <= room.d; z += 10) {
          const c = clampToRoom({ ...cand, x, z }, room);
          if (!inRoom(c, room) || placed.some((p) => overlaps(p, c, 3))) continue;
          const d = (c.x - cand.x) ** 2 + (c.z - cand.z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
    }
    placed.push(best);
    out.push(best);
  }
  return out;
}

/** ชุดห้องสำเร็จรูป: เลือกแล้วได้ของทั้งห้อง (ขนาดโดยประมาณ) แล้วค่อยปรับเอง */
export const ROOM_TEMPLATES: Array<{ id: string; label: string; items: string[] }> = [
  { id: "gaming", label: "ห้องเกม", items: ["desk", "chair", "monitor", "keyboard", "mouse", "mousepad", "computer", "lighting", "storage", "rug", "fake_plant", "door"] },
  { id: "work", label: "มุมทำงาน", items: ["desk", "chair", "monitor", "keyboard", "mouse", "lighting", "storage", "real_plant", "door"] },
  { id: "condo", label: "ห้องนอนคอนโด", items: ["bed", "wardrobe", "desk", "chair", "monitor", "lighting", "rug", "fake_plant", "door"] },
  { id: "minimal", label: "มินิมอล", items: ["desk", "chair", "monitor", "keyboard", "lighting", "real_plant", "rug", "door"] },
];

/* ---------- แชร์ห้องเป็นลิงก์ (เก็บในลิงก์เลย ไม่ต้องมีเซิร์ฟเวอร์) ---------- */
type Packed = [string | null, string, string, number, number, number, number, number, number, number, string, number, 0 | 1];
export function encodePlan(room: RoomSize, items: PlanItem[]): string {
  const data = {
    r: [room.w, room.d, room.h, room.win?.wall ?? "back", Math.round((room.win?.pos ?? 0.68) * 100)],
    ...(room.shape ? { s: room.shape } : {}),
    i: items.slice(0, 60).map((it): Packed => [it.productId, it.name.slice(0, 60), it.category, it.w, it.d, it.h, Math.round(it.x), Math.round(it.z), Math.round(it.y), it.rot, it.color, it.price, it.estimated ? 1 : 0]),
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
    const rots = [0, 90, 180, 270] as const;
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
        rot: rots.find((r) => r === Number(p[9])) ?? 0,
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
