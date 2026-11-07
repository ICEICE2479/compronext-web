"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Box,
  Check,
  Copy,
  Layers,
  LayoutGrid,
  Loader2,
  Maximize2,
  Moon,
  Move,
  PackagePlus,
  PenTool,
  Plus,
  RotateCw,
  Search,
  ShoppingBag,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast, openCartDrawer } from "@/lib/toast";
import Spinner from "@/components/Spinner";
import { CATEGORY_LABELS, formatTHB } from "@/lib/format";
import {
  autoLayout,
  clampToRoom,
  DEFAULT_ROOM,
  itemFromProduct,
  newUid,
  placeNew,
  type PlanItem,
  type RoomSize,
} from "@/lib/room-planner";
import { addToCart, type CartInput } from "@/lib/cart-store";
import type { Product } from "@/lib/types";
import { MyDreamSetupBlueprint, type BlueprintDoor, type BlueprintWindow } from "./MyDreamSetupBlueprint";
import type { RoomPlanner3DHandle } from "./RoomPlanner3D";
import { displayPhotoSrc } from "@/lib/own-storage";

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
  // Mode: "blueprint" (My Dream Setup room drawing) or "studio" (3D Diorama room)
  const [mode, setMode] = useState<"blueprint" | "studio">("blueprint");

  // Room size & shape
  const [room, setRoom] = useState<RoomSize>({
    w: 350,
    d: 400,
    h: 260,
    win: { wall: "back", pos: 0.35 },
  });

  // Doors & Windows
  const [doors, setDoors] = useState<BlueprintDoor[]>([
    { id: "d-1", wall: "right", pos: 0.75, width: 80 },
  ]);
  const [windows, setWindows] = useState<BlueprintWindow[]>([
    { id: "w-1", wall: "top", pos: 0.35, width: 120 },
  ]);

  // Items placed in 3D room
  const [items, setItemsState] = useState<PlanItem[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [night, setNight] = useState(false);
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

  // Convert door blueprint openings into 3D door models
  const syncDoorsToItems = useCallback((currentDoors: BlueprintDoor[], currentRoom: RoomSize) => {
    setItemsState((prev) => {
      // Keep existing non-door items
      const nonDoors = prev.filter((it) => it.category !== "door");
      const doorItems: PlanItem[] = currentDoors.map((d, i) => {
        let x = 0;
        let z = 0;
        let rot: 0 | 90 | 180 | 270 = 0;

        if (d.wall === "top") {
          x = currentRoom.w * d.pos;
          z = 4;
          rot = 0;
        } else if (d.wall === "bottom") {
          x = currentRoom.w * d.pos;
          z = currentRoom.d - 4;
          rot = 180;
        } else if (d.wall === "left") {
          x = 4;
          z = currentRoom.d * d.pos;
          rot = 90;
        } else {
          x = currentRoom.w - 4;
          z = currentRoom.d * d.pos;
          rot = 270;
        }

        return {
          uid: `door-item-${i}`,
          productId: null,
          name: "ประตูห้อง",
          category: "door",
          w: d.width || 80,
          d: 6,
          h: 205,
          estimated: false,
          x,
          z,
          y: 0,
          rot,
          color: "#f4f1ea",
          price: 0,
        };
      });
      return [...doorItems, ...nonDoors];
    });
  }, []);

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

  const handleRotate = (angle: 45 | 90) => {
    if (!selectedUid) return;
    setItems((prev) =>
      prev.map((i) => {
        if (i.uid !== selectedUid) return i;
        const nextRot = ((i.rot + angle) % 360) as 0 | 90 | 180 | 270;
        return { ...i, rot: nextRot };
      })
    );
  };

  const handleToggleAltitude = () => {
    if (!selectedUid) return;
    setItems((prev) =>
      prev.map((i) => {
        if (i.uid !== selectedUid) return i;
        // Toggle between floor (0) and desk height (~75cm)
        const nextY = i.y > 10 ? 0 : 75;
        return { ...i, y: nextY };
      })
    );
  };

  const handleDuplicate = () => {
    if (!selectedItem) return;
    const dup: PlanItem = {
      ...selectedItem,
      uid: newUid(),
      x: clampToRoom({ ...selectedItem, x: selectedItem.x + 20 }, room).x,
      z: clampToRoom({ ...selectedItem, z: selectedItem.z + 20 }, room).z,
    };
    setItems((prev) => [...prev, dup]);
    setSelectedUid(dup.uid);
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

  // Transition from Blueprint to 3D Room
  const handleProceedTo3D = () => {
    syncDoorsToItems(doors, room);
    setMode("studio");
    toast("เข้าสู่ห้อง 3D เรียบร้อย! เลือกวางสินค้าจากเมนูด้านล่างได้เลย", {
      tone: "ok",
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* View Mode: Blueprint vs Studio */}
      {mode === "blueprint" ? (
        <div className="space-y-4">
          <MyDreamSetupBlueprint
            room={room}
            doors={doors}
            windows={windows}
            onChange={(nextRoom, nextDoors, nextWindows) => {
              setRoom(nextRoom);
              setDoors(nextDoors);
              setWindows(nextWindows);
            }}
            onProceedTo3D={handleProceedTo3D}
          />
        </div>
      ) : (
        <div className="relative flex flex-col overflow-hidden rounded-3xl border border-ink-200 bg-surface shadow-2xl">
          {/* Top 3D Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-surface/95 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2">
              {/* Back to Blueprint Button */}
              <button
                type="button"
                onClick={() => setMode("blueprint")}
                className="inline-flex items-center gap-1.5 rounded-full border border-info/40 bg-info/10 px-3.5 py-1.5 text-xs font-bold text-info hover:bg-info hover:text-white transition-all shadow-sm"
              >
                <PenTool className="h-3.5 w-3.5" />
                โหมดพิมพ์เขียว (Blueprint)
              </button>

              <span className="text-xs font-semibold text-ink-500 hidden sm:inline">
                {room.w / 100} × {room.d / 100} ม. (เพดาน {room.h / 100} ม.)
              </span>
            </div>

            {/* Quick Actions & Toggles */}
            <div className="flex items-center gap-2">
              {/* Day / Night Toggle */}
              <button
                type="button"
                onClick={() => setNight((v) => !v)}
                title={night ? "สลับเป็นโหมดกลางวัน" : "สลับเป็นโหมดกลางคืน (ไฟ RGB)"}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  night
                    ? "bg-purple-900/60 text-purple-200 border border-purple-500/30"
                    : "bg-amber-100 text-amber-800 border border-amber-300/40"
                }`}
              >
                {night ? <Moon className="h-3.5 w-3.5 text-purple-400" /> : <Sun className="h-3.5 w-3.5 text-amber-600" />}
                {night ? "กลางคืน" : "กลางวัน"}
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
                title="รีเซ็ตมุมกล้อง"
                className="icon-btn h-8 w-8"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              {/* Send to AI Design */}
              <Link
                href="/design"
                title="ส่งห้องนี้ให้ AI วาดห้องจริง"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-info hover:text-info transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-info" />
                AI จัดห้อง
              </Link>
            </div>

            {/* Total Price & Add All to Cart */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="block text-[11px] text-ink-500">ยอดรวมทั้งห้อง ({productCount} ชิ้น)</span>
                <span className="font-mono text-base font-extrabold text-info">{formatTHB(totalRoomPrice)}</span>
              </div>
              <button
                type="button"
                onClick={handleAddSetupToCart}
                className="btn btn-primary h-9 rounded-full px-4 text-xs font-bold shadow-md"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                ใส่ตะกร้าทั้งหมด
              </button>
            </div>
          </div>

          {/* 3D Viewport Canvas Container */}
          <div className="relative h-[520px] w-full bg-slate-950 sm:h-[600px]">
            <RoomPlanner3D
              ref={planner3DRef}
              room={room}
              items={items}
              selected={selectedUid}
              night={night}
              onSelect={setSelectedUid}
              onMove={(uid, x, z, y) => {
                setItems((prev) =>
                  prev.map((i) => (i.uid === uid ? { ...i, x, z, y } : i))
                );
              }}
            />

            {/* Instruction pill */}
            <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-300 backdrop-blur-md">
              🖱️ ลากของเพื่อขยับ · ลากพื้นที่ว่างเพื่อหมุนกล้อง · เลื่อนลูกกลิ้งเพื่อซูม
            </div>

            {/* Selected Item Floating Inspector */}
            {selectedItem && (
              <div className="absolute bottom-4 left-4 z-30 flex max-w-[94%] flex-wrap items-center gap-2 rounded-2xl border border-white/20 bg-slate-900/90 p-2.5 shadow-2xl backdrop-blur-md text-white">
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRotate(45)}
                    className="inline-flex h-8 items-center gap-1 rounded-xl bg-white/10 px-2.5 text-xs font-semibold hover:bg-white/20"
                    title="หมุน 45 องศา"
                  >
                    <RotateCw className="h-3.5 w-3.5" /> 45°
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotate(90)}
                    className="inline-flex h-8 items-center gap-1 rounded-xl bg-white/10 px-2.5 text-xs font-semibold hover:bg-white/20"
                    title="หมุน 90 องศา"
                  >
                    <RotateCw className="h-3.5 w-3.5" /> 90°
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
            )}
          </div>

          {/* Bottom Catalog Drawer / Product Browser */}
          <div className="border-t border-ink-100 bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-info text-white">
                  <PackagePlus className="h-4 w-4" />
                </span>
                <h3 className="font-display text-sm font-bold text-ink-950">
                  เลือกสินค้าลงห้อง 3D (เชื่อมต่อสินค้าทั้งเว็บ 2,100+ ชิ้น)
                </h3>
              </div>

              {/* Search Bar */}
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  placeholder="ค้นหาโต๊ะ, เก้าอี้, จอ, การ์ดจอ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input h-9 w-full rounded-full pl-8 pr-4 text-xs"
                />
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="thin-scroll mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCat(c.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedCat === c.id
                      ? "bg-info text-white shadow-sm"
                      : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Products Grid */}
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 max-h-72 overflow-y-auto pr-1">
                {products.map((p) => {
                  const dims = p.dimensions;
                  const dimStr = dims ? `${dims.width}×${dims.depth} ซม.` : "";
                  const imgSrc = p.imageUrl ? displayPhotoSrc(p.imageUrl) : null;

                  return (
                    <div
                      key={p.id}
                      className="group flex flex-col justify-between rounded-2xl border border-ink-100 bg-surface-card p-2.5 transition-all hover:border-info/50 hover:shadow-md"
                    >
                      <div className="aspect-square w-full overflow-hidden rounded-xl bg-ink-50 p-2 relative flex items-center justify-center">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={p.name}
                            className="h-full w-full object-contain transition-transform group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <Box className="h-8 w-8 text-ink-300" />
                        )}
                        {dimStr && (
                          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white">
                            {dimStr}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex-1">
                        <p className="line-clamp-2 text-[11px] font-semibold text-ink-900 group-hover:text-info">
                          {p.name}
                        </p>
                        <p className="font-mono text-xs font-bold text-info mt-1">
                          {formatTHB(p.price)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddProduct(p)}
                        className="mt-2 inline-flex h-7 w-full items-center justify-center gap-1 rounded-lg bg-ink-100 text-[11px] font-bold text-ink-800 transition-colors group-hover:bg-info group-hover:text-white"
                      >
                        <Plus className="h-3 w-3" /> วางในห้อง
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
