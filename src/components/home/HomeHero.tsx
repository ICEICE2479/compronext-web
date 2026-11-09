import Link from "next/link";
import { Camera, Sparkles } from "lucide-react";

/** หัวหน้าแรก: 1 ประโยค + 1 ปุ่มหลัก (จุดโฟกัสเดียว) */
export function HomeHero() {
  return (
    <section className="container-page pt-8 sm:pt-14" aria-labelledby="home-hero-title">
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ai-gradient">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> ฟรี ไม่ต้องสมัคร
        </span>
        <h1 id="home-hero-title" className="text-display text-ink-950">
          ถ่ายรูปห้อง <span className="text-info">AI จัดให้</span> พร้อมบอกว่าซื้ออะไรคุ้มสุด
        </h1>
        <Link href="/design" className="btn mx-auto min-h-14 w-full max-w-sm border-0 px-8 text-lg text-white shadow-pop ai-gradient">
          <Camera className="h-5 w-5" aria-hidden="true" /> ถ่ายรูปห้อง → AI จัดให้
        </Link>
        <p className="text-sm text-ink-600">ถ่ายรูป · บอกงบ · ได้ภาพห้องใหม่ + รายการของที่ควรซื้อก่อน</p>
      </div>
    </section>
  );
}
