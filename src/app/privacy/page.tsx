import type { Metadata } from "next";
import Link from "next/link";
import { readDb } from "@/lib/data/store";

export const revalidate = 60;
export const metadata: Metadata = { title: "นโยบายความเป็นส่วนตัว", description: "ComproNext เก็บข้อมูลอะไร ใช้ทำอะไร เก็บนานแค่ไหน และสิทธิ์ของคุณตาม PDPA" };

const UPDATED = "2 พฤศจิกายน 2569";

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-bold text-ink-950">{title}</h2>
      <div className="space-y-2 text-base leading-[1.8] text-ink-700 [text-wrap:pretty]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const contact = readDb().siteSettings.contactEmail || process.env.ADMIN_EMAILS?.split(",")[0]?.trim() || "privacy@compronext.app";
  return (
    <div className="container-page max-w-3xl space-y-7 py-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">นโยบายความเป็นส่วนตัว</h1>
        <p className="text-sm text-ink-600">ปรับปรุงล่าสุด {UPDATED} · เป็นไปตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
      </div>

      <S title="1. ข้อมูลที่เราเก็บ">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>บัญชี:</strong> ชื่อ อีเมล และรหัสบัญชีจาก LINE / Google เมื่อคุณเข้าสู่ระบบ</li>
          <li><strong>สิ่งที่คุณบันทึก:</strong> ตะกร้า ห้องและสเปกคอมที่บันทึก สินค้าที่ติดตามราคา</li>
          <li><strong>สิ่งที่คุณเขียน:</strong> รีวิวร้าน ข้อความแชทกับร้าน โพสต์ในชุมชน</li>
          <li><strong>รูปห้องที่อัปโหลดให้ AI จัด:</strong> ใช้สร้างภาพครั้งนั้นเท่านั้น เก็บเฉพาะภาพผลลัพธ์ที่คุณกดบันทึก</li>
          <li><strong>การแจ้งเตือน:</strong> รหัสอุปกรณ์สำหรับส่งแจ้งเตือน เมื่อคุณกดเปิดเอง</li>
          <li><strong>สถิติการใช้งานแบบรวม:</strong> จำนวนครั้งที่สินค้าถูกดู/คลิก/ใส่ตะกร้า ไม่ผูกกับตัวคุณ</li>
          <li><strong>ข้อมูลทางเทคนิค:</strong> IP ใช้ชั่วคราวเพื่อกันสแปมและบอท ไม่บันทึกถาวร</li>
        </ul>
      </S>

      <S title="2. ใช้ข้อมูลทำอะไร">
        <p>ให้บริการที่คุณขอ (เข้าสู่ระบบ ซิงก์ข้ามเครื่อง แชท แจ้งเตือนราคา), ป้องกันการใช้งานผิดวัตถุประสงค์, และปรับปรุงเว็บจากสถิติแบบรวม เราไม่ขายข้อมูลส่วนบุคคลให้ใคร</p>
        <p>เมื่อคุณกดไปซื้อที่ร้าน ร้านค้าปลายทาง (เช่น Shopee, Lazada, IKEA) จะเก็บข้อมูลตามนโยบายของร้านนั้นเอง ลิงก์บางลิงก์เป็นลิงก์พันธมิตร (affiliate) ที่ทำให้เราได้ค่าคอมมิชชัน โดยราคาของคุณไม่เปลี่ยน</p>
      </S>

      <S title="3. ผู้ให้บริการที่ประมวลผลแทนเรา">
        <p>โฮสต์เว็บและฐานข้อมูล (Vercel, Neon), ส่งอีเมล (Resend), สร้างภาพด้วย AI (Google Gemini / Cloudflare), เข้าสู่ระบบ (LINE, Google) — ส่งเฉพาะข้อมูลที่จำเป็นต่อบริการนั้น</p>
      </S>

      <S title="4. คุกกี้และที่เก็บในเบราว์เซอร์">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>จำเป็น:</strong> คุกกี้เข้าสู่ระบบ (เข้ารหัส), ตะกร้า, ธีมสี, ของที่บันทึกในเครื่อง</li>
          <li><strong>สถิติ (เลือกได้):</strong> นับการใส่ตะกร้าแบบไม่ระบุตัวตน — ปิดได้ที่แถบคุกกี้ด้านล่างหน้าเว็บ หรือ{" "}
            <Link href="/privacy#consent" className="text-info underline-offset-2 hover:underline">ตั้งค่าใหม่</Link></li>
        </ul>
        <p>เราไม่ใช้คุกกี้โฆษณาหรือคุกกี้ติดตามข้ามเว็บ</p>
      </S>

      <S title="5. เก็บนานแค่ไหน">
        <p>ข้อมูลบัญชีและสิ่งที่บันทึก: จนกว่าคุณจะลบบัญชี · ข้อความแชท: 500 ข้อความล่าสุดต่อห้องแชท · ข้อมูลสำรองของระบบ: 7 วัน แล้วลบอัตโนมัติ</p>
      </S>

      <S title="6. สิทธิ์ของคุณ">
        <p>ขอดู/ขอสำเนา, แก้ไข, ลบ, คัดค้าน หรือถอนความยินยอมได้ทุกเมื่อ:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Link href="/account" className="text-info underline-offset-2 hover:underline">หน้าบัญชี</Link> → “ดาวน์โหลดข้อมูลของฉัน” หรือ “ลบบัญชี” (ทำเองได้ทันที)
          </li>
          <li>หรืออีเมลถึงเรา <a href={`mailto:${contact}`} className="text-info underline-offset-2 hover:underline">{contact}</a> — ตอบภายใน 30 วัน</li>
          <li>ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.) ได้</li>
        </ul>
      </S>

      <S title="7. ความปลอดภัย">
        <p>เชื่อมต่อผ่าน HTTPS, คุกกี้เข้าสู่ระบบเข้ารหัส AES-256-GCM, จำกัดความถี่การส่งข้อมูลกันสแปม, สำรองข้อมูลทุกวัน หากเกิดเหตุข้อมูลรั่วไหล เราจะแจ้ง สคส. ภายใน 72 ชั่วโมง และแจ้งผู้ได้รับผลกระทบ</p>
      </S>
    </div>
  );
}
