import { PC_PARTS } from "./parts";
import { evaluateBuilderCompatibility, resolveBuildSelection } from "./compat";
import { estimateAllGamesFps, type FpsResolution } from "./fps";
import type { BuildSelection, PcPart } from "./types";

export interface UpgradeOption {
  /** ชิ้นที่เปลี่ยน (อาจมีพาวเวอร์ติดมาด้วยถ้าไฟไม่พอ) */
  changes: Array<{ slot: PcPart["slot"]; from: PcPart | null; to: PcPart }>;
  cost: number;
  fpsBefore: number;
  fpsAfter: number;
  /** % FPS ที่เพิ่ม */
  gainPct: number;
  /** % ที่เพิ่มต่อเงิน 1,000 บาท — ใช้จัดอันดับความคุ้ม */
  valuePer1k: number;
  note?: string;
}

export interface UpgradeReport {
  ready: boolean;
  reason?: string;
  fpsNow: number;
  bottleneck: "CPU" | "GPU" | null;
  options: UpgradeOption[];
  /** แนะนำเพิ่มที่ไม่เกี่ยวกับ FPS (แรมน้อย / SSD เล็ก) */
  extras: UpgradeOption[];
}

const fails = (sel: BuildSelection) =>
  evaluateBuilderCompatibility(resolveBuildSelection(sel)).filter((i) => i.status === "fail").length;

function avgFps(sel: BuildSelection, res: FpsResolution) {
  const r = estimateAllGamesFps(resolveBuildSelection(sel), res, "high", true);
  if (!r.ready || !r.results.length) return null;
  const n = r.results.length;
  const cpuBound = r.results.filter((x) => x.bottleneck === "CPU").length;
  return { fps: r.results.reduce((s, x) => s + x.avgFps, 0) / n, bottleneck: cpuBound > n / 2 ? ("CPU" as const) : ("GPU" as const) };
}

const byId = (id?: string) => (id ? PC_PARTS.find((p) => p.id === id) ?? null : null);

/**
 * เช็กว่าเครื่องเดิมอัปเกรดอะไรได้ (ไม่ต้องเปลี่ยนเมนบอร์ด)
 * ลองเปลี่ยนซีพียู (ซ็อกเก็ตเดิม) และการ์ดจอทีละชิ้น ถ้าพาวเวอร์ไม่พอจะจับคู่พาวเวอร์ที่ถูกที่สุดที่พอให้
 * จัดอันดับด้วย FPS ที่เพิ่มต่อเงินที่จ่าย
 */
export function suggestUpgrades(current: BuildSelection, resolution: FpsResolution, budget?: number): UpgradeReport {
  const empty = { fpsNow: 0, bottleneck: null, options: [], extras: [] };
  if (!current.cpu || !current.motherboard) return { ready: false, reason: "เลือกซีพียูกับเมนบอร์ดที่มีอยู่ก่อน", ...empty };
  if (fails(current) > 0) return { ready: false, reason: "ชิ้นที่เลือกตอนนี้ใส่ด้วยกันไม่ได้ เช็กเครื่องเดิมอีกครั้ง", ...empty };
  const base = avgFps(current, resolution);
  if (!base) return { ready: false, reason: "ซีพียูนี้ไม่มีกราฟิกในตัว เลือกการ์ดจอที่ใช้อยู่ด้วย", ...empty };

  const psus = PC_PARTS.filter((p) => p.slot === "psu").sort((a, b) => a.price - b.price);
  const options: UpgradeOption[] = [];

  for (const slot of ["cpu", "gpu"] as const) {
    const now = byId(current[slot]);
    for (const cand of PC_PARTS) {
      if (cand.slot !== slot || cand.id === now?.id) continue;
      let sel: BuildSelection = { ...current, [slot]: cand.id };
      const changes: UpgradeOption["changes"] = [{ slot, from: now, to: cand }];
      let note: string | undefined;
      if (fails(sel) > 0) {
        // ลองเพิ่มพาวเวอร์ (ปัญหาที่พบบ่อยตอนอัปการ์ดจอ)
        const psu = current.psu ? psus.find((p) => p.id !== current.psu && fails({ ...sel, psu: p.id }) === 0) : undefined;
        if (!psu) continue;
        sel = { ...sel, psu: psu.id };
        changes.push({ slot: "psu", from: byId(current.psu), to: psu });
        note = "ไฟไม่พอ ต้องเปลี่ยนพาวเวอร์ด้วย";
      }
      const after = avgFps(sel, resolution);
      if (!after) continue;
      const gainPct = ((after.fps - base.fps) / base.fps) * 100;
      if (gainPct < 5) continue;
      const cost = changes.reduce((s, c) => s + c.to.price, 0);
      if (budget && cost > budget) continue;
      options.push({
        changes,
        cost,
        fpsBefore: Math.round(base.fps),
        fpsAfter: Math.round(after.fps),
        gainPct: Math.round(gainPct),
        valuePer1k: Math.round((gainPct / (cost / 1000)) * 10) / 10,
        note,
      });
    }
  }

  // คู่ ซีพียู + การ์ดจอ (เครื่องที่ติดคอขวดทั้งสองฝั่ง)
  const top = (slot: "cpu" | "gpu") =>
    options.filter((o) => o.changes[0].slot === slot).sort((a, b) => b.valuePer1k - a.valuePer1k).slice(0, 3);
  for (const c of top("cpu"))
    for (const g of top("gpu")) {
      const changes = [...c.changes, ...g.changes];
      const sel: BuildSelection = { ...current };
      for (const ch of changes) (sel as Record<string, string>)[ch.slot] = ch.to.id;
      if (fails(sel) > 0) continue;
      const after = avgFps(sel, resolution);
      if (!after) continue;
      const gainPct = ((after.fps - base.fps) / base.fps) * 100;
      const cost = changes.reduce((s, x) => s + x.to.price, 0);
      if (budget && cost > budget) continue;
      if (gainPct < Math.max(c.gainPct, g.gainPct) + 5) continue;
      options.push({
        changes,
        cost,
        fpsBefore: Math.round(base.fps),
        fpsAfter: Math.round(after.fps),
        gainPct: Math.round(gainPct),
        valuePer1k: Math.round((gainPct / (cost / 1000)) * 10) / 10,
        note: [c.note, g.note].filter(Boolean)[0] ?? "เปลี่ยนคู่กันแรงขึ้นกว่าเปลี่ยนทีละชิ้น",
      });
    }

  // คุ้มสุดก่อน แล้วตัดตัวที่แพงกว่าแต่แรงไม่มากกว่าทิ้ง
  options.sort((a, b) => b.valuePer1k - a.valuePer1k);
  const kept = options.filter(
    (o) => !options.some((x) => x !== o && x.cost <= o.cost && x.gainPct >= o.gainPct && (x.cost < o.cost || x.gainPct > o.gainPct))
  );

  const extras: UpgradeOption[] = [];
  const ram = byId(current.ram);
  const board = byId(current.motherboard);
  const totalRam = (ram?.specs.capacityGb ?? 0);
  if (board && totalRam < 32) {
    const better = PC_PARTS.filter(
      (p) => p.slot === "ram" && (p.specs.capacityGb ?? 0) > totalRam && fails({ ...current, ram: p.id }) === 0
    ).sort((a, b) => a.price - b.price)[0];
    if (better && (!budget || better.price <= budget))
      extras.push({
        changes: [{ slot: "ram", from: ram, to: better }],
        cost: better.price,
        fpsBefore: 0,
        fpsAfter: 0,
        gainPct: 0,
        valuePer1k: 0,
        note: totalRam < 16 ? "แรมน้อยกว่า 16GB เกมใหม่จะกระตุก" : "32GB เปิดเกมพร้อมสตรีม/เบราว์เซอร์ได้สบาย",
      });
  }
  const ssd = byId(current.storage);
  if ((ssd?.specs.storageGb ?? 0) < 1000) {
    const better = PC_PARTS.filter((p) => p.slot === "storage" && (p.specs.storageGb ?? 0) >= 1000 && fails({ ...current, storage: p.id }) === 0)
      .sort((a, b) => a.price - b.price)[0];
    if (better && (!budget || better.price <= budget))
      extras.push({
        changes: [{ slot: "storage", from: ssd, to: better }],
        cost: better.price,
        fpsBefore: 0,
        fpsAfter: 0,
        gainPct: 0,
        valuePer1k: 0,
        note: ssd ? "ที่เก็บน้อยกว่า 1TB เกมใหม่ลงได้ไม่กี่เกม" : "ยังไม่มี SSD — โหลดเกมเร็วขึ้นมาก",
      });
  }

  return { ready: true, fpsNow: Math.round(base.fps), bottleneck: base.bottleneck, options: kept.slice(0, 5), extras };
}
