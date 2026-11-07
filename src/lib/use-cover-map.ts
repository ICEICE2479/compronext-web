"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * แปลงจุด (% ของภาพจริง) → ตำแหน่งบนกล่องที่แสดงภาพแบบ object-cover (ภาพถูกครอปขอบ)
 * จุดจึงอยู่บนของเดิมทุกขนาดจอ · visible = false ถ้าจุดถูกครอปหายไป
 */
export function coverPoint(cw: number, ch: number, iw: number, ih: number, x: number, y: number) {
  if (!cw || !ch || !iw || !ih) return { x, y, visible: true };
  const s = Math.max(cw / iw, ch / ih);
  const px = (cw - iw * s) / 2 + (x / 100) * iw * s;
  const py = (ch - ih * s) / 2 + (y / 100) * ih * s;
  return { x: (px / cw) * 100, y: (py / ch) * 100, visible: px >= 8 && px <= cw - 8 && py >= 8 && py <= ch - 8 };
}

/** วัดขนาดกล่อง + ขนาดจริงของ <img> ข้างใน แล้วคืนฟังก์ชันแปลงจุด */
export function useCoverMap(box: RefObject<HTMLElement | null>, src: string | null | undefined) {
  const [dim, setDim] = useState({ cw: 0, ch: 0, iw: 0, ih: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const img = el.querySelector("img");
    const measure = () =>
      setDim({ cw: el.clientWidth, ch: el.clientHeight, iw: img?.naturalWidth ?? 0, ih: img?.naturalHeight ?? 0 });
    measure();
    img?.addEventListener("load", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      img?.removeEventListener("load", measure);
      ro.disconnect();
    };
  }, [box, src]);
  return useCallback((x: number, y: number) => coverPoint(dim.cw, dim.ch, dim.iw, dim.ih, x, y), [dim]);
}
