import { calculateBuildTotals, evaluateBuilderCompatibility, resolveBuildSelection, type BuilderCompatIssue } from "./compat";
import { estimateAllGamesFps, type FpsResolution } from "./fps";
import { PC_PARTS } from "./parts";
import { recommendBuild, type RecommendResult } from "./recommend";
import type { BuildSelection, BuilderSlot, MonitorSpec, PcPart } from "./types";

const isPart = (x: PcPart | MonitorSpec): x is PcPart => "slot" in x;

/** บรรทัด “เหมาะกับ…” สร้างจากสเปกจริงเท่านั้น — ข้อมูลไม่ครบ = null */
export function goodForLine(part: PcPart | MonitorSpec): string | null {
  if (!isPart(part)) {
    const { sizeInch, refreshHz, resolution } = part;
    if (!sizeInch || !refreshHz || !resolution?.short) return null;
    const use = refreshHz >= 240 ? "เกมแข่งขัน" : refreshHz >= 144 ? "เกมทั่วไป" : "งานทั่วไป";
    return `${resolution.short} ${refreshHz}Hz เหมาะกับ${use}`;
  }
  const s = part.specs;
  switch (part.slot) {
    case "cpu":
      if (s.hasIgpu === false) return "ไม่มีกราฟิกในตัว ต้องมีการ์ดจอแยก";
      if (s.hasIgpu === true) return "มีกราฟิกในตัว ใช้เรียน/งานเอกสารได้โดยไม่ต้องมีการ์ดจอแยก";
      return null;
    case "gpu": {
      if (s.gpuScore == null || s.vramGb == null) return null;
      if (s.gpuScore >= 180 && s.vramGb >= 16) return `พลังชิปสูง + VRAM ${s.vramGb}GB เหมาะกับเกม 1440p–4K งานตัดต่อ 3D และ AI`;
      if (s.gpuScore >= 130 && s.vramGb >= 12) return `VRAM ${s.vramGb}GB สบายที่เกม 1080p และ 1440p`;
      return `VRAM ${s.vramGb}GB พอสำหรับเกม 1080p (เกมใหม่ๆ เริ่มตึง)`;
    }
    case "motherboard":
      return s.formFactor && s.ramType ? `บอร์ดขนาด ${s.formFactor} ใช้แรม ${s.formFactor === "ITX" ? "2 สล็อต " : ""}${s.ramType}` : null;
    case "ram":
      return s.modules != null && s.modules >= 2 && s.ramType ? `${s.ramType} ใส่ ${s.modules} แถว (Dual Channel) เร็วกว่าแถวเดียว` : null;
    case "storage":
      if (s.storageGb == null || !s.interface) return null;
      return s.interface === "SATA" ? "SSD SATA เหมาะใช้เพิ่มพื้นที่เก็บข้อมูล" : `${s.interface} ใช้เป็นไดรฟ์หลัก (Windows + เกม) ได้`;
    case "psu": {
      if (s.wattage == null || !s.efficiency) return null;
      const e = s.efficiency.toLowerCase();
      if (/gold|platinum|titanium/.test(e)) return "ประสิทธิภาพสูง ประหยัดไฟ ร้อนน้อย";
      if (/bronze/.test(e)) return "ระดับพอใช้ เหมาะกับเครื่องไม่แรงมาก";
      return null;
    }
    case "case": {
      const label = { itx: "เล็ก ประหยัดพื้นที่", matx: "ขนาดกลาง", mid: "Mid Tower ขนาดมาตรฐาน", full: "Full Tower ขนาดใหญ่มาก" } as const;
      return s.caseSizeClass ? label[s.caseSizeClass] : null;
    }
    case "cooler":
      if (s.coolerType === "air") return "ซิงก์ลม คุ้ม เงียบ ทนทาน (เช็กความสูงกับเคส)";
      if (s.coolerType === "aio" && s.radiatorMm != null) return `ชุดน้ำปิด ${s.radiatorMm} มม. ต้องมีที่ติดหม้อน้ำในเคส`;
      return null;
    default:
      return null;
  }
}

export interface IssueHelp {
  why: string;
  fix: string;
}

const HELP: Record<string, IssueHelp> = {
  socket: {
    why: "ซ็อกเก็ตคือช่องเสียบซีพียู ต้องตรงกับเมนบอร์ดเท่านั้น ไม่งั้นเสียบไม่ได้",
    fix: "เปลี่ยนซีพียูหรือเมนบอร์ดให้ซ็อกเก็ตตรงกัน",
  },
  ram: {
    why: "DDR4 กับ DDR5 ใส่สลับกันไม่ได้ และจำนวนแถวแรมต้องไม่เกินสล็อตบนเมนบอร์ด",
    fix: "เลือกแรมชนิดเดียวกับที่เมนบอร์ดรองรับ และจำนวนแถวไม่เกินสล็อต",
  },
  "case-board": {
    why: "เมนบอร์ดต้องมีขนาดที่เคสรองรับ (ATX / Micro-ATX / Mini-ITX)",
    fix: "เปลี่ยนเคสให้รองรับขนาดเมนบอร์ด หรือเปลี่ยนเมนบอร์ดให้เล็กลง",
  },
  "gpu-signal": {
    why: "การ์ดจอต้องสั้นกว่าที่เคสรองรับ และซีพียูที่ไม่มีกราฟิกในตัว (ตัว F) ต้องมีการ์ดจอแยก ไม่งั้นจอไม่ขึ้นภาพ",
    fix: "เลือกการ์ดจอที่สั้นลงหรือเคสที่ใหญ่ขึ้น และเพิ่มการ์ดจอแยกถ้าซีพียูไม่มีกราฟิกในตัว",
  },
  "cooler-case": {
    why: "ซิงก์ลมต้องเตี้ยกว่าที่เคสรองรับ และชุดน้ำปิด (AIO) ต้องมีที่ติดหม้อน้ำขนาดนั้นในเคส",
    fix: "เปลี่ยนเป็นซิงก์ที่เตี้ยลง ชุดน้ำปิดขนาดที่เคสรองรับ หรือเปลี่ยนเคส",
  },
  psu: {
    why: "พาวเวอร์ต้องจ่ายไฟพอ (คำนวณแล้วเผื่อ 30%) และมีขนาดที่เคสรองรับ ถ้าไม่พอเครื่องอาจดับหรือพัง",
    fix: "เลือกพาวเวอร์วัตต์สูงขึ้นตามที่แนะนำ และขนาดที่เคสรองรับ",
  },
};

const WHY_FALLBACK: Record<string, IssueHelp> = {
  "gpu-signal-igpu": {
    why: "ซีพียูตัวนี้ไม่มีกราฟิกในตัว (ตัว F) ถ้าไม่มีการ์ดจอแยก เปิดเครื่องแล้วจอไม่ขึ้นภาพ",
    fix: "เลือกการ์ดจอแยก หรือเปลี่ยนเป็นซีพียูที่มีกราฟิกในตัว",
  },
};

export function explainIssue(issue: BuilderCompatIssue): IssueHelp | null {
  if (issue.status === "pass") return null;
  if (issue.id === "gpu-signal" && issue.status === "fail" && issue.title.includes("สัญญาณภาพ")) {
    return WHY_FALLBACK["gpu-signal-igpu"];
  }
  const h = HELP[issue.id];
  if (!h) return null;
  if (issue.status === "insufficient") {
    return { why: "ยังเลือกชิ้นส่วนไม่ครบ จึงตรวจข้อนี้ไม่ได้", fix: "เลือกชิ้นส่วนที่เกี่ยวข้องให้ครบ" };
  }
  return h;
}

export type BeginnerUsage = "study" | "esports" | "aaa1080" | "aaa1440" | "creator";

export const BEGINNER_USAGES: Array<{ id: BeginnerUsage; label: string; hint: string }> = [
  { id: "study", label: "เรียน / งานเอกสาร / ดูหนัง", hint: "ใช้กราฟิกในซีพียู ไม่ต้องมีการ์ดจอแยก" },
  { id: "esports", label: "เกม e-sports", hint: "Valorant, CS2, Dota 2 เน้นซีพียูดีและจอรีเฟรชสูง" },
  { id: "aaa1080", label: "เกม AAA 1080p", hint: "เน้นการ์ดจอระดับกลาง" },
  { id: "aaa1440", label: "เกม AAA 1440p", hint: "เน้นการ์ดจอกลางค่อนบน" },
  { id: "creator", label: "ตัดต่อ / 3D / AI", hint: "เน้นซีพียูหลายคอร์ แรมเยอะ และการ์ดจอ VRAM มาก" },
];

const USAGE_INPUT: Record<BeginnerUsage, { games: string[]; resolution: FpsResolution }> = {
  study: { games: ["valorant", "dota2"], resolution: "1080p" },
  esports: { games: ["valorant", "cs2", "dota2", "apex"], resolution: "1080p" },
  aaa1080: { games: ["cyberpunk", "eldenring", "forza5", "wukong"], resolution: "1080p" },
  aaa1440: { games: ["cyberpunk", "eldenring", "forza5", "wukong"], resolution: "1440p" },
  creator: { games: ["cyberpunk", "forza5"], resolution: "1440p" },
};

const failCount = (sel: BuildSelection) =>
  evaluateBuilderCompatibility(resolveBuildSelection(sel)).filter((i) => i.status === "fail").length;

/** study: เอาการ์ดจอแยกออก แล้วใช้ซีพียูที่มี iGPU (ถูกสุดที่เข้ากับเมนบอร์ด) */
function withoutDgpu(r: RecommendResult, budget: number): RecommendResult | null {
  const sel: BuildSelection = { ...r.selection };
  delete sel.gpu;
  const cpus = PC_PARTS.filter((p) => p.slot === "cpu" && p.specs.hasIgpu === true).sort((a, b) => a.price - b.price);
  const current = PC_PARTS.find((p) => p.id === sel.cpu);
  const candidates = current?.specs.hasIgpu === true ? [current] : cpus;
  for (const cpu of candidates) {
    const next = { ...sel, cpu: cpu.id };
    if (failCount(next) > 0) continue;
    const resolved = resolveBuildSelection(next);
    const total = calculateBuildTotals(resolved).pcOnlyPrice;
    if (total > budget) continue;
    const fps = estimateAllGamesFps(resolved, "1080p", "high", true).results.filter((x) => USAGE_INPUT.study.games.includes(x.game.id));
    if (!fps.length) continue;
    return {
      selection: next,
      total,
      avgFps: Math.round(fps.reduce((s, x) => s + x.avgFps, 0) / fps.length),
      minFps: Math.min(...fps.map((x) => x.avgFps)),
    };
  }
  return null;
}

function parseCpuCores(spec?: string): number {
  if (!spec) return 6;
  const side = spec.split("/")[0] ?? spec;
  const nums = side.match(/\d+/g)?.map(Number) ?? [];
  return nums.reduce((a, b) => a + b, 0) || 6;
}

/** creator: เน้นซีพียูหลายคอร์ แรม 32–64GB และการ์ดจอ VRAM สูงภายในงบ */
function forCreator(budget: number): RecommendResult | null {
  const bySlot = (slot: PcPart["slot"]) => PC_PARTS.filter((p) => p.slot === slot).sort((a, b) => a.price - b.price);
  const ramTarget = budget >= 75000 ? 64 : 32;
  const ssdTarget = budget >= 50000 ? 2000 : 1000;

  const fill = (base: BuildSelection): BuildSelection | null => {
    const sel = { ...base };
    const order: Array<[PcPart["slot"], (p: PcPart) => boolean]> = [
      ["motherboard", () => true],
      ["ram", (p) => (p.specs.capacityGb ?? 0) >= ramTarget && (p.specs.modules ?? 1) >= 2],
      ["storage", (p) => (p.specs.storageGb ?? 0) >= ssdTarget && p.specs.interface !== "SATA"],
      ["cooler", () => true],
      ["case", () => true],
      ["psu", () => true],
    ];
    for (const [slot, want] of order) {
      const list = bySlot(slot);
      const pick = list.filter(want).find((p) => failCount({ ...sel, [slot]: p.id }) === 0) ?? list.find((p) => failCount({ ...sel, [slot]: p.id }) === 0);
      if (!pick) return null;
      (sel as Record<string, string | undefined>)[slot] = pick.id;
    }
    return sel;
  };

  let best: (RecommendResult & { creatorScore: number }) | null = null;
  for (const cpu of bySlot("cpu")) {
    for (const gpu of bySlot("gpu")) {
      if (cpu.price + gpu.price > budget * 0.78) continue;
      const sel = fill({ cpu: cpu.id, gpu: gpu.id });
      if (!sel || failCount(sel) > 0) continue;
      const resolved = resolveBuildSelection(sel);
      const total = calculateBuildTotals(resolved).pcOnlyPrice;
      if (total > budget) continue;
      const fps = estimateAllGamesFps(resolved, "1440p", "high", true);
      const picked = fps.results.filter((r) => USAGE_INPUT.creator.games.includes(r.game.id));
      if (!picked.length) continue;
      const avgFps = Math.round(picked.reduce((s, r) => s + r.avgFps, 0) / picked.length);
      const minFps = Math.min(...picked.map((r) => r.avgFps));
      const cores = parseCpuCores(cpu.specs.cores);
      const vram = gpu.specs.vramGb ?? 8;
      const ramGb = resolved.ram?.specs.capacityGb ?? 16;
      const creatorScore = cores * 8 + vram * 7 + (gpu.specs.gpuScore ?? 100) + (ramGb >= 32 ? 40 : 0) + (ramGb >= 64 ? 25 : 0);
      const better =
        !best ||
        creatorScore > best.creatorScore * 1.03 ||
        (creatorScore >= best.creatorScore * 0.97 && total < best.total);
      if (better) best = { selection: sel, total, avgFps, minFps, creatorScore };
    }
  }
  return best ? { selection: best.selection, total: best.total, avgFps: best.avgFps, minFps: best.minFps } : null;
}

export function beginnerRecommend(
  usage: BeginnerUsage,
  budget: number,
): { result: RecommendResult | null; reasons: Partial<Record<BuilderSlot, string>> } {
  const input = USAGE_INPUT[usage];
  let result =
    usage === "creator"
      ? forCreator(budget) ?? recommendBuild({ budget, games: input.games, resolution: input.resolution })
      : recommendBuild({ budget, games: input.games, resolution: input.resolution });
  if (result && usage === "study") result = withoutDgpu(result, budget) ?? result;
  if (!result) return { result: null, reasons: {} };

  const b = resolveBuildSelection(result.selection);
  const reasons: Partial<Record<BuilderSlot, string>> = {};

  if (b.cpu) {
    const cores = b.cpu.specs.cores;
    reasons.cpu =
      usage === "study" && b.cpu.specs.hasIgpu
        ? "มีกราฟิกในตัว ไม่ต้องจ่ายค่าการ์ดจอแยกสำหรับงานเรียน/เอกสาร"
        : usage === "creator"
          ? cores ? `${cores} งานตัดต่อ/เรนเดอร์ยิ่งคอร์เยอะยิ่งไว` : "งานตัดต่อ/เรนเดอร์ยิ่งคอร์เยอะยิ่งไว"
          : cores ? `${cores} เกมส่วนใหญ่ใช้ 6–8 คอร์ก็พอ` : "ซีพียูที่เข้ากับงบและเมนบอร์ดที่เลือก";
  }
  if (b.gpu) {
    const v = b.gpu.specs.vramGb;
    reasons.gpu =
      usage === "esports"
        ? "เกม e-sports ไม่ต้องใช้การ์ดจอระดับท็อป"
        : usage === "creator" && v != null
          ? `VRAM ${v}GB ช่วยเร่งงานเรนเดอร์ 3D, ตัดต่อวิดีโอความละเอียดสูง และ AI`
          : v != null
            ? `VRAM ${v}GB เหมาะกับเกมความละเอียด ${input.resolution}`
            : `การ์ดจอที่ให้ FPS ดีที่สุดในงบสำหรับ ${input.resolution}`;
  } else {
    reasons.gpu = "ไม่ต้องมีการ์ดจอแยก ใช้กราฟิกในซีพียู";
  }
  if (b.ram) {
    const t = b.ram.specs.ramType;
    const cap = b.ram.specs.capacityGb;
    reasons.ram =
      usage === "creator" && cap
        ? `${cap}GB (${t ?? "RAM"}) ความจุสูงสำหรับงานตัดต่อ เรนเดอร์ และเปิดหลายโปรแกรมพร้อมกัน`
        : t
          ? `${t} ตรงกับเมนบอร์ด ใส่ 2 แถวเมื่อมีให้เลือก`
          : "ความจุเหมาะกับงบ";
  }
  if (b.storage?.specs.interface && b.storage.specs.interface !== "SATA") {
    reasons.storage = `${b.storage.specs.interface} ใช้เป็นไดรฟ์หลักได้`;
  }
  if (b.motherboard?.specs.socket) reasons.motherboard = `ซ็อกเก็ต ${b.motherboard.specs.socket} ตรงกับซีพียู`;
  if (b.psu?.specs.wattage != null) {
    const watts = calculateBuildTotals(b).estimatedWatts;
    reasons.psu = `${b.psu.specs.wattage}W มากกว่าโหลดประมาณ ${watts}W เผื่อไว้ตามสูตรของเว็บ`;
  }
  if (b.case) reasons.case = "เข้ากับเมนบอร์ดและการ์ดจอที่เลือก";
  if (b.cooler) reasons.cooler = "รองรับซีพียูและใส่ในเคสได้";
  return { result, reasons };
}
