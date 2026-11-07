"use client";

import { useEffect } from "react";
import { getWishlistSnapshot, replaceWishlistRooms, subscribeWishlist } from "@/lib/wishlist";
import { getSavedBuildsSnapshot, replaceSavedBuilds, subscribeSavedBuilds } from "@/lib/builder/saved-builds";
import type { SavedPcBuild } from "@/lib/builder/types";

const SYNCED_KEY = "compronext:saved-synced";

/**
 * ซิงก์ "ห้องที่บันทึก" + "สเปกคอมที่บันทึก" กับบัญชีสมาชิก (ล็อกอินเครื่องไหนก็เห็นเหมือนกัน)
 * รวมของในเครื่องกับของในบัญชี; ของที่เคยซิงก์แล้วแต่หายจากบัญชี = ถูกลบจากเครื่องอื่น → ลบในเครื่องนี้ด้วย
 */
export function SavedSync() {
  useEffect(() => {
    let timer: number | undefined;
    let ready = false;
    const readSynced = (): { rooms: string[]; builds: string[] } => {
      try {
        return JSON.parse(localStorage.getItem(SYNCED_KEY) || "") as { rooms: string[]; builds: string[] };
      } catch {
        return { rooms: [], builds: [] };
      }
    };
    const push = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const rooms = getWishlistSnapshot();
        const builds = getSavedBuildsSnapshot();
        fetch("/api/saved", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rooms, builds }) })
          .then((r) => {
            if (r.ok) localStorage.setItem(SYNCED_KEY, JSON.stringify({ rooms, builds: builds.map((b) => b.id) }));
          })
          .catch(() => {});
      }, 1200);
    };

    fetch("/api/saved")
      .then((r) => r.json())
      .then((data: { ok: boolean; rooms?: string[]; builds?: SavedPcBuild[] }) => {
        if (!data.ok) return;
        const synced = readSynced();
        const serverRooms = new Set(data.rooms ?? []);
        const serverBuilds = new Map((data.builds ?? []).map((b) => [b.id, b]));
        const goneRooms = new Set(synced.rooms.filter((id) => !serverRooms.has(id)));
        const goneBuilds = new Set(synced.builds.filter((id) => !serverBuilds.has(id)));
        replaceWishlistRooms([...getWishlistSnapshot().filter((id) => !goneRooms.has(id)), ...serverRooms]);
        const builds = new Map(getSavedBuildsSnapshot().filter((b) => !goneBuilds.has(b.id)).map((b) => [b.id, b]));
        for (const [id, b] of serverBuilds) if (!builds.has(id)) builds.set(id, b);
        replaceSavedBuilds([...builds.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        push();
      })
      .catch(() => {})
      .finally(() => {
        ready = true;
      });

    const onChange = () => {
      if (ready) push();
    };
    const u1 = subscribeWishlist(onChange);
    const u2 = subscribeSavedBuilds(onChange);
    return () => {
      u1();
      u2();
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}
