import type { Product, ResolvedRoomItem, Room, RoomTotals, RoomWithTotals } from "./types";

/**
 * คำนวณราคารวมของห้องจากข้อมูลสินค้าล่าสุดทุกครั้ง (ห้ามใช้ตัวเลขคงที่)
 * แยกราคารวมสินค้าที่พร้อมซื้อออกจากรายการที่หมด/ลิงก์เสีย
 */
export function resolveRoomItems(room: Room, productMap: Map<string, Product>): ResolvedRoomItem[] {
  return room.items.map((item) => ({
    ...item,
    product: productMap.get(item.productId) ?? null,
  }));
}

export function calculateRoomTotals(room: Room, productMap: Map<string, Product>): RoomTotals {
  let fullTotal = 0;
  let availableTotal = 0;
  let unavailableTotal = 0;
  let availableCount = 0;
  let unavailableCount = 0;
  let missingCount = 0;
  let itemCount = 0;
  let oldestPriceDate: string | null = null;
  let newestPriceDate: string | null = null;

  for (const item of room.items) {
    const qty = Math.max(1, item.quantity);
    itemCount += qty;
    const p = productMap.get(item.productId);
    if (!p) {
      missingCount += qty;
      continue;
    }
    const lineTotal = p.price * qty;
    fullTotal += lineTotal;

    if (p.status === "available") {
      availableTotal += lineTotal;
      availableCount += qty;
    } else {
      unavailableTotal += lineTotal;
      unavailableCount += qty;
    }

    if (p.priceUpdatedAt) {
      if (!oldestPriceDate || p.priceUpdatedAt < oldestPriceDate) oldestPriceDate = p.priceUpdatedAt;
      if (!newestPriceDate || p.priceUpdatedAt > newestPriceDate) newestPriceDate = p.priceUpdatedAt;
    }
  }

  return {
    fullTotal,
    availableTotal,
    unavailableTotal,
    availableCount,
    unavailableCount,
    missingCount,
    itemCount,
    oldestPriceDate,
    newestPriceDate,
  };
}

export function enrichRoom(room: Room, products: Product[]): RoomWithTotals {
  const map = new Map(products.map((p) => [p.id, p]));
  const totals = calculateRoomTotals(room, map);
  const firstDesk = room.items
    .map((it) => map.get(it.productId))
    .find((p) => p && (p.category === "desk" || p.category === "computer"));
  return {
    ...room,
    totals,
    coverProduct: firstDesk ?? null,
  };
}

/**
 * แนะนำสินค้าทดแทนในหมวดเดียวกันที่สถานะ "พร้อมขาย" และราคาใกล้เคียง
 */
export function findReplacementProducts(target: Product, allProducts: Product[], maxResults = 3): Product[] {
  return allProducts
    .filter((p) => p.id !== target.id && p.category === target.category && p.status === "available")
    .sort((a, b) => Math.abs(a.price - target.price) - Math.abs(b.price - target.price))
    .slice(0, maxResults);
}
