"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, Check, ChevronDown, ExternalLink, Info, Plus, Scale, Search, Target, Trash2, Trophy, X, Zap } from "lucide-react";
import { useCompareProducts } from "@/lib/compare-store";
import { UNKNOWN_BRAND } from "@/lib/catalog-taxonomy";
import { formatTHB } from "@/lib/format";
import { ProductVisual } from "@/components/ProductVisual";
import { AddToCartButton } from "@/components/AddToCartButton";
import type { ProductCategory } from "@/lib/types";
import { insightFor, KIND_EXPLAIN, type Insight } from "@/lib/product-insights";
import { compareRows, SPEC_EXPLAIN, verdict } from "@/lib/compare-score";

export interface CompareItem {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  imageUrl: string | null;
  sourceImageUrl?: string | null;
  store: string;
  brand: string;
  kind: string;
  specs: Array<[string, string]>;
  /** คำนวณในเบราว์เซอร์เฉพาะตัวที่เลือก (ไม่ส่งมากับหน้า — หน้าเบาลง) */
  insight?: Insight;
  hasBuyUrl: boolean;
}

const KIND_ORDER = ["ซีพียู", "การ์ดจอ", "แรม", "SSD/HDD", "เมนบอร์ด", "พาวเวอร์ซัพพลาย", "ระบายความร้อน", "เคส", "คอมประกอบ", "โน้ตบุ๊ก", "จอ", "คีย์บอร์ด", "เมาส์", "หูฟัง", "ไมโครโฟน"];

export function CompareClient() {
  const { ids, toggle, remove, clear, max } = useCompareProducts();
  const [items, setItems] = useState<CompareItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch("/api/compare-items")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: CompareItem[] }) => alive && setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  const [query, setQuery] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);
  // ค้นหา: หน่วง 200ms + deferred ให้ช่องพิมพ์ลื่น
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 200);
    return () => window.clearTimeout(t);
  }, [query]);
  const searchQuery = useDeferredValue(debouncedQuery);

  const byId = useMemo(() => new Map(items.map((p) => [p.id, p])), [items]);
  const selected = useMemo(
    () =>
      ids
        .map((id) => byId.get(id))
        .filter((p): p is CompareItem => !!p)
        .map((p) => ({ ...p, insight: p.insight ?? insightFor(p.kind, p.name, p.specs) })),
    [ids, byId]
  );
  const currentKind = selected[0]?.kind ?? null;
  const [kind, setKind] = useState<string | null>(null);
  const activeKind = kind ?? currentKind ?? "ซีพียู";

  const kinds = useMemo(() => {
    const set = new Set(items.map((p) => p.kind));
    return KIND_ORDER.filter((k) => set.has(k));
  }, [items]);

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const taken = new Set(ids);
    return items
      .filter((p) => !taken.has(p.id))
      .filter((p) => (q ? `${p.name} ${p.brand}`.toLowerCase().includes(q) : p.kind === activeKind))
      .slice(0, 12);
  }, [items, ids, searchQuery, activeKind]);

  // แถวสเปก: รวมทุกหัวข้อของสินค้าที่เลือก
  const rows = useMemo(() => {
    const labels: string[] = [];
    for (const p of selected) for (const [k] of p.specs) if (!labels.includes(k)) labels.push(k);
    return labels.map((label) => ({
      label,
      values: selected.map((p) => p.specs.find(([k]) => k === label)?.[1] ?? "—"),
    }));
  }, [selected]);
  const results = useMemo(() => compareRows(rows), [rows]);
  const shownRows = useMemo(() => (onlyDiff ? results.filter((r) => new Set(r.values).size > 1) : results), [results, onlyDiff]);
  const v = useMemo(() => (selected.length > 1 ? verdict(selected.map((p) => p.price), results) : null), [selected, results]);
  const rankable = results.filter((r) => r.best.length).length;
  const minPrice = useMemo(() => (selected.length > 1 ? Math.min(...selected.map((p) => p.price)) : null), [selected]);
  const mixed = useMemo(() => new Set(selected.map((p) => p.kind)).size > 1, [selected]);
  const full = ids.length >= max;

  return (
    <div className="container-page space-y-6 py-6 sm:py-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">เทียบคอม & อุปกรณ์</h1>
          <p className="text-sm text-ink-600">เลือกได้สูงสุด {max} ชิ้น · ชนิดเดียวกันจะเห็นความต่างชัดที่สุด</p>
        </div>
        {selected.length > 0 && (
          <button type="button" onClick={clear} className="icon-btn shrink-0" aria-label="ล้างทั้งหมด" title="ล้างทั้งหมด">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* การ์ดเทียบ — หัวข้อเดียวกันอยู่แนวเดียวกัน (subgrid) เลื่อนซ้ายขวาบนมือถือ */}
      {selected.length > 0 && (
        <section className="space-y-3">
          {mixed && (
            <p className="flex items-center gap-2 rounded-xl bg-warn-bg px-3 py-2 text-xs text-ink-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warn" /> กำลังเทียบของต่างชนิดกัน บางหัวข้อจะเทียบกันไม่ได้
            </p>
          )}
          {!mixed && currentKind && KIND_EXPLAIN[currentKind] && (
            <details className="group rounded-2xl bg-info-bg/60 px-4 py-2.5 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink-900">
                <Info className="h-4 w-4 text-info" /> {currentKind} ทำงานยังไง
                <ChevronDown className="ml-auto h-4 w-4 text-ink-500 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-1.5 leading-relaxed text-ink-700">{KIND_EXPLAIN[currentKind]}</p>
            </details>
          )}

          {v && (
            <div className="rounded-2xl border border-ink-200 bg-surface p-4">
              <p className="flex items-center gap-2 font-display text-base font-bold text-ink-950">
                <Scale className="h-5 w-5 text-info" /> สรุปผลเทียบ
              </p>
              <ul className="mt-2.5 space-y-2 text-sm text-ink-800">
                <li className="flex gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                  <span>
                    <b>ถูกสุด:</b> {selected[v.cheapest].name} ({formatTHB(selected[v.cheapest].price)})
                  </span>
                </li>
                {v.strongest !== null && (
                  <li className="flex gap-2">
                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                    <span>
                      <b>สเปกดีสุด:</b> {selected[v.strongest].name} — ชนะ {v.wins[v.strongest]}/{rankable} หัวข้อ
                      {v.priceDiff[v.strongest].baht > 0 && ` · แพงกว่า ${formatTHB(v.priceDiff[v.strongest].baht)} (+${v.priceDiff[v.strongest].pct}%)`}
                    </span>
                  </li>
                )}
                {v.bestValue !== null && v.bestValue !== v.cheapest && (
                  <li className="flex gap-2">
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                    <span>
                      <b>คุ้มสุด (สเปกต่อราคา):</b> {selected[v.bestValue].name}
                    </span>
                  </li>
                )}
                <li className="flex gap-2 text-ink-600">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {v.strongest !== null && v.strongest !== v.cheapest
                      ? "งบจำกัด → เอาตัวถูกสุด · อยากได้แรงสุดและจ่ายเพิ่มไหว → เอาตัวสเปกดีสุด"
                      : v.strongest === v.cheapest && v.strongest !== null
                        ? "ตัวถูกสุดสเปกก็ดีสุด — เลือกตัวนี้ได้เลย"
                        : "สเปกที่เทียบได้ใกล้เคียงกัน ดูราคา ร้าน และข้อดีด้านล่างประกอบ"}
                  </span>
                </li>
              </ul>
            </div>
          )}

          <div className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:px-0">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${selected.length + (full ? 0 : 1)}, min(78vw, 264px))` }}
            >
              {selected.map((p, idx) => {
                const cheapest = p.price === minPrice;
                return (
                  <article key={p.id} className={`compare-card animate-reveal row-span-6 grid snap-start grid-rows-subgrid gap-0 overflow-hidden rounded-3xl border bg-surface ${v && (v.strongest === idx || v.bestValue === idx) ? "border-info/60 ring-1 ring-info/20" : "border-ink-200"}`}>
                    {/* 1. รูป + ชื่อ */}
                    <div className="relative p-3 pb-2">
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="absolute right-2 top-2 z-[1] flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-ink-600 shadow-sm hover:text-bad"
                        aria-label={`เอา ${p.name} ออก`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <Link href={`/products/${p.id}`} className="block">
                        <div className="relative mx-auto aspect-[4/3] w-full">
                          <ProductVisual productId={p.id} name={p.name} category={p.category} imageUrl={p.imageUrl} photoUrl={p.sourceImageUrl} size="tile" transparentBg />
                        </div>
                        <p className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-ink-950">{p.name}</p>
                        <p className="mt-0.5 text-[11px] text-ink-500">
                          {p.kind}
                          {p.brand !== UNKNOWN_BRAND ? ` · ${p.brand}` : ""} · {p.store}
                        </p>
                      </Link>
                    </div>
                    {/* 2. ราคา */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-2">
                      <span className={`whitespace-nowrap font-display text-xl font-bold ${cheapest ? "text-ok" : "text-ink-950"}`}>{formatTHB(p.price)}</span>
                      {cheapest && <span className="whitespace-nowrap rounded-full bg-ok-bg px-2 py-0.5 text-[10px] font-bold text-ok">ถูกสุด</span>}
                      {v && v.strongest === idx && <span className="whitespace-nowrap rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-bold text-warn">สเปกดีสุด</span>}
                      {v && v.bestValue === idx && !cheapest && <span className="whitespace-nowrap rounded-full bg-info-bg px-2 py-0.5 text-[10px] font-bold text-info">คุ้มสุด</span>}
                      {v && v.priceDiff[idx].baht > 0 && (
                        <span className="w-full text-[11px] text-ink-500">แพงกว่าตัวถูกสุด {formatTHB(v.priceDiff[idx].baht)} (+{v.priceDiff[idx].pct}%)</span>
                      )}
                    </div>
                    {/* 3. เหมาะกับ */}
                    <div className="border-t border-ink-100 px-3 py-2.5 text-sm">
                      <p className="flex items-start gap-1.5 text-ink-800">
                        <Target className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                        <span>
                          <span className="text-ink-500">เหมาะกับ </span>
                          {p.insight?.fit ?? "ใช้งานทั่วไป"}
                        </span>
                      </p>
                    </div>
                    {/* 4. ข้อดี */}
                    <ul className="space-y-1.5 border-t border-ink-100 px-3 py-2.5 text-sm">
                      <li className="text-[11px] font-semibold uppercase tracking-wide text-ok">ข้อดี</li>
                      {p.insight?.pros.length ? (
                        p.insight.pros.map((t) => (
                          <li key={t} className="flex gap-1.5 text-ink-800">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> {t}
                          </li>
                        ))
                      ) : (
                        <li className="text-ink-400">—</li>
                      )}
                    </ul>
                    {/* 5. ข้อควรรู้ */}
                    <ul className="space-y-1.5 border-t border-ink-100 px-3 py-2.5 text-sm">
                      <li className="text-[11px] font-semibold uppercase tracking-wide text-warn">ข้อควรรู้</li>
                      {p.insight?.cons.length ? (
                        p.insight.cons.map((t) => (
                          <li key={t} className="flex gap-1.5 text-ink-800">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" /> {t}
                          </li>
                        ))
                      ) : (
                        <li className="text-ink-400">—</li>
                      )}
                    </ul>
                    {/* 6. สเปก + ปุ่ม */}
                    <div className="flex flex-col border-t border-ink-100 px-3 py-2.5">
                      <dl className="flex-1 space-y-1 text-sm">
                        {shownRows.map((r) => {
                          const val = r.values[idx];
                          const differs = new Set(r.values).size > 1;
                          const win = r.best.includes(idx);
                          const ratio = r.ratio[idx];
                          return (
                            <div key={r.label} className={`rounded-lg px-1.5 py-1 ${win ? "bg-ok-bg/70" : ""}`}>
                              <div className="flex justify-between gap-3">
                                <dt className="shrink-0 text-ink-500" title={SPEC_EXPLAIN[r.label]}>{r.label}</dt>
                                <dd className={`flex items-center gap-1 text-right ${win ? "font-bold text-ok" : differs ? "font-semibold text-ink-950" : "text-ink-700"}`}>
                                  {win && <Trophy className="h-3.5 w-3.5 shrink-0" aria-label="ดีกว่า" />}
                                  {val}
                                </dd>
                              </div>
                              {selected.length > 1 && ratio !== null && r.best.length > 0 && (
                                <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-100">
                                  <div className={`h-full rounded-full ${win ? "bg-ok" : "bg-ink-300"}`} style={{ width: `${Math.max(6, Math.round(ratio * 100))}%` }} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </dl>
                      <div className="mt-3 flex gap-1.5">
                        <AddToCartButton
                          item={{ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl, buyUrl: "", storeName: p.store }}
                          label="ใส่ตะกร้า"
                          className="h-11 flex-1"
                        />
                        {p.hasBuyUrl && (
                          <a href={`/go/${encodeURIComponent(p.id)}`} target="_blank" rel="noopener noreferrer sponsored" className="icon-btn h-11 w-11 p-0" aria-label="ซื้อที่ร้าน" title="ซื้อที่ร้าน">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
              {!full && (
                <a
                  href="#add"
                  className="row-span-6 flex min-h-48 snap-start flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-ink-200 text-sm font-semibold text-ink-500 transition-colors hover:border-info hover:text-info"
                >
                  <Plus className="h-6 w-6" /> เพิ่มมาเทียบ
                </a>
              )}
            </div>
          </div>
          {rows.length > 0 && selected.length > 1 && (
            <label className="inline-flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={onlyDiff} onChange={(e) => {
                  const v = e.target.checked;
                  startTransition(() => setOnlyDiff(v));
                }} />
              สเปกแสดงเฉพาะที่ต่างกัน
            </label>
          )}
          {shownRows.some((r) => SPEC_EXPLAIN[r.label]) && (
            <details className="group rounded-2xl border border-ink-200 bg-surface px-4 py-2.5 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink-900">
                <Info className="h-4 w-4 text-info" /> สเปกแต่ละข้อหมายถึงอะไร
                <ChevronDown className="ml-auto h-4 w-4 text-ink-500 transition-transform group-open:rotate-180" />
              </summary>
              <dl className="mt-2 space-y-1.5">
                {shownRows
                  .filter((r) => SPEC_EXPLAIN[r.label])
                  .map((r) => (
                    <div key={r.label}>
                      <dt className="inline font-semibold text-ink-900">{r.label}: </dt>
                      <dd className="inline text-ink-700">{SPEC_EXPLAIN[r.label]}</dd>
                    </div>
                  ))}
              </dl>
            </details>
          )}
        </section>
      )}

      {loading && ids.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy="true" aria-label="กำลังโหลดสินค้าที่เลือก">
          {ids.map((id) => (
            <div key={id} className="h-72 animate-pulse rounded-3xl bg-ink-100" />
          ))}
        </div>
      )}

      {/* เลือกของมาเทียบ */}
      <section id="add" className="scroll-mt-24 space-y-3">
        {loading && <p className="text-sm text-ink-500">กำลังโหลดรายการสินค้า…</p>}
        {!loading && selected.length === 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-surface p-4">
            <Scale className="h-8 w-8 shrink-0 text-ink-300" />
            <p className="text-sm text-ink-600">แตะ <Plus className="inline h-3.5 w-3.5" /> ที่สินค้าด้านล่างเพื่อเริ่มเทียบ</p>
          </div>
        )}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหา เช่น RTX 4070, Ryzen 7, จอ 27"
            className="input h-11 rounded-full pl-9"
            aria-label="ค้นหาสินค้าเพื่อเทียบ"
          />
        </div>
        {!searchQuery && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {kinds.map((k) => (
              <button key={k} type="button" data-active={k === activeKind} onClick={() => startTransition(() => setKind(k))} className="chip shrink-0 rounded-full">
                {k}
              </button>
            ))}
          </div>
        )}
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={full}
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-ink-200 bg-surface p-2.5 text-left transition-colors hover:border-info disabled:opacity-50"
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  <ProductVisual productId={p.id} name={p.name} category={p.category} imageUrl={p.imageUrl} photoUrl={p.sourceImageUrl} size="sm" transparentBg />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-xs font-semibold text-ink-950">{p.name}</span>
                  <span className="mt-0.5 block text-sm font-bold text-ink-900">{formatTHB(p.price)}</span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info text-white">
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
        {full && <p className="text-xs text-ink-500">ครบ {max} ชิ้นแล้ว เอาออกก่อนเพื่อเพิ่มชิ้นใหม่</p>}
      </section>
    </div>
  );
}
