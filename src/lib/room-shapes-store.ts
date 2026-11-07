import { parseShape, type Pt2 } from "./room-shape";

/** รูปห้องที่วัดไว้ (จำในเครื่องนี้) — เลือกใช้ซ้ำในห้อง 3D ได้หลายห้อง */
export interface SavedShape {
  id: string;
  name: string;
  shape: Pt2[];
  h: number;
  at: number;
}

const KEY = "cn-room-shapes-v1";
const MAX = 12;

export function loadShapes(): SavedShape[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r) => {
        const shape = parseShape((r as SavedShape)?.shape);
        return shape ? { ...(r as SavedShape), name: String((r as SavedShape).name ?? "ห้อง").slice(0, 40), shape } : null;
      })
      .filter((r): r is SavedShape => !!r);
  } catch {
    return [];
  }
}

export function saveShape(s: Omit<SavedShape, "id" | "at">): SavedShape[] {
  const rec: SavedShape = { ...s, id: `rs-${Date.now().toString(36)}`, at: Date.now() };
  const list = [rec, ...loadShapes().filter((x) => x.name !== s.name)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* เต็ม/โหมดส่วนตัว */
  }
  return list;
}

export function removeShape(id: string): SavedShape[] {
  const list = loadShapes().filter((x) => x.id !== id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}
