"use client";

import { useEffect } from "react";

/** นับยอดดูสินค้าจากเบราว์เซอร์ (ไม่ระบุตัวตน) — ให้หน้าสินค้าแคชได้ */
export function ViewBeacon({ productId }: { productId: string }) {
  useEffect(() => {
    const body = JSON.stringify({ event: "product_view", id: productId });
    try {
      if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
    } catch {
      /* ใช้ fetch แทน */
    }
    fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, [productId]);
  return null;
}
