/**
 * เครื่องมือวัดห้อง (ตรรกะล้วน ทดสอบได้)
 * - วัดจากรูป: เทียบกับของที่รู้ขนาด (A4 / บัตร / กระเบื้อง / ประตู) ที่อยู่ระนาบเดียวกัน
 * - นับกระเบื้อง: จำนวนแผ่น × ขนาดแผ่น
 * - AR: ระยะระหว่างจุดในพื้นที่จริง (เมตร)
 */

export interface Pt {
  x: number;
  y: number;
}

/** ของอ้างอิงที่มีขนาดมาตรฐาน (ซม.) */
export const REFERENCES = [
  { id: "a4", label: "กระดาษ A4 (ด้านยาว)", cm: 29.7 },
  { id: "card", label: "บัตร ATM/บัตรประชาชน (ด้านยาว)", cm: 8.56 },
  { id: "tile60", label: "กระเบื้อง 60 ซม.", cm: 60 },
  { id: "tile30", label: "กระเบื้อง 30 ซม.", cm: 30 },
  { id: "door", label: "ประตูห้อง (กว้างมาตรฐาน 80 ซม.)", cm: 80 },
  { id: "custom", label: "ของอื่น (กรอกขนาดเอง)", cm: 0 },
] as const;

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * ความยาวจริงจากรูป: ความยาวอ้างอิง × (ระยะพิกเซลที่วัด ÷ ระยะพิกเซลของของอ้างอิง)
 * แม่นเมื่อของอ้างอิงกับสิ่งที่วัดอยู่ระนาบเดียวกันและไกลกล้องพอๆ กัน
 */
export function lengthFromPhoto(refA: Pt, refB: Pt, refCm: number, a: Pt, b: Pt): number | null {
  const refPx = dist(refA, refB);
  if (refPx < 4 || refCm <= 0) return null;
  return Math.round((dist(a, b) / refPx) * refCm);
}

/** จำนวนกระเบื้อง × ขนาด (ซม.) + เศษที่เหลือ */
export function lengthFromTiles(count: number, tileCm: number, extraCm = 0): number {
  if (!(count > 0) || !(tileCm > 0)) return 0;
  return Math.round(count * tileCm + Math.max(0, extraCm));
}

/** ระยะในพื้นที่ 3 มิติ (เมตร → ซม.) */
export function lengthFrom3d(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 100);
}

/** มุมห้องที่วัดได้ (เรียงตามเข็มหรือทวน) → กว้าง/ลึก/พื้นที่ (ห้องสี่เหลี่ยม) */
export function roomFromCorners(cornersCm: Array<{ x: number; z: number }>): { w: number; d: number; areaM2: number } | null {
  if (cornersCm.length < 3) return null;
  const side = (i: number) => {
    const a = cornersCm[i % cornersCm.length];
    const b = cornersCm[(i + 1) % cornersCm.length];
    return Math.hypot(a.x - b.x, a.z - b.z);
  };
  const w = Math.round(cornersCm.length >= 4 ? (side(0) + side(2)) / 2 : side(0));
  const d = Math.round(cornersCm.length >= 4 ? (side(1) + side(3)) / 2 : side(1));
  // พื้นที่จริงด้วยสูตร shoelace (ห้องไม่เป๊ะสี่เหลี่ยมก็ได้)
  let a2 = 0;
  for (let i = 0; i < cornersCm.length; i++) {
    const p = cornersCm[i];
    const q = cornersCm[(i + 1) % cornersCm.length];
    a2 += p.x * q.z - q.x * p.z;
  }
  return { w, d, areaM2: Math.round((Math.abs(a2) / 2 / 10000) * 100) / 100 };
}

/* ---------- วัดจากรูปแบบแก้มุมเอียง (homography) ---------- */
/** เมทริกซ์ 3×3 (แถวเรียง) ที่พา 4 จุดในรูป → 4 จุดบนระนาบจริง */
export type H3 = number[];

/** แก้สมการเชิงเส้น n×n ด้วย Gaussian elimination (คืน null ถ้าแก้ไม่ได้) */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

export function homography(src: Pt[], dst: Pt[]): H3 | null {
  if (src.length !== 4 || dst.length !== 4) return null;
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(A, b);
  return h ? [...h, 1] : null;
}

export function applyH(H: H3, p: Pt): Pt {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}

/**
 * มุมจริงของของอ้างอิงสี่เหลี่ยม เรียงตามลำดับที่แตะ (วนรอบตามหรือทวนเข็ม)
 * firstIsLong = ด้านแรก (จุด 1→2) คือด้านยาว — ในรูปเอียงดูด้วยตาไม่ได้ว่าด้านไหนยาว จึงให้ผู้ใช้บอก
 */
export function refRect(img: Pt[], shortCm: number, longCm: number, firstIsLong = true): Pt[] {
  void img;
  const [a, b] = firstIsLong ? [longCm, shortCm] : [shortCm, longCm];
  return [
    { x: 0, y: 0 },
    { x: a, y: 0 },
    { x: a, y: b },
    { x: 0, y: b },
  ];
}

/**
 * ความยาวจริง (ซม.) ระหว่าง 2 จุดบนระนาบเดียวกับของอ้างอิงสี่เหลี่ยม (เช่น A4 วางบนพื้น)
 * แก้มุมเอียงของกล้องได้ → ถ่ายเฉียงๆ ก็วัดได้แม่น
 */
export function rectPlaneLength(refImg: Pt[], shortCm: number, longCm: number, a: Pt, b: Pt, firstIsLong = true): number | null {
  if (refImg.length !== 4 || shortCm <= 0 || longCm <= 0) return null;
  const H = homography(refImg, refRect(refImg, shortCm, longCm, firstIsLong));
  if (!H) return null;
  const pa = applyH(H, a);
  const pb = applyH(H, b);
  const cm = dist(pa, pb);
  return Number.isFinite(cm) && cm > 0 && cm < 5000 ? Math.round(cm) : null;
}
