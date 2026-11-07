import { NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeText } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { queuePush } from "@/lib/push";
import { allowedNext, CASE_STATUSES, caseForViewer, isClosed, type CaseStatus, type SupportCaseRecord } from "@/lib/returns";
import { notifyCaseEmail } from "@/lib/returns-server";
import { caseViewer, findCase } from "@/lib/returns-server";

type Params = { params: Promise<{ id: string }> };

const fileUrl = z.string().max(1000).refine((v) => v.startsWith("/api/files/") || v.startsWith("https://"));
const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("comment"), note: z.string().max(1500).default(""), files: z.array(fileUrl).max(6).default([]) }),
  z.object({ action: z.literal("rate"), stars: z.number().int().min(1).max(5), note: z.string().max(500).default("") }),
  z.object({
    action: z.literal("status"),
    status: z.enum(Object.keys(CASE_STATUSES) as [CaseStatus, ...CaseStatus[]]),
    note: z.string().max(1500).default(""),
  }),
]);

/** ระบบติดตามสถานะ: ดูรายละเอียด + ไทม์ไลน์ (เฉพาะลูกค้าเจ้าของเคส ร้านเจ้าของเคส หรือแอดมิน) */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const c = findCase(readDb(), id);
  const viewer = c ? await caseViewer(c) : null;
  if (!c || !viewer) return NextResponse.json({ ok: false, error: "ไม่พบเคส" }, { status: 404 });
  return NextResponse.json({ ok: true, case: caseForViewer(c), role: viewer.role, next: viewer.role === "customer" ? [] : allowedNext(c.status) });
}

/** ระบบจัดการเคส: ร้าน/แอดมินเปลี่ยนสถานะ · ทุกฝ่ายตอบกลับ/แนบรูปเพิ่ม */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const db = readDb();
  const c = findCase(db, id);
  const viewer = c ? await caseViewer(c) : null;
  if (!c || !viewer) return NextResponse.json({ ok: false, error: "ไม่พบเคส" }, { status: 404 });
  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  const body = parsed.data;
  const now = new Date().toISOString();
  const by = viewer.role;
  const name = viewer.role === "admin" ? "ทีม ComproNext" : viewer.role === "store" ? viewer.partnerName : viewer.user.name;

  if (body.action === "rate") {
    if (by !== "customer") return NextResponse.json({ ok: false, error: "เฉพาะลูกค้าให้คะแนนได้" }, { status: 403 });
    if (!isClosed(c.status)) return NextResponse.json({ ok: false, error: "ให้คะแนนได้หลังปิดเคส" }, { status: 409 });
    if (c.rating) return NextResponse.json({ ok: false, error: "ให้คะแนนไปแล้ว" }, { status: 409 });
    c.rating = { stars: body.stars, note: sanitizeText(body.note, 500), at: now };
    c.events.push({ at: now, by, name, note: `ให้คะแนนการดูแล ${"★".repeat(body.stars)}${c.rating.note ? ` — ${c.rating.note}` : ""}` });
  } else if (body.action === "comment") {
    const note = sanitizeText(body.note, 1500);
    if (!note && !body.files.length) return NextResponse.json({ ok: false, error: "พิมพ์ข้อความหรือแนบรูป" }, { status: 400 });
    if (isClosed(c.status) && by === "customer") return NextResponse.json({ ok: false, error: "เคสนี้ปิดแล้ว" }, { status: 409 });
    const ev = { at: now, by, name, note, files: body.files.length ? body.files : undefined } as const;
    c.events.push({ ...ev });
    if (by === "customer" && body.files.length) c.evidence = [...c.evidence, ...body.files].slice(0, 12);
    // ลูกค้าตอบข้อมูลที่ร้านขอแล้ว → กลับไปขั้นตรวจสอบเอง
    if (by === "customer" && c.status === "need_info") {
      c.status = "reviewing";
      c.events.push({ at: now, by: "customer", name, status: "reviewing", note: "ส่งข้อมูลเพิ่มแล้ว" });
    }
    if (by !== "customer") c.firstReplyAt ??= now;
  } else {
    if (by === "customer") return NextResponse.json({ ok: false, error: "เฉพาะร้านเปลี่ยนสถานะได้" }, { status: 403 });
    if (!allowedNext(c.status).includes(body.status))
      return NextResponse.json({ ok: false, error: `เปลี่ยนจาก “${CASE_STATUSES[c.status]}” เป็น “${CASE_STATUSES[body.status]}” ไม่ได้` }, { status: 409 });
    const note = sanitizeText(body.note, 1500);
    if ((body.status === "rejected" || body.status === "need_info") && note.length < 5)
      return NextResponse.json({ ok: false, error: "บอกเหตุผล/สิ่งที่ต้องการให้ลูกค้ารู้ด้วย" }, { status: 400 });
    c.status = body.status;
    c.events.push({ at: now, by, name, status: body.status, note });
    c.firstReplyAt ??= now;
    if (isClosed(body.status)) c.closedAt = now;
    queuePush(db, { userIds: [c.userId] }, { title: `เคส ${c.code}: ${CASE_STATUSES[body.status]}`, body: note || c.productName, url: `/returns/${c.code}`, tag: c.code });
    notifyCaseEmail(c as SupportCaseRecord, "customer", `สถานะเคสเปลี่ยนเป็น “${CASE_STATUSES[body.status]}”`, note);
  }
  c.updatedAt = now;
  writeDb(db);
  // ร้าน/ทีมงานตอบ → อีเมลลูกค้า · ลูกค้าตอบ → อีเมลร้าน
  if (body.action === "comment") notifyCaseEmail(c, by === "customer" ? "store" : "customer", by === "customer" ? "ลูกค้าตอบกลับในเคส" : `${name} ตอบกลับเคสของคุณ`, sanitizeText(body.note, 300));
  return NextResponse.json({ ok: true, case: caseForViewer(c), next: by === "customer" ? [] : allowedNext(c.status) });
}
