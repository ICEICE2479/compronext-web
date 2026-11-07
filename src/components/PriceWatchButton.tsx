"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { toast } from "@/lib/toast";

/** ปุ่มกระดิ่ง: แจ้งเตือนทางอีเมลเมื่อสินค้าลดราคา */
export function PriceWatchButton({ productId }: { productId: string }) {
  const [state, setState] = useState<{ loggedIn: boolean; watching: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/price-watch?productId=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((d) => alive && setState({ loggedIn: !!d.loggedIn, watching: !!d.watching }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [productId]);

  if (!state) return null;
  if (!state.loggedIn) {
    return (
      <Link href="/login" className="icon-btn h-12 w-12 px-0" aria-label="เข้าสู่ระบบเพื่อรับแจ้งเตือนราคาลด" title="แจ้งเตือนเมื่อลดราคา">
        <Bell className="h-5 w-5" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/price-watch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        const d = await res.json().catch(() => ({}));
        if (d.ok) {
          setState({ loggedIn: true, watching: d.watching });
          toast(d.watching ? "จะแจ้งทางอีเมลเมื่อลดราคา" : "เลิกติดตามราคาแล้ว");
        } else toast(d.error || "ทำรายการไม่สำเร็จ", { tone: "error" });
        setBusy(false);
      }}
      aria-pressed={state.watching}
      aria-label={state.watching ? "เลิกติดตามราคา" : "แจ้งเตือนเมื่อลดราคา"}
      title={state.watching ? "กำลังติดตามราคา (กดเพื่อเลิก)" : "แจ้งเตือนเมื่อลดราคา"}
      className={`icon-btn h-12 w-12 px-0 ${state.watching ? "icon-btn-primary" : ""}`}
    >
      {state.watching ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
    </button>
  );
}
