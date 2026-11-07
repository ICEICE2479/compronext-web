"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "compronext_compare_products_v1";
const EVENT_NAME = "compronext:compare-change";
const MAX_COMPARE = 4;

const EMPTY: string[] = [];
let cachedRaw: string | null = null;
let cachedList: string[] = EMPTY;

function readIds(): string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedList;
    cachedRaw = raw;
    if (!raw) {
      cachedList = EMPTY;
      return cachedList;
    }
    const parsed = JSON.parse(raw);
    cachedList = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_COMPARE)
      : EMPTY;
    return cachedList;
  } catch {
    return EMPTY;
  }
}

function writeIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const unique = Array.from(new Set(ids)).slice(0, MAX_COMPARE);
    const nextRaw = JSON.stringify(unique);
    cachedRaw = nextRaw;
    cachedList = unique;
    window.localStorage.setItem(STORAGE_KEY, nextRaw);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // ignore storage errors
  }
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}

export function useCompareProducts() {
  const ids = useSyncExternalStore(subscribe, readIds, () => EMPTY);

  return {
    ids,
    count: ids.length,
    max: MAX_COMPARE,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => {
      const current = readIds();
      if (current.includes(id)) {
        writeIds(current.filter((x) => x !== id));
      } else {
        if (current.length >= MAX_COMPARE) {
          writeIds([...current.slice(1), id]);
        } else {
          writeIds([...current, id]);
        }
      }
    },
    remove: (id: string) => {
      writeIds(readIds().filter((x) => x !== id));
    },
    clear: () => writeIds([]),
  };
}
