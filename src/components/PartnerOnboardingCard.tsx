"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles, Store } from "lucide-react";

export function PartnerOnboardingCard({
  email,
  defaultStoreName,
}: {
  email: string;
  defaultStoreName: string;
}) {
  const router = useRouter();
  const [storeName, setStoreName] = useState(defaultStoreName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleQuickActivate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate_demo_partner",
          storeName: storeName.trim() || defaultStoreName,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "ไม่สามารถเปิดร้านได้ กรุณาลองใหม่" }));
      if (!res.ok || !data.ok) {
        setError(data.error || "ไม่สามารถเปิดร้านพาร์ตเนอร์ได้");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
      setLoading(false);
    }
  }

  return (
    <div className="card max-w-2xl space-y-5 p-6 sm:p-8">
      <div className="flex items-start gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
          <Store className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-ink-950">
            บัญชี <span className="text-info">{email}</span> ยังไม่ได้เปิดร้านพาร์ตเนอร์
          </h2>
          <p className="text-sm text-ink-600">
            คุณสามารถเปิดใช้งานร้านพาร์ตเนอร์ได้ทันทีเพื่อจัดการสินค้า อัปโหลดโมเดล 3D (.glb) ตั้งค่าขนส่ง และดูสถิติยอดคลิก
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-bad-bg p-3 text-sm font-semibold text-bad">
          {error}
        </div>
      )}

      <form onSubmit={handleQuickActivate} className="space-y-4 rounded-2xl border border-info/30 bg-info-bg/30 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-info">
          <Sparkles className="h-4 w-4" />
          <span>เปิดร้านพาร์ตเนอร์ทันที (Instant Partner Activation)</span>
        </div>

        <div>
          <label htmlFor="quick-partner-name" className="label">
            ชื่อร้านค้าของคุณ
          </label>
          <input
            id="quick-partner-name"
            type="text"
            required
            maxLength={120}
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="เช่น ComproNext Official Store"
            className="input bg-white"
          />
        </div>

        <ul className="grid gap-1.5 text-xs text-ink-700 sm:grid-cols-2">
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" />
            <span>เพิ่มสินค้าและนำเข้าไฟล์ CSV ได้ทันที</span>
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" />
            <span>รองรับอัปโหลดโมเดล 3D (.glb) วางในห้องเสมือน</span>
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" />
            <span>ดูสถิติคนดูสินค้า กดซื้อ และวางในห้อง 3D</span>
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" />
            <span>ตอบแชทลูกค้าและจัดการเคสเคลมหลังการขาย</span>
          </li>
        </ul>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="btn btn-primary w-full py-2.5 text-sm font-bold cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          <span>{loading ? "กำลังเปิดร้านพาร์ตเนอร์..." : "เปิดใช้งานร้านพาร์ตเนอร์สำหรับบัญชีนี้ทันที"}</span>
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-4 text-xs text-ink-600">
        <span>ต้องการส่งเอกสารนิติบุคคลและรายละเอียดร้านค้าแบบเต็ม?</span>
        <Link
          href="/partner/join"
          className="inline-flex items-center gap-1 font-semibold text-info hover:underline"
        >
          <span>ไปหน้าลงทะเบียนร้านพาร์ตเนอร์</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
