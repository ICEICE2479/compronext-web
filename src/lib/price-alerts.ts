import "server-only";
import { queuePush } from "@/lib/push";
import { after } from "next/server";
import type { RuntimeDatabase } from "@/lib/data/store";
import { sendComproNextEmail } from "@/lib/serverless-stack";
import { formatTHB } from "@/lib/format";
import { lineUserIdOf, linePushEnabled, pushLineText } from "@/lib/line-push";
import { siteUrl } from "@/lib/seo";

/**
 * เช็กสินค้าที่มีคนกดติดตามราคา ถ้าราคาปัจจุบันต่ำกว่าตอนกดติดตาม → ส่งอีเมลแจ้ง แล้วอัปเดตราคาอ้างอิง
 * เรียกหลังแก้ราคาสินค้า (แอดมิน / ร้านพาร์ตเนอร์ / นำเข้า CSV) ก่อน writeDb
 */
export function applyPriceDropAlerts(db: RuntimeDatabase, changedIds?: Iterable<string>) {
  const ids = changedIds ? new Set(changedIds) : null;
  const byId = new Map(db.products.map((p) => [p.id, p]));
  const mails: Array<() => Promise<unknown>> = [];
  const usersById = linePushEnabled() ? new Map(db.users.map((u) => [u.id, u])) : null;

  for (const w of db.priceWatches) {
    if (ids && !ids.has(w.productId)) continue;
    const p = byId.get(w.productId);
    if (!p || p.status !== "available" || p.price >= w.priceAtSave) continue;
    const oldPrice = w.priceAtSave;
    w.priceAtSave = p.price;
    const lineTo = usersById ? lineUserIdOf(usersById.get(w.userId)) : null;
    if (lineTo) {
      const url = siteUrl().startsWith("https://") ? `${siteUrl()}/products/${encodeURIComponent(p.id)}` : undefined;
      mails.push(() => pushLineText(lineTo, `ลดราคา ${formatTHB(oldPrice - p.price)}! ${p.name.slice(0, 80)} เหลือ ${formatTHB(p.price)}`, url));
    }
    queuePush(db, { userIds: [w.userId] }, { title: `ลดราคา ${formatTHB(oldPrice - p.price)}`, body: `${p.name.slice(0, 80)} เหลือ ${formatTHB(p.price)}`, url: `/products/${p.id}`, tag: `price-${p.id}` });
    if (!w.email || !w.email.includes("@") || w.email.endsWith(".compronext.app")) continue;
    mails.push(() =>
      sendComproNextEmail({
        to: w.email,
        subject: `[ComproNext] ${p.name.slice(0, 60)} ลดราคาเหลือ ${formatTHB(p.price)}`,
        roomOrBuildTitle: p.name,
        totalLabel: "ราคาใหม่: ",
        totalPriceFormatted: `${formatTHB(p.price)} (จากเดิม ${formatTHB(oldPrice)})`,
        itemsSummary: [`ร้าน: ${p.storeName || p.platform}`, `ดูสินค้า: /products/${p.id}`],
      })
    );
  }

  if (mails.length === 0) return 0;
  const run = () => Promise.allSettled(mails.map((m) => m()));
  try {
    after(run);
  } catch {
    void run();
  }
  return mails.length;
}
