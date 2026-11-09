"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Check,
  Download,
  ImageUp,
  LayoutTemplate,
  Loader2,
  PenTool,
  RotateCcw,
  ScanLine,
  Sparkles,
  X,
} from "lucide-react";
import { useFocusTrap } from "@/components/useFocusTrap";
import { toast } from "@/lib/toast";
import {
  normalizeShape,
  presetShape,
  scaleShape,
  shapeBounds,
  shapeMetrics,
  squareShape,
  type Pt2,
} from "@/lib/room-shape";
import { ROOM_LIMITS, type RoomSize } from "@/lib/room-planner";
import { saveShape, saveShapeToCloud } from "@/lib/room-shapes-store";
import { RoomPlanView, planToPng } from "./RoomPlanView";

const PRESET_ROOMS = [
  {
    id: "studio",
    name: "คอนโดสตูดิโอ (Studio 19 ตร.ม.)",
    w: 320,
    d: 600,
    kind: "rect" as const,
    desc: "กว้าง 3.20 × ลึก 6.00 ม. (ผังยาวคอนโด)",
  },
  {
    id: "1bed_l",
    name: "1 ห้องนอนตัว L (1-Bed L-Shape)",
    w: 420,
    d: 520,
    kind: "L" as const,
    desc: "กว้าง 4.20 × ลึก 5.20 ม. (มีมุมเว้าห้องครัว/ระเบียง)",
  },
  {
    id: "square",
    name: "ห้องนอนสี่เหลี่ยม (Master Bed)",
    w: 380,
    d: 380,
    kind: "rect" as const,
    desc: "กว้าง 3.80 × ลึก 3.80 ม. (14.4 ตร.ม.)",
  },
  {
    id: "desk_room",
    name: "ห้องทำงานคอม / สตรีมเมอร์",
    w: 320,
    d: 420,
    kind: "rect" as const,
    desc: "กว้าง 3.20 × ลึก 4.20 ม. (โต๊ะคอม + ชั้นวาง)",
  },
  {
    id: "1bed_lr",
    name: "ห้องตัว L กลับ (L-Reverse)",
    w: 450,
    d: 520,
    kind: "Lr" as const,
    desc: "กว้าง 4.50 × ลึก 5.20 ม. (เว้ามุมฝั่งขวา)",
  },
];

/**
 * วัดรูปห้องจริง → แปลน (แบบแอปวัดห้อง) → ห้อง 3D ตามรูปนั้น
 * 1) ใส่รูปแปลน (อัปโหลดรูปปุ๊บสร้างแปลนและห้อง 3D ให้ทันที)
 * 2) แปลนห้องสำเร็จรูป (Presets คอนโด/ห้องนอน/ตัว L)
 * 3) เดินวัดรอบห้องด้วย AR (Android Chrome)
 */
export function RoomShapeTool({
  room,
  onApply,
  onClose,
}: {
  room: RoomSize;
  onApply: (r: RoomSize) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"image" | "preset" | "ar">("image");
  const [arOk, setArOk] = useState<boolean | null>(null);
  const [raw, setRaw] = useState<Pt2[] | null>(null);
  const [h, setH] = useState(String(room.h / 100));
  const [name, setName] = useState("ห้องของฉัน");
  const [square, setSquare] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(boxRef, true, onClose);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr;
    if (!xr) return queueMicrotask(() => setArOk(false));
    xr.isSessionSupported("immersive-ar")
      .then((ok) => setArOk(ok))
      .catch(() => setArOk(false));
  }, []);

  const shape = useMemo(() => {
    const n = raw ? normalizeShape(raw) : null;
    return n ? (square ? squareShape(n) : n) : null;
  }, [raw, square]);
  const b = shape ? shapeBounds(shape) : null;
  const hCm = Math.round(Number(h.replace(",", ".")) * 100);
  const sizeErr = !b
    ? null
    : b.w < ROOM_LIMITS.min || b.d < ROOM_LIMITS.min
      ? "ห้องเล็กเกินไป (ด้านกว้าง/ลึกต้อง ≥ 1 ม.) — เช็กความยาวที่กรอก"
      : b.w > ROOM_LIMITS.max || b.d > ROOM_LIMITS.max
        ? "ห้องใหญ่เกิน 15 ม. — เช็กความยาวที่กรอก"
        : !(hCm >= ROOM_LIMITS.hMin && hCm <= ROOM_LIMITS.hMax)
          ? "ความสูงต้อง 2–4.5 ม."
          : null;

  async function savePng() {
    if (!svgRef.current) return;
    const blob = await planToPng(svgRef.current);
    if (!blob) return toast("บันทึกรูปไม่สำเร็จ", { tone: "error" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `แปลน-${name.trim() || "ห้อง"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function apply(customShape?: Pt2[] | null, customH?: number, customName?: string) {
    const targetShape = customShape ?? shape;
    if (!targetShape) return;
    const bounds = shapeBounds(targetShape);
    const finalH = customH ?? hCm;
    const nm = (customName ?? name).trim().slice(0, 40) || "ห้องของฉัน";

    saveShape({ name: nm, shape: targetShape, h: finalH });
    saveShapeToCloud({ name: nm, shape: targetShape, h: finalH });
    onApply({
      ...room,
      w: bounds.w,
      d: bounds.d,
      h: finalH,
      shape: targetShape,
    });
    toast(`สร้างห้อง 3D “${nm}” (${(bounds.w / 100).toFixed(2)}×${(bounds.d / 100).toFixed(2)} ม.) ตามแปลนแล้ว!`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="สร้างห้องตามแปลน"
    >
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div
        ref={boxRef}
        className="relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-bold text-ink-950">
              <PenTool className="h-5 w-5 text-info" /> สร้างห้องตามแบบแปลน
            </p>
            <p className="text-[11px] text-ink-600">ใส่รูปแปลนห้อง หรือเลือกแบบสำเร็จรูป เพื่อสร้างห้อง 3D ทันที</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="icon-btn h-10 w-10 border-transparent p-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!shape ? (
            <>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1" role="tablist">
                {(
                  [
                    ["image", "จากรูปแปลน", ImageUp],
                    ["preset", "แปลนสำเร็จรูป", LayoutTemplate],
                    ["ar", "เดินวัดรอบห้อง (AR)", ScanLine],
                  ] as const
                ).map(([k, label, Icon]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg text-xs font-semibold transition-all ${
                      tab === k ? "bg-white text-info shadow-xs" : "text-ink-700 hover:text-ink-950"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>

              {tab === "image" && (
                <PlanImage
                  onDone={(pts, autoName) => {
                    setRaw(pts);
                    if (autoName) setName(autoName);
                  }}
                  onInstantApply={(pts, autoName) => {
                    const norm = normalizeShape(pts);
                    apply(norm, hCm, autoName);
                  }}
                />
              )}

              {tab === "preset" && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-ink-700">เลือกแปลนห้องที่ใกล้เคียงห้องของคุณ (สร้างเป็น 3D ได้ทันที):</p>
                  <div className="space-y-2">
                    {PRESET_ROOMS.map((p) => {
                      const s = presetShape(p.kind, p.w, p.d);
                      const m = shapeMetrics(s);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-3 hover:border-info transition-all shadow-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs text-ink-950">{p.name}</p>
                            <p className="text-[11px] text-ink-600">{p.desc}</p>
                            <span className="mt-1 inline-block rounded bg-info-bg px-2 py-0.5 text-[10px] font-bold text-info">
                              {m.areaM2} ตร.ม. · {s.length} ด้าน
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setName(p.name);
                              setRaw(s);
                              apply(s, hCm, p.name);
                            }}
                            className="btn btn-primary h-9 rounded-full px-3.5 text-xs font-bold"
                          >
                            <Box className="h-3.5 w-3.5" /> ใช้แปลนนี้
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === "ar" && (
                <ArTrace
                  supported={arOk}
                  onDone={(r) => {
                    setRaw(r.points);
                    if (r.h) setH(String(r.h / 100));
                  }}
                />
              )}
            </>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
                <RoomPlanView ref={svgRef} shape={shape} name={name.trim() || "ห้องของฉัน"} className="block h-auto w-full" />
              </div>
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <label className="space-y-0.5">
                  <span className="block text-[11px] font-semibold text-ink-700">ชื่อห้อง</span>
                  <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="input h-10 w-full" />
                </label>
                <label className="space-y-0.5">
                  <span className="block text-[11px] font-semibold text-ink-700">สูง (ม.)</span>
                  <input
                    inputMode="decimal"
                    value={h}
                    onChange={(e) => setH(e.target.value.replace(/[^\d.,]/g, "").slice(0, 4))}
                    className="input h-10 w-full text-center"
                  />
                </label>
              </div>
              <label className="flex min-h-10 items-center gap-2 text-sm text-ink-800">
                <input
                  type="checkbox"
                  checked={square}
                  onChange={(e) => setSquare(e.target.checked)}
                  className="h-5 w-5 accent-[var(--color-info)]"
                />
                ทำมุมให้ตรง 90° (เข้ามุมฉากอัตโนมัติ)
              </label>
              <p className="text-xs text-ink-600">
                {shape.length} มุม · พื้นที่ {shapeMetrics(shape).areaM2} ตร.ม. · กว้างสุด {(b!.w / 100).toFixed(2)} × ลึกสุด{" "}
                {(b!.d / 100).toFixed(2)} ม.
              </p>
              {sizeErr && <p className="rounded-xl bg-bad-bg px-3 py-2 text-xs font-semibold text-bad">{sizeErr}</p>}
            </>
          )}
        </div>

        {shape && (
          <div className="grid grid-cols-2 gap-2 border-t border-ink-100 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => setRaw(null)} className="btn btn-outline h-11 rounded-full text-sm">
              <RotateCcw className="h-4 w-4" /> เลือกแปลนใหม่
            </button>
            <button type="button" onClick={savePng} className="btn btn-outline h-11 rounded-full text-sm">
              <Download className="h-4 w-4" /> บันทึกรูปแปลน
            </button>
            <button
              type="button"
              disabled={!!sizeErr}
              onClick={() => apply()}
              className="btn btn-primary col-span-2 h-12 rounded-full disabled:opacity-50 text-base font-bold shadow-md"
            >
              <Box className="h-4 w-4" /> สร้างห้อง 3D ตามแปลนนี้ทันที
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- 1) เดินวัดรอบห้องด้วย AR ---------------- */
function ArTrace({
  supported,
  onDone,
}: {
  supported: boolean | null;
  onDone: (r: { points: Pt2[]; h: number | null }) => void;
}) {
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setErr(null);
    setRunning(true);
    try {
      const { runArRoomTrace } = await import("./ar-room-trace");
      const r = await runArRoomTrace();
      if (r) onDone(r);
    } catch (e) {
      setErr((e as Error).message || "เปิด AR ไม่สำเร็จ");
    } finally {
      setRunning(false);
    }
  }

  if (supported === null)
    return (
      <p className="flex items-center gap-2 text-sm text-ink-600">
        <Loader2 className="h-4 w-4 animate-spin" /> กำลังเช็กว่าเครื่องนี้ใช้ AR ได้ไหม…
      </p>
    );

  if (!supported)
    return (
      <div className="space-y-2 rounded-2xl bg-ink-50 p-4 text-sm text-ink-700">
        <p className="font-semibold text-ink-950">ระบบ AR WebXR รองรับบนมือถือ Android + Chrome</p>
        <p>หากใช้ iPhone, คอมพิวเตอร์ หรือยังไม่สะดวกเดินวัด:</p>
        <p className="text-xs text-info font-medium">
          👉 แนะนำใช้แท็บ <b>“จากรูปแปลน”</b> (อัปโหลดรูปปุ๊บสร้างห้อง 3D ทันที) หรือแท็บ <b>“แปลนสำเร็จรูป”</b> ได้เลย
        </p>
      </div>
    );

  return (
    <div className="space-y-3 text-sm text-ink-700">
      <ol className="list-decimal space-y-1 pl-5">
        <li>เปิดไฟห้อง ส่องกล้องลงพื้นจนเห็นวงกลมเป้า</li>
        <li>
          เล็งเป้าที่ <b>มุมห้อง</b> (ตรงผนังชนพื้น) แตะจอ → เดินไปมุมถัดไป แตะ… วนรอบห้อง จะเห็นเส้นและความยาวทุกด้านสดๆ
        </li>
        <li>ครบทุกมุมแล้วเล็งกลับจุดแรก (เป้าเป็นสีเขียว) แตะ = ปิดรูปห้อง</li>
        <li>เงยกล้องเล็งฝ้าเหนือจุดแรก แตะ = ได้ความสูง (ข้ามได้)</li>
      </ol>
      <button type="button" onClick={start} disabled={running} className="btn btn-primary h-12 w-full rounded-full disabled:opacity-60">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} เริ่มเดินวัดห้อง
      </button>
      <p className="text-xs text-ink-500">มุมที่มีของบัง: แตะที่พื้นตรงแนวผนังให้ใกล้มุมที่สุด ระบบทำมุมฉากให้ภายหลังได้</p>
      {err && <p className="rounded-xl bg-bad-bg px-3 py-2 text-xs font-semibold text-bad">{err}</p>}
    </div>
  );
}

/* ---------------- 2) จากรูปแปลน: อัปโหลดรูปปุ๊บ จับกรอบแปลนและสร้างห้อง 3D ให้ทันที ---------------- */
function PlanImage({
  onDone,
  onInstantApply,
}: {
  onDone: (raw: Pt2[], name?: string) => void;
  onInstantApply?: (raw: Pt2[], name?: string) => void;
}) {
  const [img, setImg] = useState<string | null>(null);
  const [pts, setPts] = useState<Pt2[]>([]);
  const [closed, setClosed] = useState(true);
  const [side, setSide] = useState(0);
  const [len, setLen] = useState("4.00");
  const imgRef = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState({ w: 800, h: 600 });
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const at = (e: React.PointerEvent): Pt2 => {
    const el = imgRef.current;
    if (!el) return [0, 0];
    const r = el.getBoundingClientRect();
    return [
      Math.max(0, Math.min(el.naturalWidth, ((e.clientX - r.left) / r.width) * el.naturalWidth)),
      Math.max(0, Math.min(el.naturalHeight, ((e.clientY - r.top) / r.height) * el.naturalHeight)),
    ];
  };

  const pxLen = (i: number) => {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
  };

  const realCm = Math.max(100, Math.round(Number(len.replace(",", ".")) * 100) || 400);
  const validScale = closed && pts.length >= 3 && pxLen(side) > 2;

  function initDefaultCorners(w: number, h: number) {
    const padX = Math.round(w * 0.12);
    const padY = Math.round(h * 0.12);
    const defaultCorners: Pt2[] = [
      [padX, padY],
      [w - padX, padY],
      [w - padX, h - padY],
      [padX, h - padY],
    ];
    setPts(defaultCorners);
    setClosed(true);
    setSide(0);
    const ratio = w / (h || 1);
    const estimatedW = ratio >= 1.2 ? "4.50" : ratio >= 0.9 ? "4.00" : "3.50";
    setLen(estimatedW);
  }

  function handleAddLCorner() {
    if (pts.length < 4) return;
    const [p0, p1, p2, p3] = pts;
    const midX = (p1[0] + p2[0]) / 2;
    const midY = (p1[1] + p2[1]) / 2;
    const innerX = (p0[0] + midX) / 2;
    const innerY = (midY + p2[1]) / 2;
    setPts([p0, p1, [midX, midY], [innerX, innerY], [innerX, p3[1]], p3]);
    toast("เพิ่มมุมเว้าตัว L เรียบร้อย ลากจุดปรับตำแหน่งได้เลย");
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!pts.length) return;
    const p = at(e);
    const nearDist = nat.w / 18;
    const idx = pts.findIndex((pt) => Math.hypot(pt[0] - p[0], pt[1] - p[1]) < nearDist);
    if (idx !== -1) {
      setDragIdx(idx);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragIdx === null || !pts.length) return;
    const p = at(e);
    setPts((curr) => {
      const next = [...curr];
      next[dragIdx] = p;
      return next;
    });
  }

  function handlePointerUp() {
    setDragIdx(null);
  }

  if (!img)
    return (
      <div className="space-y-3 text-sm text-ink-700">
        <div className="rounded-2xl border border-info/30 bg-info-bg/50 p-4 space-y-2">
          <p className="font-bold text-ink-950 flex items-center gap-1.5 text-info">
            <Sparkles className="h-4 w-4" /> พอใส่รูปแปลนห้อง ระบบสร้างห้อง 3D ให้ทันที!
          </p>
          <p className="text-xs text-ink-700 leading-relaxed">
            เลือกรูปแปลนห้องคอนโด / บ้าน / ภาพสเก็ตช์ ระบบจะวางกรอบแปลนและขนาดให้อัตโนมัติ สามารถกดสร้างห้อง 3D ได้ทันทีในคลิกเดียว
          </p>
        </div>
        <label className="btn btn-primary h-14 w-full cursor-pointer rounded-2xl text-base font-bold shadow-md">
          <ImageUp className="h-5 w-5" /> เลือกรูปแปลนห้อง (รูปถ่าย / ภาพแคป / PDF แปลน)
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setImg(URL.createObjectURL(f));
            }}
          />
        </label>
        <p className="text-center text-[11px] text-ink-500">รองรับไฟล์ JPG, PNG, WebP ทุกขนาดภาพ</p>
      </div>
    );

  const poly = pts.map((p) => p.join(",")).join(" ");
  const sw = Math.max(2, nat.w / 180);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-ok flex items-center gap-1">
          <Check className="h-3.5 w-3.5" /> ตรวจพบรูปทรงห้องแล้ว (แตะลากจุดมุมเพื่อปรับขอบผนังได้)
        </p>
        <button
          type="button"
          onClick={handleAddLCorner}
          className="btn btn-outline h-7 px-2.5 rounded-full text-[11px] font-semibold text-info"
        >
          + เพิ่มมุมเว้า (ตัว L)
        </button>
      </div>

      <div
        className="relative touch-none select-none overflow-hidden rounded-2xl border border-ink-200 bg-black/5"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={img}
          alt="รูปแปลนห้อง"
          className="block h-auto w-full max-h-[45vh] object-contain mx-auto"
          draggable={false}
          onLoad={(e) => {
            const w = e.currentTarget.naturalWidth || 800;
            const h = e.currentTarget.naturalHeight || 600;
            setNat({ w, h });
            initDefaultCorners(w, h);
          }}
        />

        <svg viewBox={`0 0 ${nat.w} ${nat.h}`} className="pointer-events-none absolute inset-0 h-full w-full">
          {pts.length >= 3 && <polygon points={poly} fill="rgba(0,80,255,0.18)" stroke="#0050ff" strokeWidth={sw * 1.5} />}
          {pts.length > 1 && (
            <line
              x1={pts[side][0]}
              y1={pts[side][1]}
              x2={pts[(side + 1) % pts.length][0]}
              y2={pts[(side + 1) % pts.length][1]}
              stroke="#f59e0b"
              strokeWidth={sw * 2.8}
            />
          )}
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r={sw * 3.8} fill={i === side ? "#f59e0b" : "#0050ff"} stroke="#fff" strokeWidth={sw * 1.2} />
              <text x={p[0] + sw * 5} y={p[1] - sw * 5} fontSize={sw * 10} fill="#0a2540" fontWeight={800} stroke="#fff" strokeWidth={sw * 0.8}>
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="space-y-2 rounded-2xl border border-ink-200 bg-ink-50/70 p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="block text-[11px] font-semibold text-ink-700">ด้านอ้างอิง (เส้นสีส้ม)</span>
            <select value={side} onChange={(e) => setSide(Number(e.target.value))} className="input h-10 w-full text-xs font-semibold">
              {pts.map((_, i) => (
                <option key={i} value={i}>
                  ผนังมุม {i + 1} → {((i + 1) % pts.length) + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-0.5">
            <span className="block text-[11px] font-semibold text-ink-700">ความยาวจริงด้านนี้ (ม.)</span>
            <input
              inputMode="decimal"
              value={len}
              onChange={(e) => setLen(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
              className="input h-10 w-full text-center font-bold text-info"
            />
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setImg(null)}
            className="btn btn-outline h-11 flex-1 rounded-full text-xs"
          >
            เปลี่ยนรูปแปลน
          </button>
          <button
            type="button"
            disabled={!validScale}
            onClick={() => {
              const scaled = scaleShape(pts, realCm / pxLen(side));
              if (onInstantApply) onInstantApply(scaled, "ห้องตามแปลน");
              else onDone(scaled, "ห้องตามแปลน");
            }}
            className="btn btn-primary h-11 flex-[2] rounded-full text-sm font-bold shadow-md"
          >
            <Sparkles className="h-4 w-4" /> สร้างห้อง 3D ตามแปลนนี้เลย!
          </button>
        </div>
      </div>
    </div>
  );
}
