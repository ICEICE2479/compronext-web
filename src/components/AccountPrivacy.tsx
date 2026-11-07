"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, ShieldCheck, Trash2 } from "lucide-react";

/** สิทธิ์ของเจ้าของข้อมูล (PDPA): ดาวน์โหลดข้อมูลของฉัน + ลบบัญชีถาวร */
export function AccountPrivacy({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function remove() {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/account/data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: text.trim() }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "เชื่อมต่อไม่ได้" }));
    setBusy(false);
    if (!r.ok) return setErr(r.error || "ลบไม่สำเร็จ");
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith("compronext")) localStorage.removeItem(k);
      for (const k of await caches.keys()) if (k.startsWith("cn-pages-")) await caches.delete(k);
    } catch {
      /* ไม่รองรับ */
    }
    onDeleted();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-ink-200 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
        <ShieldCheck className="h-4 w-4 text-ok" /> ข้อมูลส่วนตัวของฉัน
      </p>
      <p className="text-xs text-ink-600">
        ดูว่าเราเก็บอะไรบ้างได้ที่{" "}
        <Link href="/privacy" className="font-semibold text-info underline-offset-2 hover:underline">
          นโยบายความเป็นส่วนตัว
        </Link>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a href="/api/account/data" className="btn btn-outline tap-target flex-1">
          <Download className="h-4 w-4" /> ดาวน์โหลดข้อมูลของฉัน
        </a>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="btn btn-outline tap-target flex-1 text-bad">
          <Trash2 className="h-4 w-4" /> ลบบัญชี
        </button>
      </div>
      {open && (
        <div className="space-y-2 rounded-xl bg-bad-bg p-3">
          <p className="text-xs text-ink-800">
            จะลบโปรไฟล์ ตะกร้า ของที่บันทึก รีวิว แชท ห้องที่ AI จัด และการแจ้งเตือนทั้งหมด <strong>กู้คืนไม่ได้</strong> พิมพ์คำว่า{" "}
            <strong>ลบบัญชี</strong> เพื่อยืนยัน
          </p>
          <input value={text} onChange={(e) => setText(e.target.value)} className="input" aria-label="พิมพ์ ลบบัญชี เพื่อยืนยัน" placeholder="ลบบัญชี" />
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <button type="button" disabled={busy || text.trim() !== "ลบบัญชี"} aria-busy={busy} onClick={remove} className="btn h-11 w-full rounded-full bg-bad text-paper disabled:opacity-50">
            {busy ? "กำลังลบ…" : "ลบบัญชีถาวร"}
          </button>
        </div>
      )}
    </div>
  );
}
