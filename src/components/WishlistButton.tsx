"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { useWishlistRooms } from "@/lib/wishlist";

const POP = "motion-safe:animate-[pop_300ms_var(--ease-spring)]";

export function WishlistButton({
  roomId,
  variant = "icon",
}: {
  roomId: string;
  variant?: "icon" | "full";
}) {
  const { isSaved, toggle } = useWishlistRooms();
  const saved = isSaved(roomId);
  // นับครั้งที่กด → remount ไอคอนเพื่อเล่นแอนิเมชันเด้งยืนยัน (ไม่เล่นตอนโหลดหน้า)
  const [pop, setPop] = useState(0);
  const popCls = pop ? POP : "";

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={() => {
          toggle(roomId);
          setPop((n) => n + 1);
        }}
        aria-pressed={saved}
        className={saved ? "btn btn-volt" : "btn btn-outline"}
      >
        <Bookmark key={pop} className={`h-4 w-4 ${saved ? "fill-ink-950" : ""} ${popCls}`} />
        <span>{saved ? "บันทึกในรายการโปรดแล้ว" : "บันทึกห้องนี้ (Wishlist)"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(roomId);
        setPop((n) => n + 1);
      }}
      aria-label={saved ? "ลบออกจากห้องที่บันทึกไว้" : "บันทึกห้องนี้ลง Wishlist"}
      aria-pressed={saved}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-[4px] border transition-all ${
        saved
          ? "border-info bg-info text-white shadow-xs"
          : "border-ink-300 bg-white/95 text-ink-800 hover:border-info hover:text-info"
      }`}
    >
      <Bookmark key={pop} className={`h-4 w-4 ${saved ? "fill-white" : ""} ${popCls}`} />
    </button>
  );
}
