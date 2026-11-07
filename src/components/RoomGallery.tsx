"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Tag } from "lucide-react";
import type { Product, ProductCategory, ResolvedRoomItem, RoomStyle } from "@/lib/types";
import { CATEGORY_LABELS, formatTHB } from "@/lib/format";
import { RoomCoverVisual } from "./RoomCoverVisual";
import FadeImg from "@/components/FadeImg";
import { roomImageProps } from "@/lib/links";
import { useSwipe } from "@/lib/use-swipe";
import { ExternalStoreButton } from "./ExternalStoreModal";
import { spreadSpots } from "@/lib/hotspots";
import { useCoverMap } from "@/lib/use-cover-map";

/** พิกัดอ้างอิงเริ่มต้นตามประเภทสินค้าจริงในห้อง (กรณีไม่มีการระบุพิกัดเฉพาะภาพ) */
const CATEGORY_DEFAULT_PINS: Partial<Record<ProductCategory, { x: number; y: number }>> = {
  monitor: { x: 48, y: 34 },
  computer: { x: 38, y: 50 },
  desk: { x: 50, y: 68 },
  chair: { x: 74, y: 68 },
  bed: { x: 78, y: 38 },
  wardrobe: { x: 88, y: 32 },
  storage: { x: 63, y: 37 },
  lighting: { x: 19, y: 24 },
  plant_pot: { x: 23, y: 46 },
  fake_plant: { x: 23, y: 46 },
  real_plant: { x: 23, y: 46 },
  keyboard: { x: 51, y: 56 },
  mouse: { x: 56, y: 54 },
  keyboard_pad: { x: 50, y: 58 },
  mousepad: { x: 54, y: 56 },
  speaker: { x: 34, y: 38 },
  headphone: { x: 26, y: 60 },
  microphone: { x: 32, y: 44 },
  webcam: { x: 48, y: 20 },
  decor: { x: 62, y: 18 },
  rug: { x: 50, y: 88 },
};

export function RoomGallery({
  images,
  roomName,
  style,
  items = [],
}: {
  images: string[];
  roomName: string;
  style: RoomStyle;
  items?: ResolvedRoomItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showHotspots, setShowHotspots] = useState(true);
  const [activePinIndex, setActivePinIndex] = useState<number | null>(0);

  // ดึงสินค้าที่มีพิกัดจริงบนภาพ (หากระบุ it.x, it.y ในข้อมูลห้องให้ใช้พิกัดจริง หรืออิงตามประเภทสินค้า)
  const validItems = items.filter((it): it is ResolvedRoomItem & { product: Product } => it.product !== null);

  const rawPins: Array<{ product: Product; quantity: number; x: number; y: number; note?: string }> =
    validItems
      .filter((it) => (it.imageIndex ?? 0) === activeIndex)
      .slice(0, 8)
      .map((it, idx) => {
        const fallback = CATEGORY_DEFAULT_PINS[it.product.category] ?? { x: 30 + (idx % 4) * 18, y: 35 + Math.floor(idx / 4) * 30 };
        return {
          product: it.product,
          quantity: it.quantity,
          x: typeof it.x === "number" ? it.x : fallback.x,
          y: typeof it.y === "number" ? it.y : fallback.y,
          note: it.note,
        };
      });

  const currentSrc = images[activeIndex] ?? images[0] ?? null;
  // จุด = % ของภาพจริง → แปลงให้ตรงกับภาพที่ถูกครอป (object-cover) แล้วดันจุดที่ซ้อนออกจากกัน
  const boxRef = useRef<HTMLDivElement>(null);
  const toBox = useCoverMap(boxRef, currentSrc);
  const mapped = rawPins.map((p) => ({ ...p, ...toBox(p.x, p.y) }));
  const spread = spreadSpots(mapped.map((p) => ({ x: p.x, y: p.y })));
  const pinnedItems = mapped.map((p, i) => ({ ...p, x: spread[i].x, y: spread[i].y }));
  const swipe = useSwipe(
    () => images.length > 1 && setActiveIndex((i) => (i + 1) % images.length),
    () => images.length > 1 && setActiveIndex((i) => (i - 1 + images.length) % images.length)
  );
  const activePinned = activePinIndex !== null ? pinnedItems[activePinIndex] ?? null : null;

  return (
    <div className="space-y-3">
      <div ref={boxRef} className="relative overflow-hidden rounded-2xl border border-ink-200 bg-ink-950 touch-pan-y" {...swipe}>
        {currentSrc ? (
          <FadeImg
            {...roomImageProps(currentSrc, "(max-width: 768px) 100vw, 60vw")}
            alt={`${roomName} มุมที่ ${activeIndex + 1}`}
            width={1200}
            height={800}
            priority={activeIndex === 0}
            className="h-72 w-full object-cover sm:h-[420px]"
          />
        ) : (
          <RoomCoverVisual
            src={null}
            alt={roomName}
            style={style}
            title={roomName}
            className="h-72 sm:h-[420px] w-full"
          />
        )}

        {/* Top Interactive Shop-the-Look toggle */}
        {pinnedItems.length > 0 && activeIndex === 0 && (
          <div className="absolute left-3.5 top-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHotspots((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-white/25 bg-ink-950/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-900"
            >
              <Tag className="h-3.5 w-3.5 text-volt" />
              <span>
                {showHotspots ? "ซ่อนจุดชี้สินค้าบนภาพ" : "แสดงจุดชี้สินค้า (Shop the Look)"}
              </span>
            </button>
          </div>
        )}

        {/* Interactive Hotspot Pins on Image */}
        {showHotspots &&
          activeIndex === 0 &&
          pinnedItems.map((pin, idx) => {
            const isSelected = activePinIndex === idx;
            if (!pin.visible) return null;
            return (
              <button
                key={pin.product.id}
                type="button"
                onClick={() =>
                  setActivePinIndex(isSelected ? null : idx)
                }
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                aria-label={`ดูสินค้า ${pin.product.name}`}
                title={`จุดที่ ${idx + 1} · ${CATEGORY_LABELS[pin.product.category]}: ${pin.product.name}`}
                className={`hotspot-pin -translate-x-1/2 -translate-y-1/2 ${
                  isSelected ? "ring-4 ring-white scale-110 shadow-lg" : ""
                }`}
              >
                {idx + 1}
              </button>
            );
          })}

        {images.length > 0 && (
          <span className="badge absolute bottom-3 right-3 bg-ink-950/80 text-white">
            มุมที่ {activeIndex + 1} / {images.length}
          </span>
        )}
      </div>

      {/* การ์ดสินค้าของจุดที่เลือก — อยู่ใต้รูป ไม่บังจุดบนภาพ */}
      {showHotspots && activeIndex === 0 && activePinned && (
        <div className="rounded-xl border border-ink-200 bg-surface p-3 text-ink-900 shadow-sm">
          <div className="flex items-start gap-3">
            {activePinned.product.imageUrl && (
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-ink-200 bg-ink-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePinned.product.imageUrl}
                  alt={activePinned.product.name}
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain p-1"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="badge bg-info-bg text-info font-bold">
                  จุดที่ {(activePinIndex ?? 0) + 1} · {CATEGORY_LABELS[activePinned.product.category]}
                </span>
                {activePinned.note && (
                  <span className="text-[11px] text-ink-500 font-medium">
                    ({activePinned.note})
                  </span>
                )}
              </div>
              <p className="mt-1 font-display text-sm font-bold text-ink-950 truncate" title={activePinned.product.name}>
                {activePinned.product.name}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-semibold text-info">
                  ราคา {formatTHB(activePinned.product.price)} · ร้าน {activePinned.product.platform}
                </p>
                {activePinned.product.status === "available" && (
                  <ExternalStoreButton
                    name={activePinned.product.name}
                    price={activePinned.product.price}
                    category={activePinned.product.category}
                    imageUrl={activePinned.product.imageUrl}
                    buyUrl={activePinned.product.buyUrl}
                            productId={activePinned.product.id}
                    platform={activePinned.product.platform}
                    label="เลือกร้านค้า"
                    size="sm"
                    className="shrink-0"
                  />
                )}
              </div>
              <div className="mt-2 border-t border-ink-100 pt-1.5">
                <Link
                  href={`/categories?cat=${activePinned.product.category}`}
                  className="text-[11px] font-semibold text-ink-600 hover:text-info hover:underline inline-flex items-center gap-1"
                >
                  เลือกดู {CATEGORY_LABELS[activePinned.product.category]} รุ่นอื่นๆ ในหมวดหมู่นี้ →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Hotspot Object Tabs */}
      {showHotspots && activeIndex === 0 && pinnedItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-xs font-semibold text-ink-500 py-1">
            จุดสินค้าในภาพ:
          </span>
          {pinnedItems.map((pin, idx) => {
            const isSelected = activePinIndex === idx;
            return (
              <button
                key={`tab-${pin.product.id}`}
                type="button"
                onClick={() => setActivePinIndex(isSelected ? null : idx)}
                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-xs font-medium border transition-colors ${
                  isSelected
                    ? "border-info bg-info text-white shadow-sm"
                    : "border-ink-200 bg-white text-ink-800 hover:border-ink-400 hover:bg-ink-50"
                }`}
              >
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    isSelected ? "bg-white text-info" : "bg-ink-100 text-ink-700"
                  }`}
                >
                  {idx + 1}
                </span>
                <span>{CATEGORY_LABELS[pin.product.category] || pin.product.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {images.map((src, idx) => (
            <button
              key={src}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative h-20 w-32 shrink-0 overflow-hidden rounded-[4px] border-2 transition-all ${
                idx === activeIndex
                  ? "border-info"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={roomImageProps(src).srcSet ? src.replace(/^\/rooms\/(.+)\.(jpe?g|png)$/i, "/rooms/w800/$1.webp") : src}
                alt={`${roomName} ภาพย่อที่ ${idx + 1}`}
                width={128}
                height={80}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
