"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/format";

const CATS = ["desk", "chair", "computer", "monitor", "keyboard", "mouse", "lighting", "storage", "decor", "bed", "rug", "headphone"] as const;

/** ฟอร์มสมัครร้านพาร์ตเนอร์ — ส่งแล้วแอดมินอนุมัติในหลังบ้าน */
export function PartnerJoinForm() {
  const [f, setF] = useState({ storeName: "", contactName: "", email: "", phone: "", line: "", shopUrl: "", productCount: "", message: "", website: "" });
  const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/partner/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, categories: cats }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "ส่งไม่สำเร็จ เช็กอินเทอร์เน็ต" }));
    setBusy(false);
    if (!r.ok) return setErr(r.error || "ส่งไม่สำเร็จ");
    setDone(true);
  }

  if (done)
    return (
      <div className="card flex flex-col items-center justify-center gap-3 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-ok" />
        <p className="font-display text-xl font-bold text-ink-950">ได้รับใบสมัครแล้ว</p>
        <p className="text-sm text-ink-600">ทีมงานจะตรวจและเปิดร้านให้ภายใน 1–2 วันทำการ แล้วแจ้งทางอีเมล {f.email} · จากนั้นล็อกอินด้วยอีเมลนี้ที่หน้า “หลังร้าน” เพื่อลงสินค้า</p>
      </div>
    );

  const field = "input h-11 w-full";
  return (
    <form onSubmit={submit} className="card space-y-3 p-5 sm:p-6">
      <p className="font-display text-lg font-bold text-ink-950">สมัครเป็นร้านพาร์ตเนอร์</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required value={f.storeName} onChange={set("storeName")} placeholder="ชื่อร้าน *" className={field} aria-label="ชื่อร้าน" />
        <input required value={f.contactName} onChange={set("contactName")} placeholder="ชื่อผู้ติดต่อ *" className={field} aria-label="ชื่อผู้ติดต่อ" />
        <input required type="email" value={f.email} onChange={set("email")} placeholder="อีเมล (ใช้ล็อกอินหลังร้าน) *" className={field} aria-label="อีเมล" />
        <input required inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="เบอร์โทร *" className={field} aria-label="เบอร์โทร" />
        <input value={f.line} onChange={set("line")} placeholder="LINE ID" className={field} aria-label="LINE ID" />
        <input value={f.productCount} onChange={set("productCount")} placeholder="จำนวนสินค้าโดยประมาณ" className={field} aria-label="จำนวนสินค้า" />
      </div>
      <input value={f.shopUrl} onChange={set("shopUrl")} placeholder="ลิงก์ร้านเดิม (Shopee / Lazada / เว็บร้าน)" className={field} aria-label="ลิงก์ร้าน" />
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-ink-700">ขายสินค้าหมวดไหน</p>
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button key={c} type="button" data-active={cats.includes(c)} onClick={() => setCats((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))} className="chip min-h-9 text-xs">
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>
      <textarea value={f.message} onChange={set("message")} rows={3} maxLength={1000} placeholder="อยากบอกอะไรเพิ่ม (ไม่บังคับ)" className="input w-full py-2.5" aria-label="ข้อความ" />
      {/* ช่องดักบอท: คนจริงไม่เห็น */}
      <input value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {err && <p role="alert" className="rounded-xl bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">{err}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary h-12 w-full rounded-full disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ส่งใบสมัคร (ฟรี)
      </button>
      <p className="text-[11px] text-ink-500">เราไม่หักค่าขาย ลูกค้ากดไปซื้อที่ร้านคุณโดยตรง · บริการดันสินค้าขึ้นแนะนำเป็นแบบเสียเงินแยก (ไม่บังคับ)</p>
    </form>
  );
}
