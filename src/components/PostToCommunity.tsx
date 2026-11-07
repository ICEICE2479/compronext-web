"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Users, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { useFocusTrap } from "@/components/useFocusTrap";

/** ปุ่ม + หน้าต่างโพสต์ลงชุมชน (สเปกคอม หรือห้องที่ AI จัด) */
export function PostToCommunity({
  kind,
  selection,
  designId,
  defaultTitle = "",
  className = "chip rounded-full",
  label = "โพสต์ลงชุมชน",
}: {
  kind: "build" | "room";
  selection?: Record<string, string | null | undefined>;
  designId?: string;
  defaultTitle?: string;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open, () => setOpen(false));

  async function submit() {
    setBusy(true);
    const r = await fetch("/api/community", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, selection, designId, title, text }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "เชื่อมต่อไม่ได้" }));
    setBusy(false);
    if (r.needLogin) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
    if (!r.ok) return toast(r.error || "โพสต์ไม่สำเร็จ");
    setOpen(false);
    toast("โพสต์แล้ว");
    router.push(`/community/${r.id}`);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-haspopup="dialog">
        <Users className="h-4 w-4" aria-hidden="true" /> {label}
      </button>
      {open &&
        createPortal(
          <div ref={dialogRef} className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="โพสต์ลงชุมชน">
            <button type="button" aria-label="ปิด" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div className="scene-chip relative max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-pop)] sm:rounded-3xl">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-950">โพสต์{kind === "build" ? "สเปกนี้" : "ห้องนี้"}ลงชุมชน</p>
                <button type="button" onClick={() => setOpen(false)} aria-label="ปิด" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-info">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="ตั้งชื่อ เช่น สเปกเล่น Valorant 240fps งบ 30k" className="input" aria-label="ชื่อโพสต์" />
              <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} placeholder="เล่าเพิ่ม (ไม่บังคับ): ใช้ทำอะไร ทำไมเลือกชิ้นนี้" className="input min-h-24 py-2.5" aria-label="รายละเอียด" />
              <p className="text-xs text-ink-600">โพสต์จะแสดงชื่อบัญชีของคุณ ลบได้ทุกเมื่อ</p>
              <button type="button" disabled={busy || title.trim().length < 3} onClick={submit} className="btn btn-primary h-11 w-full rounded-full disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? "กำลังโพสต์…" : "โพสต์"}
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
