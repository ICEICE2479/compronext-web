"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { analyticsAllowed } from "@/lib/consent";
import { RotateCw } from "lucide-react";
import { haptic } from "@/lib/haptics";

const PULL_TRIGGER = 72;

/**
 * - ลงทะเบียน service worker (เฉพาะ production)
 * - ดึงลงเพื่อรีเฟรช เมื่อเปิดแบบแอป (Add to Home Screen) เพราะ iOS ไม่มีให้
 */
export function AppShellEffects() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // นับการเปิดหน้า (เฉพาะเมื่อยอมรับคุกกี้สถิติ) — ไว้ดูว่าคนหลุดตรงไหน
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (!analyticsAllowed() || pathname.startsWith("/admin")) return;
    const q = search.toString();
    try {
      navigator.sendBeacon?.("/api/track", new Blob([JSON.stringify({ event: "visit", path: q ? `${pathname}?${q}` : pathname })], { type: "application/json" }));
    } catch {
      /* ไม่เป็นไร */
    }
  }, [pathname, search]);

  // แถบบน: เงาเมื่อเลื่อน + ซ่อนตอนเลื่อนลง/โผล่ตอนเลื่อนขึ้น (มือถือ) — ไม่ซ่อนถ้ากำลังพิมพ์ค้นหาหรือมีหน้าต่างเปิดอยู่
  useEffect(() => {
    const root = document.documentElement;
    let last = window.scrollY;
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      root.dataset.scrolled = y > 8 ? "1" : "0";
      const busy = !!document.querySelector('[aria-modal="true"]') || !!document.activeElement?.closest(".site-header");
      if (busy || y < 80) root.dataset.scrollDir = "up";
      else if (y > last + 6) root.dataset.scrollDir = "down";
      else if (y < last - 6) root.dataset.scrollDir = "up";
      last = y;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      delete root.dataset.scrolled;
      delete root.dataset.scrollDir;
    };
  }, []);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    const onStart = (e: TouchEvent) => {
      const modalOpen = document.body.style.overflow === "hidden";
      startY.current = window.scrollY <= 0 && !modalOpen ? e.touches[0].clientY : null;
    };
    // touchmove ยิงถี่มาก: อัปเดต state แค่ครั้งละเฟรม
    let raf = 0;
    const flush = () => {
      raf = 0;
      setPull(pullRef.current);
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const d = Math.max(0, Math.min(120, (e.touches[0].clientY - startY.current) * 0.5));
      if (d > 0 && pullRef.current < PULL_TRIGGER && d >= PULL_TRIGGER) haptic(8);
      pullRef.current = d;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const onEnd = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (startY.current !== null && pullRef.current >= PULL_TRIGGER) {
        setRefreshing(true);
        router.refresh();
        window.setTimeout(() => setRefreshing(false), 900);
      }
      startY.current = null;
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("touchcancel", onEnd);
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  if (!pull && !refreshing) return null;
  const shown = refreshing ? PULL_TRIGGER : pull;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[65] flex justify-center"
      style={{ transform: `translateY(${shown - 40}px)` }}
    >
      <span className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md">
        <RotateCw
          className={`h-5 w-5 text-info ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${shown * 4}deg)`, opacity: Math.min(1, shown / PULL_TRIGGER) }}
        />
      </span>
    </div>
  );
}
