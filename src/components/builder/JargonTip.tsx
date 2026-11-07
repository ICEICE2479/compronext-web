"use client";

import { useId, useState } from "react";
import { glossaryTerm } from "@/lib/builder/guide";

/** คำศัพท์เทคนิค: แตะ/ชี้/โฟกัสเพื่อดูความหมาย (Esc ปิด) */
export function JargonTip({ term, children }: { term: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const entry = glossaryTerm(term);
  if (!entry) return <>{children}</>;
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className="cursor-help rounded underline decoration-dotted decoration-ink-400 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-info"
      >
        {children}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-ink-200 bg-surface p-2.5 text-left text-xs font-normal leading-relaxed text-ink-800 shadow-lg"
        >
          <span className="block font-semibold text-ink-950">{entry.term}</span>
          {entry.meaning}
        </span>
      )}
    </span>
  );
}
