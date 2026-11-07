import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft, ExternalLink, LayoutGrid, LifeBuoy, Plus, Store } from "lucide-react";
import { getAllCatalogProducts, getAllRooms, getProductById } from "@/lib/data/store";
import { extractProductBrand, UNKNOWN_BRAND } from "@/lib/catalog-taxonomy";
import { CATEGORY_LABELS, colorLabel, formatTHB, formatThaiDate, materialLabel } from "@/lib/format";
import { isSafeHttpUrl } from "@/lib/links";
import { ViewBeacon } from "@/components/ViewBeacon";
import { ProductVisual } from "@/components/ProductVisual";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductTile, productToCartInput } from "@/components/ProductTile";
import { ModelViewer3D } from "@/components/ModelViewer3D";
import { CompareProductButton } from "@/components/CompareProductButton";
import { PriceWatchButton } from "@/components/PriceWatchButton";
import { RoomCoverVisual } from "@/components/RoomCoverVisual";
import { StickyBuyBar } from "@/components/StickyBuyBar";
import { isComparable } from "@/lib/spec-extract";
import { getStore, ratingSummary, storeKeyOf } from "@/lib/stores";
import { StarRating } from "@/components/reviews/StarRating";
import { ChatStoreButton } from "@/components/chat/ChatStoreButton";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { AffiliateNote } from "@/components/AffiliateNote";
import { WorthIt } from "@/components/WorthIt";
import { jsonLdHtml, productJsonLd, shareMeta } from "@/lib/seo";
import { sameModelOffers } from "@/lib/price-compare";

export const revalidate = 60;
/** สร้างหน้าตอนมีคนเปิดครั้งแรก แล้วแคชไว้ (รีเฟรชทุก 60 วิ) */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) return {};
  return shareMeta({
    title: product.name,
    description: `${formatTHB(product.price)} · ${product.description}`,
    path: `/products/${product.id}`,
    image: product.imageUrl,
  });
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) notFound();

  const brand = extractProductBrand(product.name, product.category, product.platform);
  const storeName = product.storeName || product.platform;
  const store = getStore(storeKeyOf(storeName));
  const storeRating = store ? ratingSummary(store.key) : null;
  const catLabel = (CATEGORY_LABELS as Record<string, string>)[product.category] || product.category;
  const available = product.status === "available";
  const allRoomsWith = getAllRooms(false).filter((r) => r.items.some((it) => it.productId === product.id));
  const rooms = allRoomsWith.slice(0, 4);
  const catalog = getAllCatalogProducts();

  // ซื้อคู่กันบ่อย: ของที่อยู่ในห้องเดียวกันบ่อยที่สุด (คนละหมวด)
  const coCount = new Map<string, number>();
  for (const r of allRoomsWith)
    for (const it of r.items) if (it.productId !== product.id) coCount.set(it.productId, (coCount.get(it.productId) ?? 0) + 1);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const together = [...coCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pid]) => byId.get(pid))
    .filter((p): p is NonNullable<typeof p> => !!p && p.status === "available" && p.category !== product.category)
    .filter((p, i, arr) => arr.findIndex((x) => x.category === p.category) === i)
    .slice(0, 3);
  const bundle = available ? [product, ...together] : together;
  const bundleTotal = bundle.reduce((sum, p) => sum + p.price, 0);

  const offers = sameModelOffers(product, catalog);
  const related = catalog
    .filter((p) => p.category === product.category && p.id !== product.id && p.status === "available")
    .slice(0, 8);

  const details: Array<[string, string]> = [];
  if (brand !== UNKNOWN_BRAND) details.push(["แบรนด์", brand]);
  if (product.dimensions) {
    const d = product.dimensions;
    details.push(["ขนาด (กว้าง×ลึก×สูง)", `${d.width ?? "?"} × ${d.depth ?? "?"} × ${d.height ?? "?"} ${d.unit}`]);
  }
  if (product.colors.length) details.push(["สี", product.colors.map(colorLabel).join(", ")]);
  if (product.materials.length) details.push(["วัสดุ", product.materials.map(materialLabel).join(", ")]);
  for (const [k, v] of Object.entries(product.specs)) details.push([k, v]);

  return (
    <div className="container-page space-y-10 py-6 sm:py-8">
      <ViewBeacon productId={product.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdHtml(productJsonLd(product, { brand: brand === UNKNOWN_BRAND ? undefined : brand, storeName, rating: storeRating }))}
      />
      <Link href={`/categories?cat=${product.category}`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-950">
        <ChevronLeft className="h-4 w-4" /> {catLabel}
      </Link>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="min-w-0 space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-ink-200/80 bg-surface p-2 shadow-xs">
            <ProductVisual productId={product.id} name={product.name} category={product.category} imageUrl={product.imageUrl} photoUrl={product.sourceImageUrl} size="tile" transparentBg />
          </div>
          {product.modelUrl && <ModelViewer3D src={product.modelUrl} alt={product.name} poster={product.imageUrl} />}
        </div>

        <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            {store ? (
              <Link href={`/stores/${encodeURIComponent(store.key)}`} className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-600 hover:text-info">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Store className="h-4 w-4" /> {storeName}
                </span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <StarRating value={storeRating?.avg ?? 0} size={12} />
                  {storeRating?.count ? `${storeRating.avg.toFixed(1)} (${storeRating.count} รีวิว)` : "ยังไม่มีรีวิว"}
                </span>
              </Link>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm text-ink-600">
                <Store className="h-4 w-4" /> {storeName}
              </p>
            )}
            <h1 className="font-display text-2xl font-bold leading-snug text-ink-950 sm:text-3xl">{product.name}</h1>
            <p className="font-display text-3xl font-bold text-ink-950">{formatTHB(product.price)}</p>
            <p className="text-xs text-ink-500">
              ราคา ณ {formatThaiDate(product.priceUpdatedAt)}
              {product.priceCheckedAt && <> · เช็กกับร้านล่าสุด {formatThaiDate(product.priceCheckedAt.slice(0, 10))}</>} · อาจต่างจากที่ร้าน ·{" "}
              {available ? "มีของพร้อมขาย" : "สินค้าหมดชั่วคราว"}
            </p>
          </div>
          <WorthIt product={product} catalog={catalog} />
          {product.priceHistory && <PriceHistoryChart history={product.priceHistory} current={product.price} />}

          {available && (
            <div className="flex gap-2">
              <AddToCartButton item={productToCartInput(product)} category={product.category} label="ใส่ตะกร้า" className="flex-1 h-12" />
              <PriceWatchButton productId={product.id} />
              {isComparable(product.category) && <CompareProductButton productId={product.id} />}
              {store?.partner && (
                <ChatStoreButton storeKey={store.key} storeName={store.name} productId={product.id} productName={product.name} compact />
              )}
              {isSafeHttpUrl(product.buyUrl) && (
                <a
                  href={`/go/${encodeURIComponent(product.id)}`}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="icon-btn h-12 px-3"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-sm font-semibold">ซื้อที่ร้าน</span>
                </a>
              )}
            </div>
          )}
          {available && <AffiliateNote />}

          {product.description && product.description !== product.name && (
            <p className="text-sm leading-relaxed text-ink-700">{product.description}</p>
          )}


          {offers.length > 0 && (
            <section className="rounded-2xl border border-ink-200 p-4">
              <p className="mb-2 font-display text-base font-bold text-ink-950">รุ่นเดียวกันจากร้านอื่น</p>
              <ul className="divide-y divide-ink-100 text-sm">
                {offers.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 py-2">
                    <Link href={`/products/${o.id}`} className="min-w-0 flex-1 hover:text-info">
                      <span className="block font-semibold text-ink-950">{o.storeName}</span>
                      <span className="block truncate text-xs text-ink-600">{o.name}</span>
                    </Link>
                    <span className={`shrink-0 font-display font-bold ${o.price < product.price ? "text-ok" : "text-ink-950"}`}>
                      {formatTHB(o.price)}
                      {o.price < product.price && <span className="ml-1 text-xs font-semibold">ถูกกว่า {formatTHB(product.price - o.price)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-ink-500">จับคู่จากชื่อรุ่น ราคา ณ วันที่ร้านอัปเดต · เช็กสเปกให้ตรงก่อนซื้อ</p>
            </section>
          )}

          {product.partnerId && (
            <Link href={`/returns/new?product=${encodeURIComponent(product.id)}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-info">
              <LifeBuoy className="h-3.5 w-3.5" /> ซื้อจากร้านนี้แล้วมีปัญหา? แจ้งร้านผ่าน ComproNext
            </Link>
          )}

          {details.length > 0 && (
            <details className="group rounded-xl border border-ink-200">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 font-display text-base font-bold text-ink-950">
                สเปกสินค้า
                <ChevronDown className="h-5 w-5 text-ink-500 transition-transform group-open:rotate-180" />
              </summary>
              <table className="w-full border-t border-ink-100 text-sm">
                <tbody>
                  {details.map(([k, v]) => (
                    <tr key={k} className="border-b border-ink-100 last:border-0">
                      <th scope="row" className="w-2/5 bg-ink-50 px-3 py-2 text-left font-medium text-ink-600">{k}</th>
                      <td className="px-3 py-2 text-ink-900">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          <p className="text-[11px] leading-relaxed text-ink-500">
            ComproNext เป็นตัวกลางแนะนำสินค้า การชำระเงิน จัดส่ง และรับประกันเป็นไปตามเงื่อนไขของร้าน {product.storeName || product.platform}
          </p>
        </div>
      </div>

      {together.length > 0 && bundle.length > 1 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-ink-950">ซื้อคู่กันบ่อย</h2>
          <div className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-surface p-4 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              {bundle.map((p, i) => (
                <div key={p.id} className="flex shrink-0 items-center gap-2">
                  {i > 0 && <Plus className="h-4 w-4 text-ink-400" />}
                  <Link href={`/products/${p.id}`} className="block w-24 sm:w-28" title={p.name}>
                    <div className="relative aspect-square overflow-hidden rounded-xl border border-ink-200/70 bg-ink-50/50 p-1.5">
                      <ProductVisual productId={p.id} name={p.name} category={p.category} imageUrl={p.imageUrl} photoUrl={p.sourceImageUrl} size="tile" transparentBg />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-700">{p.name}</p>
                    <p className="text-xs font-bold text-ink-950">{formatTHB(p.price)}</p>
                  </Link>
                </div>
              ))}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 md:flex-col md:items-end">
              <p className="text-sm text-ink-600">
                รวม <span className="font-display text-xl font-bold text-ink-950">{formatTHB(bundleTotal)}</span>
              </p>
              <AddToCartButton item={bundle.map((p) => productToCartInput(p))} label={`ใส่ตะกร้า ${bundle.length} ชิ้น`} className="h-11 px-5" />
            </div>
          </div>
        </section>
      )}

      {rooms.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink-950">
            <LayoutGrid className="h-5 w-5 text-info" /> อยู่ในห้องเหล่านี้
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {rooms.map((room) => (
              <Link key={room.id} href={`/rooms/${room.slug}`} className="tile">
                <div className="relative aspect-[4/3]">
                  <RoomCoverVisual src={room.images[0]} alt={room.name} title={room.name} style={room.style} className="h-full w-full" />
                </div>
                <p className="line-clamp-2 p-3 text-sm font-semibold text-ink-950">{room.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-ink-950">สินค้าใกล้เคียง</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductTile key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {available && (
        <StickyBuyBar price={product.price} label="ใส่ตะกร้า" item={productToCartInput(product)} caption={product.storeName || product.platform} />
      )}
    </div>
  );
}
