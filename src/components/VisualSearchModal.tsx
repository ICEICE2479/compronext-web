"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Box, Camera, ExternalLink, ImagePlus, Search, Sparkles, X } from "lucide-react";
import Spinner from "@/components/Spinner";
import { formatTHB, CATEGORY_LABELS } from "@/lib/format";
import { displayPhotoSrc } from "@/lib/own-storage";
import { addProductToSaved3DRoom } from "@/components/design/studio-tools";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";

interface MatchedProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string | null;
  storeName?: string;
  platform?: string;
  dimensions?: { width: number; depth: number; height: number; unit: string };
  colors?: string[];
}

interface DetectedPalette {
  hex: string;
  labelTh: string;
  colorKey: string;
  keyword: string;
}

const QUICK_CATS: Array<{ id: string; label: string }> = [
  { id: "all", label: "ทั้งหมด" },
  { id: "desk", label: "โต๊ะคอม/โต๊ะทำงาน" },
  { id: "chair", label: "เก้าอี้" },
  { id: "lighting", label: "โคมไฟ/ไฟ RGB" },
  { id: "monitor", label: "จอคอม" },
  { id: "storage", label: "ชั้นวาง/ตู้" },
  { id: "rug", label: "พรม" },
  { id: "keyboard", label: "คีย์บอร์ด/เมาส์" },
];

function classifyRgb(r: number, g: number, b: number): DetectedPalette {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (255 - Math.abs(2 * l - 255));
  const hex = `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

  if (l > 200 && s < 0.22) {
    return { hex, labelTh: "โทนขาว / มินิมอล", colorKey: "white", keyword: "ขาว" };
  }
  if (l < 65 && s < 0.3) {
    return { hex, labelTh: "โทนดำ / ดาร์กโหมด", colorKey: "black", keyword: "ดำ" };
  }
  if (s < 0.18) {
    return { hex, labelTh: "โทนเทา / เงินโมเดิร์น", colorKey: "grey", keyword: "เทา" };
  }
  if (r > g && g > b && r - b > 35) {
    return { hex, labelTh: "โทนไม้ธรรมชาติ / น้ำตาลอบอุ่น", colorKey: "wood", keyword: "ไม้" };
  }
  if (b > r + 25 && b > g) {
    return { hex, labelTh: "โทนน้ำเงิน / ฟ้าคราม", colorKey: "blue", keyword: "น้ำเงิน" };
  }
  if (g > r + 20 && g > b) {
    return { hex, labelTh: "โทนเขียวธรรมชาติ", colorKey: "green", keyword: "เขียว" };
  }
  if (r > b + 25 && r > g + 25) {
    return { hex, labelTh: "โทนชมพู / แดงพาสเทล", colorKey: "pink", keyword: "ชมพู" };
  }
  return { hex, labelTh: "โทนไม้ / เบจมินิมอล", colorKey: "beige", keyword: "มินิมอล" };
}

async function analyzeImagePalette(file: File): Promise<{ dataUrl: string; palette: DetectedPalette }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl, palette: { hex: "#f8fafc", labelTh: "โทนขาวมินิมอล", colorKey: "white", keyword: "ขาว" } };
  }
  ctx.drawImage(img, 0, 0, size, size);
  // สุ่มเฉพาะบริเวณกลางภาพ (25%..75%) เพื่อจับสีของเฟอร์นิเจอร์ชิ้นหลัก
  const data = ctx.getImageData(16, 16, 32, 32).data;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    count++;
  }
  const palette = classifyRgb(rSum / (count || 1), gSum / (count || 1), bSum / (count || 1));
  return { dataUrl, palette };
}

export function VisualSearchModal({
  onClose,
  onApplyFilter,
}: {
  onClose: () => void;
  onApplyFilter?: (cat: string, query: string) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [palette, setPalette] = useState<DetectedPalette | null>(null);
  const [targetCat, setTargetCat] = useState<string>("all");
  const [results, setResults] = useState<MatchedProduct[]>([]);
  const [searching, setSearching] = useState(false);

  async function runVisualMatch(pal: DetectedPalette, catId: string) {
    setSearching(true);
    try {
      const sp = new URLSearchParams();
      if (catId !== "all") sp.set("cat", catId);
      sp.set("limit", "36");
      const res = await fetch(`/api/products?${sp.toString()}`);
      const data = (await res.json()) as { items?: MatchedProduct[] };
      const list = data.items ?? [];

      // จัดอันดับความใกล้เคียงของสีและชื่อ
      const scored = [...list].sort((a, b) => {
        const aColors = (a.colors ?? []).join(" ").toLowerCase();
        const bColors = (b.colors ?? []).join(" ").toLowerCase();
        const aMatch =
          (aColors.includes(pal.colorKey) ? 3 : 0) +
          (a.name.includes(pal.keyword) ? 2 : 0) +
          (a.imageUrl ? 1 : 0);
        const bMatch =
          (bColors.includes(pal.colorKey) ? 3 : 0) +
          (b.name.includes(pal.keyword) ? 2 : 0) +
          (b.imageUrl ? 1 : 0);
        return bMatch - aMatch;
      });
      setResults(scored.slice(0, 8));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const { dataUrl, palette: detected } = await analyzeImagePalette(file);
    setPreview(dataUrl);
    setPalette(detected);
    await runVisualMatch(detected, targetCat);
  }

  async function handleCatSwitch(nextCat: string) {
    setTargetCat(nextCat);
    if (palette) {
      await runVisualMatch(palette, nextCat);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-3 backdrop-blur-xs" onClick={onClose}>
      <div
        className="card max-h-[88vh] w-full max-w-2xl space-y-3 overflow-y-auto p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-ink-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-info-bg text-info">
              <Camera className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-ink-950">ค้นหาเฟอร์นิเจอร์ด้วยรูปภาพ (Visual Search)</h3>
              <p className="text-[11px] text-ink-500">อัปโหลดรูปโต๊ะ เก้าอี้ หรือมุมห้องที่ชอบ ระบบจะวิเคราะห์โทนสีและจับคู่สินค้าใกล้เคียงให้ทันที</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="icon-btn h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {!preview ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-info/40 bg-info-bg/30 py-8 text-center transition-colors hover:bg-info-bg/60"
          >
            <ImagePlus className="h-9 w-9 text-info" />
            <span className="text-sm font-bold text-ink-900">แตะเพื่อเลือกรูปภาพ หรือถ่ายรูปของที่อยากหา</span>
            <span className="text-xs text-ink-500">รองรับรูปจาก Pinterest, TikTok หรือรูปถ่ายจากมือถือ</span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-ink-50/70 p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-16 w-20 rounded-xl object-cover ring-1 ring-ink-200" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full ring-1 ring-black/15" style={{ backgroundColor: palette?.hex }} />
                <span className="text-xs font-bold text-ink-950">{palette?.labelTh}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-600">เลือกหมวดสินค้าที่ต้องการให้ระบบจับคู่จากรูปนี้:</p>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn btn-outline h-8 rounded-full px-3 text-xs"
            >
              เปลี่ยนรูป
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {QUICK_CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              data-active={targetCat === c.id}
              onClick={() => handleCatSwitch(c.id)}
              className="chip min-h-8 px-2.5 text-xs"
            >
              {c.label}
            </button>
          ))}
        </div>

        {searching && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs font-semibold text-ink-600">
            <Spinner size={18} /> กำลังวิเคราะห์โทนสีและค้นหาสินค้าที่ใกล้เคียงที่สุด…
          </div>
        )}

        {!searching && preview && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-ink-800">
                <Sparkles className="mr-1 inline h-3.5 w-3.5 text-info" />
                สินค้าที่โทนสีและสไตล์ใกล้เคียง ({results.length} ชิ้น)
              </p>
              {onApplyFilter && palette && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyFilter(targetCat, palette.keyword);
                    onClose();
                  }}
                  className="text-xs font-bold text-info hover:underline"
                >
                  <Search className="mr-1 inline h-3 w-3" /> ดูทั้งหมดในหน้าสินค้า
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {results.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-surface p-2 hover:border-info/50"
                >
                  <Link
                    href={`/products/${p.id}`}
                    onClick={onClose}
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-media"
                  >
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={displayPhotoSrc(p.imageUrl)} alt="" className="max-h-full max-w-full object-contain" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${p.id}`}
                      onClick={onClose}
                      className="line-clamp-1 text-xs font-bold text-ink-950 hover:text-info"
                    >
                      {p.name}
                    </Link>
                    <p className="text-[11px] text-ink-500">
                      {(CATEGORY_LABELS as Record<string, string>)[p.category] ?? p.category} · {formatTHB(p.price)}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          addProductToSaved3DRoom(p);
                          toast(`📦 วาง "${p.name}" ลงในห้อง 3D แล้ว`);
                          onClose();
                          router.push("/room-3d?mode=studio");
                        }}
                        className="inline-flex h-6 items-center gap-1 rounded-full bg-info-bg px-2 text-[10px] font-bold text-info hover:bg-info hover:text-white"
                      >
                        <Box className="h-3 w-3" /> ลองวาง 3D
                      </button>
                      <Link
                        href={`/products/${p.id}`}
                        onClick={onClose}
                        className="inline-flex h-6 items-center gap-1 rounded-full border border-ink-200 px-2 text-[10px] font-semibold text-ink-700 hover:border-info"
                      >
                        <ExternalLink className="h-2.5 w-2.5" /> ดูสเปก
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
