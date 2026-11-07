"use client";

import { useEffect, useRef, useState } from "react";
import { formatTHB } from "@/lib/format";

/** ตัวเลขราคานับขึ้น/ลงนุ่มๆ เมื่อค่าเปลี่ยน (เคารพการตั้งค่าลดการเคลื่อนไหว) */
export function AnimatedTHB({ value, className = "" }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(0);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = reduce ? 1 : Math.min(1, (t - t0) / 420);
      const e = 1 - (1 - k) ** 3;
      setShown(Math.round(start + (value - start) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    setBump((b) => b + 1);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value]);
  return (
    <span key={bump} className={`${bump ? "num-bump" : ""} tabular-nums ${className}`}>
      {formatTHB(shown)}
    </span>
  );
}
