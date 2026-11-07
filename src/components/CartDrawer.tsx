"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Minus, Plus, ShoppingBag, Store, Trash2, Truck, X } from "lucide-react";
import { setCartQuantity, useCart, type CartItem } from "@/lib/cart-store";
import { formatTHB } from "@/lib/format";
import { isSafeHttpUrl } from "@/lib/links";
import { shippingFor, useShippingRules } from "@/lib/shipping";
import { OPEN_CART_EVENT } from "@/lib/toast";
import { ProductVisual } from "@/components/ProductVisual";
import { useFocusTrap } from "@/components/useFocusTrap";

/** ตะกร้าแบบเลื่อนออกจากด้านขวา — เปิดจากไอคอนตะกร้าที่หัวเว็บ หรือจาก toast */
export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const pathname = usePathname();
  const { items, count, total } = useCart();
  const rules = useShippingRules();

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setOpenedAt(window.location.pathname);
    };
    window.addEventListener(OPEN_CART_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CART_EVENT, onOpen);
  }, []);

  // ปิดเมื่อเปลี่ยนหน้า (เช่น กดลิงก์สินค้าในตะกร้า)
  const visible = open && openedAt === pathname;

  const panelRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useFocusTrap(panelRef, visible, close);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible) return null;

  const byStore = items.reduce<Record<string, CartItem[]>>((acc, it) => {
    (acc[it.storeName || "ร้านค้า"] ??= []).push(it);
    return acc;
  }, {});
  const stores = Object.entries(byStore).map(([store, list]) => {
    const subtotal = list.reduce((s, x) => s + x.price * x.quantity, 0);
    return { store, list, subtotal, ship: shippingFor(rules?.[store], subtotal), rule: rules?.[store] };
  });
  const shipKnown = stores.reduce((s, x) => s + (x.ship ?? 0), 0);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
      <button type="button" aria-label="ปิดตะกร้า" tabIndex={-1} className="absolute inset-0 bg-ink-950/50" onClick={close} />
      <aside ref={panelRef} className="drawer-right absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-pop">
        <header className="flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-3">
          <h2 id="cart-drawer-title" className="font-display text-lg font-bold text-ink-950">
            ตะกร้า <span className="text-ink-500 tabular-nums">({count})</span>
          </h2>
          <button type="button" className="icon-btn tap-target border-transparent" aria-label="ปิดตะกร้า" onClick={close}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="empty-state flex-1">
            <span className="empty-state-icon" aria-hidden="true">
              <ShoppingBag size={26} />
            </span>
            <p className="empty-state-title">ตะกร้ายังว่าง</p>
            <p className="empty-state-text">เลือกสินค้าที่ชอบ หรือให้ AI ช่วยจัดห้องให้</p>
            <Link href="/design" className="btn btn-primary mt-2 min-h-11">ให้ AI จัดห้อง</Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
              {stores.map(({ store, list, subtotal, ship, rule }) => (
                <section key={store} className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-ink-950">
                    <Store className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                    <span className="min-w-0 truncate">{store}</span>
                    <span className="ml-auto shrink-0 tabular-nums">{formatTHB(subtotal)}</span>
                  </h3>
                  <ul className="divide-y divide-ink-200 rounded-card border border-ink-200">
                    {list.map((it) => (
                      <li key={it.id} className="flex items-center gap-3 p-3">
                        <ProductVisual productId={it.id} name={it.name} category="other" imageUrl={it.imageUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/products/${it.id}`} className="line-clamp-2 text-sm font-semibold text-ink-950 hover:text-info">
                            {it.name}
                          </Link>
                          <p className="mt-0.5 text-sm font-bold text-ink-900 tabular-nums">{formatTHB(it.price)}</p>
                        </div>
                        <div className="flex shrink-0 items-center" role="group" aria-label={`จำนวน ${it.name}`}>
                          <button type="button" aria-label={it.quantity === 1 ? "ลบออกจากตะกร้า" : "ลดจำนวน"} className="icon-btn tap-target border-transparent p-0" onClick={() => setCartQuantity(it.id, it.quantity - 1)}>
                            {it.quantity === 1 ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : <Minus className="h-4 w-4" aria-hidden="true" />}
                          </button>
                          <span className="w-6 text-center text-sm font-bold tabular-nums" aria-live="polite">{it.quantity}</span>
                          <button type="button" aria-label="เพิ่มจำนวน" className="icon-btn tap-target border-transparent p-0" onClick={() => setCartQuantity(it.id, it.quantity + 1)}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                    <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                    {ship === null
                      ? "ค่าส่ง: ดูที่ร้าน"
                      : ship === 0
                        ? "ส่งฟรี"
                        : `ค่าส่ง ${formatTHB(ship)}${rule?.freeMin ? ` · ซื้อเพิ่ม ${formatTHB(rule.freeMin - subtotal)} ส่งฟรี` : ""}`}
                    {isSafeHttpUrl(list[0]?.buyUrl) && list.length === 1 && (
                      <a href={`/go/${encodeURIComponent(list[0].id)}`} target="_blank" rel="noopener noreferrer sponsored" className="ml-auto inline-flex min-h-11 items-center gap-1 font-semibold text-info hover:underline">
                        ซื้อที่ร้าน <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        <span className="sr-only">(เปิดแท็บใหม่)</span>
                      </a>
                    )}
                  </p>
                </section>
              ))}
            </div>

            <footer className="space-y-3 border-t border-ink-200 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-600">
                  รวม{shipKnown > 0 ? ` (ค่าส่ง ${formatTHB(shipKnown)})` : ""}
                </span>
                <span className="font-display text-2xl font-bold text-ink-950">{formatTHB(total + shipKnown)}</span>
              </div>
              <Link href="/cart" className="btn btn-primary h-12 w-full">
                ไปชำระเงินที่ร้าน
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
