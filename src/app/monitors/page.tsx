"use client";

import Link from "next/link";
import { memo, startTransition, useCallback, useMemo, useState, type ReactNode } from "react";
import { Box, Briefcase, Check, ChevronDown, Eye, Gamepad2, Palette, Plus } from "lucide-react";
import {
  calculateMonitorPpi,
  describeMonitorClarity,
  MONITOR_CATALOG,
} from "@/lib/builder/monitors";
import type { MonitorUsageCategory } from "@/lib/builder/types";
import { formatTHB } from "@/lib/format";
import { ProductVisual } from "@/components/ProductVisual";
import { ExternalStoreButton } from "@/components/ExternalStoreModal";

/** ชื่อสายสั้นๆ + คำแนะนำบรรทัดเดียว (อ่านง่าย ไม่ลายตา) */
const USAGE: Record<MonitorUsageCategory, { label: string; hint: string; Icon: typeof Eye }> = {
  gaming: { label: "เล่นเกม", hint: "เน้นรีเฟรชเรต 144Hz ขึ้นไป ภาพลื่นไม่เบลอ", Icon: Gamepad2 },
  work: { label: "ทำงาน", hint: "เน้นจอ 2K/4K ตัวหนังสือคม เปิดหลายหน้าต่างได้", Icon: Briefcase },
  health: { label: "ถนอมสายตา", hint: "เน้นไม่กะพริบ ลดแสงสีฟ้า ขาตั้งปรับระดับได้", Icon: Eye },
  creator: { label: "ตัดต่อ/แต่งรูป", hint: "เน้นสีตรง ขอบเขตสีกว้าง ความละเอียดสูง", Icon: Palette },
};

const RES_NAME: Record<string, string> = { "1080p": "Full HD", "1440p": "2K", "Ultrawide 1440p": "จอกว้าง 2K", "4K": "4K" };
const resName = (short: string) => RES_NAME[short] ?? short;

export default function MonitorsPage() {
  const [usageFilter, setUsageFilter] = useState<MonitorUsageCategory | "all">("all");
  const [minHz, setMinHz] = useState<number>(60);
  const [resFilter, setResFilter] = useState<string>("all");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return MONITOR_CATALOG.filter((m) => {
      if (usageFilter !== "all" && m.usage !== usageFilter) return false;
      if (m.refreshHz < minHz) return false;
      if (resFilter !== "all" && m.resolution.short !== resFilter) return false;
      return true;
    });
  }, [usageFilter, minHz, resFilter]);

  const comparedMonitors = useMemo(() => MONITOR_CATALOG.filter((m) => compareIds.includes(m.id)), [compareIds]);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? [...prev.slice(1), id] : [...prev, id]
    );
  }, []);

  const chip = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors ${
      active ? "border-info bg-info text-white" : "border-ink-200 bg-surface text-ink-700 hover:border-ink-400"
    }`;

  return (
    <div className="container-page space-y-6 py-6 sm:py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">เลือกจอ</h1>
        <p className="mt-1 text-sm text-ink-600">เลือกว่าจะใช้ทำอะไร แล้วเทียบได้สูงสุด 3 รุ่น</p>
      </div>

      {/* สายการใช้งาน — ชิปแถวเดียว */}
      <div className="space-y-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button type="button" className={chip(usageFilter === "all")} onClick={() => startTransition(() => setUsageFilter("all"))}>
            ทั้งหมด
          </button>
          {(Object.keys(USAGE) as MonitorUsageCategory[]).map((key) => {
            const { label, Icon } = USAGE[key];
            return (
              <button
                key={key}
                type="button"
                className={chip(usageFilter === key)}
                onClick={() => startTransition(() => setUsageFilter(usageFilter === key ? "all" : key))}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            );
          })}
        </div>
        {usageFilter !== "all" && <p className="text-sm text-ink-600">{USAGE[usageFilter].hint}</p>}
      </div>

      {/* ตัวกรองย่อย */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={resFilter}
          onChange={(e) => {
            const v = e.target.value;
            startTransition(() => setResFilter(v));
          }}
          aria-label="ความละเอียดจอ"
          className="input h-10 w-auto rounded-full py-0 text-sm"
        >
          <option value="all">ทุกความละเอียด</option>
          <option value="1080p">Full HD</option>
          <option value="1440p">2K</option>
          <option value="Ultrawide 1440p">จอกว้าง 2K</option>
          <option value="4K">4K</option>
        </select>
        <select
          value={minHz}
          onChange={(e) => {
            const v = Number(e.target.value);
            startTransition(() => setMinHz(v));
          }}
          aria-label="รีเฟรชเรตขั้นต่ำ"
          className="input h-10 w-auto rounded-full py-0 text-sm"
        >
          <option value={60}>ทุกรีเฟรชเรต</option>
          <option value={100}>100Hz ขึ้นไป</option>
          <option value={180}>180Hz ขึ้นไป</option>
          <option value={240}>240Hz ขึ้นไป</option>
        </select>
        <span className="ml-auto text-sm text-ink-500">{filtered.length} รุ่น</span>
      </div>

      {/* ตารางเทียบ */}
      {comparedMonitors.length > 0 && (
        <section className="card space-y-3 overflow-x-auto p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-ink-950">เทียบ {comparedMonitors.length} รุ่น</h2>
            <button type="button" onClick={() => setCompareIds([])} className="text-sm font-semibold text-bad hover:underline">
              ล้าง
            </button>
          </div>
          <table className="package-compare-table">
            <thead>
              <tr>
                <th />
                {comparedMonitors.map((m) => (
                  <th key={m.id}>{m.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["ราคา", (m) => <b className="font-display">{formatTHB(m.price)}</b>],
                  ["ขนาด", (m) => `${m.sizeInch} นิ้ว · ${resName(m.resolution.short)}`],
                  ["ความลื่น", (m) => `${m.refreshHz}Hz`],
                  ["พาเนล", (m) => m.panel],
                  ["ความคม", (m) => `${calculateMonitorPpi(m)} PPI`],
                  ["สี", (m) => m.colorGamut],
                  ["ถนอมสายตา", (m) => m.lowBlueLightCert],
                ] as Array<[string, (m: CatalogMonitor) => ReactNode]>
              ).map(([label, cell]) => (
                <tr key={label}>
                  <td className="font-semibold">{label}</td>
                  {comparedMonitors.map((m) => (
                    <td key={m.id}>{cell(m)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state card py-10">
          <p className="empty-state-title">ไม่พบจอรุ่นที่ตรงกับตัวกรอง</p>
          <p className="empty-state-text">ลองปรับความละเอียดหรือลดรีเฟรชเรตขั้นต่ำลง</p>
          <button
            type="button"
            onClick={() => {
              setUsageFilter("all");
              setMinHz(60);
              setResFilter("all");
            }}
            className="btn btn-outline btn-sm"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((mon, i) => (
            <MonitorCard key={mon.id} mon={mon} inCompare={compareIds.includes(mon.id)} onToggle={toggleCompare} lazy={i >= 6} />
          ))}
        </div>
      )}
    </div>
  );
}

type CatalogMonitor = (typeof MONITOR_CATALOG)[number];

/** การ์ดจอแยกเป็น memo — กดเทียบ/เปลี่ยนตัวกรองเรนเดอร์ใหม่เฉพาะใบที่เปลี่ยน */
const MonitorCard = memo(function MonitorCard({
  mon,
  inCompare,
  onToggle,
  lazy,
}: {
  mon: CatalogMonitor;
  inCompare: boolean;
  onToggle: (id: string) => void;
  lazy: boolean;
}) {
  const ppi = calculateMonitorPpi(mon);
  const clarity = describeMonitorClarity(ppi);
  const { label, Icon } = USAGE[mon.usage];

  return (
    <article className={`market-card card-hover flex min-w-0 flex-col p-4 ${lazy ? "cv-auto" : ""}`}>
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>

      <div className="relative mt-2.5 h-36 w-full overflow-hidden rounded-xl bg-ink-50/70 p-2 sm:h-40">
        <ProductVisual productId={mon.id} imageUrl={mon.imageUrl} name={mon.name} category="monitor" brand={mon.brand} size="tile" transparentBg />
      </div>

      <h2 className="mt-2 line-clamp-2 font-display text-base font-bold leading-snug text-ink-950">{mon.name}</h2>

      {/* สเปกหลัก 3 ตัว */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-ink-50 px-1 py-2">
          <p className="font-display text-sm font-bold text-ink-950">{mon.sizeInch}&quot;</p>
          <p className="text-[11px] text-ink-500">{resName(mon.resolution.short)}</p>
        </div>
        <div className="rounded-xl bg-ink-50 px-1 py-2">
          <p className="font-display text-sm font-bold text-ink-950">{mon.refreshHz}Hz</p>
          <p className="text-[11px] text-ink-500">{mon.panel}</p>
        </div>
        <div className="rounded-xl bg-ink-50 px-1 py-2">
          <p className="font-display text-sm font-bold text-ok">{ppi} PPI</p>
          <p className="truncate text-[11px] text-ink-500" title={clarity.level}>ความคม</p>
        </div>
      </div>

      <details className="group mt-2 text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-ink-500 hover:text-ink-800">
          สเปกเพิ่มเติม <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <dl className="mt-1 space-y-1 text-ink-700 [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&_dt]:shrink-0 [&_dt]:text-ink-500 [&_dd]:text-right">
          <div><dt>ความละเอียด</dt><dd>{mon.resolution.label}</dd></div>
          <div><dt>ตอบสนอง</dt><dd>{mon.responseMs} ms</dd></div>
          <div><dt>สี / ความสว่าง</dt><dd>{mon.colorGamut} · {mon.brightnessNits} nits</dd></div>
          <div><dt>ถนอมสายตา</dt><dd>{mon.lowBlueLightCert}</dd></div>
          <div><dt>ขาตั้ง</dt><dd>{mon.ergonomicStand.join(", ")}</dd></div>
          <div><dt>พอร์ต</dt><dd>{mon.ports.join(", ")}</dd></div>
        </dl>
      </details>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
        <span className="font-display text-xl font-bold text-ink-950">{formatTHB(mon.price)}</span>
        <button
          type="button"
          onClick={() => onToggle(mon.id)}
          aria-pressed={inCompare}
          className={`btn btn-sm ${inCompare ? "btn-primary" : "btn-outline"}`}
        >
          {inCompare ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />} เทียบ
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <Link href={`/builder?monitor=${mon.id}`} className="btn btn-volt btn-sm flex-1">
          <Box className="h-4 w-4" /> ลองใน 3D
        </Link>
        <ExternalStoreButton
          name={mon.name}
          price={mon.price}
          category="monitor"
          imageUrl={mon.imageUrl}
          buyUrl={mon.buyUrl}
          platform={mon.platform}
          label="ซื้อ"
          size="sm"
        />
      </div>
    </article>
  );
});
