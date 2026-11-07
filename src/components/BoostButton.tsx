"use client";

import { useState } from "react";
import { Check, Loader2, QrCode, Rocket, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { formatTHB } from "@/lib/format";

export type BoostState = "unpaid" | "pending" | "active" | null;
type Pay = { amount: number; qrSvg: string | null; ref: string };

async function post(body: object) {
  return fetch("/api/partner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((x) => x.json())
    .catch(() => ({ ok: false }));
}

/**
 * ร้านพาร์ตเนอร์ขอดันสินค้า (ขึ้นสินค้าแนะนำ)
 * ถ้าตั้งพร้อมเพย์ไว้: เลือกจำนวนวัน → สแกน QR จ่าย → กด “โอนแล้ว” (แนบสลิปได้) → แอดมินอนุมัติ
 */
export function BoostButton({ productId, status, prices }: { productId: string; status: BoostState; prices?: Record<number, number> | null }) {
  const [state, setState] = useState(status);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(7);
  const [pay, setPay] = useState<Pay | null>(null);
  const [busy, setBusy] = useState(false);
  const [slip, setSlip] = useState<string | null>(null);

  async function request() {
    setBusy(true);
    const r = await post({ action: "request_boost", productId, days });
    setBusy(false);
    setOpen(false);
    if (!r.ok) return toast(r.error || "ส่งไม่สำเร็จ", { tone: "error" });
    if (r.amount && r.qrSvg) {
      setState("unpaid");
      setPay({ amount: r.amount, qrSvg: r.qrSvg, ref: r.ref });
    } else {
      setState("pending");
      toast("ส่งคำขอดันสินค้าแล้ว ทีมงานจะติดต่อกลับ");
    }
  }

  async function reopen() {
    setBusy(true);
    const r = await post({ action: "boost_payment", productId });
    setBusy(false);
    if (r.ok) setPay({ amount: r.amount, qrSvg: r.qrSvg, ref: r.ref });
    else toast(r.error || "เปิด QR ไม่ได้", { tone: "error" });
  }

  async function uploadSlip(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "image");
    const r = await fetch("/api/upload", { method: "POST", body: fd })
      .then((x) => x.json())
      .catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) setSlip(r.file.url);
    else toast(r.error || "อัปโหลดสลิปไม่สำเร็จ", { tone: "error" });
  }

  async function paid() {
    setBusy(true);
    const r = await post({ action: "boost_paid", productId, slipUrl: slip });
    setBusy(false);
    if (!r.ok) return toast(r.error || "แจ้งโอนไม่สำเร็จ", { tone: "error" });
    setPay(null);
    setState("pending");
    toast("แจ้งโอนแล้ว ทีมงานตรวจยอดแล้วจะเปิดดันให้");
  }

  const dialog = pay && (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="จ่ายค่าดันสินค้า">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-ink-950/50" onClick={() => setPay(null)} />
      <div className="relative w-full max-w-sm space-y-3 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center sm:rounded-3xl">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-ink-200 sm:hidden" />
        <button type="button" aria-label="ปิด" onClick={() => setPay(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
        <p className="font-display text-lg font-bold text-ink-950">สแกนจ่ายด้วยแอปธนาคาร</p>
        <p className="font-display text-3xl font-bold text-ink-950">{formatTHB(pay.amount)}</p>
        {pay.qrSvg && (
          <div className="mx-auto w-56 rounded-2xl bg-white p-2 ring-1 ring-ink-200" dangerouslySetInnerHTML={{ __html: pay.qrSvg }} />
        )}
        <p className="text-xs text-ink-600">
          พร้อมเพย์ · ยอดใส่ไว้ให้แล้ว · อ้างอิง <span className="font-mono">{pay.ref}</span>
        </p>
        <label className="icon-btn mx-auto cursor-pointer">
          {slip ? <Check className="h-4 w-4 text-ok" /> : <QrCode className="h-4 w-4" />}
          <span className="text-sm font-semibold">{slip ? "แนบสลิปแล้ว" : "แนบสลิป (ไม่บังคับ)"}</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => uploadSlip(e.target.files?.[0])} />
        </label>
        <button type="button" disabled={busy} onClick={paid} className="btn btn-primary h-12 w-full rounded-full disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "โอนแล้ว"}
        </button>
      </div>
    </div>
  );

  if (state === "unpaid")
    return (
      <>
        <button type="button" onClick={reopen} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-semibold text-warn">
          <QrCode className="h-3 w-3" /> รอจ่ายเงิน · เปิด QR
        </button>
        {dialog}
      </>
    );
  if (state)
    return (
      <span className="rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-info">
        {state === "active" ? "กำลังดันสินค้า" : "รอทีมงานอนุมัติ"}
      </span>
    );

  return open ? (
    <span className="inline-flex flex-wrap items-center gap-1">
      {[7, 14, 30].map((d) => (
        <button key={d} type="button" data-active={days === d} onClick={() => setDays(d)} className="chip px-2 py-0.5 text-[11px]">
          {d} วัน{prices?.[d] ? ` · ${formatTHB(prices[d])}` : ""}
        </button>
      ))}
      <button type="button" onClick={request} disabled={busy} className="chip px-2 py-0.5 text-[11px]" data-active>
        {prices ? "ไปจ่ายเงิน" : "ส่งคำขอ"}
      </button>
    </span>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-info">
      <Rocket className="h-3 w-3" /> ดันสินค้านี้
    </button>
  );
}
