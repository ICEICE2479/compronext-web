"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Store, X } from "lucide-react";
import { useFocusTrap } from "@/components/useFocusTrap";
import { getExternalStoreOptions, isSafeHttpUrl } from "@/lib/links";
import { formatTHB } from "@/lib/format";
import { ProductVisual } from "@/components/ProductVisual";

export interface ExternalStoreButtonProps {
  name: string;
  price?: number;
  category?: string;
  imageUrl?: string | null;
  buyUrl?: string | null;
  /** มี = ลิงก์ตรงผ่าน /go (นับคลิก + affiliate) */
  productId?: string;
  platform?: string | null;
  label?: string;
  className?: string;
  variant?: "outline" | "primary" | "ghost";
  size?: "xs" | "sm" | "md";
}

export function ExternalStoreButton({
  name,
  price,
  category = "other",
  imageUrl,
  buyUrl,
  productId,
  platform,
  label,
  className = "",
  variant = "outline",
  size = "sm",
}: ExternalStoreButtonProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useFocusTrap(dialogRef, open, close);

  const stores = getExternalStoreOptions({
    name,
    category,
    buyUrl,
    platform,
  });

  const baseClass =
    variant === "primary"
      ? "btn btn-primary"
      : variant === "ghost"
        ? "inline-flex min-h-11 items-center gap-1 text-xs font-bold text-info hover:underline focus-visible:outline-2 focus-visible:outline-info cursor-pointer"
        : "btn btn-outline";

  const sizeClass =
    variant === "ghost"
      ? ""
      : size === "xs"
        ? "btn-sm px-2.5 py-1 text-[11px]"
        : size === "sm"
          ? "btn-sm"
          : "py-2.5 px-4 text-sm";

  const buttonText = label || "เลือกร้านค้า (JIB / iHAVECPU / อื่นๆ)";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`${baseClass} ${sizeClass} ${className}`}
        title={`เลือกดูสินค้า "${name}" จากร้าน JIB, iHAVECPU, Advice, BaNANA IT, IKEA, Shopee, Lazada`}
      >
        <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{buttonText}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-80" aria-hidden="true" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/65 p-4 backdrop-blur-[3px] animate-reveal"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="external-store-title"
              tabIndex={-1}
              className="card relative max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto border-2 border-info p-4 shadow-[var(--shadow-pop)] sm:p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-ink-200 pb-3.5">
                <div className="space-y-1">
                  <span className="badge bg-info-bg text-info font-bold">
                    <Store className="h-3.5 w-3.5" />
                    MULTI-STORE PARTNER NETWORK
                  </span>
                  <h2 id="external-store-title" className="font-display text-lg font-bold text-ink-950 sm:text-xl">
                    เลือกแหล่งขายสินค้าภายนอกที่ต้องการไปดู
                  </h2>
                  <p className="text-xs text-ink-600">
                    คลิกเลือกร้านค้าชั้นนำด้านล่างเพื่อเปิดดูราคาและสต็อกสินค้าชิ้นนี้บนเว็บไซต์ปลายทางทันที
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="ปิดหน้าต่างเลือกร้านค้า"
                  className="tap-target inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-100 hover:text-ink-950 focus-visible:outline-2 focus-visible:outline-info"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Product Summary Card */}
              <div className="flex items-center gap-3.5 rounded-xl border border-ink-200 bg-ink-50/70 p-3">
                <ProductVisual
                  name={name}
                  category={category}
                  imageUrl={imageUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold text-ink-950 truncate">
                    {name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                    {typeof price === "number" && (
                      <span className="font-display font-extrabold text-info">
                        ราคาอ้างอิง: {formatTHB(price)}
                      </span>
                    )}
                    {platform && (
                      <span>· ร้านค้าเริ่มต้น: {platform}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Highlighted Primary Link if Custom URL was provided */}
              {buyUrl &&
                isSafeHttpUrl(buyUrl) &&
                !buyUrl.includes("shopee.co.th/search") &&
                !buyUrl.includes("lazada.co.th/catalog") && (
                  <div className="rounded-xl border border-info/40 bg-info-bg/40 p-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-info block">
                        ลิงก์ตรงของสินค้าชิ้นนี้ ({platform || "Official Link"})
                      </span>
                      <span className="block max-w-[16rem] truncate text-xs text-ink-700 sm:max-w-md">
                        {buyUrl}
                      </span>
                    </div>
                    <a
                      href={productId ? `/go/${encodeURIComponent(productId)}` : buyUrl}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="btn btn-primary btn-sm"
                    >
                      <span>เปิดลิงก์ตรง</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}

              {/* Store Selection Grid */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                {stores.map((st, idx) => (
                  <a
                    key={st.id}
                    href={st.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group flex flex-col justify-between gap-2 rounded-xl border p-3.5 transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-info ${
                      idx < 2
                        ? "border-info/50 bg-info-bg/20 hover:border-info"
                        : "border-ink-200 hover:border-info"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold text-ink-950 group-hover:text-info flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: st.accentColor }}
                          />
                          {st.name}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0"
                          style={{
                            backgroundColor: st.bgLight,
                            color: st.accentColor,
                          }}
                        >
                          {st.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-600 leading-relaxed line-clamp-2">
                        {st.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-ink-100 pt-2 text-xs font-bold text-info">
                      <span>ไปดูสินค้าที่ {st.name.split(" ")[0]}</span>
                      <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </a>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-ink-200 pt-3 text-[11px] text-ink-600 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  รองรับการค้นหาตรงรุ่นบน JIB, iHAVECPU, Advice, BaNANA IT, Mercular, IKEA, HomePro, Index, Shopee และ Lazada
                </span>
                <button
                  type="button"
                  onClick={close}
                  className="btn btn-outline btn-sm shrink-0"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
