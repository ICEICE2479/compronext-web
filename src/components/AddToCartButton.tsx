"use client";

import { analyticsAllowed } from "@/lib/consent";
import { useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { addToCart, type CartInput } from "@/lib/cart-store";
import { toast } from "@/lib/toast";

/** ปุ่มไอคอนใส่ตะกร้า — แสดงเครื่องหมายถูกชั่วครู่หลังกด */
export function AddToCartButton({
  item,
  label,
  className = "",
  category,
}: {
  item: CartInput | CartInput[];
  /** หมวดสินค้า — ถูกใส่ให้ทุกชิ้นที่ยังไม่มีหมวด */
  category?: string;
  /** ถ้าไม่ใส่จะเป็นปุ่มไอคอนอย่างเดียว */
  label?: string;
  className?: string;
}) {
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const withCat = (x: CartInput): CartInput => (category && !x.category ? { ...x, category } : x);
        addToCart(Array.isArray(item) ? item.map(withCat) : withCat(item));
        try {
          const ids = (Array.isArray(item) ? item : [item]).map((x) => x.id);
          if (analyticsAllowed()) navigator.sendBeacon?.("/api/track", new Blob([JSON.stringify({ ids })], { type: "application/json" }));
        } catch {
          // ไม่เป็นไร ถ้านับไม่ได้
        }
        const n = Array.isArray(item) ? item.length : 1;
        toast(n > 1 ? `ใส่ตะกร้าแล้ว ${n} ชิ้น` : "ใส่ตะกร้าแล้ว", { action: { label: "ดูตะกร้า", href: "cart" } });
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1200);
      }}
      aria-label={label ?? "ใส่ตะกร้า"}
      title={label ?? "ใส่ตะกร้า"}
      className={`icon-btn icon-btn-primary ${added ? "is-done" : ""} ${className}`}
    >
      {added ? <Check className="h-4 w-4 motion-safe:animate-[pop_300ms_var(--ease-spring)]" /> : <ShoppingCart className="h-4 w-4" />}
      {label && <span>{added ? "เพิ่มแล้ว" : label}</span>}
    </button>
  );
}
