import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { jsonLdHtml } from "@/lib/seo";
import { rateLimit } from "@/lib/rate-limit";
import { cleanSelection } from "@/lib/community";
import { affiliateUrl } from "@/lib/affiliate";
import { findCheaperSwaps } from "@/lib/room-swaps";
import { deleteUserData, exportUserData } from "@/lib/user-data";
import type { RuntimeDatabase } from "@/lib/data/store";

test("JSON-LD กัน </script> ในข้อความ", () => {
  assert.ok(!jsonLdHtml({ name: "</script><script>alert(1)</script>" }).__html.includes("</script>"));
});

test("จำกัดความถี่", () => {
  const key = `t-${Math.random()}`;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit(key, 3, 60_000).ok, true);
  assert.equal(rateLimit(key, 3, 60_000).ok, false);
});

test("โพสต์สเปก: กรองรหัสที่ไม่มีจริง และต้องมีอย่างน้อย 2 ชิ้น", () => {
  assert.equal(cleanSelection({ cpu: "x", gpu: "y" }), null);
  const s = cleanSelection({ cpu: "cpu-i5-12400f", gpu: "gpu-rtx-4060-8g", evil: "1", ram: "<script>" });
  assert.ok(s);
  assert.equal(s.ram, null);
  assert.equal("evil" in s, false);
});

test("affiliate: ห่อลิงก์ / ต่อพารามิเตอร์ / ไม่แตะร้านที่ไม่ได้ตั้ง / ปฏิเสธลิงก์ไม่ปลอดภัย", () => {
  process.env.AFFILIATE_SHOPEE = "https://s.shopee.co.th/an_redir?origin_link={url}&affiliate_id=1";
  process.env.AFFILIATE_LAZADA = "sub_aff_id=abc";
  process.env.AFFILIATE_IKEA = "javascript:alert({url})";
  assert.match(affiliateUrl("https://shopee.co.th/item-1"), /^https:\/\/s\.shopee\.co\.th\/an_redir\?origin_link=https%3A%2F%2Fshopee/);
  assert.equal(new URL(affiliateUrl("https://www.lazada.co.th/p/1")).searchParams.get("sub_aff_id"), "abc");
  assert.equal(affiliateUrl("https://example.com/x"), "https://example.com/x");
  assert.equal(affiliateUrl("https://www.ikea.com/th/p/1"), "https://www.ikea.com/th/p/1");
});

test("แต่งห้องให้ถูกลง: หมวดเดียวกัน ถูกกว่า และชนิดย่อยตรงกัน", () => {
  const db = JSON.parse(fs.readFileSync(".data/compronext-db.json", "utf8")) as RuntimeDatabase;
  const byId = new Map(db.products.map((p) => [p.id, p]));
  for (const r of db.rooms.slice(0, 20)) {
    const items = r.items.flatMap((i) => {
      const p = byId.get(i.productId);
      return p && p.status === "available" ? [{ product: p, quantity: i.quantity }] : [];
    });
    for (const s of findCheaperSwaps(items, db.products).swaps) {
      assert.equal(s.alt.category, s.original.category);
      assert.ok(s.alt.price < s.original.price);
    }
  }
});

test("ลบบัญชี: ลบเฉพาะข้อมูลของคนนั้น", () => {
  const db = JSON.parse(fs.readFileSync(".data/compronext-db.json", "utf8")) as RuntimeDatabase;
  db.carts = { a: [{ id: "x", quantity: 1 }], b: [{ id: "y", quantity: 1 }] };
  db.saved = { a: { rooms: [], builds: [] } } as RuntimeDatabase["saved"];
  db.pushSubs = {};
  db.digestSubs = { a: { email: "a@x.com", name: "a", at: "" } };
  db.reviews = [{ id: "1", storeKey: "s", storeName: "s", userId: "a", userName: "a", rating: 5, text: "", createdAt: "" }, { id: "2", storeKey: "s", storeName: "s", userId: "b", userName: "b", rating: 4, text: "", createdAt: "" }];
  db.community = [{ id: "p", kind: "build", userId: "b", userName: "b", title: "t", text: "", likes: ["a", "b"], copies: 0, status: "visible", reports: ["a"], createdAt: "" }];
  assert.equal(exportUserData(db, "a", null).reviews.length, 1);
  deleteUserData(db, "a", null);
  assert.deepEqual(Object.keys(db.carts), ["b"]);
  assert.deepEqual(db.reviews.map((r) => r.id), ["2"]);
  assert.deepEqual(db.community[0].likes, ["b"]);
  assert.deepEqual(db.community[0].reports, []);
  assert.equal("a" in db.digestSubs, false);
});
