import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";
import { CartClient } from "@/components/CartClient";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "ตะกร้า",
  description: "ตรวจสอบสินค้าในตะกร้าและไปซื้อต่อที่ร้านค้าต้นทาง",
};

export default function CartPage() {
  return (
    <div className="container-page space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">ตะกร้าสินค้า</h1>
        <PageIntro what="รวมของที่เลือกไว้ เทียบกับงบ" next="ตัดของที่ไม่จำเป็นออก แล้วกดไปซื้อที่ร้านทีละชิ้น" />
      </div>
      <CartClient />
    </div>
  );
}
