"use client";

import { useSyncExternalStore } from "react";
import type { BuildSelection, SavedPcBuild } from "./types";

const SAVED_BUILDS_KEY = "compronext:saved-builds";
const SAVED_BUILDS_EVENT = "compronext:saved-builds-change";

const EMPTY_BUILDS: SavedPcBuild[] = [];
let cachedRaw = "";
let cachedBuilds: SavedPcBuild[] = EMPTY_BUILDS;

function getSnapshot(): SavedPcBuild[] {
  if (typeof window === "undefined") return EMPTY_BUILDS;
  try {
    const raw = window.localStorage.getItem(SAVED_BUILDS_KEY) || "[]";
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      const parsed = JSON.parse(raw);
      cachedBuilds = Array.isArray(parsed) ? parsed : EMPTY_BUILDS;
    }
    return cachedBuilds;
  } catch {
    return EMPTY_BUILDS;
  }
}

function getServerSnapshot(): SavedPcBuild[] {
  return EMPTY_BUILDS;
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("storage", handler);
  window.addEventListener(SAVED_BUILDS_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(SAVED_BUILDS_EVENT, handler);
  };
}

export function savePcBuild(name: string, selection: BuildSelection): SavedPcBuild {
  const current = getSnapshot();
  const item: SavedPcBuild = {
    id: `build-${Date.now()}`,
    name: name.trim() || `สเปกคอมของฉัน (${current.length + 1})`,
    selection,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  const next = [item, ...current];
  window.localStorage.setItem(SAVED_BUILDS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SAVED_BUILDS_EVENT));
  return item;
}

export function deleteSavedPcBuild(id: string): void {
  const next = getSnapshot().filter((b) => b.id !== id);
  window.localStorage.setItem(SAVED_BUILDS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SAVED_BUILDS_EVENT));
}

/** ค่าเสริมที่แนบไปกับลิงก์แชร์ (จำนวนชิ้น จุดยึดพัดลม/หม้อน้ำ แบบพัดลม สีไฟ) */
export interface BuildExtras {
  r?: number;
  s?: number;
  g?: number;
  m?: unknown;
  f?: string;
  c?: string;
}

export function encodeBuildQuery(selection: BuildSelection, extras?: BuildExtras): string {
  try {
    const payload = extras ? { ...selection, _x: extras } : selection;
    return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
  } catch {
    return "";
  }
}

export function decodeBuildQuery(encoded: string | null): BuildSelection | null {
  return decodeBuildPayload(encoded)?.selection ?? null;
}

export function decodeBuildPayload(encoded: string | null): { selection: BuildSelection; extras: BuildExtras } | null {
  if (!encoded) return null;
  try {
    const raw = atob(decodeURIComponent(encoded));
    let json = raw;
    try {
      json = decodeURIComponent(escape(raw));
    } catch {
      /* ลิงก์รุ่นเก่า */
    }
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    const { _x, ...selection } = parsed as BuildSelection & { _x?: BuildExtras };
    return { selection: selection as BuildSelection, extras: _x && typeof _x === "object" ? _x : {} };
  } catch {
    return null;
  }
}

export function useSavedPcBuilds() {
  const builds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    builds,
    save: savePcBuild,
    remove: deleteSavedPcBuild,
  };
}

/* ---- ใช้ซิงก์กับบัญชีสมาชิก ---- */
export const getSavedBuildsSnapshot = getSnapshot;
export const subscribeSavedBuilds = subscribe;
export function replaceSavedBuilds(list: SavedPcBuild[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_BUILDS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(SAVED_BUILDS_EVENT));
}
