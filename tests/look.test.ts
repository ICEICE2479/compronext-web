import { test } from "node:test";
import assert from "node:assert/strict";
import { withLook } from "@/components/design/product-look";
import { itemFromProduct } from "@/lib/room-planner";
const look = (body: string, neutral: boolean) => ({ body, neutral, photo: null });
test("photo colour replaces guessed colour only", () => {
  const chair = itemFromProduct({ id: "a", name: "เก้าอี้ MARKUS", category: "chair" });
  assert.equal(withLook(chair, look("#c42834", false)).color, "#c42834");
  const white = itemFromProduct({ id: "b", name: "เก้าอี้ ขาว", category: "chair" });
  assert.equal(withLook(white, look("#c42834", false)).color, white.color);
  const picked = { ...chair, color: "#1f2125" };
  assert.equal(withLook(picked, look("#c42834", false)).color, "#1f2125");
  const mon = itemFromProduct({ id: "c", name: "จอ 27 นิ้ว IPS", category: "monitor" });
  assert.equal(withLook(mon, look("#2050f0", false)).color, mon.color);
  assert.equal(withLook(mon, look("#f2f2f2", true)).color, "#f2f2f2");
  assert.equal(withLook(chair, null), chair);
});
