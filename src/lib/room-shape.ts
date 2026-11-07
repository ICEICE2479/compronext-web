/**
 * รูปห้องจริง (แปลนพื้น) — ตรรกะล้วน ทดสอบได้
 * หน่วย ซม. · จุด [x, z] · x = ซ้าย→ขวา · z = ผนังหลัง→ด้านหน้า (เหมือน room-planner)
 * เก็บแบบวนทวนเข็ม (พื้นที่ shoelace เป็นบวก) → ด้าน a→b มีทิศออกนอกห้อง = (dz, −dx)
 */

export type Pt2 = [number, number];

/** พื้นที่แบบมีเครื่องหมาย (ซม.²) */
export function signedArea(poly: Pt2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

export const sideLengths = (poly: Pt2[]) => poly.map((p, i) => Math.hypot(poly[(i + 1) % poly.length][0] - p[0], poly[(i + 1) % poly.length][1] - p[1]));

/** พื้นที่ (ตร.ม.) + เส้นรอบรูป (ม.) + ความยาวแต่ละด้าน (ซม.) */
export function shapeMetrics(poly: Pt2[]): { areaM2: number; perimeterM: number; sides: number[] } {
  const sides = sideLengths(poly).map((s) => Math.round(s));
  return {
    areaM2: Math.round((Math.abs(signedArea(poly)) / 10000) * 100) / 100,
    perimeterM: Math.round((sides.reduce((s, v) => s + v, 0) / 100) * 100) / 100,
    sides,
  };
}

/** ทิศออกนอกห้องของด้าน i (เวกเตอร์หน่วย) */
export function outwardNormal(poly: Pt2[], i: number): Pt2 {
  const [x1, z1] = poly[i];
  const [x2, z2] = poly[(i + 1) % poly.length];
  const L = Math.hypot(x2 - x1, z2 - z1) || 1;
  return [(z2 - z1) / L, -(x2 - x1) / L];
}

/** ตัดจุดซ้ำ/จุดที่อยู่บนเส้นตรงเดียวกัน (เบี่ยง < tolCm) */
function simplify(poly: Pt2[], tolCm = 3): Pt2[] {
  let out = poly.filter((p, i) => Math.hypot(p[0] - poly[(i + 1) % poly.length][0], p[1] - poly[(i + 1) % poly.length][1]) > 1);
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length];
      const b = out[i];
      const c = out[(i + 1) % out.length];
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const dev = L ? Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / L : 0;
      if (dev < tolCm) {
        out = out.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return out;
}

/** เลื่อนให้มุมซ้ายหลังอยู่ที่ (0,0) + ปัดเป็น ซม. */
function toOrigin(poly: Pt2[]): Pt2[] {
  const mx = Math.min(...poly.map((p) => p[0]));
  const mz = Math.min(...poly.map((p) => p[1]));
  return poly.map(([x, z]) => [Math.round(x - mx), Math.round(z - mz)]);
}

/**
 * จุดที่วัดมา (เรียงตามที่เดินรอบห้อง ทิศไหนก็ได้) → แปลนพร้อมใช้
 * วนทวนเข็ม · ผนังที่ยาวที่สุดเป็นผนังหลัง (ขนานแกน x) · มุมซ้ายหลัง = (0,0)
 */
export function normalizeShape(raw: Pt2[]): Pt2[] | null {
  let poly = simplify(raw.map(([x, z]) => [x, z] as Pt2));
  if (poly.length < 3 || Math.abs(signedArea(poly)) < 100) return null;
  if (signedArea(poly) < 0) poly = poly.reverse();
  const lens = sideLengths(poly);
  const k = lens.indexOf(Math.max(...lens));
  poly = [...poly.slice(k), ...poly.slice(0, k)];
  const [x1, z1] = poly[0];
  const [x2, z2] = poly[1];
  const th = Math.atan2(z2 - z1, x2 - x1);
  const c = Math.cos(-th);
  const s = Math.sin(-th);
  poly = poly.map(([x, z]) => [(x - x1) * c - (z - z1) * s, (x - x1) * s + (z - z1) * c]);
  return toOrigin(poly);
}

/**
 * ทำมุมฉาก: ด้านที่เอียงไม่เกิน tolDeg จากแนวนอน/ตั้ง → ตรงเป๊ะ (มือแตะเบี้ยวนิดหน่อยก็ได้ห้องสวย)
 * ด้านเฉียงจริง (เช่นผนังเอียง 45°) คงไว้ · ผลเพี้ยนจากเดิมเกิน 15% → คืนของเดิม
 */
export function squareShape(poly: Pt2[], tolDeg = 12): Pt2[] {
  const n = poly.length;
  const kind = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const deg = (Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0])) * 180) / Math.PI;
    if (deg <= tolDeg || deg >= 180 - tolDeg) return "H";
    if (Math.abs(deg - 90) <= tolDeg) return "V";
    return "D";
  });
  const out = poly.map((p, i) => {
    const prev = (i - 1 + n) % n;
    const avg = (e: number, axis: 0 | 1) => (poly[e][axis] + poly[(e + 1) % n][axis]) / 2;
    const x = kind[prev] === "V" ? avg(prev, 0) : kind[i] === "V" ? avg(i, 0) : p[0];
    const z = kind[prev] === "H" ? avg(prev, 1) : kind[i] === "H" ? avg(i, 1) : p[1];
    return [x, z] as Pt2;
  });
  const res = simplify(out, 1);
  const a0 = Math.abs(signedArea(poly));
  const a1 = Math.abs(signedArea(res));
  if (res.length < 3 || signedArea(res) <= 0 || Math.abs(a1 - a0) / a0 > 0.15) return poly;
  return toOrigin(res);
}

/** ขยายทุกด้านตามอัตราส่วน (ใช้กับแปลนจากรูป: รู้ความยาวจริง 1 ด้าน) */
export function scaleShape(poly: Pt2[], k: number): Pt2[] {
  return poly.map(([x, z]) => [x * k, z * k]);
}

/** จุดอยู่ในห้องไหม (ray casting) */
export function pointInShape(x: number, z: number, poly: Pt2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** สี่เหลี่ยม (กึ่งกลาง cx,cz กว้าง w ลึก d) อยู่ในห้องทั้งชิ้นไหม — เช็กมุม กึ่งกลางขอบ และกลาง (ยอมชิดผนัง 1 ซม.) */
export function rectInShape(cx: number, cz: number, w: number, d: number, poly: Pt2[]): boolean {
  const hw = Math.max(0, w / 2 - 1);
  const hd = Math.max(0, d / 2 - 1);
  for (const fx of [-1, 0, 1]) for (const fz of [-1, 0, 1]) if (!pointInShape(cx + fx * hw, cz + fz * hd, poly)) return false;
  // มุมห้องที่ยื่นเข้ามา (ห้องตัว L) ต้องไม่อยู่ในตัวของ
  return !poly.some(([x, z]) => Math.abs(x - cx) < hw && Math.abs(z - cz) < hd);
}

export const shapeBounds = (poly: Pt2[]) => ({ w: Math.max(...poly.map((p) => p[0])), d: Math.max(...poly.map((p) => p[1])) });

/** แบบห้องสำเร็จรูป */
export function presetShape(kind: "rect" | "L" | "Lr", w: number, d: number): Pt2[] {
  const cw = Math.round(w * 0.55);
  const cd = Math.round(d * 0.55);
  if (kind === "L") return [[0, 0], [w, 0], [w, cd], [cw, cd], [cw, d], [0, d]];
  if (kind === "Lr") return [[0, 0], [w, 0], [w, d], [w - cw, d], [w - cw, cd], [0, cd]];
  return [[0, 0], [w, 0], [w, d], [0, d]];
}

/**
 * วัดความสูงแบบแอปวัดขนาด: เส้นตั้งฉากจากจุดบนพื้น (base) ขึ้นฟ้า ↔ แนวที่กล้องเล็ง (origin + t·dir)
 * จุดที่ 2 เส้นเข้าใกล้กันที่สุด = ความสูงที่เล็งอยู่ (หน่วยเดียวกับข้อมูล) · เล็งขนานเส้นตั้ง = null
 */
export function heightOnVertical(base: { x: number; y: number; z: number }, origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }): number | null {
  const L = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const u = { x: dir.x / L, y: dir.y / L, z: dir.z / L };
  const w0 = { x: base.x - origin.x, y: base.y - origin.y, z: base.z - origin.z };
  const denom = 1 - u.y * u.y;
  if (denom < 1e-4) return null;
  const e = u.x * w0.x + u.y * w0.y + u.z * w0.z;
  const s = (u.y * e - w0.y) / denom;
  return Number.isFinite(s) ? s : null;
}

/** เก็บรูปห้องในลิงก์/ฐานข้อมูล: ตรวจค่าที่รับมา */
export function parseShape(v: unknown): Pt2[] | null {
  if (!Array.isArray(v) || v.length < 3 || v.length > 40) return null;
  const pts = v.map((p) => (Array.isArray(p) ? [Math.round(Number(p[0])), Math.round(Number(p[1]))] : [NaN, NaN]) as Pt2);
  if (pts.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z) || x < 0 || z < 0 || x > 1500 || z > 1500)) return null;
  return signedArea(pts) > 0 ? pts : null;
}
