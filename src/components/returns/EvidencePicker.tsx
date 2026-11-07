"use client";

import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { resizeImageFile } from "@/lib/image-resize";

/** แนบรูปหลักฐาน (ย่อรูปในเครื่องก่อนส่ง ประหยัดเน็ต) */
export function EvidencePicker({ value, onChange, max = 6 }: { value: string[]; onChange: (urls: string[]) => void; max?: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const out = [...value];
    for (const f of Array.from(files).slice(0, max - value.length)) {
      const small = await resizeImageFile(f).catch(() => f);
      const fd = new FormData();
      fd.append("file", small, "evidence.jpg");
      const r = await fetch("/api/returns/evidence", { method: "POST", body: fd })
        .then((x) => x.json())
        .catch(() => ({ ok: false }));
      if (r.ok) out.push(r.url);
      else setError(r.error || "อัปโหลดไม่สำเร็จ");
    }
    onChange(out);
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((u) => (
          <span key={u} className="relative h-20 w-20 overflow-hidden rounded-xl border border-ink-200 bg-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="หลักฐาน" className="h-full w-full object-cover" width={80} height={80} />
            <button
              type="button"
              aria-label="เอารูปนี้ออก"
              onClick={() => onChange(value.filter((x) => x !== u))}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink-950/70 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {value.length < max && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-300 text-[11px] font-semibold text-ink-600 hover:border-info hover:text-info">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {busy ? "กำลังส่ง" : "เพิ่มรูป"}
            <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => add(e.target.files)} />
          </label>
        )}
      </div>
      {error && <p className="text-xs font-semibold text-bad">{error}</p>}
    </div>
  );
}
