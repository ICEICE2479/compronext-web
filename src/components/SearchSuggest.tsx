"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Tag } from "lucide-react";
import { formatTHB } from "@/lib/format";

type Data = { products: Array<{ id: string; name: string; price: number }>; rooms: Array<{ slug: string; name: string }>; categories: Array<{ slug: string; label: string }> };

/** รายการแนะนำใต้ช่องค้นหา (ดีเลย์ 200ms, ปิดเมื่อคลิกข้างนอก/กด Esc) */
export function SearchSuggest({ query, onPick }: { query: string; onPick: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d: Data) => {
          setData(d);
          setOpen(true);
        })
        .catch(() => {});
    }, 200);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [query]);

  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.parentElement?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const empty = !data || (!data.products.length && !data.rooms.length && !data.categories.length);
  if (!open || query.trim().length < 2 || empty) return null;
  const pick = () => {
    setOpen(false);
    onPick();
  };
  return (
    <div ref={box} role="listbox" aria-label="คำแนะนำการค้นหา" className="scene-chip absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-ink-200 bg-surface py-1.5 shadow-xl">
      {data.categories.map((c) => (
        <Link key={c.slug} href={`/categories?cat=${c.slug}`} onClick={pick} className="flex items-center gap-2 px-4 py-2 text-sm text-ink-800 hover:bg-ink-100">
          <Tag className="h-4 w-4 text-info" /> หมวด {c.label}
        </Link>
      ))}
      {data.products.map((p) => (
        <Link key={p.id} href={`/products/${p.id}`} onClick={pick} className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-ink-100">
          <span className="min-w-0 truncate text-ink-900">{p.name}</span>
          <span className="shrink-0 text-xs font-semibold text-ink-700">{formatTHB(p.price)}</span>
        </Link>
      ))}
      {data.rooms.map((r) => (
        <Link key={r.slug} href={`/rooms/${r.slug}`} onClick={pick} className="flex items-center gap-2 px-4 py-2 text-sm text-ink-800 hover:bg-ink-100">
          <LayoutGrid className="h-4 w-4 text-info" /> <span className="truncate">{r.name}</span>
        </Link>
      ))}
    </div>
  );
}
