"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Copy,
  Layers,
  Loader2,
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
  X,
  Compass,
  Smartphone,
  Clock,
  Thermometer,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Camera,
  QrCode,
  Sparkles,
  Download,
  Check,
  Ruler,
  Eye,
  Wand2,
  FileText,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { RoomSizeInputs } from "./RoomSizeInputs";
import { toast, openCartDrawer } from "@/lib/toast";
import Spinner from "@/components/Spinner";
import { useHorizontalScroll } from "@/lib/use-horizontal-scroll";
import { CATEGORY_LABELS, formatTHB } from "@/lib/format";
import {
  alignItemToNearestWall,
  autoLayout,
  clampToRoom,
  decodePlan,
  DEFAULT_ROOM,
  encodePlan,
  findNearestWallForItem,
  getItemAxes,
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
import {
  analyzeErgonomics,
  AUTO_FURNISH_PRESETS,
  buildAutoFurnishLayout,
  estimateRoomPower,
  generateRoomQrSvg,
  openPrintableQuotationPdf,
  renderShareableSetupCard,
  type AutoFurnishPreset,
} from "./studio-tools";

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


const DEFAULT_STARTER_ITEMS: PlanItem[] = [
  {
    uid: "starter-desk-01",
    productId: "p-desk-01",
    name: "โต๊ะทำงานมินิมอล 140x60 ซม.",
    category: "desk",
    x: 175,
    z: 130,
    y: 0,
    w: 140,
    d: 60,
    h: 75,
    rot: 0,
    color: "#c29567",
    price: 5900,
    estimated: false,
  },
  {
    uid: "starter-chair-01",
    productId: "p-chair-01",
    name: "เก้าอี้เพื่อสุขภาพ Ergonomic Mesh",
    category: "chair",
    x: 175,
    z: 210,
    y: 0,
    w: 65,
    d: 65,
    h: 110,
    rot: 0,
    color: "#1a1d20",
    price: 4900,
    estimated: false,
  },
  {
    uid: "starter-monitor-01",
    productId: "p-monitor-01",
    name: "จอคอม 27 นิ้ว QHD 165Hz",
    category: "monitor",
    x: 175,
    z: 125,
    y: 75,
    w: 62,
    d: 18,
    h: 42,
    rot: 0,
    color: "#1a1d20",
    price: 7900,
    estimated: false,
  },
  {
    uid: "starter-lamp-01",
    productId: "p-lamp-01",
    name: "โคมไฟตั้งโต๊ะ Warm Light",
    category: "lighting",
    x: 120,
    z: 125,
    y: 75,
    w: 18,
    d: 18,
    h: 38,
    rot: 0,
    color: "#f4f1ea",
    price: 890,
    estimated: false,
  },
];

export function Room3DStudioClient() {
  // Mode: "blueprint" (2D room plan) or "studio" (3D room) - defaults to 3D studio for immediate access
  const [mode, setMode] = useState<"blueprint" | "studio">("studio");

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
  const [items, setItemsState] = useState<PlanItem[]>(DEFAULT_STARTER_ITEMS);
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
  const catalogAsideRef = useRef<HTMLElement>(null);

  // Catalog Drawer state (opens automatically on desktop >= 1024px, collapses on mobile for maximum 3D view)
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setDrawerOpen(true);
    }
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const catScroll = useHorizontalScroll<HTMLDivElement>();
  const toolbarScroll = useHorizontalScroll<HTMLDivElement>();
  const [products, setProducts] = useState<FoundProduct[]>([]);
  const [searching, setSearching] = useState(false);

  // Drag-to-delete state
  const [dragDeleteState, setDragDeleteState] = useState<{
    isDragging: boolean;
    isOver: boolean;
    uid: string | null;
  }>({
    isDragging: false,
    isOver: false,
    uid: null,
  });

  const checkDeleteZone = useCallback((clientX: number, clientY: number) => {
    if (catalogAsideRef.current) {
      const r = catalogAsideRef.current.getBoundingClientRect();
      if (
        clientX >= r.left - 6 &&
        clientX <= r.right + 10 &&
        clientY >= r.top &&
        clientY <= r.bottom
      ) {
        return true;
      }
    }
    return false;
  }, []);

  
  // Mobile Portrait detection & Landscape guidance prompt
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissedRotatePrompt, setDismissedRotatePrompt] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === "undefined") return;
      const isMobile = window.innerWidth <= 840 || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsPortraitMobile(isMobile && isPortrait);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

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
      imageUrl: prod.imageUrl,
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
      setItemsState((prev) => rotateItemWithRiders(selectedUid, norm, prev, room));
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
        return rotateItemWithRiders(selectedUid, cur.rot + angle, prev, room);
      });
      toast(`หมุน ${angle > 0 ? `+${angle}` : angle}°`, { tone: "ok" });
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
    setItems((prev) => rotateItemWithRiders(selectedUid, near.targetRot, prev, room));
    toast(`ปรับหมุนตามองศากำแพง (${near.targetRot}°) แล้ว`);
  }, [selectedUid, items, room, setItems]);

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

  const handleDeleteItem = useCallback(
    (uid: string) => {
      let deletedName = "";
      setItems((prev) => {
        const target = prev.find((i) => i.uid === uid);
        if (!target) return prev;
        deletedName = target.name;
        const targetAxes = getItemAxes(target.rot);
        const toDelete = new Set<string>([uid]);
        for (const o of prev) {
          if (o.uid !== target.uid && o.y > 0 && Math.abs(o.y - (target.y + target.h)) < 2) {
            const rx = o.x - target.x;
            const rz = o.z - target.z;
            const lx = Math.abs(rx * targetAxes.ux + rz * targetAxes.uz);
            const lz = Math.abs(rx * targetAxes.vx + rz * targetAxes.vz);
            if (lx <= target.w * 0.55 && lz <= target.d * 0.55) {
              toDelete.add(o.uid);
            }
          }
        }
        return prev.filter((i) => !toDelete.has(i.uid));
      });
      if (selectedUid === uid) setSelectedUid(null);
      toast(deletedName ? `🗑️ ลบ “${deletedName.slice(0, 24)}” ออกจากห้องแล้ว` : "ลบสินค้าออกจากห้องแล้ว", {
        tone: "ok",
      });
    },
    [selectedUid, setItems]
  );

  useEffect(() => {
    if (!dragDeleteState.isDragging) return;

    const onGlobalPointerMove = (e: PointerEvent) => {
      const isOver = checkDeleteZone(e.clientX, e.clientY);
      setDragDeleteState((prev) => (prev.isOver === isOver ? prev : { ...prev, isOver }));
    };

    const onGlobalPointerUp = (e: PointerEvent) => {
      if (checkDeleteZone(e.clientX, e.clientY) && dragDeleteState.uid) {
        handleDeleteItem(dragDeleteState.uid);
      }
      setDragDeleteState({ isDragging: false, isOver: false, uid: null });
    };

    window.addEventListener("pointermove", onGlobalPointerMove, true);
    window.addEventListener("pointerup", onGlobalPointerUp, true);
    return () => {
      window.removeEventListener("pointermove", onGlobalPointerMove, true);
      window.removeEventListener("pointerup", onGlobalPointerUp, true);
    };
  }, [dragDeleteState.isDragging, dragDeleteState.uid, checkDeleteZone, handleDeleteItem]);

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
        imageUrl: p?.imageUrl || it.imageUrl || null,
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

  // --- 1) โหลดห้อง 3D จากลิงก์แชร์ / QR Code (?setup=... หรือ ?plan=...) หรือจากที่วัดไว้ในเครื่อง (cn-room-plan-v1) ---
  const [blueprintKey, setBlueprintKey] = useState(0);
  const [measureModalOpen, setMeasureModalOpen] = useState(false);
  const [povMode, setPovMode] = useState(false);
  const [sendingToAi, setSendingToAi] = useState(false);
  const loadedFromStorageRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const code = sp.get("setup") || sp.get("plan");
    const wantStudio = sp.get("mode") === "studio" || sp.get("mode") === "3d";
    const wantMeasure = sp.get("tool") === "measure" || sp.get("tool") === "shape";
    if (wantMeasure) {
      setMeasureModalOpen(true);
    }

    let initialItems: PlanItem[] = [];
    if (code) {
      const decoded = decodePlan(code);
      if (decoded) {
        setRoom((prev) => ({
          ...prev,
          ...decoded.room,
        }));
        setBlueprintKey((k) => k + 1);
        initialItems = decoded.items;
        setItemsState(decoded.items);
        setMode("studio");
        toast("เปิดห้อง 3D จากลิงก์แชร์/QR Code เรียบร้อย! 📱", { tone: "ok" });
      }
    } else {
      try {
        const raw = window.localStorage.getItem("cn-room-plan-v1");
        if (raw) {
          const saved = JSON.parse(raw) as { room?: RoomSize; items?: PlanItem[] };
          if (saved?.room && typeof saved.room.w === "number") {
            setRoom((prev) => ({
              ...prev,
              ...saved.room,
            }));
            setBlueprintKey((k) => k + 1);
          }
          if (Array.isArray(saved?.items) && saved.items.length > 0) {
            initialItems = saved.items;
            setItemsState(saved.items);
          } else {
            initialItems = DEFAULT_STARTER_ITEMS;
            setItemsState(DEFAULT_STARTER_ITEMS);
          }
        }
      } catch {
        // ignore
      }
      if (wantStudio) {
        setMode("studio");
      }
    }
    loadedFromStorageRef.current = true;

    // ดึงรูปสินค้าจริงจากคลังมาเติมให้สิ่งของที่แชร์มาหรือโหลดมาจากเครื่อง
    fetch("/api/planner/products?limit=150")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { products?: FoundProduct[] } | null) => {
        if (!data?.products) return;
        const byId = new Map<string, FoundProduct>();
        for (const p of data.products) {
          byId.set(p.id, p);
          productsMap.current.set(p.id, p);
        }
        if (initialItems.length > 0) {
          setItemsState((curr) =>
            curr.map((it) => {
              if (!it.productId || it.imageUrl) return it;
              const found = byId.get(it.productId);
              return found?.imageUrl ? { ...it, imageUrl: displayPhotoSrc(found.imageUrl) } : it;
            })
          );
        }
      })
      .catch(() => {});
  }, []);

  // บันทึกขนาดห้องและเฟอร์นิเจอร์ลง cn-room-plan-v1 อัตโนมัติ เพื่อให้เชื่อมกับหน้า /design ตลอดเวลา
  useEffect(() => {
    if (!loadedFromStorageRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "cn-room-plan-v1",
        JSON.stringify({ room, roomSet: true, items, at: Date.now() })
      );
    } catch {
      // ignore
    }
  }, [room, items]);

  const handleApplyMeasuredRoom = useCallback((nextRoom: RoomSize, jumpTo3D?: boolean) => {
    setRoom((prev) => ({
      ...prev,
      ...nextRoom,
    }));
    setBlueprintKey((k) => k + 1);
    setItemsState((prev) => {
      const cleaned = prev.filter((it) => it.category !== "door");
      const safe: PlanItem[] = [];
      for (const it of cleaned) {
        safe.push(nudgeFree(clampToRoom(it, nextRoom), safe, nextRoom));
      }
      return safe;
    });
    if (jumpTo3D) {
      setMeasureModalOpen(false);
      setMode("studio");
      toast(
        `⚡ ปรับห้อง 3D เป็นขนาด ${(nextRoom.w / 100).toFixed(2)}×${(nextRoom.d / 100).toFixed(2)} ม. (สูง ${(nextRoom.h / 100).toFixed(1)} ม.) เรียบร้อย!`,
        { tone: "ok" }
      );
    }
  }, []);

  const handleTogglePovView = () => {
    if (!planner3DRef.current) return;
    if (povMode) {
      planner3DRef.current.resetView();
      setPovMode(false);
      toast("กลับสู่มุมมองภาพรวมทั้งห้อง (Orbit View)");
    } else {
      planner3DRef.current.focusDeskView();
      setPovMode(true);
      toast("👁️ สลับสู่มุมมองระดับสายตานั่งโต๊ะจริง (POV Desk View)");
    }
  };

  const handleSend3DToAiPhoto = async () => {
    if (!planner3DRef.current) return;
    setSendingToAi(true);
    try {
      const snap = await planner3DRef.current.snapshot();
      if (!snap?.blob) {
        toast("ไม่สามารถถ่ายภาพห้อง 3D ได้ในขณะนี้", { tone: "error" });
        setSendingToAi(false);
        return;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.readAsDataURL(snap.blob);
      });
      const productIds = [...new Set(items.map((i) => i.productId).filter((x): x is string => !!x))];
      window.sessionStorage.setItem(
        "cn-3d-to-ai-snapshot",
        JSON.stringify({
          dataUrl,
          productIds,
          spots: snap.spots,
          room,
        })
      );
      window.location.href = "/design?from3d=1";
    } catch {
      toast("ส่งภาพไปให้ AI ไม่สำเร็จ", { tone: "error" });
      setSendingToAi(false);
    }
  };

  // --- 2) AI 1-Click Auto-Furnish State & Handler ---
  const [autoFurnishOpen, setAutoFurnishOpen] = useState(false);
  const [autoFurnishPreset, setAutoFurnishPreset] = useState<AutoFurnishPreset["id"]>("gaming");
  const [autoFurnishBudget, setAutoFurnishBudget] = useState<string>("38000");
  const [autoFurnishing, setAutoFurnishing] = useState(false);

  const handleRunAutoFurnish = async (presetId?: AutoFurnishPreset["id"]) => {
    const targetPreset = presetId ?? autoFurnishPreset;
    const parsedBudget = Number(autoFurnishBudget.replace(/,/g, "")) || null;
    setAutoFurnishing(true);
    try {
      const res = await buildAutoFurnishLayout(targetPreset, parsedBudget, room);
      for (const p of res.pickedProducts) {
        productsMap.current.set(p.id, p);
      }
      setItems(() => res.items);
      setSelectedUid(null);
      setAutoFurnishOpen(false);
      toast(
        `✨ AI จัดวางเฟอร์นิเจอร์ ${res.items.length} ชิ้น (รวม ${formatTHB(res.totalPrice)}) ลงห้อง 3D เรียบร้อย!`,
        { tone: "ok" }
      );
    } catch {
      toast("จัดวางอัตโนมัติไม่สำเร็จ กรุณาลองใหม่", { tone: "error" });
    } finally {
      setAutoFurnishing(false);
    }
  };

  // --- 3) แคปภาพห้อง 3D พร้อมรายการราคา (Shareable Setup Card PNG) ---
  const [capturingCard, setCapturingCard] = useState(false);

  const handleCaptureSetupCard = async () => {
    if (!planner3DRef.current) return;
    setCapturingCard(true);
    try {
      const snap = await planner3DRef.current.snapshot();
      if (!snap?.blob) {
        toast("ไม่สามารถแคปภาพห้อง 3D ได้ในขณะนี้", { tone: "error" });
        return;
      }
      const cardBlob = await renderShareableSetupCard(snap.blob, room, items, totalRoomPrice);
      const outBlob = cardBlob ?? snap.blob;
      const url = URL.createObjectURL(outBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ComproNext-3D-Setup-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast("📸 บันทึกภาพห้อง 3D พร้อมรายการราคาเรียบร้อย!", { tone: "ok" });
    } catch {
      toast("เกิดข้อผิดพลาดในการสร้างการ์ดภาพ", { tone: "error" });
    } finally {
      setCapturingCard(false);
    }
  };

  // --- 4) แชร์ QR Code ห้อง 3D นี้ให้สแกนดูบนมือถือทันที ---
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [powerModalOpen, setPowerModalOpen] = useState(false);

  const ergonomicReport = useMemo(() => analyzeErgonomics(items, room), [items, room]);
  const powerEstimate = useMemo(() => estimateRoomPower(items), [items]);

  const handleExportPdf = async () => {
    setToolsMenuOpen(false);
    const snap = await planner3DRef.current?.snapshot();
    await openPrintableQuotationPdf(snap?.blob ?? null, room, items, totalRoomPrice);
  };

  const handleOpenQrModal = async () => {
    try {
      const code = encodePlan(room, items);
      const origin = typeof window !== "undefined" ? window.location.origin : "https://compronext-web-rho.vercel.app";
      const url = `${origin}/room-3d?setup=${encodeURIComponent(code)}`;
      setShareUrl(url);
      setCopiedLink(false);
      setQrModalOpen(true);
      const svg = await generateRoomQrSvg(url);
      setQrSvg(svg);
    } catch {
      toast("ไม่สามารถสร้าง QR Code ได้", { tone: "error" });
    }
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
            key={blueprintKey}
            room={room}
            doors={doors}
            windows={windows}
            sunSettings={sunSettings}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onChange={handleBlueprintChange}
            onProceedTo3D={handleProceedTo3D}
            onOpenMeasure={() => setMeasureModalOpen(true)}
          />
        </div>
      ) : (
        <div
          className={`relative flex flex-col overflow-hidden bg-surface ${
            isFullscreen
              ? "h-full flex-1 rounded-none border-0"
              : "h-[calc(100dvh-5.5rem)] sm:h-[calc(100dvh-7.75rem)] min-h-[460px] sm:min-h-[560px] max-h-[92vh] sm:max-h-[720px] rounded-2xl border border-ink-200 shadow-card"
          }`}
        >
                    {/* Top 3D Control Bar: Responsive 2-tier design for Mobile & Desktop */}
          <div className="relative z-30 flex flex-col border-b border-ink-200 bg-surface/95 text-ink-950 shadow-xs backdrop-blur-md">
            {/* Tier 1: Main Header (Mode, Dimensions, Price, Cart, Fullscreen) */}
            <div className="flex items-center justify-between gap-1.5 px-3 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {/* 2-Step Mode Switcher Pill */}
                <div className="inline-flex shrink-0 items-center rounded-lg border border-ink-200 bg-paper p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setMode("blueprint")}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-ink-700 hover:bg-surface hover:text-info transition"
                  >
                    <PenTool className="h-3 w-3" />
                    <span className="hidden sm:inline">1. แปลน 2D</span>
                    <span className="sm:hidden">แปลน 2D</span>
                  </button>
                  <span className="inline-flex items-center gap-1 rounded-md bg-info px-2 py-0.5 font-bold text-white shadow-xs">
                    <Box className="h-3 w-3" />
                    <span className="hidden sm:inline">2. ห้อง 3D</span>
                    <span className="sm:hidden">ห้อง 3D</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setMeasureModalOpen(true)}
                  title="กดเพื่อกรอกขนาดห้อง หรือวัดขนาดห้องจริงด้วยกล้องมือถือ"
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-info/35 bg-info-bg/70 px-2 text-[11px] font-bold text-info hover:bg-info hover:text-white transition"
                >
                  <Ruler className="h-3 w-3" />
                  <span>
                    {Number((room.w / 100).toFixed(1))}×{Number((room.d / 100).toFixed(1))} ม.
                  </span>
                </button>
              </div>

              {/* Price, Cart & Fullscreen */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <div className="text-right">
                  <span className="hidden sm:block text-[10px] text-ink-500">รวม ({productCount} ชิ้น)</span>
                  <span className="font-mono text-xs sm:text-sm font-extrabold text-info">{formatTHB(totalRoomPrice)}</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddSetupToCart}
                  className="btn btn-primary h-7 sm:h-8 rounded-xl px-2.5 sm:px-3 text-xs font-bold shadow-sm"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">ใส่ตะกร้า</span>
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "ย่อจอ" : "เต็มจอ"}
                  className="inline-flex h-7 sm:h-8 items-center gap-1 rounded-xl border border-ink-200 bg-paper px-2 sm:px-2.5 text-xs font-semibold text-ink-800 hover:bg-ink-100 transition-all"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">ย่อจอ</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">เต็มจอ</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tier 2: Scrollable Toolbar for All 3D Tools */}
            <div
              ref={toolbarScroll.ref}
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-ink-100/70 bg-paper/40 px-3 py-1.5 select-none cursor-grab active:cursor-grabbing"
            >
{/* Quick Actions & Toggles (Compact & Grouped) */}
            
              {/* Sun & Compass Floating Popover Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSun3DPanelOpen((v) => !v);
                    setAutoFurnishOpen(false);
                    setToolsMenuOpen(false);
                  }}
                  title="ปรับทิศห้อง แสงแดด และอุณหภูมิ"
                  className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-semibold transition-colors ${
                    sun3DPanelOpen
                      ? "border-info bg-info-bg text-info shadow-xs"
                      : "border-ink-200 bg-paper text-ink-800 hover:bg-ink-100"
                  }`}
                >
                  <Compass className="h-3.5 w-3.5 text-info" />
                  <span className="font-mono text-[11px]">
                    {degToCardinal(sunSettings.orientationDeg).cardinal}
                  </span>
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-mono text-[11px]">~{sunAnalysis.roomTempC}°C</span>
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
                                ? "bg-info text-white font-bold"
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
                                ? "bg-info text-white font-bold"
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
                        className="w-full accent-info cursor-pointer"
                      />
                      <div className="rounded-xl bg-paper border border-ink-100 p-2.5 text-[11px] space-y-1">
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
                className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2 text-xs font-semibold transition-colors ${
                  night
                    ? "bg-[#0a192f] text-white border-[#0a192f]"
                    : "bg-paper text-ink-800 border-ink-200 hover:bg-ink-100"
                }`}
              >
                {night ? <Moon className="h-3.5 w-3.5 text-sky-300" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
              </button>

              {/* Undo & Reset Camera */}
              <button
                type="button"
                disabled={!canUndo}
                onClick={undo}
                title="ย้อนกลับ"
                className="icon-btn h-8 w-8 disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  planner3DRef.current?.resetView();
                  setPovMode(false);
                }}
                title="รีเซ็ตมุมกล้อง 3D"
                className="icon-btn h-8 w-8"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {/* POV Seated Desk View Toggle */}
              <button
                type="button"
                onClick={handleTogglePovView}
                title="สลับมุมมองระดับสายตาคนนั่งเก้าอี้หน้าโต๊ะคอมจริง + เช็กระยะสายตา (POV)"
                className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-bold transition-all ${
                  povMode
                    ? "border-info bg-info text-white shadow-xs"
                    : "border-ink-200 bg-paper text-ink-800 hover:bg-ink-100"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{povMode ? "ออก POV" : "POV นั่งโต๊ะ"}</span>
              </button>

              {/* 1-Click AI Auto-Furnish Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setAutoFurnishOpen((v) => !v);
                    setSun3DPanelOpen(false);
                    setToolsMenuOpen(false);
                  }}
                  title="ให้ AI เลือกและจัดวางเฟอร์นิเจอร์ลงห้อง 3D ให้อัตโนมัติตามงบ"
                  className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-bold transition-all ${
                    autoFurnishOpen
                      ? "border-info bg-info text-white shadow-sm"
                      : "border-info/35 bg-info-bg text-info hover:bg-info hover:text-white"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI จัดให้</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${autoFurnishOpen ? "rotate-180" : ""}`} />
                </button>

                {autoFurnishOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-[300px] sm:w-[340px] space-y-2.5 rounded-2xl border border-ink-200 bg-surface p-3.5 text-xs text-ink-900 shadow-pop">
                    <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                      <div>
                        <p className="font-display text-xs font-bold text-ink-950 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-info" /> AI จัดวางของลงห้อง 3D อัตโนมัติ
                        </p>
                        <p className="text-[10px] text-ink-600">
                          เลือกสไตล์และงบ ระบบจะดึงสินค้าจริงมาวางให้ทันที
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAutoFurnishOpen(false)}
                        className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      {AUTO_FURNISH_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setAutoFurnishPreset(p.id);
                            setAutoFurnishBudget(String(p.defaultBudget));
                          }}
                          className={`flex w-full flex-col rounded-xl border p-2 text-left transition ${
                            autoFurnishPreset === p.id
                              ? "border-info bg-info-bg/70 shadow-xs"
                              : "border-ink-200 bg-surface hover:bg-paper"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-ink-950">{p.label}</span>
                            <span className="font-mono text-[11px] font-bold text-info">
                              ~{formatTHB(p.defaultBudget)}
                            </span>
                          </div>
                          <span className="mt-0.5 text-[10px] text-ink-600">{p.desc}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-ink-100 pt-2">
                      <label className="flex-1 space-y-0.5">
                        <span className="block text-[10px] font-semibold text-ink-700">งบรวม (บาท)</span>
                        <input
                          type="number"
                          min={5000}
                          max={300000}
                          step={1000}
                          value={autoFurnishBudget}
                          onChange={(e) => setAutoFurnishBudget(e.target.value)}
                          className="input h-8 w-full font-mono text-xs font-bold text-info"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={autoFurnishing}
                        onClick={() => handleRunAutoFurnish()}
                        className="btn btn-primary mt-3.5 h-8 rounded-xl px-3.5 text-xs font-bold shadow-sm disabled:opacity-50"
                      >
                        {autoFurnishing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span>จัดลงห้อง</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Grouped Tools & Export Popover (รวมเครื่องมือไว้ในปุ่มเดียว ไม่รกจอ) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setToolsMenuOpen((v) => !v);
                    setAutoFurnishOpen(false);
                    setSun3DPanelOpen(false);
                  }}
                  className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-bold transition-colors ${
                    toolsMenuOpen
                      ? "border-ink-900 bg-ink-900 text-white"
                      : "border-ink-200 bg-paper text-ink-800 hover:bg-ink-100"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>เครื่องมือ & ส่งออก</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${toolsMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {toolsMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-64 space-y-1 rounded-2xl border border-ink-200 bg-surface p-2 text-xs text-ink-900 shadow-pop">
                    <button
                      type="button"
                      disabled={sendingToAi || items.length === 0}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        void handleSend3DToAiPhoto();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-bold text-info hover:bg-info-bg/70 disabled:opacity-40"
                    >
                      <Wand2 className="h-4 w-4 shrink-0" />
                      <div>
                        <span className="block">✨ ให้ AI วาดเป็นภาพห้องจริง</span>
                        <span className="text-[10px] font-normal text-ink-500">แปลงห้อง 3D นี้เป็นภาพถ่ายสมจริง</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={items.length === 0}
                      onClick={handleExportPdf}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-ink-800 hover:bg-ink-100 disabled:opacity-40"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-info" />
                      <div>
                        <span className="block">📄 พิมพ์ใบเสนอราคา & แปลน PDF</span>
                        <span className="text-[10px] font-normal text-ink-500">แปลน 2D + ภาพ 3D + ตารางราคา A4</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={capturingCard}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        void handleCaptureSetupCard();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-ink-800 hover:bg-ink-100 disabled:opacity-40"
                    >
                      <Camera className="h-4 w-4 shrink-0 text-info" />
                      <div>
                        <span className="block">📸 แคปการ์ดสรุปราคา (PNG)</span>
                        <span className="text-[10px] font-normal text-ink-500">บันทึกภาพห้อง 3D พร้อมรายการของ</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        void handleOpenQrModal();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-ink-800 hover:bg-ink-100"
                    >
                      <QrCode className="h-4 w-4 shrink-0 text-info" />
                      <div>
                        <span className="block">📱 สแกน QR เปิดบนมือถือ</span>
                        <span className="text-[10px] font-normal text-ink-500">ส่งห้อง 3D นี้เข้ามือถือทันที</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        setPowerModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-ink-800 hover:bg-ink-100"
                    >
                      <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <span className="block">⚡ เช็กปลั๊กไฟ & กำลังวัตต์รวม</span>
                        <span className="text-[10px] font-normal text-ink-500">
                          ~{powerEstimate.totalWatts} W · ใช้ปลั๊ก {powerEstimate.plugCount} ช่อง
                        </span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Toggle Catalog Sidebar */}
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                title={drawerOpen ? "ซ่อนแถบสินค้าเพื่อดูห้อง 3D กว้างสุด" : "เปิดแถบเลือกสินค้า"}
                className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-semibold transition-colors ${
                  drawerOpen
                    ? "bg-info-bg text-info border-info/30"
                    : "bg-paper border-ink-200 text-ink-800 hover:bg-ink-100"
                }`}
              >
                {drawerOpen ? (
                  <PanelRightClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{drawerOpen ? "ซ่อนคลัง" : "คลังสินค้า"}</span>
              </button>
            
            </div>
          </div>

{/* Main Workspace Split: 3D Viewport (Left/Full) + Collapsible Product Catalog Dock (Right/Bottom) */}
          <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">
            {/* 3D Viewport Canvas Container */}
            <div className="relative flex-1 min-h-[260px] lg:min-h-0 h-full w-full bg-slate-950">
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
                onDelete={handleDeleteItem}
                onDragStateChange={(isDragging, isOver, uid) => {
                  setDragDeleteState({ isDragging, isOver, uid: uid ?? null });
                }}
                checkDeleteZone={checkDeleteZone}
              />

              {/* Instruction pill or Ergonomic POV Check HUD */}
              {povMode ? (
                <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-lg rounded-2xl border border-info/40 bg-slate-900/90 px-3.5 py-2 text-xs text-white shadow-xl backdrop-blur-md">
                  <p className="font-bold text-sky-300">{ergonomicReport.headline}</p>
                  <p className="mt-0.5 text-[11px] text-slate-200">
                    {ergonomicReport.tips[0]} · {ergonomicReport.tips[1]}
                  </p>
                </div>
              ) : (
                <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/75 px-2.5 py-1 text-[11px] font-semibold text-slate-300 backdrop-blur-md">
                  🖱️ ลากเพื่อขยับ · กด R หมุน 45° · ลากพื้นว่างหมุนมุมกล้อง
                </div>
              )}

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

              
              {/* Floating button to open Catalog on mobile when drawer is hidden */}
              {!drawerOpen && !selectedItem && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-info px-5 py-2.5 text-xs font-extrabold text-white shadow-pop hover:scale-105 active:scale-95 transition"
                  >
                    <PackagePlus className="h-4 w-4" />
                    <span>+ เลือกสินค้าลงห้อง (2,100+ ชิ้น)</span>
                  </button>
                </div>
              )}

              {/* Selected Item Floating Inspector */}
              {selectedItem && (
                <div className="fixed bottom-3 left-2 right-2 sm:absolute sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md z-40 flex flex-col gap-2 rounded-2xl border border-white/20 bg-slate-900/95 p-2.5 sm:p-3 shadow-pop backdrop-blur-md text-white">
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

                    <span className="rounded-lg bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300">
                      หมุนแล้ว{" "}
                      {Number.isInteger(normalizeRotDeg(selectedItem.rot))
                        ? `${normalizeRotDeg(selectedItem.rot)}°`
                        : `${normalizeRotDeg(selectedItem.rot).toFixed(1)}°`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Catalog Sidebar / Dock (2,100+ Products) */}
            {drawerOpen && (
                            <>
                {/* Mobile Backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-xs lg:hidden"
                  onClick={() => setDrawerOpen(false)}
                  aria-hidden="true"
                />

                <aside
                  ref={catalogAsideRef}
                  data-catalog-sidebar="true"
                  className="fixed inset-x-0 bottom-0 z-50 flex h-[76vh] max-h-[620px] flex-col rounded-t-3xl border-t border-ink-200 bg-surface shadow-2xl transition-transform animate-in slide-in-from-bottom duration-200 lg:relative lg:inset-auto lg:z-auto lg:h-full lg:w-[280px] xl:w-[300px] lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none overflow-hidden"
                >
                  {/* Mobile pull handle */}
                  <div className="flex items-center justify-center pt-2.5 pb-1 lg:hidden">
                    <div className="h-1.5 w-12 rounded-full bg-ink-300" />
                  </div>
                {/* Drag-to-Delete Drop Zone Overlay directly on Catalog Sidebar */}
                {dragDeleteState.isDragging && (
                  <div
                    data-drop-delete-zone="true"
                    className={`pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center transition-all duration-200 backdrop-blur-md ${
                      dragDeleteState.isOver
                        ? "bg-rose-600/90 text-white shadow-2xl ring-4 ring-rose-400/80 animate-in fade-in"
                        : "bg-slate-900/85 text-slate-100 border-2 border-dashed border-rose-400/50"
                    }`}
                  >
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-3xl transition-all duration-200 ${
                        dragDeleteState.isOver
                          ? "bg-white text-rose-600 shadow-2xl scale-110 ring-4 ring-white/50 animate-bounce"
                          : "bg-white/10 text-rose-300 ring-2 ring-white/20"
                      }`}
                    >
                      <Trash2 className="h-10 w-10" />
                    </div>

                    <p className="mt-4 font-display text-lg font-black tracking-wide drop-shadow-md">
                      {dragDeleteState.isOver ? "ปล่อยเพื่อลบออกจากห้อง!" : "ลากสินค้ามาวางที่นี่เพื่อลบ"}
                    </p>
                  </div>
                )}
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
                  <div className="relative group/cats">
                    {catScroll.canScrollLeft && (
                      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-3 bg-gradient-to-r from-surface via-surface/90 to-transparent pointer-events-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            catScroll.scrollBy(-180);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-ink-800 shadow-md border border-ink-200 text-ink-700 hover:text-ink-950 hover:scale-105 active:scale-95 transition"
                          title="เลื่อนซ้าย"
                          aria-label="เลื่อนหมวดหมู่ซ้าย"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div
                      ref={catScroll.ref}
                      className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5 select-none cursor-grab active:cursor-grabbing"
                    >
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCat(c.id)}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors pointer-events-auto select-none ${
                            selectedCat === c.id
                              ? "bg-info text-white shadow-sm"
                              : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    {catScroll.canScrollRight && (
                      <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-3 bg-gradient-to-l from-surface via-surface/90 to-transparent pointer-events-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            catScroll.scrollBy(180);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-ink-800 shadow-md border border-ink-200 text-ink-700 hover:text-ink-950 hover:scale-105 active:scale-95 transition"
                          title="เลื่อนขวา"
                          aria-label="เลื่อนหมวดหมู่ขวา"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
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
                        const dimStr = dims?.width && dims?.depth ? `${dims.width}×${dims.depth} ซม.` : dims?.width ? `กว้าง ${dims.width} ซม.` : "";
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
              </>
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal สำหรับให้กรรมการหรือลูกค้าใช้มือถือสแกนเปิดห้อง 3D เดียวกันได้ทันที */}
      {qrModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="แชร์ QR Code ห้อง 3D"
        >
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => setQrModalOpen(false)}
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-xs"
          />
          <div className="relative z-10 w-full max-w-sm space-y-4 rounded-3xl border border-ink-200 bg-surface p-6 text-center shadow-pop">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3 text-left">
              <div>
                <h3 className="font-display text-base font-bold text-ink-950 flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-info" /> สแกนเปิดห้อง 3D บนมือถือ
                </h3>
                <p className="text-xs text-ink-600">
                  ใช้กล้องมือถือสแกนเพื่อดูแปลนและเฟอร์นิเจอร์ชุดนี้แบบ 3D ทันที
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="icon-btn h-8 w-8 border-transparent p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-info/25 bg-white p-3 shadow-inner">
              {qrSvg ? (
                <div
                  className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <Loader2 className="h-8 w-8 animate-spin text-info" />
              )}
            </div>

            <div className="rounded-xl bg-paper border border-ink-100 px-3 py-2 text-xs text-ink-700">
              <span className="font-semibold text-ink-950">
                ขนาด {(room.w / 100).toFixed(2)}×{(room.d / 100).toFixed(2)} ม.
              </span>{" "}
              · สินค้า {productCount} ชิ้น · รวม{" "}
              <span className="font-mono font-bold text-info">{formatTHB(totalRoomPrice)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!shareUrl) return;
                  navigator.clipboard.writeText(shareUrl);
                  setCopiedLink(true);
                  toast("คัดลอกลิงก์ห้อง 3D เรียบร้อย!", { tone: "ok" });
                }}
                className="btn btn-primary h-10 flex-1 rounded-full text-xs font-bold shadow-sm"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? "คัดลอกลิงก์แล้ว!" : "คัดลอกลิงก์ห้อง 3D"}
              </button>
              <button
                type="button"
                onClick={handleCaptureSetupCard}
                className="btn btn-outline h-10 rounded-full px-4 text-xs font-bold text-info"
              >
                <Download className="h-4 w-4" /> รูปราคา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: 📏 ขนาดห้องที่วัดมา (วัดด้วยกล้องมือถือ 4 แบบ / นับกระเบื้อง / เทียบ A4 / วาดแปลนห้อง) */}
      {measureModalOpen && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ขนาดห้องที่วัดมา"
        >
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => setMeasureModalOpen(false)}
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-xs"
          />
          <div className="relative z-10 w-full max-w-md space-y-3 rounded-3xl border border-ink-200 bg-surface p-5 shadow-pop">
            <div className="flex items-center justify-between border-b border-ink-100 pb-2.5">
              <div>
                <h3 className="font-display text-base font-bold text-ink-950 flex items-center gap-2">
                  <Ruler className="h-5 w-5 text-info" /> วัดขนาดห้องจริง & ตั้งค่าแปลน
                </h3>
                <p className="text-xs text-ink-600">
                  กรอกขนาด หรือวัดด้วยกล้องมือถือ / นับกระเบื้อง / ใส่รูปแปลน เพื่อปรับห้อง 2D และ 3D ทันที
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMeasureModalOpen(false)}
                className="icon-btn h-8 w-8 border-transparent p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <RoomSizeInputs room={room} set={true} onChange={handleApplyMeasuredRoom} />
          </div>
        </div>
      )}

      {/* Modal: ⚡ เช็กปลั๊กไฟ กำลังวัตต์รวม & สรีรศาสตร์ */}
      {powerModalOpen && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="เช็กปลั๊กไฟและกำลังวัตต์รวม"
        >
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => setPowerModalOpen(false)}
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-xs"
          />
          <div className="relative z-10 w-full max-w-md space-y-3 rounded-3xl border border-ink-200 bg-surface p-5 text-xs text-ink-900 shadow-pop">
            <div className="flex items-center justify-between border-b border-ink-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                  <Zap className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-display text-sm font-bold text-ink-950">เช็กปลั๊กไฟ กำลังไฟ & สรีรศาสตร์</h3>
                  <p className="text-[11px] text-ink-500">คำนวณจากอุปกรณ์ที่วางอยู่ในห้อง 3D ปัจจุบัน</p>
                </div>
              </div>
              <button type="button" onClick={() => setPowerModalOpen(false)} className="icon-btn h-8 w-8 border-transparent p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-ink-200 bg-paper p-2.5">
                <span className="block text-[10px] text-ink-500">กำลังไฟรวม</span>
                <span className="font-mono text-base font-extrabold text-amber-600">~{powerEstimate.totalWatts} W</span>
              </div>
              <div className="rounded-xl border border-ink-200 bg-paper p-2.5">
                <span className="block text-[10px] text-ink-500">ช่องปลั๊กไฟที่ใช้</span>
                <span className="font-mono text-base font-extrabold text-info">{powerEstimate.plugCount} ช่อง</span>
              </div>
              <div className="rounded-xl border border-ink-200 bg-paper p-2.5">
                <span className="block text-[10px] text-ink-500">ค่าไฟเฉลี่ย</span>
                <span className="font-mono text-base font-extrabold text-ink-950">~{powerEstimate.monthlyCostThb} ฿/ด.</span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-ink-900">
              <p className="font-bold">🔌 คำแนะนำการเดินสายและรางปลั๊กไฟ:</p>
              <p className="mt-0.5 text-ink-700">{powerEstimate.recommendation}</p>
            </div>

            <div className="rounded-xl border border-info/30 bg-info-bg/50 p-3 text-[11px] text-ink-900 space-y-1">
              <p className="font-bold text-info">{ergonomicReport.headline}</p>
              {ergonomicReport.tips.map((t) => (
                <p key={t} className="text-ink-700">• {t}</p>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportPdf}
                className="btn btn-primary h-9 rounded-full px-4 text-xs font-bold"
              >
                <FileText className="h-3.5 w-3.5" /> พิมพ์ใบเสนอราคา & แปลน PDF
              </button>
              <button
                type="button"
                onClick={() => setPowerModalOpen(false)}
                className="btn btn-outline h-9 rounded-full px-4 text-xs"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Landscape Orientation Prompt Overlay */}
      {isPortraitMobile && !dismissedRotatePrompt && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-slate-950/92 p-6 text-center text-white backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-600/20 border border-blue-400/30 shadow-lift">
            <Smartphone className="h-12 w-12 text-cyan-400 animate-pulse transition-transform duration-700" />
            <RotateCw className="absolute -bottom-1 -right-1 h-7 w-7 text-amber-400 animate-spin [animation-duration:5s]" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 px-3 py-1 text-xs font-bold text-cyan-300 mb-2">
            📐 แนะนำหมุนหน้าจอ
          </span>

          <h3 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
            หมุนโทรศัพท์เป็นแนวนอน
          </h3>
          <p className="mt-2 max-w-xs text-xs sm:text-sm leading-relaxed text-slate-300">
            การจัดห้อง 3D ในแนวนอนจะช่วยให้คุณเห็นห้องกว้างเต็มตา และแตะลากวางสินค้าได้แม่นยำที่สุด
          </p>

          <div className="mt-6 flex flex-col w-full max-w-xs gap-2.5">
            <button
              type="button"
              onClick={async () => {
                try {
                  if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                  }
                  if ((screen.orientation as any)?.lock) {
                    await (screen.orientation as any).lock("landscape");
                  }
                } catch {}
                setDismissedRotatePrompt(true);
              }}
              className="btn btn-primary h-12 w-full rounded-2xl text-xs sm:text-sm font-bold shadow-lift"
            >
              <Maximize2 className="h-4 w-4" />
              <span>หมุนจอ & เริ่มจัดห้อง 3D</span>
            </button>

            <button
              type="button"
              onClick={() => setDismissedRotatePrompt(true)}
              className="h-9 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              จัดในแนวตั้งต่อไป
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
