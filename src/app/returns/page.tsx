import type { Metadata } from "next";
import { ReturnsHome } from "@/components/returns/ReturnsHome";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "แจ้งปัญหาสินค้า / ติดตามเคส", robots: { index: false } };

export default function ReturnsPage() {
  return (
    <div className="container-page max-w-3xl space-y-5 py-8">
      <div className="space-y-2">
        <p className="eyebrow">ReturnEase · บริการหลังการขาย</p>
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">แจ้งปัญหาสินค้า &amp; ติดตามเคส</h1>
        <PageIntro what="ของเสีย ส่งผิด ไม่ครบ แจ้งร้านพาร์ตเนอร์ได้ที่นี่ที่เดียว" next="แนบรูปหลักฐาน แล้วติดตามว่าร้านทำถึงไหนแล้ว" />
      </div>
      <ReturnsHome />
    </div>
  );
}
