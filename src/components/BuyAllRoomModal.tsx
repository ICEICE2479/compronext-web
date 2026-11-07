"use client";

import { useCallback, useRef, useState } from "react";
import { ShoppingBag, Store, X } from "lucide-react";
import { useFocusTrap } from "@/components/useFocusTrap";
import type { Product, ResolvedRoomItem } from "@/lib/types";
import { formatTHB, formatThaiDate } from "@/lib/format";
import { ExternalStoreButton } from "@/components/ExternalStoreModal";
import { AddToCartButton } from "@/components/AddToCartButton";
import { productToCartInput } from "@/components/ProductTile";

export function BuyAllRoomModal({
  roomName,
  items,
  availableTotal,
}: {
  roomName: string;
  items: ResolvedRoomItem[];
  availableTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useFocusTrap(dialogRef, open, close);

  const availableItems = items.filter(
    (it): it is ResolvedRoomItem & { product: Product } =>
      it.product !== null && it.product.status === "available"
  );

  // จัดกลุ่มตามแพลตฟอร์ม/ร้านค้า
  const byPlatform = availableItems.reduce<
    Record<string, Array<{ product: Product; quantity: number }>>
  >((acc, it) => {
    const key = it.product.platform || it.product.storeName || "ร้านค้าภายนอก";
    if (!acc[key]) acc[key] = [];
    acc[key].push({ product: it.product, quantity: it.quantity });
    return acc;
  }, {});

  return (
    <>
      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
        {availableItems.length > 0 && (
          <AddToCartButton
            item={availableItems.map((it) => productToCartInput(it.product, it.quantity))}
            label={`ใส่ตะกร้าทั้งห้อง (${availableItems.length} ชิ้น)`}
            className="flex-1 sm:flex-initial h-11"
          />
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-outline flex-1 sm:flex-initial"
        >
          <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>ดูลิงก์แยกตามร้าน</span>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-all-modal-title"
            tabIndex={-1}
            className="card max-h-[88vh] w-full max-w-2xl space-y-5 overflow-y-auto p-4 shadow-[var(--shadow-pop)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-4">
              <div>
                <span className="badge bg-info text-white">
                  ลิงก์ซื้อแยกตามร้านค้า
                </span>
                <h2
                  id="buy-all-modal-title"
                  className="mt-1 font-display text-xl font-bold text-ink-950"
                >
                  {roomName}
                </h2>
                <p className="mt-1 text-xs text-ink-600">
                  ComproNext เป็นตัวกลางแนะนำสินค้า การชำระเงิน การจัดส่ง และการรับประกันเป็นไปตามเงื่อนไขของแต่ละร้าน
                  ราคาอาจเปลี่ยนแปลง กรุณาตรวจสอบที่ร้านก่อนสั่งซื้อ
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="tap-target inline-flex shrink-0 items-center justify-center rounded-full text-ink-600 hover:bg-ink-100 hover:text-ink-950 focus-visible:outline-2 focus-visible:outline-info"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {availableItems.length === 0 && (
                <p className="rounded-[var(--radius-card)] bg-ink-50 p-4 text-center text-sm text-ink-600">
                  ตอนนี้ยังไม่มีสินค้าพร้อมขายในห้องนี้ ลองกลับมาตรวจสอบอีกครั้งภายหลัง
                </p>
              )}
              {Object.entries(byPlatform).map(([platform, list]) => {
                const subTotal = list.reduce(
                  (sum, x) => sum + x.product.price * x.quantity,
                  0
                );
                return (
                  <div
                    key={platform}
                    className="space-y-3 rounded-[var(--radius-card)] border border-ink-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-ink-100 pb-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 font-display text-sm font-bold text-ink-950">
                        <Store className="h-4 w-4 shrink-0 text-info" />
                        แพลตฟอร์ม: {platform} ({list.length} รายการ)
                      </span>
                      <span className="font-display text-sm font-bold text-info">
                        รวม {formatTHB(subTotal)}
                      </span>
                    </div>
                    <ul className="divide-y divide-ink-100 text-sm">
                      {list.map(({ product, quantity }) => (
                        <li
                          key={product.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink-950 truncate">
                              {product.name}{" "}
                              {quantity > 1 && (
                                <span className="badge bg-ink-100 text-ink-800">
                                  ×{quantity}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-ink-500">
                              {formatTHB(product.price)} / ชิ้น · อัปเดตราคา{" "}
                              {formatThaiDate(product.priceUpdatedAt)}
                            </p>
                          </div>
                          {product.status === "available" ? (
                            <ExternalStoreButton
                              name={product.name}
                              price={product.price}
                              category={product.category}
                              imageUrl={product.imageUrl}
                              buyUrl={product.buyUrl}
                              productId={product.id}
                              platform={product.platform}
                              label="เลือกร้านค้า"
                              size="sm"
                              className="shrink-0"
                            />
                          ) : (
                            <span className="badge bg-bad-bg text-bad">ลิงก์ไม่ถูกต้อง</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col justify-between gap-3 border-t border-ink-200 pt-4 sm:flex-row sm:items-center">
              <div>
                <span className="text-xs text-ink-500 block">
                  ราคารวมโดยประมาณ (สินค้าที่พร้อมขาย)
                </span>
                <span className="font-display text-2xl font-bold text-info">
                  {formatTHB(availableTotal)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="btn btn-outline btn-sm"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
