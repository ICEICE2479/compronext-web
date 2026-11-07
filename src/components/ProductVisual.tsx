"use client";

import React from "react";
import FadeImg from "@/components/FadeImg";
import { CATEGORY_LABELS } from "@/lib/format";
import { resolveRealProductImage } from "@/lib/product-images";
import type { ProductCategory } from "@/lib/types";
import { displayPhotoSrc } from "@/lib/own-storage";

export interface ProductVisualProps {
  productId?: string;
  name: string;
  category: ProductCategory | string;
  imageUrl?: string | null;
  /** รูปต้นฉบับจากร้าน (ก่อนเก็บลงที่เก็บไฟล์) — โชว์อันนี้ก่อน เพราะเห็นของครบ */
  photoUrl?: string | null;
  brand?: string;
  showBrandBadge?: boolean;
  customCategoryLabel?: string;
  size?: "xs" | "sm" | "md" | "lg" | "card" | "tile";
  className?: string;
  transparentBg?: boolean;
}

function detectVisualKind(name: string, category: string): string {
  const hay = `${name} ${category}`.toLowerCase();
  if (hay.includes("ryzen") || hay.includes("core i") || hay.includes("ซีพียู") || hay.includes("cpu")) {
    return "cpu";
  }
  if (hay.includes("mainboard") || hay.includes("เมนบอร์ด") || hay.includes("b650") || hay.includes("z790") || hay.includes("b760") || hay.includes("x870")) {
    return "motherboard";
  }
  if (hay.includes("rtx") || hay.includes("radeon") || hay.includes("rx ") || hay.includes("การ์ดจอ") || hay.includes("vga") || hay.includes("geforce")) {
    return "gpu";
  }
  if (hay.includes("ddr4") || hay.includes("ddr5") || hay.includes("แรม") || hay.includes("vengeance") || hay.includes("trident")) {
    return "ram";
  }
  if (hay.includes("nvme") || hay.includes("m.2") || hay.includes("ssd") || hay.includes("hdd") || hay.includes("wd_black") || hay.includes("990 pro") || hay.includes("lexar")) {
    return "storage";
  }
  if (hay.includes("psu") || hay.includes("พาวเวอร์") || hay.includes("850w") || hay.includes("750w") || hay.includes("650w") || hay.includes("1000w") || hay.includes("จ่ายไฟ")) {
    return "psu";
  }
  if (hay.includes("ชุดน้ำ") || hay.includes("liquid") || hay.includes("cooler") || hay.includes("พัดลม") || hay.includes("kraken") || hay.includes("ak620")) {
    return "cooler";
  }
  if (hay.includes("case") || hay.includes("เคส") || hay.includes("h6 flow") || hay.includes("o11") || hay.includes("4000d")) {
    return "case";
  }
  if (category === "monitor" || hay.includes("จอ") || hay.includes("oled") || hay.includes("ips") || hay.includes("ultragear")) {
    return "monitor";
  }
  if (category === "desk" || hay.includes("โต๊ะ")) return "desk";
  if (category === "chair" || hay.includes("เก้าอี้")) return "chair";
  if (category === "keyboard" || hay.includes("คีย์บอร์ด") || hay.includes("keychron")) return "keyboard";
  if (category === "mouse" || hay.includes("เมาส์") || hay.includes("superlight") || hay.includes("viper")) return "mouse";
  if (category === "headphone" || hay.includes("หูฟัง") || hay.includes("headset")) return "headphone";
  if (category === "microphone" || hay.includes("ไมโครโฟน") || hay.includes("ไมค์") || hay.includes("shure") || hay.includes("hyperx quadcast")) return "microphone";
  if (category === "speaker" || hay.includes("ลำโพง") || hay.includes("soundbar")) return "speaker";
  if (category === "lighting" || hay.includes("ไฟ") || hay.includes("lightbar") || hay.includes("nanoleaf")) return "lighting";
  if (category === "pc") return "case";
  return category || "accessory";
}

export function ProductVisual({
  productId,
  name,
  category,
  imageUrl,
  photoUrl,
  customCategoryLabel,
  size = "md",
  className = "",
  transparentBg = false,
}: ProductVisualProps) {
  const kind = detectVisualKind(name, category);
  const categoryText =
    customCategoryLabel ||
    CATEGORY_LABELS[category as ProductCategory] ||
    category.toUpperCase();

  const effectiveImageUrl = React.useMemo(() => {
    // If a cutout URL is already provided explicitly, preserve it
    if (imageUrl && (imageUrl.startsWith("/api/cutout") || imageUrl.includes("ProductRemoveBg"))) {
      return imageUrl;
    }
    if (photoUrl && /^https?:\/\//.test(photoUrl)) return photoUrl;
    return resolveRealProductImage({
      id: productId,
      name,
      category,
      imageUrl,
    });
  }, [productId, name, category, imageUrl, photoUrl]);

  // รูปย่อผ่านเซิร์ฟเวอร์เรา (ไม่ตัดพื้นหลัง)
  const initialUrl = React.useMemo(() => {
    if (!effectiveImageUrl) return null;
    return displayPhotoSrc(effectiveImageUrl);
  }, [effectiveImageUrl]);

  const [currentSrc, setCurrentSrc] = React.useState<string | null>(initialUrl);
  const [imgFailed, setImgFailed] = React.useState(false);
  const [prevInitialUrl, setPrevInitialUrl] = React.useState(initialUrl);
  if (prevInitialUrl !== initialUrl) {
    setPrevInitialUrl(initialUrl);
    setCurrentSrc(initialUrl);
    setImgFailed(false);
  }

  const handleImageError = () => {
    // ลำดับสำรอง: รูปย่อผ่านเซิร์ฟเวอร์ → รูปตรงจากร้าน → รูปที่เก็บไว้ในที่เก็บไฟล์ของเรา → รูปวาด
    if (currentSrc && currentSrc.startsWith("/api/cutout") && effectiveImageUrl && !effectiveImageUrl.startsWith("/api/cutout")) {
      setCurrentSrc(effectiveImageUrl);
    } else if (imageUrl && currentSrc !== imageUrl && effectiveImageUrl !== imageUrl) {
      setCurrentSrc(imageUrl);
    } else {
      setImgFailed(true);
    }
  };

  const sizeClasses: Record<NonNullable<ProductVisualProps["size"]>, string> = {
    xs: "h-10 w-12 rounded-[4px]",
    sm: "h-14 w-16 rounded-[5px]",
    md: "h-20 w-24 rounded-[6px]",
    lg: "h-44 w-full rounded-[6px]",
    card: "h-44 w-full rounded-[6px]",
    tile: "h-full w-full",
  };

  if (
    !imgFailed &&
    effectiveImageUrl &&
    (effectiveImageUrl.startsWith("http") ||
      effectiveImageUrl.startsWith("/") ||
      effectiveImageUrl.startsWith("data:"))
  ) {
    return (
      <div
        className={`group relative overflow-hidden ${
          // รูปถ่ายวางบนแผ่นขาว: พื้นหลังรูปจากร้านกลืนไป เห็นตัวของชัดครบทุกส่วน
          transparentBg ? "photo-plate rounded-xl" : "photo-plate border border-ink-200"
        } flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}
        title={name}
      >
        {/* Ambient subtle studio glow */}
        {!transparentBg && (
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,80,255,0.03),transparent_70%)]" />
        )}

        {!transparentBg && (size === "card" || size === "lg") && (
          <div className="pointer-events-none absolute left-2.5 top-2 z-10 flex items-center text-[10px] font-semibold">
            <span className="rounded-[4px] px-2 py-0.5 border shadow-2xs truncate max-w-[140px] border-zinc-700/80 bg-zinc-900/90 text-zinc-100">
              {categoryText}
            </span>
          </div>
        )}
        <FadeImg
          src={currentSrc || effectiveImageUrl}
          alt={name}
          width={400}
          height={400}
          onError={handleImageError}
          className={
            size === "card" || size === "lg" || size === "tile"
              ? "img-zoom relative z-1 h-full w-full object-contain p-[6%] text-transparent"
              : "relative z-1 h-full w-full object-contain p-1 text-transparent"
          }
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${transparentBg ? "" : "border border-ink-200 bg-media"} flex flex-col items-center justify-center shrink-0 select-none ${sizeClasses[size]} ${className}`}
      title={name}
    >
      {/* Top micro labels for card/lg sizes */}
      {(size === "card" || size === "lg") && (
        <div className="absolute left-2.5 top-2 flex items-center text-[10px] font-semibold pointer-events-none z-10">
          <span className="rounded-[4px] px-2 py-0.5 border shadow-2xs truncate max-w-[140px] border-zinc-700/80 bg-zinc-900/90 text-zinc-100">
            {categoryText}
          </span>
        </div>
      )}

      {/* Detailed Hardware / Setup SVG Illustration */}
      <svg
        viewBox="0 0 120 90"
        className={
          size === "xs"
            ? "h-8 w-10"
            : size === "sm"
              ? "h-11 w-14"
              : size === "md"
                ? "h-16 w-20"
                : "h-24 w-32"
        }
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {kind === "cpu" && (
          <g>
            <rect x="26" y="14" width="68" height="62" rx="6" fill="#0f5338" stroke="#063422" strokeWidth="2" />
            <rect x="34" y="21" width="52" height="48" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
            <rect x="42" y="29" width="36" height="32" rx="2" fill="#0a2540" />
            <text x="60" y="48" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">
              CPU
            </text>
            <path d="M29 20H33M29 26H33M87 20H91M87 26H91" stroke="#f59e0b" strokeWidth="1.8" />
          </g>
        )}

        {kind === "motherboard" && (
          <g>
            <rect x="24" y="10" width="72" height="70" rx="4" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
            <rect x="28" y="14" width="14" height="32" rx="2" fill="#0050ff" />
            <rect x="46" y="18" width="22" height="22" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
            <line x1="74" y1="16" x2="74" y2="42" stroke="#38bdf8" strokeWidth="2.5" />
            <line x1="80" y1="16" x2="80" y2="42" stroke="#38bdf8" strokeWidth="2.5" />
            <line x1="86" y1="16" x2="86" y2="42" stroke="#38bdf8" strokeWidth="2.5" />
            <rect x="32" y="52" width="56" height="7" rx="1.5" fill="#0050ff" />
            <rect x="32" y="64" width="44" height="5" rx="1" fill="#475569" />
          </g>
        )}

        {kind === "gpu" && (
          <g>
            <rect x="14" y="22" width="92" height="46" rx="5" fill="#0f172a" stroke="#334155" strokeWidth="2" />
            <rect x="14" y="22" width="92" height="7" rx="2" fill="#0050ff" />
            <circle cx="33" cy="48" r="13" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <circle cx="60" cy="48" r="13" fill="#1e293b" stroke="#0050ff" strokeWidth="2" />
            <circle cx="87" cy="48" r="13" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <circle cx="33" cy="48" r="4" fill="#0050ff" />
            <circle cx="60" cy="48" r="4" fill="#0050ff" />
            <circle cx="87" cy="48" r="4" fill="#0050ff" />
          </g>
        )}

        {kind === "ram" && (
          <g>
            <rect x="16" y="24" width="88" height="22" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="16" y="20" width="88" height="6" rx="2" fill="#0050ff" />
            <rect x="20" y="50" width="88" height="22" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
            <rect x="20" y="46" width="88" height="6" rx="2" fill="#38bdf8" />
            <path d="M26 72V76M36 72V76M46 72V76M66 72V76M76 72V76M86 72V76" stroke="#f59e0b" strokeWidth="2" />
          </g>
        )}

        {kind === "storage" && (
          <g>
            <rect x="14" y="32" width="92" height="26" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="2" />
            <rect x="22" y="36" width="52" height="18" rx="2" fill="#1e293b" stroke="#0050ff" strokeWidth="1.5" />
            <text x="48" y="48" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold" fontFamily="monospace">
              NVMe M.2
            </text>
            <rect x="80" y="37" width="16" height="16" rx="2" fill="#334155" />
            <rect x="10" y="39" width="5" height="12" rx="1" fill="#f59e0b" />
          </g>
        )}

        {kind === "psu" && (
          <g>
            <rect x="22" y="16" width="76" height="58" rx="5" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
            <circle cx="52" cy="45" r="20" fill="#0f172a" stroke="#0050ff" strokeWidth="2" />
            <circle cx="52" cy="45" r="12" fill="none" stroke="#475569" strokeWidth="1.5" />
            <circle cx="52" cy="45" r="5" fill="#0050ff" />
            <rect x="78" y="24" width="14" height="42" rx="2" fill="#0f172a" />
            <text x="85" y="48" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="bold" fontFamily="monospace">
              850W
            </text>
          </g>
        )}

        {kind === "cooler" && (
          <g>
            <rect x="16" y="22" width="58" height="46" rx="4" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
            <circle cx="32" cy="45" r="11" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
            <circle cx="58" cy="45" r="11" fill="#0f172a" stroke="#0050ff" strokeWidth="2" />
            <path d="M74 36 C86 36, 86 52, 94 52" stroke="#334155" strokeWidth="4" fill="none" />
            <circle cx="96" cy="54" r="11" fill="#0f172a" stroke="#0050ff" strokeWidth="2.5" />
          </g>
        )}

        {kind === "case" && (
          <g>
            <rect x="30" y="10" width="60" height="70" rx="5" fill="#0f172a" stroke="#334155" strokeWidth="2" />
            <rect x="35" y="15" width="38" height="52" rx="2" fill="#1e293b" stroke="#0050ff" strokeWidth="1.5" />
            <circle cx="81" cy="24" r="5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
            <circle cx="81" cy="38" r="5" fill="#0f172a" stroke="#0050ff" strokeWidth="1.8" />
            <circle cx="81" cy="52" r="5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
            <rect x="42" y="36" width="26" height="8" rx="1.5" fill="#0050ff" />
          </g>
        )}

        {kind === "monitor" && (
          <g>
            <rect x="16" y="12" width="88" height="52" rx="4" fill="#0f172a" stroke="#1e293b" strokeWidth="2.5" />
            <rect x="20" y="16" width="80" height="44" rx="2" fill="url(#monGrad)" />
            <rect x="54" y="64" width="12" height="12" fill="#334155" />
            <rect x="38" y="75" width="44" height="4" rx="2" fill="#1e293b" />
            <defs>
              <linearGradient id="monGrad" x1="20" y1="16" x2="100" y2="60" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0050ff" />
                <stop offset="0.55" stopColor="#0a2540" />
                <stop offset="1" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </g>
        )}

        {kind === "desk" && (
          <g>
            <polygon points="14,36 106,36 96,46 24,46" fill="#d97706" stroke="#92400e" strokeWidth="2" />
            <rect x="24" y="46" width="6" height="32" rx="1" fill="#1e293b" />
            <rect x="90" y="46" width="6" height="32" rx="1" fill="#1e293b" />
            <rect x="18" y="76" width="18" height="4" rx="1" fill="#0f172a" />
            <rect x="84" y="76" width="18" height="4" rx="1" fill="#0f172a" />
          </g>
        )}

        {kind === "chair" && (
          <g>
            <rect x="44" y="10" width="32" height="40" rx="8" fill="#1e293b" stroke="#0050ff" strokeWidth="2" />
            <rect x="38" y="48" width="44" height="10" rx="4" fill="#0f172a" />
            <line x1="60" y1="58" x2="60" y2="74" stroke="#334155" strokeWidth="4" />
            <line x1="42" y1="76" x2="78" y2="76" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="42" cy="80" r="3" fill="#0050ff" />
            <circle cx="60" cy="80" r="3" fill="#0050ff" />
            <circle cx="78" cy="80" r="3" fill="#0050ff" />
          </g>
        )}

        {kind === "keyboard" && (
          <g>
            <rect x="14" y="28" width="92" height="36" rx="5" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
            <rect x="20" y="34" width="8" height="6" rx="1" fill="#0050ff" />
            <rect x="31" y="34" width="8" height="6" rx="1" fill="#cbd5e1" />
            <rect x="42" y="34" width="8" height="6" rx="1" fill="#cbd5e1" />
            <rect x="53" y="34" width="8" height="6" rx="1" fill="#cbd5e1" />
            <rect x="64" y="34" width="8" height="6" rx="1" fill="#cbd5e1" />
            <rect x="75" y="34" width="8" height="6" rx="1" fill="#cbd5e1" />
            <rect x="86" y="34" width="14" height="6" rx="1" fill="#38bdf8" />
            <rect x="20" y="43" width="80" height="6" rx="1" fill="#94a3b8" />
            <rect x="34" y="52" width="52" height="6" rx="1.5" fill="#0050ff" />
          </g>
        )}

        {kind === "mouse" && (
          <g>
            <rect x="42" y="14" width="36" height="62" rx="18" fill="#1e293b" stroke="#0050ff" strokeWidth="2" />
            <line x1="60" y1="14" x2="60" y2="38" stroke="#38bdf8" strokeWidth="1.8" />
            <rect x="57" y="22" width="6" height="11" rx="3" fill="#0050ff" />
          </g>
        )}

        {(kind === "headphone" || kind === "microphone" || kind === "speaker" || kind === "lighting" || kind === "decor" || kind === "rug" || kind === "accessory" || !["cpu", "motherboard", "gpu", "ram", "storage", "psu", "cooler", "case", "monitor", "desk", "chair", "keyboard", "mouse"].includes(kind)) && (
          <g>
            <rect x="24" y="18" width="72" height="54" rx="8" fill="#0a2540" stroke="#0050ff" strokeWidth="2" />
            <circle cx="46" cy="45" r="12" fill="#0050ff" />
            <rect x="64" y="35" width="22" height="6" rx="2" fill="#38bdf8" />
            <rect x="64" y="45" width="16" height="5" rx="2" fill="#94a3b8" />
            <rect x="64" y="53" width="12" height="4" rx="2" fill="#64748b" />
          </g>
        )}
      </svg>

      {/* Bottom model label for card/lg */}
      {(size === "card" || size === "lg") && (
        <div className="absolute inset-x-3 bottom-2 flex items-center justify-between text-[10px] text-ink-500">
          <span className="truncate font-medium text-ink-700 max-w-[75%]">{name}</span>
          <span className="font-mono text-[10px] font-bold uppercase text-ink-700">HD SPEC</span>
        </div>
      )}
    </div>
  );
}

/**
 * Dynamic Isometric 3D Hardware Illustrations for the 3D PC Builder Stage.
 * Morphs shape, size, fan count, stick count, color, and spec labels in real time
 * based on the customer's selected part and quantity.
 */
export function Builder3DHardwareGraphic({
  slotKey,
  part,
  qty = 1,
  isActive = false,
  className = "h-24 w-32",
}: {
  slotKey: "cpu" | "motherboard" | "gpu" | "ram" | "storage" | "psu" | "case";
  part?: {
    id?: string;
    name?: string;
    brand?: string;
    color?: string;
    specs?: {
      socket?: string;
      cores?: string;
      formFactor?: "ATX" | "mATX" | "ITX";
      ramType?: string;
      capacityGb?: number;
      modules?: number;
      speedMhz?: number;
      hasRgb?: boolean;
      vramGb?: number;
      lengthMm?: number;
      storageGb?: number;
      interface?: string;
      wattage?: number;
      psuFormFactor?: "ATX" | "SFX";
    };
  } | null;
  qty?: number;
  isActive?: boolean;
  className?: string;
}) {
  const isIntel = part?.brand?.toLowerCase().includes("intel");
  const isWhite = part?.color === "white";
  const accentColor = isActive ? "#fb7185" : "#f43f5e";
  const formFactor = part?.specs?.formFactor ?? "ATX";
  const gpuLen = part?.specs?.lengthMm ?? 300;
  const fanCount = gpuLen <= 245 ? 2 : 3;
  const isFlagshipGpu = gpuLen >= 330;
  const ramStickCount = Math.min(4, Math.max(1, qty || (part?.specs?.modules ?? 2)));
  const hasRgb = part?.specs?.hasRgb ?? true;
  const ssdCount = Math.min(4, Math.max(1, qty || 1));
  const isSfxPsu = part?.specs?.psuFormFactor === "SFX";

  return (
    <svg
      viewBox="0 0 150 110"
      className={`select-none pointer-events-none transition-all duration-300 ${
        isActive
          ? "drop-shadow-[0_12px_22px_rgba(244,63,94,0.42)] scale-105"
          : "drop-shadow-[0_10px_18px_rgba(225,29,72,0.22)]"
      } ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {slotKey === "cpu" && (
        <g transform="rotate(-12 75 55)">
          {isIntel ? (
            /* Intel Rectangular LGA1700 / LGA1851 Package */
            <>
              <rect x="30" y="12" width="90" height="84" rx="6" fill="#0c2d48" stroke="#38bdf8" strokeWidth="2.2" />
              <rect x="42" y="20" width="66" height="68" rx="4" fill="#e2e8f0" stroke="#0050ff" strokeWidth="2.2" />
              <rect x="48" y="26" width="54" height="56" rx="3" fill="#0f172a" />
              <text x="75" y="48" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="800" fontFamily="monospace">
                INTEL
              </text>
              <text x="75" y="61" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="700" fontFamily="monospace">
                {part?.specs?.cores?.split("/")[0]?.trim() || "CORE"}
              </text>
              <rect x="56" y="70" width="38" height="4" rx="1.5" fill="#38bdf8" />
            </>
          ) : (
            /* AMD AM5 Octagonal IHS Package */
            <>
              <rect x="28" y="16" width="94" height="78" rx="6" fill="#143d29" stroke="#22c55e" strokeWidth="2.2" />
              <polygon
                points="46,23 104,23 112,31 112,79 104,87 46,87 38,79 38,31"
                fill="#e2e8f0"
                stroke={accentColor}
                strokeWidth="2.4"
              />
              <rect x="46" y="31" width="58" height="48" rx="3" fill="#0f172a" />
              <text x="75" y="49" textAnchor="middle" fill="#fb7185" fontSize="9" fontWeight="800" fontFamily="monospace">
                RYZEN
              </text>
              <text x="75" y="62" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="700" fontFamily="monospace">
                {part?.specs?.cores?.split("/")[0]?.trim() || "AM5"}
              </text>
              <rect x="56" y="68" width="38" height="4" rx="1.5" fill="#22c55e" />
            </>
          )}
        </g>
      )}

      {slotKey === "motherboard" && (
        <g>
          {/* Board PCB scales with ITX / mATX / ATX and changes color White vs Black */}
          {(() => {
            const bHeight = formFactor === "ITX" ? 58 : formFactor === "mATX" ? 72 : 86;
            const bWidth = formFactor === "ITX" ? 58 : formFactor === "mATX" ? 66 : 74;
            const x0 = Math.round((150 - bWidth) / 2);
            const y0 = Math.round((106 - bHeight) / 2);
            const pcbFill = isWhite ? "#e2e8f0" : "#18181b";
            const pcbStroke = isWhite ? "#94a3b8" : "#52525b";
            const vrmFill = isWhite ? "#ffffff" : "#27272a";
            return (
              <>
                <rect
                  x={x0}
                  y={y0}
                  width={bWidth}
                  height={bHeight}
                  rx="4"
                  fill={pcbFill}
                  stroke={pcbStroke}
                  strokeWidth="2.2"
                />
                {/* VRM Heatsink */}
                <rect
                  x={x0 + 4}
                  y={y0 + 5}
                  width="14"
                  height={Math.min(36, bHeight - 16)}
                  rx="2"
                  fill={vrmFill}
                  stroke={accentColor}
                  strokeWidth="1.6"
                />
                {/* CPU Socket */}
                <rect
                  x={x0 + 22}
                  y={y0 + 12}
                  width="20"
                  height="22"
                  rx="2"
                  fill={isWhite ? "#cbd5e1" : "#a1a1aa"}
                  stroke="#3f3f46"
                  strokeWidth="1.8"
                />
                {/* DIMM Slots */}
                <line x1={x0 + 47} y1={y0 + 10} x2={x0 + 47} y2={y0 + 38} stroke={accentColor} strokeWidth="2.2" />
                <line x1={x0 + 52} y1={y0 + 10} x2={x0 + 52} y2={y0 + 38} stroke="#64748b" strokeWidth="2" />
                {formFactor !== "ITX" && (
                  <>
                    <line x1={x0 + 57} y1={y0 + 10} x2={x0 + 57} y2={y0 + 38} stroke={accentColor} strokeWidth="2.2" />
                    <line x1={x0 + 62} y1={y0 + 10} x2={x0 + 62} y2={y0 + 38} stroke="#64748b" strokeWidth="2" />
                  </>
                )}
                {/* Primary PCIe x16 Slot */}
                <line
                  x1={x0 + 8}
                  y1={y0 + 46}
                  x2={x0 + bWidth - 8}
                  y2={y0 + 46}
                  stroke={accentColor}
                  strokeWidth="3.2"
                />
                {formFactor === "ATX" && (
                  <line
                    x1={x0 + 8}
                    y1={y0 + 66}
                    x2={x0 + bWidth - 14}
                    y2={y0 + 66}
                    stroke="#64748b"
                    strokeWidth="2.4"
                  />
                )}
                {/* Form Factor Badge */}
                <rect x={x0 + bWidth - 34} y={y0 + bHeight - 16} width="30" height="12" rx="2" fill="#0f172a" stroke={accentColor} strokeWidth="1.2" />
                <text x={x0 + bWidth - 19} y={y0 + bHeight - 7.5} textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="800" fontFamily="monospace">
                  {formFactor}
                </text>
              </>
            );
          })()}
        </g>
      )}

      {slotKey === "gpu" && (
        <g transform="rotate(-4 75 55)">
          {(() => {
            const cardW = fanCount === 2 ? 98 : isFlagshipGpu ? 138 : 122;
            const cardH = isFlagshipGpu ? 66 : 56;
            const x0 = Math.round((150 - cardW) / 2);
            const y0 = Math.round((110 - cardH) / 2);
            const bodyFill = isWhite ? "#f1f5f9" : "#18181b";
            const hubFill = isWhite ? "#cbd5e1" : "#09090b";
            const fanR = fanCount === 2 ? 17 : isFlagshipGpu ? 17.5 : 15.5;
            const fanCenters =
              fanCount === 2
                ? [x0 + cardW * 0.3, x0 + cardW * 0.7]
                : [x0 + cardW * 0.21, x0 + cardW * 0.5, x0 + cardW * 0.79];
            return (
              <>
                <rect
                  x={x0}
                  y={y0}
                  width={cardW}
                  height={cardH}
                  rx="6"
                  fill={bodyFill}
                  stroke={accentColor}
                  strokeWidth={isFlagshipGpu ? "2.8" : "2"}
                />
                {/* Top RGB Light Bar */}
                <rect x={x0 + 3} y={y0 + 2} width={cardW - 6} height={isFlagshipGpu ? "7" : "5"} rx="2" fill={accentColor} />
                {/* Cooling Fans */}
                {fanCenters.map((cx, i) => (
                  <g key={i}>
                    <circle cx={cx} cy={y0 + cardH * 0.57} r={fanR} fill={hubFill} stroke={accentColor} strokeWidth="2.2" />
                    <circle cx={cx} cy={y0 + cardH * 0.57} r="4.5" fill={accentColor} />
                  </g>
                ))}
                {/* VRAM Badge */}
                <rect x={x0 + cardW - 34} y={y0 + cardH - 14} width="32" height="12" rx="3" fill="#09090b" stroke={accentColor} strokeWidth="1.2" />
                <text x={x0 + cardW - 18} y={y0 + cardH - 5.5} textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="800" fontFamily="monospace">
                  {part?.specs?.vramGb ?? 12}GB
                </text>
              </>
            );
          })()}
        </g>
      )}

      {slotKey === "ram" && (
        <g transform="rotate(-5 75 55)">
          {Array.from({ length: ramStickCount }).map((_, idx) => {
            const offsetX = (idx - (ramStickCount - 1) / 2) * 6;
            const offsetY = (idx - (ramStickCount - 1) / 2) * -6;
            const bodyFill = isWhite ? "#f1f5f9" : "#27272a";
            const bodyStroke = isWhite ? "#94a3b8" : "#52525b";
            return (
              <g key={idx} transform={`translate(${offsetX}, ${offsetY})`}>
                <rect x="20" y="38" width="110" height="32" rx="4" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.8" />
                {hasRgb ? (
                  <>
                    <rect x="20" y="29" width="110" height="10" rx="3" fill={accentColor} />
                    <rect x="25" y="32" width="100" height="4" rx="1.5" fill="#fda4af" />
                  </>
                ) : (
                  <rect x="20" y="32" width="110" height="7" rx="2" fill="#475569" />
                )}
                <line x1="26" y1="70" x2="124" y2="70" stroke="#f59e0b" strokeWidth="2.8" strokeDasharray="5 3" />
              </g>
            );
          })}
          {/* Total RAM Capacity & Stick Count Badge */}
          <rect x="40" y="82" width="70" height="15" rx="4" fill="#09090b" stroke={accentColor} strokeWidth="1.4" />
          <text x="75" y="92.5" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="800" fontFamily="monospace">
            {(part?.specs?.capacityGb ?? 32) * (qty || 1)}GB ({ramStickCount}x)
          </text>
        </g>
      )}

      {slotKey === "storage" && (
        <g transform="rotate(3 75 55)">
          {Array.from({ length: ssdCount }).map((_, idx) => {
            const offsetY = (idx - (ssdCount - 1) / 2) * -10;
            const offsetX = (idx - (ssdCount - 1) / 2) * 4;
            return (
              <g key={idx} transform={`translate(${offsetX}, ${offsetY})`}>
                <rect
                  x="16"
                  y="42"
                  width="118"
                  height="26"
                  rx="4"
                  fill={isWhite ? "#f1f5f9" : "#18181b"}
                  stroke={isWhite ? "#94a3b8" : "#3f3f46"}
                  strokeWidth="2"
                />
                <rect
                  x="24"
                  y="37"
                  width="94"
                  height="12"
                  rx="2"
                  fill={isWhite ? "#e2e8f0" : "#27272a"}
                  stroke={accentColor}
                  strokeWidth="1.4"
                />
                <line x1="22" y1="60" x2="126" y2="60" stroke={accentColor} strokeWidth="2.2" />
                <rect x="12" y="48" width="6" height="14" rx="1" fill="#f59e0b" />
              </g>
            );
          })}
          <rect x="38" y="82" width="74" height="15" rx="4" fill="#09090b" stroke={accentColor} strokeWidth="1.4" />
          <text x="75" y="92.5" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="800" fontFamily="monospace">
            {((part?.specs?.storageGb ?? 2000) * ssdCount) >= 1000
              ? `${(((part?.specs?.storageGb ?? 2000) * ssdCount) / 1000).toFixed(
                  ((part?.specs?.storageGb ?? 2000) * ssdCount) % 1000 === 0 ? 0 : 1
                )}TB`
              : `${(part?.specs?.storageGb ?? 500) * ssdCount}GB`}{" "}
            ({ssdCount}x M.2)
          </text>
        </g>
      )}

      {slotKey === "psu" && (
        <g transform="rotate(-10 75 55)">
          {(() => {
            const w = isSfxPsu ? 84 : 104;
            const h = isSfxPsu ? 62 : 74;
            const x0 = Math.round((150 - w) / 2);
            const y0 = Math.round((110 - h) / 2);
            return (
              <>
                <rect
                  x={x0}
                  y={y0}
                  width={w}
                  height={h}
                  rx="6"
                  fill={isWhite ? "#f8fafc" : "#18181b"}
                  stroke={isWhite ? "#94a3b8" : "#52525b"}
                  strokeWidth="2.4"
                />
                <circle
                  cx="75"
                  cy={y0 + h * 0.46}
                  r={isSfxPsu ? 18 : 22}
                  fill="#09090b"
                  stroke={accentColor}
                  strokeWidth="2.6"
                />
                <circle cx="75" cy={y0 + h * 0.46} r={isSfxPsu ? 10 : 13} fill="none" stroke="#64748b" strokeWidth="1.4" />
                <circle cx="75" cy={y0 + h * 0.46} r="5" fill={accentColor} />
                <rect x={x0 + 8} y={y0 + h - 17} width={w - 16} height="13" rx="3" fill="#09090b" stroke={accentColor} strokeWidth="1.2" />
                <text x="75" y={y0 + h - 8} textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="800" fontFamily="monospace">
                  {part?.specs?.wattage ?? 850}W {isSfxPsu ? "SFX" : "ATX"}
                </text>
              </>
            );
          })()}
        </g>
      )}

      {slotKey === "case" && (
        <g>
          <rect
            x="42"
            y="10"
            width="66"
            height="90"
            rx="6"
            fill={isWhite ? "#f8fafc" : "#18181b"}
            stroke={accentColor}
            strokeWidth="2"
          />
          <rect x="48" y="16" width="42" height="66" rx="3" fill="#27272a" />
          <circle cx="98" cy="28" r="6" fill="#09090b" stroke={accentColor} strokeWidth="2" />
          <circle cx="98" cy="44" r="6" fill="#09090b" stroke={accentColor} strokeWidth="2" />
          <circle cx="98" cy="60" r="6" fill="#09090b" stroke={accentColor} strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}
