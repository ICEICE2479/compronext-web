import type { Metadata } from "next";
import Link from "next/link";
import { readDb } from "@/lib/data/store";

export const revalidate = 60;
export const metadata: Metadata = { title: "ข้อกำหนดการใช้งาน", description: "เงื่อนไขการใช้ ComproNext: ราคา การสั่งซื้อกับร้าน ลิงก์พันธมิตร เนื้อหาที่ผู้ใช้โพสต์ และความรับผิดชอบ" };

const UPDATED = "2 พฤศจิกายน 2569";

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-bold text-ink-950">{title}</h2>
      <div className="space-y-2 text-base leading-[1.8] text-ink-700 [text-wrap:pretty]">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const contact = readDb().siteSettings.contactEmail || process.env.ADMIN_EMAILS?.split(",")[0]?.trim() || "hello@compronext.app";
  return (
    <div className="container-page max-w-3xl space-y-7 py-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">ข้อกำหนดการใช้งาน</h1>
        <p className="text-sm text-ink-600">ปรับปรุงล่าสุด {UPDATED} · การใช้เว็บไซต์นี้ถือว่าคุณยอมรับข้อกำหนดด้านล่าง</p>
      </div>
      <S title="1. ComproNext คืออะไร">
        <p>เว็บไซต์ช่วยค้นหา เปรียบเทียบ และจัดชุดสินค้า (ของแต่งห้อง ชิ้นส่วนคอม จอ) จากร้านค้าภายนอก เรา<strong>ไม่ได้ขายสินค้าเอง</strong> การสั่งซื้อ ชำระเงิน จัดส่ง รับประกัน และคืนสินค้า เป็นไปตามเงื่อนไขของร้านค้าปลายทาง</p>
      </S>
      <S title="2. ราคาและข้อมูลสินค้า">
        <p>ราคา สต็อก และสเปกดึงมาจากร้านและเช็กซ้ำเป็นระยะ อาจต่างจากหน้าร้าน ณ เวลาที่คุณซื้อ ให้ยึดราคาที่ร้านแสดงเป็นหลัก เราพยายามให้ข้อมูลถูกต้องแต่ไม่รับประกันความครบถ้วน</p>
      </S>
      <div id="affiliate" />
      <S title="3. ลิงก์พันธมิตร (Affiliate)">
        <p>ลิงก์ไปร้านบางลิงก์เป็นลิงก์พันธมิตร เมื่อคุณซื้อผ่านลิงก์ ComproNext อาจได้รับค่าคอมมิชชันจากร้าน <strong>โดยราคาที่คุณจ่ายไม่เปลี่ยน</strong> ค่าคอมมิชชันไม่มีผลต่อการจัดอันดับผลการค้นหาหรือคำแนะนำ ส่วนสินค้าที่ร้านจ่ายเพื่อดันจะติดป้าย “แนะนำ”</p>
      </S>
      <S title="4. ผลจาก AI, 3D และค่าประมาณ">
        <p>ภาพห้องที่ AI สร้าง โมเดล 3D, FPS, ไฟที่ใช้, และการเช็กว่าใส่ได้จริง เป็นการ<strong>ประมาณเพื่อช่วยตัดสินใจ</strong> ผลจริงขึ้นกับรุ่นย่อย ไดรเวอร์ และการติดตั้ง โปรดตรวจสเปกจากผู้ผลิตก่อนซื้อ</p>
      </S>
      <S title="5. บัญชีและเนื้อหาที่คุณโพสต์">
        <ul className="list-disc space-y-1 pl-5">
          <li>รีวิว แชท และโพสต์ชุมชนต้องสุภาพ เป็นความจริง ไม่ละเมิดผู้อื่น ไม่โฆษณาแฝง ไม่ผิดกฎหมาย</li>
          <li>คุณยังเป็นเจ้าของเนื้อหา และอนุญาตให้เราแสดงบนเว็บไซต์ ลบได้ทุกเมื่อ</li>
          <li>เราอาจซ่อน/ลบเนื้อหา หรือระงับบัญชีที่ฝ่าฝืน โดยแจ้งเหตุผลเมื่อทำได้</li>
          <li>ห้ามใช้บอท ดึงข้อมูลจำนวนมาก หรือพยายามเจาะระบบ</li>
        </ul>
      </S>
      <S title="6. ร้านค้าพาร์ตเนอร์">
        <p>ร้านรับผิดชอบความถูกต้องของข้อมูลสินค้า ราคา และการตอบแชทของตัวเอง การดันสินค้าเป็นบริการเสริมตามที่ตกลงกับทีมงาน</p>
      </S>
      <S title="7. ความรับผิด">
        <p>เราไม่รับผิดต่อความเสียหายจากการซื้อขายกับร้านภายนอก หรือจากการใช้ข้อมูลประมาณการบนเว็บ เท่าที่กฎหมายอนุญาต</p>
      </S>
      <S title="8. ข้อมูลส่วนบุคคล">
        <p>
          ดู{" "}
          <Link href="/privacy" className="text-info underline-offset-2 hover:underline">
            นโยบายความเป็นส่วนตัว
          </Link>
        </p>
      </S>
      <S title="9. กฎหมายที่ใช้และการติดต่อ">
        <p>
          อยู่ภายใต้กฎหมายไทย ติดต่อ{" "}
          <a href={`mailto:${contact}`} className="text-info underline-offset-2 hover:underline">
            {contact}
          </a>
        </p>
      </S>
    </div>
  );
}
