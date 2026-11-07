"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

/** เปิด/ปิดรับอีเมลสรุปรายสัปดาห์ (ของที่ติดตามลดราคา ห้องใหม่ โพสต์ชุมชนยอดนิยม) */
export function DigestToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/digest")
      .then((r) => r.json())
      .then((d) => setOn(d.ok ? !!d.on : null))
      .catch(() => setOn(null));
  }, []);
  if (on === null) return null;
  const toggle = async () => {
    const r = await fetch("/api/digest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: !on }) }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setOn(r.on);
  };
  return (
    <button type="button" onClick={toggle} data-active={on} aria-pressed={on} className="chip tap-target rounded-full">
      <Mail className="h-3.5 w-3.5" /> {on ? "รับอีเมลรายสัปดาห์อยู่" : "รับอีเมลสรุปรายสัปดาห์"}
    </button>
  );
}
