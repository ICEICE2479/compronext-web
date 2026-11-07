"use client";

import { Share2 } from "lucide-react";
import { toast } from "@/lib/toast";

function absolute(url?: string) {
  return url ? new URL(url, window.location.origin).toString() : window.location.href;
}

/** แชร์ไป LINE + แชร์ทั่วไป (เมนูแชร์ของมือถือ ถ้าไม่มีจะคัดลอกลิงก์) */
export function ShareButton({ title, url }: { title: string; url?: string }) {
  async function share() {
    const href = absolute(url);
    if (navigator.share) {
      try {
        await navigator.share({ title, url: href });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(href);
      toast("คัดลอกลิงก์แล้ว");
    } catch {
      toast("คัดลอกลิงก์ไม่ได้", { tone: "error" });
    }
  }

  function shareLine() {
    const href = absolute(url);
    window.open(
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(href)}&text=${encodeURIComponent(title)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={shareLine}
        aria-label="แชร์ไป LINE"
        title="แชร์ไป LINE"
        className="icon-btn h-11 border-[#06C755] bg-[#06C755] px-4 text-white hover:bg-[#05b34c]"
      >
        <span className="text-sm font-bold">LINE</span>
      </button>
      <button type="button" onClick={share} className="icon-btn h-11 px-4" aria-label="แชร์">
        <Share2 className="h-4 w-4" />
        <span className="text-sm font-semibold">แชร์</span>
      </button>
    </>
  );
}
