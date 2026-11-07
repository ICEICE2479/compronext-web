"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Flag, Heart } from "lucide-react";
import { toast } from "@/lib/toast";

/** ถูกใจ · ใช้สเปกนี้ (คัดลอกไปจัดสเปก) · รายงาน */
export function CommunityActions({ id, likeCount, liked: initLiked, copyHref, copies }: { id: string; likeCount: number; liked: boolean; copyHref?: string; copies: number }) {
  const [liked, setLiked] = useState(initLiked);
  const [count, setCount] = useState(likeCount);
  const router = useRouter();
  const act = (action: string) => fetch(`/api/community/${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).then((r) => r.json());

  async function like() {
    const r = await act("like").catch(() => null);
    if (r?.needLogin) return router.push(`/login?next=/community/${id}`);
    if (r?.ok) {
      setLiked(r.liked);
      setCount(r.likeCount);
    }
  }
  async function report() {
    const r = await act("report").catch(() => null);
    if (r?.needLogin) return router.push(`/login?next=/community/${id}`);
    toast(r?.ok ? "ขอบคุณที่แจ้ง ทีมงานจะตรวจสอบ" : r?.error || "ส่งไม่สำเร็จ");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={like} aria-pressed={liked} className="chip tap-target rounded-full" data-active={liked} aria-label={`ถูกใจ ${count} คน`}>
        <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} aria-hidden="true" /> {count}
      </button>
      {copyHref && (
        <a
          href={copyHref}
          onClick={() => {
            void act("copy").catch(() => {});
          }}
          className="btn btn-primary h-11 rounded-full px-4 text-sm"
        >
          <Copy className="h-4 w-4" aria-hidden="true" /> ใช้สเปกนี้ ({copies})
        </a>
      )}
      <button type="button" onClick={report} className="tap-target ml-auto inline-flex items-center gap-1 rounded-sm px-2 text-xs text-ink-600 hover:text-bad focus-visible:outline-2 focus-visible:outline-info">
        <Flag className="h-3.5 w-3.5" aria-hidden="true" /> รายงาน
      </button>
    </div>
  );
}
