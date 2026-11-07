"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cloud, FolderOpen, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";

type Rec = { id: string; name: string; code: string; updatedAt: string };

/** ห้อง 3D ที่บันทึกในบัญชี — เปิดจากเครื่องไหนก็ได้ */
export function PlanCloud({ loggedIn, code, onOpen }: { loggedIn: boolean; code: string; onOpen: (code: string) => void }) {
  const [plans, setPlans] = useState<Rec[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loggedIn || !open || plans) return;
    fetch("/api/room-plans", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPlans(d?.ok ? (d.plans as Rec[]).filter((p) => p.id !== "current") : []))
      .catch(() => setPlans([]));
  }, [loggedIn, open, plans]);

  if (!loggedIn)
    return (
      <p className="flex items-center gap-1.5 text-xs text-ink-600">
        <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/login?next=/design" className="font-semibold text-info">เข้าสู่ระบบ</Link> เพื่อเก็บห้องไว้ในบัญชี เปิดได้ทุกเครื่อง
      </p>
    );

  async function saveAs() {
    const name = window.prompt("ตั้งชื่อห้องนี้", "ห้องของฉัน");
    if (name === null) return;
    setBusy(true);
    const r = await fetch("/api/room-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, code }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false }));
    setBusy(false);
    if (!r.ok) return toast(r.error || "บันทึกไม่สำเร็จ", { tone: "error" });
    setPlans((list) => [r.plan as Rec, ...(list ?? [])]);
    toast("บันทึกห้องในบัญชีแล้ว");
  }

  async function remove(id: string) {
    setPlans((list) => list?.filter((p) => p.id !== id) ?? null);
    await fetch(`/api/room-plans?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
          <Cloud className="h-3.5 w-3.5 text-ok" aria-hidden="true" /> บันทึกในบัญชีอัตโนมัติ
        </span>
        <button type="button" disabled={busy} onClick={saveAs} className="chip h-9 rounded-full">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} บันทึกเป็นห้องใหม่
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="chip h-9 rounded-full">
          <FolderOpen className="h-3.5 w-3.5" /> ห้องที่บันทึกไว้
        </button>
      </div>
      {open && (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 text-sm">
          {!plans && <li className="p-3 text-ink-500">กำลังโหลด…</li>}
          {plans?.length === 0 && <li className="p-3 text-ink-500">ยังไม่มีห้องที่บันทึก</li>}
          {plans?.map((p) => (
            <li key={p.id} className="flex items-center gap-2 p-2">
              <button
                type="button"
                onClick={() => {
                  onOpen(p.code);
                  setOpen(false);
                }}
                className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left font-semibold text-ink-900 hover:bg-ink-50"
              >
                {p.name}
                <span className="ml-2 text-xs font-normal text-ink-500">
                  {new Date(p.updatedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                </span>
              </button>
              <button type="button" onClick={() => remove(p.id)} aria-label={`ลบ ${p.name}`} className="icon-btn h-9 w-9 border-transparent">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
