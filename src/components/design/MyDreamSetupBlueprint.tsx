"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, PenTool, LayoutGrid, DoorClosed, ArrowRight, Trash2, Check, RotateCcw, Maximize2, Sparkles, Box } from "lucide-react";
import type { RoomSize } from "@/lib/room-planner";
import { type Pt2, shapeBounds } from "@/lib/room-shape";

export interface BlueprintDoor {
  id: string;
  wall: "top" | "bottom" | "left" | "right";
  /** Position from 0 to 1 along the wall */
  pos: number;
  width: number; // in cm (e.g. 80cm)
}

export interface BlueprintWindow {
  id: string;
  wall: "top" | "bottom" | "left" | "right";
  /** Position from 0 to 1 along the wall */
  pos: number;
  width: number; // in cm (e.g. 120cm)
}

interface MyDreamSetupBlueprintProps {
  room: RoomSize;
  doors?: BlueprintDoor[];
  windows?: BlueprintWindow[];
  onChange: (room: RoomSize, doors: BlueprintDoor[], windows: BlueprintWindow[]) => void;
  onProceedTo3D: () => void;
  onCancel?: () => void;
}

export function MyDreamSetupBlueprint({
  room,
  doors: initialDoors = [
    { id: "d-1", wall: "right", pos: 0.7, width: 80 }
  ],
  windows: initialWindows = [
    { id: "w-1", wall: "top", pos: 0.35, width: 120 }
  ],
  onChange,
  onProceedTo3D,
  onCancel,
}: MyDreamSetupBlueprintProps) {
  // Current active tool: 'pencil' (draw/resize walls), 'window' (place window), 'door' (place door)
  const [activeTool, setActiveTool] = useState<"pencil" | "window" | "door">("pencil");

  // Room dimensions in cm
  const [widthCm, setWidthCm] = useState(room.w || 350);
  const [depthCm, setDepthCm] = useState(room.d || 400);
  const [heightCm, setHeightCm] = useState(room.h || 260);

  // Doors & Windows
  const [doors, setDoors] = useState<BlueprintDoor[]>(initialDoors);
  const [windows, setWindows] = useState<BlueprintWindow[]>(initialWindows);

  // Selected item on blueprint for moving/deleting
  const [selectedElement, setSelectedElement] = useState<{ type: "door" | "window"; id: string } | null>(null);

  // Dragging state
  const [isDragging, setIsDragging] = useState<"corner-br" | "edge-r" | "edge-b" | "item" | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startD: number; itemId?: string; itemPos?: number }>({
    mouseX: 0,
    mouseY: 0,
    startW: widthCm,
    startD: depthCm,
  });

  const svgRef = useRef<SVGSVGElement>(null);

  // Sync state to parent
  useEffect(() => {
    // Top window maps to 'back' in ThreeJS diorama, left to 'left'
    const primaryWin = windows.find((w) => w.wall === "top") || windows.find((w) => w.wall === "left") || windows[0];
    const winConfig: RoomSize["win"] = primaryWin
      ? {
          wall: primaryWin.wall === "top" ? "back" : primaryWin.wall === "left" ? "left" : "back",
          pos: primaryWin.pos,
        }
      : { wall: "none", pos: 0.5 };

    const nextRoom: RoomSize = {
      ...room,
      w: widthCm,
      d: depthCm,
      h: heightCm,
      win: winConfig,
    };
    onChange(nextRoom, doors, windows);
  }, [widthCm, depthCm, heightCm, doors, windows, room, onChange]);

  // Dimensions calculations
  const areaM2 = ((widthCm * depthCm) / 10000).toFixed(1);
  const widthM = (widthCm / 100).toFixed(2);
  const depthM = (depthCm / 100).toFixed(2);
  const heightM = (heightCm / 100).toFixed(2);

  // SVG coordinate system:
  // We center the room on the blueprint grid
  // Grid size: 1000 x 700 viewBox
  const vbW = 1000;
  const vbH = 680;
  const cx = vbW / 2;
  const cy = vbH / 2;

  // Scale: 100cm = ~70 SVG units
  const scale = useMemo(() => {
    const maxDim = Math.max(widthCm, depthCm, 300);
    return Math.min(480 / maxDim, 0.95);
  }, [widthCm, depthCm]);

  const roomSvgW = widthCm * scale;
  const roomSvgH = depthCm * scale;
  const roomX = cx - roomSvgW / 2;
  const roomY = cy - roomSvgH / 2;

  // Quick Room Presets
  const applyPreset = (w: number, d: number, h = 260) => {
    setWidthCm(w);
    setDepthCm(d);
    setHeightCm(h);
    // ensure doors and windows remain positioned validly
  };

  // Click on a wall to place door or window
  const handleWallClick = (wall: "top" | "bottom" | "left" | "right", e: React.MouseEvent<SVGElement>) => {
    e.stopPropagation();
    if (activeTool !== "window" && activeTool !== "door") return;

    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * vbW;
    const clickY = ((e.clientY - rect.top) / rect.height) * vbH;

    let pos = 0.5;
    if (wall === "top" || wall === "bottom") {
      pos = Math.max(0.15, Math.min(0.85, (clickX - roomX) / roomSvgW));
    } else {
      pos = Math.max(0.15, Math.min(0.85, (clickY - roomY) / roomSvgH));
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

  // Clear all walls & openings
  const resetBlueprint = () => {
    setWidthCm(350);
    setDepthCm(400);
    setHeightCm(260);
    setDoors([{ id: `d-${Date.now()}`, wall: "right", pos: 0.7, width: 80 }]);
    setWindows([{ id: `w-${Date.now()}`, wall: "top", pos: 0.35, width: 120 }]);
    setSelectedElement(null);
  };

  // Drag handles for room resize
  const onMouseDownResize = (mode: "corner-br" | "edge-r" | "edge-b", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(mode);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: widthCm,
      startD: depthCm,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - dragStartRef.current.mouseX) / scale;
      const deltaY = (e.clientY - dragStartRef.current.mouseY) / scale;

      // Snap to 25cm increments
      if (isDragging === "corner-br" || isDragging === "edge-r") {
        const rawW = dragStartRef.current.startW + deltaX * 2;
        const snappedW = Math.round(rawW / 25) * 25;
        setWidthCm(Math.max(200, Math.min(800, snappedW)));
      }
      if (isDragging === "corner-br" || isDragging === "edge-b") {
        const rawD = dragStartRef.current.startD + deltaY * 2;
        const snappedD = Math.round(rawD / 25) * 25;
        setDepthCm(Math.max(200, Math.min(800, snappedD)));
      }
    };

    const onMouseUp = () => {
      setIsDragging(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, scale]);

  return (
    <div className="relative flex flex-col items-center justify-between overflow-hidden rounded-3xl border-4 border-[#1e40af] bg-[#3b82f6] shadow-2xl select-none min-h-[640px] w-full text-white">
      {/* Blueprint Desk Annotations & Aesthetic Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        {/* Coffee Mug Ring top left */}
        <div className="absolute -left-12 -top-12 h-44 w-44 rounded-full border-4 border-amber-900/30" />
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full border-2 border-amber-800/20" />

        {/* Architect Pencils & Shavings */}
        <div className="absolute right-4 top-4 h-32 w-1.5 rotate-45 rounded-full bg-amber-200/40 shadow-sm" />
        <div className="absolute right-8 top-12 h-24 w-1.5 rotate-12 rounded-full bg-slate-300/40 shadow-sm" />

        {/* Technical handwritten sketches & dimensions */}
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
      <div className="relative z-10 flex w-full flex-wrap items-center justify-between border-b border-white/20 bg-[#1e40af]/60 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white shadow-inner">
            <PenTool className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-mono text-lg font-black tracking-widest uppercase text-white drop-shadow-sm sm:text-xl">
              BLUEPRINT MODE
            </h1>
            <p className="text-[11px] font-medium text-blue-100">
              วาดแปลนและกำหนดขนาดห้องก่อนเริ่มจัดห้อง 3D (สไตล์ My Dream Setup)
            </p>
          </div>
        </div>

        {/* Live Room Metrics HUD */}
        <div className="flex items-center gap-3 font-mono text-xs font-semibold">
          <div className="rounded-xl border border-white/30 bg-black/25 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-blue-200">ขนาด: </span>
            <span className="text-white">{widthM} × {depthM} ม.</span>
            <span className="mx-1 text-white/40">|</span>
            <span className="text-blue-200">เพดาน: </span>
            <span className="text-white">{heightM} ม.</span>
          </div>
          <div className="rounded-xl border border-white/30 bg-black/25 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-blue-200">พื้นที่: </span>
            <span className="font-bold text-amber-300">{areaM2} ตร.ม.</span>
          </div>
        </div>
      </div>

      {/* Main Blueprint Canvas Area */}
      <div className="relative flex flex-1 w-full items-center justify-center p-2 sm:p-6 overflow-hidden">
        {/* Floating Left Toolbar (Identical to My Dream Setup Screenshot) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3 rounded-2xl border border-white/30 bg-[#1d4ed8]/80 p-2 shadow-2xl backdrop-blur-md">
          {/* 1. X Button (Cancel / Reset) */}
          <button
            type="button"
            onClick={onCancel || resetBlueprint}
            title="รีเซ็ตแปลนห้อง"
            className="group flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-md transition-all hover:scale-110 active:scale-95"
          >
            <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
          </button>

          {/* 2. Pencil / Pen Tool (Draw & Resize Walls) */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("pencil");
              setSelectedElement(null);
            }}
            title="เครื่องมือแก้ไขผนังและขนาดห้อง"
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-md transition-all hover:scale-110 active:scale-95 ${
              activeTool === "pencil"
                ? "bg-amber-400 text-slate-900 ring-4 ring-amber-300/50"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            <PenTool className="h-5 w-5" />
          </button>

          {/* 3. Window Tool (Red coral block on walls) */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("window");
              setSelectedElement(null);
            }}
            title="เครื่องมือวางหน้าต่าง (คลิกบนผนังห้อง)"
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
            }}
            title="เครื่องมือวางประตู (คลิกบนผนังห้อง)"
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
          className="h-full w-full max-h-[580px] drop-shadow-2xl overflow-visible cursor-crosshair"
          onClick={() => setSelectedElement(null)}
        >
          <defs>
            {/* Architectural Blueprint Grid Pattern with Dots */}
            <pattern id="blueprint-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              {/* Thin grid lines */}
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8" />
              {/* White intersection dots (matching screenshot) */}
              <circle cx="0" cy="0" r="2.5" fill="rgba(255, 255, 255, 0.75)" />
              <circle cx="40" cy="0" r="2.5" fill="rgba(255, 255, 255, 0.75)" />
              <circle cx="0" cy="40" r="2.5" fill="rgba(255, 255, 255, 0.75)" />
              <circle cx="40" cy="40" r="2.5" fill="rgba(255, 255, 255, 0.75)" />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect width={vbW} height={vbH} fill="url(#blueprint-grid)" />

          {/* Room Interior Fill */}
          <rect
            x={roomX}
            y={roomY}
            width={roomSvgW}
            height={roomSvgH}
            rx={8}
            fill="rgba(255, 255, 255, 0.08)"
            stroke="none"
          />

          {/* Room Walls (Thick white border with soft corners - exactly like screenshot) */}
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

          {/* Interactive Wall Click Zones for Doors / Windows */}
          {/* Top Wall */}
          <rect
            x={roomX}
            y={roomY - 14}
            width={roomSvgW}
            height={28}
            fill="transparent"
            className="cursor-pointer hover:stroke-amber-300/40 hover:stroke-2"
            onClick={(e) => handleWallClick("top", e)}
          />
          {/* Bottom Wall */}
          <rect
            x={roomX}
            y={roomY + roomSvgH - 14}
            width={roomSvgW}
            height={28}
            fill="transparent"
            className="cursor-pointer hover:stroke-amber-300/40 hover:stroke-2"
            onClick={(e) => handleWallClick("bottom", e)}
          />
          {/* Left Wall */}
          <rect
            x={roomX - 14}
            y={roomY}
            width={28}
            height={roomSvgH}
            fill="transparent"
            className="cursor-pointer hover:stroke-amber-300/40 hover:stroke-2"
            onClick={(e) => handleWallClick("left", e)}
          />
          {/* Right Wall */}
          <rect
            x={roomX + roomSvgW - 14}
            y={roomY}
            width={28}
            height={roomSvgH}
            fill="transparent"
            className="cursor-pointer hover:stroke-amber-300/40 hover:stroke-2"
            onClick={(e) => handleWallClick("right", e)}
          />

          {/* Windows (Coral / Red blocks on wall - matching screenshot) */}
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
              // right
              wx = roomX + roomSvgW - 7;
              wy = roomY + roomSvgH * w.pos - winSvgW / 2;
              width = 14;
              height = winSvgW;
            }

            return (
              <g
                key={w.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedElement({ type: "window", id: w.id });
                }}
                className="cursor-grab active:cursor-grabbing group"
              >
                {/* Coral Red Block (My Dream Setup window) */}
                <rect
                  x={wx}
                  y={wy}
                  width={width}
                  height={height}
                  rx={4}
                  fill="#f87171"
                  stroke={isSelected ? "#ffffff" : "#ef4444"}
                  strokeWidth={isSelected ? 2 : 1}
                  className="filter drop-shadow-md transition-all group-hover:fill-rose-400"
                />
                {/* Inner Window Glazing line */}
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
                  className="fill-white font-mono text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                >
                  หน้าต่าง {(w.width / 100).toFixed(1)}m
                </text>
              </g>
            );
          })}

          {/* Doors (Soft Blue blocks on wall - matching screenshot) */}
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
              // right
              dx = roomX + roomSvgW - 7;
              dy = roomY + roomSvgH * d.pos - doorSvgW / 2;
              width = 14;
              height = doorSvgW;
            }

            return (
              <g
                key={d.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedElement({ type: "door", id: d.id });
                }}
                className="cursor-grab active:cursor-grabbing group"
              >
                {/* Blue Door Block */}
                <rect
                  x={dx}
                  y={dy}
                  width={width}
                  height={height}
                  rx={4}
                  fill="#60a5fa"
                  stroke={isSelected ? "#ffffff" : "#2563eb"}
                  strokeWidth={isSelected ? 2 : 1}
                  className="filter drop-shadow-md transition-all group-hover:fill-sky-300"
                />
                <text
                  x={dx + width / 2}
                  y={dy + height / 2 + (width > height ? 16 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white font-mono text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                >
                  ประตู {(d.width / 100).toFixed(1)}m
                </text>
              </g>
            );
          })}

          {/* Wall Dimension Labels & Ticks */}
          {/* Top Wall Dimension */}
          <g>
            <line x1={roomX} y1={roomY - 24} x2={roomX + roomSvgW} y2={roomY - 24} stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeDasharray="4 3" />
            <line x1={roomX} y1={roomY - 28} x2={roomX} y2={roomY - 20} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
            <line x1={roomX + roomSvgW} y1={roomY - 28} x2={roomX + roomSvgW} y2={roomY - 20} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
            <rect x={cx - 32} y={roomY - 36} width="64" height="18" rx="4" fill="rgba(15, 23, 42, 0.75)" />
            <text x={cx} y={roomY - 26} textAnchor="middle" dominantBaseline="middle" className="fill-white font-mono text-xs font-bold">
              {widthM} m
            </text>
          </g>

          {/* Right Wall Dimension */}
          <g>
            <line x1={roomX + roomSvgW + 24} y1={roomY} x2={roomX + roomSvgW + 24} y2={roomY + roomSvgH} stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeDasharray="4 3" />
            <line x1={roomX + roomSvgW + 20} y1={roomY} x2={roomX + roomSvgW + 28} y2={roomY} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
            <line x1={roomX + roomSvgW + 20} y1={roomY + roomSvgH} x2={roomX + roomSvgW + 28} y2={roomY + roomSvgH} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
            <rect x={roomX + roomSvgW + 10} y={cy - 9} width="64" height="18" rx="4" fill="rgba(15, 23, 42, 0.75)" />
            <text x={roomX + roomSvgW + 42} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-white font-mono text-xs font-bold">
              {depthM} m
            </text>
          </g>

          {/* Interactive Resize Handles on Right & Bottom Edges */}
          {activeTool === "pencil" && (
            <>
              {/* Right edge drag handle */}
              <circle
                cx={roomX + roomSvgW}
                cy={cy}
                r="7"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="2.5"
                className="cursor-ew-resize hover:scale-125 transition-transform"
                onMouseDown={(e) => onMouseDownResize("edge-r", e)}
              />
              {/* Bottom edge drag handle */}
              <circle
                cx={cx}
                cy={roomY + roomSvgH}
                r="7"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="2.5"
                className="cursor-ns-resize hover:scale-125 transition-transform"
                onMouseDown={(e) => onMouseDownResize("edge-b", e)}
              />
              {/* Bottom-right corner resize handle */}
              <circle
                cx={roomX + roomSvgW}
                cy={roomY + roomSvgH}
                r="9"
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="3"
                className="cursor-nwse-resize hover:scale-125 transition-transform shadow-lg"
                onMouseDown={(e) => onMouseDownResize("corner-br", e)}
              />
            </>
          )}
        </svg>

        {/* Selected Item Floating Action Bubble */}
        {selectedElement && (
          <div className="absolute top-6 right-6 z-30 flex items-center gap-2 rounded-2xl border border-white/30 bg-slate-900/90 p-2 shadow-xl backdrop-blur-md">
            <span className="px-2 text-xs font-semibold text-white">
              {selectedElement.type === "door" ? "🚪 ประตูที่เลือก" : "🪟 หน้าต่างที่เลือก"}
            </span>
            <button
              type="button"
              onClick={deleteSelected}
              className="flex h-8 items-center gap-1 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white transition-all hover:bg-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" /> ลบออก
            </button>
          </div>
        )}

        {/* Bottom Right Trash Button (Matching Screenshot) */}
        <button
          type="button"
          onClick={resetBlueprint}
          title="ล้างและเริ่มวาดแปลนใหม่"
          className="absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-xl transition-all hover:scale-110 active:scale-95 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Bottom Control Bar: Quick Presets, Sliders, & Action Buttons */}
      <div className="relative z-10 flex w-full flex-col gap-3 border-t border-white/20 bg-[#1e40af]/80 p-3 sm:p-4 backdrop-blur-md">
        {/* Preset Shapes / Sizes */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-blue-200">ขนาดห้องสำเร็จรูป:</span>
            <button
              type="button"
              onClick={() => applyPreset(300, 350, 260)}
              className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/25 transition-colors"
            >
              คอนโด (3×3.5m)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(350, 400, 260)}
              className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/25 transition-colors"
            >
              ห้องนอน (3.5×4m)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(400, 500, 280)}
              className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/25 transition-colors"
            >
              ห้องเกมมิ่ง (4×5m)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(500, 600, 300)}
              className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/25 transition-colors"
            >
              สตูดิโอกว้าง (5×6m)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onProceedTo3D}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Box className="h-4 w-4" />
              เริ่มจัดห้อง 3D (Start 3D Setup) →
            </button>
          </div>
        </div>

        {/* Sliders for precise Width, Depth, Height */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-14 font-semibold text-blue-200">กว้าง (W):</span>
            <input
              type="range"
              min={200}
              max={800}
              step={25}
              value={widthCm}
              onChange={(e) => setWidthCm(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <span className="font-mono font-bold w-12 text-right">{widthM} ม.</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-14 font-semibold text-blue-200">ยาว (L):</span>
            <input
              type="range"
              min={200}
              max={800}
              step={25}
              value={depthCm}
              onChange={(e) => setDepthCm(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <span className="font-mono font-bold w-12 text-right">{depthM} ม.</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-14 font-semibold text-blue-200">เพดาน (H):</span>
            <input
              type="range"
              min={220}
              max={400}
              step={10}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <span className="font-mono font-bold w-12 text-right">{heightM} ม.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
