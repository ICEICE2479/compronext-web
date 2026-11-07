"use client";

import { useEffect, useState } from "react";
import { Box, Loader2 } from "lucide-react";

/**
 * ดูสินค้าแบบ 3D หมุนได้ + ปุ่ม "ดูในห้องจริง (AR)" บนมือถือ
 * โหลดสคริปต์ model-viewer เฉพาะตอนผู้ใช้กดเปิด เพื่อไม่ให้หน้าเว็บหนัก
 */
export function ModelViewer3D({ src, alt, poster }: { src: string; alt: string; poster?: string | null }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    import("@google/model-viewer").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="icon-btn w-full">
        <Box className="h-4 w-4" />
        <span className="text-sm font-semibold">ดูแบบ 3D / วางในห้องจริง (AR)</span>
      </button>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-ink-50" style={{ aspectRatio: "1 / 1" }}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
        </div>
      )}
      {ready && (
        <model-viewer
          src={src}
          alt={alt}
          poster={poster ?? undefined}
          ar
          ar-modes="webxr scene-viewer quick-look"
          ar-scale="fixed"
          camera-controls
          touch-action="pan-y"
          shadow-intensity="1"
          style={{ width: "100%", height: "100%" }}
        />
      )}
      <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-ink-500">
        ลากเพื่อหมุน · บนมือถือกดไอคอน AR เพื่อวางในห้องขนาดจริง
      </p>
    </div>
  );
}
