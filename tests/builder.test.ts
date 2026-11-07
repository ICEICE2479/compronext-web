import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDER_PRESETS, PC_PARTS } from "@/lib/builder/parts";
import { calculateBuildTotals, evaluateBuilderCompatibility, maxGpuCount, resolveBuildSelection } from "@/lib/builder/compat";
import { recommendBuild } from "@/lib/builder/recommend";
import { estimateAllGamesFps } from "@/lib/builder/fps";

const fails = (sel: Parameters<typeof resolveBuildSelection>[0], gpus = 1) =>
  evaluateBuilderCompatibility(resolveBuildSelection(sel), gpus).filter((i) => i.status === "fail");

test("สเปกสำเร็จรูปทุกชุดเข้ากันได้", () => {
  for (const p of BUILDER_PRESETS) assert.deepEqual(fails(p.selection).map((f) => f.title), [], p.label);
});

test("ซีพียูกับบอร์ดคนละซ็อกเก็ต = ไม่ผ่าน", () => {
  const amd = PC_PARTS.find((p) => p.slot === "cpu" && p.specs.socket === "AM5")!;
  const intelBoard = PC_PARTS.find((p) => p.slot === "motherboard" && p.specs.socket === "LGA1700")!;
  assert.ok(fails({ cpu: amd.id, motherboard: intelBoard.id }).length > 0);
});

test("การ์ดจอ 2 ใบ: ราคาและไฟคูณ, ITX ใส่ได้ใบเดียว", () => {
  const sel = BUILDER_PRESETS[0].selection;
  const r = resolveBuildSelection(sel);
  const one = calculateBuildTotals(r, 1);
  const two = calculateBuildTotals(r, 2);
  assert.equal(two.pcOnlyPrice - one.pcOnlyPrice, r.gpu!.price);
  assert.equal(two.estimatedWatts - one.estimatedWatts, r.gpu!.specs.boardPowerWatts ?? 0);
  const itx = PC_PARTS.find((p) => p.slot === "motherboard" && p.specs.formFactor === "ITX");
  if (itx) assert.equal(maxGpuCount(itx), 1);
});

test("ช่วยจัดสเปก: อยู่ในงบ เข้ากันได้ และงบมากขึ้น FPS ไม่ลดลง", () => {
  let last = 0;
  for (const budget of [30000, 50000, 90000]) {
    const r = recommendBuild({ budget, games: ["cyberpunk"], resolution: "1440p" });
    assert.ok(r, `งบ ${budget} ต้องจัดได้`);
    assert.ok(r.total <= budget, `ราคา ${r.total} เกินงบ ${budget}`);
    assert.equal(fails(r.selection).length, 0);
    const fps = estimateAllGamesFps(resolveBuildSelection(r.selection), "1440p", "high", true).results.find((x) => x.game.id === "cyberpunk")!.avgFps;
    assert.ok(fps >= last * 0.97, `FPS ลดลงเมื่องบเพิ่ม (${last} → ${fps})`);
    last = fps;
  }
  assert.equal(recommendBuild({ budget: 8000, games: [], resolution: "1080p" }), null);
});
