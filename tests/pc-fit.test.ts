import { test } from "node:test";
import assert from "node:assert/strict";
import { airflowSummary, checkFit, defaultMounts, normalizeMounts, radFits } from "@/components/builder/pc-model";
import { BUILDER_PRESETS } from "@/lib/builder/parts";
import { resolveBuildSelection } from "@/lib/builder/compat";

const build = resolveBuildSelection(BUILDER_PRESETS[0].selection);

test("จุดยึดเริ่มต้นใส่ได้จริงทุกจุด", () => {
  const m = defaultMounts(build);
  assert.deepEqual(checkFit(build, m).filter((i) => i.level === "error").map((i) => i.text), []);
});

test("หม้อน้ำ 360 ใส่ด้านหลังไม่ได้", () => {
  assert.equal(radFits("rear", 360), false);
});

test("ชุดน้ำต้องมีหม้อน้ำ 1 จุด, ซิงก์ลมห้ามมีหม้อน้ำ", () => {
  const aio = { ...build, cooler: { ...(build.cooler ?? ({} as never)), specs: { ...(build.cooler?.specs ?? {}), coolerType: "aio" as const, radiatorMm: 240 } } };
  const m = normalizeMounts(aio, { top: { kind: "rad", count: 2 }, front: { kind: "rad", count: 2 }, side: { kind: "none", count: 0 }, rear: { kind: "fans", count: 1 }, bottom: { kind: "none", count: 0 } });
  assert.equal(Object.values(m).filter((s) => s.kind === "rad").length, 1);
  const air = { ...build, cooler: { ...(build.cooler ?? ({} as never)), specs: { ...(build.cooler?.specs ?? {}), coolerType: "air" as const } } };
  const m2 = normalizeMounts(air, m);
  assert.equal(Object.values(m2).filter((s) => s.kind === "rad").length, 0);
});

test("นับลมเข้า/ออก และแรงดัน", () => {
  const m = defaultMounts(build);
  const a = airflowSummary(build, m);
  assert.ok(a.intake >= 0 && a.exhaust >= 0);
  assert.match(a.label, /แรงดัน/);
});
