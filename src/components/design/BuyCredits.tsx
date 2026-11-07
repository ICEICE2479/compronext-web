"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Loader2, QrCode, Ticket } from "lucide-react";
import { formatTHB } from "@/lib/format";
import { toast } from "@/lib/toast";

type Pack = { amount: number; credits: number };
type Order = { id: string; credits: number; amount: number; status: "unpaid" | "pending" | "approved" | "rejected"; createdAt: string };
type Info = { loggedIn: boolean; enabled: boolean; packs: Pack[]; balance: number; orders: Order[] };
type Pay = { id: string; amount: number; credits: number; qrSvg: string | null };

const STATUS: Record<Order["status"], string> = {
  unpaid: "รอจ่าย",
  pending: "รอตรวจยอด",
  approved: "เติมแล้ว",
  rejected: "ไม่ผ่าน",
};

async function postJson(body: object) {
  return fetch("/api/ai-credits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "เชื่อมต่อไม่สำเร็จ" }));
}

/** เลือกแพ็ก → สแกน QR พร้อมเพย์ → แนบสลิป → แจ้งโอน (แอดมินตรวจแล้วเครดิตเข้า) */
export function BuyCredits() {
  const [info, setInfo] = useState<Info | null>(null);
  const [pick, setPick] = useState(1);
  const [pay, setPay] = useState<Pay | null>(null);
  const [slip, setSlip] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/ai-credits", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d?.ok && setInfo(d as Info))
      .catch(() => {});
  useEffect(() => {
    void load();
  }, []);

  if (!info) return <p className="text-sm text-ink-500">กำลังโหลด…</p>;
  if (!info.loggedIn)
    return (
      <Link href="/login?next=/credits" className="btn btn-primary h-12 w-full">
        เข้าสู่ระบบเพื่อเติมเครดิต
      </Link>
    );

  async function order() {
    setBusy(true);
    const r = await postJson({ action: "order", pack: pick });
    setBusy(false);
    if (!r.ok) return toast(r.error || "สร้างรายการไม่สำเร็จ", { tone: "error" });
    setPay(r as Pay);
    void load();
  }

  async function reopen(id: string) {
    setBusy(true);
    const r = await postJson({ action: "qr", id });
    setBusy(false);
    if (!r.ok) return toast(r.error || "เปิด QR ไม่ได้", { tone: "error" });
    setPay(r as Pay);
  }

  async function paid() {
    if (!pay) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("action", "paid");
    fd.append("id", pay.id);
    if (slip) fd.append("slip", slip);
    const r = await fetch("/api/ai-credits", { method: "POST", body: fd })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "เชื่อมต่อไม่สำเร็จ" }));
    setBusy(false);
    if (!r.ok) return toast(r.error || "แจ้งโอนไม่สำเร็จ", { tone: "error" });
    setPay(null);
    setSlip(null);
    toast("แจ้งโอนแล้ว ทีมงานตรวจยอดแล้วเครดิตจะเข้าเอง");
    void load();
  }

  const pack = info.packs[pick] ?? info.packs[0];

  return (
    <div className="space-y-5">
      <p className="inline-flex items-center gap-2 rounded-full bg-info-bg px-4 py-2 text-sm font-bold text-info">
        <Ticket className="h-4 w-4" aria-hidden="true" /> เครดิตคงเหลือ {info.balance}
      </p>

      {!info.enabled ? (
        <p className="rounded-xl bg-warn-bg p-4 text-sm text-ink-800">ยังไม่เปิดรับชำระเงินออนไลน์ ติดต่อทีมงานทาง LINE ได้เลย</p>
      ) : pay ? (
        <div className="card space-y-3 p-5 text-center">
          <p className="font-display text-lg font-bold text-ink-950">สแกนจ่ายด้วยแอปธนาคาร</p>
          <p className="font-display text-3xl font-bold text-ink-950">{formatTHB(pay.amount)}</p>
          <p className="text-sm text-ink-600">ได้ {pay.credits} เครดิต</p>
          {pay.qrSvg && <div className="mx-auto w-56 rounded-2xl bg-white p-2 ring-1 ring-ink-200" dangerouslySetInnerHTML={{ __html: pay.qrSvg }} />}
          <p className="text-xs text-ink-600">
            พร้อมเพย์ · ยอดใส่ไว้ให้แล้ว · อ้างอิง <span className="font-mono">{pay.id}</span>
          </p>
          <label className="icon-btn mx-auto cursor-pointer">
            {slip ? <Check className="h-4 w-4 text-ok" /> : <QrCode className="h-4 w-4" />}
            <span className="text-sm font-semibold">{slip ? "แนบสลิปแล้ว" : "แนบสลิป (ช่วยให้ตรวจเร็วขึ้น)"}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setSlip(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" disabled={busy} onClick={paid} className="btn btn-primary h-12 w-full rounded-full disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "โอนแล้ว"}
          </button>
          <button type="button" onClick={() => setPay(null)} className="min-h-11 text-sm font-semibold text-ink-600">
            ไว้ทีหลัง
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="เลือกแพ็กเกจ">
            {info.packs.map((p, i) => (
              <button
                key={`${p.amount}-${p.credits}`}
                type="button"
                role="radio"
                aria-checked={pick === i}
                onClick={() => setPick(i)}
                className={`rounded-2xl border p-4 text-left transition-colors ${pick === i ? "border-info bg-info-bg" : "border-ink-200 hover:border-info"}`}
              >
                <span className="block font-display text-xl font-bold text-ink-950">{p.credits} เครดิต</span>
                <span className="block text-sm text-ink-700">{formatTHB(p.amount)}</span>
                <span className="block text-[11px] text-ink-500">ภาพละ {(p.amount / p.credits).toFixed(2)} บาท</span>
              </button>
            ))}
          </div>
          <button type="button" disabled={busy || !pack} onClick={order} className="btn btn-primary h-12 w-full rounded-full disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `จ่าย ${pack ? formatTHB(pack.amount) : ""} ด้วยพร้อมเพย์`}
          </button>
        </div>
      )}

      {info.orders.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-ink-950">รายการล่าสุด</h2>
          <ul className="divide-y divide-ink-100 rounded-2xl border border-ink-200 text-sm">
            {info.orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  {o.credits} เครดิต · {formatTHB(o.amount)}
                </span>
                {o.status === "unpaid" && info.enabled ? (
                  <button type="button" onClick={() => reopen(o.id)} className="text-xs font-semibold text-info">
                    รอจ่าย · เปิด QR
                  </button>
                ) : (
                  <span className={`text-xs font-semibold ${o.status === "approved" ? "text-ok" : o.status === "rejected" ? "text-bad" : "text-ink-600"}`}>
                    {STATUS[o.status]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
