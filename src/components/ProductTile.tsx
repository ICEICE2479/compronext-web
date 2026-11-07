import Link from "next/link";
import { Box, ExternalLink, LayoutGrid } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatTHB } from "@/lib/format";
import { isSafeHttpUrl } from "@/lib/links";
import { ProductVisual } from "@/components/ProductVisual";
import { AddToCartButton } from "@/components/AddToCartButton";
import { CompareIconButton, PrefetchArticle } from "@/components/CompareProductButton";
import { isComparable } from "@/lib/spec-extract";

/** ข้อมูลขั้นต่ำที่การ์ดสินค้าต้องใช้ */
export type TileProduct = Pick<
  Product,
  "id" | "name" | "imageUrl" | "price" | "buyUrl" | "storeName" | "platform" | "category" | "status"
> & { modelUrl?: string | null; sourceImageUrl?: string | null };

export function productToCartInput(p: TileProduct, quantity = 1) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    buyUrl: p.buyUrl,
    storeName: p.storeName || p.platform,
    quantity,
  };
}

/** การ์ดสินค้าแบบรูปเด่น + ปุ่มไอคอน (ใส่ตะกร้า / ไปร้าน / ดูในห้อง) */
export function ProductTile({ product: p, roomSlug, className }: { product: TileProduct; roomSlug?: string; className?: string }) {
  const available = p.status === "available";

  return (
    <PrefetchArticle href={`/products/${p.id}`} className={`tile card-lift ${className ?? ""}`}>
      <Link href={`/products/${p.id}`} className="tile-media" tabIndex={-1} aria-hidden="true">
        <span className="img-zoom block h-full w-full">
          <ProductVisual
            productId={p.id}
            name={p.name}
            category={p.category}
            imageUrl={p.imageUrl}
            photoUrl={p.sourceImageUrl}
            size="tile"
            transparentBg
          />
        </span>
        {p.modelUrl && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-ink-950/80 px-2 py-0.5 text-[11px] font-bold text-white">
            <Box className="h-3 w-3" aria-hidden="true" /> 3D / AR
          </span>
        )}
        {!available && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-bad">
            สินค้าหมด
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-3.5">
        <Link
          href={`/products/${p.id}`}
          className="line-clamp-2 text-sm font-semibold leading-snug text-ink-950 hover:text-info"
        >
          {p.name}
        </Link>
        <p className="truncate text-xs text-ink-500">{p.storeName || p.platform}</p>

        <div className="mt-auto flex min-w-0 items-center gap-1.5 pt-2">
          <span className="mr-auto min-w-0 truncate font-display text-base font-bold text-ink-950 tabular-nums">{formatTHB(p.price)}</span>
          <span className="hidden sm:contents">
            {isComparable(p.category) && <CompareIconButton productId={p.id} />}
          </span>
          {roomSlug && (
            <Link href={`/rooms/${roomSlug}`} className="icon-btn hidden h-9 min-w-9 px-0 sm:inline-flex" aria-label="ดูในห้องตัวอย่าง" title="ดูในห้องตัวอย่าง">
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          {available && isSafeHttpUrl(p.buyUrl) && (
            <a
              href={`/go/${encodeURIComponent(p.id)}`}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="icon-btn hidden h-9 min-w-9 px-0 sm:inline-flex"
              aria-label={`ดูที่ร้าน ${p.storeName || p.platform}`}
              title={`ดูที่ร้าน ${p.storeName || p.platform}`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
          {available && <AddToCartButton item={productToCartInput(p)} className="h-11 min-w-11 shrink-0 px-0 sm:h-9 sm:min-w-9" />}
        </div>
      </div>
    </PrefetchArticle>
  );
}
