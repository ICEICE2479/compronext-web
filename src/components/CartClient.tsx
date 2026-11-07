"use client";

import { AffiliateNote } from "./AffiliateNote";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Minus, Plus, Scissors, ShoppingBag, Store, Trash2, Truck } from "lucide-react";
import { readBudget, writeBudget } from "@/lib/budget-store";
import { planPurchases } from "@/lib/buy-plan";
import { clearCart, setCartQuantity, useCart, type CartItem } from "@/lib/cart-store";
import { formatTHB } from "@/lib/format";
import { isSafeHttpUrl } from "@/lib/links";
import { ProductVisual } from "@/components/ProductVisual";
import EmptyState from "@/components/EmptyState";
import { shippingFor, useShippingRules } from "@/lib/shipping";

export function CartClient() {
  const { items, count, total } = useCart();
  const rules = useShippingRules();
  const [budget, setBudget] = useState<number | null>(null);
  const [budgetText, setBudgetText] = useState("");
  const [trimOpen, setTrimOpen] = useState(false);
  const trimPanelRef = useRef<HTMLDivElement>(null);
  const trimTriggerRef = useRef<HTMLButtonElement>(null);
  const budgetInputRef = useRef<HTMLInputElement>(null);
  const wasTrimOpen = useRef(false);

  useEffect(() => {
    if (trimOpen) trimPanelRef.current?.focus();
    else if (wasTrimOpen.current) (trimTriggerRef.current ?? budgetInputRef.current)?.focus();
    wasTrimOpen.current = trimOpen;
  }, [trimOpen]);

  useEffect(() => {
    // อ่านจาก localStorage หลัง mount เพื่อไม่ให้ hydration ไม่ตรงกัน
    const b = readBudget();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBudget(b);
    setBudgetText(b ? String(b) : "");
  }, []);

  function saveBudget(text: string) {
    setBudgetText(text);
    const v = Number(text);
    if (!text) {
      setBudget(null);
      writeBudget(null);
    } else if (Number.isFinite(v) && v > 0) {
      setBudget(Math.round(v));
      writeBudget(v);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" aria-hidden="true" />}
          title="ตะกร้ายังว่าง"
          description="เลือกสินค้าหรือให้ AI จัดห้องให้ แล้วเพิ่มลงตะกร้าได้เลย"
          action={{ label: "เลือกสินค้า", href: "/categories" }}
        />
        <div className="mt-2 flex justify-center">
          <Link href="/design" className="btn btn-outline">ให้ AI จัดห้อง</Link>
        </div>
      </div>
    );
  }

  const byStore = items.reduce<Record<string, CartItem[]>>((acc, it) => {
    (acc[it.storeName || "ร้านค้า"] ??= []).push(it);
    return acc;
  }, {});
  const subtotalOf = (list: CartItem[]) => list.reduce((s, x) => s + x.price * x.quantity, 0);
  const shipTotal = Object.entries(byStore).reduce((s, [store, list]) => s + (shippingFor(rules?.[store], subtotalOf(list)) ?? 0), 0);

  const plan = planPurchases(items, budget);
  const grand = total + shipTotal;
  const pct = budget ? Math.min(100, Math.round((grand / budget) * 100)) : 0;
  const over = budget ? grand > budget : false;

  function removeLater() {
    for (const it of plan.later) setCartQuantity(it.id, 0);
    setTrimOpen(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12 items-start">
      <div className="space-y-4 lg:col-span-8 min-w-0">
        <AffiliateNote />
        {Object.entries(byStore).map(([store, list]) => (
          <section key={store} className="card p-4 sm:p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink-950">
              <Store className="h-4 w-4 text-info" />
              {store}
              <span className="ml-auto text-sm text-info">
                {formatTHB(subtotalOf(list))}
              </span>
            </h2>
            <ul className="divide-y divide-ink-100">
              {list.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-3">
                  <Link href={`/products/${it.id}`} className="shrink-0">
                    <ProductVisual productId={it.id} name={it.name} category="other" imageUrl={it.imageUrl} size="sm" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${it.id}`} className="line-clamp-2 text-sm font-semibold text-ink-950 hover:text-info">
                      {it.name}
                    </Link>
                    <p className="text-sm font-bold text-info">{formatTHB(it.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="ลดจำนวน"
                      onClick={() => setCartQuantity(it.id, it.quantity - 1)}
                      className="btn btn-outline h-10 w-10 p-0"
                    >
                      {it.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    </button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{it.quantity}</span>
                    <button
                      type="button"
                      aria-label="เพิ่มจำนวน"
                      onClick={() => setCartQuantity(it.id, it.quantity + 1)}
                      className="btn btn-outline h-10 w-10 p-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {isSafeHttpUrl(it.buyUrl) && (
                    <a
                      href={`/go/${encodeURIComponent(it.id)}`}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      aria-label={`ซื้อที่ ${store}`}
                      title={`ซื้อที่ ${store}`}
                      className="btn btn-primary h-10 w-10 p-0 shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {(() => {
              const sub = subtotalOf(list);
              const rule = rules?.[store];
              const ship = shippingFor(rule, sub);
              return (
                <p className="flex items-center gap-1.5 border-t border-ink-100 pt-2 text-xs text-ink-600">
                  <Truck className="h-3.5 w-3.5" />
                  {ship === null
                    ? "ค่าส่ง: ดูที่ร้าน"
                    : ship === 0
                      ? "ส่งฟรี"
                      : `ค่าส่ง ${formatTHB(ship)}${rule?.freeMin ? ` · ซื้อเพิ่ม ${formatTHB(rule.freeMin - sub)} ส่งฟรี` : ""}`}
                </p>
              );
            })()}
          </section>
        ))}
      </div>

      <aside className="card p-5 space-y-4 lg:col-span-4 lg:sticky lg:top-24">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-600">{count} ชิ้น · {Object.keys(byStore).length} ร้าน</span>
          <span className="font-display text-2xl font-bold text-ink-950">{formatTHB(grand)}</span>
        </div>
        <div className="space-y-2 rounded-xl bg-ink-50 p-3">
          <label htmlFor="cart-budget" className="text-xs font-semibold text-ink-700">ยอดรวมเทียบงบ</label>
          <input
            ref={budgetInputRef}
            id="cart-budget"
            type="number"
            inputMode="numeric"
            min={0}
            value={budgetText}
            onChange={(e) => saveBudget(e.target.value)}
            placeholder="ใส่งบ (บาท)"
            className="input w-full"
          />
          {budget && (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-ink-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="ยอดรวมเทียบงบ">
                <div className={`h-full rounded-full ${over ? "bg-red-500" : "bg-info"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`text-xs ${over ? "font-semibold text-red-600" : "text-ink-600"}`}>
                {over ? `เกินงบ ${formatTHB(grand - budget)}` : `เหลืออีก ${formatTHB(budget - grand)}`} ({formatTHB(grand)} / {formatTHB(budget)})
              </p>
            </>
          )}
          {budget && plan.later.length > 0 && (
            <button ref={trimTriggerRef} type="button" onClick={() => setTrimOpen(true)} aria-expanded={trimOpen} className="btn btn-outline w-full">
              <Scissors className="h-4 w-4" aria-hidden="true" />
              <span>ตัดของที่ไม่จำเป็นออก</span>
            </button>
          )}
          {trimOpen && plan.later.length > 0 && (
            <div ref={trimPanelRef} tabIndex={-1} aria-labelledby="cart-trim-title" className="space-y-2 rounded-lg border border-ink-200 bg-white p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-info">
              <p id="cart-trim-title" className="text-xs font-semibold text-ink-950">ซื้อทีหลังได้ — เอาออกจากตะกร้า {plan.later.length} รายการ?</p>
              <ul className="space-y-1 text-xs text-ink-700">
                {plan.later.map((it) => (
                  <li key={it.id} className="flex justify-between gap-2">
                    <span className="line-clamp-1">{it.name}</span>
                    <span className="shrink-0">{formatTHB(it.price * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button type="button" onClick={removeLater} className="btn btn-primary flex-1">เอาออก</button>
                <button type="button" onClick={() => setTrimOpen(false)} className="btn btn-outline flex-1">ยกเลิก</button>
              </div>
            </div>
          )}
        </div>
        {shipTotal > 0 && <p className="text-xs text-ink-500">รวมค่าส่งที่ร้านระบุไว้ {formatTHB(shipTotal)}</p>}
        <p className="text-xs text-ink-500 leading-relaxed">
          กดปุ่ม <ExternalLink className="inline h-3 w-3" /> ที่สินค้าแต่ละชิ้นเพื่อชำระเงินที่ร้านค้าโดยตรง
          ราคาอาจต่างจากที่ร้าน · การจัดส่งและรับประกันเป็นไปตามเงื่อนไขของร้าน
        </p>
        <button type="button" onClick={clearCart} className="btn btn-outline w-full">
          <Trash2 className="h-4 w-4" />
          <span>ล้างตะกร้า</span>
        </button>
      </aside>
    </div>
  );
}
