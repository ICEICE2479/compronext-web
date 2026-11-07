"use client";

import { useRef, useState, type HTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { Scale, Check } from "lucide-react";
import { useCompareProducts } from "@/lib/compare-store";

const POP = "motion-safe:animate-[pop_300ms_var(--ease-spring)]";

/** <article> ของการ์ดที่ prefetch หน้าปลายทางเมื่อชี้เมาส์/แตะ (ครั้งเดียวต่อการ์ด) */
export function PrefetchArticle({ href, ...rest }: HTMLAttributes<HTMLElement> & { href: string }) {
  const router = useRouter();
  const done = useRef(false);
  return (
    <article
      {...rest}
      onPointerEnter={() => {
        if (done.current) return;
        done.current = true;
        router.prefetch(href);
      }}
    />
  );
}

export function CompareProductButton({
  productId,
  compact = false,
}: {
  productId: string;
  compact?: boolean;
}) {
  const { has, toggle } = useCompareProducts();
  const active = has(productId);
  const [pop, setPop] = useState(0);
  const popCls = pop ? POP : "";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
        setPop((n) => n + 1);
      }}
      className={`btn btn-sm ${
        active
          ? "bg-ink-950 text-white border border-ink-950"
          : "btn-outline"
      }`}
      aria-pressed={active}
      title={active ? "นำออกจากตารางเปรียบเทียบ" : "เพิ่มเข้าตารางเปรียบเทียบสินค้า"}
    >
      {active ? <Check key={pop} className={`h-3.5 w-3.5 text-[#dfcfb3] ${popCls}`} /> : <Scale key={pop} className={`h-3.5 w-3.5 ${popCls}`} />}
      {!compact && <span>{active ? "เลือกเปรียบเทียบแล้ว" : "เปรียบเทียบ"}</span>}
    </button>
  );
}

/** ปุ่มไอคอนเปรียบเทียบ (ใช้บนการ์ดสินค้า) */
export function CompareIconButton({ productId }: { productId: string }) {
  const { has, toggle } = useCompareProducts();
  const active = has(productId);
  const [pop, setPop] = useState(0);
  const popCls = pop ? POP : "";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
        setPop((n) => n + 1);
      }}
      aria-pressed={active}
      aria-label={active ? "นำออกจากการเปรียบเทียบ" : "เพิ่มเข้าการเปรียบเทียบ"}
      title={active ? "นำออกจากการเปรียบเทียบ" : "เปรียบเทียบสเปก"}
      className={`icon-btn h-9 min-w-9 px-0 ${active ? "icon-btn-primary" : ""}`}
    >
      {active ? <Check key={pop} className={`h-4 w-4 ${popCls}`} /> : <Scale key={pop} className={`h-4 w-4 ${popCls}`} />}
    </button>
  );
}
