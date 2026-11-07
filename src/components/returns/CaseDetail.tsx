"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Copy, Loader2, PartyPopper, Send, Star } from "lucide-react";
import { toast } from "@/lib/toast";
import EmptyState from "@/components/EmptyState";
import Spinner from "@/components/Spinner";
import { CASE_STATUSES, CASE_TYPES, CASE_WISHES, isClosed, nextStepText, type CaseStatus, type SupportCaseRecord } from "@/lib/returns";
import { CaseTracker, fmtWhen, StatusChip } from "./CaseBits";
import { EvidencePicker } from "./EvidencePicker";

type Role = "customer" | "store" | "admin";
const ACTION_LABEL: Partial<Record<CaseStatus, string>> = {
  reviewing: "รับเรื่อง / กำลังตรวจ",
  need_info: "ขอข้อมูลเพิ่ม",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  resolved: "ปิดเคส (เสร็จสิ้น)",
};
const BY_LABEL = { customer: "ลูกค้า", store: "ร้าน", admin: "ทีมงาน" } as const;

/** ระบบติดตามสถานะ (ลูกค้า) + หน้าจัดการเคส (ร้าน/แอดมิน) ใช้หน้าเดียวกัน ต่างกันที่ปุ่ม */
export function CaseDetail({ code, justCreated }: { code: string; justCreated: boolean }) {
  const [c, setC] = useState<SupportCaseRecord | null>(null);
  const [role, setRole] = useState<Role>("customer");
  const [next, setNext] = useState<CaseStatus[]>([]);
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stars, setStars] = useState(0);

  const apply = useCallback((d: { case: SupportCaseRecord; role?: Role; next?: CaseStatus[] }) => {
    setC(d.case);
    if (d.role) setRole(d.role);
    setNext(d.next ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/returns/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && (d.ok ? apply(d) : setMissing(true)))
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [code, apply]);

  async function post(body: object, key: string) {
    if (!c) return;
    setBusy(key);
    setError(null);
    const r = await fetch(`/api/returns/${c.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "ส่งไม่สำเร็จ" }));
    setBusy(null);
    if (!r.ok) return setError(r.error || "ทำรายการไม่สำเร็จ");
    apply({ case: r.case, next: r.next });
    setNote("");
    setFiles([]);
    toast("อัปเดตเคสแล้ว");
  }

  if (missing)
    return (
      <EmptyState
        title="ไม่พบเคสนี้"
        description="เช็กเลขเคสอีกครั้ง หรือเข้าสู่ระบบด้วยบัญชีที่ใช้แจ้งปัญหา"
        action={{ label: "กลับหน้าเคสของฉัน", href: "/returns" }}
      />
    );
  if (!c)
    return (
      <div className="flex justify-center py-16">
        <Spinner size={24} />
      </div>
    );

  const closed = isClosed(c.status);
  const staff = role !== "customer";

  return (
    <div className="space-y-5">
      <Link href={staff && role === "store" ? "/partner/returns" : staff ? "/admin/ops?tab=cases" : "/returns"} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-950">
        <ChevronLeft className="h-4 w-4" /> {staff ? "เคสทั้งหมด" : "เคสของฉัน"}
      </Link>

      {justCreated && !staff && (
        <div className="scene-chip flex items-start gap-3 rounded-2xl bg-ok-bg p-4 text-sm text-ink-900">
          <PartyPopper className="h-5 w-5 shrink-0 text-ok" />
          <p>
            ส่งเรื่องถึง <b>{c.storeName}</b> แล้ว จดเลขเคสไว้ <b className="font-mono">{c.code}</b> — กลับมาดูสถานะได้ที่หน้านี้ หรือเปิดแจ้งเตือนในหน้าบัญชี
          </p>
        </div>
      )}

      <header className="card space-y-4 p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(c.code).then(() => toast("คัดลอกเลขเคสแล้ว"))}
              className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-ink-600 hover:text-info"
            >
              {c.code} <Copy className="h-3 w-3" />
            </button>
            <h1 className="font-display text-xl font-bold text-ink-950 sm:text-2xl">{c.productName}</h1>
            <p className="text-xs text-ink-600">
              {c.storeName} · แจ้งเมื่อ {fmtWhen(c.createdAt)}
              {c.orderRef && ` · คำสั่งซื้อ ${c.orderRef}`}
              {staff && ` · ลูกค้า ${c.userName} (${c.email})`}
            </p>
          </div>
          <StatusChip status={c.status} />
        </div>
        <CaseTracker status={c.status} />
        {!staff && <p className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-800">{nextStepText(c)}</p>}
      </header>

      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-ink-100 px-2.5 py-1 font-semibold text-ink-800">{CASE_TYPES[c.type]}</span>
          <span className="rounded-full bg-info-bg px-2.5 py-1 font-semibold text-info">อยากได้: {CASE_WISHES[c.wish]}</span>
        </div>
        <p className="whitespace-pre-line text-sm text-ink-900">{c.description}</p>
        {c.evidence.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {c.evidence.map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="h-24 w-24 overflow-hidden rounded-xl border border-ink-200 bg-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="รูปหลักฐาน" className="h-full w-full object-cover" width={96} height={96} loading="lazy" />
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold text-ink-950">ไทม์ไลน์</h2>
        <ol className="relative space-y-4 border-l-2 border-ink-100 pl-5">
          {c.events.map((e, i) => (
            <li key={i} className="relative">
              <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-surface ${e.by === "customer" ? "bg-ink-400" : "bg-info"}`} />
              <p className="text-xs text-ink-500">
                {fmtWhen(e.at)} · <span className="font-semibold text-ink-700">{e.name}</span> ({BY_LABEL[e.by]})
              </p>
              {e.status && <p className="text-sm font-semibold text-ink-950">→ {CASE_STATUSES[e.status]}</p>}
              {e.note && <p className="whitespace-pre-line text-sm text-ink-800">{e.note}</p>}
              {e.files?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {e.files.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="h-14 w-14 overflow-hidden rounded-lg border border-ink-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="ไฟล์แนบ" className="h-full w-full object-cover" width={56} height={56} loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {closed && !staff && !c.rating && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold text-ink-950">ให้คะแนนการดูแลของร้าน</h2>
          <div className="flex gap-1" role="radiogroup" aria-label="คะแนน 1 ถึง 5 ดาว">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} ดาว`} onClick={() => setStars(n)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink-50">
                <Star className={`h-7 w-7 ${n <= stars ? "text-amber-400" : "text-ink-300"}`} fill={n <= stars ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="ร้านดูแลเป็นอย่างไรบ้าง (ไม่บังคับ)" className="input w-full py-2.5" />
          {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
          <button type="button" disabled={!stars || !!busy} onClick={() => post({ action: "rate", stars, note }, "rate")} className="btn btn-primary h-11 rounded-full px-5 disabled:opacity-50">
            {busy === "rate" && <Loader2 className="h-4 w-4 animate-spin" />} ส่งคะแนน
          </button>
        </section>
      )}
      {c.rating && (
        <p className="card flex items-center gap-2 p-4 text-sm text-ink-800">
          <span className="text-amber-400">{"★".repeat(c.rating.stars)}</span>
          <span className="text-ink-300">{"★".repeat(5 - c.rating.stars)}</span>
          {staff ? "คะแนนจากลูกค้า" : "ขอบคุณที่ให้คะแนน"}
          {c.rating.note && <span className="text-ink-600">— {c.rating.note}</span>}
        </p>
      )}

      {(!closed || staff) && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold text-ink-950">{staff ? "ตอบลูกค้า / เปลี่ยนสถานะ" : c.status === "need_info" ? "ส่งข้อมูลที่ร้านขอ" : "ส่งข้อความถึงร้าน"}</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1500}
            placeholder={staff ? "เช่น ส่งของกลับที่อยู่ร้าน… / ขอรูปซีเรียลหลังเครื่อง" : "พิมพ์ข้อความ"}
            className="input w-full py-2.5"
          />
          <EvidencePicker value={files} onChange={setFiles} max={4} />
          {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy || (!note.trim() && !files.length)} onClick={() => post({ action: "comment", note, files }, "comment")} className="btn btn-outline h-11 rounded-full px-4 disabled:opacity-50">
              {busy === "comment" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ส่งข้อความ
            </button>
            {staff &&
              next.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!!busy}
                  onClick={() => post({ action: "status", status: s, note }, s)}
                  className={`btn h-11 rounded-full px-4 disabled:opacity-50 ${s === "rejected" ? "border border-bad/40 text-bad hover:bg-bad-bg" : "btn-primary"}`}
                >
                  {busy === s && <Loader2 className="h-4 w-4 animate-spin" />}
                  {ACTION_LABEL[s] ?? CASE_STATUSES[s]}
                </button>
              ))}
          </div>
          {staff && next.some((s) => s === "rejected" || s === "need_info") && <p className="text-xs text-ink-500">“ขอข้อมูลเพิ่ม” และ “ไม่อนุมัติ” ต้องพิมพ์เหตุผลในช่องข้อความก่อน</p>}
        </section>
      )}
    </div>
  );
}
