"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Grid3x3, Loader2, Ruler, ScanLine, Undo2, X } from "lucide-react";
import { useFocusTrap } from "@/components/useFocusTrap";
import { dist, lengthFromPhoto, lengthFromTiles, rectPlaneLength, type Pt } from "@/lib/measure";
import type { RoomSize } from "@/lib/room-planner";

type Target = "w" | "d" | "h";
const TARGET_LABEL: Record<Target, string> = { w: "กว้าง", d: "ลึก", h: "สูง" };

/**
 * เครื่องมือวัดห้อง 3 แบบ
 * 1) AR (Android Chrome ที่รองรับ): ส่องพื้น แตะขอบผนัง 2 จุด = กว้าง · อีก 2 จุด = ลึก
 * 2) วัดจากรูป (ทุกเครื่อง): ถ่ายรูปที่มีของรู้ขนาด เช่น A4 / กระเบื้อง แตะ 2 จุดของอ้างอิง แล้วแตะ 2 จุดที่จะวัด
 * 3) นับกระเบื้อง: จำนวนแผ่น × ขนาดแผ่น
 */
export function RoomMeasureTool({ room, onApply, onClose }: { room: RoomSize; onApply: (r: RoomSize) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"ar" | "photo" | "tiles">("photo");
  const [arOk, setArOk] = useState<boolean | null>(null);
  const [vals, setVals] = useState<Record<Target, number>>({ w: room.w, d: room.d, h: room.h });
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(boxRef, true, onClose);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr;
    if (!xr) {
      queueMicrotask(() => {
        setArOk(false);
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) setTab("ar");
      });
      return;
    }
    xr.isSessionSupported("immersive-ar")
      .then((ok) => {
        setArOk(ok);
        if (ok) setTab("ar");
      })
      .catch(() => setArOk(false));
  }, []);

  const set = (t: Target, cm: number) => setVals((v) => ({ ...v, [t]: Math.round(cm) }));

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="เครื่องมือวัดห้อง">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div ref={boxRef} className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <p className="flex items-center gap-2 font-display text-lg font-bold text-ink-950">
            <Ruler className="h-5 w-5 text-info" /> วัดห้อง
          </p>
          <button type="button" onClick={onClose} aria-label="ปิด" className="icon-btn h-10 w-10 border-transparent p-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-3" role="tablist">
          {(
            [
              ["ar", "ส่องวัด (AR)", ScanLine],
              ["photo", "วัดจากรูป", Camera],
              ["tiles", "นับกระเบื้อง", Grid3x3],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold ${tab === k ? "bg-info text-white" : "bg-ink-100 text-ink-700"}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === "ar" && <ArMeasure supported={arOk} onResult={(w, d) => setVals((v) => ({ ...v, w, d }))} />}
          {tab === "photo" && <PhotoMeasure onResult={set} />}
          {tab === "tiles" && <TileMeasure onResult={set} />}
        </div>

        <div className="space-y-2 border-t border-ink-100 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-3 gap-2 text-center">
            {(["w", "d", "h"] as Target[]).map((t) => (
              <label key={t} className="space-y-0.5">
                <span className="block text-[11px] font-semibold text-ink-600">{TARGET_LABEL[t]} (ซม.)</span>
                <input inputMode="numeric" value={vals[t] || ""} onChange={(e) => set(t, Number(e.target.value.replace(/\D/g, "")) || 0)} className="input h-10 w-full text-center" />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={vals.w < 150 || vals.d < 150 || vals.h < 200}
            onClick={() => {
              onApply({ ...room, w: Math.min(1500, vals.w), d: Math.min(1500, vals.d), h: Math.min(450, vals.h) });
              onClose();
            }}
            className="btn btn-primary h-12 w-full rounded-full disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> ใช้ขนาดนี้
          </button>
          <p className="text-center text-[11px] text-ink-500">ค่าจากการวัดด้วยกล้องเป็นค่าโดยประมาณ ถ้ามีตลับเมตรวัดซ้ำได้จะแม่นที่สุด</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- 1) AR ---------------------------- */
function ArMeasure({ supported, onResult }: { supported: boolean | null; onResult: (w: number, d: number) => void }) {
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
    const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
    return ios ? (
      <div className="space-y-3 rounded-2xl bg-ink-50 p-4 text-sm text-ink-700">
        <p className="font-semibold text-ink-950">iPhone: ใช้แอป “วัดขนาด” (Measure) ที่มากับเครื่อง</p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            ปัดลงจากกลางหน้าจอ พิมพ์ <b>วัดขนาด</b> หรือ <b>Measure</b> แล้วเปิดแอป
          </li>
          <li>ส่องกล้องไปที่พื้นแล้วค่อยๆ ขยับมือถือจนเห็นจุดวงกลม</li>
          <li>เล็งจุดที่มุมห้องด้านหนึ่ง กด <b>＋</b> แล้วเดินไปมุมอีกด้าน กด <b>＋</b> อีกครั้ง → ได้ความกว้าง</li>
          <li>ทำซ้ำกับผนังอีกด้าน (ความลึก) และจากพื้นถึงฝ้า (ความสูง)</li>
          <li>กลับมาที่หน้านี้ แล้วกรอกตัวเลขในช่องด้านล่าง (หน่วย ซม.)</li>
        </ol>
        <p className="text-xs text-ink-500">ไม่เจอแอป? ติดตั้งฟรีจาก App Store ชื่อ “วัดขนาด” ของ Apple · iPhone 12 Pro ขึ้นไปที่มี LiDAR จะแม่นมาก</p>
      </div>
    ) : (
      <div className="space-y-2 rounded-2xl bg-ink-50 p-4 text-sm text-ink-700">
        <p className="font-semibold text-ink-950">เครื่องหรือเบราว์เซอร์นี้ยังใช้ AR บนเว็บไม่ได้</p>
        <p>AR วัดห้องใช้ได้กับมือถือ Android ที่ใช้ Chrome (รองรับ ARCore)</p>
        <p>ใช้แท็บ “วัดจากรูป” หรือ “นับกระเบื้อง” แทนได้เลย แม่นพอสำหรับจัดห้อง</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 text-sm text-ink-700">
      <ol className="list-decimal space-y-1 pl-5">
        <li>ยืนกลางห้อง เปิดไฟให้สว่าง ส่องกล้องลงพื้นแล้วค่อยๆ ขยับจนเห็นวงกลมเป้าบนพื้น</li>
        <li>
          <b>ความกว้าง:</b> เล็งเป้าที่ขอบผนังซ้าย (ตรงที่ผนังชนพื้น) แตะจอ → เดินไปเล็งขอบผนังขวา แตะจอ
        </li>
        <li>
          <b>ความลึก:</b> ทำแบบเดียวกันกับผนังหน้า-หลัง แล้วกด “เสร็จ” (ระหว่างเล็งจะเห็นระยะสดบนจอ)
        </li>
        <li className="text-xs text-ink-500">ไม่ต้องเล็งมุมห้อง มีของวางบังมุมก็วัดได้ · ห้องมืด/พื้นสีเรียบมาก เป้าอาจหาไม่เจอ ให้เปิดไฟ</li>
      </ol>
      <button type="button" onClick={start} disabled={running} className="btn btn-primary h-12 w-full rounded-full disabled:opacity-60">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} เริ่มส่องวัดห้อง
      </button>
      {err && <p className="rounded-xl bg-bad-bg px-3 py-2 text-xs font-semibold text-bad">{err}</p>}
      {result && (
        <p className="rounded-xl bg-ok-bg px-3 py-2 font-semibold text-ink-950">
          ห้อง {result.w} × {result.d} ซม. · พื้นที่ {result.area} ตร.ม.
        </p>
      )}
    </div>
  );
}

/* ---------------------------- 2) วัดจากรูป ---------------------------- */
/** ของอ้างอิง: สี่เหลี่ยม (แตะ 4 มุม แก้มุมเอียงได้แม่น) หรือเส้น (แตะ 2 จุด) */
const PHOTO_REFS = [
  { id: "a4", label: "กระดาษ A4", rect: [21, 29.7] as [number, number] },
  { id: "tile60", label: "กระเบื้อง 60×60", rect: [60, 60] as [number, number] },
  { id: "tile30", label: "กระเบื้อง 30×30", rect: [30, 30] as [number, number] },
  { id: "card", label: "บัตร ATM", rect: [5.398, 8.56] as [number, number] },
  { id: "door", label: "ความกว้างประตู 80", line: 80 },
  { id: "custom", label: "อื่นๆ (กรอกเอง)", line: 0 },
] as const;
type PhotoRef = (typeof PHOTO_REFS)[number];

function PhotoMeasure({ onResult }: { onResult: (t: Target, cm: number) => void }) {
  const [img, setImg] = useState<string | null>(null);
  const [refId, setRefId] = useState<PhotoRef["id"]>("a4");
  const [customCm, setCustomCm] = useState("");
  const [firstLong, setFirstLong] = useState(true);
  const [refPts, setRefPts] = useState<Pt[]>([]);
  const [lines, setLines] = useState<Partial<Record<Target, Pt[]>>>({});
  const [target, setTarget] = useState<Target>("w");
  const [drag, setDrag] = useState<{ kind: "ref" | Target; i: number } | null>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number; px: number; py: number; w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState({ w: 100, h: 100 });

  const ref = PHOTO_REFS.find((r) => r.id === refId)!;
  const isRect = "rect" in ref;
  const needRef = isRect ? 4 : 2;
  const refDone = refPts.length >= needRef;
  const lineCm = !isRect ? (ref.id === "custom" ? Number(customCm) || 0 : ref.line) : 0;
  const squareRef = isRect && ref.rect[0] === ref.rect[1];

  const lengthOf = (pts: Pt[] | undefined): number | null => {
    if (!pts || pts.length < 2 || !refDone) return null;
    return isRect ? rectPlaneLength(refPts, ref.rect[0], ref.rect[1], pts[0], pts[1], firstLong) : lengthFromPhoto(refPts[0], refPts[1], lineCm, pts[0], pts[1]);
  };
  // ส่งผลขึ้นไปทุกครั้งที่จุด/ของอ้างอิงเปลี่ยน
  const results: Partial<Record<Target, number>> = {};
  for (const t of ["w", "d", "h"] as Target[]) {
    const cm = lengthOf(lines[t]);
    if (cm) results[t] = cm;
  }
  const resultsKey = JSON.stringify(results);
  useEffect(() => {
    const r = JSON.parse(resultsKey) as Partial<Record<Target, number>>;
    for (const [t, cm] of Object.entries(r)) onResult(t as Target, cm as number);
    // onResult เปลี่ยนทุกครั้งที่ parent render — ยิงเฉพาะเมื่อค่าเปลี่ยน
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey]);

  const toImg = (e: React.PointerEvent) => {
    const el = imgRef.current!;
    const r = el.getBoundingClientRect();
    return {
      p: { x: ((e.clientX - r.left) / r.width) * el.naturalWidth, y: ((e.clientY - r.top) / r.height) * el.naturalHeight },
      local: { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height },
    };
  };
  const nearest = (p: Pt) => {
    const lim = size.w / 22;
    let best: { kind: "ref" | Target; i: number; d: number } | null = null;
    refPts.forEach((q, i) => {
      const d = dist(p, q);
      if (d < lim && (!best || d < best.d)) best = { kind: "ref", i, d };
    });
    for (const t of ["w", "d", "h"] as Target[])
      (lines[t] ?? []).forEach((q, i) => {
        const d = dist(p, q);
        if (d < lim && (!best || d < best.d)) best = { kind: t, i, d };
      });
    return best as { kind: "ref" | Target; i: number } | null;
  };
  const setPoint = (kind: "ref" | Target, i: number, p: Pt) => {
    if (kind === "ref") setRefPts((a) => a.map((q, k) => (k === i ? p : q)));
    else setLines((l) => ({ ...l, [kind]: (l[kind] ?? []).map((q, k) => (k === i ? p : q)) }));
  };
  const showLoupe = (e: React.PointerEvent) => {
    const { local } = toImg(e);
    setLoupe({ x: local.x, y: local.y, px: local.x / local.w, py: local.y / local.h, w: local.w, h: local.h });
  };

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (!imgRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { p } = toImg(e);
    const hit = nearest(p);
    if (hit) {
      setDrag(hit);
      showLoupe(e);
      return;
    }
    if (!refDone) {
      setRefPts((a) => [...a, p]);
      setDrag({ kind: "ref", i: refPts.length });
    } else {
      const cur = lines[target] ?? [];
      const next = cur.length >= 2 ? [p] : [...cur, p];
      setLines((l) => ({ ...l, [target]: next }));
      setDrag({ kind: target, i: next.length - 1 });
    }
    showLoupe(e);
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || !imgRef.current) return;
    setPoint(drag.kind, drag.i, toImg(e).p);
    showLoupe(e);
  }
  function up() {
    if (drag && drag.kind !== "ref" && (lines[drag.kind]?.length ?? 0) >= 2) {
      // วัดด้านนี้ครบแล้ว → ไปด้านถัดไปที่ยังไม่วัด
      const nextT = (["w", "d", "h"] as Target[]).find((t) => t !== drag.kind && !(lines[t]?.length === 2));
      if (nextT && drag.kind === target) setTarget(nextT);
    }
    setDrag(null);
    setLoupe(null);
  }

  if (!img)
    return (
      <div className="space-y-3 text-sm text-ink-700">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            วาง <b>กระดาษ A4</b> บนพื้นกลางห้อง (หรือใช้กระเบื้องพื้นแทนก็ได้)
          </li>
          <li>ยืนถือมือถือระดับอก ถ่ายให้เห็นทั้ง A4 และ <b>ขอบผนังสองฝั่งที่ติดพื้น</b> — ถ่ายเฉียงได้ ระบบแก้มุมให้</li>
          <li>แตะ 4 มุมของ A4 แล้วแตะขอบผนังซ้าย-ขวา → ได้ความกว้างจริง</li>
        </ol>
        <label className="btn btn-primary h-12 w-full cursor-pointer rounded-full">
          <Camera className="h-4 w-4" /> ถ่าย / เลือกรูป
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setImg(URL.createObjectURL(f));
              setRefPts([]);
              setLines({});
              setTarget("w");
            }}
          />
        </label>
        <p className="text-xs text-ink-500">วัดความสูง: แปะ A4 บนผนัง ถ่ายผนังตรงๆ แล้วแตะพื้นถึงฝ้า · จุดที่วัดต้องอยู่ระนาบเดียวกับ A4 (พื้นกับพื้น ผนังกับผนัง)</p>
      </div>
    );

  const sw = Math.max(3, size.w / 220);
  const r0 = Math.max(9, size.w / 70);
  const instr = !refDone
    ? isRect
      ? `แตะมุม${ref.label}ทีละมุม วนรอบ (${refPts.length}/4)${!squareRef && refPts.length < 2 ? " — เริ่มจากด้านยาว" : ""}`
      : `แตะปลาย 2 ข้างของ${ref.label} (${refPts.length}/2)`
    : `แตะ 2 จุดของ “${TARGET_LABEL[target]}” ${target === "h" ? "(พื้น → ฝ้า บนผนังเดียวกับ A4)" : "(ขอบผนังที่ติดพื้น)"} · ลากจุดเพื่อปรับ`;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {PHOTO_REFS.map((r) => (
          <button
            key={r.id}
            type="button"
            data-active={refId === r.id}
            onClick={() => {
              setRefId(r.id);
              setRefPts([]);
            }}
            className="chip min-h-9 text-xs"
          >
            {r.label}
          </button>
        ))}
      </div>
      {refId === "custom" && <input inputMode="decimal" value={customCm} onChange={(e) => setCustomCm(e.target.value)} placeholder="ความยาวของอ้างอิง (ซม.)" className="input h-10 w-full" />}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-ink-700">วัด:</span>
        {(["w", "d", "h"] as Target[]).map((t) => (
          <button key={t} type="button" data-active={target === t} onClick={() => setTarget(t)} className="chip min-h-9 text-xs">
            {TARGET_LABEL[t]}
            {results[t] ? ` ${results[t]} ซม.` : ""}
          </button>
        ))}
        {isRect && !squareRef && refDone && (
          <button type="button" onClick={() => setFirstLong((v) => !v)} className="chip min-h-9 text-xs" title="ถ้าตัวเลขดูผิดมาก ลองกด">
            สลับด้านยาว/สั้น
          </button>
        )}
      </div>
      <p className="rounded-xl bg-info-bg px-3 py-2 text-xs font-semibold text-ink-900">{instr}</p>
      <div className="relative touch-none select-none overflow-hidden rounded-2xl border border-ink-200" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={img}
          alt="รูปที่ใช้วัด"
          className="block w-full"
          draggable={false}
          onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none">
          {refPts.length >= 2 && (
            <polygon points={refPts.map((p) => `${p.x},${p.y}`).join(" ")} fill={isRect && refPts.length === 4 ? "rgba(245,158,11,0.25)" : "none"} stroke="#f59e0b" strokeWidth={sw} />
          )}
          {(["w", "d", "h"] as Target[]).map((t) => {
            const l = lines[t];
            if (!l?.length) return null;
            const col = t === "w" ? "#2563eb" : t === "d" ? "#16a34a" : "#db2777";
            return (
              <g key={t}>
                {l.length === 2 && <line x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y} stroke={col} strokeWidth={sw} />}
                {l.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={r0} fill={col} stroke="#fff" strokeWidth={sw} />
                ))}
                {l.length === 2 && results[t] && (
                  <text x={(l[0].x + l[1].x) / 2} y={(l[0].y + l[1].y) / 2 - r0 * 1.6} fill="#fff" stroke="#000" strokeWidth={sw / 1.5} paintOrder="stroke" fontSize={size.w / 26} fontWeight="bold" textAnchor="middle">
                    {TARGET_LABEL[t]} {results[t]} ซม.
                  </text>
                )}
              </g>
            );
          })}
          {refPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={r0} fill="#f59e0b" stroke="#fff" strokeWidth={sw} />
          ))}
        </svg>
        {/* แว่นขยายตอนแตะ/ลาก ให้วางจุดได้แม่น */}
        {loupe && (
          <div
            className="pointer-events-none absolute h-28 w-28 rounded-full border-4 border-white shadow-lg ring-1 ring-ink-300"
            style={{
              left: loupe.x - 56,
              top: Math.max(4, loupe.y - 150),
              backgroundImage: `url(${img})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${loupe.w * 3}px ${loupe.h * 3}px`,
              backgroundPosition: `${-(loupe.px * loupe.w * 3 - 56)}px ${-(loupe.py * loupe.h * 3 - 56)}px`,
            }}
          >
            <span className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-bad" />
            <span className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-bad" />
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
          className="btn btn-outline h-10 flex-1 rounded-full text-xs disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" /> ย้อน
        </button>
        <button
          type="button"
          onClick={() => {
            setImg(null);
            setRefPts([]);
            setLines({});
          }}
          className="btn btn-outline h-10 flex-1 rounded-full text-xs"
        >
          <Camera className="h-4 w-4" /> รูปใหม่
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- 3) นับกระเบื้อง ---------------------------- */
function TileMeasure({ onResult }: { onResult: (t: Target, cm: number) => void }) {
  const [tile, setTile] = useState(60);
  const [rows, setRows] = useState<Record<"w" | "d", { n: string; extra: string }>>({ w: { n: "", extra: "" }, d: { n: "", extra: "" } });
  const upd = (t: "w" | "d", k: "n" | "extra", v: string) => {
    const next = { ...rows, [t]: { ...rows[t], [k]: v.replace(/[^\d.]/g, "") } };
    setRows(next);
    const cm = lengthFromTiles(Number(next[t].n), tile, Number(next[t].extra) || 0);
    if (cm) onResult(t, cm);
  };
  return (
    <div className="space-y-3 text-sm text-ink-700">
      <p>นับกระเบื้องตามแนวผนังทั้งสองด้าน แผ่นที่ไม่เต็มให้วัดเศษเป็น ซม. (หรือเดาครึ่งแผ่น)</p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold">ขนาดกระเบื้อง</span>
        {[30, 40, 60, 80, 120].map((c) => (
          <button key={c} type="button" data-active={tile === c} onClick={() => setTile(c)} className="chip min-h-9 text-xs">
            {c} ซม.
          </button>
        ))}
      </div>
      {(["w", "d"] as const).map((t) => (
        <div key={t} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
          <span className="font-semibold text-ink-950">{TARGET_LABEL[t]}</span>
          <input inputMode="numeric" value={rows[t].n} onChange={(e) => upd(t, "n", e.target.value)} placeholder="จำนวนแผ่น" className="input h-10" />
          <input inputMode="numeric" value={rows[t].extra} onChange={(e) => upd(t, "extra", e.target.value)} placeholder="เศษ (ซม.)" className="input h-10" />
        </div>
      ))}
      <p className="text-xs text-ink-500">ความสูงห้องส่วนใหญ่ 2.6–3.0 ม. ใส่ในช่อง “สูง” ด้านล่างได้</p>
    </div>
  );
}
