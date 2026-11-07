"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X,
  PenTool,
  LayoutGrid,
  DoorClosed,
  ArrowRight,
  Trash2,
  Check,
  RotateCcw,
  Maximize2,
  Sparkles,
  Box,
  Compass,
  Sun,
  Moon,
  Clock,
  Thermometer,
  Layers,
  Copy,
  ChevronDown,
  Info,
  Sliders,
  Move,
} from "lucide-react";
import type { RoomSize } from "@/lib/room-planner";
import {
  type Pt2,
  presetShape,
  shapeBounds,
  shapeMetrics,
  signedArea,
} from "@/lib/room-shape";
import {
  type SunSettings,
  DEFAULT_SUN_SETTINGS,
  CARDINALS,
  degToCardinal,
  getWallOrientation,
  calculateSunState,
  analyzeWindowSunlight,
} from "@/lib/sun-simulation";

export interface BlueprintDoor {
  id: string;
  wall: "top" | "bottom" | "left" | "right";
  /** Position from 0.05 to 0.95 along the wall */
  pos: number;
  width: number; // in cm (e.g. 80cm)
}

export interface BlueprintWindow {
  id: string;
  wall: "top" | "bottom" | "left" | "right";
  /** Position from 0.05 to 0.95 along the wall */
  pos: number;
  width: number; // in cm (e.g. 120cm)
}

interface MyDreamSetupBlueprintProps {
  room: RoomSize;
  doors?: BlueprintDoor[];
  windows?: BlueprintWindow[];
  sunSettings?: SunSettings;
  onChange: (
    room: RoomSize,
    doors: BlueprintDoor[],
    windows: BlueprintWindow[],
    sunSettings: SunSettings
  ) => void;
  onProceedTo3D: () => void;
  onCancel?: () => void;
}

export function MyDreamSetupBlueprint({
  room,
  doors: initialDoors = [
    { id: "d-1", wall: "right", pos: 0.7, width: 80 },
  ],
  windows: initialWindows = [
    { id: "w-1", wall: "top", pos: 0.35, width: 120 },
  ],
  sunSettings: initialSunSettings = DEFAULT_SUN_SETTINGS,
  onChange,
  onProceedTo3D,
  onCancel,
}: MyDreamSetupBlueprintProps) {
  // Active tool: 'pencil' (draw/resize walls), 'window' (place window), 'door' (place door)
  const [activeTool, setActiveTool] = useState<"pencil" | "window" | "door">("pencil");

  // Shape presets dropdown / panel state
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [shapeType, setShapeType] = useState<"rect" | "L-left" | "L-right" | "alcove" | "custom">("rect");

  // Custom wall points when in custom polygon mode
  const [customPoints, setCustomPoints] = useState<Pt2[]>([]);

  // Room dimensions in cm
  const [widthCm, setWidthCm] = useState(room.w || 350);
  const [depthCm, setDepthCm] = useState(room.d || 400);
  const [heightCm, setHeightCm] = useState(room.h || 260);

  // Polygon shape if non-rectangular
  const [roomShape, setRoomShape] = useState<Pt2[] | undefined>(room.shape);

  // Doors & Windows
  const [doors, setDoors] = useState<BlueprintDoor[]>(initialDoors);
  const [windows, setWindows] = useState<BlueprintWindow[]>(initialWindows);

  // Selected item on blueprint for moving/deleting
  const [selectedElement, setSelectedElement] = useState<{
    type: "door" | "window";
    id: string;
  } | null>(null);

  // Orientation & Sun settings
  const [sun, setSun] = useState<SunSettings>(
    room.sunSettings || initialSunSettings
  );
  const [sunPanelOpen, setSunPanelOpen] = useState(true);

  // Dragging states
  const [isDraggingHandle, setIsDraggingHandle] = useState<
    "corner-br" | "edge-r" | "edge-b" | { vertexIndex: number } | null
  >(null);

  const [draggingOpening, setDraggingOpening] = useState<{
    type: "door" | "window";
    id: string;
  } | null>(null);

  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startW: number;
    startD: number;
    startShape?: Pt2[];
  }>({
    mouseX: 0,
    mouseY: 0,
    startW: widthCm,
    startD: depthCm,
  });

  const svgRef = useRef<SVGSVGElement>(null);

  // Sync state to parent
  useEffect(() => {
    const primaryWin =
      windows.find((w) => w.wall === "top") ||
      windows.find((w) => w.wall === "left") ||
      windows[0];

    const winConfig: RoomSize["win"] = primaryWin
      ? {
          wall:
            primaryWin.wall === "top"
              ? "back"
              : primaryWin.wall === "left"
              ? "left"
              : "back",
          pos: primaryWin.pos,
        }
      : { wall: "none", pos: 0.5 };

    const nextRoom: RoomSize = {
      ...room,
      w: widthCm,
      d: depthCm,
      h: heightCm,
      shape: roomShape,
      orientation: sun.orientationDeg,
      sunSettings: sun,
      win: winConfig,
    };

    onChange(nextRoom, doors, windows, sun);
  }, [widthCm, depthCm, heightCm, roomShape, doors, windows, sun, room, onChange]);

  // Dimensions calculations
  const areaM2 = useMemo(() => {
    if (roomShape && roomShape.length >= 3) {
      return (Math.abs(signedArea(roomShape)) / 10000).toFixed(1);
    }
    return ((widthCm * depthCm) / 10000).toFixed(1);
  }, [roomShape, widthCm, depthCm]);

  const widthM = (widthCm / 100).toFixed(2);
  const depthM = (depthCm / 100).toFixed(2);
  const heightM = (heightCm / 100).toFixed(2);

  // SVG coordinate system
  const vbW = 1000;
  const vbH = 680;
  const cx = vbW / 2;
  const cy = vbH / 2;

  const scale = useMemo(() => {
    const maxDim = Math.max(widthCm, depthCm, 300);
    return Math.min(480 / maxDim, 0.95);
  }, [widthCm, depthCm]);

  const roomSvgW = widthCm * scale;
  const roomSvgH = depthCm * scale;
  const roomX = cx - roomSvgW / 2;
  const roomY = cy - roomSvgH / 2;

  // Real-time Sun State & Analysis
  const sunState = useMemo(() => {
    return calculateSunState(sun, widthCm, depthCm, heightCm);
  }, [sun, widthCm, depthCm, heightCm]);

  const sunlightAdvice = useMemo(() => {
    return analyzeWindowSunlight(sun, windows);
  }, [sun, windows]);

  // Wall Cardinal Directions
  const wallTopInfo = useMemo(() => getWallOrientation("top", sun.orientationDeg), [sun.orientationDeg]);
  const wallRightInfo = useMemo(() => getWallOrientation("right", sun.orientationDeg), [sun.orientationDeg]);
  const wallBottomInfo = useMemo(() => getWallOrientation("bottom", sun.orientationDeg), [sun.orientationDeg]);
  const wallLeftInfo = useMemo(() => getWallOrientation("left", sun.orientationDeg), [sun.orientationDeg]);

  // Room Shape Preset Selector
  const handleSelectShape = (type: "rect" | "L-left" | "L-right" | "alcove" | "custom") => {
    setShapeType(type);
    setShapeMenuOpen(false);

    if (type === "rect") {
      setRoomShape(undefined);
      setCustomPoints([]);
    } else if (type === "L-left") {
      // L shape with cut on bottom-right
      const w = widthCm;
      const d = depthCm;
      const cutW = Math.round(w * 0.45);
      const cutD = Math.round(d * 0.45);
      const poly: Pt2[] = [
        [0, 0],
        [w, 0],
        [w, d - cutD],
        [w - cutW, d - cutD],
        [w - cutW, d],
        [0, d],
      ];
      setRoomShape(poly);
      setCustomPoints([]);
    } else if (type === "L-right") {
      const w = widthCm;
      const d = depthCm;
      const cutW = Math.round(w * 0.45);
      const cutD = Math.round(d * 0.45);
      const poly: Pt2[] = [
        [0, 0],
        [w - cutW, 0],
        [w - cutW, cutD],
        [w, cutD],
        [w, d],
        [0, d],
      ];
      setRoomShape(poly);
      setCustomPoints([]);
    } else if (type === "alcove") {
      // Room with a desk alcove on top wall
      const w = widthCm;
      const d = depthCm;
      const alcoveW = 180;
      const alcoveD = 60;
      const startX = Math.round((w - alcoveW) / 2);
      const poly: Pt2[] = [
        [0, alcoveD],
        [startX, alcoveD],
        [startX, 0],
        [startX + alcoveW, 0],
        [startX + alcoveW, alcoveD],
        [w, alcoveD],
        [w, d],
        [0, d],
      ];
      setRoomShape(poly);
      setCustomPoints([]);
    } else if (type === "custom") {
      setRoomShape(undefined);
      setCustomPoints([
        [0, 0],
        [widthCm, 0],
        [widthCm, depthCm],
        [0, depthCm],
      ]);
    }
  };

  // Convert SVG coordinate back to room centimeter [x, z]
  const svgToRoomCm = useCallback(
    (svgX: number, svgY: number): { x: number; z: number } => {
      const x = Math.round((svgX - roomX) / scale);
      const z = Math.round((svgY - roomY) / scale);
      return { x: Math.max(0, Math.min(widthCm, x)), z: Math.max(0, Math.min(depthCm, z)) };
    },
    [roomX, roomY, scale, widthCm, depthCm]
  );

  // Click on a wall to place door or window
  const handleWallClick = (
    wall: "top" | "bottom" | "left" | "right",
    e: React.MouseEvent<SVGElement>
  ) => {
    e.stopPropagation();
    if (activeTool !== "window" && activeTool !== "door") return;

    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * vbW;
    const clickY = ((e.clientY - rect.top) / rect.height) * vbH;

    let pos = 0.5;
    if (wall === "top" || wall === "bottom") {
      pos = Math.max(0.1, Math.min(0.9, (clickX - roomX) / roomSvgW));
    } else {
      pos = Math.max(0.1, Math.min(0.9, (clickY - roomY) / roomSvgH));
    }

    if (activeTool === "window") {
      const newWin: BlueprintWindow = {
        id: `w-${Date.now()}`,
        wall,
        pos: Number(pos.toFixed(2)),
        width: 120,
      };
      setWindows((prev) => [...prev, newWin]);
      setSelectedElement({ type: "window", id: newWin.id });
    } else if (activeTool === "door") {
      const newDoor: BlueprintDoor = {
        id: `d-${Date.now()}`,
        wall,
        pos: Number(pos.toFixed(2)),
        width: 80,
      };
      setDoors((prev) => [...prev, newDoor]);
      setSelectedElement({ type: "door", id: newDoor.id });
    }
  };

  // Delete selected item
  const deleteSelected = useCallback(() => {
    if (!selectedElement) return;
    if (selectedElement.type === "door") {
      setDoors((prev) => prev.filter((d) => d.id !== selectedElement.id));
    } else {
      setWindows((prev) => prev.filter((w) => w.id !== selectedElement.id));
    }
    setSelectedElement(null);
  }, [selectedElement]);

  // Duplicate selected item
  const duplicateSelected = useCallback(() => {
    if (!selectedElement) return;
    if (selectedElement.type === "door") {
      const cur = doors.find((d) => d.id === selectedElement.id);
      if (!cur) return;
      const dup: BlueprintDoor = {
        ...cur,
        id: `d-${Date.now()}`,
        pos: Math.min(0.9, cur.pos + 0.15),
      };
      setDoors((prev) => [...prev, dup]);
      setSelectedElement({ type: "door", id: dup.id });
    } else {
      const cur = windows.find((w) => w.id === selectedElement.id);
      if (!cur) return;
      const dup: BlueprintWindow = {
        ...cur,
        id: `w-${Date.now()}`,
        pos: Math.min(0.9, cur.pos + 0.15),
      };
      setWindows((prev) => [...prev, dup]);
      setSelectedElement({ type: "window", id: dup.id });
    }
  }, [selectedElement, doors, windows]);

  // Switch wall for selected item
  const switchSelectedWall = useCallback(
    (targetWall: "top" | "bottom" | "left" | "right") => {
      if (!selectedElement) return;
      if (selectedElement.type === "door") {
        setDoors((prev) =>
          prev.map((d) => (d.id === selectedElement.id ? { ...d, wall: targetWall } : d))
        );
      } else {
        setWindows((prev) =>
          prev.map((w) => (w.id === selectedElement.id ? { ...w, wall: targetWall } : w))
        );
      }
    },
    [selectedElement]
  );

  // Change width of selected opening
  const changeSelectedWidth = useCallback(
    (newWidthCm: number) => {
      if (!selectedElement) return;
      if (selectedElement.type === "door") {
        setDoors((prev) =>
          prev.map((d) => (d.id === selectedElement.id ? { ...d, width: newWidthCm } : d))
        );
      } else {
        setWindows((prev) =>
          prev.map((w) => (w.id === selectedElement.id ? { ...w, width: newWidthCm } : w))
        );
      }
    },
    [selectedElement]
  );

  // Clear all walls & openings
  const resetBlueprint = () => {
    setWidthCm(350);
    setDepthCm(400);
    setHeightCm(260);
    setRoomShape(undefined);
    setShapeType("rect");
    setDoors([{ id: `d-${Date.now()}`, wall: "right", pos: 0.7, width: 80 }]);
    setWindows([{ id: `w-${Date.now()}`, wall: "top", pos: 0.35, width: 120 }]);
    setSun(DEFAULT_SUN_SETTINGS);
    setSelectedElement(null);
  };

  // Start dragging handles for room resize
  const onMouseDownResize = (
    mode: "corner-br" | "edge-r" | "edge-b" | { vertexIndex: number },
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingHandle(mode);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: widthCm,
      startD: depthCm,
      startShape: roomShape ? [...roomShape] : undefined,
    };
  };

  // Global mousemove and mouseup handler for handles and doors/windows dragging
  useEffect(() => {
    if (!isDraggingHandle && !draggingOpening) return;

    const onMouseMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mouseSvgX = ((e.clientX - rect.left) / rect.width) * vbW;
      const mouseSvgY = ((e.clientY - rect.top) / rect.height) * vbH;

      // 1. Dragging door or window along walls
      if (draggingOpening) {
        // Distance to 4 walls
        const dTop = Math.abs(mouseSvgY - roomY);
        const dBottom = Math.abs(mouseSvgY - (roomY + roomSvgH));
        const dLeft = Math.abs(mouseSvgX - roomX);
        const dRight = Math.abs(mouseSvgX - (roomX + roomSvgW));

        const minD = Math.min(dTop, dBottom, dLeft, dRight);
        let targetWall: "top" | "bottom" | "left" | "right" = "top";
        let targetPos = 0.5;

        if (minD === dTop) {
          targetWall = "top";
          targetPos = Math.max(0.08, Math.min(0.92, (mouseSvgX - roomX) / roomSvgW));
        } else if (minD === dBottom) {
          targetWall = "bottom";
          targetPos = Math.max(0.08, Math.min(0.92, (mouseSvgX - roomX) / roomSvgW));
        } else if (minD === dLeft) {
          targetWall = "left";
          targetPos = Math.max(0.08, Math.min(0.92, (mouseSvgY - roomY) / roomSvgH));
        } else {
          targetWall = "right";
          targetPos = Math.max(0.08, Math.min(0.92, (mouseSvgY - roomY) / roomSvgH));
        }

        const snappedPos = Number(targetPos.toFixed(3));

        if (draggingOpening.type === "door") {
          setDoors((prev) =>
            prev.map((d) =>
              d.id === draggingOpening.id ? { ...d, wall: targetWall, pos: snappedPos } : d
            )
          );
        } else {
          setWindows((prev) =>
            prev.map((w) =>
              w.id === draggingOpening.id ? { ...w, wall: targetWall, pos: snappedPos } : w
            )
          );
        }
        return;
      }

      // 2. Dragging room resize handles
      if (isDraggingHandle) {
        const deltaX = (e.clientX - dragStartRef.current.mouseX) / scale;
        const deltaY = (e.clientY - dragStartRef.current.mouseY) / scale;

        if (isDraggingHandle === "corner-br" || isDraggingHandle === "edge-r") {
          const rawW = dragStartRef.current.startW + deltaX * 2;
          const snappedW = Math.round(rawW / 25) * 25;
          setWidthCm(Math.max(200, Math.min(800, snappedW)));
        }
        if (isDraggingHandle === "corner-br" || isDraggingHandle === "edge-b") {
          const rawD = dragStartRef.current.startD + deltaY * 2;
          const snappedD = Math.round(rawD / 25) * 25;
          setDepthCm(Math.max(200, Math.min(800, snappedD)));
        }

        if (typeof isDraggingHandle === "object" && "vertexIndex" in isDraggingHandle) {
          const idx = isDraggingHandle.vertexIndex;
          if (roomShape && dragStartRef.current.startShape) {
            const startPt = dragStartRef.current.startShape[idx];
            const nextX = Math.round((startPt[0] + deltaX) / 25) * 25;
            const nextZ = Math.round((startPt[1] + deltaY) / 25) * 25;
            const updated = [...roomShape];
            updated[idx] = [
              Math.max(0, Math.min(widthCm, nextX)),
              Math.max(0, Math.min(depthCm, nextZ)),
            ];
            setRoomShape(updated);
          }
        }
      }
    };

    const onMouseUp = () => {
      setIsDraggingHandle(null);
      setDraggingOpening(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    isDraggingHandle,
    draggingOpening,
    scale,
    roomX,
    roomY,
    roomSvgW,
    roomSvgH,
    widthCm,
    depthCm,
    roomShape,
  ]);

  // Selected item reference
  const selectedDoor = useMemo(() => {
    return selectedElement?.type === "door"
      ? doors.find((d) => d.id === selectedElement.id)
      : null;
  }, [selectedElement, doors]);

  const selectedWin = useMemo(() => {
    return selectedElement?.type === "window"
      ? windows.find((w) => w.id === selectedElement.id)
      : null;
  }, [selectedElement, windows]);

  return (
    <div className="relative flex flex-col items-center justify-between overflow-hidden rounded-3xl border-4 border-[#1e40af] bg-[#3b82f6] shadow-2xl select-none min-h-[700px] w-full text-white">
      {/* Blueprint Desk Annotations & Aesthetic Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        {/* Coffee Mug Ring */}
        <div className="absolute -left-12 -top-12 h-44 w-44 rounded-full border-4 border-amber-900/30" />
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full border-2 border-amber-800/20" />

        {/* Pencils */}
        <div className="absolute right-4 top-4 h-32 w-1.5 rotate-45 rounded-full bg-amber-200/40 shadow-sm" />
        <div className="absolute right-8 top-12 h-24 w-1.5 rotate-12 rounded-full bg-slate-300/40 shadow-sm" />

        {/* Architectural notes */}
        <span className="absolute bottom-24 right-12 font-mono text-2xl font-bold tracking-widest text-white/40">
          2 ¹/₂
        </span>
        <span className="absolute bottom-16 right-10 font-mono text-base text-white/30">
          0.26
        </span>
        <span className="absolute bottom-8 right-16 font-mono text-sm text-white/30">
          3.2 bag
        </span>
      </div>

      {/* Top Header Bar: BLUEPRINT MODE */}
      <div className="relative z-10 flex w-full flex-wrap items-center justify-between border-b border-white/20 bg-[#1e40af]/70 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white shadow-inner">
            <PenTool className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-lg font-black tracking-widest uppercase text-white drop-shadow-sm sm:text-xl">
                BLUEPRINT MODE
              </h1>
              <span className="rounded-full bg-emerald-500/30 border border-emerald-400/50 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                My Dream Setup
              </span>
            </div>
            <p className="text-[11px] font-medium text-blue-100">
              วาดขนาดห้อง ประตู หน้าต่าง กำหนดทิศทาง และจำลองแสงแดดตามเวลาจริง
            </p>
          </div>
        </div>

        {/* Live Room Metrics HUD */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-semibold">
          <div className="rounded-xl border border-white/30 bg-black/30 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-blue-200">ขนาด: </span>
            <span className="text-white">{widthM} × {depthM} ม.</span>
            <span className="mx-1 text-white/40">|</span>
            <span className="text-blue-200">เพดาน: </span>
            <span className="text-white">{heightM} ม.</span>
          </div>
          <div className="rounded-xl border border-white/30 bg-black/30 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-blue-200">พื้นที่: </span>
            <span className="font-bold text-amber-300">{areaM2} ตร.ม.</span>
          </div>
        </div>
      </div>

      {/* Main Blueprint Canvas Area */}
      <div className="relative flex flex-1 w-full items-center justify-center p-2 sm:p-6 overflow-hidden min-h-[500px]">
        {/* Floating Left Toolbar (Identical to My Dream Setup Screenshot) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3 rounded-2xl border border-white/30 bg-[#1d4ed8]/85 p-2.5 shadow-2xl backdrop-blur-md">
          {/* 1. X Button (Cancel / Reset) */}
          <button
            type="button"
            onClick={onCancel || resetBlueprint}
            title="รีเซ็ตแปลนห้อง"
            className="group flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-md transition-all hover:scale-110 active:scale-95"
          >
            <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
          </button>

          {/* 2. Pencil / Pen Tool (Draw & Choose Room Shapes) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setActiveTool("pencil");
                setSelectedElement(null);
                setShapeMenuOpen((v) => !v);
              }}
              title="เครื่องมือเลือกทรงห้องและวาดผนัง (กดเพื่อเลือกทรงห้อง)"
              className={`flex h-11 w-11 items-center justify-center rounded-full shadow-md transition-all hover:scale-110 active:scale-95 ${
                activeTool === "pencil"
                  ? "bg-amber-400 text-slate-900 ring-4 ring-amber-300/50"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              <PenTool className="h-5 w-5" />
            </button>

            {/* Shape Selection Popover Menu */}
            {shapeMenuOpen && (
              <div className="absolute left-14 top-0 z-40 w-64 rounded-2xl border border-white/30 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md text-white">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/20">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    📐 เลือกทรงห้องที่ต้องการวาด
                  </span>
                  <button
                    type="button"
                    onClick={() => setShapeMenuOpen(false)}
                    className="text-white/60 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectShape("rect")}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold transition ${
                      shapeType === "rect"
                        ? "bg-amber-400 text-slate-950"
                        : "hover:bg-white/10 text-slate-200"
                    }`}
                  >
                    <div className="h-4 w-5 rounded border border-current" />
                    <span>สี่เหลี่ยมผืนผ้า (มาตรฐาน)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectShape("L-left")}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold transition ${
                      shapeType === "L-left"
                        ? "bg-amber-400 text-slate-950"
                        : "hover:bg-white/10 text-slate-200"
                    }`}
                  >
                    <div className="h-4 w-4 border-l-2 border-b-2 border-current" />
                    <span>ห้องรูปตัว L (มุมซ้ายเว้า)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectShape("L-right")}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold transition ${
                      shapeType === "L-right"
                        ? "bg-amber-400 text-slate-950"
                        : "hover:bg-white/10 text-slate-200"
                    }`}
                  >
                    <div className="h-4 w-4 border-r-2 border-b-2 border-current" />
                    <span>ห้องรูปตัว L (มุมขวาเว้า)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectShape("alcove")}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold transition ${
                      shapeType === "alcove"
                        ? "bg-amber-400 text-slate-950"
                        : "hover:bg-white/10 text-slate-200"
                    }`}
                  >
                    <div className="h-4 w-5 border border-dashed border-current" />
                    <span>ห้องมีซอกโต๊ะคอม (Alcove Nook)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Window Tool (Coral Red block on walls) */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("window");
              setSelectedElement(null);
              setShapeMenuOpen(false);
            }}
            title="เครื่องมือวางหน้าต่าง (คลิกบนผนังห้อง หรือลากเพื่อขยับ)"
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-md transition-all hover:scale-110 active:scale-95 ${
              activeTool === "window"
                ? "bg-rose-500 text-white ring-4 ring-rose-300/50"
                : "bg-white text-slate-800 hover:bg-slate-100"
            }`}
          >
            <LayoutGrid className="h-5 w-5" />
          </button>

          {/* 4. Door Tool (Blue block on walls) */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("door");
              setSelectedElement(null);
              setShapeMenuOpen(false);
            }}
            title="เครื่องมือวางประตู (คลิกบนผนังห้อง หรือลากเพื่อขยับ)"
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-md transition-all hover:scale-110 active:scale-95 ${
              activeTool === "door"
                ? "bg-sky-400 text-slate-900 ring-4 ring-sky-300/50"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            <DoorClosed className="h-5 w-5" />
          </button>

          {/* 5. Proceed Arrow (Enter 3D Room) */}
          <button
            type="button"
            onClick={onProceedTo3D}
            title="เสร็จสิ้น เข้าสู่ห้อง 3D"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all hover:scale-110 active:scale-95 hover:bg-emerald-400 ring-2 ring-emerald-300/60"
          >
            <ArrowRight className="h-6 w-6 font-bold" />
          </button>
        </div>

        {/* Blueprint SVG Canvas */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${vbW} ${vbH}`}
          className="h-full w-full max-h-[600px] drop-shadow-2xl overflow-visible cursor-crosshair"
          onClick={() => {
            setSelectedElement(null);
            setShapeMenuOpen(false);
          }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="blueprint-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8" />
              <circle cx="0" cy="0" r="2.5" fill="rgba(255, 255, 255, 0.75)" />
              <circle cx="40" cy="0" r="2.5" fill="rgba(255, 255, 255, 0.75)" />
              <circle cx="0" cy="40" r="2.5" fill="rgba(255, 255, 255, 0.75)" />
              <circle cx="40" cy="40" r="2.5" fill="rgba(255, 255, 255, 0.75)" />
            </pattern>

            {/* Sunlight Beam Gradient */}
            <linearGradient id="sunbeam-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Background */}
          <rect width={vbW} height={vbH} fill="url(#blueprint-grid)" />

          {/* Sunlight Rays Simulation on Canvas */}
          {sunState.isDay && (
            <g pointerEvents="none" opacity={sunState.isDawnOrDusk ? 0.75 : 0.5}>
              {windows.map((win) => {
                let wx = roomX + roomSvgW * win.pos;
                let wy = roomY;
                let angle = 45;
                if (win.wall === "bottom") {
                  wy = roomY + roomSvgH;
                  angle = -135;
                } else if (win.wall === "left") {
                  wx = roomX;
                  wy = roomY + roomSvgH * win.pos;
                  angle = 45;
                } else if (win.wall === "right") {
                  wx = roomX + roomSvgW;
                  wy = roomY + roomSvgH * win.pos;
                  angle = 135;
                }

                return (
                  <polygon
                    key={`beam-${win.id}`}
                    points={`${wx - 40},${wy} ${wx + 40},${wy} ${wx + (win.wall === "left" ? 140 : win.wall === "right" ? -140 : 60)},${wy + (win.wall === "top" ? 160 : -160)} ${wx + (win.wall === "left" ? 60 : -60)},${wy + (win.wall === "top" ? 160 : -160)}`}
                    fill="url(#sunbeam-grad)"
                  />
                );
              })}
            </g>
          )}

          {/* Room Polygon / Rectangle Walls */}
          {roomShape && roomShape.length >= 3 ? (
            // Custom Polygon Shape
            <g>
              <polygon
                points={roomShape
                  .map(([px, pz]) => `${roomX + px * scale},${roomY + pz * scale}`)
                  .join(" ")}
                fill="rgba(255, 255, 255, 0.08)"
                stroke="#ffffff"
                strokeWidth="12"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Draggable Vertex Handles */}
              {activeTool === "pencil" &&
                roomShape.map(([px, pz], idx) => (
                  <circle
                    key={`v-${idx}`}
                    cx={roomX + px * scale}
                    cy={roomY + pz * scale}
                    r="8"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    className="cursor-move hover:scale-125 transition-transform"
                    onMouseDown={(e) => onMouseDownResize({ vertexIndex: idx }, e)}
                  />
                ))}
            </g>
          ) : (
            // Standard Rectangle Room
            <g>
              <rect
                x={roomX}
                y={roomY}
                width={roomSvgW}
                height={roomSvgH}
                rx={8}
                fill="rgba(255, 255, 255, 0.08)"
              />
              <rect
                x={roomX}
                y={roomY}
                width={roomSvgW}
                height={roomSvgH}
                rx={8}
                fill="none"
                stroke="#ffffff"
                strokeWidth="12"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Interactive Wall Click Zones */}
          <rect
            x={roomX}
            y={roomY - 16}
            width={roomSvgW}
            height={32}
            fill="transparent"
            className="cursor-pointer hover:stroke-amber-300/40 hover:stroke-2"
            onClick={(e) => handleWallClick("top", e)}
          />
          <rect
            x={roomX}
            y={roomY + roomSvgH - 16}
            width={roomSvgW}
            height={32}
            fill="transparent"
            className="cursor-pointer hover:stroke-amber-300/40 hover:stroke-2"
            onClick={(e) => handleWallClick("bottom", e)}
          />
          <rect
            x={roomX - 16}
            y={roomY}
            width={32}
            height={roomSvgH}
            fill="transparent"
            className="cursor-pointer hover:stroke-amber-300/40 hover:stroke-2"
            onClick={(e) => handleWallClick("left", e)}
          />
          <rect
            x={roomX + roomSvgW - 16}
            y={roomY}
            width={32}
            height={roomSvgH}
            fill="transparent"
            className="cursor-pointer hover:stroke-amber-300/40 hover:stroke-2"
            onClick={(e) => handleWallClick("right", e)}
          />

          {/* Wall Direction Badges (N, E, S, W) */}
          <g pointerEvents="none" className="font-mono text-[10px] font-bold">
            {/* Top Wall */}
            <rect x={cx - 50} y={roomY - 24} width="100" height="16" rx="4" fill="rgba(15, 23, 42, 0.75)" />
            <text x={cx} y={roomY - 13} textAnchor="middle" dominantBaseline="middle" fill="#93c5fd">
              ⬆️ {wallTopInfo.label}
            </text>

            {/* Right Wall */}
            <rect x={roomX + roomSvgW + 8} y={cy - 20} width="96" height="16" rx="4" fill="rgba(15, 23, 42, 0.75)" />
            <text x={roomX + roomSvgW + 56} y={cy - 9} textAnchor="middle" dominantBaseline="middle" fill="#93c5fd">
              ➡️ {wallRightInfo.label}
            </text>

            {/* Bottom Wall */}
            <rect x={cx - 50} y={roomY + roomSvgH + 8} width="100" height="16" rx="4" fill="rgba(15, 23, 42, 0.75)" />
            <text x={cx} y={roomY + roomSvgH + 19} textAnchor="middle" dominantBaseline="middle" fill="#93c5fd">
              ⬇️ {wallBottomInfo.label}
            </text>

            {/* Left Wall */}
            <rect x={roomX - 104} y={cy - 20} width="96" height="16" rx="4" fill="rgba(15, 23, 42, 0.75)" />
            <text x={roomX - 56} y={cy - 9} textAnchor="middle" dominantBaseline="middle" fill="#93c5fd">
              ⬅️ {wallLeftInfo.label}
            </text>
          </g>

          {/* Windows (Coral / Red blocks with draggable cursor) */}
          {windows.map((w) => {
            const winSvgW = Math.max(36, w.width * scale);
            const isSelected = selectedElement?.type === "window" && selectedElement.id === w.id;

            let wx = 0;
            let wy = 0;
            let width = winSvgW;
            let height = 14;

            if (w.wall === "top") {
              wx = roomX + roomSvgW * w.pos - winSvgW / 2;
              wy = roomY - 7;
            } else if (w.wall === "bottom") {
              wx = roomX + roomSvgW * w.pos - winSvgW / 2;
              wy = roomY + roomSvgH - 7;
            } else if (w.wall === "left") {
              wx = roomX - 7;
              wy = roomY + roomSvgH * w.pos - winSvgW / 2;
              width = 14;
              height = winSvgW;
            } else {
              wx = roomX + roomSvgW - 7;
              wy = roomY + roomSvgH * w.pos - winSvgW / 2;
              width = 14;
              height = winSvgW;
            }

            return (
              <g
                key={w.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedElement({ type: "window", id: w.id });
                  setDraggingOpening({ type: "window", id: w.id });
                }}
                className="cursor-grab active:cursor-grabbing group"
              >
                <rect
                  x={wx}
                  y={wy}
                  width={width}
                  height={height}
                  rx={4}
                  fill="#f87171"
                  stroke={isSelected ? "#ffffff" : "#ef4444"}
                  strokeWidth={isSelected ? 3 : 1}
                  className="filter drop-shadow-md transition-all group-hover:fill-rose-400"
                />
                <rect
                  x={wx + (width > height ? 4 : 2)}
                  y={wy + (height > width ? 4 : 2)}
                  width={width > height ? width - 8 : width - 4}
                  height={height > width ? height - 8 : height - 4}
                  rx={2}
                  fill="rgba(255,255,255,0.4)"
                />
                <text
                  x={wx + width / 2}
                  y={wy + height / 2 - (width > height ? 14 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white font-mono text-[10px] font-bold pointer-events-none drop-shadow"
                >
                  หน้าต่าง {(w.width / 100).toFixed(1)}m (ลากขยับได้)
                </text>
              </g>
            );
          })}

          {/* Doors (Soft Blue blocks with draggable cursor) */}
          {doors.map((d) => {
            const doorSvgW = Math.max(30, d.width * scale);
            const isSelected = selectedElement?.type === "door" && selectedElement.id === d.id;

            let dx = 0;
            let dy = 0;
            let width = doorSvgW;
            let height = 14;

            if (d.wall === "top") {
              dx = roomX + roomSvgW * d.pos - doorSvgW / 2;
              dy = roomY - 7;
            } else if (d.wall === "bottom") {
              dx = roomX + roomSvgW * d.pos - doorSvgW / 2;
              dy = roomY + roomSvgH - 7;
            } else if (d.wall === "left") {
              dx = roomX - 7;
              dy = roomY + roomSvgH * d.pos - doorSvgW / 2;
              width = 14;
              height = doorSvgW;
            } else {
              dx = roomX + roomSvgW - 7;
              dy = roomY + roomSvgH * d.pos - doorSvgW / 2;
              width = 14;
              height = doorSvgW;
            }

            return (
              <g
                key={d.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedElement({ type: "door", id: d.id });
                  setDraggingOpening({ type: "door", id: d.id });
                }}
                className="cursor-grab active:cursor-grabbing group"
              >
                <rect
                  x={dx}
                  y={dy}
                  width={width}
                  height={height}
                  rx={4}
                  fill="#60a5fa"
                  stroke={isSelected ? "#ffffff" : "#2563eb"}
                  strokeWidth={isSelected ? 3 : 1}
                  className="filter drop-shadow-md transition-all group-hover:fill-sky-300"
                />
                <text
                  x={dx + width / 2}
                  y={dy + height / 2 + (width > height ? 16 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white font-mono text-[10px] font-bold pointer-events-none drop-shadow"
                >
                  ประตู {(d.width / 100).toFixed(1)}m (ลากขยับได้)
                </text>
              </g>
            );
          })}

          {/* Wall Dimension Labels */}
          <g pointerEvents="none">
            {/* Top Wall Dimension */}
            <line x1={roomX} y1={roomY - 32} x2={roomX + roomSvgW} y2={roomY - 32} stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeDasharray="4 3" />
            <line x1={roomX} y1={roomY - 36} x2={roomX} y2={roomY - 28} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
            <line x1={roomX + roomSvgW} y1={roomY - 36} x2={roomX + roomSvgW} y2={roomY - 28} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
            <rect x={cx - 30} y={roomY - 44} width="60" height="18" rx="4" fill="rgba(15, 23, 42, 0.85)" />
            <text x={cx} y={roomY - 34} textAnchor="middle" dominantBaseline="middle" className="fill-white font-mono text-xs font-bold">
              {widthM} m
            </text>

            {/* Right Wall Dimension */}
            <line x1={roomX + roomSvgW + 32} y1={roomY} x2={roomX + roomSvgW + 32} y2={roomY + roomSvgH} stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeDasharray="4 3" />
            <line x1={roomX + roomSvgW + 28} y1={roomY} x2={roomX + roomSvgW + 36} y2={roomY} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
            <line x1={roomX + roomSvgW + 28} y1={roomY + roomSvgH} x2={roomX + roomSvgW + 36} y2={roomY + roomSvgH} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
            <rect x={roomX + roomSvgW + 20} y={cy + 8} width="60" height="18" rx="4" fill="rgba(15, 23, 42, 0.85)" />
            <text x={roomX + roomSvgW + 50} y={cy + 18} textAnchor="middle" dominantBaseline="middle" className="fill-white font-mono text-xs font-bold">
              {depthM} m
            </text>
          </g>

          {/* Interactive Resize Handles on Right & Bottom Edges */}
          {activeTool === "pencil" && !roomShape && (
            <>
              <circle
                cx={roomX + roomSvgW}
                cy={cy}
                r="8"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="2.5"
                className="cursor-ew-resize hover:scale-125 transition-transform"
                onMouseDown={(e) => onMouseDownResize("edge-r", e)}
              />
              <circle
                cx={cx}
                cy={roomY + roomSvgH}
                r="8"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="2.5"
                className="cursor-ns-resize hover:scale-125 transition-transform"
                onMouseDown={(e) => onMouseDownResize("edge-b", e)}
              />
              <circle
                cx={roomX + roomSvgW}
                cy={roomY + roomSvgH}
                r="10"
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="3"
                className="cursor-nwse-resize hover:scale-125 transition-transform shadow-lg"
                onMouseDown={(e) => onMouseDownResize("corner-br", e)}
              />
            </>
          )}
        </svg>

        {/* Selected Door / Window Inspector Card */}
        {selectedElement && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-white/30 bg-slate-900/90 p-2.5 shadow-2xl backdrop-blur-md text-white">
            <span className="text-xs font-bold text-amber-300 pr-1 border-r border-white/20">
              {selectedElement.type === "door" ? "🚪 ประตู" : "⊞ หน้าต่าง"}
            </span>

            {/* Switch Wall */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-white/60">ย้ายผนัง:</span>
              <button
                type="button"
                onClick={() => switchSelectedWall("top")}
                className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20 active:scale-95"
              >
                บน
              </button>
              <button
                type="button"
                onClick={() => switchSelectedWall("bottom")}
                className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20 active:scale-95"
              >
                ล่าง
              </button>
              <button
                type="button"
                onClick={() => switchSelectedWall("left")}
                className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20 active:scale-95"
              >
                ซ้าย
              </button>
              <button
                type="button"
                onClick={() => switchSelectedWall("right")}
                className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20 active:scale-95"
              >
                ขวา
              </button>
            </div>

            {/* Change Width */}
            <div className="flex items-center gap-1 text-[11px] pl-1 border-l border-white/20">
              <span className="text-white/60">กว้าง:</span>
              {(selectedElement.type === "door" ? [70, 80, 90, 100] : [80, 120, 160, 200]).map(
                (w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => changeSelectedWidth(w)}
                    className={`rounded-lg px-2 py-1 ${
                      (selectedElement.type === "door" ? selectedDoor?.width : selectedWin?.width) === w
                        ? "bg-amber-400 text-slate-950 font-bold"
                        : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    {w}cm
                  </button>
                )
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 pl-1 border-l border-white/20">
              <button
                type="button"
                onClick={duplicateSelected}
                title="ทำสำเนา"
                className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20 text-white"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                title="ลบออก"
                className="rounded-lg bg-rose-500/80 p-1.5 hover:bg-rose-500 text-white"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Bar: Compass & Sunlight Simulation Panel */}
      <div className="relative z-20 w-full border-t border-white/20 bg-[#1e40af]/80 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Compass Orientation Controls */}
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white">
              <Compass className="h-4 w-4" />
            </span>
            <div>
              <span className="font-bold text-white">ทิศห้อง: </span>
              <span className="font-mono text-amber-300 font-bold">
                {degToCardinal(sun.orientationDeg).label} ({sun.orientationDeg}°)
              </span>
            </div>
            {/* Quick Cardinal Direction Buttons */}
            <div className="flex items-center gap-1 pl-1">
              {[
                { label: "N (เหนือ)", deg: 0 },
                { label: "E (ออก)", deg: 90 },
                { label: "S (ใต้)", deg: 180 },
                { label: "W (ตก)", deg: 270 },
              ].map(({ label, deg }) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => setSun((prev) => ({ ...prev, orientationDeg: deg }))}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    sun.orientationDeg === deg
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Time of Day & Sunlight Simulation */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/30 text-amber-300">
                <Sun className="h-4 w-4" />
              </span>
              <div>
                <span className="font-bold text-white">เวลาจำลอง: </span>
                <span className="font-mono text-amber-300 font-bold">
                  {Math.floor(sun.timeHour).toString().padStart(2, "0")}:
                  {Math.round((sun.timeHour % 1) * 60)
                    .toString()
                    .padStart(2, "0")}{" "}
                  น.
                </span>
              </div>
            </div>

            {/* Time Presets */}
            <div className="flex items-center gap-1">
              {[
                { label: "🌅 07:00", hour: 7.0, k: 3200 },
                { label: "☀️ 12:00", hour: 12.0, k: 5800 },
                { label: "🌇 15:30", hour: 15.5, k: 4500 },
                { label: "🌄 18:00", hour: 18.0, k: 2800 },
                { label: "🌙 21:30", hour: 21.5, k: 7000 },
              ].map(({ label, hour, k }) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() =>
                    setSun((prev) => ({
                      ...prev,
                      timeHour: hour,
                      colorTempK: k,
                    }))
                  }
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    Math.abs(sun.timeHour - hour) < 0.5
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Toggle Climate & Thermal Advice */}
            <button
              type="button"
              onClick={() => setSunPanelOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25"
            >
              <Thermometer className="h-3.5 w-3.5 text-amber-300" />
              <span>{sunPanelOpen ? "ซ่อนแดด & สภาพอากาศ" : "ดูแดด & สภาพอากาศ"}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sunPanelOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Expanded Sunlight, Climate & Advice Drawer */}
        {sunPanelOpen && (
          <div className="mt-2.5 pt-2.5 border-t border-white/20 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* 1. Time & Orientation Sliders */}
            <div className="space-y-1.5 bg-black/20 p-2.5 rounded-xl">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/70">หมุนทิศห้อง (0 - 360°):</span>
                <span className="font-mono font-bold text-amber-300">{sun.orientationDeg}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="359"
                step="5"
                value={sun.orientationDeg}
                onChange={(e) => setSun((prev) => ({ ...prev, orientationDeg: Number(e.target.value) }))}
                className="w-full accent-amber-400"
              />

              <div className="flex justify-between items-center text-[11px] pt-1">
                <span className="text-white/70">สไลเดอร์เวลา (06:00 - 24:00):</span>
                <span className="font-mono font-bold text-amber-300">
                  {Math.floor(sun.timeHour)}:{Math.round((sun.timeHour % 1) * 60).toString().padStart(2, "0")} น.
                </span>
              </div>
              <input
                type="range"
                min="6"
                max="24"
                step="0.25"
                value={sun.timeHour}
                onChange={(e) => setSun((prev) => ({ ...prev, timeHour: Number(e.target.value) }))}
                className="w-full accent-amber-400"
              />
            </div>

            {/* 2. Color Temperature (Kelvin) Slider */}
            <div className="space-y-1.5 bg-black/20 p-2.5 rounded-xl">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/70">อุณหภูมิแสง (Kelvin):</span>
                <span className="font-mono font-bold text-amber-300">{sun.colorTempK}K</span>
              </div>
              <input
                type="range"
                min="2500"
                max="7500"
                step="100"
                value={sun.colorTempK}
                onChange={(e) => setSun((prev) => ({ ...prev, colorTempK: Number(e.target.value) }))}
                className="w-full accent-amber-400"
              />
              <div className="flex justify-between text-[10px] text-white/60">
                <span>2700K (ส้มอุ่น)</span>
                <span>4000K (ขาวนวล)</span>
                <span>6500K (ขาวใส)</span>
              </div>
              <div className="flex items-center gap-2 pt-1 text-[11px]">
                <span className="text-white/70">อุณหภูมิอากาศ:</span>
                <span className="font-mono font-bold text-emerald-300">{sunState.tempC}°C</span>
              </div>
            </div>

            {/* 3. Sunlight & Thermal Advice */}
            <div className="bg-black/30 p-2.5 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{sunlightAdvice.statusText}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-blue-100">
                  {sunlightAdvice.advice}
                </p>
              </div>
              <div className="text-[10px] text-white/50 pt-1">
                ☀️ องศาแดด: {sunState.elevationDeg}° | มุมแดด: {sunState.azimuthDeg}°
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
