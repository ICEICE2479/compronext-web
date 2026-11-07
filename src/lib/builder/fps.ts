import type { ResolvedBuild } from "./compat";

export type FpsResolution = "1080p" | "1440p" | "4K";
export type FpsQuality = "medium" | "high" | "ultra";

export interface GameBenchmarkProfile {
  id: string;
  title: string;
  genre: string;
  /** FPS อ้างอิงที่ 1080p High บน RTX 4060 (gpuScore=100) + Ryzen 5 7600 (cpuScore=100) */
  base1080pHigh: number;
  /** เพดาน FPS ฝั่ง CPU บน Ryzen 5 7600 (cpuScore=100) */
  cpuCapAt100: number;
  /** ความต้องการ VRAM ขั้นแนะนำที่ 1440p/4K (GB) */
  recommendedVramGb: number;
}

export const GAME_BENCHMARKS: GameBenchmarkProfile[] = [
  { id: "valorant", title: "VALORANT", genre: "Competitive FPS", base1080pHigh: 360, cpuCapAt100: 390, recommendedVramGb: 4 },
  { id: "cs2", title: "Counter-Strike 2", genre: "Tactical Shooter", base1080pHigh: 215, cpuCapAt100: 250, recommendedVramGb: 6 },
  { id: "apex", title: "Apex Legends", genre: "Battle Royale", base1080pHigh: 165, cpuCapAt100: 220, recommendedVramGb: 8 },
  { id: "pubg", title: "PUBG: Battlegrounds", genre: "Battle Royale", base1080pHigh: 140, cpuCapAt100: 185, recommendedVramGb: 8 },
  { id: "dota2", title: "Dota 2 / League of Legends", genre: "MOBA", base1080pHigh: 210, cpuCapAt100: 230, recommendedVramGb: 4 },
  { id: "gtav", title: "Grand Theft Auto V (Enhanced)", genre: "Open World", base1080pHigh: 135, cpuCapAt100: 175, recommendedVramGb: 8 },
  { id: "forza5", title: "Forza Horizon 5", genre: "Racing", base1080pHigh: 118, cpuCapAt100: 175, recommendedVramGb: 8 },
  { id: "eldenring", title: "Elden Ring", genre: "Action RPG", base1080pHigh: 92, cpuCapAt100: 130, recommendedVramGb: 8 },
  { id: "cyberpunk", title: "Cyberpunk 2077", genre: "AAA Open World", base1080pHigh: 78, cpuCapAt100: 135, recommendedVramGb: 12 },
  { id: "wukong", title: "Black Myth: Wukong", genre: "AAA Action", base1080pHigh: 68, cpuCapAt100: 125, recommendedVramGb: 12 },
];

const RES_MULTIPLIER: Record<FpsResolution, number> = {
  "1080p": 1.0,
  "1440p": 0.72,
  "4K": 0.43,
};

const QUALITY_MULTIPLIER: Record<FpsQuality, number> = {
  medium: 1.24,
  high: 1.0,
  ultra: 0.78,
};

export interface GameFpsEstimate {
  game: GameBenchmarkProfile;
  avgFps: number;
  low1PercentFps: number;
  bottleneck: "GPU" | "CPU";
  vramWarning: boolean;
}

export function estimateAllGamesFps(
  build: ResolvedBuild,
  resolution: FpsResolution,
  quality: FpsQuality,
  upscalingQuality: boolean
): {
  ready: boolean;
  reason?: string;
  results: GameFpsEstimate[];
} {
  if (!build.cpu) {
    return { ready: false, reason: "กรุณาเลือกซีพียูและการ์ดจอเพื่อคำนวณ FPS", results: [] };
  }

  const hasDiscreteGpu = Boolean(build.gpu);
  if (!hasDiscreteGpu && !build.cpu.specs.hasIgpu) {
    return {
      ready: false,
      reason: "ซีพียูรุ่นนี้ไม่มีกราฟิกในตัว (No iGPU) กรุณาเลือกการ์ดจอแยกเพื่อจำลอง FPS",
      results: [],
    };
  }

  const gpuScore = build.gpu?.specs.gpuScore ?? 18; // iGPU fallback score
  const vramGb = build.gpu?.specs.vramGb ?? 2;
  const cpuScore = build.cpu.specs.cpuGamingScore ?? 90;
  const ramGb = build.ram?.specs.capacityGb ?? 16;

  const resMult = RES_MULTIPLIER[resolution];
  const qualMult = QUALITY_MULTIPLIER[quality];
  const upscaleMult = upscalingQuality && hasDiscreteGpu ? 1.28 : 1.0;
  const ramPenalty = ramGb < 16 ? 0.85 : 1.0;

  const results: GameFpsEstimate[] = GAME_BENCHMARKS.map((game) => {
    const neededVram =
      resolution === "4K"
        ? game.recommendedVramGb + 4
        : resolution === "1440p"
          ? game.recommendedVramGb + 2
          : game.recommendedVramGb;
    const vramWarning = vramGb < neededVram;
    const vramPenalty = vramWarning ? 0.82 : 1.0;

    const gpuBound =
      game.base1080pHigh * (gpuScore / 100) * resMult * qualMult * upscaleMult * vramPenalty;
    const cpuBound = game.cpuCapAt100 * (cpuScore / 100) * ramPenalty;

    const rawAvg = Math.min(gpuBound, cpuBound);
    const avgFps = Math.max(12, Math.round(rawAvg));
    const low1PercentFps = Math.max(8, Math.round(avgFps * (vramWarning ? 0.65 : 0.76)));

    return {
      game,
      avgFps,
      low1PercentFps,
      bottleneck: gpuBound <= cpuBound ? "GPU" : "CPU",
      vramWarning,
    };
  });

  return { ready: true, results };
}
