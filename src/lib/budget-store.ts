"use client";

/** งบรวมที่ผู้ใช้ตั้งไว้ (เก็บในเบราว์เซอร์) ใช้ร่วมกันระหว่างหน้า /design กับตะกร้า */
export const BUDGET_KEY = "compronext_budget_v1";

export function readBudget(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BUDGET_KEY);
    if (!raw) return null;
    const v = Number(raw);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeBudget(v: number | null): void {
  if (typeof window === "undefined") return;
  try {
    if (v === null) window.localStorage.removeItem(BUDGET_KEY);
    else if (Number.isFinite(v) && v > 0) window.localStorage.setItem(BUDGET_KEY, String(Math.round(v)));
  } catch {
    // ignore storage errors (private mode / quota)
  }
}
