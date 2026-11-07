import Link from "next/link";
import { Package } from "lucide-react";
import type { RoomWithTotals } from "@/lib/types";
import { formatTHB, STYLE_LABELS } from "@/lib/format";
import { RoomCoverVisual } from "./RoomCoverVisual";
import { WishlistButton } from "./WishlistButton";
import { PrefetchArticle } from "./CompareProductButton";

/** การ์ดไอเดียห้องแบบรูปเด่น */
export function RoomCard({ room, className }: { room: RoomWithTotals; className?: string }) {
  const { totals } = room;

  return (
    <PrefetchArticle href={`/rooms/${room.slug}`} className={`tile card-lift group ${className ?? ""}`}>
      <Link
        href={`/rooms/${room.slug}`}
        className="relative block aspect-[4/3] overflow-hidden bg-media"
        tabIndex={-1}
        aria-hidden="true"
      >
        <span className="img-zoom block h-full w-full">
          <RoomCoverVisual
            src={room.images[0] ?? null}
            alt=""
            style={room.style}
            title={room.name}
            className="h-full w-full"
          />
        </span>
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-ink-900">
          {STYLE_LABELS[room.style] ?? room.style}
        </span>
      </Link>
      <div className="absolute right-2.5 top-2.5">
        <WishlistButton roomId={room.id} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-3.5">
        <Link href={`/rooms/${room.slug}`} className="line-clamp-2 text-sm font-semibold leading-snug text-ink-950 hover:text-info">
          {room.name}
        </Link>
        <div className="mt-auto flex items-center justify-between gap-2 text-xs text-ink-500">
          <span className="min-w-0 truncate font-display text-base font-bold text-ink-950 tabular-nums">{formatTHB(totals.availableTotal)}</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Package className="h-3.5 w-3.5" aria-hidden="true" /> {totals.itemCount} ชิ้น
          </span>
        </div>
      </div>
    </PrefetchArticle>
  );
}
