import type { Metadata } from "next";
import { shareMeta } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft, HelpCircle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { getAllProducts, getRoomBySlugOrId } from "@/lib/data/store";
import {
  calculateRoomTotals,
  findReplacementProducts,
  resolveRoomItems,
} from "@/lib/pricing";
import { evaluateRoomCompatibility } from "@/lib/compatibility";
import { formatTHB, formatThaiDate, STYLE_LABELS } from "@/lib/format";
import { WishlistButton } from "@/components/WishlistButton";
import { BuyAllRoomModal } from "@/components/BuyAllRoomModal";
import { RoomGallery } from "@/components/RoomGallery";
import { RoomSizePlanner } from "@/components/RoomSizePlanner";
import { ProductTile, productToCartInput } from "@/components/ProductTile";
import { StickyBuyBar } from "@/components/StickyBuyBar";
import { RoomSavings } from "@/components/RoomSavings";
import { findCheaperSwaps } from "@/lib/room-swaps";

export const revalidate = 60;
/** สร้างหน้าห้องตอนมีคนเปิดครั้งแรก แล้วแคชไว้ (รีเฟรชทุก 60 วิ) */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const room = getRoomBySlugOrId(slug);
  return room ? shareMeta({ title: room.name, description: room.description, path: `/rooms/${room.slug}`, image: room.images[0], type: "article" }) : {};
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = getRoomBySlugOrId(slug, false);
  if (!room) {
    notFound();
  }

  const allProducts = getAllProducts();
  const productMap = new Map(allProducts.map((p) => [p.id, p]));
  const resolvedItems = resolveRoomItems(room, productMap);
  const totals = calculateRoomTotals(room, productMap);
  const compat = evaluateRoomCompatibility(resolvedItems);
  const buyable = resolvedItems.flatMap((it) => (it.product && it.product.status === "available" ? [{ product: it.product, quantity: it.quantity }] : []));
  const savings = findCheaperSwaps(buyable, allProducts);
  const deskProduct = resolvedItems.find((it) => it.product?.category === "desk")?.product;
  const deskWidthCm = deskProduct?.dimensions?.width ?? 140;
  const deskDepthCm = deskProduct?.dimensions?.depth ?? 70;

  const available = resolvedItems.filter(
    (it): it is typeof it & { product: NonNullable<typeof it.product> } => it.product?.status === "available"
  );
  const unavailable = resolvedItems.filter((it) => it.product && it.product.status !== "available");
  const roomCart = available.map((it) => productToCartInput(it.product, it.quantity));

  return (
    <div className="container-page space-y-8 py-6 sm:py-8">
      <Link href="/rooms" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-950">
        <ChevronLeft className="h-4 w-4" /> ไอเดียห้อง
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <RoomGallery images={room.images} roomName={room.name} style={room.style} items={resolvedItems} />
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5">
          <span className="inline-flex rounded-full bg-info-bg px-3 py-1 text-xs font-semibold text-info">
            {STYLE_LABELS[room.style] ?? room.style}
          </span>
          <h1 className="font-display text-2xl font-bold leading-snug text-ink-950 sm:text-3xl">{room.name}</h1>
          <p className="line-clamp-3 text-sm text-ink-600">{room.description}</p>

          <div className="flex items-baseline justify-between rounded-2xl border border-ink-200 bg-white p-4">
            <span className="text-sm text-ink-600">ทั้งห้อง {totals.availableCount} ชิ้น</span>
            <span className="font-display text-3xl font-bold text-ink-950">{formatTHB(totals.availableTotal)}</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <BuyAllRoomModal roomName={room.name} items={resolvedItems} availableTotal={totals.availableTotal} />
            <WishlistButton roomId={room.id} variant="full" />
          </div>
          <p className="text-[11px] text-ink-500">
            ราคา ณ {formatThaiDate(totals.newestPriceDate)} · ซื้อและชำระเงินที่ร้านค้าแต่ละร้านโดยตรง
          </p>
          <RoomSavings swaps={savings.swaps} keep={savings.keep} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-ink-950">ของในห้องนี้ ({totals.itemCount})</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {available.map((it) => (
            <ProductTile key={it.productId} product={it.product} />
          ))}
        </div>

        {unavailable.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-warn">สินค้าหมด — แนะนำตัวแทน</h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {unavailable.flatMap((it) => findReplacementProducts(it.product!, allProducts, 1)).map((rep) => (
                <ProductTile key={rep.id} product={rep} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* เครื่องมือเสริม: ซ่อนไว้ กดเปิดเมื่ออยากดู */}
      <details className="group rounded-2xl border border-ink-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
          <span className="flex items-center gap-2 font-display text-base font-bold text-ink-950">
            {compat.overall === "pass" ? (
              <CheckCircle2 className="h-5 w-5 text-ok" />
            ) : compat.overall === "fail" ? (
              <ShieldAlert className="h-5 w-5 text-bad" />
            ) : (
              <HelpCircle className="h-5 w-5 text-warn" />
            )}
            เช็กขนาดห้อง & ความเข้ากันได้
          </span>
          <ChevronDown className="h-5 w-5 text-ink-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-ink-100 p-4">
          <div className="grid gap-2 md:grid-cols-2">
            {compat.checks.map((chk) => (
              <div key={chk.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-200 p-3" title={chk.detail}>
                <span className="text-sm font-semibold text-ink-900">{chk.title}</span>
                <span
                  className={`badge shrink-0 ${
                    chk.status === "pass" ? "bg-ok-bg text-ok" : chk.status === "fail" ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn"
                  }`}
                >
                  {chk.status === "pass" ? "ผ่าน" : chk.status === "fail" ? "ไม่เข้ากัน" : "ไม่มีข้อมูล"}
                </span>
              </div>
            ))}
          </div>
          <RoomSizePlanner deskWidthCm={deskWidthCm} deskDepthCm={deskDepthCm} roomName={room.name} />
        </div>
      </details>

      {roomCart.length > 0 && (
        <StickyBuyBar
          price={totals.availableTotal}
          label="ใส่ตะกร้าทั้งห้อง"
          item={roomCart}
          caption={`${totals.availableCount} ชิ้น · ${room.name}`}
        />
      )}
    </div>
  );
}
