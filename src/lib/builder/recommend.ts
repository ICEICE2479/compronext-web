import { PC_PARTS } from "./parts";
import { calculateBuildTotals, evaluateBuilderCompatibility, resolveBuildSelection } from "./compat";
import { estimateAllGamesFps, type FpsResolution } from "./fps";
import type { BuildSelection, PcPart } from "./types";

export interface RecommendInput {
  budget: number;
  games: string[];
  resolution: FpsResolution;
}
export interface RecommendResult {
  selection: BuildSelection;
  total: number;
  avgFps: number;
  minFps: number;
}

const bySlot = (slot: PcPart["slot"]) => PC_PARTS.filter((p) => p.slot === slot).sort((a, b) => a.price - b.price);
const fails = (sel: BuildSelection) => evaluateBuilderCompatibility(resolveBuildSelection(sel)).filter((i) => i.status === "fail").length;

/**
 * จัดสเปกอัตโนมัติจากงบ + เกมที่เล่น
 * ลองทุกคู่ ซีพียู × การ์ดจอ แล้วเติมชิ้นที่เหลือด้วยตัวที่ถูกที่สุดที่ "เข้ากันได้" (เช็กด้วยกฎเดียวกับหน้าจัดสเปก)
 * เลือกชุดที่ FPS เฉลี่ยของเกมที่เลือกสูงสุดภายในงบ (FPS ใกล้กัน ≤3% → เอาตัวถูกกว่า)
 */
export function recommendBuild({ budget, games, resolution }: RecommendInput): RecommendResult | null {
  const ramTarget = budget >= 45000 ? 32 : 16;
  const ssdTarget = budget >= 60000 ? 2000 : 1000;
  const fill = (base: BuildSelection): BuildSelection | null => {
    const sel = { ...base };
    const order: Array<[PcPart["slot"], (p: PcPart) => boolean]> = [
      ["motherboard", () => true],
      ["ram", (p) => (p.specs.capacityGb ?? 0) * (p.specs.modules ?? 1) >= ramTarget || (p.specs.capacityGb ?? 0) >= ramTarget],
      ["storage", (p) => (p.specs.storageGb ?? 0) >= ssdTarget],
      ["cooler", () => true],
      ["case", () => true],
      ["psu", () => true],
    ];
    for (const [slot, want] of order) {
      const list = bySlot(slot);
      const pick = list.filter(want).find((p) => fails({ ...sel, [slot]: p.id }) === 0) ?? list.find((p) => fails({ ...sel, [slot]: p.id }) === 0);
      if (!pick) return null;
      (sel as Record<string, string | undefined>)[slot] = pick.id;
    }
    return sel;
  };

  const gpus: Array<PcPart | null> = [null, ...bySlot("gpu")];
  let best: RecommendResult | null = null;
  for (const cpu of bySlot("cpu")) {
    for (const gpu of gpus) {
      if (!gpu && !cpu.specs.hasIgpu) continue;
      if (cpu.price + (gpu?.price ?? 0) > budget * 0.75) continue;
      const sel = fill(gpu ? { cpu: cpu.id, gpu: gpu.id } : { cpu: cpu.id });
      if (!sel || fails(sel) > 0) continue;
      const resolved = resolveBuildSelection(sel);
      const total = calculateBuildTotals(resolved).pcOnlyPrice;
      if (total > budget) continue;
      const fps = estimateAllGamesFps(resolved, resolution, "high", true);
      const picked = fps.results.filter((r) => !games.length || games.includes(r.game.id));
      if (!picked.length) continue;
      const avgFps = Math.round(picked.reduce((s, r) => s + r.avgFps, 0) / picked.length);
      const minFps = Math.min(...picked.map((r) => r.avgFps));
      const better = !best || avgFps > best.avgFps * 1.03 || (avgFps >= best.avgFps * 0.97 && total < best.total);
      if (better) best = { selection: sel, total, avgFps, minFps };
    }
  }
  return best;
}
