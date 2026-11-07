"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "compronext:wishlist-rooms";
const EVENT_NAME = "compronext:wishlist-change";

const EMPTY_LIST: string[] = [];
let cachedRaw = "";
let cachedList: string[] = EMPTY_LIST;

function getSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY_LIST;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || "[]";
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      const parsed = JSON.parse(raw);
      cachedList = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : EMPTY_LIST;
    }
    return cachedList;
  } catch {
    return EMPTY_LIST;
  }
}

function getServerSnapshot(): string[] {
  return EMPTY_LIST;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(EVENT_NAME, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(EVENT_NAME, handler);
  };
}

export function toggleWishlistRoom(roomId: string): boolean {
  if (typeof window === "undefined") return false;
  const current = getSnapshot();
  const exists = current.includes(roomId);
  const next = exists ? current.filter((id) => id !== roomId) : [...current, roomId];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
  return !exists;
}

export function clearWishlistRooms(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, "[]");
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function useWishlistRooms() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    ids,
    count: ids.length,
    isSaved: (id: string) => ids.includes(id),
    toggle: toggleWishlistRoom,
    clear: clearWishlistRooms,
  };
}

/* ---- ใช้ซิงก์กับบัญชีสมาชิก ---- */
export const getWishlistSnapshot = getSnapshot;
export const subscribeWishlist = subscribe;
export function replaceWishlistRooms(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}
