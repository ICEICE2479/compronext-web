import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { GUIDE_SECTIONS, SLOT_GUIDE } from "@/lib/builder/guide";
import type { BuilderSlot } from "@/lib/builder/types";

/** กล่องพับ "นี่คืออะไร / เลือกยังไง" เหนือรายการชิ้นส่วน */
export function GuideBox({ slot }: { slot: BuilderSlot }) {
  const id = SLOT_GUIDE[slot];
  const section = GUIDE_SECTIONS.find((s) => s.id === id);
  if (!section) return null;
  return (
    <details className="group mb-3 rounded-xl border border-ink-200 bg-info-bg/40">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-ink-950">
        <HelpCircle className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
        นี่คืออะไร / เลือกยังไง
      </summary>
      <div className="space-y-2 border-t border-ink-100 px-3 py-2.5 text-xs leading-relaxed text-ink-800">
        <p className="font-semibold text-ink-950">{section.summary}</p>
        {section.howToChoose.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-4">
            {section.howToChoose.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <Link href={`/builder/guide#${section.id}`} className="inline-flex min-h-11 items-center font-semibold text-info hover:underline">
          อ่านคู่มือเต็ม
        </Link>
      </div>
    </details>
  );
}
