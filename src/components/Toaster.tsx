"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { OPEN_CART_EVENT, openCartDrawer, TOAST_EVENT, type ToastDetail } from "@/lib/toast";

/** แจ้งเตือนสั้นๆ หลังทำรายการ — ด้านบนบนมือถือ (ไม่ทับแถบซื้อ/เมนูล่าง) ด้านล่างขวาบนจอใหญ่ */
export function Toaster() {
  const [items, setItems] = useState<ToastDetail[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const t = (e as CustomEvent<ToastDetail>).detail;
      setItems((list) => [...list.slice(-2), t]);
      window.setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), 2800);
    };
    const clear = () => setItems([]);
    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(OPEN_CART_EVENT, clear);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(OPEN_CART_EVENT, clear);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(4.25rem+env(safe-area-inset-top))] z-[70] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-auto lg:items-end"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className="toast pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-ink-950 px-4 py-3 text-sm text-white shadow-lg"
        >
          {t.tone === "error" ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-300" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
          )}
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action &&
            (t.action.href === "cart" ? (
              <button type="button" onClick={openCartDrawer} className="shrink-0 font-semibold underline underline-offset-2">
                {t.action.label}
              </button>
            ) : (
              <Link href={t.action.href} className="shrink-0 font-semibold underline underline-offset-2">
                {t.action.label}
              </Link>
            ))}
        </div>
      ))}
    </div>
  );
}
