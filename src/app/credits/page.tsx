import type { Metadata } from "next";
import { BuyCredits } from "@/components/design/BuyCredits";

export const metadata: Metadata = { title: "เติมเครดิต AI", robots: { index: false } };

export default function CreditsPage() {
  return (
    <div className="container-page max-w-xl space-y-5 py-8">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">เติมเครดิต AI</h1>
        <p className="text-sm text-ink-600">ใช้ฟรีทุกวันอยู่แล้ว เครดิตไว้ใช้ต่อเมื่อสิทธิ์ฟรีของวันหมด · 1 เครดิต = 1 ภาพ · ไม่มีวันหมดอายุ</p>
      </div>
      <BuyCredits />
    </div>
  );
}
