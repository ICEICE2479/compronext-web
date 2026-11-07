import { test } from "node:test";
import assert from "node:assert/strict";
import { matchScore } from "@/lib/search";

test("คำพ้องไทย-อังกฤษ", () => {
  assert.ok(matchScore("gpu", "GeForce RTX 4060", "การ์ดจอ") > 0);
  assert.ok(matchScore("การ์ดจอ", "GeForce RTX 4060", "gpu") > 0);
  assert.ok(matchScore("power supply", "Corsair RM850", "พาวเวอร์ซัพพลาย") > 0);
});
test("ภาษาไทยเขียนติดกัน", () => {
  assert.ok(matchScore("เก้าอี้ขาว", "MARKUS chair white") > 0);
});
test("พิมพ์ผิดเล็กน้อย", () => {
  assert.ok(matchScore("keybord", "Keychron K2 keyboard") > 0);
});
test("ไม่เกี่ยวต้องไม่เจอ และตรงในชื่อได้คะแนนมากกว่า", () => {
  assert.equal(matchScore("xyzabc", "Desk"), 0);
  assert.equal(matchScore("โต๊ะ", "เก้าอี้"), 0);
  assert.ok(matchScore("desk", "Standing desk", "") > matchScore("desk", "Chair", "matches desk"));
});
