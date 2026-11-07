import { siteUrl as seoSiteUrl } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import {
  Camera,
  Coins,
  Cpu,
  MessageSquareText,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { getAllProducts, getAllRooms, readDb } from "@/lib/data/store";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "เกี่ยวกับ ComproNext",
  description: "ถ่ายรูปห้อง บอกสไตล์ แล้วให้ AI จัดห้องด้วยของจริงจากร้านพาร์ตเนอร์ พร้อมซื้อได้ทันที",
};

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return seoSiteUrl();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const STEPS = [
  { icon: Camera, title: "ถ่ายรูปห้อง", text: "ห้องจริงของคุณ มุมไหนก็ได้" },
  { icon: MessageSquareText, title: "บอกสไตล์", text: "แตะเลือก พิมพ์ หรือพูดก็ได้" },
  { icon: Wand2, title: "AI จัดให้", text: "เลือกของจริง + สร้างภาพห้องใหม่" },
  { icon: ShoppingCart, title: "ซื้อได้ทันที", text: "ใส่ตะกร้าทั้งห้อง ไปจ่ายที่ร้าน" },
];

export default async function AboutPage() {
  const url = await siteUrl();
  const qrSvg = await QRCode.toString(`${url}/design?demo=1`, { type: "svg", margin: 1, width: 220, color: { dark: "#0a192f", light: "#ffffff" } });
  const productCount = getAllProducts().filter((p) => p.status === "available").length;
  const roomCount = getAllRooms(false).length;
  const partnerCount = readDb().partners.filter((p) => p.active).length;

  return (
    <div className="container-page space-y-14 py-10">
      {/* HERO */}
      <section className="grid items-center gap-8 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-3 py-1 text-xs font-bold text-info">
            <Sparkles className="h-3.5 w-3.5" /> AI Room Marketplace
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight text-ink-950 sm:text-5xl">
            แต่งห้องให้ “เห็นก่อนซื้อ”
            <br />
            ด้วยของจริงจากร้านพาร์ตเนอร์
          </h1>
          <p className="max-w-xl text-base leading-[1.8] text-ink-600 [text-wrap:pretty]">
            คนส่วนใหญ่นึกไม่ออกว่าของชิ้นไหนจะเข้ากับห้องตัวเอง ComproNext ให้ AI ดูห้องจริง เลือกของที่ขายจริง
            และสร้างภาพห้องที่จัดเสร็จ — กดซื้อได้ทั้งห้องในไม่กี่วินาที
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/design?demo=1" className="btn btn-primary h-12 px-6">
              <Sparkles className="h-4 w-4" /> ลองเลย
            </Link>
            <Link href="/rooms" className="btn btn-outline h-12 px-6">ดูไอเดียห้อง</Link>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 lg:col-span-5">
          <div
            className="w-56 rounded-2xl border border-ink-200 bg-white p-3 shadow-sm [&_svg]:h-auto [&_svg]:w-full"
            role="img"
            aria-label="QR code เปิดหน้าลองใช้ AI จัดห้อง"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="text-sm font-semibold text-ink-700">สแกนเพื่อลองบนมือถือ</p>
          <p className="break-all text-xs text-ink-600">{url}</p>
        </div>
      </section>

      {/* HOW */}
      <section className="space-y-5">
        <h2 className="font-display text-2xl font-bold text-ink-950">ใช้งานใน 4 ขั้น</h2>
        <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="card space-y-2 p-5">
              <span className="flex items-center justify-between">
                <Icon className="h-6 w-6 text-info" />
                <span className="font-display text-2xl font-bold text-ink-500">{i + 1}</span>
              </span>
              <p className="font-bold text-ink-950">{title}</p>
              <p className="text-sm text-ink-600">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* NUMBERS */}
      <section className="grid grid-cols-3 gap-3">
        {[
          [productCount.toLocaleString(), "สินค้าพร้อมขาย"],
          [roomCount.toLocaleString(), "ไอเดียห้องจริง"],
          [partnerCount > 0 ? partnerCount.toLocaleString() : "เปิดรับ", "ร้านพาร์ตเนอร์"],
        ].map(([n, label]) => (
          <div key={label} className="rounded-2xl bg-ink-50 p-5 text-center">
            <p className="font-display text-2xl font-bold text-ink-950 sm:text-4xl">{n}</p>
            <p className="mt-1 text-xs text-ink-600 sm:text-sm">{label}</p>
          </div>
        ))}
      </section>

      {/* MODEL */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card space-y-2 p-5">
          <Store className="h-6 w-6 text-info" />
          <p className="font-bold text-ink-950">ร้านค้า</p>
          <p className="text-sm text-ink-600">ลงสินค้า + โมเดล 3D (สร้างอัตโนมัติจากรูปได้) เห็นสถิติว่า AI เลือกของร้านไปกี่ครั้ง</p>
        </div>
        <div className="card space-y-2 p-5">
          <Coins className="h-6 w-6 text-info" />
          <p className="font-bold text-ink-950">รายได้</p>
          <p className="text-sm text-ink-600">ค่าคอมมิชชันต่อยอดขายที่ส่งไปร้าน + แพ็กเกจโปรโมตสินค้าในผลลัพธ์ AI</p>
        </div>
        <div className="card space-y-2 p-5">
          <TrendingUp className="h-6 w-6 text-info" />
          <p className="font-bold text-ink-950">ลูกค้า</p>
          <p className="text-sm text-ink-600">เห็นภาพก่อนซื้อ ลดการซื้อผิด เทียบราคา แจ้งเตือนเมื่อลดราคา ใช้ฟรี</p>
        </div>
      </section>

      {/* TECH */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink-950">
          <Cpu className="h-5 w-5 text-info" /> เทคโนโลยี
        </h2>
        <div className="flex flex-wrap gap-2">
          {["Claude วิเคราะห์ห้อง + เลือกสินค้า", "Gemini สร้างภาพห้อง", "Meshy รูป → 3D", "AR ดูของในห้องจริง", "Next.js + PWA ติดตั้งเป็นแอป", "LINE Login"].map((t) => (
            <span key={t} className="rounded-full border border-ink-200 px-3 py-1.5 text-sm text-ink-700">{t}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
