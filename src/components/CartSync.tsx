"use client";

import { useEffect } from "react";
import { getCartSnapshot, replaceCart, subscribeCart, type CartItem } from "@/lib/cart-store";

/** ซิงก์ตะกร้าในเบราว์เซอร์กับบัญชีสมาชิก (ล็อกอินเครื่องไหนก็เห็นตะกร้าเดียวกัน) */
export function CartSync() {
  useEffect(() => {
    let timer: number | undefined;
    let ready = false;

    const push = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const items = getCartSnapshot().map(({ id, quantity }) => ({ id, quantity }));
        fetch("/api/cart", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        }).catch(() => {});
      }, 1500);
    };

    fetch("/api/cart")
      .then((r) => r.json())
      .then((data: { ok: boolean; items?: CartItem[] }) => {
        if (!data.ok) return;
        const merged = new Map(getCartSnapshot().map((x) => [x.id, x]));
        for (const s of data.items ?? []) {
          const local = merged.get(s.id);
          merged.set(s.id, local ? { ...local, quantity: Math.max(local.quantity, s.quantity) } : s);
        }
        replaceCart(Array.from(merged.values()));
        push();
      })
      .catch(() => {})
      .finally(() => {
        ready = true;
      });

    const unsub = subscribeCart(() => {
      if (ready) push();
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
