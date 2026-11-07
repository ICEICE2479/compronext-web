import { pointInShape, signedArea, type Pt2 } from "./room-shape";

/**
 * ระบบเรขาคณิตสำหรับกระดาษแปลนห้อง 2D (Blueprint Geometry)
 * รองรับ:
 * 1. วาดห้องด้วยการลากคลุมช่องตาราง (Grid Paint: ต่อเติม + / เว้ามุม -) -> แปลงเป็น Polygon อัตโนมัติ
 * 2. วาดเส้นผนังทีละจุด (Point-to-Point Polygon)
 * 3. ยึดเกาะและลากหน้าต่าง/ประตูไปตามผนังทุกด้านของห้องทรงใดก็ได้
 */

export const GRID_CELL_CM = 50; // 1 ช่องตาราง = 50 ซม. (0.5 เมตร)
export const GRID_CELL_PX = 40; // 1 ช่องตาราง = 40 SVG units (80px = 1 เมตร)
export const GRID_COLS = 22; // พื้นที่วาดกว้าง 11.0 เมตร
export const GRID_ROWS = 14; // พื้นที่วาดลึก 7.0 เมตร
export const GRID_ORIGIN_X = 110; // เว้นซ้ายให้แถบปุ่มเครื่องมือลอย
export const GRID_ORIGIN_Y = 60; // เว้นบนให้ป้ายขนาด

export const cellKey = (gx: number, gz: number) => `${gx},${gz}`;

export function parseCellKey(k: string): [number, number] {
  const [x, z] = k.split(",").map(Number);
  return [x, z];
}

/** สร้างชุดช่องตารางเริ่มต้นสำหรับห้องสี่เหลี่ยมกลางกระดาษ */
export function makeRectCells(widthCm: number, depthCm: number): Set<string> {
  const wCells = Math.max(4, Math.round(widthCm / GRID_CELL_CM));
  const dCells = Math.max(4, Math.round(depthCm / GRID_CELL_CM));
  const startX = Math.floor((GRID_COLS - wCells) / 2);
  const startZ = Math.floor((GRID_ROWS - dCells) / 2);
  const out = new Set<string>();
  for (let gz = startZ; gz < startZ + dCells; gz++) {
    for (let gx = startX; gx < startX + wCells; gx++) {
      out.add(cellKey(gx, gz));
    }
  }
  return out;
}

/**
 * ทำความสะอาดชุดช่องตาราง:
 * - เก็บเฉพาะกลุ่มที่เชื่อมต่อกัน 4 ทิศทาง (เลือกกลุ่มที่มี anchorKey หรือกลุ่มใหญ่สุด)
 * - ถมรูตรงกลางที่ล้อมรอบด้วยห้อง (เพื่อให้พื้นห้องเป็นแผ่นเดียว ไม่เกิดรูทะลุใน 3D)
 */
export function cleanCellSet(raw: Set<string>, anchorKey?: string): Set<string> {
  if (raw.size === 0) return new Set();

  const visited = new Set<string>();
  const components: Set<string>[] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (const k of raw) {
    if (visited.has(k)) continue;
    const comp = new Set<string>();
    const queue = [k];
    visited.add(k);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      comp.add(cur);
      const [cx, cz] = parseCellKey(cur);
      for (const [dx, dz] of dirs) {
        const nk = cellKey(cx + dx, cz + dz);
        if (raw.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          queue.push(nk);
        }
      }
    }
    components.push(comp);
  }

  let chosen = components[0];
  if (anchorKey) {
    const withAnchor = components.find((c) => c.has(anchorKey));
    if (withAnchor) chosen = withAnchor;
    else chosen = components.sort((a, b) => b.size - a.size)[0];
  } else {
    chosen = components.sort((a, b) => b.size - a.size)[0];
  }

  // ถมรูกลวงด้านใน (Flood fill จากขอบนอก [-1..GRID_COLS] x [-1..GRID_ROWS])
  const outside = new Set<string>();
  const q: [number, number][] = [[-1, -1]];
  outside.add(cellKey(-1, -1));

  while (q.length > 0) {
    const [cx, cz] = q.shift()!;
    for (const [dx, dz] of dirs) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < -1 || nx > GRID_COLS || nz < -1 || nz > GRID_ROWS) continue;
      const nk = cellKey(nx, nz);
      if (outside.has(nk) || chosen.has(nk)) continue;
      outside.add(nk);
      q.push([nx, nz]);
    }
  }

  const filled = new Set<string>(chosen);
  for (let gz = 0; gz < GRID_ROWS; gz++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const k = cellKey(gx, gz);
      if (!outside.has(k)) filled.add(k);
    }
  }
  return filled;
}

export interface CanvasPolygonResult {
  /** จุดมุมห้องในหน่วย ซม. เทียบจากมุมซ้ายบนของกระดาษพิมพ์เขียว */
  canvasPolyCm: Pt2[];
  /** จุดมุมห้องในหน่วย ซม. เทียบจาก (0,0) ของตัวห้อง (สำหรับส่งเข้า 3D RoomSize.shape) */
  localShapeCm: Pt2[];
  originCm: Pt2;
  widthCm: number;
  depthCm: number;
  isSimpleRect: boolean;
}

/** แปลงชุดช่องตารางเป็นรูปหลายเหลี่ยมขอบผนังห้อง */
export function cellsToRoomPolygon(cellsInput: Set<string>, anchorKey?: string): CanvasPolygonResult | null {
  const cells = cleanCellSet(cellsInput, anchorKey);
  if (cells.size === 0) return null;

  type Dir = 0 | 1 | 2 | 3; // 0=E(+x), 1=S(+z), 2=W(-x), 3=N(-z)
  interface HalfEdge {
    fx: number;
    fz: number;
    tx: number;
    tz: number;
    dir: Dir;
    used: boolean;
  }

  const outMap = new Map<string, HalfEdge[]>();
  const addEdge = (fx: number, fz: number, tx: number, tz: number, dir: Dir) => {
    const k = cellKey(fx, fz);
    const list = outMap.get(k) || [];
    list.push({ fx, fz, tx, tz, dir, used: false });
    outMap.set(k, list);
  };

  for (const k of cells) {
    const [gx, gz] = parseCellKey(k);
    if (!cells.has(cellKey(gx, gz - 1))) addEdge(gx, gz, gx + 1, gz, 0);
    if (!cells.has(cellKey(gx + 1, gz))) addEdge(gx + 1, gz, gx + 1, gz + 1, 1);
    if (!cells.has(cellKey(gx, gz + 1))) addEdge(gx + 1, gz + 1, gx, gz + 1, 2);
    if (!cells.has(cellKey(gx - 1, gz))) addEdge(gx, gz + 1, gx, gz, 3);
  }

  // เริ่มจากจุดมุมบนซ้ายสุด (min z, แล้ว min x)
  let startEdge: HalfEdge | null = null;
  for (const edges of outMap.values()) {
    for (const e of edges) {
      if (
        !startEdge ||
        e.fz < startEdge.fz ||
        (e.fz === startEdge.fz && e.fx < startEdge.fx)
      ) {
        startEdge = e;
      }
    }
  }
  if (!startEdge) return null;

  const loopGrid: Pt2[] = [];
  let cur: HalfEdge | undefined = startEdge;
  let guard = 0;

  while (cur && !cur.used && guard++ < 2000) {
    cur.used = true;
    loopGrid.push([cur.fx, cur.fz]);
    if (cur.tx === startEdge.fx && cur.tz === startEdge.fz) break;

    const candidates: HalfEdge[] = (outMap.get(cellKey(cur.tx, cur.tz)) || []).filter((e) => !e.used);
    if (candidates.length === 0) break;
    if (candidates.length === 1) {
      cur = candidates[0];
    } else {
      // กรณีมุมชนทแยง: เลี้ยวซ้ายก่อนเพื่อเดินรอบนอกต่อเนื่องเป็นเส้นเดียว
      const pref: Dir[] = [
        ((cur.dir + 3) % 4) as Dir,
        cur.dir,
        ((cur.dir + 1) % 4) as Dir,
        ((cur.dir + 2) % 4) as Dir,
      ];
      cur = pref.map((d) => candidates.find((c) => c.dir === d)).find(Boolean) || candidates[0];
    }
  }

  if (loopGrid.length < 4) return null;

  // ตัดจุดที่อยู่บนเส้นตรงเดียวกันออก
  const simplified: Pt2[] = [];
  for (let i = 0; i < loopGrid.length; i++) {
    const prev = loopGrid[(i - 1 + loopGrid.length) % loopGrid.length];
    const pt = loopGrid[i];
    const next = loopGrid[(i + 1) % loopGrid.length];
    const cross = (pt[0] - prev[0]) * (next[1] - pt[1]) - (pt[1] - prev[1]) * (next[0] - pt[0]);
    if (cross !== 0) simplified.push([pt[0] * GRID_CELL_CM, pt[1] * GRID_CELL_CM]);
  }

  return normalizeCanvasPolygon(simplified);
}

/** แปลง Polygon บนกระดาษ (หน่วย ซม.) ให้เป็นข้อมูลพร้อมใช้ทั้ง 2D และ 3D */
export function normalizeCanvasPolygon(rawCanvasCm: Pt2[]): CanvasPolygonResult | null {
  if (rawCanvasCm.length < 3) return null;
  let poly = rawCanvasCm.map(([x, z]) => [Math.round(x), Math.round(z)] as Pt2);

  // ตัดจุดซ้ำติดกัน
  poly = poly.filter((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]) >= 10;
  });
  if (poly.length < 3) return null;

  const area = signedArea(poly);
  if (Math.abs(area) < 2500) return null; // ต้องมีพื้นที่อย่างน้อย 0.25 ตร.ม.
  if (area < 0) poly = [...poly].reverse();

  const minX = Math.min(...poly.map((p) => p[0]));
  const maxX = Math.max(...poly.map((p) => p[0]));
  const minZ = Math.min(...poly.map((p) => p[1]));
  const maxZ = Math.max(...poly.map((p) => p[1]));

  const widthCm = Math.max(100, maxX - minX);
  const depthCm = Math.max(100, maxZ - minZ);
  const localShapeCm: Pt2[] = poly.map(([x, z]) => [x - minX, z - minZ]);

  const isSimpleRect =
    localShapeCm.length === 4 &&
    Math.abs(Math.abs(signedArea(localShapeCm)) - widthCm * depthCm) < 25;

  return {
    canvasPolyCm: poly,
    localShapeCm,
    originCm: [minX, minZ],
    widthCm,
    depthCm,
    isSimpleRect,
  };
}

/** แปลงพิกัด ซม. บนกระดาษ <-> พิกัด SVG */
export function cmToSvg(xCm: number, zCm: number): [number, number] {
  return [
    GRID_ORIGIN_X + (xCm / GRID_CELL_CM) * GRID_CELL_PX,
    GRID_ORIGIN_Y + (zCm / GRID_CELL_CM) * GRID_CELL_PX,
  ];
}

export function svgToCm(svgX: number, svgY: number): [number, number] {
  return [
    ((svgX - GRID_ORIGIN_X) / GRID_CELL_PX) * GRID_CELL_CM,
    ((svgY - GRID_ORIGIN_Y) / GRID_CELL_PX) * GRID_CELL_CM,
  ];
}

export interface EdgeHit {
  edgeIndex: number;
  pos: number; // 0.08..0.92
  distCm: number;
  wallCardinal: "top" | "bottom" | "left" | "right";
  lengthCm: number;
  /** มุมออกนอกห้อง (องศาเข็มทิศพื้นฐาน: 0=บน/เหนือ, 90=ขวา/ตะวันออก, 180=ล่าง/ใต้, 270=ซ้าย/ตะวันตก) */
  outwardBaseDeg: number;
}

/** คำนวณข้อมูลผนังแต่ละด้านของ Polygon */
export function getEdgeInfo(poly: Pt2[], edgeIndex: number) {
  const n = poly.length;
  const idx = ((edgeIndex % n) + n) % n;
  const [x1, z1] = poly[idx];
  const [x2, z2] = poly[(idx + 1) % n];
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lengthCm = Math.hypot(dx, dz) || 1;
  const ex = dx / lengthCm;
  const ez = dz / lengthCm;
  // สำหรับ signedArea > 0: ทิศออกนอกห้องคือ (nx, nz) = (ez, -ex)
  const nx = ez;
  const nz = -ex;

  // แปลงเวกเตอร์ออกนอกห้องเป็นมุมฐานเข็มทิศ (0° = -z บน, 90° = +x ขวา, 180° = +z ล่าง, 270° = -x ซ้าย)
  const outwardBaseDeg = ((Math.atan2(nx, -nz) * 180) / Math.PI + 360) % 360;

  let wallCardinal: "top" | "bottom" | "left" | "right" = "top";
  if (Math.abs(nz) >= Math.abs(nx)) {
    wallCardinal = nz < 0 ? "top" : "bottom";
  } else {
    wallCardinal = nx < 0 ? "left" : "right";
  }

  return {
    edgeIndex: idx,
    x1,
    z1,
    x2,
    z2,
    ex,
    ez,
    nx,
    nz,
    lengthCm,
    outwardBaseDeg,
    wallCardinal,
  };
}

/** หาผนังห้องที่อยู่ใกล้จุดเมาส์ (xCm, zCm) ที่สุด สำหรับวาง/ลากหน้าต่างและประตูได้ทุกผนัง */
export function findClosestWallEdge(
  poly: Pt2[],
  xCm: number,
  zCm: number,
  itemWidthCm = 80,
  cornerPadCm = 22
): EdgeHit | null {
  if (poly.length < 3) return null;
  let best: EdgeHit | null = null;

  for (let i = 0; i < poly.length; i++) {
    const info = getEdgeInfo(poly, i);
    if (info.lengthCm < 55) continue; // ข้ามผนังสั้นกว่า 55 ซม.

    const px = xCm - info.x1;
    const pz = zCm - info.z1;
    const rawT = (px * info.ex + pz * info.ez) / info.lengthCm;
    const clampedSegT = Math.max(0, Math.min(1, rawT));
    const projX = info.x1 + info.ex * info.lengthCm * clampedSegT;
    const projZ = info.z1 + info.ez * info.lengthCm * clampedSegT;
    const distCm = Math.hypot(xCm - projX, zCm - projZ);

    const margin = Math.min(0.45, Math.max(0.1, (itemWidthCm / 2 + cornerPadCm) / info.lengthCm));
    const safePos = Math.max(margin, Math.min(1 - margin, rawT));

    if (!best || distCm < best.distCm) {
      best = {
        edgeIndex: i,
        pos: Number(safePos.toFixed(3)),
        distCm,
        wallCardinal: info.wallCardinal,
        lengthCm: info.lengthCm,
        outwardBaseDeg: info.outwardBaseDeg,
      };
    }
  }
  return best;
}

/** แปลง Polygon บนกระดาษกลับเป็นชุดช่องตาราง 50x50 ซม. เพื่อรองรับการวาดต่อเติม/เว้ามุมต่อเนื่อง */
export function polygonToCells(canvasPolyCm: Pt2[]): Set<string> {
  const out = new Set<string>();
  if (canvasPolyCm.length < 3) return out;
  for (let gz = 0; gz < GRID_ROWS; gz++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const cx = (gx + 0.5) * GRID_CELL_CM;
      const cz = (gz + 0.5) * GRID_CELL_CM;
      if (pointInShape(cx, cz, canvasPolyCm)) {
        out.add(cellKey(gx, gz));
      }
    }
  }
  return out;
}

/** ตรวจสอบว่าเส้นขอบ Polygon ตัดกันเองหรือไม่ */
export function hasSelfIntersection(poly: Pt2[]): boolean {
  const n = poly.length;
  if (n < 4) return false;
  const ccw = (a: Pt2, b: Pt2, c: Pt2) =>
    (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0]);

  const segIntersect = (p1: Pt2, p2: Pt2, p3: Pt2, p4: Pt2) => {
    const d1 = ccw(p3, p4, p1);
    const d2 = ccw(p3, p4, p2);
    const d3 = ccw(p1, p2, p3);
    const d4 = ccw(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };

  for (let i = 0; i < n; i++) {
    const a1 = poly[i];
    const a2 = poly[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // ด้านติดกันใช้จุดร่วมกัน
      const b1 = poly[j];
      const b2 = poly[(j + 1) % n];
      if (segIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/** เลื่อนรูปหลายเหลี่ยมให้อยู่ภายในขอบกระดาษแปลนห้องโดยไม่เปลี่ยนขนาดจริงของผนัง */
export function recenterPolyInGrid(poly: Pt2[]): Pt2[] {
  const maxX = GRID_COLS * GRID_CELL_CM;
  const maxZ = GRID_ROWS * GRID_CELL_CM;
  const minPx = Math.min(...poly.map((p) => p[0]));
  const maxPx = Math.max(...poly.map((p) => p[0]));
  const minPz = Math.min(...poly.map((p) => p[1]));
  const maxPz = Math.max(...poly.map((p) => p[1]));

  let shiftX = 0;
  let shiftZ = 0;
  if (minPx < 20) shiftX = 20 - minPx;
  else if (maxPx > maxX - 20) shiftX = maxX - 20 - maxPx;

  if (minPz < 20) shiftZ = 20 - minPz;
  else if (maxPz > maxZ - 20) shiftZ = maxZ - 20 - maxPz;

  if (shiftX === 0 && shiftZ === 0) return poly;
  return poly.map(([x, z]) => [Math.round(x + shiftX), Math.round(z + shiftZ)]);
}

/** เลื่อนผนังด้าน edgeIndex ตามเมาส์ (รองรับความละเอียดระดับ 0.1 เมตร = 10 ซม.) */
export function movePolygonEdge(
  basePoly: Pt2[],
  edgeIndex: number,
  deltaXCm: number,
  deltaZCm: number,
  snapCm = 10
): Pt2[] | null {
  const n = basePoly.length;
  if (n < 3) return null;
  const i1 = ((edgeIndex % n) + n) % n;
  const i2 = (i1 + 1) % n;
  const [x1, z1] = basePoly[i1];
  const [x2, z2] = basePoly[i2];

  const maxX = GRID_COLS * GRID_CELL_CM;
  const maxZ = GRID_ROWS * GRID_CELL_CM;
  const clampX = (v: number) => Math.max(0, Math.min(maxX, Math.round(v / snapCm) * snapCm));
  const clampZ = (v: number) => Math.max(0, Math.min(maxZ, Math.round(v / snapCm) * snapCm));

  const next = basePoly.map(([x, z]) => [x, z] as Pt2);

  if (Math.abs(z1 - z2) < 2) {
    // ผนังแนวนอน -> ขยับขึ้น/ลง
    const nz = clampZ(z1 + deltaZCm);
    next[i1][1] = nz;
    next[i2][1] = nz;
  } else if (Math.abs(x1 - x2) < 2) {
    // ผนังแนวตั้ง -> ขยับซ้าย/ขวา
    const nx = clampX(x1 + deltaXCm);
    next[i1][0] = nx;
    next[i2][0] = nx;
  } else {
    // ผนังเฉียง -> ขยับตามแนวตั้งฉากผนัง
    const info = getEdgeInfo(basePoly, i1);
    const proj = deltaXCm * info.nx + deltaZCm * info.nz;
    const snapped = Math.round(proj / snapCm) * snapCm;
    next[i1] = [clampX(x1 + info.nx * snapped), clampZ(z1 + info.nz * snapped)];
    next[i2] = [clampX(x2 + info.nx * snapped), clampZ(z2 + info.nz * snapped)];
  }

  // ตรวจความยาวแต่ละด้านไม่ให้หดสั้นกว่า 40 ซม. (0.4 ม.) และไม่พันกันเอง
  for (let i = 0; i < n; i++) {
    const p = next[i];
    const q = next[(i + 1) % n];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 40) return null;
  }
  if (hasSelfIntersection(next) || signedArea(next) < 2500) return null;
  return next;
}

/**
 * กำหนดความยาวผนังด้าน edgeIndex ด้วยตัวเลขโดยตรง (เช่น 3.1 ม., 2.7 ม., 4.35 ม.)
 * รักษามุมฉากของห้องสี่เหลี่ยม ห้องตัว L ห้องตัว U และซอกมุมอัตโนมัติ
 */
export function setPolygonEdgeLength(
  basePoly: Pt2[],
  edgeIndex: number,
  targetLenCm: number
): Pt2[] | null {
  const n = basePoly.length;
  if (n < 3) return null;
  const clampedTarget = Math.max(40, Math.min(1300, Math.round(targetLenCm)));
  const i1 = ((edgeIndex % n) + n) % n;
  const i2 = (i1 + 1) % n;
  const iPrev = (i1 - 1 + n) % n;

  const info = getEdgeInfo(basePoly, i1);
  const dL = clampedTarget - info.lengthCm;
  if (Math.abs(dL) < 0.5) return basePoly;

  const maxSpanX = GRID_COLS * GRID_CELL_CM - 20;
  const maxSpanZ = GRID_ROWS * GRID_CELL_CM - 20;

  const validateCandidate = (cand: Pt2[]): Pt2[] | null => {
    for (let i = 0; i < n; i++) {
      const p = cand[i];
      const q = cand[(i + 1) % n];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 40) return null;
    }
    if (hasSelfIntersection(cand) || signedArea(cand) < 2500) return null;
    const minX = Math.min(...cand.map((p) => p[0]));
    const maxX = Math.max(...cand.map((p) => p[0]));
    const minZ = Math.min(...cand.map((p) => p[1]));
    const maxZ = Math.max(...cand.map((p) => p[1]));
    if (maxX - minX > maxSpanX || maxZ - minZ > maxSpanZ) return null;
    if (Math.abs(getEdgeInfo(cand, i1).lengthCm - clampedTarget) > 1.8) return null;
    return recenterPolyInGrid(cand);
  };

  const dx = Math.round(info.ex * dL);
  const dz = Math.round(info.ez * dL);

  // วิธีที่ 1: เลื่อนผนังด้านถัดไปที่ตั้งฉากกันออกไปตามแนวผนังนี้ (รักษามุมฉาก 90° เป๊ะ)
  const infoNext = getEdgeInfo(basePoly, i2);
  if (Math.abs(info.ex * infoNext.ex + info.ez * infoNext.ez) < 0.25) {
    const cand1 = basePoly.map(([x, z]) => [x, z] as Pt2);
    const i3 = (i2 + 1) % n;
    cand1[i2] = [cand1[i2][0] + dx, cand1[i2][1] + dz];
    cand1[i3] = [cand1[i3][0] + dx, cand1[i3][1] + dz];
    const ok1 = validateCandidate(cand1);
    if (ok1) return ok1;
  }

  // วิธีที่ 2: หากด้านถัดไปติดมุมเว้าตัว L/U ให้เลื่อนผนังด้านก่อนหน้าที่ตั้งฉากกันไปทางตรงข้ามแทน
  const infoPrev = getEdgeInfo(basePoly, iPrev);
  if (Math.abs(info.ex * infoPrev.ex + info.ez * infoPrev.ez) < 0.25) {
    const cand2 = basePoly.map(([x, z]) => [x, z] as Pt2);
    cand2[iPrev] = [cand2[iPrev][0] - dx, cand2[iPrev][1] - dz];
    cand2[i1] = [cand2[i1][0] - dx, cand2[i1][1] - dz];
    const ok2 = validateCandidate(cand2);
    if (ok2) return ok2;
  }

  // วิธีที่ 3: กรณีผนังเฉียงอิสระ เลื่อนจุดปลายผนังตามแนวเส้นตรงของผนังโดยตรง
  const cand3 = basePoly.map(([x, z]) => [x, z] as Pt2);
  cand3[i2] = [cand3[i2][0] + dx, cand3[i2][1] + dz];
  const ok3 = validateCandidate(cand3);
  if (ok3) return ok3;

  const cand4 = basePoly.map(([x, z]) => [x, z] as Pt2);
  cand4[i1] = [cand4[i1][0] - dx, cand4[i1][1] - dz];
  return validateCandidate(cand4);
}

export interface CanvasInteriorWall {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/** หาระยะห่างสั้นสุดจากจุด (xCm, zCm) ไปยังเส้นขอบผนังนอกของห้อง */
export function minDistToPolyBoundary(
  xCm: number,
  zCm: number,
  poly: Pt2[]
): { distCm: number; projX: number; projZ: number; edgeIndex: number } {
  if (poly.length < 3) {
    return { distCm: Infinity, projX: xCm, projZ: zCm, edgeIndex: -1 };
  }
  let bestDist = Infinity;
  let bestPx = xCm;
  let bestPz = zCm;
  let bestIdx = 0;

  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((xCm - x1) * dx + (zCm - z1) * dz) / lenSq)) : 0;
    const px = x1 + dx * t;
    const pz = z1 + dz * t;
    const d = Math.hypot(xCm - px, zCm - pz);
    if (d < bestDist) {
      bestDist = d;
      bestPx = px;
      bestPz = pz;
      bestIdx = i;
    }
  }
  return { distCm: bestDist, projX: bestPx, projZ: bestPz, edgeIndex: bestIdx };
}

/** ตรวจว่าจุดอยู่ในห้อง หรืออยู่ชิดเส้นผนังห้องภายในระยะ tolCm */
export function isPointInOrNearRoom(xCm: number, zCm: number, poly: Pt2[], tolCm = 18): boolean {
  if (poly.length < 3) return false;
  if (pointInShape(xCm, zCm, poly)) return true;
  return minDistToPolyBoundary(xCm, zCm, poly).distCm <= tolCm;
}

/** ดูดจุดปลายกำแพงกั้นในห้องให้แนบสนิทกับผนังนอกหรือกำแพงในห้องที่มีอยู่แล้ว (ละเอียด 10 ซม. = 0.1 ม.) */
export function snapPointToRoomWalls(
  rawX: number,
  rawZ: number,
  poly: Pt2[],
  interiorWalls: CanvasInteriorWall[] = [],
  snapTolCm = 22
): Pt2 {
  const maxX = GRID_COLS * GRID_CELL_CM;
  const maxZ = GRID_ROWS * GRID_CELL_CM;
  let sx = Math.max(0, Math.min(maxX, Math.round(rawX / 10) * 10));
  let sz = Math.max(0, Math.min(maxZ, Math.round(rawZ / 10) * 10));

  // ดูดเข้าหามุมห้องก่อนถ้าใกล้มาก
  for (const [vx, vz] of poly) {
    if (Math.hypot(sx - vx, sz - vz) <= snapTolCm) {
      return [vx, vz];
    }
  }
  for (const iw of interiorWalls) {
    if (Math.hypot(sx - iw.x1, sz - iw.z1) <= snapTolCm) return [iw.x1, iw.z1];
    if (Math.hypot(sx - iw.x2, sz - iw.z2) <= snapTolCm) return [iw.x2, iw.z2];
  }

  // ดูดเข้าหาเส้นผนังนอกห้อง
  const outer = minDistToPolyBoundary(sx, sz, poly);
  if (outer.distCm <= snapTolCm) {
    sx = Math.round(outer.projX / 10) * 10;
    sz = Math.round(outer.projZ / 10) * 10;
    return [sx, sz];
  }

  // ดูดเข้าหากำแพงกั้นในห้องเส้นอื่น
  for (const iw of interiorWalls) {
    const dx = iw.x2 - iw.x1;
    const dz = iw.z2 - iw.z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1) continue;
    const t = Math.max(0, Math.min(1, ((sx - iw.x1) * dx + (sz - iw.z1) * dz) / lenSq));
    const px = iw.x1 + dx * t;
    const pz = iw.z1 + dz * t;
    if (Math.hypot(sx - px, sz - pz) <= snapTolCm) {
      return [Math.round(px / 10) * 10, Math.round(pz / 10) * 10];
    }
  }

  return [sx, sz];
}

/**
 * คำนวณเส้นกำแพงกั้นในห้องเมื่อลูกค้าคลิกลากเข้าไปในตัวห้องที่มีอยู่แล้ว:
 * - หากลากอยู่ภายในตัวห้อง -> คืน isInteriorWall = true พร้อมจุดเริ่ม-จบที่ตั้งฉาก 90° (หรืออิสระเมื่อกด Shift) ละเอียด 0.1 ม.
 * - หากลากทะลุออกไปนอกห้อง -> คืน isInteriorWall = false เพื่อให้ระบบสลับเป็นการวาดต่อเติมขยายพื้นที่ห้องอัตโนมัติ
 */
export function resolveInteriorWallDrag(
  startRawCm: Pt2,
  curRawCm: Pt2,
  poly: Pt2[],
  interiorWalls: CanvasInteriorWall[] = [],
  freeAngle = false
): {
  isInteriorWall: boolean;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  lengthCm: number;
} {
  if (poly.length < 3) {
    return { isInteriorWall: false, x1: 0, z1: 0, x2: 0, z2: 0, lengthCm: 0 };
  }

  const startedInside = isPointInOrNearRoom(startRawCm[0], startRawCm[1], poly, 22);
  const curInside = isPointInOrNearRoom(curRawCm[0], curRawCm[1], poly, 22);
  if (!startedInside || !curInside) {
    return { isInteriorWall: false, x1: 0, z1: 0, x2: 0, z2: 0, lengthCm: 0 };
  }

  const [x1, z1] = snapPointToRoomWalls(startRawCm[0], startRawCm[1], poly, interiorWalls, 22);
  let targetX = Math.round(curRawCm[0] / 10) * 10;
  let targetZ = Math.round(curRawCm[1] / 10) * 10;

  if (!freeAngle) {
    if (Math.abs(targetX - x1) >= Math.abs(targetZ - z1)) {
      targetZ = z1;
      // ดูดปลายแนวนอนให้ชนผนังนอกหรือกำแพงในห้องอัตโนมัติถ้าระยะห่างไม่เกิน 22 ซม.
      const snapped = snapPointToRoomWalls(targetX, z1, poly, interiorWalls, 22);
      if (Math.abs(snapped[1] - z1) <= 10) {
        targetX = snapped[0];
      }
    } else {
      targetX = x1;
      // ดูดปลายแนวตั้งให้ชนผนังนอกหรือกำแพงในห้องอัตโนมัติถ้าระยะห่างไม่เกิน 22 ซม.
      const snapped = snapPointToRoomWalls(x1, targetZ, poly, interiorWalls, 22);
      if (Math.abs(snapped[0] - x1) <= 10) {
        targetZ = snapped[1];
      }
    }
  } else {
    const snappedEnd = snapPointToRoomWalls(targetX, targetZ, poly, interiorWalls, 20);
    targetX = snappedEnd[0];
    targetZ = snappedEnd[1];
  }

  const lengthCm = Math.hypot(targetX - x1, targetZ - z1);
  if (lengthCm < 15) {
    // เพิ่งเริ่มคลิกในห้อง ยังลากไม่ถึง 15 ซม.
    return { isInteriorWall: true, x1, z1, x2: targetX, z2: targetZ, lengthCm };
  }

  // ตรวจจุดระหว่างทางว่าอยู่ในห้องทั้งหมด และจุดกึ่งกลางไม่ได้ทับซ้อนบนเส้นผนังนอกห้องเดิม
  for (const t of [0.2, 0.5, 0.8]) {
    const px = x1 + (targetX - x1) * t;
    const pz = z1 + (targetZ - z1) * t;
    if (!isPointInOrNearRoom(px, pz, poly, 12)) {
      return { isInteriorWall: false, x1, z1, x2: targetX, z2: targetZ, lengthCm };
    }
  }

  const mx = (x1 + targetX) * 0.5;
  const mz = (z1 + targetZ) * 0.5;
  const midBoundary = minDistToPolyBoundary(mx, mz, poly);
  if (!pointInShape(mx, mz, poly) || midBoundary.distCm <= 12) {
    return { isInteriorWall: false, x1, z1, x2: targetX, z2: targetZ, lengthCm };
  }

  return {
    isInteriorWall: true,
    x1,
    z1,
    x2: targetX,
    z2: targetZ,
    lengthCm,
  };
}

export interface OpeningObstacleRange {
  startCm: number;
  endCm: number;
}

/**
 * คำนวณช่วงว่างจริงบนผนัง (หักระยะมุมกำแพง + จุดชนกำแพงกั้นในห้อง T-junction + บานอื่นบนผนังเดียวกัน)
 * เพื่อป้องกันไม่ให้หน้าต่าง/ผ้าม่าน/ราวผ้าม่าน หรือประตู ยื่นทะลุกำแพงหรือซ้อนทับกันเด็ดขาด
 */
export function clampOpeningOnSegment(params: {
  rawPos: number;
  desiredWidthCm: number;
  minWidthCm?: number;
  segX1: number;
  segZ1: number;
  segEx: number;
  segEz: number;
  segLenCm: number;
  cornerClearanceCm: number;
  interiorWalls?: CanvasInteriorWall[];
  excludeInteriorWallId?: string;
  siblingRangesCm?: OpeningObstacleRange[];
}): { pos: number; widthCm: number; spanWidthCm: number } | null {
  const {
    rawPos,
    desiredWidthCm,
    minWidthCm = 50,
    segX1,
    segZ1,
    segEx,
    segEz,
    segLenCm,
    cornerClearanceCm,
    interiorWalls = [],
    excludeInteriorWallId,
    siblingRangesCm = [],
  } = params;

  const baseStart = cornerClearanceCm;
  const baseEnd = segLenCm - cornerClearanceCm;
  if (baseEnd - baseStart < minWidthCm) return null;

  const blocked: Array<[number, number]> = [];

  // 1) หักช่วงที่กำแพงกั้นในห้อง (Interior Partition Wall) พุ่งมาชนหรือตัดกับผนังด้านนี้
  for (const iw of interiorWalls) {
    if (excludeInteriorWallId && iw.id === excludeInteriorWallId) continue;
    const idx = iw.x2 - iw.x1;
    const idz = iw.z2 - iw.z1;
    const iLen = Math.hypot(idx, idz);
    if (iLen < 10) continue;
    const iex = idx / iLen;
    const iez = idz / iLen;
    const cross = segEx * iez - segEz * iex;

    // ตรวจจุดปลายทั้ง 2 ด้านของกำแพงในห้องว่ามาชนผนังนี้หรือไม่
    for (const [px, pz] of [
      [iw.x1, iw.z1],
      [iw.x2, iw.z2],
    ]) {
      const rx = px - segX1;
      const rz = pz - segZ1;
      const proj = rx * segEx + rz * segEz;
      const perp = Math.abs(rx * -segEz + rz * segEx);
      if (perp <= 20 && proj > 4 && proj < segLenCm - 4 && Math.abs(cross) > 0.2) {
        blocked.push([proj - 22, proj + 22]);
      }
    }

    // ตรวจกรณีเส้นกำแพงในห้องตัดผ่านผนังนี้โดยตรง
    if (Math.abs(cross) > 0.2) {
      const qpx = iw.x1 - segX1;
      const qpz = iw.z1 - segZ1;
      const t = (qpx * iez - qpz * iex) / cross;
      const u = (qpx * segEz - qpz * segEx) / cross;
      if (u >= -4 && u <= iLen + 4 && t > 4 && t < segLenCm - 4) {
        blocked.push([t - 22, t + 22]);
      }
    }
  }

  // 2) หักช่วงของหน้าต่าง/ประตูบานอื่นบนผนังเดียวกัน
  for (const sib of siblingRangesCm) {
    if (sib.endCm > sib.startCm) {
      blocked.push([sib.startCm, sib.endCm]);
    }
  }

  blocked.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [b0, b1] of blocked) {
    const c0 = Math.max(baseStart, b0);
    const c1 = Math.min(baseEnd, b1);
    if (c1 <= c0) continue;
    if (merged.length === 0 || c0 > merged[merged.length - 1][1]) {
      merged.push([c0, c1]);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], c1);
    }
  }

  const freeSpans: Array<[number, number]> = [];
  let cursor = baseStart;
  for (const [m0, m1] of merged) {
    if (m0 - cursor >= minWidthCm) {
      freeSpans.push([cursor, m0]);
    }
    cursor = Math.max(cursor, m1);
  }
  if (baseEnd - cursor >= minWidthCm) {
    freeSpans.push([cursor, baseEnd]);
  }
  if (freeSpans.length === 0) return null;

  const targetS = Math.max(0, Math.min(segLenCm, rawPos * segLenCm));
  const fullFitSpans = freeSpans.filter(([a, b]) => b - a >= desiredWidthCm);
  const pool = fullFitSpans.length > 0 ? fullFitSpans : freeSpans;

  let bestChoice: { pos: number; widthCm: number; spanWidthCm: number; dist: number } | null = null;
  for (const [spanA, spanB] of pool) {
    const spanW = spanB - spanA;
    const widthCm =
      spanW >= desiredWidthCm
        ? desiredWidthCm
        : Math.max(minWidthCm, Math.floor(spanW / 5) * 5);
    const halfW = widthCm / 2;
    const center = Math.max(spanA + halfW, Math.min(spanB - halfW, targetS));
    const dist = Math.abs(center - targetS);
    if (!bestChoice || dist < bestChoice.dist) {
      bestChoice = {
        pos: Number((center / segLenCm).toFixed(4)),
        widthCm,
        spanWidthCm: spanW,
        dist,
      };
    }
  }

  if (!bestChoice) return null;
  return {
    pos: bestChoice.pos,
    widthCm: bestChoice.widthCm,
    spanWidthCm: bestChoice.spanWidthCm,
  };
}


