"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Loader2 } from "lucide-react";

/** ปุ่มสร้างโมเดล 3D จากรูปสินค้าอัตโนมัติ (Meshy) พร้อมแสดงความคืบหน้า */
export function Auto3DButton({
  productId,
  pending,
  onDone,
}: {
  productId: string;
  pending: boolean;
  onDone: (modelUrl: string) => void;
}) {
  const [running, setRunning] = useState(pending);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!running) return;
    const poll = async () => {
      const res = await fetch(`/api/partner/3d?productId=${encodeURIComponent(productId)}`).catch(() => null);
      const d = await res?.json().catch(() => null);
      if (d?.status === "SUCCEEDED" && d.modelUrl) {
        setRunning(false);
        onDone(d.modelUrl);
        return;
      }
      if (d && d.ok === false) {
        setRunning(false);
        setError(d.error || "สร้าง 3D ไม่สำเร็จ");
        return;
      }
      setProgress(typeof d?.progress === "number" ? d.progress : null);
      timer.current = window.setTimeout(poll, 5000);
    };
    timer.current = window.setTimeout(poll, 3000);
    return () => window.clearTimeout(timer.current);
  }, [running, productId, onDone]);

  async function start() {
    setError(null);
    const res = await fetch("/api/partner/3d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    const d = await res.json().catch(() => ({}));
    if (d.ok) setRunning(true);
    else setError(d.error || "เริ่มสร้าง 3D ไม่สำเร็จ");
  }

  return (
    <div className="space-y-1">
      <button type="button" disabled={running} onClick={start} className="icon-btn h-8 px-3 text-xs">
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Box className="h-3.5 w-3.5" />}
        <span>{running ? `กำลังสร้าง 3D${progress !== null ? ` ${progress}%` : "…"}` : "สร้าง 3D จากรูปอัตโนมัติ"}</span>
      </button>
      {error && <p className="text-[11px] text-bad">{error}</p>}
    </div>
  );
}
