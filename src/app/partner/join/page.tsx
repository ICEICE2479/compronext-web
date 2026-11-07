import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Box, MessageCircle, Sparkles, Store } from "lucide-react";
import { PartnerJoinForm } from "@/components/PartnerJoinForm";

export const metadata: Metadata = {
  title: "สมัครเป็นร้านพาร์ตเนอร์",
  description: "ลงสินค้ากับ ComproNext ฟรี ให้ลูกค้าที่กำลังจัดห้อง/จัดสเปกคอมเจอสินค้าของคุณ พร้อม AI แนะนำและห้อง 3D",
};

const PERKS = [
  [Sparkles, "AI เลือกสินค้าคุณไปจัดห้อง", "ลูกค้าถ่ายรูปห้อง AI เลือกของที่เข้ากับห้องและงบ — สินค้าคุณอยู่ในตัวเลือกนั้น"],
  [Box, "ห้อง 3D + รูป 3D อัตโนมัติ", "ลูกค้าลองวางของในห้อง 3D ตามขนาดจริง สร้างโมเดล 3D จากรูปสินค้าได้"],
  [BarChart3, "สถิติรายสินค้า", "ดูยอดดู ใส่ตะกร้า AI เลือก และคลิกไปร้าน — รู้ว่าอะไรขายได้"],
  [MessageCircle, "แชท + ระบบเคสหลังการขาย", "ตอบลูกค้าตรง จัดการเคลมในที่เดียว คะแนนการดูแลขึ้นหน้าร้าน"],
] as const;

export default function PartnerJoinPage() {
  return (
    <div className="container-page grid gap-8 py-8 lg:grid-cols-2">
      <section className="space-y-5">
        <p className="eyebrow">สำหรับร้านค้า</p>
        <h1 className="font-display text-3xl font-bold text-ink-950">ลงสินค้ากับ ComproNext ฟรี</h1>
        <p className="text-ink-700">ลูกค้าที่นี่กำลังตัดสินใจซื้อของแต่งห้องและอุปกรณ์คอม — เราช่วยให้เขาเจอสินค้าที่ “ใช่” ของคุณ แล้วส่งไปซื้อที่ร้านคุณโดยตรง ไม่หักค่าขาย</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PERKS.map(([Icon, title, text]) => (
            <li key={title} className="card space-y-1.5 p-4">
              <Icon className="h-5 w-5 text-info" />
              <p className="font-semibold text-ink-950">{title}</p>
              <p className="text-xs text-ink-600">{text}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink-600">
          เป็นร้านพาร์ตเนอร์อยู่แล้ว?{" "}
          <Link href="/partner" className="font-semibold text-info">
            <Store className="mr-1 inline h-4 w-4" />
            เข้าหลังร้าน
          </Link>
        </p>
      </section>
      <PartnerJoinForm />
    </div>
  );
}
