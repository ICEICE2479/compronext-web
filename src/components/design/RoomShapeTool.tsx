"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Check, Download, ImageUp, Loader2, PenTool, RotateCcw, ScanLine, Undo2, X } from "lucide-react";
import { useFocusTrap } from "@/components/useFocusTrap";
import { toast } from "@/lib/toast";
import { normalizeShape, scaleShape, shapeBounds, shapeMetrics, squareShape, type Pt2 } from "@/lib/room-shape";
import { ROOM_LIMITS, type RoomSize } from "@/lib/room-planner";
import { saveShape } from "@/lib/room-shapes-store";
import { RoomPlanView, planToPng } from "./RoomPlanView";

/**
 * วัดรูปห้องจริง → แปลน (แบบแอปวัดห้อง) → ห้อง 3D ตามรูปนั้น
 * 1) เดินวัดรอบห้องด้วย AR (Android Chrome) · 2) ใส่รูปแปลน (จากแอปอื่น/วาดมือ) แตะมุม + บอกความยาว 1 ด้าน
 */
export function RoomShapeTool({ room, onApply, onClose }: { room: RoomSize; onApply: (r: RoomSize) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"ar" | "image">("image");
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
      .then((ok) => {
        setArOk(ok);
        if (ok) setTab("ar");
      })
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
  function apply() {
    if (!shape || !b || sizeErr) return;
    const nm = name.trim().slice(0, 40) || "ห้องของฉัน";
    saveShape({ name: nm, shape, h: hCm });
    onApply({ ...room, w: b.w, d: b.d, h: hCm, shape });
    toast(`สร้างห้อง 3D “${nm}” ตามแปลนแล้ว`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="วัดรูปห้อง">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div ref={boxRef} className="relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <p className="flex items-center gap-2 font-display text-lg font-bold text-ink-950">
            <PenTool className="h-5 w-5 text-info" /> วัดรูปห้องจริง
          </p>
          <button type="button" onClick={onClose} aria-label="ปิด" className="icon-btn h-10 w-10 border-transparent p-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!shape ? (
            <>
              <div className="flex gap-1" role="tablist">
                {(
                  [
                    ["ar", "เดินวัดรอบห้อง (AR)", ScanLine],
                    ["image", "จากรูปแปลน", ImageUp],
                  ] as const
                ).map(([k, label, Icon]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold ${tab === k ? "bg-info text-white" : "bg-ink-100 text-ink-700"}`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
              {tab === "ar" ? (
                <ArTrace
                  supported={arOk}
                  onDone={(r) => {
                    setRaw(r.points);
                    if (r.h) setH(String(r.h / 100));
                  }}
                />
              ) : (
                <PlanImage onDone={setRaw} />
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
                  <input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value.replace(/[^\d.,]/g, "").slice(0, 4))} className="input h-10 w-full text-center" />
                </label>
              </div>
              <label className="flex min-h-10 items-center gap-2 text-sm text-ink-800">
                <input type="checkbox" checked={square} onChange={(e) => setSquare(e.target.checked)} className="h-5 w-5 accent-[var(--color-info)]" />
                ทำมุมให้ตรง 90° (แก้มือแตะเบี้ยวนิดหน่อย)
              </label>
              <p className="text-xs text-ink-600">
                {shape.length} มุม · พื้นที่ {shapeMetrics(shape).areaM2} ตร.ม. · กว้างสุด {(b!.w / 100).toFixed(2)} × ลึกสุด {(b!.d / 100).toFixed(2)} ม.
              </p>
              {sizeErr && <p className="rounded-xl bg-bad-bg px-3 py-2 text-xs font-semibold text-bad">{sizeErr}</p>}
            </>
          )}
        </div>

        {shape && (
          <div className="grid grid-cols-2 gap-2 border-t border-ink-100 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => setRaw(null)} className="btn btn-outline h-11 rounded-full text-sm">
              <RotateCcw className="h-4 w-4" /> วัดใหม่
            </button>
            <button type="button" onClick={savePng} className="btn btn-outline h-11 rounded-full text-sm">
              <Download className="h-4 w-4" /> บันทึกรูปแปลน
            </button>
            <button type="button" disabled={!!sizeErr} onClick={apply} className="btn btn-primary col-span-2 h-12 rounded-full disabled:opacity-50">
              <Box className="h-4 w-4" /> สร้างห้อง 3D ตามแปลนนี้
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- 1) เดินวัดรอบห้องด้วย AR ---------------- */
function ArTrace({ supported, onDone }: { supported: boolean | null; onDone: (r: { points: Pt2[]; h: number | null }) => void }) {
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
        <p className="font-semibold text-ink-950">เครื่องนี้ยังเดินวัดด้วย AR บนเว็บไม่ได้</p>
        <p>ใช้ได้กับมือถือ Android + Chrome (รองรับ ARCore)</p>
        <p>
          iPhone: วัดด้วยแอปวัดห้องที่ได้รูปแปลน (เช่น แอป “วัดขนาด” ร่วมกับแอปทำแปลน) แล้วใช้แท็บ <b>จากรูปแปลน</b> ได้เลย
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

/* ---------------- 2) จากรูปแปลน: แตะมุม + บอกความยาวจริง 1 ด้าน ---------------- */
function PlanImage({ onDone }: { onDone: (raw: Pt2[]) => void }) {
  const [img, setImg] = useState<string | null>(null);
  const [pts, setPts] = useState<Pt2[]>([]);
  const [closed, setClosed] = useState(false);
  const [side, setSide] = useState(0);
  const [len, setLen] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState({ w: 1, h: 1 });

  const at = (e: React.PointerEvent): Pt2 => {
    const el = imgRef.current!;
    const r = el.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * el.naturalWidth, ((e.clientY - r.top) / r.height) * el.naturalHeight];
  };
  const near = nat.w / 25;
  function tap(e: React.PointerEvent) {
    if (!imgRef.current || closed) return;
    const p = at(e);
    if (pts.length >= 3 && Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) < near) return setClosed(true);
    setPts((a) => [...a, p]);
  }
  const pxLen = (i: number) => {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
  };
  const realCm = Math.round(Number(len.replace(",", ".")) * 100);
  const ok = closed && pts.length >= 3 && realCm > 0 && pxLen(side) > 2;

  if (!img)
    return (
      <div className="space-y-3 text-sm text-ink-700">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>ใส่รูปแปลนห้อง — จากแอปวัดห้อง, แคปหน้าจอ, หรือวาดบนกระดาษแล้วถ่ายตรงๆ จากด้านบน</li>
          <li>แตะมุมห้องไล่ไปทีละมุม แล้วแตะจุดแรกอีกครั้งเพื่อปิดรูป</li>
          <li>บอกความยาวจริงของด้านใดด้านหนึ่ง (ดูจากตัวเลขในรูป) → ระบบคำนวณด้านที่เหลือให้</li>
        </ol>
        <label className="btn btn-primary h-12 w-full cursor-pointer rounded-full">
          <ImageUp className="h-4 w-4" /> เลือกรูปแปลน / ถ่ายรูป
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setImg(URL.createObjectURL(f));
              setPts([]);
              setClosed(false);
            }}
          />
        </label>
      </div>
    );

  const poly = pts.map((p) => p.join(",")).join(" ");
  const sw = nat.w / 200;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-ink-700">{closed ? "ปิดรูปแล้ว ✓ กรอกความยาวจริงด้านล่าง" : pts.length < 3 ? `แตะมุมห้องทีละมุม (${pts.length} มุม)` : "แตะมุมต่อ หรือแตะจุดแรก (สีเขียว) เพื่อปิดรูป"}</p>
      <div className="relative touch-none select-none overflow-hidden rounded-xl border border-ink-200 bg-white" onPointerDown={tap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={img} alt="รูปแปลนห้อง" className="block h-auto w-full" draggable={false} onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        <svg viewBox={`0 0 ${nat.w} ${nat.h}`} className="pointer-events-none absolute inset-0 h-full w-full">
          {closed ? <polygon points={poly} fill="rgba(37,99,235,.12)" stroke="#2563eb" strokeWidth={sw} /> : <polyline points={poly} fill="none" stroke="#2563eb" strokeWidth={sw} />}
          {closed && pts.length > 1 && (
            <line x1={pts[side][0]} y1={pts[side][1]} x2={pts[(side + 1) % pts.length][0]} y2={pts[(side + 1) % pts.length][1]} stroke="#f59e0b" strokeWidth={sw * 2.2} />
          )}
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r={sw * 3.2} fill={i === 0 && !closed && pts.length >= 3 ? "#22c55e" : "#2563eb"} stroke="#fff" strokeWidth={sw} />
              <text x={p[0] + sw * 4} y={p[1] - sw * 4} fontSize={sw * 9} fill="#1d4ed8" fontWeight={700}>
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!pts.length}
          onClick={() => {
            if (closed) setClosed(false);
            else setPts((a) => a.slice(0, -1));
          }}
          className="btn btn-outline h-10 flex-1 rounded-full text-sm disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" /> ย้อน
        </button>
        {!closed && (
          <button type="button" disabled={pts.length < 3} onClick={() => setClosed(true)} className="btn btn-outline h-10 flex-1 rounded-full text-sm disabled:opacity-40">
            ปิดรูปห้อง
          </button>
        )}
        <button type="button" onClick={() => setImg(null)} className="btn btn-outline h-10 rounded-full px-3 text-sm">
          เปลี่ยนรูป
        </button>
      </div>
      {closed && (
        <div className="space-y-2 rounded-xl border border-ink-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-0.5">
              <span className="block text-[11px] font-semibold text-ink-700">ด้านที่รู้ความยาว (เส้นส้ม)</span>
              <select value={side} onChange={(e) => setSide(Number(e.target.value))} className="input h-10 w-full">
                {pts.map((_, i) => (
                  <option key={i} value={i}>
                    มุม {i + 1} → {((i + 1) % pts.length) + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-0.5">
              <span className="block text-[11px] font-semibold text-ink-700">ยาวจริง (ม.)</span>
              <input inputMode="decimal" placeholder="เช่น 1.06" value={len} onChange={(e) => setLen(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))} className="input h-10 w-full text-center" />
            </label>
          </div>
          <button type="button" disabled={!ok} onClick={() => onDone(scaleShape(pts, realCm / pxLen(side)))} className="btn btn-primary h-11 w-full rounded-full disabled:opacity-50">
            <Check className="h-4 w-4" /> ได้แปลนห้อง
          </button>
        </div>
      )}
    </div>
  );
}
