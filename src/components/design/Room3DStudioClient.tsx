"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Copy,
  Layers,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Moon,
  PackagePlus,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  ShoppingBag,
  Sun,
  Trash2,
  Undo2,
  Unlock,
  X,
  Compass,
  Clock,
  Thermometer,
  ChevronDown,
} from "lucide-react";
import { toast, openCartDrawer } from "@/lib/toast";
import Spinner from "@/components/Spinner";
import { CATEGORY_LABELS, formatTHB } from "@/lib/format";
import {
  alignItemToNearestWall,
  autoLayout,
  clampToRoom,
  DEFAULT_ROOM,
  findNearestWallForItem,
  itemFromProduct,
  newUid,
  normalizeRotDeg,
  nudgeFree,
  placeNew,
  rotateItemWithRiders,
  type PlanItem,
  type RoomSize,
} from "@/lib/room-planner";
import { addToCart, type CartInput } from "@/lib/cart-store";
import type { Product } from "@/lib/types";
import { MyDreamSetupBlueprint, type BlueprintDoor, type BlueprintWindow } from "./MyDreamSetupBlueprint";
import type { RoomPlanner3DHandle } from "./RoomPlanner3D";
import { displayPhotoSrc } from "@/lib/own-storage";
import {
  DEFAULT_SUN_SETTINGS,
  degToCardinal,
  analyzeWindowSunlight,
  type SunSettings,
} from "@/lib/sun-simulation";
import { getEdgeInfo } from "@/lib/blueprint-geometry";

const RoomPlanner3D = dynamic(
  () => import("./RoomPlanner3D").then((m) => m.RoomPlanner3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center gap-3 bg-slate-900 text-white">
        <Spinner size={24} />
        <span className="font-mono text-sm tracking-wider">กำลังเรนเดอร์ห้อง 3D...</span>
      </div>
    ),
  }
);

interface FoundProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string | null;
  dimensions?: { width: number; depth: number; height: number; unit: string };
  colors?: string[];
  storeName?: string;
  platform?: string;
  buyUrl?: string;
}

// Categories list for quick filtering
const CATEGORIES = [
  { id: "all", label: "🌟 ทั้งหมด" },
  { id: "desk", label: "🖥️ โต๊ะคอม" },
  { id: "chair", label: "💺 เก้าอี้ทำงาน" },
  { id: "computer", label: "💻 คอมพิวเตอร์/เคส" },
  { id: "monitor", label: "📺 จอคอม" },
  { id: "keyboard", label: "⌨️ คีย์บอร์ด" },
  { id: "mouse", label: "🖱️ เมาส์" },
  { id: "mousepad", label: "⬛ แผ่นรองเมาส์" },
  { id: "headphone", label: "🎧 หูฟัง" },
  { id: "speaker", label: "🔊 ลำโพง" },
  { id: "microphone", label: "🎙️ ไมค์" },
  { id: "lighting", label: "💡 โคมไฟ & ไฟเส้น" },
  { id: "wardrobe", label: "🚪 ตู้เสื้อผ้า" },
  { id: "storage", label: "🗄️ ชั้นวาง & ลิ้นชัก" },
  { id: "bed", label: "🛏️ เตียงนอน" },
  { id: "rug", label: "🧶 พรมปูพื้น" },
  { id: "fake_plant", label: "🪴 ต้นไม้ตกแต่ง" },
  { id: "decor", label: "🖼️ ของตกแต่ง" },
];

export function Room3DStudioClient() {
  // Mode: "blueprint" (2D room plan) or "studio" (3D room)
  const [mode, setMode] = useState<"blueprint" | "studio">("blueprint");

  // Doors & Windows
  const [doors, setDoors] = useState<BlueprintDoor[]>([
    { id: "d-1", edgeIndex: 1, wall: "right", pos: 0.7, width: 80 },
  ]);
  const [windows, setWindows] = useState<BlueprintWindow[]>([
    { id: "w-1", edgeIndex: 0, wall: "top", pos: 0.4, width: 120 },
  ]);

  // Room size & shape
  const [room, setRoom] = useState<RoomSize>({
    w: 350,
    d: 400,
    h: 260,
    orientation: DEFAULT_SUN_SETTINGS.orientationDeg,
    sunSettings: DEFAULT_SUN_SETTINGS,
    win: { wall: "back", pos: 0.4 },
    windows: [{ id: "w-1", edgeIndex: 0, wall: "top", pos: 0.4, width: 120 }],
    doors: [{ id: "d-1", edgeIndex: 1, wall: "right", pos: 0.7, width: 80 }],
  });

  // Items placed in 3D room
  const [items, setItemsState] = useState<PlanItem[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [night, setNight] = useState(false);
  const [sunSettings, setSunSettings] = useState<SunSettings>(DEFAULT_SUN_SETTINGS);
  const [compass3DInput, setCompass3DInput] = useState<string>(
    Number(DEFAULT_SUN_SETTINGS.orientationDeg.toFixed(1)).toFixed(1)
  );
  const [sun3DPanelOpen, setSun3DPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const productsMap = useRef<Map<string, FoundProduct>>(new Map());

  // Undo history
  const historyRef = useRef<PlanItem[][]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const planner3DRef = useRef<RoomPlanner3DHandle>(null);

  // Catalog Drawer state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const [products, setProducts] = useState<FoundProduct[]>([]);
  const [searching, setSearching] = useState(false);

  // Update items with undo history
  const setItems = useCallback((fn: (prev: PlanItem[]) => PlanItem[]) => {
    setItemsState((prev) => {
      historyRef.current = [...historyRef.current.slice(-39), prev];
      setCanUndo(true);
      return fn(prev);
    });
  }, []);

  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setItemsState(prev);
    setCanUndo(historyRef.current.length > 0);
    toast("ย้อนกลับแล้ว");
  };

  // Fetch catalog products
  const fetchProducts = useCallback(async (cat: string, q: string) => {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (cat && cat !== "all") params.set("cat", cat);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "36");

      const res = await fetch(`/api/planner/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch {
      // fallback
    } finally {
      setSearching(false);
    }
  }, []);

  // Fetch products on cat/query change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(selectedCat, searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedCat, searchQuery, fetchProducts]);

  // Sync blueprint changes cleanly without causing parent-child render loops
  const handleBlueprintChange = useCallback(
    (
      nextRoom: RoomSize,
      nextDoors: BlueprintDoor[],
      nextWindows: BlueprintWindow[],
      nextSunSettings: SunSettings
    ) => {
      setRoom(nextRoom);
      setDoors(nextDoors);
      setWindows(nextWindows);
      setSunSettings(nextSunSettings);
      setCompass3DInput(Number(nextSunSettings.orientationDeg.toFixed(1)).toFixed(1));
      setNight(nextSunSettings.timeHour >= 19 || nextSunSettings.timeHour < 6);
    },
    []
  );

  // Update sun settings from inside 3D Studio while keeping room.sunSettings in sync
  const updateSunInStudio = useCallback((updater: (prev: SunSettings) => SunSettings) => {
    setSunSettings((prev) => {
      const next = updater(prev);
      setNight(next.timeHour >= 19 || next.timeHour < 6);
      setCompass3DInput(Number(next.orientationDeg.toFixed(1)).toFixed(1));
      setRoom((r) => ({
        ...r,
        orientation: next.orientationDeg,
        sunSettings: next,
      }));
      return next;
    });
  }, []);

  const setStudioOrientation01 = useCallback(
    (rawDeg: number) => {
      const normalized = (Math.round((((rawDeg % 360) + 360) % 360) * 10) / 10) % 360;
      updateSunInStudio((prev) => ({ ...prev, orientationDeg: normalized }));
    },
    [updateSunInStudio]
  );

  // Live solar & indoor/outdoor temperature analysis
  const sunAnalysis = useMemo(() => {
    const shape = room.shape;
    return analyzeWindowSunlight(
      sunSettings,
      windows.map((w) => {
        let outwardBaseDeg: number | undefined;
        if (shape && shape.length >= 3 && w.edgeIndex !== undefined && w.edgeIndex < shape.length) {
          outwardBaseDeg = getEdgeInfo(shape, w.edgeIndex).outwardBaseDeg;
        }
        return {
          wall: w.wall,
          pos: w.pos,
          width: w.width,
          outwardBaseDeg,
        };
      })
    );
  }, [sunSettings, windows, room.shape]);

  // Add a product to the 3D room
  const handleAddProduct = (prod: FoundProduct) => {
    productsMap.current.set(prod.id, prod);
    const item = itemFromProduct({
      id: prod.id,
      name: prod.name,
      category: prod.category,
      price: prod.price,
      dimensions: prod.dimensions,
      colors: prod.colors,
    });

    setItems((prev) => {
      const placed = placeNew(prev, [item], room);
      return [...prev, ...placed];
    });

    setSelectedUid(item.uid);
    toast(`วาง “${prod.name.slice(0, 30)}...” ในห้อง 3D แล้ว!`, {
      tone: "ok",
    });
  };

  // Item manipulation
  const selectedItem = useMemo(() => {
    return items.find((i) => i.uid === selectedUid) || null;
  }, [items, selectedUid]);

  // Live custom rotation angle input state (synced with selected item & updated live as user types)
  const [rotInput, setRotInput] = useState<string>("0");
  const rotEditingRef = useRef(false);
  const rotUndoRecordedRef = useRef(false);

  useEffect(() => {
    if (!selectedItem || rotEditingRef.current) return;
    const norm = normalizeRotDeg(selectedItem.rot);
    setRotInput(Number.isInteger(norm) ? String(norm) : norm.toFixed(1));
  }, [selectedItem?.uid, selectedItem?.rot]);

  const recordRotationUndoOnce = useCallback(() => {
    if (rotUndoRecordedRef.current) return;
    rotUndoRecordedRef.current = true;
    setItemsState((prev) => {
      historyRef.current = [...historyRef.current.slice(-39), prev];
      setCanUndo(true);
      return prev;
    });
  }, []);

  const applyLiveAngle = useCallback(
    (rawDeg: number, syncInputText: boolean) => {
      if (!selectedUid || !Number.isFinite(rawDeg)) return;
      const norm = normalizeRotDeg(rawDeg);
      setItemsState((prev) => rotateItemWithRiders(selectedUid, norm, prev, room, true));
      if (syncInputText) {
        setRotInput(Number.isInteger(norm) ? String(norm) : norm.toFixed(1));
      }
    },
    [selectedUid, room]
  );

  const handleRotate = useCallback(
    (angle: number) => {
      if (!selectedUid) return;
      setItems((prev) => {
        const cur = prev.find((i) => i.uid === selectedUid);
        if (!cur) return prev;
        return rotateItemWithRiders(selectedUid, cur.rot + angle, prev, room, true);
      });
      toast(`หมุน ${angle > 0 ? `+${angle}` : angle}° (ล็อกมุมแล้ว ไม่เด้งกลับตอนเลื่อน)`, { tone: "ok" });
    },
    [selectedUid, room, setItems]
  );

  const handleAlignToWall = useCallback(() => {
    if (!selectedUid) return;
    const cur = items.find((i) => i.uid === selectedUid);
    if (!cur) return;
    const near = findNearestWallForItem(cur, room, 200);
    if (!near) {
      toast("ขยับสิ่งของเข้าใกล้กำแพงที่ต้องการก่อนนะครับ");
      return;
    }
    setItems((prev) => rotateItemWithRiders(selectedUid, near.targetRot, prev, room, false));
    toast(`ปรับหมุนตามองศากำแพง (${near.targetRot}°) แล้ว`);
  }, [selectedUid, items, room, setItems]);

  const handleToggleRotLock = useCallback(() => {
    if (!selectedUid) return;
    setItems((prev) =>
      prev.map((i) => (i.uid === selectedUid ? { ...i, rotLocked: !i.rotLocked } : i))
    );
    const item = items.find((i) => i.uid === selectedUid);
    const nextLocked = !item?.rotLocked;
    toast(
      nextLocked
        ? "🔒 ล็อกมุมหมุนแล้ว (เวลาเลื่อนของมุมจะไม่เด้งกลับ)"
        : "🔓 ปลดล็อกมุมหมุน (จะหมุนตามองศากำแพงอัตโนมัติเมื่อวางใกล้)",
      { tone: "ok" }
    );
  }, [selectedUid, items, setItems]);

  const handleToggleAltitude = () => {
    if (!selectedUid) return;
    setItems((prev) =>
      prev.map((i) => {
        if (i.uid !== selectedUid) return i;
        // Toggle between floor (0) and desk height (~75cm) while keeping away from walls
        const nextY = i.y > 10 ? 0 : 75;
        return clampToRoom({ ...i, y: nextY }, room);
      })
    );
  };

  const handleDuplicate = () => {
    if (!selectedItem) return;
    setItems((prev) => {
      const shifted = alignItemToNearestWall(
        clampToRoom(
          {
            ...selectedItem,
            uid: newUid(),
            x: selectedItem.x + 25,
            z: selectedItem.z + 25,
          },
          room
        ),
        room,
        prev
      );
      const dup = nudgeFree(shifted, prev, room);
      setSelectedUid(dup.uid);
      return [...prev, dup];
    });
    toast("ทำสำเนาสินค้าแล้ว");
  };

  const handleDeleteItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
    if (selectedUid === uid) setSelectedUid(null);
    toast("ลบสินค้าออกจากห้องแล้ว");
  };

  // Color options
  const handleColorChange = (hex: string) => {
    if (!selectedUid) return;
    setItems((prev) =>
      prev.map((i) => (i.uid === selectedUid ? { ...i, color: hex } : i))
    );
  };

  // Total room price calculation
  const { totalRoomPrice, productCount } = useMemo(() => {
    const valid = items.filter((i) => i.category !== "door" && i.price > 0);
    const sum = valid.reduce((acc, cur) => acc + (cur.price || 0), 0);
    return { totalRoomPrice: sum, productCount: valid.length };
  }, [items]);

  // Add all room products to cart
  const handleAddSetupToCart = () => {
    const valid = items.filter((i) => i.productId && i.price > 0);
    if (valid.length === 0) {
      toast("ยังไม่มีสินค้าที่มีราคาในห้อง 3D", { tone: "error" });
      return;
    }

    const cartInputs: CartInput[] = valid.map((it) => {
      const p = it.productId ? productsMap.current.get(it.productId) : undefined;
      return {
        id: it.productId!,
        name: it.name,
        price: it.price,
        imageUrl: p?.imageUrl || null,
        buyUrl: p?.buyUrl || `/products/${it.productId}`,
        storeName: p?.storeName || "พาร์ตเนอร์ ComproNext",
        category: it.category,
        quantity: 1,
      };
    });

    addToCart(cartInputs);
    openCartDrawer();
    toast(`ใส่สินค้าทั้งห้อง ${valid.length} ชิ้นลงตะกร้าแล้ว! 🎉`, {
      tone: "ok",
    });
  };

  // Toggle Fullscreen Studio Mode (combines fixed viewport fullscreen + native Browser Fullscreen API)
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (typeof document !== "undefined") {
        if (next) {
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {
              // Fallback: CSS fixed inset-0 z-[55] still fills 100% viewport
            });
          }
        } else if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Sync browser fullscreenchange (e.g. pressing Esc), keyboard shortcuts F and R, and body scroll lock
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (!isTyping && (e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleFullscreen();
      } else if (
        !isTyping &&
        mode === "studio" &&
        selectedUid &&
        (e.code === "KeyR" || e.key === "r" || e.key === "R") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        handleRotate(e.shiftKey ? -45 : 45);
      } else if (e.key === "Escape" && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen, toggleFullscreen, mode, selectedUid, handleRotate]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  // Transition from Blueprint to 3D Room (clamp & nudge all items out of updated walls)
  const handleProceedTo3D = () => {
    setItemsState((prev) => {
      const cleaned = prev.filter((it) => it.category !== "door");
      const safe: PlanItem[] = [];
      for (const it of cleaned) {
        safe.push(nudgeFree(clampToRoom(it, room), safe, room));
      }
      return safe;
    });
    setMode("studio");
    toast("เข้าสู่ห้อง 3D เรียบร้อย! เลือกวางสินค้าจากแถบคลังสินค้าได้เลย", {
      tone: "ok",
    });
  };

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[55] flex h-dvh w-screen flex-col overflow-hidden bg-slate-950"
          : "flex flex-col"
      }
    >
      {/* View Mode: Blueprint vs Studio */}
      {mode === "blueprint" ? (
        <div className={isFullscreen ? "flex flex-1 min-h-0 w-full" : "w-full"}>
          <MyDreamSetupBlueprint
            room={room}
            doors={doors}
            windows={windows}
            sunSettings={sunSettings}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onChange={handleBlueprintChange}
            onProceedTo3D={handleProceedTo3D}
          />
        </div>
      ) : (
        <div
          className={`relative flex flex-col overflow-hidden bg-surface ${
            isFullscreen
              ? "h-full flex-1 rounded-none border-0"
              : "h-[calc(100dvh-5.25rem)] min-h-[600px] rounded-2xl border border-ink-200 shadow-xl"
          }`}
        >
          {/* Top 3D Control Bar */}
          <div className="relative z-30 flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 bg-surface/95 px-3.5 py-2 backdrop-blur-md sm:px-5">
            <div className="flex items-center gap-2.5">
              {/* Back to Blueprint Button */}
              <button
                type="button"
                onClick={() => setMode("blueprint")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-info/35 bg-info/10 px-3 py-1.5 text-xs font-bold text-info hover:bg-info hover:text-white transition-all"
              >
                <PenTool className="h-3.5 w-3.5" />
                แก้แปลนห้อง
              </button>

              <span className="text-xs font-medium text-ink-500 hidden md:inline">
                {Number((room.w / 100).toFixed(2))} × {Number((room.d / 100).toFixed(2))} ม. · สูง{" "}
                {Number((room.h / 100).toFixed(2))} ม.
              </span>
            </div>

            {/* Quick Actions & Toggles */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Sun & Compass Floating Popover Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSun3DPanelOpen((v) => !v)}
                  title="ปรับทิศห้อง แสงแดด และอุณหภูมิ"
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    sun3DPanelOpen
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : "bg-ink-100 text-ink-800 hover:bg-ink-200"
                  }`}
                >
                  <Sun className="h-3.5 w-3.5 text-amber-600" />
                  <span className="font-mono">
                    {Math.floor(sunSettings.timeHour).toString().padStart(2, "0")}:
                    {Math.round((sunSettings.timeHour % 1) * 60)
                      .toString()
                      .padStart(2, "0")}{" "}
                    · {degToCardinal(sunSettings.orientationDeg).cardinal}{" "}
                    {Number(sunSettings.orientationDeg.toFixed(1))}° · ~{sunAnalysis.roomTempC}°C
                  </span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${sun3DPanelOpen ? "rotate-180" : ""}`} />
                </button>

                {sun3DPanelOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-[310px] sm:w-[356px] space-y-3 rounded-2xl border border-ink-200 bg-surface p-4 text-xs text-ink-900 shadow-pop">
                    <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                      <span className="font-bold text-sm text-ink-950">ทิศห้อง แสงแดด & อุณหภูมิ</span>
                      <button
                        type="button"
                        onClick={() => setSun3DPanelOpen(false)}
                        className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1 font-semibold text-ink-600">
                          <Compass className="h-3.5 w-3.5 text-info" /> ทิศห้อง
                        </span>
                        <span className="font-mono font-bold text-info">
                          {degToCardinal(sunSettings.orientationDeg).label} (
                          {sunSettings.orientationDeg.toFixed(1)}°)
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { label: "N เหนือ", deg: 0 },
                          { label: "NE", deg: 45 },
                          { label: "E ออก", deg: 90 },
                          { label: "SE", deg: 135 },
                          { label: "S ใต้", deg: 180 },
                          { label: "SW", deg: 225 },
                          { label: "W ตก", deg: 270 },
                          { label: "NW", deg: 315 },
                        ].map(({ label, deg }) => (
                          <button
                            key={deg}
                            type="button"
                            onClick={() => setStudioOrientation01(deg)}
                            className={`rounded-lg py-1 text-[11px] font-semibold transition ${
                              Math.abs(((sunSettings.orientationDeg - deg + 540) % 360) - 180) < 22
                                ? "bg-info text-white"
                                : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={359.9}
                        step={0.1}
                        value={sunSettings.orientationDeg}
                        onChange={(e) => setStudioOrientation01(parseFloat(e.target.value))}
                        className="w-full accent-info cursor-pointer"
                      />
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] text-ink-500">พิมพ์องศาละเอียด (0.1°)</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setStudioOrientation01(sunSettings.orientationDeg - 0.1)}
                            className="rounded-md bg-ink-100 px-2 py-0.5 font-mono text-[11px] font-bold text-ink-800 hover:bg-ink-200"
                          >
                            -0.1°
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={359.9}
                            step={0.1}
                            value={compass3DInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCompass3DInput(val);
                              const parsed = parseFloat(val);
                              if (Number.isFinite(parsed) && !val.endsWith(".")) {
                                const normalized =
                                  (Math.round((((parsed % 360) + 360) % 360) * 10) / 10) % 360;
                                setSunSettings((prev) => {
                                  const next = { ...prev, orientationDeg: normalized };
                                  setRoom((r) => ({
                                    ...r,
                                    orientation: normalized,
                                    sunSettings: next,
                                  }));
                                  return next;
                                });
                              }
                            }}
                            onBlur={() => {
                              const parsed = parseFloat(compass3DInput);
                              if (Number.isFinite(parsed)) {
                                setStudioOrientation01(parsed);
                              } else {
                                setCompass3DInput(
                                  Number(sunSettings.orientationDeg.toFixed(1)).toFixed(1)
                                );
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                            className="w-16 rounded-md border border-ink-200 bg-surface px-1.5 py-0.5 text-center font-mono text-xs font-bold text-info focus:border-info focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setStudioOrientation01(sunSettings.orientationDeg + 0.1)}
                            className="rounded-md bg-ink-100 px-2 py-0.5 font-mono text-[11px] font-bold text-ink-800 hover:bg-ink-200"
                          >
                            +0.1°
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-ink-100 pt-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1 font-semibold text-ink-600">
                          <Clock className="h-3.5 w-3.5 text-amber-500" /> เวลาแสงเข้า
                        </span>
                        <span className="font-mono font-bold text-amber-600">
                          {Math.floor(sunSettings.timeHour).toString().padStart(2, "0")}:
                          {Math.round((sunSettings.timeHour % 1) * 60)
                            .toString()
                            .padStart(2, "0")}{" "}
                          น.
                        </span>
                      </div>
                      <input
                        type="range"
                        min={6}
                        max={23.75}
                        step={0.25}
                        value={sunSettings.timeHour}
                        onChange={(e) =>
                          updateSunInStudio((prev) => ({
                            ...prev,
                            timeHour: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <div className="grid grid-cols-5 gap-1">
                        {[
                          { label: "07:00", hour: 7.0, k: 3200 },
                          { label: "10:00", hour: 10.0, k: 5000 },
                          { label: "12:00", hour: 12.0, k: 5800 },
                          { label: "15:30", hour: 15.5, k: 4500 },
                          { label: "21:30", hour: 21.5, k: 7000 },
                        ].map(({ label, hour, k }) => (
                          <button
                            key={hour}
                            type="button"
                            onClick={() =>
                              updateSunInStudio((prev) => ({
                                ...prev,
                                timeHour: hour,
                                colorTempK: k,
                              }))
                            }
                            className={`rounded-lg py-1 font-mono text-[11px] font-semibold transition ${
                              Math.abs(sunSettings.timeHour - hour) < 0.45
                                ? "bg-amber-400 text-slate-950 font-bold"
                                : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-ink-100 pt-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-ink-600">โทนสีแสง (Kelvin)</span>
                        <span className="font-mono font-bold text-ink-900">
                          {sunSettings.colorTempK}K
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2500}
                        max={7500}
                        step={100}
                        value={sunSettings.colorTempK}
                        onChange={(e) =>
                          updateSunInStudio((prev) => ({
                            ...prev,
                            colorTempK: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full accent-sky-500 cursor-pointer"
                      />
                      <div className="rounded-xl bg-ink-50 p-2.5 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-ink-600">
                            <Thermometer className="h-3.5 w-3.5 text-amber-500" /> อุณหภูมิห้อง
                          </span>
                          <span className="font-mono font-bold text-ink-900">
                            ~{sunAnalysis.roomTempC}°C (นอก {sunAnalysis.outdoorTempC}°C)
                          </span>
                        </div>
                        <p className="text-ink-600 leading-snug">{sunAnalysis.statusText}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Day / Night Toggle */}
              <button
                type="button"
                onClick={() => {
                  updateSunInStudio((s) => ({
                    ...s,
                    timeHour: night ? 14.5 : 21.5,
                  }));
                }}
                title={night ? "สลับเป็นโหมดกลางวัน" : "สลับเป็นโหมดกลางคืน (ไฟ RGB)"}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  night
                    ? "bg-purple-900/60 text-purple-200 border border-purple-500/30"
                    : "bg-amber-100 text-amber-800 border border-amber-300/40"
                }`}
              >
                {night ? <Moon className="h-3.5 w-3.5 text-purple-400" /> : <Sun className="h-3.5 w-3.5 text-amber-600" />}
                <span className="hidden sm:inline">{night ? "กลางคืน" : "กลางวัน"}</span>
              </button>

              {/* Undo Button */}
              <button
                type="button"
                disabled={!canUndo}
                onClick={undo}
                title="ย้อนกลับ"
                className="icon-btn h-8 w-8 disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" />
              </button>

              {/* Reset Camera */}
              <button
                type="button"
                onClick={() => planner3DRef.current?.resetView()}
                title="รีเซ็ตมุมกล้อง 3D"
                className="icon-btn h-8 w-8"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {/* Toggle Catalog Sidebar */}
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                title={drawerOpen ? "ซ่อนแถบสินค้าเพื่อดูห้อง 3D กว้างสุด" : "เปิดแถบเลือกสินค้า 2,100+ ชิ้น"}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  drawerOpen
                    ? "bg-info/15 text-info border border-info/30"
                    : "bg-ink-100 text-ink-800 hover:bg-ink-200"
                }`}
              >
                {drawerOpen ? (
                  <PanelRightClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{drawerOpen ? "ซ่อนคลังสินค้า" : "คลังสินค้า"}</span>
              </button>
            </div>

            {/* Total Price, Cart & Fullscreen Toggle */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="text-right">
                <span className="block text-[10px] text-ink-500">รวม ({productCount} ชิ้น)</span>
                <span className="font-mono text-sm font-extrabold text-info">{formatTHB(totalRoomPrice)}</span>
              </div>
              <button
                type="button"
                onClick={handleAddSetupToCart}
                className="btn btn-primary h-8 sm:h-9 rounded-xl px-3.5 text-xs font-bold shadow-sm"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ใส่ตะกร้าทั้งหมด</span>
                <span className="sm:hidden">ใส่ตะกร้า</span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? "ย่อออกจากเต็มจอ (กด Esc หรือ F)" : "เปิดเต็มจอนั่งจัดห้อง (กด F)"}
                className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-ink-100 px-3 text-xs font-semibold text-ink-800 hover:bg-ink-200 transition-all"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span>ย่อจอ</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>เต็มจอ</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main Workspace Split: 3D Viewport (Left/Full) + Collapsible Product Catalog Dock (Right/Bottom) */}
          <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">
            {/* 3D Viewport Canvas Container */}
            <div className="relative flex-1 min-h-[360px] lg:min-h-0 h-full w-full bg-slate-950">
              <RoomPlanner3D
                ref={planner3DRef}
                room={room}
                items={items}
                selected={selectedUid}
                night={night}
                sunSettings={sunSettings}
                onSelect={setSelectedUid}
                onMove={(uid, x, z, y, rot) => {
                  setItems((prev) =>
                    prev.map((i) =>
                      i.uid === uid
                        ? { ...i, x, z, y, ...(rot !== undefined ? { rot: normalizeRotDeg(rot) } : {}) }
                        : i
                    )
                  );
                }}
                onBatchMove={(moves) => {
                  const byId = new Map(moves.map((m) => [m.uid, m]));
                  setItems((prev) =>
                    prev.map((i) => {
                      const mv = byId.get(i.uid);
                      return mv
                        ? { ...i, x: mv.x, z: mv.z, y: mv.y, rot: normalizeRotDeg(mv.rot) }
                        : i;
                    })
                  );
                }}
              />

              {/* Instruction pill */}
              <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-300 backdrop-blur-md">
                🖱️ ลากของเพื่อขยับ (ใกล้กำแพงปรับองศาอัตโนมัติ) · กด R หมุนของ · ลากพื้นที่ว่างหมุนกล้อง · กด F เต็มจอ
              </div>

              {/* Floating button to reopen Catalog when hidden */}
              {!drawerOpen && (
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-info px-3.5 py-2 text-xs font-extrabold text-white shadow-xl hover:opacity-95 transition"
                >
                  <PackagePlus className="h-4 w-4" />
                  เลือกสินค้าลงห้อง (2,100+ ชิ้น)
                </button>
              )}

              {/* Selected Item Floating Inspector */}
              {selectedItem && (
                <div className="absolute bottom-4 left-4 z-30 flex max-w-[95%] flex-col gap-2 rounded-2xl border border-white/20 bg-slate-900/92 p-2.5 shadow-2xl backdrop-blur-md text-white">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 pr-2 border-r border-white/20">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-info/30 text-xs font-bold text-info">
                        {(CATEGORY_LABELS as Record<string, string>)[selectedItem.category] || "ของ"}
                      </span>
                      <div>
                        <p className="max-w-[140px] truncate text-xs font-bold text-white sm:max-w-[200px]">
                          {selectedItem.name}
                        </p>
                        <p className="font-mono text-[11px] font-semibold text-amber-400">
                          {selectedItem.price > 0 ? formatTHB(selectedItem.price) : "ไม่มีค่าใช้จ่าย"}
                        </p>
                      </div>
                    </div>

                    {/* Quick actions for selected item */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRotate(45)}
                        className="inline-flex h-8 items-center gap-1 rounded-xl bg-white/10 px-2.5 text-xs font-semibold hover:bg-white/20"
                        title="หมุน +45 องศา (หรือกดปุ่ม R)"
                      >
                        <RotateCw className="h-3.5 w-3.5 text-amber-400" />
                        <span>R +45°</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRotate(90)}
                        className="inline-flex h-8 items-center gap-1 rounded-xl bg-white/10 px-2.5 text-xs font-semibold hover:bg-white/20"
                        title="หมุน +90 องศา"
                      >
                        <RotateCw className="h-3.5 w-3.5" /> 90°
                      </button>

                      <button
                        type="button"
                        onClick={handleAlignToWall}
                        className="inline-flex h-8 items-center gap-1 rounded-xl bg-sky-500/20 border border-sky-400/35 px-2.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30"
                        title="ปรับหมุนให้ขนานตามองศาของกำแพงที่อยู่ใกล้ที่สุด"
                      >
                        <Compass className="h-3.5 w-3.5 text-sky-300" /> ขนานกำแพง
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleRotLock}
                        className={`inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition-all ${
                          selectedItem.rotLocked
                            ? "bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-sm"
                            : "bg-white/10 text-slate-300 hover:bg-white/20"
                        }`}
                        title={
                          selectedItem.rotLocked
                            ? "ล็อกมุมหมุนไว้แล้ว (เวลาลากขยับของมุมจะไม่เด้งกลับตามกำแพง) — คลิกเพื่อปลดล็อก"
                            : "ยังไม่ได้ล็อกมุมหมุน (จะปรับตามกำแพงอัตโนมัติ) — คลิกเพื่อล็อกมุมนี้"
                        }
                      >
                        {selectedItem.rotLocked ? (
                          <>
                            <Lock className="h-3.5 w-3.5 text-amber-400" />
                            <span>ล็อกมุม</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5 text-slate-400" />
                            <span>ปรับตามผนัง</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleAltitude}
                        className="inline-flex h-8 items-center gap-1 rounded-xl bg-white/10 px-2.5 text-xs font-semibold hover:bg-white/20"
                        title="ปรับความสูง (วางบนโต๊ะ / บนพื้น)"
                      >
                        <Layers className="h-3.5 w-3.5" /> {selectedItem.y > 10 ? "บนโต๊ะ" : "บนพื้น"}
                      </button>

                      {/* Colors */}
                      <div className="flex items-center gap-1 px-1">
                        {["#1a1d20", "#f4f1ea", "#c29567", "#8c6239", "#4a5568"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleColorChange(c)}
                            style={{ backgroundColor: c }}
                            className={`h-5 w-5 rounded-full border border-white/40 transition-transform ${
                              selectedItem.color === c ? "scale-125 ring-2 ring-info" : ""
                            }`}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleDuplicate}
                        title="ทำสำเนา"
                        className="icon-btn h-8 w-8 text-white hover:bg-white/10"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(selectedItem.uid)}
                        title="ลบออกจากห้อง"
                        className="icon-btn h-8 w-8 text-rose-400 hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Live Custom Degree Rotation Row (หมุนโชว์สดทันทีตามตัวเลขที่พิมพ์หรือเลื่อน) */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-300">
                      <RotateCw className="h-3.5 w-3.5 text-sky-400" />
                      กำหนดองศาหมุน:
                    </span>

                    <input
                      type="range"
                      min={0}
                      max={359.9}
                      step={0.5}
                      value={normalizeRotDeg(selectedItem.rot)}
                      onPointerDown={() => {
                        rotUndoRecordedRef.current = false;
                        recordRotationUndoOnce();
                      }}
                      onPointerUp={() => {
                        rotUndoRecordedRef.current = false;
                      }}
                      onChange={(e) => {
                        recordRotationUndoOnce();
                        applyLiveAngle(parseFloat(e.target.value), true);
                      }}
                      aria-label="เลื่อนปรับองศาหมุนสิ่งของแบบเรียลไทม์"
                      className="w-28 sm:w-36 accent-sky-400 cursor-pointer"
                    />

                    <div className="inline-flex items-center gap-1 rounded-xl border border-sky-400/40 bg-slate-950/80 px-2 py-1">
                      <input
                        type="number"
                        min={0}
                        max={360}
                        step={0.5}
                        value={rotInput}
                        onFocus={(e) => {
                          rotEditingRef.current = true;
                          rotUndoRecordedRef.current = false;
                          e.currentTarget.select();
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRotInput(val);
                          if (val.trim() === "" || val === "-") return;
                          const parsed = parseFloat(val);
                          if (Number.isFinite(parsed)) {
                            recordRotationUndoOnce();
                            applyLiveAngle(parsed, false);
                          }
                        }}
                        onBlur={() => {
                          rotEditingRef.current = false;
                          rotUndoRecordedRef.current = false;
                          const parsed = parseFloat(rotInput);
                          if (Number.isFinite(parsed)) {
                            applyLiveAngle(parsed, true);
                          } else {
                            const norm = normalizeRotDeg(selectedItem.rot);
                            setRotInput(Number.isInteger(norm) ? String(norm) : norm.toFixed(1));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        aria-label="พิมพ์องศาหมุนสิ่งของ"
                        className="w-16 bg-transparent text-center font-mono text-xs font-extrabold text-amber-300 focus:outline-none"
                      />
                      <span className="font-mono text-xs font-bold text-sky-300">°</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleRotLock}
                      className={`rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold transition-all ${
                        selectedItem.rotLocked
                          ? "bg-amber-500/20 text-amber-300 border border-amber-400/35"
                          : "bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                      }`}
                      title={
                        selectedItem.rotLocked
                          ? "คลิกเพื่อปลดล็อกมุม (ให้หมุนตามกำแพง)"
                          : "คลิกเพื่อล็อกมุม (ไม่ให้หมุนตามกำแพง)"
                      }
                    >
                      หมุนแล้ว{" "}
                      {Number.isInteger(normalizeRotDeg(selectedItem.rot))
                        ? `${normalizeRotDeg(selectedItem.rot)}°`
                        : `${normalizeRotDeg(selectedItem.rot).toFixed(1)}°`}
                      {selectedItem.rotLocked ? " 🔒" : ""}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Catalog Sidebar / Dock (2,100+ Products) */}
            {drawerOpen && (
              <aside className="flex h-[270px] lg:h-full lg:w-[360px] xl:w-[400px] shrink-0 flex-col border-t lg:border-t-0 lg:border-l border-ink-200 bg-surface">
                <div className="border-b border-ink-100 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-info text-white">
                        <PackagePlus className="h-3.5 w-3.5" />
                      </span>
                      <h3 className="font-display text-xs sm:text-sm font-bold text-ink-950">
                        คลังสินค้า 3D (2,100+ ชิ้น)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      title="ซ่อนแถบสินค้าเพื่อขยายจอ 3D"
                      className="icon-btn h-7 w-7 text-ink-500 hover:text-ink-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาโต๊ะ, เก้าอี้, จอ, เคส, โคมไฟ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input h-8.5 w-full rounded-full pl-8 pr-4 text-xs"
                    />
                  </div>

                  {/* Category Filter Chips */}
                  <div className="thin-scroll flex items-center gap-1.5 overflow-x-auto pb-1">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCat(c.id)}
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          selectedCat === c.id
                            ? "bg-info text-white shadow-sm"
                            : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Products Scrollable Grid */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3">
                  {searching ? (
                    <div className="flex h-36 items-center justify-center gap-2 text-xs text-ink-500">
                      <Loader2 className="h-4 w-4 animate-spin text-info" />
                      กำลังค้นหาแคตตาล็อก...
                    </div>
                  ) : products.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center text-xs text-ink-500">
                      <p>ไม่พบสินค้าในหมวดนี้</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCat("all");
                          setSearchQuery("");
                        }}
                        className="mt-2 text-info underline"
                      >
                        ล้างตัวกรอง
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
                      {products.map((p) => {
                        const dims = p.dimensions;
                        const dimStr = dims ? `${dims.width}×${dims.depth} ซม.` : "";
                        const imgSrc = p.imageUrl ? displayPhotoSrc(p.imageUrl) : null;

                        return (
                          <div
                            key={p.id}
                            className="group flex flex-col justify-between rounded-2xl border border-ink-100 bg-surface-card p-2 transition-all hover:border-info/50 hover:shadow-md"
                          >
                            <div className="aspect-square w-full overflow-hidden rounded-xl bg-ink-50 p-1.5 relative flex items-center justify-center">
                              {imgSrc ? (
                                <img
                                  src={imgSrc}
                                  alt={p.name}
                                  className="h-full w-full object-contain transition-transform group-hover:scale-105"
                                  loading="lazy"
                                />
                              ) : (
                                <Box className="h-7 w-7 text-ink-300" />
                              )}
                              {dimStr && (
                                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white">
                                  {dimStr}
                                </span>
                              )}
                            </div>

                            <div className="mt-1.5 flex-1">
                              <p className="line-clamp-2 text-[11px] font-semibold text-ink-900 group-hover:text-info">
                                {p.name}
                              </p>
                              <p className="font-mono text-xs font-bold text-info mt-0.5">
                                {formatTHB(p.price)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddProduct(p)}
                              className="mt-1.5 inline-flex h-7 w-full items-center justify-center gap-1 rounded-lg bg-ink-100 text-[11px] font-bold text-ink-800 transition-colors group-hover:bg-info group-hover:text-white"
                            >
                              <Plus className="h-3 w-3" /> วางในห้อง
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
