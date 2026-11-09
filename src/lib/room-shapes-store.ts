import { parseShape, shapeBounds, type Pt2 } from "./room-shape";
import { decodePlan, encodePlan } from "./room-planner";

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
  if (id.startsWith("cloud-")) void fetch(`/api/room-plans?id=${encodeURIComponent(id.slice(6))}`, { method: "DELETE" }).catch(() => {});
  const list = loadShapes().filter((x) => x.id !== id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

const CLOUD_PREFIX = "แปลน: ";

/** ล็อกอินอยู่ → เก็บแปลนในบัญชีด้วย (เป็นห้องเปล่าในรายการห้องที่บันทึก) เปิดจากเครื่องอื่นได้ */
export function saveShapeToCloud(s: { name: string; shape: Pt2[]; h: number }): void {
  const b = shapeBounds(s.shape);
  const code = encodePlan({ w: b.w, d: b.d, h: s.h, shape: s.shape }, []);
  void fetch("/api/room-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `${CLOUD_PREFIX}${s.name}`.slice(0, 60), code }),
  }).catch(() => {});
}

/** แปลนในเครื่อง + แปลนในบัญชี (ไม่ได้ล็อกอิน = เฉพาะในเครื่อง) */
export async function loadShapesWithCloud(): Promise<SavedShape[]> {
  const local = loadShapes();
  try {
    const r = await fetch("/api/room-plans", { cache: "no-store" });
    if (!r.ok) return local;
    const j = (await r.json()) as { plans?: Array<{ id: string; name: string; code: string; updatedAt: string }> };
    const names = new Set(local.map((x) => x.name));
    const cloud: SavedShape[] = [];
    for (const p of j.plans ?? []) {
      if (!p.name.startsWith(CLOUD_PREFIX)) continue;
      const d = decodePlan(p.code);
      const name = p.name.slice(CLOUD_PREFIX.length);
      if (!d?.room.shape || names.has(name)) continue;
      names.add(name);
      cloud.push({ id: `cloud-${p.id}`, name, shape: d.room.shape, h: d.room.h, at: Date.parse(p.updatedAt) || 0 });
    }
    return [...local, ...cloud].slice(0, 24);
  } catch {
    return local;
  }
}
