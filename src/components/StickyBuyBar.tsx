"use client";

import { formatTHB } from "@/lib/format";
import type { CartInput } from "@/lib/cart-store";
import { AddToCartButton } from "@/components/AddToCartButton";

/** แถบราคา + ใส่ตะกร้า ติดล่างจอบนมือถือ (อยู่เหนือเมนูล่าง) */
export function StickyBuyBar({
  price,
  label,
  item,
  caption,
}: {
  price: number;
  label: string;
  item: CartInput | CartInput[];
  caption?: string;
}) {
  return (
    <>
    {/* กันเนื้อหาท้ายหน้าโดนแถบบัง */}
    <div aria-hidden className="h-16 lg:hidden" />
    <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t border-ink-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight text-ink-950">{formatTHB(price)}</p>
          {caption && <p className="truncate text-[11px] text-ink-500">{caption}</p>}
        </div>
        <AddToCartButton item={item} label={label} className="h-11 px-5" />
      </div>
    </div>
    </>
  );
}
