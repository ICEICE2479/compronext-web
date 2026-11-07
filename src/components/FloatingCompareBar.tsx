"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Scale, X } from "lucide-react";
import { useCompareProducts } from "@/lib/compare-store";

/** ปุ่มลอยเล็กๆ บอกจำนวนที่เลือกเทียบ (ซ่อนในหน้าเทียบเอง) */
export function FloatingCompareBar() {
  const { count, max, clear } = useCompareProducts();
  const pathname = usePathname();
  if (count === 0 || pathname === "/compare") return null;

  return (
    <div className="no-print fixed bottom-[calc(8.75rem+env(safe-area-inset-bottom))] left-4 z-30 flex items-center gap-1 rounded-full bg-ink-950 p-1 pl-1.5 text-white shadow-lg lg:bottom-6 lg:left-6">
      <button type="button" onClick={clear} aria-label="ล้างรายการเทียบ" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
        <X className="h-4 w-4" />
      </button>
      <Link href="/compare" className="flex h-9 items-center gap-1.5 rounded-full bg-info px-3.5 text-sm font-semibold">
        <Scale className="h-4 w-4" /> เทียบ {count}/{max} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
