import { test } from "node:test";
import assert from "node:assert/strict";
import { sizeFromName, itemFromProduct } from "@/lib/room-planner";
test("monitor inches → real panel width", () => {
  const [w, , h] = sizeFromName("MONITOR (จอมอนิเตอร์) MSI PRO MP241W E14V - 23.8 VA FHD 144Hz (3Y)", "monitor")!;
  assert.ok(w >= 53 && w <= 56, String(w));
  assert.ok(h >= 44 && h <= 48, String(h));
  const [uw] = sizeFromName('LG UltraGear 34" WQHD curved', "monitor")!;
  assert.ok(uw >= 80 && uw <= 83, String(uw));
  assert.equal(sizeFromName("MONITOR ARM ERGONOZ EGN-TRAZERV2-S (3Y)", "monitor"), null);
  const [w27] = sizeFromName("ASUS VG27AQ 27 IPS QHD 170Hz", "monitor")!;
  assert.ok(w27 >= 60 && w27 <= 63);
});
test("mousepad / rug / desk from name", () => {
  assert.deepEqual(sizeFromName("STEELSERIES QCK WHITE (SIZE L) (450 x 400 x 2mm)", "mousepad"), [45, 40, 0.3]);
  assert.deepEqual(sizeFromName("STEELSERIES QCK HEAVY (SIZE M) (320 x 270 x 6mm)", "mousepad"), [32, 27, 0.6]);
  assert.deepEqual(sizeFromName("พรม 160x230 ซม.", "rug"), [160, 230, 1.2]);
  assert.deepEqual(sizeFromName("โต๊ะ 120x60x75 ซม.", "desk"), [120, 60, 75]);
  assert.equal(sizeFromName("LOGITECH G G316 X 75 BLACK", "keyboard"), null);
  assert.equal(sizeFromName("โต๊ะ 120x60", "desk"), null);
  const it = itemFromProduct({ id: "x", name: "STEELSERIES QCK (450 x 400 x 2mm)", category: "mousepad" });
  assert.deepEqual([it.w, it.d], [45, 40]);
});
