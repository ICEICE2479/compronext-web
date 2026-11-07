"use client";

import { useSyncExternalStore } from "react";

/**
 * ตะกร้าสินค้า (เก็บในเบราว์เซอร์) — ComproNext ไม่รับเงินเอง
 * ตอนชำระเงิน ลูกค้าจะถูกพาไปจ่ายที่ร้านพาร์ตเนอร์แต่ละร้าน
 */
export interface CartItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  buyUrl: string;
  storeName: string;
  quantity: number;
  /** หมวดสินค้า (ProductCategory) ใช้จัดลำดับ "ซื้ออะไรก่อน" */
  category?: string;
}

const STORAGE_KEY = "compronext_cart_v1";
const EVENT_NAME = "compronext:cart-change";
const EMPTY: CartItem[] = [];

let cachedRaw: string | null = null;
let cachedList: CartItem[] = EMPTY;

function isItem(x: unknown): x is CartItem {
  const o = x as CartItem;
  return !!o && typeof o.id === "string" && typeof o.price === "number" && typeof o.quantity === "number";
}

function readCart(): CartItem[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedList;
    cachedRaw = raw;
    const parsed = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed) ? parsed.filter(isItem) : EMPTY;
    return cachedList;
  } catch {
    return EMPTY;
  }
}

function writeCart(items: CartItem[]) {
  try {
    const raw = JSON.stringify(items);
    cachedRaw = raw;
    cachedList = items;
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // ignore storage errors (private mode / quota)
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT_NAME, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT_NAME, cb);
    window.removeEventListener("storage", cb);
  };
}

export type CartInput = Omit<CartItem, "quantity"> & { quantity?: number };

export function addToCart(input: CartInput | CartInput[]) {
  const list = [...readCart()];
  for (const it of Array.isArray(input) ? input : [input]) {
    const qty = Math.max(1, it.quantity ?? 1);
    const idx = list.findIndex((x) => x.id === it.id);
    if (idx >= 0) list[idx] = { ...list[idx], quantity: list[idx].quantity + qty };
    else list.push({ ...it, quantity: qty });
  }
  writeCart(list);
}

export function setCartQuantity(id: string, quantity: number) {
  const list = readCart();
  writeCart(
    quantity <= 0
      ? list.filter((x) => x.id !== id)
      : list.map((x) => (x.id === id ? { ...x, quantity: Math.min(99, quantity) } : x))
  );
}

export function clearCart() {
  writeCart([]);
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, readCart, () => EMPTY);
  const count = items.reduce((s, x) => s + x.quantity, 0);
  const total = items.reduce((s, x) => s + x.price * x.quantity, 0);
  return { items, count, total, has: (id: string) => items.some((x) => x.id === id) };
}

/** แทนที่ตะกร้าทั้งชุด (ใช้ตอนรวมกับตะกร้าในบัญชี) */
export function replaceCart(items: CartItem[]) {
  writeCart(items.filter(isItem));
}

export function getCartSnapshot(): CartItem[] {
  return readCart();
}

export function subscribeCart(cb: () => void) {
  return subscribe(cb);
}
