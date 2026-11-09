import { test } from "node:test";
import assert from "node:assert/strict";
import { encodePlan } from "@/lib/room-planner";
import { presetShape } from "@/lib/room-shape";
test("cloud shapes: save posts plan code, load merges back", async () => {
  const store: Record<string, string> = {};
  (globalThis as any).window = { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) } };
  const posted: any[] = [];
  (globalThis as any).fetch = async (url: string, init?: any) => {
    if (init?.method === "POST") { posted.push(JSON.parse(init.body)); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => ({ plans: posted.map((p, i) => ({ id: `rp-${i}`, name: p.name, code: p.code, updatedAt: new Date().toISOString() })).concat([{ id: "x", name: "ห้องนอน", code: encodePlan({ w: 300, d: 300, h: 260 }, []), updatedAt: "" }]) }) };
  };
  const { saveShapeToCloud, loadShapesWithCloud } = await import("@/lib/room-shapes-store");
  saveShapeToCloud({ name: "ห้อง L", shape: presetShape("L", 400, 350), h: 270 });
  await new Promise((r) => setTimeout(r, 5));
  const l = await loadShapesWithCloud();
  assert.equal(l.length, 1);
  assert.equal(l[0].name, "ห้อง L");
  assert.equal(l[0].h, 270);
  assert.deepEqual(l[0].shape, presetShape("L", 400, 350));
});
