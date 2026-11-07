"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { getConsent, setConsent } from "@/lib/consent";

/** แถบขอความยินยอมคุกกี้ (PDPA) — โชว์ครั้งแรก หรือเมื่อเปิด /privacy#consent */
export function ConsentBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const check = () => setShow(getConsent() === null || window.location.hash === "#consent");
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);
  if (!show) return null;
  const choose = (analytics: boolean) => {
    setConsent(analytics);
    setShow(false);
    if (window.location.hash === "#consent") history.replaceState(null, "", window.location.pathname);
  };
  return (
    <div role="region" aria-label="การใช้คุกกี้" className="scene-chip fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-xl rounded-2xl border border-ink-200 bg-surface p-4 shadow-2xl lg:bottom-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
        <Cookie className="h-4 w-4 text-info" /> เว็บนี้ใช้คุกกี้
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-700">
        คุกกี้ที่จำเป็นใช้ให้เข้าสู่ระบบและจำตะกร้า ส่วนสถิติแบบไม่ระบุตัวตนช่วยให้เราปรับปรุงเว็บ เลือกได้ว่าจะอนุญาตหรือไม่{" "}
        <Link href="/privacy" className="font-semibold text-info underline-offset-2 hover:underline">
          อ่านนโยบาย
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose(false)} className="btn btn-outline h-10 flex-1 rounded-full text-sm">
          เฉพาะที่จำเป็น
        </button>
        <button type="button" onClick={() => choose(true)} className="btn btn-primary h-10 flex-1 rounded-full text-sm">
          ยอมรับทั้งหมด
        </button>
      </div>
    </div>
  );
}
