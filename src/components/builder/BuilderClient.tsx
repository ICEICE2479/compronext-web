"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useFocusTrap } from "@/components/useFocusTrap";
import dynamic from "next/dynamic";
import {
  BadgeCheck,
  Bookmark,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircuitBoard,
  Cpu,
  Fan,
  Gauge,
  Gpu,
  HardDrive,
  MemoryStick,
  Minus,
  Monitor,
  Plus,
  PlugZap,
  RotateCcw,
  Share2,
  TriangleAlert,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { BUILDER_PRESETS, PC_PARTS } from "@/lib/builder/parts";
import { calculateBuildTotals, evaluateBuilderCompatibility, maxGpuCount, resolveBuildSelection } from "@/lib/builder/compat";
import { estimateAllGamesFps, type FpsResolution } from "@/lib/builder/fps";
import { decodeBuildPayload, encodeBuildQuery, savePcBuild } from "@/lib/builder/saved-builds";
import type { FanModelStyle } from "./PcScene3D";
import type { MountConfig } from "./pc-model";
import { RecommendPanel } from "./RecommendPanel";
import { UpgradePanel } from "./UpgradePanel";
import { BeginnerChip, BeginnerMode } from "./BeginnerMode";
import { GuideBox } from "./GuideBox";
import { JargonTip } from "./JargonTip";
import { explainIssue, goodForLine } from "@/lib/builder/explain";
import { AnimatedTHB } from "@/components/AnimatedNumber";
import { PostToCommunity } from "@/components/PostToCommunity";
import { EXTRA_DOCK_SLOTS, type ExtraDockOption } from "@/lib/builder/extras";
import type { BuildSelection, BuilderSlot, PcPart } from "@/lib/builder/types";
import { formatTHB } from "@/lib/format";
import { resolveRealProductImage } from "@/lib/product-images";
import type { CartInput } from "@/lib/cart-store";
import { toast } from "@/lib/toast";
import { haptic } from "@/lib/haptics";
import { AddToCartButton } from "@/components/AddToCartButton";
import { displayPhotoSrc } from "@/lib/own-storage";

// โหลด three.js เฉพาะตอนต้องแสดงฉาก 3D
const PcScene3D = dynamic(() => import("./PcScene3D").then((m) => m.PcScene3D), {
  ssr: false,
  loading: () => <div className="h-[380px] w-full animate-pulse rounded-2xl bg-ink-100 sm:h-[460px]" />,
});

type Slot = Exclude<BuilderSlot, "monitor">;

const SLOTS: Array<{ slot: Slot; label: string; icon: typeof Cpu }> = [
  { slot: "cpu", label: "ซีพียู", icon: Cpu },
  { slot: "gpu", label: "การ์ดจอ", icon: Gpu },
  { slot: "motherboard", label: "เมนบอร์ด", icon: CircuitBoard },
  { slot: "ram", label: "แรม", icon: MemoryStick },
  { slot: "storage", label: "SSD", icon: HardDrive },
  { slot: "cooler", label: "ระบายความร้อน", icon: Fan },
  { slot: "psu", label: "พาวเวอร์", icon: PlugZap },
  { slot: "case", label: "เคส", icon: Box },
];

/** คำศัพท์ที่ควรรู้ของแต่ละช่อง (key ตรงกับ GLOSSARY) */
const SLOT_JARGON: Partial<Record<BuilderSlot, Array<[string, string]>>> = {
  cpu: [["socket", "Socket"], ["tdp", "TDP"]],
  gpu: [["vram", "VRAM"], ["pcie", "PCIe"]],
  motherboard: [["socket", "Socket"], ["chipset", "Chipset"]],
  ram: [["ddr", "DDR4/DDR5"], ["xmp", "XMP"]],
  storage: [["nvme", "NVMe"], ["pcie", "PCIe"]],
  psu: [["80plus", "80 PLUS"]],
  cooler: [["tdp", "TDP"]],
};

const DEFAULT_SELECTION: BuildSelection = {
  cpu: "cpu-r7-7800x3d",
  motherboard: "mb-b650-tomahawk",
  ram: "ram-ddr5-32-6000-black",
  gpu: "gpu-rtx-4070s-white",
  storage: "ssd-2tb-990pro",
  cooler: "cooler-aio-240-black",
  psu: "psu-850w-gold-white",
  case: "case-nzxt-h6-black",
};

function partImage(part: PcPart): string {
  const raw = part.imageUrl || resolveRealProductImage({ id: part.id, name: part.name, category: part.slot });
  if (!raw) return "";
  return displayPhotoSrc(raw);
}

/** จุดเด่นสั้นๆ ของชิ้นส่วน (แสดงบรรทัดเดียว) */
function shortSpec(p: PcPart): string {
  const s = p.specs;
  switch (p.slot) {
    case "cpu":
      return [s.cores, s.socket].filter(Boolean).join(" · ");
    case "gpu":
      return [s.vramGb && `${s.vramGb}GB`, s.boardPowerWatts && `${s.boardPowerWatts}W`].filter(Boolean).join(" · ");
    case "motherboard":
      return [s.socket, s.formFactor, s.ramType].filter(Boolean).join(" · ");
    case "ram":
      return [s.capacityGb && `${s.capacityGb}GB`, s.ramType, s.speedMhz && `${s.speedMhz}MHz`].filter(Boolean).join(" · ");
    case "storage":
      return [s.storageGb && (s.storageGb >= 1000 ? `${s.storageGb / 1000}TB` : `${s.storageGb}GB`), s.interface].filter(Boolean).join(" · ");
    case "psu":
      return [s.wattage && `${s.wattage}W`, s.efficiency].filter(Boolean).join(" · ");
    case "cooler":
      return s.coolerType === "aio" ? `ชุดน้ำ ${s.radiatorMm ?? ""}มม.` : "ซิงก์ลม";
    case "case":
      return s.caseSizeClass === "itx" ? "Mini-ITX" : s.caseSizeClass === "matx" ? "Micro-ATX" : s.caseSizeClass === "full" ? "Full Tower" : "Mid Tower";
  }
}

const useIsSmall = () =>
  useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(max-width: 767px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false
  );

export function BuilderClient({
  initialEncodedBuild,
  initialMonitorId,
}: {
  initialEncodedBuild?: string | null;
  initialMonitorId?: string | null;
}) {
  // ลิงก์แชร์: สเปก + จำนวนชิ้น + จุดยึดพัดลม/หม้อน้ำ + แบบพัดลม
  const [shared] = useState(() => decodeBuildPayload(initialEncodedBuild ?? null));
  const [selection, setSelection] = useState<BuildSelection>(() => {
    const base = shared ? { ...DEFAULT_SELECTION, ...shared.selection } : { ...DEFAULT_SELECTION };
    if (initialMonitorId) base.monitor = initialMonitorId;
    return base;
  });
  const qtyOf = (v: unknown, max: number) => (typeof v === "number" && v >= 1 ? Math.min(max, Math.floor(v)) : 1);
  const [ramQty, setRamQty] = useState(() => qtyOf(shared?.extras.r, 2));
  const [storageQty, setStorageQty] = useState(() => qtyOf(shared?.extras.s, 4));
  const [gpuQtyRaw, setGpuQty] = useState(() => qtyOf(shared?.extras.g, 4));
  const [initialMounts] = useState(() => (shared?.extras.m ?? null) as MountConfig | null);
  const mountsRef = useRef<MountConfig | null>(initialMounts);
  const [fanModel, setFanModel] = useState<FanModelStyle>(() => (["sl_infinity", "dual_ring", "argb", "stealth"].includes(shared?.extras.f ?? "") ? (shared!.extras.f as FanModelStyle) : "sl_infinity"));
  const [extras, setExtras] = useState<Record<string, ExtraDockOption>>({});
  const [showRecommend, setShowRecommend] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);
  const [openExtra, setOpenExtra] = useState<string | null>(null);
  const [resolution, setResolution] = useState<FpsResolution>("1440p");
  const isSmall = useIsSmall();
  const [show3d, setShow3d] = useState(false);
  const [, startTransition] = useTransition();
  const [hoverSlot, setHoverSlot] = useState<Slot | null>(null);

  const resolved = useMemo(() => resolveBuildSelection(selection), [selection]);
  // โหลดโค้ด 3D ล่วงหน้าตอนเครื่องว่าง → กด "ดูเคสแบบ 3D" แล้วขึ้นทันที
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const go = () => void import("./PcScene3D");
    if (w.requestIdleCallback) w.requestIdleCallback(go);
    else setTimeout(go, 1500);
  }, []);
  const maxGpus = maxGpuCount(resolved.motherboard);
  const gpuQty = resolved.gpu ? Math.min(gpuQtyRaw, maxGpus) : 1;
  const issues = useMemo(() => evaluateBuilderCompatibility(resolved, gpuQty), [resolved, gpuQty]);
  const watts = useMemo(() => calculateBuildTotals(resolved, gpuQty).estimatedWatts, [resolved, gpuQty]);
  const problems = useMemo(() => issues.filter((i) => i.status === "fail"), [issues]);
  const warnings = useMemo(() => issues.filter((i) => i.status === "warn"), [issues]);
  const fps = useMemo(() => estimateAllGamesFps(resolved, resolution, "high", true), [resolved, resolution]);
  const avgFps = fps.ready && fps.results.length ? Math.round(fps.results.reduce((s, r) => s + r.avgFps, 0) / fps.results.length) : null;

  const ramPacks = (part: PcPart | null) => (part ? ramQty : 0);
  const lines: CartInput[] = [];
  for (const { slot } of SLOTS) {
    const p = resolved[slot];
    if (!p) continue;
    const qty = slot === "ram" ? ramPacks(p) : slot === "storage" ? storageQty : slot === "gpu" ? gpuQty : 1;
    lines.push({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl ?? null, buyUrl: p.buyUrl, storeName: p.platform, quantity: qty });
  }
  if (resolved.monitor) {
    const m = resolved.monitor;
    lines.push({ id: m.id, name: m.name, price: m.price, imageUrl: m.imageUrl ?? null, buyUrl: m.buyUrl, storeName: m.platform });
  }
  for (const e of Object.values(extras)) lines.push({ id: e.id, name: e.name, price: e.price, imageUrl: null, buyUrl: e.buyUrl, storeName: e.platform });
  const total = lines.reduce((s, l) => s + l.price * (l.quantity ?? 1), 0);

  /** จำนวนปัญหาถ้าเปลี่ยนเป็นชิ้นนี้ — ใช้เตือนในรายการตัวเลือก (คำนวณครั้งเดียวต่อการเปิด sheet) */
  const optionIssues = useMemo(() => {
    const map = new Map<string, number>();
    if (!openSlot) return map;
    for (const p of PC_PARTS) {
      if (p.slot !== openSlot) continue;
      const r = resolveBuildSelection({ ...selection, [openSlot]: p.id });
      map.set(p.id, evaluateBuilderCompatibility(r, gpuQty).filter((i) => i.status === "fail").length);
    }
    return map;
  }, [openSlot, selection, gpuQty]);
  const issuesIf = (_slot: Slot, id: string) => optionIssues.get(id) ?? 0;

  function pick(slot: Slot, id: string) {
    haptic(8);
    setSelection((prev) => ({ ...prev, [slot]: id }));
    setOpenSlot(null);
  }

  function applyPreset(id: string) {
    const p = BUILDER_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setSelection({ ...DEFAULT_SELECTION, ...p.selection });
    setRamQty(1);
    setStorageQty(1);
    setGpuQty(1);
    toast(`ใช้สเปก “${p.label}” แล้ว`);
  }

  async function share() {
    const url = `${window.location.origin}/builder?b=${encodeBuildQuery(selection, { r: ramQty, s: storageQty, g: gpuQty, m: mountsRef.current ?? undefined, f: fanModel })}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "สเปกคอมของฉัน", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("คัดลอกลิงก์สเปกแล้ว");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast("แชร์ไม่สำเร็จ", { tone: "error" });
    }
  }

  const sheetOptions = useMemo(() => (openSlot ? PC_PARTS.filter((p) => p.slot === openSlot) : []), [openSlot]);
  const extraConfig = openExtra ? EXTRA_DOCK_SLOTS.find((d) => d.key === openExtra) ?? null : null;

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      {/* สเปกสำเร็จรูป */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <BeginnerChip />
        <button type="button" data-active={showRecommend} onClick={() => setShowRecommend((v) => !v)} className="chip shrink-0 rounded-full">
          <Sparkles className="h-3.5 w-3.5" /> ช่วยจัดสเปกให้
        </button>
        <button type="button" data-active={showUpgrade} onClick={() => setShowUpgrade((v) => !v)} className="chip shrink-0 rounded-full">
          <TrendingUp className="h-3.5 w-3.5" /> อัปเกรดเครื่องเดิม
        </button>
        {BUILDER_PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => applyPreset(p.id)} className="chip shrink-0 rounded-full" title={p.subtitle}>
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setSelection({ ...DEFAULT_SELECTION });
            setExtras({});
            setRamQty(1);
            setStorageQty(1);
            setGpuQty(1);
          }}
          className="chip shrink-0 rounded-full"
          aria-label="เริ่มใหม่"
        >
          <RotateCcw className="h-3.5 w-3.5" /> เริ่มใหม่
        </button>
        <PostToCommunity kind="build" selection={selection} className="chip shrink-0 rounded-full" />
      </div>

      <BeginnerMode
        onApply={(r) => {
          setSelection({ ...DEFAULT_SELECTION, ...r.selection, monitor: selection.monitor });
          setRamQty(1);
          setStorageQty(1);
          setGpuQty(1);
          toast(`จัดสเปกให้แล้ว ${formatTHB(r.total)}`);
        }}
      />

      {showUpgrade && (
        <UpgradePanel
          selection={selection}
          onClose={() => setShowUpgrade(false)}
          onApply={(o) => {
            const next = { ...selection };
            for (const c of o.changes) next[c.slot] = c.to.id;
            setSelection(next);
            toast(`ใส่ชิ้นอัปเกรดแล้ว · จ่ายเพิ่ม ${formatTHB(o.cost)}`);
          }}
        />
      )}

      {showRecommend && (
        <RecommendPanel
          onClose={() => setShowRecommend(false)}
          onApply={(r) => {
            setSelection({ ...DEFAULT_SELECTION, ...r.selection, monitor: selection.monitor });
            setRamQty(1);
            setStorageQty(1);
            setGpuQty(1);
            setShowRecommend(false);
            toast(`จัดสเปกให้แล้ว ${formatTHB(r.total)} · FPS เฉลี่ย ~${r.avgFps}`);
          }}
        />
      )}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* ฉาก 3D */}
        <section className="min-w-0 lg:sticky lg:top-24 lg:col-span-7">
          <div className="overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-b from-ink-50 to-surface">
            {isSmall && !show3d ? (
              <button type="button" onClick={() => setShow3d(true)} className="relative flex h-[300px] w-full flex-col items-center justify-center gap-3">
                <div className="grid grid-cols-3 gap-2 opacity-90">
                  {(["case", "gpu", "cpu"] as const).map((s) => {
                    const p = resolved[s];
                    const src = p ? partImage(p) : "";
                    return (
                      <span key={s} className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface p-2 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {src ? <img src={src} alt="" className="max-h-full max-w-full object-contain" loading="lazy" decoding="async" width={64} height={64} /> : null}
                      </span>
                    );
                  })}
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-info px-4 py-2 text-sm font-semibold text-white shadow">
                  <Box className="h-4 w-4" /> ดูเคสแบบ 3D
                </span>
              </button>
            ) : (
              <div className="group/stage relative">
                <PcScene3D
                  build={resolved}
                  ramQty={Math.min(4, ramQty * (resolved.ram?.specs.modules ?? 2))}
                  gpuQty={gpuQty}
                  mountConfig={initialMounts}
                  onMountsChange={(m) => {
                    mountsRef.current = m;
                  }}
                  fanModel={fanModel}
                  onFanModelChange={setFanModel}
                  storageQty={storageQty}
                  hddCount={extras.hdd ? 1 : 0}
                  sataSsdCount={extras.sata_ssd ? 1 : 0}
                  compactStage={isSmall}
                  selectedSlot={hoverSlot ?? openSlot}
                  onPickSlot={(slot) => SLOTS.some((x) => x.slot === slot) && setOpenSlot(slot as Slot)}
                  labels={Object.fromEntries(SLOTS.map(({ slot }) => [slot, resolved[slot]?.name ?? ""]))}
                  games={fps.results.map((r) => ({ title: r.game.title, fps: r.avgFps, low: r.low1PercentFps }))}
                />
              </div>
            )}
          </div>

          {/* สรุปสั้น (เดสก์ท็อป) */}
          <div className="mt-4 hidden grid-cols-3 gap-3 lg:grid">
            <Stat icon={Gauge} label={`FPS เฉลี่ย ${resolution}`} value={avgFps ? `~${avgFps}` : "—"} />
            <Stat
              icon={problems.length ? TriangleAlert : BadgeCheck}
              tone={problems.length ? "bad" : warnings.length ? "warn" : "ok"}
              label="ความเข้ากันได้"
              value={problems.length ? `${problems.length} จุดไม่เข้ากัน` : warnings.length ? `ควรเช็ก ${warnings.length} จุด` : "เข้ากันทั้งหมด"}
            />
            <Stat icon={PlugZap} label="กินไฟประมาณ" value={`${watts}W`} />
          </div>
        </section>

        {/* รายการชิ้นส่วน */}
        <section className="min-w-0 space-y-4 lg:col-span-5">
          {/* สถานะบนมือถือ */}
          <div className="flex gap-2 lg:hidden">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${problems.length ? "bg-bad-bg text-bad" : "bg-ok-bg text-ok"}`}>
              {problems.length ? <TriangleAlert className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
              {problems.length ? `${problems.length} จุดไม่เข้ากัน` : "เข้ากันทั้งหมด"}
            </span>
            {avgFps && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-3 py-1.5 text-xs font-semibold text-info">
                <Gauge className="h-3.5 w-3.5" /> ~{avgFps} FPS
              </span>
            )}
          </div>

          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200 bg-surface">
            {SLOTS.map(({ slot, label, icon: Icon }) => {
              const p = resolved[slot];
              const bad = problems.some((i) => i.title.toLowerCase().includes(label.toLowerCase()));
              return (
                <li key={slot}>
                  <button
                    type="button"
                    onClick={() => setOpenSlot(slot)}
                    onMouseEnter={() => setHoverSlot(slot)}
                    onMouseLeave={() => setHoverSlot(null)}
                    onFocus={() => setHoverSlot(slot)}
                    onBlur={() => setHoverSlot(null)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-ink-50"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-media">
                      {p && partImage(p) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={partImage(p)} alt="" className="max-h-full max-w-full object-contain p-1" loading="lazy" decoding="async" width={64} height={64} />
                      ) : (
                        <Icon className="h-5 w-5 text-ink-400" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-500">
                        {label}
                        {bad && <TriangleAlert className="h-3 w-3 text-bad" />}
                      </span>
                      <span className="block truncate text-sm font-semibold text-ink-950">{p ? p.name : "ยังไม่ได้เลือก"}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold text-ink-950">{p ? formatTHB(p.price) : ""}</span>
                      {slot === "ram" && ramQty > 1 && <span className="text-[11px] text-ink-500">×{ramQty}</span>}
                      {slot === "storage" && storageQty > 1 && <span className="text-[11px] text-ink-500">×{storageQty}</span>}
                      {slot === "gpu" && gpuQty > 1 && <span className="text-[11px] text-ink-500">×{gpuQty}</span>}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
                  </button>
                </li>
              );
            })}
            {resolved.monitor && (
              <li className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-50">
                  <Monitor className="h-5 w-5 text-ink-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[11px] font-medium text-ink-500">จอ</span>
                  <span className="block truncate text-sm font-semibold text-ink-950">{resolved.monitor.name}</span>
                </span>
                <span className="text-sm font-bold text-ink-950">{formatTHB(resolved.monitor.price)}</span>
                <button type="button" aria-label="เอาจอออก" onClick={() => setSelection(({ monitor: _m, ...rest }) => (void _m, rest))} className="icon-btn h-9 w-9 border-transparent p-0">
                  <X className="h-4 w-4" />
                </button>
              </li>
            )}
          </ul>

          {/* ของเสริม */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-500">ของเสริม</p>
            <div className="flex flex-wrap gap-1.5">
              {EXTRA_DOCK_SLOTS.filter((d) => !d.linkedSlot).map((d) => (
                <button key={d.key} type="button" data-active={!!extras[d.key]} onClick={() => setOpenExtra(d.key)} className="chip rounded-full">
                  {extras[d.key] ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {d.labelTh}
                </button>
              ))}
            </div>
          </div>

          {/* รายละเอียด (พับไว้) */}
          <Fold title="ความเข้ากันได้" badge={problems.length ? `${problems.length} จุด` : "ผ่าน"} tone={problems.length ? "bad" : "ok"}>
            <ul className="space-y-1.5">
              {issues.map((i) => (
                <li key={i.id} className="flex items-start gap-2 text-sm" title={i.detail}>
                  {i.status === "pass" ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                  ) : (
                    <TriangleAlert className={`mt-0.5 h-4 w-4 shrink-0 ${i.status === "fail" ? "text-bad" : "text-warn"}`} />
                  )}
                  <span className="min-w-0">
                    <span className="text-ink-900">{i.title}</span>
                    {i.status !== "pass" && <span className="block text-xs text-ink-500">{i.detail}</span>}
                    {i.status !== "pass" &&
                      (() => {
                        const h = explainIssue(i);
                        return h ? (
                          <span className="mt-0.5 block text-xs text-ink-700">
                            <span className="font-semibold">ทำไม:</span> {h.why} <span className="font-semibold">แก้ยังไง:</span> {h.fix}
                          </span>
                        ) : null;
                      })()}
                  </span>
                </li>
              ))}
            </ul>
          </Fold>

          <Fold title="FPS โดยประมาณ" badge={avgFps ? `~${avgFps}` : "—"}>
            <div className="mb-3 flex gap-1.5">
              {(["1080p", "1440p", "4K"] as const).map((r) => (
                <button key={r} type="button" data-active={resolution === r} onClick={() => startTransition(() => setResolution(r))} className="chip rounded-full">
                  {r}
                </button>
              ))}
            </div>
            {fps.ready ? (
              <ul className="space-y-2">
                {fps.results.map((r) => (
                  <li key={r.game.id} className="text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="truncate text-ink-800">{r.game.title}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-ink-950">{r.avgFps}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(100, (r.avgFps / 240) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-600">{fps.reason}</p>
            )}
            <p className="mt-3 text-[11px] text-ink-500">ค่าประมาณที่กราฟิก High + upscaling ไม่ใช่ผลทดสอบจริง · ถ้า FPS ต่ำผิดปกติอาจเป็น <JargonTip term="bottleneck">bottleneck</JargonTip></p>
          </Fold>

          {/* แถบสรุป + ปุ่ม (เดสก์ท็อป) */}
          <div className="hidden items-center gap-2 rounded-2xl border border-ink-200 bg-surface p-3 lg:flex">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-500">รวม {lines.length} รายการ</p>
              <p className="font-display text-2xl font-bold text-ink-950"><AnimatedTHB value={total} /></p>
            </div>
            <IconAction label="แชร์" onClick={share} icon={Share2} />
            <IconAction label="บันทึก" onClick={() => (savePcBuild("", selection), toast("บันทึกสเปกแล้ว"))} icon={Bookmark} />
            <AddToCartButton item={lines} label="ใส่ตะกร้า" className="h-11 px-5" />
          </div>
        </section>
      </div>

      {/* แถบล่างบนมือถือ */}
      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t border-ink-200 bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold leading-tight text-ink-950"><AnimatedTHB value={total} /></p>
            <p className="text-[11px] text-ink-500">{lines.length} รายการ · {watts}W</p>
          </div>
          <IconAction label="แชร์" onClick={share} icon={Share2} />
          <AddToCartButton item={lines} label="ใส่ตะกร้า" className="h-11 px-4" />
        </div>
      </div>

      {/* เลือกชิ้นส่วน */}
      {openSlot && (
        <Sheet title={`เลือก${SLOTS.find((s) => s.slot === openSlot)?.label}`} onClose={() => setOpenSlot(null)}>
          {(openSlot === "ram" || openSlot === "storage") && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2">
              <span className="text-sm text-ink-700">{openSlot === "ram" ? "จำนวนชุด" : "จำนวนตัว"}</span>
              <Stepper value={openSlot === "ram" ? ramQty : storageQty} onChange={openSlot === "ram" ? setRamQty : setStorageQty} max={openSlot === "ram" ? 2 : 4} />
            </div>
          )}
          {openSlot === "gpu" && (
            <div className="mb-3 rounded-xl bg-ink-50 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-700">จำนวนการ์ดจอ</span>
                <Stepper value={gpuQty} onChange={setGpuQty} max={maxGpus} />
              </div>
              <p className="mt-1 text-[11px] text-ink-600">
                {resolved.motherboard ? <>บอร์ดนี้มีช่อง <JargonTip term="pcie">PCIe</JargonTip> x16 {maxGpus} ช่อง</> : "เลือกเมนบอร์ดก่อนเพื่อดูว่าใส่ได้กี่ใบ"}
                {gpuQty > 1 && " · เกมส่วนใหญ่ใช้การ์ดเดียว หลายใบเหมาะกับงานเรนเดอร์/AI"}
              </p>
            </div>
          )}
          <GuideBox slot={openSlot} />
          {SLOT_JARGON[openSlot] && (
            <p className="mb-3 text-xs text-ink-600">
              คำที่ควรรู้:{" "}
              {SLOT_JARGON[openSlot]!.map(([key, text], idx) => (
                <span key={key}>
                  {idx > 0 && " · "}
                  <JargonTip term={key}>{text}</JargonTip>
                </span>
              ))}
            </p>
          )}
          <ul className="space-y-2">
            {sheetOptions.map((p) => {
              const active = selection[openSlot] === p.id;
              const nIssues = active ? 0 : issuesIf(openSlot, p.id);
              const diff = p.price - (resolved[openSlot]?.price ?? 0);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(openSlot, p.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors ${active ? "border-info bg-info-bg" : "border-ink-200 bg-surface hover:border-ink-400"}`}
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {partImage(p) ? <img src={partImage(p)} alt="" className="max-h-full max-w-full object-contain p-1" loading="lazy" decoding="async" width={64} height={64} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold text-ink-950">{p.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-500">{shortSpec(p)}</span>
                      {goodForLine(p) && <span className="mt-0.5 block text-xs text-ink-700">{goodForLine(p)}</span>}
                      {nIssues > 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-bad">
                          <TriangleAlert className="h-3 w-3" /> ไม่เข้ากับชิ้นอื่น
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold text-ink-950">{formatTHB(p.price)}</span>
                      {!active && diff !== 0 && (
                        <span className={`text-[11px] font-semibold ${diff > 0 ? "text-ink-500" : "text-ok"}`}>
                          {diff > 0 ? "+" : "−"}
                          {formatTHB(Math.abs(diff))}
                        </span>
                      )}
                      {active && <Check className="ml-auto h-4 w-4 text-info" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
      )}

      {extraConfig && (
        <Sheet title={extraConfig.labelTh} onClose={() => setOpenExtra(null)}>
          <ul className="space-y-2">
            {extraConfig.options.map((o) => {
              const active = extras[extraConfig.key]?.id === o.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      haptic(8);
                      setExtras(({ [extraConfig.key]: _old, ...rest }) => (void _old, active ? rest : { ...rest, [extraConfig.key]: o }));
                      setOpenExtra(null);
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${active ? "border-info bg-info-bg" : "border-ink-200 bg-surface hover:border-ink-400"}`}
                  >
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink-950">{o.name}</span>
                    <span className="shrink-0 text-sm font-bold text-ink-950">{formatTHB(o.price)}</span>
                    {active ? <X className="h-4 w-4 text-ink-500" aria-label="เอาออก" /> : <Plus className="h-4 w-4 text-info" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Cpu; label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-info";
  return (
    <div className="rounded-2xl border border-ink-200 bg-surface p-3">
      <Icon className={`h-5 w-5 ${color}`} />
      <p className="mt-1.5 font-display text-lg font-bold text-ink-950">{value}</p>
      <p className="text-[11px] text-ink-500">{label}</p>
    </div>
  );
}

function IconAction({ icon: Icon, label, onClick }: { icon: typeof Cpu; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="icon-btn h-11 w-11 p-0">
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Fold({ title, badge, tone, children }: { title: string; badge?: string; tone?: "ok" | "bad"; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-ink-200 bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="font-semibold text-ink-950">{title}</span>
        <span className="flex items-center gap-2">
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone === "bad" ? "bg-bad-bg text-bad" : tone === "ok" ? "bg-ok-bg text-ok" : "bg-info-bg text-info"}`}>{badge}</span>
          )}
          <ChevronDown className="h-4 w-4 text-ink-500 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-ink-100 px-4 py-3">{children}</div>
    </details>
  );
}

function Stepper({ value, onChange, max }: { value: number; onChange: (n: number) => void; max: number }) {
  return (
    <span className="flex items-center gap-1">
      <button type="button" aria-label="ลด" disabled={value <= 1} onClick={() => onChange(value - 1)} className="icon-btn h-11 w-11 p-0">
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="w-6 text-center font-bold tabular-nums">{value}</span>
      <button type="button" aria-label="เพิ่ม" disabled={value >= max} onClick={() => onChange(value + 1)} className="icon-btn h-11 w-11 p-0">
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  );
}

/** แผ่นเลื่อนขึ้นจากล่าง (มือถือ) / กล่องกลางจอ (เดสก์ท็อป) */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onClose);
  return (
    <div ref={ref} className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-ink-950/50" />
      <div className="sheet relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <span className="mx-auto mb-1 block h-1 w-10 rounded-full bg-ink-200 sm:hidden" aria-hidden />
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="font-display text-lg font-bold text-ink-950">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="icon-btn h-11 w-11 border-transparent p-0">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
