"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

/** ไอคอนข้อความ + จำนวนที่ยังไม่อ่าน (เช็กทุก 60 วินาที และตอนกลับมาที่แท็บ) */
export function MessagesIcon({ className = "" }: { className?: string }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/chat")
        .then((r) => r.json())
        .then((d) => alive && d?.ok && setUnread(d.unread ?? 0))
        .catch(() => {});
    };
    check();
    const t = window.setInterval(check, 60000);
    window.addEventListener("focus", check);
    window.addEventListener("compronext:chat-read", check);
    return () => {
      alive = false;
      window.clearInterval(t);
      window.removeEventListener("focus", check);
      window.removeEventListener("compronext:chat-read", check);
    };
  }, []);
  return (
    <Link href="/messages" className={`icon-btn relative border-transparent ${className}`} aria-label={`ข้อความ ${unread ? `ยังไม่อ่าน ${unread}` : ""}`}>
      <MessageCircle className="h-5 w-5" />
      {unread > 0 && <span className="icon-badge">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
