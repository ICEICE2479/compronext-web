"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart-store";
import { compatAgainstItems, type CompatStatus } from "@/lib/compatibility";
import type { Product } from "@/lib/types";

const LABEL: Record<CompatStatus, { text: string; cls: string }> = {
  pass: { text: "ผ่าน", cls: "bg-success-bg text-success" },
  fail: { text: "ไม่ผ่าน", cls: "bg-red-50 text-red-600" },
  insufficient: { text: "ข้อมูลไม่พอ", cls: "bg-warn-bg text-ink-800" },
};

/** แถว "ใช้ร่วมกับของในตะกร้าได้ไหม" — เทียบจากข้อมูลจริงของสินค้า ซ่อนเมื่อไม่มีของให้เทียบ */
export function WorthItCompat({ product }: { product: Product }) {
  const { items } = useCart();
  // ดึงข้อมูลเฉพาะของในตะกร้า (ไม่ส่งสินค้าทั้งร้านมากับหน้า — หน้าเบาลงมาก)
  const key = items.map((i) => i.id).filter((id) => id !== product.id).sort().join(",");
  const [pool, setPool] = useState<{ key: string; items: Product[] }>({ key: "", items: [] });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetch(`/api/products?ids=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Product[] }) => alive && setPool({ key, items: d.items ?? [] }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  const result = useMemo(() => {
    if (!key || pool.key !== key) return null;
    const others = pool.items.filter((p) => p.id !== product.id);
    if (others.length === 0) return null;
    return compatAgainstItems(product, others);
  }, [key, pool, product]);

  if (!result) return null;
  const label = LABEL[result.overall];

  return (
    <div>
      <dt className="font-semibold text-ink-950">ใช้ร่วมกับของในตะกร้าได้ไหม</dt>
      <dd className="space-y-1 text-ink-700">
        <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-bold ${label.cls}`}>{label.text}</span>
        <ul className="space-y-0.5 text-xs">
          {result.checks.map((c) => (
            <li key={c.id}>
              {c.title}: {c.detail}
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-500">ตรวจจากข้อมูลที่มี ควรเช็กสเปกกับร้านอีกครั้งก่อนซื้อ</p>
      </dd>
    </div>
  );
}
