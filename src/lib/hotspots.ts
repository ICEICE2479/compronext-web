/** ตำแหน่งจุดแตะบนภาพห้อง (หน่วย % ของกว้าง/สูงภาพ) */
export interface Spot {
  x: number;
  y: number;
}

export type LayoutZonePreset = "center" | "window-left" | "window-right" | "bedroom";

// ตำแหน่งที่ของแต่ละหมวดมักอยู่ในภาพห้อง (มุมกล้องระดับสายตา — โซนกลางผนังหลัก)
const CATEGORY_SPOT: Record<string, Spot> = {
  desk: { x: 50, y: 66 },
  chair: { x: 46, y: 78 },
  monitor: { x: 50, y: 45 },
  monitor_arm: { x: 56, y: 42 },
  keyboard: { x: 50, y: 60 },
  mouse: { x: 59, y: 61 },
  mousepad: { x: 52, y: 62 },
  speaker: { x: 37, y: 52 },
  headphone: { x: 64, y: 54 },
  computer: { x: 65, y: 53 },
  lighting: { x: 67, y: 44 },
  storage: { x: 84, y: 56 },
  wardrobe: { x: 14, y: 44 },
  bed: { x: 32, y: 72 },
  rug: { x: 50, y: 88 },
  decor: { x: 82, y: 48 },
  fake_plant: { x: 16, y: 68 },
  real_plant: { x: 16, y: 68 },
  plant_pot: { x: 16, y: 74 },
};

const ZONE_SPOT_OVERRIDES: Record<LayoutZonePreset, Partial<Record<string, Spot>>> = {
  center: {},
  "window-left": {
    desk: { x: 38, y: 66 },
    chair: { x: 42, y: 78 },
    monitor: { x: 38, y: 45 },
    monitor_arm: { x: 44, y: 42 },
    keyboard: { x: 38, y: 60 },
    mouse: { x: 47, y: 61 },
    mousepad: { x: 40, y: 62 },
    speaker: { x: 26, y: 52 },
    lighting: { x: 53, y: 44 },
    storage: { x: 78, y: 56 },
    rug: { x: 40, y: 88 },
    fake_plant: { x: 88, y: 70 },
    real_plant: { x: 88, y: 70 },
  },
  "window-right": {
    desk: { x: 62, y: 66 },
    chair: { x: 58, y: 78 },
    monitor: { x: 62, y: 45 },
    monitor_arm: { x: 56, y: 42 },
    keyboard: { x: 62, y: 60 },
    mouse: { x: 70, y: 61 },
    mousepad: { x: 64, y: 62 },
    speaker: { x: 50, y: 52 },
    lighting: { x: 47, y: 44 },
    storage: { x: 22, y: 56 },
    rug: { x: 60, y: 88 },
    fake_plant: { x: 12, y: 70 },
    real_plant: { x: 12, y: 70 },
  },
  bedroom: {
    bed: { x: 32, y: 72 },
    wardrobe: { x: 12, y: 46 },
    desk: { x: 72, y: 66 },
    chair: { x: 68, y: 78 },
    monitor: { x: 72, y: 46 },
    keyboard: { x: 72, y: 60 },
    lighting: { x: 85, y: 45 },
    storage: { x: 88, y: 58 },
    rug: { x: 52, y: 88 },
    fake_plant: { x: 54, y: 66 },
  },
};

export function detectLayoutZoneFromPrompt(prompt: string): LayoutZonePreset {
  if (/ห้องนอน|เตียง|bed/i.test(prompt)) return "bedroom";
  if (/มุมซ้าย|ฝั่งซ้าย|หน้าต่างซ้าย|ชิดซ้าย|ปลั๊กไฟ.*ซ้าย|เต้ารับ.*ซ้าย/i.test(prompt)) return "window-left";
  if (/มุมขวา|ฝั่งขวา|หน้าต่างขวา|ชิดขวา|ริมหน้าต่าง|ปลั๊กไฟ.*ขวา|เต้ารับ.*ขวา/i.test(prompt)) return "window-right";
  return "center";
}

/** ตรวจจับว่าผู้ใช้ระบุหรือต้องการจัดโต๊ะตามตำแหน่งเต้ารับปลั๊กไฟหรือไม่ */
export function detectOutletAwareness(prompt: string): { requested: boolean; side: "left" | "right" | "center" } {
  const requested = /ปลั๊กไฟ|เต้ารับ|outlet|power/i.test(prompt);
  if (/ซ้าย|left/i.test(prompt) && requested) return { requested: true, side: "left" };
  if (/ขวา|right/i.test(prompt) && requested) return { requested: true, side: "right" };
  return { requested, side: "center" };
}

const clamp = (n: number) => Math.min(92, Math.max(8, Math.round(n)));

export function isSpot(v: unknown): v is Spot {
  const s = v as Spot;
  return !!s && Number.isFinite(s.x) && Number.isFinite(s.y);
}

/**
 * ดันจุดที่อยู่ใกล้กันเกินออกจากกันจนไม่ทับกัน (ขยับน้อยที่สุด ตามแกนที่ใกล้จะพ้นกว่า)
 * min = ระยะห่างขั้นต่ำเป็น % ของกว้าง/สูงภาพ
 */
export function spreadSpots(list: Spot[], min: Spot = { x: 6.5, y: 9 }): Spot[] {
  const s = list.map((p) => ({ x: p.x, y: p.y }));
  const lim = (n: number) => Math.min(95, Math.max(5, n));
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++) {
        const dx = s[j].x - s[i].x;
        const dy = s[j].y - s[i].y;
        if (Math.abs(dx) >= min.x || Math.abs(dy) >= min.y) continue;
        moved = true;
        const needX = (min.x - Math.abs(dx)) / min.x;
        const needY = (min.y - Math.abs(dy)) / min.y;
        if (needX <= needY) {
          const dir = dx > 0 || (dx === 0 && j % 2 === 0) ? 1 : -1;
          const push = (min.x - Math.abs(dx)) / 2 + 0.05;
          s[i].x = lim(s[i].x - dir * push);
          s[j].x = lim(s[j].x + dir * push);
        } else {
          const dir = dy > 0 || (dy === 0 && j % 2 === 0) ? 1 : -1;
          const push = (min.y - Math.abs(dy)) / 2 + 0.05;
          s[i].y = lim(s[i].y - dir * push);
          s[j].y = lim(s[j].y + dir * push);
        }
      }
    if (!moved) break;
  }
  return s.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
}

/**
 * จุดของสินค้าแต่ละชิ้น — ใช้ตำแหน่งจาก AI ถ้ามี ไม่งั้นเดาจากหมวด
 * แล้วขยับจุดที่ซ้อนกันออกจากกันให้แตะได้
 */
export function placeSpots(
  items: Array<{ id: string; category: string; spot?: Spot | null }>,
  zoneOrPrompt?: string
): Record<string, Spot> {
  const zone: LayoutZonePreset =
    zoneOrPrompt === "center" ||
    zoneOrPrompt === "window-left" ||
    zoneOrPrompt === "window-right" ||
    zoneOrPrompt === "bedroom"
      ? zoneOrPrompt
      : zoneOrPrompt
        ? detectLayoutZoneFromPrompt(zoneOrPrompt)
        : items.some((it) => it.category === "bed")
          ? "bedroom"
          : "center";
  const zoneMap = ZONE_SPOT_OVERRIDES[zone] ?? {};
  const base = items.map((it, i) => {
    const b =
      it.spot && isSpot(it.spot)
        ? it.spot
        : zoneMap[it.category] ??
          CATEGORY_SPOT[it.category] ?? { x: 20 + ((i * 23) % 60), y: 35 + ((i * 13) % 35) };
    return { x: clamp(b.x), y: clamp(b.y) };
  });
  const spread = spreadSpots(base);
  return Object.fromEntries(items.map((it, i) => [it.id, spread[i]]));
}

/** หมวดสินค้า → ชื่อวัตถุที่ตัวตรวจจับ (COCO) รู้จัก */
export const DETECT_LABELS: Record<string, string[]> = {
  bed: ["bed"],
  chair: ["chair"],
  desk: ["dining table", "desk"],
  monitor: ["tv", "laptop", "monitor"],
  computer: ["laptop", "tv"],
  keyboard: ["keyboard"],
  mouse: ["mouse"],
  real_plant: ["potted plant"],
  fake_plant: ["potted plant"],
  plant_pot: ["potted plant", "vase"],
  decor: ["vase", "clock", "book", "teddy bear"],
  storage: ["book"],
  speaker: ["remote"],
};

export interface Detection {
  label: string;
  score: number;
  /** กล่องเป็นสัดส่วน 0..1 */
  box: { x0: number; y0: number; x1: number; y1: number };
}

/** วางจุดลงบนวัตถุที่ตรวจเจอจริงในภาพ (ตัวละ 1 ชิ้น เลือกกล่องคะแนนสูงสุด) · ไม่เจอ = ใช้ตำแหน่งเดิม */
export function snapSpotsToDetections(
  items: Array<{ id: string; category: string }>,
  base: Record<string, Spot>,
  dets: Detection[]
): Record<string, Spot> {
  const used = new Set<number>();
  const out: Record<string, Spot> = {};
  const order = [...items].sort((a, b) => (DETECT_LABELS[a.category] ? 0 : 1) - (DETECT_LABELS[b.category] ? 0 : 1));
  for (const it of order) {
    const labels = DETECT_LABELS[it.category];
    let best = -1;
    // ไล่ตามลำดับชื่อที่ต้องการ (เช่น จอ → tv ก่อน laptop) แล้วเลือกคะแนนสูงสุด
    for (const label of labels ?? []) {
      dets.forEach((d, i) => {
        if (used.has(i) || d.score < 0.6 || d.label !== label) return;
        if (best < 0 || d.score > dets[best].score) best = i;
      });
      if (best >= 0) break;
    }
    if (best >= 0) {
      used.add(best);
      const b = dets[best].box;
      out[it.id] = { x: ((b.x0 + b.x1) / 2) * 100, y: (b.y0 + (b.y1 - b.y0) * 0.45) * 100 };
    } else if (base[it.id]) out[it.id] = base[it.id];
  }
  const ids = items.map((i) => i.id).filter((id) => out[id]);
  const spread = spreadSpots(ids.map((id) => out[id]));
  return Object.fromEntries(ids.map((id, i) => [id, spread[i]]));
}
