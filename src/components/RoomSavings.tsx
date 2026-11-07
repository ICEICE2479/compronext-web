"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, PiggyBank } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatTHB } from "@/lib/format";
import { AddToCartButton } from "@/components/AddToCartButton";
import { productToCartInput } from "@/components/ProductTile";

export interface RoomSwap {
  original: Product;
  alt: Product;
  quantity: number;
}

/** ของในห้องที่มีรุ่นใกล้เคียงถูกกว่า — เลือกสลับได้ แล้วใส่ตะกร้าทั้งห้องแบบประหยัด */
export function RoomSavings({ swaps, keep }: { swaps: RoomSwap[]; keep: Array<{ product: Product; quantity: number }> }) {
  const [on, setOn] = useState<string[]>(() => swaps.map((s) => s.original.id));
  if (!swaps.length) return null;
  const saved = swaps.filter((s) => on.includes(s.original.id)).reduce((t, s) => t + (s.original.price - s.alt.price) * s.quantity, 0);
  const cart = [
    ...keep.map((k) => productToCartInput(k.product, k.quantity)),
    ...swaps.map((s) => productToCartInput(on.includes(s.original.id) ? s.alt : s.original, s.quantity)),
  ];

  return (
    <section className="min-w-0 space-y-3 rounded-2xl border border-ink-200 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-ink-950">
            <PiggyBank className="h-4 w-4 text-ok" /> แต่งห้องนี้ให้ถูกลง
          </p>
          <p className="text-xs text-ink-600">รุ่นหมวดเดียวกัน สีใกล้กัน ราคาถูกกว่า — ติ๊กเลือกตัวที่อยากสลับ</p>
        </div>
        <span className="shrink-0 rounded-full bg-ok-bg px-2.5 py-1 text-xs font-bold text-ok">ประหยัด {formatTHB(saved)}</span>
      </div>
      <ul className="space-y-2">
        {swaps.map((s) => {
          const active = on.includes(s.original.id);
          return (
            <li key={s.original.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-200 p-2.5 has-[:checked]:border-ok">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => setOn((v) => (active ? v.filter((x) => x !== s.original.id) : [...v, s.original.id]))}
                  className="h-4 w-4 shrink-0 accent-[var(--color-ok)]"
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate text-ink-600 line-through decoration-ink-400">{s.original.name}</span>
                  <span className="flex min-w-0 items-center gap-1 text-ink-950">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ok" />
                    <Link href={`/products/${s.alt.id}`} className="min-w-0 truncate font-semibold hover:text-info" onClick={(e) => e.stopPropagation()}>
                      {s.alt.name}
                    </Link>
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className="block font-bold text-ink-950">{formatTHB(s.alt.price)}</span>
                  <span className="text-ok">−{formatTHB((s.original.price - s.alt.price) * s.quantity)}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <AddToCartButton item={cart} label={`ใส่ตะกร้าแบบประหยัด (${cart.length} ชิ้น)`} className="h-11 w-full" />
    </section>
  );
}
