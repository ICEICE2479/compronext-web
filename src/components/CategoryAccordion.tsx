"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { MACRO_CATEGORIES } from "@/lib/catalog-taxonomy";

const GROUP_LABELS: Record<string, string> = {
  "room-items": "ของใช้ในห้อง",
  components: "ชิ้นส่วนคอมพิวเตอร์",
  "gaming-gear": "เกมมิ่งเกียร์",
  monitors: "จอภาพ",
  furniture: "โต๊ะ & เก้าอี้",
  decoration: "ไฟ & ของแต่งโต๊ะ",
};

/** ชื่อหมวดภาษาไทยสั้นๆ (ตัดวงเล็บภาษาอังกฤษออก) */
function shortTh(label: string) {
  return label.replace(/\s*\(.*\)\s*$/, "");
}

/**
 * รายการหมวดแบบพับได้ — กดชื่อหมวดเพื่อเลื่อนเปิดหมวดย่อย (กดซ้ำเพื่อปิด)
 */
export function CategoryAccordion({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-ink-100">
      {MACRO_CATEGORIES.map((group) => {
        const isOpen = open === group.slug;
        return (
          <li key={group.slug}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : group.slug)}
              className={`flex w-full items-center justify-between rounded-xl px-2 py-2.5 text-left text-sm font-semibold transition-colors ${isOpen ? "text-info" : "text-ink-900 hover:bg-ink-100"}`}
            >
              {GROUP_LABELS[group.slug] ?? group.titleEn}
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isOpen ? "rotate-180" : ""}`} />
            </button>
            <div
              className="accordion-body grid"
              data-open={isOpen ? "" : undefined}
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <ul className="overflow-hidden" inert={!isOpen}>
                <li>
                  <Link
                    href={`/categories?macro=${group.slug}`}
                    onClick={onNavigate}
                    className="block rounded-lg py-1.5 pl-5 pr-2 text-sm font-semibold text-info hover:bg-ink-100"
                  >
                    ทั้งหมดใน{GROUP_LABELS[group.slug] ?? group.titleEn}
                  </Link>
                </li>
                {group.subcategories.map((sub) => (
                  <li key={sub.slug}>
                    <Link
                      href={`/categories?macro=${group.slug}&sub=${sub.slug}`}
                      onClick={onNavigate}
                      className="block rounded-lg py-1.5 pl-5 pr-2 text-sm text-ink-700 hover:bg-ink-100 hover:text-info"
                    >
                      {shortTh(sub.labelTh)}
                    </Link>
                  </li>
                ))}
                <li className="h-2" />
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
