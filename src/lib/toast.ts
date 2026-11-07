import { haptic } from "@/lib/haptics";

export interface ToastAction {
  label: string;
  /** ลิงก์ หรือ "cart" เพื่อเปิดตะกร้าด้านข้าง */
  href: string;
}

export interface ToastDetail {
  id: number;
  message: string;
  tone: "ok" | "error";
  action?: ToastAction;
}

export const TOAST_EVENT = "compronext:toast";
export const OPEN_CART_EVENT = "compronext:open-cart";

let nextId = 1;

export function toast(message: string, opts: { tone?: "ok" | "error"; action?: ToastAction } = {}) {
  if (typeof window === "undefined") return;
  const tone = opts.tone ?? "ok";
  haptic(tone === "error" ? [30, 40, 30] : 12);
  const detail: ToastDetail = { id: nextId++, message, tone, action: opts.action };
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail }));
}

export function openCartDrawer() {
  window.dispatchEvent(new CustomEvent(OPEN_CART_EVENT));
}
