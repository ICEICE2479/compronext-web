"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { START_PATHS } from "./start-paths";

const KEY = "compronext_onboard_home_v2";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** เข้าเว็บครั้งแรก: ถามว่า "มาทำอะไร" 3 ทาง แล้วพาไปหน้าที่ใช่ (แสดงครั้งเดียว) */
export function FirstVisitGuide() {
  const show = useSyncExternalStore(subscribe, getSnapshot, () => false);
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="first-visit-title">
      <button type="button" aria-label="ปิด" tabIndex={-1} className="absolute inset-0 bg-ink-950/50" onClick={dismiss} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-pop sm:rounded-3xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="ปิด"
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 id="first-visit-title" className="text-h3 pr-10 text-ink-950">สวัสดี! วันนี้มาทำอะไร</h2>
        <ul className="mt-4 space-y-2">
          {START_PATHS.map(({ href, icon: Icon, title, who }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={dismiss}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-ink-200 p-3 transition-colors hover:border-info hover:bg-info-bg"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info-bg text-info" aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-base font-bold text-ink-950">{title}</span>
                  <span className="block text-xs leading-relaxed text-ink-600">{who}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <button type="button" onClick={dismiss} className="mt-3 min-h-11 w-full text-sm font-semibold text-ink-600 hover:text-ink-950">
          ขอดูเว็บก่อน
        </button>
      </div>
    </div>
  );
}
