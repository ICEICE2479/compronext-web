"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Copy, LayoutTemplate, Link2, Moon, PenTool, Plus, RotateCw, Search, Sparkles, Sun, Trash2, Undo2, Video, Wand2, X } from "lucide-react";
import { toast } from "@/lib/toast";
import Spinner from "@/components/Spinner";
import { CATEGORY_LABELS, formatTHB } from "@/lib/format";
import {
  alignItemToNearestWall,
  autoLayout,
  clampToRoom,
  encodePlan,
  footprint,
  inRoom,
  itemFromProduct,
  newUid,
  normalizeRotDeg,
  nudgeFree,
  placeNew,
  planWarnings,
  roomLabel,
  ROOM_TEMPLATES,
  rotateItemWithRiders,
  type PlanItem,
  type RoomSize,
} from "@/lib/room-planner";
import { presetShape, shapeBounds, type Pt2 } from "@/lib/room-shape";
import { loadShapes, removeShape, type SavedShape } from "@/lib/room-shapes-store";
import type { Product } from "@/lib/types";
import type { RoomPlanner3DHandle } from "./RoomPlanner3D";
import { displayPhotoSrc } from "@/lib/own-storage";

const RoomShapeTool = dynamic(() => import("./RoomShapeTool").then((m) => m.RoomShapeTool), { ssr: false });
const RoomPlanner3D = dynamic(() => import("./RoomPlanner3D").then((m) => m.RoomPlanner3D), {
  ssr: false,
  loading: () => (
    <div className="skeleton flex h-full items-center justify-center gap-2 text-sm text-ink-500">
      <Spinner size={20} /> กำลังสร้างห้อง 3D…
    </div>
  ),
});

/** ของทั่วไปที่เพิ่มเองได้ (ไว้แทนของที่มีอยู่แล้วในห้อง) */
const QUICK: string[] = ["desk", "chair", "bed", "wardrobe", "storage", "rug", "monitor", "keyboard", "mouse", "computer", "lighting", "fake_plant", "decor", "door"];
const LABEL: Record<string, string> = { ...(CATEGORY_LABELS as Record<string, string>), door: "ประตู" };
type Found = Pick<Product, "id" | "name" | "category" | "price" | "imageUrl" | "dimensions" | "colors">;

/**
 * โหมด "ห้อง 3D จัดเอง": ใส่ขนาดห้องที่วัดมา → AI วางของให้ก่อน → ลากปรับเองอิสระ
 * → ส่งภาพห้อง 3D ให้ AI วาดเป็นห้องจริง (ทางออกสำหรับคนที่ไม่มีรูป/กล้องไม่ชัด)
 */
export function RoomPlanStudio({
  room,
  items,
  setItems: setItemsRaw,
  onRoomChange,
  aiProducts,
  onUseAsPhoto,
}: {
  room: RoomSize;
  items: PlanItem[];
  setItems: (fn: (prev: PlanItem[]) => PlanItem[]) => void;
  onRoomChange: (r: RoomSize) => void;
  aiProducts: Product[];
  onUseAsPhoto: (blob: Blob, spots: Record<string, { x: number; y: number }>) => void;
}) {
  const ref = useRef<RoomPlanner3DHandle>(null);
  // ย้อนกลับได้ 40 ครั้ง
  const history = useRef<PlanItem[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const setItems = useCallback(
    (fn: (prev: PlanItem[]) => PlanItem[]) => {
      history.current = [...history.current.slice(-39), itemsRef.current];
      setCanUndo(true);
      setItemsRaw(fn);
    },
    [setItemsRaw]
  );
  function undo() {
    const prev = history.current.pop();
    if (!prev) return;
    setItemsRaw(() => prev);
    setCanUndo(history.current.length > 0);
  }
  // รูปห้อง: สี่เหลี่ยม / แบบสำเร็จรูป / แปลนที่วัดไว้ (หลายห้อง)
  const [shapes, setShapes] = useState<SavedShape[]>([]);
  const [shapeTool, setShapeTool] = useState(false);
  useEffect(() => queueMicrotask(() => setShapes(loadShapes())), [shapeTool]);
  function pickShape(shape: Pt2[] | null, h?: number) {
    const b = shape ? shapeBounds(shape) : null;
    const next: RoomSize = { ...room, ...(h ? { h } : {}), ...(b ? { w: b.w, d: b.d, shape: shape! } : {}) };
    if (!shape) delete next.shape;
    onRoomChange(next);
    // ของที่ล้นออกนอกห้องใหม่ → ย้ายเข้าที่ว่างใกล้สุด
    setItems((l) => l.map((it) => (inRoom(it, next) && it.x <= next.w && it.z <= next.d ? it : nudgeFree(clampToRoom(it, next), l, next))));
  }
  const sameShape = (s: Pt2[] | undefined) => JSON.stringify(s ?? null) === JSON.stringify(room.shape ?? null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);
  async function search(cat?: string) {
    if (!cat && q.trim().length < 2) return;
    setSearching(true);
    const params = new URLSearchParams(cat ? { cat } : { q: q.trim() });
    const r = await fetch(`/api/planner/products?${params}`)
      .then((x) => x.json())
      .catch(() => ({ products: [] }));
    setFound(r.products ?? []);
    setSearching(false);
  }
  function applyTemplate(id: string) {
    const t = ROOM_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    if (items.length && !window.confirm("แทนที่ของในห้องตอนนี้ด้วยชุดสำเร็จรูป?")) return;
    setItems(() => autoLayout(t.items.map((c) => ({ ...itemFromProduct({ id: "", name: LABEL[c] ?? c, category: c }), productId: null })), room));
    setSelected(null);
    setAdding(false);
  }
  async function share() {
    const url = `${window.location.origin}/design?plan=${encodePlan(room, items)}`;
    try {
      if (navigator.share) await navigator.share({ title: "ห้อง 3D ของฉัน — ComproNext", url });
      else {
        await navigator.clipboard.writeText(url);
        toast("คัดลอกลิงก์ห้องแล้ว ส่งให้เพื่อนได้เลย");
      }
    } catch {
      /* ผู้ใช้ยกเลิก */
    }
  }
  const [selected, setSelected] = useState<string | null>(null);
  const [night, setNight] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const sel = items.find((i) => i.uid === selected) ?? null;
  const [rotInput, setRotInput] = useState<string>("0");
  const rotEditingRef = useRef(false);
  const rotUndoRef = useRef(false);

  useEffect(() => {
    if (!sel || rotEditingRef.current) return;
    const norm = normalizeRotDeg(sel.rot);
    setRotInput(Number.isInteger(norm) ? String(norm) : norm.toFixed(1));
  }, [sel?.uid, sel?.rot]);

  const warnings = useMemo(() => planWarnings(items, room), [items, room]);
  const total = items.reduce((s, i) => s + (i.productId ? i.price : 0), 0);
  const notInPlan = aiProducts.filter((p) => !items.some((i) => i.productId === p.id));

  const onMove = useCallback(
    (uid: string, x: number, z: number, y: number, rot?: number) =>
      setItems((list) =>
        list.map((i) =>
          i.uid === uid
            ? { ...i, x, z, y, ...(rot !== undefined ? { rot: normalizeRotDeg(rot) } : {}) }
            : i
        )
      ),
    [setItems]
  );
  const onBatchMove = useCallback(
    (moves: Array<{ uid: string; x: number; z: number; y: number; rot: number }>) => {
      const byId = new Map(moves.map((m) => [m.uid, m]));
      setItems((list) =>
        list.map((i) => {
          const mv = byId.get(i.uid);
          return mv ? { ...i, x: mv.x, z: mv.z, y: mv.y, rot: normalizeRotDeg(mv.rot) } : i;
        })
      );
    },
    [setItems]
  );

  const applyLiveRot = useCallback(
    (rawDeg: number, syncText: boolean) => {
      if (!selected || !Number.isFinite(rawDeg)) return;
      const norm = normalizeRotDeg(rawDeg);
      if (!rotUndoRef.current) {
        rotUndoRef.current = true;
        history.current = [...history.current.slice(-39), itemsRef.current];
        setCanUndo(true);
      }
      setItemsRaw((prev) => rotateItemWithRiders(selected, norm, prev, room));
      if (syncText) {
        setRotInput(Number.isInteger(norm) ? String(norm) : norm.toFixed(1));
      }
    },
    [selected, room, setItemsRaw]
  );

  // กดปุ่ม R เพื่อหมุนสิ่งของที่เลือก (+45° หรือ Shift+R = -45°)
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.code === "KeyR" || e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const delta = e.shiftKey ? -45 : 45;
        setItems((prev) => {
          const cur = prev.find((i) => i.uid === selected);
          return cur ? rotateItemWithRiders(selected, cur.rot + delta, prev, room) : prev;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, room, setItems]);

  function addItems(next: PlanItem[]) {
    // วางของใหม่ให้อัตโนมัติ (ไม่ขยับของเดิม)
    const placed = placeNew(items, next, room);
    setItems((list) => [...list, ...placed]);
    setSelected(placed[placed.length - 1]?.uid ?? null);
    setAdding(false);
  }

  async function sendToAi() {
    setBusy(true);
    setSelected(null);
    await new Promise((r) => setTimeout(r, 60)); // รอกรอบเลือกหายก่อนถ่ายภาพ
    const shot = await ref.current?.snapshot();
    setBusy(false);
    if (shot) onUseAsPhoto(shot.blob, shot.spots);
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-b from-ink-50 to-ink-100">
        <RoomPlanner3D ref={ref} room={room} items={items} selected={selected} night={night} onSelect={setSelected} onMove={onMove} onBatchMove={onBatchMove} />
        <span className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-12.5rem)] truncate rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-ink-700 shadow-sm">
          ห้อง {roomLabel(room)}
        </span>
        <div className="absolute right-3 top-3 flex gap-1.5">
          <button type="button" onClick={() => setNight((v) => !v)} aria-pressed={night} className="icon-btn h-9 w-9 bg-surface/90 p-0" aria-label={night ? "โหมดกลางวัน" : "โหมดกลางคืน"} title={night ? "กลางวัน" : "กลางคืน (ไฟ RGB)"}>
            {night ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => ref.current?.resetView()} className="icon-btn h-9 w-9 bg-surface/90 p-0" aria-label="มุมกล้องเริ่มต้น" title="มุมกล้องเริ่มต้น">
            <Video className="h-4 w-4" />
          </button>
          <button type="button" disabled={!canUndo} onClick={undo} className="icon-btn h-9 w-9 bg-surface/90 p-0 disabled:opacity-40" aria-label="ย้อนกลับ" title="ย้อนกลับ">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" disabled={!items.length} onClick={share} className="icon-btn h-9 w-9 bg-surface/90 p-0 disabled:opacity-40" aria-label="แชร์ห้องนี้" title="แชร์ลิงก์ห้อง">
            <Link2 className="h-4 w-4" />
          </button>
        </div>

        {!sel && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 px-3 text-center text-[11px] text-ink-600">
            {items.length ? "แตะของเพื่อเลือก · ลากชิดกำแพงเพื่อหมุนตามองศาอัตโนมัติ · กด R หมุนของ" : "ห้องยังว่าง — กด “เพิ่มของ” หรือให้ AI จัดห้องก่อน"}
          </p>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/40 text-sm font-semibold text-white">
            <Spinner size={22} />
          </div>
        )}
      </div>

      {/* แถบจัดการชิ้นที่เลือก (อยู่ใต้ฉาก ไม่บังห้อง) */}
      {sel && (
        <div className="scene-chip space-y-2 rounded-2xl bg-surface/95 p-2.5 pl-3 shadow-sm ring-1 ring-ink-200">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink-950">{sel.name}</p>
              <p className="text-[11px] text-ink-600">
                {footprint(sel).w} × {footprint(sel).d} ซม. · หมุน{" "}
                {Number.isInteger(normalizeRotDeg(sel.rot))
                  ? `${normalizeRotDeg(sel.rot)}°`
                  : `${normalizeRotDeg(sel.rot).toFixed(1)}°`}
                {sel.estimated ? " (ขนาดโดยประมาณ)" : ""}
                {sel.productId && sel.price ? ` · ${formatTHB(sel.price)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setItems((prev) => rotateItemWithRiders(sel.uid, sel.rot + 45, prev, room))}
              className="btn btn-outline h-9 rounded-xl px-2.5 text-xs font-semibold"
              aria-label="หมุน 45 องศา"
              title="หมุน +45° (หรือกด R)"
            >
              <RotateCw className="h-3.5 w-3.5" /> R +45°
            </button>
            <button
              type="button"
              onClick={() => {
                const copy = nudgeFree(
                  alignItemToNearestWall(
                    clampToRoom({ ...sel, uid: newUid(), x: sel.x + 25, z: sel.z + 25 }, room),
                    room,
                    items
                  ),
                  items,
                  room
                );
                setItems((l) => [...l, copy]);
                setSelected(copy.uid);
              }}
              className="icon-btn h-10 w-10 p-0"
              aria-label="ทำซ้ำ"
              title="ทำซ้ำ"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setItems((l) => l.filter((i) => i.uid !== sel.uid));
                setSelected(null);
              }}
              className="icon-btn h-10 w-10 p-0 text-bad"
              aria-label="เอาออก"
              title="เอาออก"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-2 text-xs">
            <span className="font-semibold text-ink-600">กำหนดองศา:</span>
            <input
              type="range"
              min={0}
              max={359.9}
              step={0.5}
              value={normalizeRotDeg(sel.rot)}
              onPointerDown={() => {
                rotUndoRef.current = false;
              }}
              onPointerUp={() => {
                rotUndoRef.current = false;
              }}
              onChange={(e) => applyLiveRot(parseFloat(e.target.value), true)}
              className="range min-w-[7rem] flex-1"
              aria-label="เลื่อนปรับองศาหมุนแบบเรียลไทม์"
            />
            <div className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-surface px-2 py-0.5">
              <input
                type="number"
                min={0}
                max={360}
                step={0.5}
                value={rotInput}
                onFocus={(e) => {
                  rotEditingRef.current = true;
                  rotUndoRef.current = false;
                  e.currentTarget.select();
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setRotInput(val);
                  if (val.trim() === "" || val === "-") return;
                  const parsed = parseFloat(val);
                  if (Number.isFinite(parsed)) {
                    applyLiveRot(parsed, false);
                  }
                }}
                onBlur={() => {
                  rotEditingRef.current = false;
                  rotUndoRef.current = false;
                  const parsed = parseFloat(rotInput);
                  if (Number.isFinite(parsed)) {
                    applyLiveRot(parsed, true);
                  } else {
                    const norm = normalizeRotDeg(sel.rot);
                    setRotInput(Number.isInteger(norm) ? String(norm) : norm.toFixed(1));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-14 bg-transparent text-center font-mono text-xs font-bold text-info focus:outline-none"
                aria-label="พิมพ์องศาหมุน"
              />
              <span className="font-mono text-xs font-bold text-ink-500">°</span>
            </div>
            <span className="font-mono text-[11px] font-bold text-info">
              หมุนแล้ว{" "}
              {Number.isInteger(normalizeRotDeg(sel.rot))
                ? `${normalizeRotDeg(sel.rot)}°`
                : `${normalizeRotDeg(sel.rot).toFixed(1)}°`}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="btn btn-outline h-11 rounded-full px-4">
          <Plus className="h-4 w-4" /> เพิ่มของ
        </button>
        {items.length > 1 && (
          <button type="button" onClick={() => setItems((l) => autoLayout(l, room))} className="btn btn-outline h-11 rounded-full px-4">
            <Wand2 className="h-4 w-4" /> จัดวางให้ใหม่
          </button>
        )}
        <button type="button" disabled={!items.length || busy} onClick={sendToAi} className="btn btn-primary h-11 flex-1 rounded-full px-4 disabled:opacity-50">
          <Sparkles className="h-4 w-4" /> ให้ AI วาดเป็นห้องจริง
        </button>
      </div>

      {adding && (
        <div className="scene-chip card space-y-3 p-3">
          <div className="space-y-1.5">
            <p className="flex items-center gap-1 text-xs font-semibold text-ink-700">
              <LayoutTemplate className="h-3.5 w-3.5" /> จัดทั้งห้องด้วยชุดสำเร็จรูป
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ROOM_TEMPLATES.map((t) => (
                <button key={t.id} type="button" onClick={() => applyTemplate(t.id)} className="chip min-h-10 text-xs">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-ink-700">ค้นสินค้าจริงมาวาง (ขนาดตามสินค้า)</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
              className="flex gap-2"
            >
              <label className="relative flex-1">
                <span className="sr-only">ค้นสินค้า</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เช่น โต๊ะ IKEA, เก้าอี้เกมมิ่ง" className="input h-10 w-full pl-9" />
              </label>
              <button type="submit" className="btn btn-outline h-10 rounded-full px-4 text-sm">
                {searching ? <Spinner size={14} /> : "ค้นหา"}
              </button>
            </form>
            {found && (
              <ul className="max-h-60 space-y-1 overflow-y-auto">
                {found.length === 0 && <li className="text-xs text-ink-500">ไม่พบสินค้า ลองคำอื่น</li>}
                {found.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => addItems([itemFromProduct(p)])} className="flex w-full items-center gap-2 rounded-xl p-1.5 text-left hover:bg-ink-50">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-media">
                        {p.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={displayPhotoSrc(p.imageUrl)} alt="" width={40} height={40} loading="lazy" className="max-h-full max-w-full object-contain" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-ink-950">{p.name}</span>
                        <span className="text-[11px] text-ink-600">
                          {formatTHB(p.price)}
                          {p.dimensions?.width ? ` · ${p.dimensions.width}×${p.dimensions.depth ?? "?"} ซม.` : " · ขนาดโดยประมาณ"}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-info" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {notInPlan.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-ink-700">ของที่ AI แนะนำ</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => addItems(notInPlan.map(itemFromProduct))} className="chip min-h-10 text-xs" data-active>
                  ใส่ทั้งหมด ({notInPlan.length})
                </button>
                {notInPlan.map((p) => (
                  <button key={p.id} type="button" onClick={() => addItems([itemFromProduct(p)])} className="chip min-h-10 max-w-[14rem] truncate text-xs">
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-ink-700">ของทั่วไป (เช่น ของที่มีอยู่แล้วในห้อง)</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((c) => (
                <button key={c} type="button" onClick={() => addItems([{ ...itemFromProduct({ id: "", name: LABEL[c] ?? c, category: c }), productId: null }])} className="chip min-h-10 text-xs">
                  {LABEL[c] ?? c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="mr-0.5 font-semibold text-ink-700">รูปห้อง</span>
        <button type="button" data-active={!room.shape} onClick={() => pickShape(null)} className="chip min-h-9 text-xs">
          สี่เหลี่ยม
        </button>
        {(
          [
            ["L", "ตัว L"],
            ["Lr", "ตัว L กลับ"],
          ] as const
        ).map(([k, label]) => {
          const s = presetShape(k, room.w, room.d);
          return (
            <button key={k} type="button" data-active={sameShape(s)} onClick={() => pickShape(s)} className="chip min-h-9 text-xs">
              {label}
            </button>
          );
        })}
        {shapes.map((s) => (
          <span key={s.id} className="inline-flex items-center">
            <button type="button" data-active={sameShape(s.shape)} onClick={() => pickShape(s.shape, s.h)} className="chip min-h-9 max-w-[10rem] truncate rounded-r-none text-xs" title={`แปลนที่วัดไว้: ${s.name}`}>
              {s.name}
            </button>
            <button type="button" onClick={() => setShapes(removeShape(s.id))} className="chip min-h-9 rounded-l-none border-l-0 px-2 text-xs" aria-label={`ลบแปลน ${s.name}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button type="button" onClick={() => setShapeTool(true)} className="chip min-h-9 text-xs font-semibold text-info">
          <PenTool className="h-3.5 w-3.5" /> วัดรูปห้องจริง
        </button>
      </div>
      {shapeTool && <RoomShapeTool room={room} onApply={(r) => pickShape(r.shape ?? null, r.h)} onClose={() => setShapeTool(false)} />}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-ink-700">หน้าต่าง</span>
        {(
          [
            ["back", "ผนังหลัง"],
            ["left", "ผนังซ้าย"],
            ["none", "ไม่มี"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" data-active={(room.win?.wall ?? "back") === k} onClick={() => onRoomChange({ ...room, win: { wall: k, pos: (room.win?.wall ?? "back") === k ? (room.win?.pos ?? 0.68) : k === "left" ? 0.35 : 0.68 } })} className="chip min-h-9 text-xs">
            {label}
          </button>
        ))}
        {(room.win?.wall ?? "back") !== "none" && (
          <input
            type="range"
            min={15}
            max={85}
            value={Math.round((room.win?.pos ?? 0.68) * 100)}
            onChange={(e) => onRoomChange({ ...room, win: { wall: room.win?.wall ?? "back", pos: Number(e.target.value) / 100 } })}
            aria-label="เลื่อนตำแหน่งหน้าต่าง"
            className="range min-w-[8rem] flex-1"
          />
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-warn-bg p-3 text-xs text-ink-900">
          {warnings.map((w, i) => (
            <li key={i} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
              <button type="button" className="text-left hover:underline" onClick={() => w.uid && setSelected(w.uid)}>
                {w.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <p className="text-[11px] text-ink-500">
          ในห้อง {items.length} ชิ้น{total ? ` · สินค้าที่แนะนำรวม ${formatTHB(total)}` : ""} · ของที่ไม่มีข้อมูลขนาดใช้ขนาดโดยประมาณ · ห้องจำไว้ในเครื่องนี้
        </p>
      )}
    </div>
  );
}
