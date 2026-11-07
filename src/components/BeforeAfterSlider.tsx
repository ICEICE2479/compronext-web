"use client";

import { useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";

/** ลากเส้นกลางเพื่อเทียบภาพก่อน/หลัง (ใช้ได้ทั้งนิ้วและเมาส์ + ปุ่มลูกศรบนคีย์บอร์ด) */
export function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  function moveTo(clientX: number) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setPos(Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100)));
  }

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 touch-pan-y select-none"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && moveTo(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="หลังจัด" width={1200} height={800} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={before}
        alt="ก่อนจัด"
        width={1200}
        height={800}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      <span className="absolute left-3 top-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-[11px] font-semibold text-white">ก่อน</span>
      <span className="absolute right-3 top-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-[11px] font-semibold text-white">หลัง</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink-900 shadow-lg">
          <ChevronsLeftRight className="h-5 w-5" />
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="เลื่อนเทียบภาพก่อนและหลัง"
        className="sr-only"
      />
    </div>
  );
}
