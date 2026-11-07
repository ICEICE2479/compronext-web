"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { useSession } from "@/lib/use-session";

/** ปุ่ม "ทักร้าน" — เปิดกล่องพิมพ์ข้อความแรก แล้วพาไปหน้าแชท */
export function ChatStoreButton({
  storeKey,
  storeName,
  productId,
  productName,
  className = "",
  compact = false,
}: {
  storeKey: string;
  storeName: string;
  productId?: string;
  productName?: string;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const loggedIn = !!useSession().user;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  function start() {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    setText(productName ? `สวัสดีครับ สนใจ "${productName.slice(0, 80)}" ยังมีของไหมครับ` : "สวัสดีครับ ");
    setOpen(true);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const d = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store: storeKey, text, productId }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
    setBusy(false);
    if (!d.ok) return toast(d.error || "ส่งข้อความไม่สำเร็จ", { tone: "error" });
    setOpen(false);
    router.push(`/messages?t=${encodeURIComponent(d.threadId)}`);
  }

  return (
    <>
      <button type="button" onClick={start} className={`icon-btn ${compact ? "h-12 w-12 px-0" : "h-11 px-4"} ${className}`} aria-label={`ทักร้าน ${storeName}`} title={`ทักร้าน ${storeName}`}>
        <MessageCircle className="h-5 w-5" />
        {!compact && <span className="text-sm font-semibold">ทักร้าน</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`ทักร้าน ${storeName}`}>
          <button type="button" aria-label="ปิด" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink-950/50" />
          <form onSubmit={send} className="sheet relative w-full max-w-md space-y-3 rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink-950">ทักร้าน {storeName}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="ปิด" className="icon-btn h-9 w-9 border-transparent p-0">
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} className="input resize-none" autoFocus />
            <p className="text-[11px] text-ink-500">ร้านจะตอบในหน้า “ข้อความ” ของคุณ อย่าส่งเลขบัตร/รหัส OTP ในแชท</p>
            <button type="submit" disabled={busy || !text.trim()} className="btn btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ส่งข้อความ
            </button>
          </form>
        </div>
      )}
    </>
  );
}
