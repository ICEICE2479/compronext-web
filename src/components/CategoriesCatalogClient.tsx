"use client";

import { memo, startTransition, useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { MACRO_CATEGORIES, type MacroCategorySlug } from "@/lib/catalog-taxonomy";
import { formatTHB } from "@/lib/format";
import { ProductTile, type TileProduct } from "@/components/ProductTile";
import { ProductTileSkeleton } from "@/components/ProductTileSkeleton";
import Reveal from "@/components/Reveal";
import EmptyState from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";
import { VisualSearchModal } from "@/components/VisualSearchModal";

type SortMode = "popular" | "price_asc" | "price_desc" | "newest";
type Card = TileProduct & { roomSlug?: string };

const GROUP_LABELS: Record<string, string> = {
  "room-items": "ของใช้ในห้อง",
  components: "ชิ้นส่วนคอม",
  "gaming-gear": "เกมมิ่งเกียร์",
  monitors: "จอภาพ",
  furniture: "โต๊ะ & เก้าอี้",
  decoration: "ไฟ & ของแต่งโต๊ะ",
};
const PRICE_PRESETS = [
  { label: "ทุกราคา", value: 0 },
  { label: "ไม่เกิน 1,000 บาท", value: 1000 },
  { label: "ไม่เกิน 5,000 บาท", value: 5000 },
  { label: "ไม่เกิน 15,000 บาท", value: 15000 },
  { label: "ไม่เกิน 35,000 บาท", value: 35000 },
];
const SORTS: Array<{ value: SortMode; label: string }> = [
  { value: "popular", label: "แนะนำ" },
  { value: "price_asc", label: "ราคาต่ำ → สูง" },
  { value: "price_desc", label: "ราคาสูง → ต่ำ" },
  { value: "newest", label: "อัปเดตล่าสุด" },
];
const PAGE = 24;
const shortTh = (s: string) => s.replace(/\s*\(.*\)\s*$/, "");

/** กริดผลลัพธ์แยกเป็น memo — พิมพ์ค้นหา/เปิดแผ่นตัวกรองไม่ต้องเรนเดอร์การ์ดใหม่ */
const ResultsGrid = memo(function ResultsGrid({ items, skeletons }: { items: Card[]; skeletons: number }) {
  return (
    <Reveal stagger={60} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {items.map((p, i) => (
        <ProductTile key={p.id} product={p} roomSlug={p.roomSlug} className={i >= PAGE ? "cv-auto" : undefined} />
      ))}
      {Array.from({ length: skeletons }, (_, i) => <ProductTileSkeleton key={`sk-${i}`} />)}
    </Reveal>
  );
});

export function CategoriesCatalogClient({
  initialItems,
  initialTotal,
  facets,
  initialMacro,
  initialCat,
  initialSub,
  initialQuery,
}: {
  initialItems: Card[];
  initialTotal: number;
  facets: { total: number; macroCounts: Record<string, number>; brands: string[] };
  initialMacro: MacroCategorySlug | null;
  initialCat: string | null;
  initialSub: string | null;
  initialQuery: string;
}) {
  const [macro, setMacro] = useState<string>(initialMacro ?? "all");
  const [cat, setCat] = useState<string>(initialCat ?? "all");
  const [sub, setSub] = useState<string>(initialSub ?? "all");
  const [query, setQuery] = useState(initialQuery);
  const [debouncedRaw, setDebouncedQuery] = useState(initialQuery);
  const debouncedQuery = useDeferredValue(debouncedRaw);
  const [brand, setBrand] = useState("all");
  const [maxPrice, setMaxPrice] = useState(0);
  const [sort, setSort] = useState<SortMode>("popular");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visualSearchOpen, setVisualSearchOpen] = useState(false);

  const [items, setItems] = useState<Card[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const firstRender = useRef(true);
  const requestId = useRef(0);

  const group = MACRO_CATEGORIES.find((m) => m.slug === macro) ?? null;
  const activeFilterCount = (brand !== "all" ? 1 : 0) + (maxPrice ? 1 : 0) + (sort !== "popular" ? 1 : 0);

  // หน่วงการค้นหาตอนพิมพ์
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  const buildUrl = useCallback(
    (offset: number) => {
      const sp = new URLSearchParams();
      if (macro !== "all") sp.set("macro", macro);
      if (cat !== "all") sp.set("cat", cat);
      if (sub !== "all") sp.set("sub", sub);
      if (debouncedQuery.trim()) sp.set("q", debouncedQuery.trim());
      if (brand !== "all") sp.set("brand", brand);
      if (maxPrice) sp.set("maxPrice", String(maxPrice));
      if (sort !== "popular") sp.set("sort", sort);
      sp.set("offset", String(offset));
      sp.set("limit", String(PAGE));
      return `/api/products?${sp.toString()}`;
    },
    [macro, cat, sub, debouncedQuery, brand, maxPrice, sort]
  );

  // เปลี่ยนตัวกรอง → โหลดหน้าแรกใหม่
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = ++requestId.current;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setItems([]);
      try {
        const data = await (await fetch(buildUrl(0))).json();
        if (!cancelled && id === requestId.current) {
          setItems(data.items);
          setTotal(data.total);
        }
      } finally {
        if (!cancelled && id === requestId.current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildUrl]);

  const loadMore = useCallback(async () => {
    if (loading || items.length >= total) return;
    const id = requestId.current;
    setLoading(true);
    try {
      const data = await (await fetch(buildUrl(items.length))).json();
      if (id === requestId.current) setItems((prev) => [...prev, ...data.items]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [loading, items.length, total, buildUrl]);

  // เลื่อนถึงท้ายแล้วโหลดต่ออัตโนมัติ
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && loadMore(), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // ล็อกการเลื่อนหน้าตอนเปิดแผ่นตัวกรอง
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  function pickMacro(slug: string) {
    startTransition(() => {
      setMacro(slug);
      setCat("all");
      setSub("all");
    });
  }

  function resetAll() {
    setQuery("");
    startTransition(() => {
      pickMacro("all");
      setBrand("all");
      setMaxPrice(0);
      setSort("popular");
    });
  }

  const filters = (
    <div className="space-y-5">
      <div>
        <p className="label">เรียงตาม</p>
        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <button key={s.value} type="button" data-active={sort === s.value} onClick={() => startTransition(() => setSort(s.value))} className="chip">
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">ราคาต่อชิ้น</p>
        <div className="flex flex-wrap gap-2">
          {PRICE_PRESETS.map((p) => (
            <button key={p.value} type="button" data-active={maxPrice === p.value} onClick={() => startTransition(() => setMaxPrice(p.value))} className="chip">
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="label">แบรนด์</span>
        <select value={brand} onChange={(e) => {
            const v = e.target.value;
            startTransition(() => setBrand(v));
          }} className="select">
          <option value="all">ทุกแบรนด์</option>
          {facets.brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">สินค้า</h1>
          <PageIntro what="หาของชิ้นเดียวที่ใช่" next="เลือกหมวดหรือค้นหา แล้วกดสินค้าเพื่อดูว่าคุ้มไหม" />
          <p className="mt-1 text-xs text-ink-500">{total.toLocaleString()} รายการ · ราคาอาจต่างจากที่ร้าน</p>
        </div>
      </div>

      {/* ค้นหา + ปุ่มตัวกรอง */}
      <div className="sticky top-16 z-20 -mx-4 space-y-3 bg-ink-50/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 lg:top-[7.25rem]">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า แบรนด์ ร้าน"
              aria-label="ค้นหาสินค้า"
              className="input rounded-full pl-10"
            />
          </div>
          <button
            type="button"
            onClick={() => setVisualSearchOpen(true)}
            className="icon-btn relative h-11 shrink-0 border-info/35 bg-info-bg/80 text-info hover:bg-info hover:text-white"
            aria-label="ค้นหาด้วยรูปภาพ"
            title="อัปโหลดรูปเพื่อค้นหาสินค้าที่คล้ายกัน"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden text-sm font-bold sm:inline">ค้นด้วยรูป</span>
          </button>
          <button type="button" onClick={() => setSheetOpen(true)} className="icon-btn relative h-11 shrink-0 bg-white" aria-label="ตัวกรอง">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden text-sm font-semibold sm:inline">ตัวกรอง</span>
            {activeFilterCount > 0 && <span className="icon-badge">{activeFilterCount}</span>}
          </button>
        </div>

        {/* หมวดหลัก: เลื่อนแนวนอนบนมือถือ */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <button type="button" data-active={macro === "all" && cat === "all"} onClick={() => pickMacro("all")} className="chip shrink-0">
            ทั้งหมด
          </button>
          {MACRO_CATEGORIES.map((g) => (
            <button key={g.slug} type="button" data-active={macro === g.slug} onClick={() => pickMacro(g.slug)} className="chip shrink-0">
              {GROUP_LABELS[g.slug] ?? g.titleEn}
              <span className="text-[11px] opacity-60">{facets.macroCounts[g.slug] ?? 0}</span>
            </button>
          ))}
        </div>

        {group && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            <button type="button" data-active={sub === "all"} onClick={() => startTransition(() => setSub("all"))} className="chip shrink-0 text-xs">
              ทั้งหมดในหมวดนี้
            </button>
            {group.subcategories.map((s) => (
              <button key={s.slug} type="button" data-active={sub === s.slug} onClick={() => startTransition(() => setSub(s.slug))} className="chip shrink-0 text-xs">
                {shortTh(s.labelTh)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ผลลัพธ์ */}
      {!loading && items.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="h-8 w-8" aria-hidden="true" />}
          title="ไม่พบสินค้าที่ตรงกับตัวกรอง"
          description="ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองเพื่อดูสินค้าทั้งหมด"
          action={{ label: "ล้างตัวกรอง", onClick: resetAll }}
        />
      ) : (
        <ResultsGrid items={items} skeletons={loading ? (items.length === 0 ? 8 : 4) : 0} />
      )}
      <div ref={sentinel} className="h-1" />
      {!loading && items.length > 0 && items.length >= total && (
        <p className="py-6 text-center text-xs text-ink-500">แสดงครบ {total.toLocaleString()} รายการแล้ว</p>
      )}

      {/* ตัวกรอง: แผ่นเลื่อนขึ้นจากล่าง (มือถือ) / กล่องลอย (คอม) */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="ตัวกรองสินค้า">
          <button type="button" aria-label="ปิด" className="absolute inset-0 bg-ink-950/50" onClick={() => setSheetOpen(false)} />
          <div className="sheet absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:inset-auto sm:right-6 sm:top-24 sm:w-96 sm:rounded-2xl">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink-200 sm:hidden" />
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-bold text-ink-950">ตัวกรอง</p>
              <button type="button" className="icon-btn border-transparent" aria-label="ปิด" onClick={() => setSheetOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {filters}
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={resetAll} className="btn btn-outline flex-1">
                ล้าง
              </button>
              <button type="button" onClick={() => setSheetOpen(false)} className="btn btn-primary flex-[2]">
                ดู {total.toLocaleString()} รายการ
              </button>
            </div>
            {maxPrice > 0 && <p className="mt-2 text-center text-[11px] text-ink-500">ไม่เกิน {formatTHB(maxPrice)} ต่อชิ้น</p>}
          </div>
        </div>
      )}
      {visualSearchOpen && (
        <VisualSearchModal
          onClose={() => setVisualSearchOpen(false)}
          onApplyFilter={(pickedCat, keyword) => {
            startTransition(() => {
              if (pickedCat !== "all") {
                setMacro("all");
                setCat(pickedCat);
                setSub("all");
              }
              setQuery(keyword);
            });
          }}
        />
      )}
    </div>
  );
}
