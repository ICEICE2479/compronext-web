import { NextResponse } from "next/server";
import { getProductById } from "@/lib/data/store";
import { trackFunnel } from "@/lib/funnel";
import { isSafeHttpUrl } from "@/lib/links";
import { trackEvent } from "@/lib/stats";
import { affiliateUrl } from "@/lib/affiliate";

/** ลิงก์ออกไปร้านค้า: นับคลิกให้ร้านพาร์ตเนอร์ แล้วพาไปหน้าสินค้าของร้าน (ใช้ URL จากฐานข้อมูลเท่านั้น) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getProductById(id);
  if (!product || !isSafeHttpUrl(product.buyUrl)) {
    return NextResponse.redirect(new URL(`/products/${encodeURIComponent(id)}`, _req.url), 302);
  }
  trackEvent(product.id, "clicks");
  trackFunnel("go_click");
  const res = NextResponse.redirect(affiliateUrl(product.buyUrl), 302);
  res.headers.set("Referrer-Policy", "origin");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
