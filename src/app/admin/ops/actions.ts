"use server";

import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { createBackup, restoreBackup } from "@/lib/backup";
import { deleteUserData } from "@/lib/user-data";
import { logOps } from "@/lib/ops-log";
import { refreshPrices } from "@/lib/price-refresh";
import { expireBoosts } from "@/lib/boosts";
import { mirrorBatch } from "@/lib/image-mirror";
import { extractDimensions } from "@/lib/dim-extract";
import { addCredits } from "@/lib/ai-credits";
import { findRealImagesBatch } from "@/lib/real-image";
import { detectRoomPins } from "@/lib/room-pins";

/** ทุก action ต้องเป็นแอดมินที่ล็อกอินแล้ว */
async function guard() {
  if (!(await isAdminAuthenticated())) throw new Error("ต้องเข้าสู่ระบบผู้ดูแล");
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").slice(0, 200);
const done = () => revalidatePath("/admin/ops");

/* ---------- ผู้ใช้ ---------- */
export async function setUserBan(form: FormData) {
  await guard();
  const db = readDb();
  const u = db.users.find((x) => x.id === str(form, "id"));
  if (!u) return;
  u.banned = str(form, "ban") === "1";
  writeDb(db);
  await logOps({ kind: "admin", title: `แอดมิน${u.banned ? "ระงับ" : "ยกเลิกระงับ"}ผู้ใช้ ${u.email}`, ok: true });
  done();
}
export async function deleteUser(form: FormData) {
  await guard();
  if (str(form, "confirm") !== "ลบ") return;
  const db = readDb();
  const u = db.users.find((x) => x.id === str(form, "id"));
  if (!u) return;
  await createBackup(`ก่อนลบผู้ใช้ ${u.email}`);
  deleteUserData(db, u.id, u.email);
  writeDb(db);
  await logOps({ kind: "admin", title: `แอดมินลบผู้ใช้ ${u.email}`, ok: true });
  done();
}

/* ---------- รีวิว ---------- */
export async function deleteReview(form: FormData) {
  await guard();
  const db = readDb();
  db.reviews = db.reviews.filter((r) => r.id !== str(form, "id"));
  writeDb(db);
  done();
}

/* ---------- ชุมชน ---------- */
export async function setPostStatus(form: FormData) {
  await guard();
  const db = readDb();
  const p = db.community.find((x) => x.id === str(form, "id"));
  if (!p) return;
  const s = str(form, "status");
  if (s === "delete") db.community = db.community.filter((x) => x !== p);
  else {
    p.status = s === "hidden" ? "hidden" : "visible";
    if (p.status === "visible") p.reports = [];
  }
  writeDb(db);
  done();
}

/* ---------- ดันสินค้า ---------- */
export async function decideBoost(form: FormData) {
  await guard();
  const db = readDb();
  const b = db.boosts.find((x) => x.id === str(form, "id"));
  if (!b) return;
  const d = str(form, "decision");
  const p = db.products.find((x) => x.id === b.productId);
  if (d === "approve" && b.status === "pending") {
    b.status = "active";
    b.startAt = new Date().toISOString();
    b.endAt = new Date(Date.now() + b.days * 86_400_000).toISOString();
    if (p) p.featured = true;
  } else if (d === "reject" && b.status === "pending") b.status = "rejected";
  else if (d === "end" && b.status === "active") {
    b.endAt = new Date().toISOString();
    expireBoosts(db);
  }
  writeDb(db);
  done();
}

/* ---------- เครดิต AI ---------- */
export async function decideCreditOrder(form: FormData) {
  await guard();
  const db = readDb();
  const o = db.creditOrders.find((x) => x.id === str(form, "id"));
  if (!o || (o.status !== "pending" && o.status !== "unpaid")) return;
  const d = str(form, "decision");
  if (d === "approve") {
    o.status = "approved";
    addCredits(db, o.userId, o.credits);
  } else if (d === "reject") o.status = "rejected";
  else return;
  o.decidedAt = new Date().toISOString();
  writeDb(db);
  await logOps({ kind: "admin", title: `แอดมิน${o.status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}เครดิต ${o.id} (${o.credits} เครดิต ${o.amount} บาท)`, ok: true });
  done();
}

/* ---------- ร้านพาร์ตเนอร์ ---------- */
export async function setPartnerActive(form: FormData) {
  await guard();
  const db = readDb();
  const p = db.partners.find((x) => x.id === str(form, "id"));
  if (!p) return;
  p.active = str(form, "active") === "1";
  writeDb(db);
  done();
}

/* ---------- แชท (ลบห้องที่ผิดกฎ) ---------- */
export async function deleteChat(form: FormData) {
  await guard();
  const db = readDb();
  db.chats = db.chats.filter((c) => c.id !== str(form, "id"));
  writeDb(db);
  done();
}

/* ---------- ระบบ ---------- */
export async function backupNow() {
  await guard();
  await createBackup("สำรองเองจากหลังบ้าน");
  done();
}
export async function restoreNow(form: FormData) {
  await guard();
  if (str(form, "confirm") !== "กู้คืน") return;
  const ok = await restoreBackup(str(form, "id"));
  await logOps({ kind: "admin", title: `กู้คืนข้อมูล ${str(form, "id")}`, ok });
  revalidatePath("/", "layout");
}
export async function runPriceCheck() {
  await guard();
  const db = readDb();
  const summary = await refreshPrices(db, 20);
  writeDb(db);
  await logOps({ kind: "cron", title: `เช็กราคา (กดเอง): ${JSON.stringify({ ...summary, ids: undefined }).slice(0, 200)}`, ok: true });
  done();
}
export async function testAlert() {
  await guard();
  await logOps({ kind: "error", title: "ทดสอบการแจ้งเตือนจากหลังบ้าน", detail: "ถ้าเห็นข้อความนี้ใน Discord/Slack แปลว่าตั้งค่าถูกแล้ว" });
  done();
}

/* ---------- ข้อมูลสินค้า ---------- */
/** เติมขนาดสินค้าจากชื่อ/รายละเอียด (เฉพาะชิ้นที่ยังไม่มีขนาด) */
export async function applyExtractedDims() {
  await guard();
  const db = readDb();
  let n = 0;
  for (const p of db.products) {
    if (p.dimensions) continue;
    const d = extractDimensions([p.name, p.description, ...Object.values(p.specs ?? {})].join(" "), p.category);
    if (!d) continue;
    p.dimensions = d;
    p.dimensionsSource = "extracted";
    n++;
  }
  writeDb(db);
  await logOps({ kind: "admin", title: `เติมขนาดสินค้าจากชื่อ ${n} ชิ้น`, ok: true });
  done();
}

/** ร้านที่สมัคร: อนุมัติ = เปิดร้านพาร์ตเนอร์ให้อีเมลนั้น */
export async function decidePartnerApplication(form: FormData) {
  await guard();
  const db = readDb();
  const app = db.partnerApplications.find((a) => a.id === str(form, "id"));
  if (!app || app.status !== "pending") return;
  const ok = str(form, "decision") === "approve";
  app.status = ok ? "approved" : "rejected";
  app.decidedAt = new Date().toISOString();
  if (ok && !db.partners.some((p) => p.email.toLowerCase() === app.email.toLowerCase())) {
    db.partners.push({ id: `pt-${Date.now().toString(36)}`, name: app.storeName, email: app.email.toLowerCase(), active: true, createdAt: app.decidedAt });
  }
  writeDb(db);
  await logOps({ kind: "admin", title: `${ok ? "อนุมัติ" : "ปฏิเสธ"}ร้าน ${app.storeName}`, ok: true });
  done();
}

/** เก็บรูปสินค้าจากเว็บร้านเข้าที่เก็บไฟล์ของเรา (ครั้งละ ~40 รูป ภายใน 45 วินาที) */
export async function findRealImagesNow() {
  await guard();
  const r = await findRealImagesBatch({ limit: 40, budgetMs: 45_000 });
  await logOps({ kind: "admin", title: `เปลี่ยนรูปวาดเป็นรูปจริงจากหน้าร้าน ${r.done} ชิ้น (หาไม่เจอ ${r.failed}, เหลือ ${r.left})`, ok: true });
  done();
}

export async function detectRoomPinsNow() {
  await guard();
  const r = await detectRoomPins({ limit: 20, budgetMs: 45_000 });
  await logOps({ kind: "admin", title: `วางจุดสินค้าบนรูปห้องด้วย AI ${r.done} ห้อง (ขยับ ${r.moved} จุด, เหลือ ${r.left})`, detail: r.error, ok: !r.error });
  done();
}

export async function mirrorImagesNow() {
  await guard();
  const r = await mirrorBatch({ limit: 40, budgetMs: 45_000 });
  await logOps({ kind: "admin", title: `เก็บรูปสินค้าเข้าระบบ ${r.done} รูป (ไม่สำเร็จ ${r.failed}, เหลือ ${r.left})`, detail: r.error, ok: !r.error });
  done();
}

export async function hideProducts(form: FormData) {
  await guard();
  const ids = new Set(String(form.get("ids") ?? "").split(",").filter(Boolean).slice(0, 2000));
  if (!ids.size) return;
  const db = readDb();
  let n = 0;
  for (const p of db.products) if (ids.has(p.id) && p.published !== false) {
    p.published = false;
    n++;
  }
  writeDb(db);
  await logOps({ kind: "admin", title: `แอดมินซ่อนสินค้า ${n} ชิ้น`, ok: true });
  done();
}

/** บันทึกคีย์ AI (GEMINI_API_KEY / ANTHROPIC_API_KEY) และโหมดการเจนรูปจากหน้าหลังบ้าน */
export async function saveAiConfig(form: FormData) {
  await guard();
  const db = readDb();
  const prev = db.aiConfig ?? {};
  const geminiRaw = String(form.get("geminiApiKey") ?? "").trim();
  const anthropicRaw = String(form.get("anthropicApiKey") ?? "").trim();
  const prefRaw = String(form.get("preferredImageProvider") ?? "auto").trim();
  const clearGemini = form.get("clearGemini") === "1";
  const clearAnthropic = form.get("clearAnthropic") === "1";

  const preferredImageProvider: "auto" | "gemini" | "cloudflare" =
    prefRaw === "gemini" || prefRaw === "cloudflare" ? prefRaw : "auto";

  db.aiConfig = {
    geminiApiKey: clearGemini ? "" : geminiRaw ? geminiRaw : prev.geminiApiKey,
    anthropicApiKey: clearAnthropic ? "" : anthropicRaw ? anthropicRaw : prev.anthropicApiKey,
    preferredImageProvider,
  };
  writeDb(db);
  await logOps({
    kind: "admin",
    title: `อัปเดตตั้งค่าคีย์ AI (โหมดภาพ: ${preferredImageProvider}, Gemini: ${db.aiConfig.geminiApiKey ? "ตั้งคีย์แล้ว" : "ไม่ได้ตั้ง"})`,
    ok: true,
  });
  done();
}
