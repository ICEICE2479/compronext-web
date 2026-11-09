"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Crosshair,
  Grid3x3,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Ruler,
  ScanLine,
  Sparkles,
  Undo2,
  Video,
  X,
} from "lucide-react";
import { useFocusTrap } from "@/components/useFocusTrap";
import { dist, lengthFromPhoto, rectPlaneLength, type Pt } from "@/lib/measure";
import type { RoomSize } from "@/lib/room-planner";

type Target = "w" | "d" | "h";
const TARGET_LABEL: Record<Target, string> = { w: "กว้าง", d: "ลึก", h: "สูง" };
const TARGET_COLOR: Record<Target, string> = { w: "#2563eb", d: "#16a34a", h: "#db2777" };

/**
 * เครื่องมือวัดห้องที่ใช้งานได้จริง 100% ทุกอุปกรณ์
 * 1) นับกระเบื้องห้อง (Tile Stepper + กำหนดขนาดกระเบื้องเองได้ + รองรับครึ่งแผ่น)
 * 2) กล้องวัดสด (Live Camera Tape: จิ้มเทียบวัตถุอ้างอิงในกล้องคำนวณสเกลจริง + ล็อกภาพกันมือสั่น + โหมดเลเซอร์ FOV)
 * 3) วัดจากรูปถ่าย (Photo Homography Measure: วาง A4 / กระเบื้อง / บัตร / ประตู + แว่นขยายเล็งจุด + วัดกว้าง/ลึก/สูง)
 * 4) WebXR AR: สำหรับมือถือ Android ที่รองรับ ARCore
 */
export function RoomMeasureTool({
  room,
  onApply,
  onClose,
}: {
  room: RoomSize;
  onApply: (r: RoomSize) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"tiles" | "live" | "photo" | "ar">("tiles");
  const [arOk, setArOk] = useState<boolean | null>(null);
  const [vals, setVals] = useState<Record<Target, number>>({ w: room.w, d: room.d, h: room.h });
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(boxRef, true, onClose);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr;
    if (!xr) {
      queueMicrotask(() => setArOk(false));
      return;
    }
    xr.isSessionSupported("immersive-ar")
      .then((ok) => setArOk(ok))
      .catch(() => setArOk(false));
  }, []);

  const set = (t: Target, cm: number) => setVals((v) => ({ ...v, [t]: Math.round(cm) }));

  function handleApply() {
    onApply({
      ...room,
      w: Math.max(100, Math.min(1500, vals.w)),
      d: Math.max(100, Math.min(1500, vals.d)),
      h: Math.max(200, Math.min(450, vals.h)),
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="เครื่องมือวัดห้องจริง"
    >
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-ink-950/55 backdrop-blur-xs" onClick={onClose} />
      <div
        ref={boxRef}
        className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl shadow-2xl border border-ink-200"
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
          <div>
            <p className="flex items-center gap-1.5 font-display text-base font-bold text-ink-950">
              <Ruler className="h-4 w-4 text-info" /> เครื่องมือวัดขนาดห้องจริง
            </p>
            <p className="text-[11px] text-ink-600">เลือกวิธีวัดที่ถนัด แล้วกดนำขนาดไปสร้างห้อง 3D ทันที</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="icon-btn h-8 w-8 border-transparent p-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 px-4 pt-2.5" role="tablist">
          {(
            [
              ["tiles", "นับกระเบื้อง", Grid3x3],
              ["live", "กล้องวัดสด", Video],
              ["photo", "วัดจากรูป", Camera],
              ["ar", "ส่อง AR", ScanLine],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`inline-flex h-8 items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-all ${
                tab === k ? "bg-info text-white shadow-xs" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === "tiles" && <TileMeasure initialW={vals.w} initialD={vals.d} initialH={vals.h} onResult={set} />}
          {tab === "live" && <LiveCameraMeasure vals={vals} onResult={set} onApply={handleApply} />}
          {tab === "photo" && <PhotoMeasure vals={vals} onResult={set} onSwitchToLive={() => setTab("live")} />}
          {tab === "ar" && (
            <ArMeasure
              supported={arOk}
              onResult={(w, d) => setVals((v) => ({ ...v, w, d }))}
              onSwitchToLive={() => setTab("live")}
            />
          )}
        </div>

        <div className="space-y-2 border-t border-ink-100 px-4 py-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] bg-ink-50/70">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink-700">ขนาดห้องที่วัดได้ (แก้ไขตัวเลขได้):</span>
            <span className="rounded-full bg-info-bg px-2.5 py-0.5 font-bold text-info">
              พื้นที่ {((vals.w * vals.d) / 10000).toFixed(2)} ตร.ม. · {(vals.w / 100).toFixed(2)}×{(vals.d / 100).toFixed(2)} ม.
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(["w", "d", "h"] as Target[]).map((t) => (
              <label key={t} className="space-y-0.5">
                <span className="block text-[11px] font-semibold text-ink-600">
                  {TARGET_LABEL[t]} ({(vals[t] / 100).toFixed(2)} ม.)
                </span>
                <div className="relative flex items-center">
                  <input
                    inputMode="numeric"
                    value={vals[t] || ""}
                    onChange={(e) => set(t, Number(e.target.value.replace(/\D/g, "")) || 0)}
                    className="input h-9 w-full pr-7 text-center font-bold text-ink-950 text-sm"
                  />
                  <span className="pointer-events-none absolute right-2 text-[10px] text-ink-400">ซม.</span>
                </div>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={vals.w < 100 || vals.d < 100 || vals.h < 200}
            onClick={handleApply}
            className="btn btn-primary h-11 w-full rounded-full disabled:opacity-50 text-sm font-bold shadow-md"
          >
            <Check className="h-4 w-4" /> ใช้ขนาด {(vals.w / 100).toFixed(2)}×{(vals.d / 100).toFixed(2)} ม. สร้างห้อง 3D ทันที
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- 1) นับกระเบื้องห้อง (แม่นยำและใช้งานได้จริงที่สุด) ---------------------------- */
function TileMeasure({
  initialW,
  initialD,
  initialH,
  onResult,
}: {
  initialW: number;
  initialD: number;
  initialH: number;
  onResult: (t: Target, cm: number) => void;
}) {
  const [tile, setTile] = useState(60);
  const [customTile, setCustomTile] = useState("");
  const [wCount, setWCount] = useState(() => Math.max(1, Math.round((initialW / 60) * 2) / 2) || 5);
  const [dCount, setDCount] = useState(() => Math.max(1, Math.round((initialD / 60) * 2) / 2) || 6);
  const [ceilH, setCeilH] = useState(initialH || 260);

  const activeTile = customTile ? Math.max(5, Number(customTile) || 60) : tile;

  useEffect(() => {
    onResult("w", Math.round(wCount * activeTile));
    onResult("d", Math.round(dCount * activeTile));
    onResult("h", ceilH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTile, wCount, dCount, ceilH]);

  return (
    <div className="space-y-3.5 text-sm text-ink-700">
      <div className="rounded-2xl border border-ok/30 bg-ok-bg/40 p-3 space-y-1">
        <p className="font-bold text-ok-dark flex items-center gap-1.5 text-xs">
          <Sparkles className="h-4 w-4 text-ok" /> แม่นยำระดับเซนติเมตร โดยไม่ต้องใช้ตลับเมตร
        </p>
        <p className="text-xs text-ink-700 leading-relaxed">
          นับจำนวนแผ่นกระเบื้องหรือแผ่นไม้ลามิเนตตามแนวผนังซ้าย-ขวา และหน้า-หลัง (กดทีละ 0.5 แผ่นสำหรับเศษกระเบื้องริมผนังได้)
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-bold text-ink-800">1. เลือกขนาดกระเบื้อง / แผ่นพื้น:</span>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { size: 60, label: "60×60", tag: "คอนโด/บ้าน" },
            { size: 30, label: "30×30", tag: "มาตรฐาน" },
            { size: 40, label: "40×40", tag: "ขนาดกลาง" },
            { size: 80, label: "80×80", tag: "แผ่นใหญ่" },
            { size: 15, label: "15 ซม.", tag: "ลามิเนต" },
          ].map((item) => {
            const selected = !customTile && tile === item.size;
            return (
              <button
                key={item.size}
                type="button"
                onClick={() => {
                  setCustomTile("");
                  setTile(item.size);
                  setWCount(Math.max(1, Math.round((initialW / item.size) * 2) / 2));
                  setDCount(Math.max(1, Math.round((initialD / item.size) * 2) / 2));
                }}
                className={`rounded-xl border p-1.5 text-center transition-all ${
                  selected
                    ? "border-info bg-info-bg/60 text-info font-bold shadow-xs"
                    : "border-ink-200 bg-white text-ink-700 hover:border-ink-400"
                }`}
              >
                <span className="block text-xs">{item.label}</span>
                <span className="text-[9px] text-ink-500">{item.tag}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-ink-600">หรือระบุขนาดแผ่นเอง:</span>
          <input
            type="number"
            min={5}
            max={200}
            placeholder="เช่น 45"
            value={customTile}
            onChange={(e) => setCustomTile(e.target.value)}
            className="input h-8 w-24 text-center text-xs"
          />
          <span className="text-[11px] text-ink-500">ซม./แผ่น</span>
        </div>
      </div>

      <div className="space-y-2">
        <span className="block text-xs font-bold text-ink-800">2. นับจำนวนแผ่น (กด +/- ทีละ 0.5 หรือพิมพ์ตัวเลข):</span>

        {/* กว้าง */}
        <div className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-2.5 shadow-xs">
          <div>
            <span className="block font-bold text-xs text-ink-950">ด้านกว้าง (ผนังที่จะวางโต๊ะ)</span>
            <span className="text-xs text-info font-semibold">
              {wCount} แผ่น × {activeTile} ซม. = {((wCount * activeTile) / 100).toFixed(2)} ม.
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={wCount <= 1}
              onClick={() => setWCount((c) => Math.max(1, Math.round((c - 0.5) * 2) / 2))}
              className="btn btn-outline h-8 w-8 rounded-full p-0 disabled:opacity-40"
              title="ลด 0.5 แผ่น"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="number"
              step="0.5"
              min="1"
              max="100"
              value={wCount}
              onChange={(e) => setWCount(Math.max(1, parseFloat(e.target.value) || 1))}
              className="input h-8 w-14 text-center font-bold text-sm text-ink-950 px-1"
            />
            <button
              type="button"
              onClick={() => setWCount((c) => Math.round((c + 0.5) * 2) / 2)}
              className="btn btn-outline h-8 w-8 rounded-full p-0 text-info"
              title="เพิ่ม 0.5 แผ่น"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ลึก */}
        <div className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-2.5 shadow-xs">
          <div>
            <span className="block font-bold text-xs text-ink-950">ด้านลึก (จากผนังถึงฝั่งตรงข้าม)</span>
            <span className="text-xs text-ok font-semibold">
              {dCount} แผ่น × {activeTile} ซม. = {((dCount * activeTile) / 100).toFixed(2)} ม.
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={dCount <= 1}
              onClick={() => setDCount((c) => Math.max(1, Math.round((c - 0.5) * 2) / 2))}
              className="btn btn-outline h-8 w-8 rounded-full p-0 disabled:opacity-40"
              title="ลด 0.5 แผ่น"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="number"
              step="0.5"
              min="1"
              max="100"
              value={dCount}
              onChange={(e) => setDCount(Math.max(1, parseFloat(e.target.value) || 1))}
              className="input h-8 w-14 text-center font-bold text-sm text-ink-950 px-1"
            />
            <button
              type="button"
              onClick={() => setDCount((c) => Math.round((c + 0.5) * 2) / 2)}
              className="btn btn-outline h-8 w-8 rounded-full p-0 text-info"
              title="เพิ่ม 0.5 แผ่น"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ความสูงเพดานมาตรฐาน */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2">
        <span className="text-xs font-bold text-ink-800">ความสูงฝ้าเพดาน:</span>
        <div className="flex gap-1">
          {[
            { h: 240, label: "2.4 ม." },
            { h: 260, label: "2.6 ม. (ทั่วไป)" },
            { h: 280, label: "2.8 ม." },
            { h: 300, label: "3.0 ม." },
          ].map((c) => (
            <button
              key={c.h}
              type="button"
              onClick={() => setCeilH(c.h)}
              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-all ${
                ceilH === c.h ? "bg-info text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- 2) กล้องวัดสด (Live Camera Tape — วัดสเกลจริง 2 จุด) ---------------------------- */
const LIVE_REFS = [
  { id: "tile60", label: "กระเบื้อง 1 แผ่น (60 ซม.)", cm: 60 },
  { id: "door80", label: "ความกว้างประตู (80 ซม.)", cm: 80 },
  { id: "a4", label: "กระดาษ A4 แนวยาว (29.7 ซม.)", cm: 29.7 },
  { id: "tile30", label: "กระเบื้องเล็ก (30 ซม.)", cm: 30 },
  { id: "outlet", label: "หน้ากากปลั๊กไฟ (12 ซม.)", cm: 12 },
] as const;

function LiveCameraMeasure({
  vals,
  onResult,
  onApply,
}: {
  vals: Record<Target, number>;
  onResult: (t: Target, cm: number) => void;
  onApply: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const freezeCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camStatus, setCamStatus] = useState<"idle" | "requesting" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [mode, setMode] = useState<"calibrate" | "fov">("calibrate");

  // โหมด 1: เทียบวัตถุอ้างอิงในกล้อง (แตะ 2 จุดอ้างอิง -> แตะ 2 จุดผนัง)
  const [refCm, setRefCm] = useState<number>(60);
  const [refPts, setRefPts] = useState<Pt[]>([]);
  const [wallTarget, setWallTarget] = useState<"w" | "d">("w");
  const [wallPts, setWallPts] = useState<Partial<Record<"w" | "d", Pt[]>>>({});

  // โหมด 2: เล็งด้วยระยะห่างจากผนัง (FOV Laser)
  const [standDistM, setStandDistM] = useState(2.8);
  const [spanFrac, setSpanFrac] = useState(0.82);

  async function startCamera() {
    setCamStatus("requesting");
    setErrMsg(null);
    setFrozen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamStatus("ready");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (e) {
      setCamStatus("error");
      setErrMsg((e as Error).message || "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตให้เบราว์เซอร์เข้าถึงกล้อง");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function toggleFreeze() {
    if (!videoRef.current || !freezeCanvasRef.current) return;
    if (!frozen) {
      const v = videoRef.current;
      const c = freezeCanvasRef.current;
      c.width = v.videoWidth || 1280;
      c.height = v.videoHeight || 720;
      const ctx = c.getContext("2d");
      if (ctx) ctx.drawImage(v, 0, 0, c.width, c.height);
      setFrozen(true);
    } else {
      setFrozen(false);
    }
  }

  function onTapOverlay(e: React.PointerEvent) {
    if (mode !== "calibrate" || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const pt: Pt = {
      x: ((e.clientX - rect.left) / rect.width) * 1000,
      y: ((e.clientY - rect.top) / rect.height) * 750,
    };

    if (refPts.length < 2) {
      setRefPts((prev) => [...prev, pt]);
      return;
    }

    const cur = wallPts[wallTarget] ?? [];
    const next = cur.length >= 2 ? [pt] : [...cur, pt];
    setWallPts((prev) => ({ ...prev, [wallTarget]: next }));

    if (next.length === 2 && refPts.length === 2) {
      const refPx = dist(refPts[0], refPts[1]);
      const wallPx = dist(next[0], next[1]);
      if (refPx > 5) {
        const cm = Math.round((wallPx / refPx) * refCm);
        if (cm >= 80 && cm <= 1500) {
          onResult(wallTarget, cm);
        }
      }
    }
  }

  // คำนวณระยะจากโหมด FOV (กล้องมือถือทั่วไปมี Horizontal FOV ~ 62° -> width_at_dist = 2 * D * tan(31°) ≈ 1.2 * D)
  const fovWallCm = Math.round(standDistM * 120 * spanFrac);

  if (camStatus !== "ready") {
    return (
      <div className="rounded-2xl border border-ink-200 bg-ink-50 p-5 text-center space-y-3.5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-info-bg text-info">
          <Video className="h-7 w-7" />
        </div>
        <div>
          <p className="font-bold text-base text-ink-950">กล้องวัดขนาดห้องสด (Live Camera Measure)</p>
          <p className="text-xs text-ink-600 mt-1 leading-relaxed">
            เปิดกล้องส่องผนังห้อง แล้วแตะจุดเทียบกับของในห้อง (เช่น กระเบื้อง 1 แผ่น หรือความกว้างประตู) เพื่อคำนวณความยาวผนังจริงเป็นเซนติเมตรทันที
          </p>
        </div>
        {errMsg && <p className="rounded-xl bg-bad-bg p-3 text-xs font-semibold text-bad">{errMsg}</p>}
        <button
          type="button"
          onClick={startCamera}
          disabled={camStatus === "requesting"}
          className="btn btn-primary h-11 w-full rounded-full font-bold shadow-md"
        >
          {camStatus === "requesting" ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังเปิดกล้อง...
            </span>
          ) : (
            <>
              <Camera className="h-4 w-4" /> เปิดกล้องเริ่มวัดขนาดจริง
            </>
          )}
        </button>
      </div>
    );
  }

  const refDone = refPts.length >= 2;
  const activeWallPts = wallPts[wallTarget] ?? [];

  return (
    <div className="space-y-3">
      {/* สลับโหมดวัดในกล้อง */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode("calibrate")}
          className={`h-8 rounded-lg font-semibold transition-all ${
            mode === "calibrate" ? "bg-white text-info shadow-xs" : "text-ink-600"
          }`}
        >
          🎯 แตะเทียบของจริง (แม่นยำสุด)
        </button>
        <button
          type="button"
          onClick={() => setMode("fov")}
          className={`h-8 rounded-lg font-semibold transition-all ${
            mode === "fov" ? "bg-white text-info shadow-xs" : "text-ink-600"
          }`}
        >
          📏 เล็งเส้นเลเซอร์กะระยะ
        </button>
      </div>

      {mode === "calibrate" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-ink-700">ของอ้างอิงในกล้อง:</span>
          {LIVE_REFS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRefCm(r.cm);
                setRefPts([]);
                setWallPts({});
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                refCm === r.cm
                  ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* หน้าจอกล้อง + จุดแตะวัด */}
      <div
        ref={overlayRef}
        onPointerDown={onTapOverlay}
        className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-2xl bg-black border border-ink-200 cursor-crosshair"
      >
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`h-full w-full object-cover ${frozen ? "hidden" : "block"}`}
        />
        <canvas ref={freezeCanvasRef} className={`h-full w-full object-cover ${frozen ? "block" : "hidden"}`} />

        {/* แถบคำแนะนำด้านบนกล้อง */}
        <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-center justify-between gap-2">
          <span className="rounded-full bg-ink-950/80 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
            {mode === "calibrate"
              ? !refDone
                ? `ขั้นที่ 1: แตะหัว-ท้ายของอ้างอิง (${refCm} ซม.) บนจอ (${refPts.length}/2)`
                : `ขั้นที่ 2: แตะขอบซ้าย-ขวาเพื่อวัดด้าน${TARGET_LABEL[wallTarget]} (${activeWallPts.length}/2)`
              : `ถอยห่างผนัง ${standDistM.toFixed(1)} ม. แล้วทาบเส้นเหลืองกับขอบผนัง`}
          </span>
        </div>

        {/* ปุ่มล็อกภาพหน้าจอ (Freeze Frame) */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleFreeze}
          className={`absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-md ${
            frozen ? "bg-amber-500 text-white" : "bg-white/95 text-ink-950"
          }`}
        >
          {frozen ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {frozen ? "ปลดล็อกกล้องสด" : "📸 ล็อกภาพเพื่อจิ้มวัด"}
        </button>

        {/* วาดเส้นวัดโหมด Calibrate */}
        {mode === "calibrate" && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 750" preserveAspectRatio="none">
            {refPts.length === 2 && (
              <g>
                <line
                  x1={refPts[0].x}
                  y1={refPts[0].y}
                  x2={refPts[1].x}
                  y2={refPts[1].y}
                  stroke="#f59e0b"
                  strokeWidth="6"
                />
                <rect
                  x={(refPts[0].x + refPts[1].x) / 2 - 75}
                  y={(refPts[0].y + refPts[1].y) / 2 - 34}
                  width="150"
                  height="28"
                  rx="14"
                  fill="rgba(15,23,42,0.85)"
                />
                <text
                  x={(refPts[0].x + refPts[1].x) / 2}
                  y={(refPts[0].y + refPts[1].y) / 2 - 15}
                  textAnchor="middle"
                  fill="#fde68a"
                  fontSize="18"
                  fontWeight="bold"
                >
                  อ้างอิง {refCm} ซม.
                </text>
              </g>
            )}
            {refPts.map((p, idx) => (
              <circle key={`ref-${idx}`} cx={p.x} cy={p.y} r="12" fill="#f59e0b" stroke="#fff" strokeWidth="4" />
            ))}

            {(["w", "d"] as const).map((t) => {
              const pts = wallPts[t];
              if (!pts?.length) return null;
              const col = TARGET_COLOR[t];
              const cmVal =
                pts.length === 2 && refPts.length === 2 && dist(refPts[0], refPts[1]) > 5
                  ? Math.round((dist(pts[0], pts[1]) / dist(refPts[0], refPts[1])) * refCm)
                  : null;
              return (
                <g key={t}>
                  {pts.length === 2 && (
                    <>
                      <line
                        x1={pts[0].x}
                        y1={pts[0].y}
                        x2={pts[1].x}
                        y2={pts[1].y}
                        stroke={col}
                        strokeWidth="7"
                        strokeDasharray="14 8"
                      />
                      {cmVal && (
                        <>
                          <rect
                            x={(pts[0].x + pts[1].x) / 2 - 95}
                            y={(pts[0].y + pts[1].y) / 2 - 36}
                            width="190"
                            height="32"
                            rx="16"
                            fill={col}
                          />
                          <text
                            x={(pts[0].x + pts[1].x) / 2}
                            y={(pts[0].y + pts[1].y) / 2 - 14}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="20"
                            fontWeight="bold"
                          >
                            {TARGET_LABEL[t]}: {(cmVal / 100).toFixed(2)} ม. ({cmVal} ซม.)
                          </text>
                        </>
                      )}
                    </>
                  )}
                  {pts.map((p, idx) => (
                    <circle key={`${t}-${idx}`} cx={p.x} cy={p.y} r="13" fill={col} stroke="#fff" strokeWidth="4" />
                  ))}
                </g>
              );
            })}
          </svg>
        )}

        {/* วาดเส้นเลเซอร์โหมด FOV */}
        {mode === "fov" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              style={{ width: `${Math.round(spanFrac * 100)}%` }}
              className="flex items-center justify-between transition-all"
            >
              <div className="h-12 w-2 rounded-full bg-yellow-400 shadow-lg" />
              <div className="relative mx-1 h-0.5 flex-1 border-t-2 border-dashed border-yellow-300 bg-yellow-400">
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink-950/90 px-3 py-0.5 text-xs font-bold text-yellow-300">
                  {TARGET_LABEL[wallTarget]}: {(fovWallCm / 100).toFixed(2)} ม. ({fovWallCm} ซม.)
                </span>
              </div>
              <div className="h-12 w-2 rounded-full bg-yellow-400 shadow-lg" />
            </div>
          </div>
        )}
      </div>

      {/* แผงควบคุมใต้กล้อง */}
      {mode === "calibrate" ? (
        <div className="space-y-2 rounded-2xl border border-ink-200 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {(["w", "d"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setWallTarget(t)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    wallTarget === t
                      ? t === "w"
                        ? "bg-info text-white"
                        : "bg-ok text-white"
                      : "bg-ink-100 text-ink-700"
                  }`}
                >
                  วัดด้าน{TARGET_LABEL[t]} ({(vals[t] / 100).toFixed(2)} ม.)
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (wallPts[wallTarget]?.length) {
                  setWallPts((prev) => ({ ...prev, [wallTarget]: [] }));
                } else {
                  setRefPts([]);
                }
              }}
              className="btn btn-outline h-8 rounded-full px-3 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" /> จิ้มจุดใหม่
            </button>
          </div>
          <p className="text-[11px] text-ink-500">
            💡 ทริค: กดปุ่ม <b>“📸 ล็อกภาพเพื่อจิ้มวัด”</b> มุมขวาล่างของจอกล้องเพื่อให้ภาพนิ่ง แล้วค่อยจิ้มจุดอ้างอิง 2 จุด ตามด้วยขอบผนัง 2 จุด
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 rounded-2xl border border-ink-200 bg-white p-3 shadow-xs text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink-700">1. คุณยืนห่างจากผนังที่ส่องประมาณกี่เมตร?</span>
            <span className="font-bold text-info">{standDistM.toFixed(1)} เมตร</span>
          </div>
          <input
            type="range"
            min="1.2"
            max="7.0"
            step="0.1"
            value={standDistM}
            onChange={(e) => {
              const d = parseFloat(e.target.value);
              setStandDistM(d);
              onResult(wallTarget, Math.round(d * 120 * spanFrac));
            }}
            className="w-full accent-info"
          />
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink-700">2. ย่อ/ขยายเส้นเหลืองให้พอดีขอบผนังซ้าย-ขวา:</span>
            <span className="font-bold text-ok">{(fovWallCm / 100).toFixed(2)} ม.</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="0.98"
            step="0.02"
            value={spanFrac}
            onChange={(e) => {
              const sf = parseFloat(e.target.value);
              setSpanFrac(sf);
              onResult(wallTarget, Math.round(standDistM * 120 * sf));
            }}
            className="w-full accent-info"
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onResult(wallTarget, fovWallCm);
                if (wallTarget === "w") setWallTarget("d");
                else onApply();
              }}
              className="btn btn-primary h-10 w-full rounded-full text-xs font-bold"
            >
              ✓ บันทึกด้าน{TARGET_LABEL[wallTarget]} ({fovWallCm} ซม.) {wallTarget === "w" ? "→ วัดด้านลึกต่อ" : "& ใช้ขนาดนี้"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- 3) AR (WebXR) ---------------------------- */
function ArMeasure({
  supported,
  onResult,
  onSwitchToLive,
}: {
  supported: boolean | null;
  onResult: (w: number, d: number) => void;
  onSwitchToLive: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ w: number; d: number; area: number } | null>(null);

  async function start() {
    setErr(null);
    setRunning(true);
    try {
      const { runArMeasure } = await import("./ar-measure");
      const r = await runArMeasure();
      if (r) {
        setResult({ w: r.w, d: r.d, area: r.areaM2 });
        onResult(r.w, r.d);
      }
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

  if (!supported) {
    return (
      <div className="space-y-3 rounded-2xl border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700">
        <p className="font-bold text-ink-950">อุปกรณ์หรือเบราว์เซอร์นี้ไม่เปิดโหมด WebXR ARCore</p>
        <p className="text-xs text-ink-600">
          ไม่ต้องกังวล! คุณสามารถใช้โหมด <b>“กล้องวัดสด”</b> เพื่อเปิดกล้องส่องเทียบกระเบื้อง/ประตูได้บนมือถือและคอมทุกเครื่องทันที
        </p>
        <button
          type="button"
          onClick={onSwitchToLive}
          className="btn btn-primary h-10 w-full rounded-full text-xs font-bold"
        >
          <Video className="h-4 w-4" /> สลับไปใช้ “กล้องวัดสด” แทน
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm text-ink-700">
      <ol className="list-decimal space-y-1 pl-5 text-xs">
        <li>ยืนกลางห้อง เปิดไฟให้สว่าง ส่องกล้องลงพื้นแล้วค่อยๆ ขยับจนเห็นวงกลมเป้าบนพื้น</li>
        <li>
          <b>ความกว้าง:</b> เล็งเป้าที่ขอบผนังซ้าย (ตรงที่ผนังชนพื้น) แตะจอ → เล็งขอบผนังขวา แตะจอ
        </li>
        <li>
          <b>ความลึก:</b> ทำแบบเดียวกันกับผนังหน้า-หลัง แล้วกด “เสร็จ”
        </li>
      </ol>
      <button type="button" onClick={start} disabled={running} className="btn btn-primary h-11 w-full rounded-full disabled:opacity-60 font-bold text-xs">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} เริ่มส่องวัดห้อง AR
      </button>
      {err && <p className="rounded-xl bg-bad-bg px-3 py-2 text-xs font-semibold text-bad">{err}</p>}
      {result && (
        <p className="rounded-xl bg-ok-bg px-3 py-2 font-semibold text-ink-950 text-xs">
          ห้อง {result.w} × {result.d} ซม. · พื้นที่ {result.area} ตร.ม.
        </p>
      )}
    </div>
  );
}

/* ---------------------------- 4) วัดจากรูปถ่าย (ครบทั้งตัวเลือกของอ้างอิง + แว่นขยาย + สลับด้าน กว้าง/ลึก/สูง) ---------------------------- */
const PHOTO_REFS = [
  { id: "a4", label: "กระดาษ A4 (21×29.7)", rect: [21, 29.7] as [number, number] },
  { id: "tile60", label: "กระเบื้อง 60×60 ซม.", rect: [60, 60] as [number, number] },
  { id: "tile30", label: "กระเบื้อง 30×30 ซม.", rect: [30, 30] as [number, number] },
  { id: "door", label: "ความกว้างประตู 80 ซม.", line: 80 },
  { id: "card", label: "บัตร ATM/ปชช.", rect: [5.398, 8.56] as [number, number] },
  { id: "custom", label: "กำหนดความยาวเอง", line: 0 },
] as const;
type PhotoRef = (typeof PHOTO_REFS)[number];

function PhotoMeasure({
  vals,
  onResult,
  onSwitchToLive,
}: {
  vals: Record<Target, number>;
  onResult: (t: Target, cm: number) => void;
  onSwitchToLive: () => void;
}) {
  const [img, setImg] = useState<string | null>(null);
  const [refId, setRefId] = useState<PhotoRef["id"]>("tile60");
  const [customCm, setCustomCm] = useState("100");
  const [firstLong, setFirstLong] = useState(true);
  const [refPts, setRefPts] = useState<Pt[]>([]);
  const [lines, setLines] = useState<Partial<Record<Target, Pt[]>>>({});
  const [target, setTarget] = useState<Target>("w");
  const [loupe, setLoupe] = useState<{ x: number; y: number; px: number; py: number; w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState({ w: 100, h: 100 });

  const ref = PHOTO_REFS.find((r) => r.id === refId)!;
  const isRect = "rect" in ref;
  const needRef = isRect ? 4 : 2;
  const refDone = refPts.length >= needRef;
  const lineCm = !isRect ? (ref.id === "custom" ? Number(customCm) || 100 : ref.line) : 0;

  const lengthOf = (pts: Pt[] | undefined): number | null => {
    if (!pts || pts.length < 2 || !refDone) return null;
    return isRect
      ? rectPlaneLength(refPts, ref.rect[0], ref.rect[1], pts[0], pts[1], firstLong)
      : lengthFromPhoto(refPts[0], refPts[1], lineCm, pts[0], pts[1]);
  };

  const results: Partial<Record<Target, number>> = {};
  for (const t of ["w", "d", "h"] as Target[]) {
    const cm = lengthOf(lines[t]);
    if (cm && cm >= 50 && cm <= 2000) results[t] = Math.round(cm);
  }
  const resultsKey = JSON.stringify(results);
  useEffect(() => {
    const r = JSON.parse(resultsKey) as Partial<Record<Target, number>>;
    for (const [t, cm] of Object.entries(r)) onResult(t as Target, cm as number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey]);

  const toImg = (e: React.PointerEvent) => {
    const el = imgRef.current!;
    const r = el.getBoundingClientRect();
    return {
      p: {
        x: ((e.clientX - r.left) / r.width) * el.naturalWidth,
        y: ((e.clientY - r.top) / r.height) * el.naturalHeight,
      },
      local: { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height },
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!imgRef.current) return;
    const { p, local } = toImg(e);
    setLoupe({
      x: local.x,
      y: local.y,
      px: p.x / imgRef.current.naturalWidth,
      py: p.y / imgRef.current.naturalHeight,
      w: local.w,
      h: local.h,
    });
    if (!refDone) {
      setRefPts((pts) => [...pts, p]);
    } else {
      const curr = lines[target] ?? [];
      const next = curr.length >= 2 ? [p] : [...curr, p];
      setLines((l) => ({ ...l, [target]: next }));
    }
  };

  const sw = Math.max(2.5, size.w / 150);
  const r0 = sw * 2.8;

  if (!img)
    return (
      <div className="space-y-3 text-sm text-ink-700">
        <div className="rounded-2xl border border-info/25 bg-info-bg/40 p-3 text-xs space-y-1">
          <p className="font-bold text-info">วิธีวัดขนาดห้องจริงจากรูปถ่าย (Perspective Homography)</p>
          <ol className="list-decimal space-y-1 pl-4 text-ink-700">
            <li>ถ่ายรูปห้องให้เห็น <b>แผ่นกระเบื้องบนพื้น</b>, <b>ประตูห้อง</b>, หรือวาง <b>กระดาษ A4</b> บนพื้น</li>
            <li>จิ้มมุมของอ้างอิงในรูป แล้วจิ้มขอบผนังซ้าย-ขวา ระบบจะคำนวณความยาวจริงแม้ถ่ายมุมเฉียง!</li>
          </ol>
        </div>
        <label className="btn btn-primary h-11 w-full cursor-pointer rounded-full font-bold text-xs shadow-sm">
          <Camera className="h-4 w-4" /> ถ่ายรูปห้อง หรือ เลือกรูปจากเครื่อง
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setImg(URL.createObjectURL(f));
              setRefPts([]);
              setLines({});
            }}
          />
        </label>
        <button
          type="button"
          onClick={onSwitchToLive}
          className="btn btn-outline h-10 w-full rounded-full text-xs"
        >
          <Video className="h-4 w-4" /> หรือเปิดกล้องวัดสดเดี๋ยวนี้
        </button>
      </div>
    );

  return (
    <div className="space-y-2.5">
      {/* 1. เลือกวัตถุอ้างอิง */}
      <div className="space-y-1.5">
        <span className="block text-[11px] font-bold text-ink-700">1. เลือกของอ้างอิงที่เห็นในรูปนี้:</span>
        <div className="flex flex-wrap gap-1">
          {PHOTO_REFS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRefId(r.id);
                setRefPts([]);
                setLines({});
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                refId === r.id
                  ? "border-amber-500 bg-amber-50 text-amber-900 shadow-2xs"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {refId === "custom" && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-ink-600">ความยาวของอ้างอิง:</span>
            <input
              type="number"
              min={5}
              max={500}
              value={customCm}
              onChange={(e) => setCustomCm(e.target.value)}
              className="input h-8 w-24 text-center text-xs"
            />
            <span className="text-xs text-ink-500">ซม.</span>
          </div>
        )}
        {refId === "a4" && (
          <label className="flex items-center gap-1.5 text-[11px] text-ink-600">
            <input
              type="checkbox"
              checked={firstLong}
              onChange={(e) => setFirstLong(e.target.checked)}
              className="accent-info"
            />
            จุดที่ 1→2 ที่แตะคือด้านยาวของ A4 (29.7 ซม.)
          </label>
        )}
      </div>

      {/* แถบขั้นตอนปัจจุบัน + ปุ่มเลือกด้านที่จะวัด */}
      <div className="rounded-xl border border-ink-200 bg-ink-50 p-2 text-xs">
        {!refDone ? (
          <p className="flex items-center gap-1.5 font-bold text-amber-800">
            <Crosshair className="h-4 w-4 shrink-0 text-amber-600" />
            ขั้นที่ 1: แตะที่มุมของ “{ref.label}” ในรูปให้ครบ {needRef} จุด (แตะแล้ว {refPts.length}/{needRef})
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="font-bold text-ink-900">
              ขั้นที่ 2: เลือกด้านที่จะวัด แล้วแตะต้น-ปลายผนังในรูป (2 จุด):
            </p>
            <div className="grid grid-cols-3 gap-1">
              {(["w", "d", "h"] as Target[]).map((t) => {
                const active = target === t;
                const measured = results[t] ?? vals[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTarget(t)}
                    className={`rounded-lg py-1.5 px-2 text-center text-[11px] font-bold transition-all ${
                      active ? "bg-info text-white shadow-xs" : "bg-white text-ink-700 border border-ink-200"
                    }`}
                  >
                    วัด{TARGET_LABEL[t]} ({(measured / 100).toFixed(2)} ม.)
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* กรอบรูปถ่าย + เส้น SVG + แว่นขยาย */}
      <div
        className="relative touch-none select-none overflow-hidden rounded-2xl border border-ink-200 bg-ink-950 cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={(e) => {
          if (!e.buttons || !imgRef.current) return;
          const { p, local } = toImg(e);
          setLoupe({
            x: local.x,
            y: local.y,
            px: p.x / imgRef.current.naturalWidth,
            py: p.y / imgRef.current.naturalHeight,
            w: local.w,
            h: local.h,
          });
        }}
        onPointerUp={() => setTimeout(() => setLoupe(null), 600)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={img}
          alt="รูปที่ใช้วัด"
          className="block w-full max-h-[42vh] object-contain mx-auto"
          draggable={false}
          onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none">
          {refPts.length >= 2 && (
            <polygon
              points={refPts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={isRect && refPts.length === 4 ? "rgba(245,158,11,0.28)" : "none"}
              stroke="#f59e0b"
              strokeWidth={sw}
            />
          )}
          {refPts.map((p, i) => (
            <circle key={`rp-${i}`} cx={p.x} cy={p.y} r={r0 * 0.85} fill="#f59e0b" stroke="#fff" strokeWidth={sw * 0.7} />
          ))}
          {(["w", "d", "h"] as Target[]).map((t) => {
            const l = lines[t];
            if (!l?.length) return null;
            const col = TARGET_COLOR[t];
            const cmVal = results[t];
            return (
              <g key={t}>
                {l.length === 2 && (
                  <>
                    <line x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y} stroke={col} strokeWidth={sw * 1.2} />
                    {cmVal && (
                      <text
                        x={(l[0].x + l[1].x) / 2}
                        y={(l[0].y + l[1].y) / 2 - sw * 3}
                        textAnchor="middle"
                        fill="#ffffff"
                        stroke={col}
                        strokeWidth={sw * 0.4}
                        fontSize={sw * 6}
                        fontWeight="bold"
                      >
                        {TARGET_LABEL[t]} {(cmVal / 100).toFixed(2)} ม.
                      </text>
                    )}
                  </>
                )}
                {l.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={r0} fill={col} stroke="#fff" strokeWidth={sw} />
                ))}
              </g>
            );
          })}
        </svg>

        {/* แว่นขยายตอนแตะเล็งมุม */}
        {loupe && (
          <div
            className="pointer-events-none absolute h-20 w-20 overflow-hidden rounded-full border-2 border-white shadow-xl"
            style={{
              left: Math.min(Math.max(8, loupe.x - 40), loupe.w - 88),
              top: Math.max(8, loupe.y - 96),
              backgroundImage: `url(${img})`,
              backgroundSize: `${loupe.w * 2.5}px ${loupe.h * 2.5}px`,
              backgroundPosition: `-${loupe.px * loupe.w * 2.5 - 40}px -${loupe.py * loupe.h * 2.5 - 40}px`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-4 w-0.5 bg-amber-400" />
              <div className="absolute h-0.5 w-4 bg-amber-400" />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (lines[target]?.length) setLines((l) => ({ ...l, [target]: [] }));
            else setRefPts((p) => p.slice(0, -1));
          }}
          disabled={!refPts.length}
          className="btn btn-outline h-9 flex-1 rounded-full text-xs disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" /> ย้อนจุดล่าสุด
        </button>
        <button
          type="button"
          onClick={() => {
            setRefPts([]);
            setLines({});
          }}
          disabled={!refPts.length}
          className="btn btn-outline h-9 flex-1 rounded-full text-xs disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> เริ่มจิ้มใหม่
        </button>
        <button
          type="button"
          onClick={() => {
            setImg(null);
            setRefPts([]);
            setLines({});
          }}
          className="btn btn-outline h-9 flex-1 rounded-full text-xs"
        >
          <Camera className="h-3.5 w-3.5" /> เปลี่ยนรูป
        </button>
      </div>
    </div>
  );
}
