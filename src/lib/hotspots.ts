/** ตำแหน่งจุดแตะบนภาพห้อง (หน่วย % ของกว้าง/สูงภาพ) */
export interface Spot {
  x: number;
  y: number;
}

// ตำแหน่งที่ของแต่ละหมวดมักอยู่ในภาพห้อง (มุมกล้องระดับสายตา)
const CATEGORY_SPOT: Record<string, Spot> = {
  desk: { x: 50, y: 66 },
  chair: { x: 36, y: 78 },
  monitor: { x: 50, y: 44 },
  monitor_arm: { x: 58, y: 40 },
  keyboard: { x: 48, y: 60 },
  mouse: { x: 60, y: 61 },
  mousepad: { x: 54, y: 63 },
  speaker: { x: 30, y: 50 },
  headphone: { x: 66, y: 55 },
  lighting: { x: 72, y: 28 },
  storage: { x: 86, y: 56 },
  wardrobe: { x: 12, y: 42 },
  bed: { x: 50, y: 72 },
  rug: { x: 50, y: 90 },
  decor: { x: 76, y: 50 },
  fake_plant: { x: 90, y: 70 },
  real_plant: { x: 90, y: 70 },
  plant_pot: { x: 88, y: 76 },
};

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
export function placeSpots(items: Array<{ id: string; category: string; spot?: Spot | null }>): Record<string, Spot> {
  const base = items.map((it, i) => {
    const b = it.spot && isSpot(it.spot) ? it.spot : CATEGORY_SPOT[it.category] ?? { x: 20 + ((i * 23) % 60), y: 35 + ((i * 13) % 35) };
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
