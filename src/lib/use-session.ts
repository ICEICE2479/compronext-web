"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import type { UserSession } from "@/lib/auth";

/**
 * สถานะล็อกอินฝั่งเบราว์เซอร์ — ทำให้หน้าเว็บแคชเป็นไฟล์สำเร็จรูปได้ (เปิดไวขึ้นมาก)
 * จำชื่อไว้ในเครื่องเพื่อให้แถบบนแสดงทันทีไม่กระพริบ แล้วเช็กกับเซิร์ฟเวอร์ทุกครั้งที่เปลี่ยนหน้า
 */
type S = { user: UserSession | null; isAdmin: boolean };
const KEY = "compronext:session-hint";
let state: S = { user: null, isAdmin: false };
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function hydrateHint() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const h = JSON.parse(localStorage.getItem(KEY) || "null") as S | null;
    if (h) state = h;
  } catch {
    /* ไม่เป็นไร */
  }
}

export async function refreshSession() {
  try {
    const r = (await fetch("/api/me", { cache: "no-store" }).then((x) => x.json())) as S;
    const next = { user: r.user, isAdmin: !!r.isAdmin };
    if (JSON.stringify(next) !== JSON.stringify(state)) {
      state = next;
      emit();
    }
    try {
      if (next.user || next.isAdmin) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    } catch {
      /* โหมดส่วนตัว */
    }
  } catch {
    /* ออฟไลน์ */
  }
}

const EMPTY: S = { user: null, isAdmin: false };
export function useSession(): S {
  const pathname = usePathname();
  const snap = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => {
      hydrateHint();
      return state;
    },
    () => EMPTY
  );
  useEffect(() => {
    void refreshSession();
  }, [pathname]);
  return snap;
}
