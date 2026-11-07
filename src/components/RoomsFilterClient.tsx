"use client";

import { memo, startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import type { LightingType, RoomStyle, RoomWithTotals } from "@/lib/types";
import { LIGHTING_TYPES, ROOM_STYLES } from "@/lib/types";
import {
  COLOR_META,
  colorHex,
  colorLabel,
  formatTHB,
  LIGHTING_LABELS,
  MATERIAL_LABELS,
  materialLabel,
  STYLE_LABELS,
} from "@/lib/format";
import { RoomCard } from "./RoomCard";
import Reveal from "./Reveal";
import EmptyState from "@/components/EmptyState";

export type SortKey = "popular" | "price_asc" | "price_desc" | "newest";

/** กริดห้องแยกเป็น memo — เรนเดอร์ใหม่เฉพาะเมื่อผลกรองเปลี่ยน */
const RoomsGrid = memo(function RoomsGrid({ rooms }: { rooms: RoomWithTotals[] }) {
  return (
    <Reveal stagger={60} className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
      {rooms.map((room, i) => (
        <RoomCard key={room.id} room={room} className={i >= 9 ? "cv-auto" : undefined} />
      ))}
    </Reveal>
  );
});

export function RoomsFilterClient({
  rooms,
  initialQuery = "",
  initialStyle = null,
  initialMaxBudget = 400000,
}: {
  rooms: RoomWithTotals[];
  initialQuery?: string;
  initialStyle?: RoomStyle | null;
  initialMaxBudget?: number;
}) {
  const maxPossiblePrice = useMemo(() => {
    const highest = Math.max(...rooms.map((r) => r.totals.availableTotal), 100000);
    return Math.ceil(highest / 10000) * 10000;
  }, [rooms]);

  const allColors = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => r.colors.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [rooms]);

  const allMaterials = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => r.materials.forEach((m) => set.add(m)));
    return Array.from(set);
  }, [rooms]);

  const [query, setQuery] = useState(initialQuery);
  const [selectedStyles, setSelectedStyles] = useState<RoomStyle[]>(
    initialStyle ? [initialStyle] : []
  );
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedLighting, setSelectedLighting] = useState<LightingType[]>([]);
  const [maxBudget, setMaxBudget] = useState<number>(
    Math.min(initialMaxBudget, maxPossiblePrice)
  );
  const [sortBy, setSortBy] = useState<SortKey>("popular");

  // ค้นหา: หน่วง 200ms แล้วให้รายการตามหลังแบบ deferred (พิมพ์ไม่สะดุด)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 200);
    return () => window.clearTimeout(t);
  }, [query]);
  const deferredQuery = useDeferredValue(debouncedQuery);
  // ลากสไลเดอร์งบ: ตัวเลขขยับทันที ส่วนกริดตามหลัง
  const deferredBudget = useDeferredValue(maxBudget);

  function toggleItem<T>(arr: T[], item: T, setter: (v: T[]) => void) {
    startTransition(() => setter(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]));
  }

  function resetAllFilters() {
    setQuery("");
    startTransition(() => {
      setDebouncedQuery("");
      setSelectedStyles([]);
      setSelectedColors([]);
      setSelectedMaterials([]);
      setSelectedLighting([]);
      setMaxBudget(maxPossiblePrice);
      setSortBy("popular");
    });
  }

  const filteredRooms = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const list = rooms.filter((room) => {
      if (q) {
        const hay = `${room.name} ${room.description} ${STYLE_LABELS[room.style]} ${room.colors
          .map(colorLabel)
          .join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (selectedStyles.length > 0 && !selectedStyles.includes(room.style)) {
        return false;
      }
      if (
        selectedColors.length > 0 &&
        !selectedColors.some((c) => room.colors.includes(c))
      ) {
        return false;
      }
      if (
        selectedMaterials.length > 0 &&
        !selectedMaterials.some((m) => room.materials.includes(m))
      ) {
        return false;
      }
      if (
        selectedLighting.length > 0 &&
        !selectedLighting.some((l) => room.lighting.includes(l))
      ) {
        return false;
      }
      if (room.totals.availableTotal > deferredBudget) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case "price_asc":
          return a.totals.availableTotal - b.totals.availableTotal;
        case "price_desc":
          return b.totals.availableTotal - a.totals.availableTotal;
        case "newest":
          return b.createdAt.localeCompare(a.createdAt);
        case "popular":
        default:
          return b.popularity - a.popularity;
      }
    });

    return list;
  }, [
    rooms,
    deferredQuery,
    selectedStyles,
    selectedColors,
    selectedMaterials,
    selectedLighting,
    deferredBudget,
    sortBy,
  ]);

  const activeFilterCount =
    selectedStyles.length +
    selectedColors.length +
    selectedMaterials.length +
    selectedLighting.length +
    (maxBudget < maxPossiblePrice ? 1 : 0) +
    (query.trim() ? 1 : 0);

  const sliderFillPercent = Math.round(((maxBudget - 15000) / (maxPossiblePrice - 15000)) * 100);
  const [sheetOpen, setSheetOpen] = useState(false);
  const count = (pred: (r: RoomWithTotals) => boolean) => rooms.filter(pred).length;

  /** ตัวกรองที่เลือกอยู่ (แสดงเป็นป้าย กด × เพื่อเอาออก) */
  const activePills: Array<{ key: string; label: string; remove: () => void }> = [
    ...(query.trim() ? [{ key: "q", label: `“${query.trim()}”`, remove: () => setQuery("") }] : []),
    ...(maxBudget < maxPossiblePrice ? [{ key: "b", label: `≤ ${formatTHB(maxBudget)}`, remove: () => setMaxBudget(maxPossiblePrice) }] : []),
    ...selectedStyles.map((v) => ({ key: `s${v}`, label: STYLE_LABELS[v], remove: () => toggleItem(selectedStyles, v, setSelectedStyles) })),
    ...selectedColors.map((v) => ({ key: `c${v}`, label: COLOR_META[v]?.label ?? v, remove: () => toggleItem(selectedColors, v, setSelectedColors) })),
    ...selectedMaterials.map((v) => ({ key: `m${v}`, label: MATERIAL_LABELS[v] ?? materialLabel(v), remove: () => toggleItem(selectedMaterials, v, setSelectedMaterials) })),
    ...selectedLighting.map((v) => ({ key: `l${v}`, label: LIGHTING_LABELS[v], remove: () => toggleItem(selectedLighting, v, setSelectedLighting) })),
  ];

  const section = (title: string, body: React.ReactNode) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">{title}</p>
      {body}
    </div>
  );
  // จำนวนห้องของแต่ละตัวเลือก (ไม่โชว์ถ้าเท่ากับทั้งหมด เพราะไม่ช่วยตัดสินใจ)
  const n = (k: number) => (k < rooms.length ? <span className="ml-0.5 text-[10px] font-normal opacity-70">{k}</span> : null);

  // แผงตัวกรอง (ใช้ทั้งแถบข้างบนคอม และแผ่นเลื่อนขึ้นบนมือถือ)
  const panel = (
    <div className="space-y-5">
      {section(
        "งบประมาณสูงสุด",
        <>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-lg font-bold text-ink-950">{maxBudget >= maxPossiblePrice ? "ไม่จำกัด" : formatTHB(maxBudget)}</span>
          </div>
          <input
            aria-label="งบประมาณสูงสุด"
            type="range"
            min={15000}
            max={maxPossiblePrice}
            step={5000}
            value={maxBudget}
            onChange={(e) => setMaxBudget(Number(e.target.value))}
            style={{ ["--fill" as string]: `${sliderFillPercent}%` }}
            className="range"
          />
          <div className="flex flex-wrap gap-1.5">
            {[25000, 50000, 80000, 150000, maxPossiblePrice].map((preset) => (
              <button key={preset} type="button" data-active={maxBudget === preset} onClick={() => startTransition(() => setMaxBudget(preset))} className="chip text-xs">
                {preset === maxPossiblePrice ? "ไม่จำกัด" : `≤ ${(preset / 1000).toFixed(0)}K`}
              </button>
            ))}
          </div>
        </>
      )}
      {section(
        "สไตล์ห้อง",
        <div className="flex flex-wrap gap-1.5">
          {ROOM_STYLES.map((style) => (
            <button key={style} type="button" disabled={!count((r) => r.style === style) && !selectedStyles.includes(style)} data-active={selectedStyles.includes(style)} onClick={() => toggleItem(selectedStyles, style, setSelectedStyles)} className="chip text-xs disabled:opacity-40">
              {STYLE_LABELS[style]}
              {n(count((r) => r.style === style))}
            </button>
          ))}
        </div>
      )}
      {section(
        "โทนสีห้อง",
        <div className="flex flex-wrap gap-1.5">
          {allColors.map((color) => (
            <button key={color} type="button" data-active={selectedColors.includes(color)} onClick={() => toggleItem(selectedColors, color, setSelectedColors)} className="chip text-xs">
              <span className="inline-block h-3 w-3 rounded-full border border-ink-300" style={{ backgroundColor: colorHex(color) }} />
              {COLOR_META[color]?.label ?? color}
              {n(count((r) => r.colors.includes(color)))}
            </button>
          ))}
        </div>
      )}
      {section(
        "วัสดุเฟอร์นิเจอร์",
        <div className="flex flex-wrap gap-1.5">
          {allMaterials.map((mat) => (
            <button key={mat} type="button" data-active={selectedMaterials.includes(mat)} onClick={() => toggleItem(selectedMaterials, mat, setSelectedMaterials)} className="chip text-xs">
              {MATERIAL_LABELS[mat] ?? materialLabel(mat)}
              {n(count((r) => r.materials.includes(mat)))}
            </button>
          ))}
        </div>
      )}
      {section(
        "ลักษณะแสงไฟ",
        <div className="flex flex-wrap gap-1.5">
          {LIGHTING_TYPES.map((light) => (
            <button key={light} type="button" data-active={selectedLighting.includes(light)} onClick={() => toggleItem(selectedLighting, light, setSelectedLighting)} className="chip text-xs">
              {LIGHTING_LABELS[light]}
              {n(count((r) => r.lighting.includes(light)))}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* แถบบน: ค้นหา + ตัวกรอง (มือถือ) + เรียง */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input type="search" aria-label="ค้นหาห้อง" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อห้อง สไตล์ หรือโทนสี…" className="input h-11 rounded-full pl-10" />
        </div>
        <button type="button" onClick={() => setSheetOpen(true)} className="btn btn-ghost h-11 flex-1 rounded-full border border-ink-200 sm:flex-none lg:hidden">
          <SlidersHorizontal className="h-4 w-4" /> ตัวกรอง
          {activeFilterCount > 0 && <span className="rounded-full bg-info px-1.5 text-[11px] font-bold text-white">{activeFilterCount}</span>}
        </button>
        <select aria-label="เรียงตาม" value={sortBy} onChange={(e) => {
          const v = e.target.value as SortKey;
          startTransition(() => setSortBy(v));
        }} className="input h-11 w-auto flex-1 rounded-full text-sm sm:flex-none">
          <option value="popular">ยอดนิยม</option>
          <option value="price_asc">ราคาต่ำ → สูง</option>
          <option value="price_desc">ราคาสูง → ต่ำ</option>
          <option value="newest">มาใหม่</option>
        </select>
      </div>

      {/* สไตล์ยอดนิยม (แตะเร็ว) */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" data-active={selectedStyles.length === 0} onClick={() => startTransition(() => setSelectedStyles([]))} className="chip shrink-0 text-xs">
          ทุกสไตล์
        </button>
        {ROOM_STYLES.map((style) => (
          <button key={style} type="button" disabled={!count((r) => r.style === style) && !selectedStyles.includes(style)} data-active={selectedStyles.includes(style)} onClick={() => toggleItem(selectedStyles, style, setSelectedStyles)} className="chip shrink-0 text-xs disabled:opacity-40">
            {STYLE_LABELS[style]}
            {n(count((r) => r.style === style))}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="card thin-scroll sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold text-ink-950">
                <SlidersHorizontal className="h-4 w-4" /> ตัวกรอง
              </p>
              {activeFilterCount > 0 && (
                <button type="button" onClick={resetAllFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-info">
                  <RotateCcw className="h-3.5 w-3.5" /> ล้างทั้งหมด
                </button>
              )}
            </div>
            {panel}
          </div>
        </aside>

        <section className="space-y-4 lg:col-span-9">
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-700">
            <span>
              พบ <strong className="text-ink-950">{filteredRooms.length}</strong> จาก {rooms.length} ห้อง
            </span>
            {activePills.map((p) => (
              <button key={p.key} type="button" onClick={p.remove} className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2.5 py-1 text-xs font-semibold text-info hover:bg-info/20" aria-label={`เอาตัวกรอง ${p.label} ออก`}>
                {p.label} <X className="h-3 w-3" />
              </button>
            ))}
            {activePills.length > 1 && (
              <button type="button" onClick={resetAllFilters} className="text-xs font-semibold text-ink-600 underline-offset-2 hover:underline">
                ล้างทั้งหมด
              </button>
            )}
          </div>

          {filteredRooms.length === 0 ? (
            <EmptyState
              icon={<X className="h-8 w-8" aria-hidden="true" />}
              title="ไม่พบห้องที่ตรงกับตัวกรอง"
              description="ลองเพิ่มงบ หรือเอาเงื่อนไขสี/วัสดุออกบางข้อ"
              action={{ label: "ล้างตัวกรองทั้งหมด", onClick: resetAllFilters }}
            />
          ) : (
            <RoomsGrid rooms={filteredRooms} />
          )}
        </section>
      </div>

      {/* แผ่นตัวกรอง (มือถือ/แท็บเล็ต) */}
      {sheetOpen &&
        createPortal(
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="ตัวกรองห้อง">
          <button type="button" aria-label="ปิด" className="absolute inset-0 bg-black/50" onClick={() => setSheetOpen(false)} />
          <div className="scene-chip absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
              <p className="font-bold text-ink-950">ตัวกรอง</p>
              <div className="flex items-center gap-1">
                {activeFilterCount > 0 && (
                  <button type="button" onClick={resetAllFilters} className="rounded-full px-3 py-1.5 text-xs font-semibold text-info">
                    ล้างทั้งหมด
                  </button>
                )}
                <button type="button" onClick={() => setSheetOpen(false)} aria-label="ปิด" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">{panel}</div>
            <div className="border-t border-ink-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => setSheetOpen(false)} className="btn btn-primary h-12 w-full rounded-full text-base">
                ดูผลลัพธ์ {filteredRooms.length} ห้อง
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}