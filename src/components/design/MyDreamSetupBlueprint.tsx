"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X,
  PenTool,
  LayoutGrid,
  DoorClosed,
  ArrowRight,
  Trash2,
  Compass,
  Sun,
  Thermometer,
  Copy,
  ChevronDown,
  Undo2,
  Plus,
  Minus,
  Waypoints,
  Eraser,
  Check,
  Maximize2,
  Minimize2,
  Ruler,
} from "lucide-react";
import type { RoomSize } from "@/lib/room-planner";
import { pointInShape, signedArea, type Pt2 } from "@/lib/room-shape";
import {
  type SunSettings,
  DEFAULT_SUN_SETTINGS,
  degToCardinal,
  calculateSunState,
  analyzeWindowSunlight,
} from "@/lib/sun-simulation";
import {
  GRID_CELL_CM,
  GRID_CELL_PX,
  GRID_COLS,
  GRID_ROWS,
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
  normalizeCanvasPolygon,
  cmToSvg,
  svgToCm,
  getEdgeInfo,
  findClosestWallEdge,
  movePolygonEdge,
  setPolygonEdgeLength,
  hasSelfIntersection,
  type CanvasInteriorWall,
  type OpeningObstacleRange,
  minDistToPolyBoundary,
  isPointInOrNearRoom,
  snapPointToRoomWalls,
  resolveInteriorWallDrag,
  clampOpeningOnSegment,
  unionRoomPolygons,
  subtractRoomPolygons,
  mergePointPenExtension,
  snapPointPenCursor,
} from "@/lib/blueprint-geometry";

export interface BlueprintDoor {
  id: string;
  edgeIndex?: number;
  interiorWallId?: string;
  wall: "top" | "bottom" | "left" | "right";
  /** Position from 0.08 to 0.92 along the wall segment */
  pos: number;
  width: number; // in cm (e.g. 80cm)
}

export interface BlueprintWindow {
  id: string;
  edgeIndex?: number;
  interiorWallId?: string;
  wall: "top" | "bottom" | "left" | "right";
  /** Position from 0.08 to 0.92 along the wall segment */
  pos: number;
  width: number; // in cm (e.g. 120cm)
}

interface BlueprintHistoryItem {
  poly: Pt2[];
  interiorWalls: CanvasInteriorWall[];
  isBlank: boolean;
}

type PenDrawMode = "paint-add" | "paint-erase" | "point-pen";

interface MyDreamSetupBlueprintProps {
  room: RoomSize;
  doors?: BlueprintDoor[];
  windows?: BlueprintWindow[];
  sunSettings?: SunSettings;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onChange: (
    room: RoomSize,
    doors: BlueprintDoor[],
    windows: BlueprintWindow[],
    sunSettings: SunSettings
  ) => void;
  onProceedTo3D: () => void;
  onCancel?: () => void;
  onOpenMeasure?: () => void;
}

const VB_W = 1140;
const VB_H = 680;

/** ไอคอนรูปหน้าต่างพร้อมขอบธรณีหน้าต่างและเส้นแบ่งกระจก (แทนไอคอนสี่เหลี่ยมแยก 4 อันเดิม) */
function WindowPaneIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* กรอบหน้าต่างหลัก */}
      <rect x="4" y="3" width="16" height="16" rx="1.5" />
      {/* เส้นแบ่งบานกระจกซ้าย-ขวา และ บน-ล่าง */}
      <line x1="12" y1="3" x2="12" y2="19" />
      <line x1="4" y1="11" x2="20" y2="11" />
      {/* ขอบธรณีหน้าต่างด้านล่าง (Window Sill) */}
      <line x1="2.5" y1="19" x2="21.5" y2="19" strokeWidth="2.2" />
      {/* แสงสะท้อนกระจกเล็กๆ */}
      <line x1="6.5" y1="6.8" x2="8.4" y2="5.2" strokeWidth="1.4" />
    </svg>
  );
}

/** สร้าง Polygon เริ่มต้นบนกระดาษพิมพ์เขียวจาก RoomSize */
function initialCanvasPolyFromRoom(room: RoomSize): Pt2[] {
  const w = room.w || 350;
  const d = room.d || 400;
  const totalW = GRID_COLS * GRID_CELL_CM;
  const totalD = GRID_ROWS * GRID_CELL_CM;
  const ox = Math.max(50, Math.round((totalW - w) / 2 / GRID_CELL_CM) * GRID_CELL_CM);
  const oz = Math.max(50, Math.round((totalD - d) / 2 / GRID_CELL_CM) * GRID_CELL_CM);

  if (room.shape && room.shape.length >= 3) {
    return room.shape.map(([x, z]) => [ox + x, oz + z]);
  }
  return [
    [ox, oz],
    [ox + w, oz],
    [ox + w, oz + d],
    [ox, oz + d],
  ];
}

function initialCanvasInteriorWallsFromRoom(room: RoomSize): CanvasInteriorWall[] {
  if (!room.interiorWalls || room.interiorWalls.length === 0) return [];
  const w = room.w || 350;
  const d = room.d || 400;
  const totalW = GRID_COLS * GRID_CELL_CM;
  const totalD = GRID_ROWS * GRID_CELL_CM;
  const ox = Math.max(50, Math.round((totalW - w) / 2 / GRID_CELL_CM) * GRID_CELL_CM);
  const oz = Math.max(50, Math.round((totalD - d) / 2 / GRID_CELL_CM) * GRID_CELL_CM);
  return room.interiorWalls.map((iw) => ({
    id: iw.id,
    x1: ox + iw.x1,
    z1: oz + iw.z1,
    x2: ox + iw.x2,
    z2: oz + iw.z2,
  }));
}

export function MyDreamSetupBlueprint({
  room,
  doors: initialDoors = [{ id: "d-1", edgeIndex: 1, wall: "right", pos: 0.7, width: 80 }],
  windows: initialWindows = [{ id: "w-1", edgeIndex: 0, wall: "top", pos: 0.4, width: 120 }],
  sunSettings: initialSunSettings = DEFAULT_SUN_SETTINGS,
  isFullscreen = false,
  onToggleFullscreen,
  onChange,
  onProceedTo3D,
  onCancel,
  onOpenMeasure,
}: MyDreamSetupBlueprintProps) {
  // เครื่องมือหลักฝั่งซ้าย: ปากกาวาดห้อง | หน้าต่าง | ประตู
  const [activeTool, setActiveTool] = useState<"pencil" | "window" | "door">("pencil");
  // โหมดย่อยของปากกาวาดห้อง: วาด/ต่อเติมบล็อก | เว้ามุม | คลิกจุดต่อจุด
  const [penMode, setPenMode] = useState<PenDrawMode>("paint-add");

  // รูปทรงห้องปัจจุบันบนกระดาษพิมพ์เขียว + กำแพงกั้นภายในห้อง
  const [canvasPolyCm, setCanvasPolyCm] = useState<Pt2[]>(() => initialCanvasPolyFromRoom(room));
  const [interiorWalls, setInteriorWalls] = useState<CanvasInteriorWall[]>(() =>
    initialCanvasInteriorWallsFromRoom(room)
  );
  const [polyHistory, setPolyHistory] = useState<BlueprintHistoryItem[]>([]);
  const [isBlankCanvas, setIsBlankCanvas] = useState(false);

  // โหมดมุมมองและการซูม: fit = พอดีห้องอัตโนมัติ (ไม่เล็กไป ไม่ใหญ่เกิน), full = ตารางเต็ม 11×7 เมตร
  const [viewMode, setViewMode] = useState<"fit" | "full">("fit");
  const [customZoom, setCustomZoom] = useState<number>(1);

  // จุดที่กำลังวาดในโหมดคลิกจุดต่อจุด (Point-to-Point Wall Pen)
  const [draftPointsCm, setDraftPointsCm] = useState<Pt2[]>([]);
  const [cursorCm, setCursorCm] = useState<Pt2 | null>(null);

  // ความสูงเพดาน (ซม.) + ช่องพิมพ์ตัวเลขความสูงเพดานละเอียด 0.1 ม.
  const [heightCm, setHeightCm] = useState(room.h || 260);
  const [heightInput, setHeightInput] = useState(() =>
    String(Number(((room.h || 260) / 100).toFixed(2)))
  );

  // ประตูและหน้าต่าง
  const [doors, setDoors] = useState<BlueprintDoor[]>(initialDoors);
  const [windows, setWindows] = useState<BlueprintWindow[]>(initialWindows);

  // ชิ้นประตู/หน้าต่างที่กำลังเลือก
  const [selectedElement, setSelectedElement] = useState<{
    type: "door" | "window";
    id: string;
  } | null>(null);

  // กำแพงกั้นในห้องที่กำลังเลือกแก้ไข
  const [selectedInteriorWallId, setSelectedInteriorWallId] = useState<string | null>(null);
  const [interiorWallLenInput, setInteriorWallLenInput] = useState("");

  // ผนังนอกที่กำลังคลิกพิมพ์ตัวเลขความยาว (ละเอียดระดับ 0.1 เมตร / 0.01 เมตร)
  const [editingWallIndex, setEditingWallIndex] = useState<number | null>(null);
  const [wallLenInput, setWallLenInput] = useState("");

  // ทิศทางเข็มทิศ (ละเอียด 0.1°) & แสงอาทิตย์ตามเวลา + เมนูทรงห้องสำเร็จรูป
  const [sun, setSun] = useState<SunSettings>(room.sunSettings || initialSunSettings);
  const [compassInput, setCompassInput] = useState(() =>
    String(Number(((room.sunSettings || initialSunSettings).orientationDeg || 0).toFixed(1)))
  );
  const [sunPanelOpen, setSunPanelOpen] = useState(false);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);

  // สถานะการลากวาดบล็อกบนตาราง หรือลากกั้นกำแพงในห้องอัตโนมัติ
  const [boxDrag, setBoxDrag] = useState<{
    mode: "add" | "erase";
    startGx: number;
    startGz: number;
    curGx: number;
    curGz: number;
    startRawCm: Pt2;
    curRawCm: Pt2;
    shiftKey: boolean;
  } | null>(null);

  // สถานะการลากจุดมุมห้อง เส้นผนังนอก หรือปลายกำแพงกั้นในห้อง
  const [handleDrag, setHandleDrag] = useState<
    | { kind: "vertex"; index: number; startMouseCm: Pt2; basePoly: Pt2[]; baseInteriorWalls: CanvasInteriorWall[] }
    | { kind: "edge"; index: number; startMouseCm: Pt2; basePoly: Pt2[]; baseInteriorWalls: CanvasInteriorWall[] }
    | { kind: "interior-end"; wallId: string; end: 1 | 2; startMouseCm: Pt2; basePoly: Pt2[]; baseInteriorWalls: CanvasInteriorWall[] }
    | null
  >(null);

  // สถานะการลากย้ายหน้าต่างหรือประตูไปตามผนัง
  const [draggingOpening, setDraggingOpening] = useState<{
    type: "door" | "window";
    id: string;
  } | null>(null);

  // สถานะการหมุนวงเข็มทิศบนกระดาษ
  const [draggingCompass, setDraggingCompass] = useState(false);
  const sunOrientationRef = useRef(sun.orientationDeg);
  useEffect(() => {
    sunOrientationRef.current = sun.orientationDeg;
  }, [sun.orientationDeg]);
  const compassDragRef = useRef<{ prevAngleRad: number } | null>(null);

  // Hover state (ใช้ React state แทน CSS transform: scale บน SVG เพื่อป้องกันอาการจุดสีส้มสั่น/กระพริบ 100%)
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const compassDialRef = useRef<SVGSVGElement>(null);

  // ตั้งค่าองศาเข็มทิศแบบละเอียด 0.1° (0.0° - 359.9°)
  const setOrientationDeg01 = useCallback((rawDeg: number) => {
    const normalized = Math.round(((((rawDeg % 360) + 360) % 360) * 10)) / 10 % 360;
    setSun((prev) => ({ ...prev, orientationDeg: normalized }));
    setCompassInput(normalized.toFixed(1));
  }, []);

  const handleCompassInputChange = (val: string) => {
    setCompassInput(val);
    const parsed = parseFloat(val);
    if (Number.isFinite(parsed) && !val.endsWith(".")) {
      const normalized = Math.round(((((parsed % 360) + 360) % 360) * 10)) / 10 % 360;
      setSun((prev) => ({ ...prev, orientationDeg: normalized }));
    }
  };

  const commitCompassInput = () => {
    const parsed = parseFloat(compassInput);
    if (Number.isFinite(parsed)) {
      setOrientationDeg01(parsed);
    } else {
      setCompassInput(Number(sun.orientationDeg.toFixed(1)).toFixed(1));
    }
  };

  // เก็บ ref ของ callback เพื่อไม่ให้เกิด infinite render loop กับ parent
  const onChangeRef = useRef(onChange);
  const roomBaseRef = useRef(room);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    roomBaseRef.current = room;
  }, [room]);

  // คำนวณข้อมูลห้องที่ normalize แล้วสำหรับส่งให้ระบบ 3D
  const normalizedRoom = useMemo(() => {
    return normalizeCanvasPolygon(canvasPolyCm);
  }, [canvasPolyCm]);

  const widthCm = normalizedRoom?.widthCm ?? 350;
  const depthCm = normalizedRoom?.depthCm ?? 400;

  // คำนวณ ViewBox สำหรับการแสดงผลให้ห้อง "พอดีจอ" เสมอ ไม่เล็กไป ไม่ใหญ่เกิน
  const computedViewBox = useMemo(() => {
    if (viewMode === "full" || isBlankCanvas || canvasPolyCm.length < 3) {
      return { x: 0, y: 0, w: VB_W, h: VB_H };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [x, z] of canvasPolyCm) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const [minSx, minSy] = cmToSvg(minX, minZ);
    const [maxSx, maxSy] = cmToSvg(maxX, maxZ);
    const roomW = Math.max(80, maxSx - minSx);
    const roomH = Math.max(80, maxSy - minSy);
    const centerX = (minSx + maxSx) / 2;
    const centerY = (minSy + maxSy) / 2;

    // เผื่อขอบข้างให้ตัวเลขบอกขนาดและเครื่องมือลอย
    const padX = 140;
    const padY = 95;
    const neededW = (roomW + padX * 2) / customZoom;
    const neededH = (roomH + padY * 2) / customZoom;

    const aspect = VB_W / VB_H; // 1140 / 680 = 1.676
    let w = neededW;
    let h = neededH;
    if (w / h < aspect) {
      w = h * aspect;
    } else {
      h = w / aspect;
    }
    w = Math.min(Math.max(w, 360), VB_W * 1.3);
    h = w / aspect;
    const x = centerX - w / 2;
    const y = centerY - h / 2;
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }, [canvasPolyCm, isBlankCanvas, viewMode, customZoom]);

  // ย้ายประตู/หน้าต่างให้เกาะผนังที่ใกล้ที่สุดเสมอเมื่อรูปทรงห้องเปลี่ยน
  const reattachOpeningsToPoly = useCallback(
    (oldPoly: Pt2[], nextPoly: Pt2[], nextInteriorWalls?: CanvasInteriorWall[]) => {
      if (nextPoly.length < 3) return;
      const validIwIds = new Set((nextInteriorWalls ?? interiorWalls).map((iw) => iw.id));

      const mapOpening = <T extends BlueprintDoor | BlueprintWindow>(item: T): T => {
        if (item.interiorWallId && validIwIds.has(item.interiorWallId)) {
          return item;
        }
        let wx = nextPoly[0][0];
        let wz = nextPoly[0][1];
        if (oldPoly.length >= 3) {
          const edgeIdx =
            item.edgeIndex !== undefined && item.edgeIndex < oldPoly.length ? item.edgeIndex : 0;
          const info = getEdgeInfo(oldPoly, edgeIdx);
          wx = info.x1 + info.ex * info.lengthCm * item.pos;
          wz = info.z1 + info.ez * info.lengthCm * item.pos;
        }
        const hit = findClosestWallEdge(nextPoly, wx, wz, item.width);
        if (!hit) return item;
        return {
          ...item,
          interiorWallId: undefined,
          edgeIndex: hit.edgeIndex,
          wall: hit.wallCardinal,
          pos: hit.pos,
        };
      };

      setWindows((prev) => prev.map(mapOpening));
      setDoors((prev) => prev.map(mapOpening));
    },
    [interiorWalls]
  );

  // อัปเดต Polygon พร้อมเก็บประวัติ Undo (รวมกำแพงกั้นในห้องด้วย)
  const commitNewPoly = useCallback(
    (nextPolyRaw: Pt2[], customInteriorWalls?: CanvasInteriorWall[]) => {
      const norm = normalizeCanvasPolygon(nextPolyRaw);
      if (!norm) return;
      setPolyHistory((h) => [
        ...h.slice(-19),
        { poly: canvasPolyCm, interiorWalls, isBlank: isBlankCanvas },
      ]);
      const filteredIw = (customInteriorWalls ?? interiorWalls).filter((iw) => {
        const mx = (iw.x1 + iw.x2) * 0.5;
        const mz = (iw.z1 + iw.z2) * 0.5;
        return pointInShape(mx, mz, norm.canvasPolyCm);
      });
      setInteriorWalls(filteredIw);
      reattachOpeningsToPoly(canvasPolyCm, norm.canvasPolyCm, filteredIw);
      setCanvasPolyCm(norm.canvasPolyCm);
      setIsBlankCanvas(false);
    },
    [canvasPolyCm, interiorWalls, isBlankCanvas, reattachOpeningsToPoly]
  );

  const handleUndoRoomShape = useCallback(() => {
    setPolyHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setInteriorWalls(last.interiorWalls);
      setCanvasPolyCm((cur) => {
        if (!last.isBlank && last.poly.length >= 3) {
          reattachOpeningsToPoly(cur, last.poly, last.interiorWalls);
        }
        return last.poly;
      });
      setIsBlankCanvas(last.isBlank);
      setSelectedInteriorWallId(null);
      return h.slice(0, -1);
    });
  }, [reattachOpeningsToPoly]);

  // Sync ข้อมูลห้องออกไปยังหน้าหลักเฉพาะเมื่อค่าจริงเปลี่ยน (ไม่มีทางเกิด loop)
  useEffect(() => {
    if (!normalizedRoom || isBlankCanvas) return;

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

    const [ox, oz] = normalizedRoom.originCm;
    const localInteriorWalls = interiorWalls
      .filter((iw) => Math.hypot(iw.x2 - iw.x1, iw.z2 - iw.z1) >= 30)
      .map((iw) => ({
        id: iw.id,
        x1: Math.round(iw.x1 - ox),
        z1: Math.round(iw.z1 - oz),
        x2: Math.round(iw.x2 - ox),
        z2: Math.round(iw.z2 - oz),
      }));

    const nextRoom: RoomSize = {
      ...roomBaseRef.current,
      w: normalizedRoom.widthCm,
      d: normalizedRoom.depthCm,
      h: heightCm,
      shape: normalizedRoom.isSimpleRect ? undefined : normalizedRoom.localShapeCm,
      interiorWalls: localInteriorWalls.length > 0 ? localInteriorWalls : undefined,
      orientation: sun.orientationDeg,
      sunSettings: sun,
      win: winConfig,
      windows: windows.map((w) => ({
        id: w.id,
        edgeIndex: w.edgeIndex,
        interiorWallId: w.interiorWallId,
        wall: w.wall,
        pos: w.pos,
        width: w.width,
      })),
      doors: doors.map((d) => ({
        id: d.id,
        edgeIndex: d.edgeIndex,
        interiorWallId: d.interiorWallId,
        wall: d.wall,
        pos: d.pos,
        width: d.width,
      })),
    };

    onChangeRef.current(nextRoom, doors, windows, sun);
  }, [normalizedRoom, isBlankCanvas, heightCm, doors, windows, sun, interiorWalls]);

  // พื้นที่และตัวเลขขนาดห้อง
  const areaM2 = useMemo(() => {
    if (isBlankCanvas || canvasPolyCm.length < 3) return "0.0";
    return (Math.abs(signedArea(canvasPolyCm)) / 10000).toFixed(1);
  }, [canvasPolyCm, isBlankCanvas]);

  const widthM = String(Number((widthCm / 100).toFixed(2)));
  const depthM = String(Number((depthCm / 100).toFixed(2)));

  // เปิดกล่องแก้ไขความยาวผนังนอกด้านที่เลือก (หน่วย เมตร ละเอียดระดับ 0.1 ม.)
  const openWallEditor = useCallback(
    (edgeIdx: number) => {
      if (isBlankCanvas || canvasPolyCm.length < 3) return;
      const safeIdx = ((edgeIdx % canvasPolyCm.length) + canvasPolyCm.length) % canvasPolyCm.length;
      const info = getEdgeInfo(canvasPolyCm, safeIdx);
      setSelectedElement(null);
      setSelectedInteriorWallId(null);
      setEditingWallIndex(safeIdx);
      setWallLenInput(String(Number((info.lengthCm / 100).toFixed(2))));
    },
    [canvasPolyCm, isBlankCanvas]
  );

  // เลือกแก้ไขกำแพงกั้นภายในห้อง (ละเอียด 0.1 ม.)
  const selectInteriorWall = useCallback(
    (wallId: string) => {
      const iw = interiorWalls.find((w) => w.id === wallId);
      if (!iw) return;
      const lenCm = Math.hypot(iw.x2 - iw.x1, iw.z2 - iw.z1);
      setSelectedElement(null);
      setEditingWallIndex(null);
      setSelectedInteriorWallId(wallId);
      setInteriorWallLenInput(String(Number((lenCm / 100).toFixed(2))));
    },
    [interiorWalls]
  );

  const applyInteriorWallLengthMeters = useCallback(
    (wallId: string, meters: number) => {
      if (!Number.isFinite(meters) || meters < 0.4 || meters > 13) return false;
      const iw = interiorWalls.find((w) => w.id === wallId);
      if (!iw) return false;
      const curLen = Math.hypot(iw.x2 - iw.x1, iw.z2 - iw.z1);
      if (curLen < 1) return false;
      const targetCm = Math.round(meters * 100);
      const ex = (iw.x2 - iw.x1) / curLen;
      const ez = (iw.z2 - iw.z1) / curLen;
      const nx2 = Math.round(iw.x1 + ex * targetCm);
      const nz2 = Math.round(iw.z1 + ez * targetCm);
      if (!isPointInOrNearRoom(nx2, nz2, canvasPolyCm, 20)) return false;

      setPolyHistory((h) => [
        ...h.slice(-19),
        { poly: canvasPolyCm, interiorWalls, isBlank: isBlankCanvas },
      ]);
      setInteriorWalls((prev) =>
        prev.map((w) => (w.id === wallId ? { ...w, x2: nx2, z2: nz2 } : w))
      );
      setInteriorWallLenInput(String(Number((targetCm / 100).toFixed(2))));
      return true;
    },
    [interiorWalls, canvasPolyCm, isBlankCanvas]
  );

  const nudgeInteriorWallLength = useCallback(
    (deltaM: number) => {
      if (!selectedInteriorWallId) return;
      const iw = interiorWalls.find((w) => w.id === selectedInteriorWallId);
      if (!iw) return;
      const curM = Math.hypot(iw.x2 - iw.x1, iw.z2 - iw.z1) / 100;
      const nextM = Math.max(0.4, Math.min(13, Math.round((curM + deltaM) * 10) / 10));
      applyInteriorWallLengthMeters(selectedInteriorWallId, nextM);
    },
    [selectedInteriorWallId, interiorWalls, applyInteriorWallLengthMeters]
  );

  const deleteSelectedInteriorWall = useCallback(() => {
    if (!selectedInteriorWallId) return;
    setPolyHistory((h) => [
      ...h.slice(-19),
      { poly: canvasPolyCm, interiorWalls, isBlank: isBlankCanvas },
    ]);
    setInteriorWalls((prev) => prev.filter((w) => w.id !== selectedInteriorWallId));
    setDoors((prev) => prev.filter((d) => d.interiorWallId !== selectedInteriorWallId));
    setWindows((prev) => prev.filter((w) => w.interiorWallId !== selectedInteriorWallId));
    setSelectedInteriorWallId(null);
  }, [selectedInteriorWallId, canvasPolyCm, interiorWalls, isBlankCanvas]);

  const applyWallLengthMeters = useCallback(
    (edgeIdx: number, meters: number) => {
      if (!Number.isFinite(meters) || meters < 0.4 || meters > 13) return false;
      const targetCm = Math.round(meters * 100);
      const nextPoly = setPolygonEdgeLength(canvasPolyCm, edgeIdx, targetCm);
      if (!nextPoly) return false;
      commitNewPoly(nextPoly);
      const updated = getEdgeInfo(nextPoly, edgeIdx);
      setWallLenInput(String(Number((updated.lengthCm / 100).toFixed(2))));
      return true;
    },
    [canvasPolyCm, commitNewPoly]
  );

  const nudgeWallLengthMeters = useCallback(
    (deltaM: number) => {
      if (editingWallIndex === null || canvasPolyCm.length < 3) return;
      const safeIdx = editingWallIndex % canvasPolyCm.length;
      const curM = getEdgeInfo(canvasPolyCm, safeIdx).lengthCm / 100;
      const nextM = Math.max(0.4, Math.min(13, Math.round((curM + deltaM) * 10) / 10));
      applyWallLengthMeters(safeIdx, nextM);
    },
    [editingWallIndex, canvasPolyCm, applyWallLengthMeters]
  );

  // แปลงพิกัดเมาส์เป็นพิกัด SVG และ ซม. (ใช้ getScreenCTM เพื่อให้แม่นยำ 100% ทุกขนาดจอและโหมดเต็มจอ)
  const clientToSvgAndCm = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgP = pt.matrixTransform(ctm.inverse());
      const [xCm, zCm] = svgToCm(svgP.x, svgP.y);
      return { sx: svgP.x, sy: svgP.y, xCm, zCm };
    }
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const sx = ((clientX - rect.left) / rect.width) * computedViewBox.w + computedViewBox.x;
    const sy = ((clientY - rect.top) / rect.height) * computedViewBox.h + computedViewBox.y;
    const [xCm, zCm] = svgToCm(sx, sy);
    return { sx, sy, xCm, zCm };
  }, [computedViewBox]);

  // เริ่มลากปลายกำแพงในห้อง (แยกออกมาจาก JSX: อ่าน ref ตอนกดเมาส์เท่านั้น ไม่อ่านตอน render)
  const startInteriorEndDrag = useCallback(
    (e: React.MouseEvent<SVGGElement> | React.PointerEvent<SVGGElement>) => {
      const wallId = e.currentTarget.dataset.wall ?? "";
      const end = e.currentTarget.dataset.end === "2" ? 2 : 1;
      if (e.button !== 0 && "pointerType" in e && (e as any).pointerType === "mouse") return;
      if (!wallId) return;
      e.stopPropagation();
      const pt = clientToSvgAndCm(e.clientX, e.clientY);
      if (!pt) return;
      selectInteriorWall(wallId);
      setPolyHistory((h) => [...h.slice(-19), { poly: canvasPolyCm, interiorWalls, isBlank: isBlankCanvas }]);
      setHandleDrag({
        kind: "interior-end",
        wallId,
        end,
        startMouseCm: [pt.xCm, pt.zCm],
        basePoly: canvasPolyCm.map((p) => [p[0], p[1]]),
        baseInteriorWalls: interiorWalls.map((w) => ({ ...w })),
      });
    },
    [clientToSvgAndCm, selectInteriorWall, canvasPolyCm, interiorWalls, isBlankCanvas]
  );

  // เริ่มลากจุดมุมห้อง (Corner Vertex Handle) รองรับทั้งเมาส์ สัมผัส Touch และ Pointer บนมือถือ
  const startVertexDrag = useCallback(
    (index: number, clientX: number, clientY: number) => {
      const pt = clientToSvgAndCm(clientX, clientY);
      if (!pt) return;
      setPolyHistory((h) => [
        ...h.slice(-19),
        { poly: canvasPolyCm, interiorWalls, isBlank: isBlankCanvas },
      ]);
      setHandleDrag({
        kind: "vertex",
        index,
        startMouseCm: [pt.xCm, pt.zCm],
        basePoly: canvasPolyCm.map((p) => [p[0], p[1]]),
        baseInteriorWalls: interiorWalls.map((w) => ({ ...w })),
      });
    },
    [clientToSvgAndCm, canvasPolyCm, interiorWalls, isBlankCanvas]
  );

  // เริ่มลากขอบผนัง (Wall Edge Midpoint Handle)
  const startEdgeDrag = useCallback(
    (index: number, clientX: number, clientY: number) => {
      const pt = clientToSvgAndCm(clientX, clientY);
      if (!pt) return;
      setPolyHistory((h) => [
        ...h.slice(-19),
        { poly: canvasPolyCm, interiorWalls, isBlank: isBlankCanvas },
      ]);
      setHandleDrag({
        kind: "edge",
        index,
        startMouseCm: [pt.xCm, pt.zCm],
        basePoly: canvasPolyCm.map((p) => [p[0], p[1]]),
        baseInteriorWalls: interiorWalls.map((w) => ({ ...w })),
      });
    },
    [clientToSvgAndCm, canvasPolyCm, interiorWalls, isBlankCanvas]
  );

  // เริ่มหมุนเข็มทิศ (Compass Dial Drag) รองรับทั้งเมาส์และการกดค้างลากนิ้วบนมือถือ
  const startCompassDrag = useCallback((clientX: number, clientY: number) => {
    const dialEl = compassDialRef.current;
    if (dialEl) {
      const rect = dialEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angleRad = Math.atan2(clientX - cx, -(clientY - cy));
      compassDragRef.current = { prevAngleRad: angleRad };
    }
    setDraggingCompass(true);
  }, []);

  // จัดระเบียบตำแหน่งหน้าต่างและประตูไม่ให้ชิดมุมกำแพง ทะลุกำแพงกั้นในห้อง หรือซ้อนทับกันอัตโนมัติ (ทั้งตอนโหลดห้องเดิมและเมื่อปรับผนัง/กั้นกำแพงใหม่)
  // (ทำตอน render เมื่อรูปห้อง/กำแพงเปลี่ยน แทน useEffect → ไม่ render ซ้ำ 2 รอบ)
  const [openingsLayout, setOpeningsLayout] = useState<{ poly: typeof canvasPolyCm; walls: typeof interiorWalls; blank: boolean } | null>(null);
  if (!openingsLayout || openingsLayout.poly !== canvasPolyCm || openingsLayout.walls !== interiorWalls || openingsLayout.blank !== isBlankCanvas) {
    setOpeningsLayout({ poly: canvasPolyCm, walls: interiorWalls, blank: isBlankCanvas });
    (() => {
        if (isBlankCanvas || canvasPolyCm.length < 3) return;

        setWindows((prevWins) => {
          let changed = false;
          const placedByEdge = new Map<number, OpeningObstacleRange[]>();
          const nextWins = prevWins.map((w) => {
            const edgeIdx =
              w.edgeIndex !== undefined && w.edgeIndex < canvasPolyCm.length ? w.edgeIndex : 0;
            const info = getEdgeInfo(canvasPolyCm, edgeIdx);
            const sibs = placedByEdge.get(edgeIdx) ?? [];
            const clamped = clampOpeningOnSegment({
              rawPos: w.pos,
              desiredWidthCm: w.width,
              minWidthCm: 55,
              segX1: info.x1,
              segZ1: info.z1,
              segEx: info.ex,
              segEz: info.ez,
              segLenCm: info.lengthCm,
              cornerClearanceCm: 24,
              interiorWalls,
              siblingRangesCm: sibs,
            });
            if (!clamped) return w;
            const centerCm = clamped.pos * info.lengthCm;
            sibs.push({
              startCm: centerCm - clamped.widthCm / 2 - 14,
              endCm: centerCm + clamped.widthCm / 2 + 14,
            });
            placedByEdge.set(edgeIdx, sibs);
            if (Math.abs(clamped.pos - w.pos) > 0.001 || clamped.widthCm !== w.width) {
              changed = true;
              return { ...w, edgeIndex: edgeIdx, pos: clamped.pos, width: clamped.widthCm };
            }
            return w;
          });
          return changed ? nextWins : prevWins;
        });

        setDoors((prevDoors) => {
          let changed = false;
          const placedByKey = new Map<string, OpeningObstacleRange[]>();
          const nextDoors = prevDoors.map((d) => {
            if (d.interiorWallId) {
              const iw = interiorWalls.find((item) => item.id === d.interiorWallId);
              if (!iw) return d;
              const dx = iw.x2 - iw.x1;
              const dz = iw.z2 - iw.z1;
              const lenCm = Math.hypot(dx, dz);
              if (lenCm < 50) return d;
              const key = `iw:${iw.id}`;
              const sibs = placedByKey.get(key) ?? [];
              const clamped = clampOpeningOnSegment({
                rawPos: d.pos,
                desiredWidthCm: d.width,
                minWidthCm: 55,
                segX1: iw.x1,
                segZ1: iw.z1,
                segEx: dx / lenCm,
                segEz: dz / lenCm,
                segLenCm: lenCm,
                cornerClearanceCm: 16,
                interiorWalls,
                excludeInteriorWallId: iw.id,
                siblingRangesCm: sibs,
              });
              if (!clamped) return d;
              const centerCm = clamped.pos * lenCm;
              sibs.push({
                startCm: centerCm - clamped.widthCm / 2 - 12,
                endCm: centerCm + clamped.widthCm / 2 + 12,
              });
              placedByKey.set(key, sibs);
              if (Math.abs(clamped.pos - d.pos) > 0.001 || clamped.widthCm !== d.width) {
                changed = true;
                return { ...d, pos: clamped.pos, width: clamped.widthCm };
              }
              return d;
            }

            const edgeIdx =
              d.edgeIndex !== undefined && d.edgeIndex < canvasPolyCm.length ? d.edgeIndex : 0;
            const info = getEdgeInfo(canvasPolyCm, edgeIdx);
            const key = `edge:${edgeIdx}`;
            const sibs = placedByKey.get(key) ?? [];
            const clamped = clampOpeningOnSegment({
              rawPos: d.pos,
              desiredWidthCm: d.width,
              minWidthCm: 55,
              segX1: info.x1,
              segZ1: info.z1,
              segEx: info.ex,
              segEz: info.ez,
              segLenCm: info.lengthCm,
              cornerClearanceCm: 16,
              interiorWalls,
              siblingRangesCm: sibs,
            });
            if (!clamped) return d;
            const centerCm = clamped.pos * info.lengthCm;
            sibs.push({
              startCm: centerCm - clamped.widthCm / 2 - 12,
              endCm: centerCm + clamped.widthCm / 2 + 12,
            });
            placedByKey.set(key, sibs);
            if (Math.abs(clamped.pos - d.pos) > 0.001 || clamped.widthCm !== d.width) {
              changed = true;
              return { ...d, edgeIndex: edgeIdx, pos: clamped.pos, width: clamped.widthCm };
            }
            return d;
          });
          return changed ? nextDoors : prevDoors;
        });
    })();
  }

  // ค้นหาผนังที่ใกล้ที่สุดพร้อมกันชนมุมกำแพง + กันชนกำแพงกั้นในห้อง + กันซ้อนทับบานอื่น
  const findClosestTargetWall = useCallback(
    (
      xCm: number,
      zCm: number,
      openingWidthCm: number,
      allowInterior: boolean,
      excludeOpeningId?: string
    ) => {
      const cornerClearanceCm = allowInterior ? 16 : 24;
      let best: {
        edgeIndex?: number;
        interiorWallId?: string;
        pos: number;
        fittedWidthCm: number;
        distCm: number;
        wallCardinal: "top" | "bottom" | "left" | "right";
        lengthCm: number;
        x1: number;
        z1: number;
        ex: number;
        ez: number;
      } | null = null;

      for (let i = 0; i < canvasPolyCm.length; i++) {
        const info = getEdgeInfo(canvasPolyCm, i);
        if (info.lengthCm < 65) continue;
        const px = xCm - info.x1;
        const pz = zCm - info.z1;
        const rawPos = (px * info.ex + pz * info.ez) / info.lengthCm;
        const clampedSegT = Math.max(0, Math.min(1, rawPos));
        const distCm = Math.hypot(
          xCm - (info.x1 + info.ex * info.lengthCm * clampedSegT),
          zCm - (info.z1 + info.ez * info.lengthCm * clampedSegT)
        );

        const siblingRangesCm: OpeningObstacleRange[] = [
          ...windows
            .filter((w) => w.id !== excludeOpeningId && !w.interiorWallId && (w.edgeIndex ?? 0) === i)
            .map((w) => {
              const c = w.pos * info.lengthCm;
              return { startCm: c - w.width / 2 - 14, endCm: c + w.width / 2 + 14 };
            }),
          ...doors
            .filter((d) => d.id !== excludeOpeningId && !d.interiorWallId && (d.edgeIndex ?? 0) === i)
            .map((d) => {
              const c = d.pos * info.lengthCm;
              return { startCm: c - d.width / 2 - 14, endCm: c + d.width / 2 + 14 };
            }),
        ];

        const clamped = clampOpeningOnSegment({
          rawPos,
          desiredWidthCm: openingWidthCm,
          minWidthCm: 55,
          segX1: info.x1,
          segZ1: info.z1,
          segEx: info.ex,
          segEz: info.ez,
          segLenCm: info.lengthCm,
          cornerClearanceCm,
          interiorWalls,
          siblingRangesCm,
        });
        if (!clamped) continue;

        if (!best || distCm < best.distCm) {
          best = {
            edgeIndex: i,
            pos: clamped.pos,
            fittedWidthCm: clamped.widthCm,
            distCm,
            wallCardinal: info.wallCardinal,
            lengthCm: info.lengthCm,
            x1: info.x1,
            z1: info.z1,
            ex: info.ex,
            ez: info.ez,
          };
        }
      }

      if (allowInterior) {
        for (const iw of interiorWalls) {
          const dx = iw.x2 - iw.x1;
          const dz = iw.z2 - iw.z1;
          const lenCm = Math.hypot(dx, dz);
          if (lenCm < 65) continue;
          const ex = dx / lenCm;
          const ez = dz / lenCm;
          const proj = (xCm - iw.x1) * ex + (zCm - iw.z1) * ez;
          const clampedProj = Math.max(0, Math.min(lenCm, proj));
          const distCm = Math.hypot(xCm - (iw.x1 + ex * clampedProj), zCm - (iw.z1 + ez * clampedProj));

          const siblingRangesCm: OpeningObstacleRange[] = doors
            .filter((d) => d.id !== excludeOpeningId && d.interiorWallId === iw.id)
            .map((d) => {
              const c = d.pos * lenCm;
              return { startCm: c - d.width / 2 - 12, endCm: c + d.width / 2 + 12 };
            });

          const clamped = clampOpeningOnSegment({
            rawPos: proj / lenCm,
            desiredWidthCm: openingWidthCm,
            minWidthCm: 55,
            segX1: iw.x1,
            segZ1: iw.z1,
            segEx: ex,
            segEz: ez,
            segLenCm: lenCm,
            cornerClearanceCm: 16,
            interiorWalls,
            excludeInteriorWallId: iw.id,
            siblingRangesCm,
          });
          if (!clamped) continue;

          const wallCardinal: "top" | "bottom" | "left" | "right" =
            Math.abs(dx) >= Math.abs(dz) ? "top" : "right";

          if (!best || distCm < best.distCm) {
            best = {
              interiorWallId: iw.id,
              pos: clamped.pos,
              fittedWidthCm: clamped.widthCm,
              distCm,
              wallCardinal,
              lengthCm: lenCm,
              x1: iw.x1,
              z1: iw.z1,
              ex,
              ez,
            };
          }
        }
      }
      return best;
    },
    [canvasPolyCm, interiorWalls, windows, doors]
  );

  // คำนวณดวงอาทิตย์และอุณหภูมิห้องตามเวลา + ทิศจริงของหน้าต่างแต่ละบาน
  const sunState = useMemo(() => {
    return calculateSunState(sun, widthCm, depthCm, heightCm);
  }, [sun, widthCm, depthCm, heightCm]);

  const windowsWithAngle = useMemo(() => {
    if (canvasPolyCm.length < 3) return windows;
    return windows.map((w) => {
      const idx = w.edgeIndex !== undefined && w.edgeIndex < canvasPolyCm.length ? w.edgeIndex : 0;
      const info = getEdgeInfo(canvasPolyCm, idx);
      return {
        ...w,
        outwardBaseDeg: info.outwardBaseDeg,
      };
    });
  }, [windows, canvasPolyCm]);

  const sunlightAdvice = useMemo(() => {
    return analyzeWindowSunlight(sun, windowsWithAngle);
  }, [sun, windowsWithAngle]);

  // เงาตัวอย่าง (Ghost Preview) เวลาเลื่อนเมาส์เตรียมวางหน้าต่าง/ประตู
  const openingPreview = useMemo(() => {
    if ((activeTool !== "window" && activeTool !== "door") || !cursorCm || isBlankCanvas || draggingOpening) {
      return null;
    }
    const wCm = activeTool === "window" ? 120 : 80;
    const hit = findClosestTargetWall(cursorCm[0], cursorCm[1], wCm, activeTool === "door");
    if (!hit || hit.distCm > 55) return null;
    return { ...hit, widthCm: hit.fittedWidthCm, type: activeTool };
  }, [activeTool, cursorCm, isBlankCanvas, draggingOpening, findClosestTargetWall]);

  // พรีเซ็ตทรงห้องด่วน
  const applyQuickShape = (preset: "rect" | "L-left" | "L-right" | "U" | "alcove") => {
    const w = 400;
    const d = 350;
    const ox = 350;
    const oz = 150;
    let pts: Pt2[] = [];
    if (preset === "rect") {
      pts = [
        [ox, oz],
        [ox + w, oz],
        [ox + w, oz + d],
        [ox, oz + d],
      ];
    } else if (preset === "L-left") {
      pts = [
        [ox, oz],
        [ox + 450, oz],
        [ox + 450, oz + 200],
        [ox + 250, oz + 200],
        [ox + 250, oz + 400],
        [ox, oz + 400],
      ];
    } else if (preset === "L-right") {
      pts = [
        [ox, oz],
        [ox + 450, oz],
        [ox + 450, oz + 400],
        [ox + 200, oz + 400],
        [ox + 200, oz + 200],
        [ox, oz + 200],
      ];
    } else if (preset === "U") {
      pts = [
        [ox, oz],
        [ox + 150, oz],
        [ox + 150, oz + 150],
        [ox + 350, oz + 150],
        [ox + 350, oz],
        [ox + 500, oz],
        [ox + 500, oz + 350],
        [ox, oz + 350],
      ];
    } else {
      // alcove ซอกโต๊ะคอม
      pts = [
        [ox, oz + 50],
        [ox + 100, oz + 50],
        [ox + 100, oz],
        [ox + 300, oz],
        [ox + 300, oz + 50],
        [ox + 400, oz + 50],
        [ox + 400, oz + 350],
        [ox, oz + 350],
      ];
    }
    setDraftPointsCm([]);
    setEditingWallIndex(null);
    setSelectedInteriorWallId(null);
    commitNewPoly(pts, []);
  };

  // ล้างกระดานเพื่อเริ่มวาดห้องเองจากหน้าว่างเปล่า
  const clearCanvasForFreshDraw = () => {
    if (!isBlankCanvas && canvasPolyCm.length >= 3) {
      setPolyHistory((h) => [
        ...h.slice(-19),
        { poly: canvasPolyCm, interiorWalls, isBlank: isBlankCanvas },
      ]);
    }
    setIsBlankCanvas(true);
    setInteriorWalls([]);
    setDraftPointsCm([]);
    setSelectedElement(null);
    setSelectedInteriorWallId(null);
    setEditingWallIndex(null);
    setActiveTool("pencil");
    if (penMode === "paint-erase") setPenMode("paint-add");
  };

  // รีเซ็ตกลับค่าเริ่มต้นทั้งหมด
  const resetBlueprint = () => {
    const defPoly = initialCanvasPolyFromRoom({ w: 350, d: 400, h: 260 });
    setCanvasPolyCm(defPoly);
    setInteriorWalls([]);
    setIsBlankCanvas(false);
    setDraftPointsCm([]);
    setHeightCm(260);
    setHeightInput("2.6");
    setDoors([{ id: `d-${Date.now()}`, edgeIndex: 1, wall: "right", pos: 0.7, width: 80 }]);
    setWindows([{ id: `w-${Date.now()}`, edgeIndex: 0, wall: "top", pos: 0.4, width: 120 }]);
    setSun(DEFAULT_SUN_SETTINGS);
    setCompassInput("0.0");
    setSelectedElement(null);
    setSelectedInteriorWallId(null);
    setEditingWallIndex(null);
  };

  // ยกเลิก/ลบเส้นที่กำลังวาดอยู่ทันที (เมื่อกดคลิกขวา หรือกดปุ่ม Esc)
  const cancelActiveDrawing = useCallback(() => {
    let canceled = false;
    if (draftPointsCm.length > 0) {
      setDraftPointsCm([]);
      canceled = true;
    }
    if (boxDrag) {
      setBoxDrag(null);
      canceled = true;
    }
    if (handleDrag) {
      setCanvasPolyCm(handleDrag.basePoly);
      setInteriorWalls(handleDrag.baseInteriorWalls);
      setPolyHistory((h) => (h.length > 0 ? h.slice(0, -1) : h));
      setHandleDrag(null);
      canceled = true;
    }
    if (draggingOpening) {
      setDraggingOpening(null);
      canceled = true;
    }
    return canceled;
  }, [draftPointsCm.length, boxDrag, handleDrag, draggingOpening]);

  // ตรวจว่าเส้นในโหมดคลิกจุดต่อจุด (point-pen) วาดอยู่ภายในตัวห้องที่มีอยู่แล้วหรือไม่
  const isDraftInsideRoom = useMemo(() => {
    if (isBlankCanvas || canvasPolyCm.length < 3 || draftPointsCm.length === 0) return false;
    return draftPointsCm.every(([x, z]) => isPointInOrNearRoom(x, z, canvasPolyCm, 22));
  }, [isBlankCanvas, canvasPolyCm, draftPointsCm]);

  // บันทึกชุดเส้นที่วาดเข้าไปในห้องให้เป็นกำแพงกั้นภายในห้อง
  const commitDraftInteriorWalls = useCallback(
    (pts: Pt2[], closeLoop = false) => {
      if (pts.length < 2) return;
      const newWalls: CanvasInteriorWall[] = [];
      const count = closeLoop && pts.length >= 3 ? pts.length : pts.length - 1;
      const now = Date.now();
      for (let i = 0; i < count; i++) {
        const [x1, z1] = pts[i];
        const [x2, z2] = pts[(i + 1) % pts.length];
        if (Math.hypot(x2 - x1, z2 - z1) >= 35) {
          newWalls.push({
            id: `iw-${now}-${i}`,
            x1,
            z1,
            x2,
            z2,
          });
        }
      }
      if (newWalls.length > 0) {
        setPolyHistory((h) => [
          ...h.slice(-19),
          { poly: canvasPolyCm, interiorWalls, isBlank: isBlankCanvas },
        ]);
        setInteriorWalls((prev) => [...prev, ...newWalls]);
        setSelectedInteriorWallId(newWalls[newWalls.length - 1].id);
        const last = newWalls[newWalls.length - 1];
        setInteriorWallLenInput(
          String(Number((Math.hypot(last.x2 - last.x1, last.z2 - last.z1) / 100).toFixed(2)))
        );
      }
      setDraftPointsCm([]);
    },
    [canvasPolyCm, interiorWalls, isBlankCanvas]
  );

  // ตรวจว่าเส้นที่กำลังวาดในโหมดวาดเส้น (point-pen) สามารถเชื่อมรวมเข้ากับห้องหลักได้หรือไม่ (รองรับทั้งครึ่งสามเหลี่ยม 2-3 จุด และรูปหลายเหลี่ยมเฉียง)
  const draftMergeResult = useMemo(() => {
    if (isBlankCanvas || canvasPolyCm.length < 3 || draftPointsCm.length < 2 || isDraftInsideRoom) {
      return null;
    }
    return mergePointPenExtension(canvasPolyCm, draftPointsCm);
  }, [isBlankCanvas, canvasPolyCm, draftPointsCm, isDraftInsideRoom]);

  // ปิดเส้นผนังในโหมดวาดจุดต่อจุด (Point-to-Point):
  // - ถ้าร่างในห้อง -> เพิ่มกำแพงกั้นในห้อง
  // - ถ้าร่างแตะ/ต่อจากผนังห้องหลัก (เช่น วาดครึ่งสามเหลี่ยมต่อฝั่งขวา/ซ้าย/บน/ล่าง) -> เชื่อมรวมเข้ากับห้องหลักเป็นห้องเดียวกันอัตโนมัติ!
  // - ถ้าร่างแยกบนพื้นที่ว่าง -> สร้างกรอบห้องใหม่
  const finishPointPenPolygon = useCallback(
    (pts: Pt2[], closeLoop = true) => {
      if (!isBlankCanvas && canvasPolyCm.length >= 3) {
        const allInside = pts.every(([x, z]) => isPointInOrNearRoom(x, z, canvasPolyCm, 22));
        if (allInside && pts.length >= 2) {
          commitDraftInteriorWalls(pts, closeLoop && pts.length >= 3);
          return;
        }

        if (pts.length >= 2) {
          const mergedExt = mergePointPenExtension(canvasPolyCm, pts);
          if (mergedExt) {
            commitNewPoly(mergedExt.mergedPoly);
            setDraftPointsCm([]);
            return;
          }
        }
      }
      if (pts.length < 3) return;
      if (hasSelfIntersection(pts)) return;
      const norm = normalizeCanvasPolygon(pts);
      if (!norm) return;
      commitNewPoly(pts);
      setDraftPointsCm([]);
    },
    [isBlankCanvas, canvasPolyCm, commitDraftInteriorWalls, commitNewPoly]
  );

  // ดักคลิกขวา (ขณะกำลังลากเมาส์ซ้ายค้างอยู่) และปุ่มคีย์บอร์ด Esc / Enter / Delete / Shift
  useEffect(() => {
    const onGlobalMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        if (cancelActiveDrawing()) {
          e.preventDefault();
        }
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setBoxDrag((prev) => (prev && !prev.shiftKey ? { ...prev, shiftKey: true } : prev));
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "Escape") {
        if (cancelActiveDrawing()) {
          e.preventDefault();
          return;
        }
        setSelectedElement(null);
        setSelectedInteriorWallId(null);
        setEditingWallIndex(null);
      } else if (!isTyping && e.key === "Enter" && draftPointsCm.length >= 2) {
        e.preventDefault();
        finishPointPenPolygon(draftPointsCm, !isDraftInsideRoom);
      } else if (!isTyping && (e.key === "Delete" || e.key === "Backspace")) {
        if (draftPointsCm.length > 0) {
          e.preventDefault();
          setDraftPointsCm((prev) => prev.slice(0, -1));
        } else if (selectedInteriorWallId) {
          e.preventDefault();
          deleteSelectedInteriorWall();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setBoxDrag((prev) => (prev && prev.shiftKey ? { ...prev, shiftKey: false } : prev));
      }
    };
    window.addEventListener("mousedown", onGlobalMouseDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("mousedown", onGlobalMouseDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    cancelActiveDrawing,
    draftPointsCm,
    isDraftInsideRoom,
    finishPointPenPolygon,
    selectedInteriorWallId,
    deleteSelectedInteriorWall,
  ]);

  // คลิกหรือเริ่มลากบนพื้นกระดาษพิมพ์เขียว (รองรับทั้งเมาส์ สัมผัส Touch และ Pointer บนมือถือ)
  const handleCanvasInteractionStart = useCallback((clientX: number, clientY: number, button = 0, shiftKey = false, altKey = false) => {
    setSunPanelOpen(false);
    setShapeMenuOpen(false);

    if (button === 2) {
      cancelActiveDrawing();
      return;
    }
    if (button !== 0) return;

    const pt = clientToSvgAndCm(clientX, clientY);
    if (!pt) return;

    // 1) โหมดวางหน้าต่าง หรือ ประตู: คลิกใกล้ผนังนอกหรือกำแพงในห้องเพื่อวางทันที (ล็อกระยะกันทะลุกำแพงอัตโนมัติ)
    if (activeTool === "window" || activeTool === "door") {
      if (isBlankCanvas) return;
      const wCm = activeTool === "window" ? 120 : 80;
      const hit = findClosestTargetWall(pt.xCm, pt.zCm, wCm, activeTool === "door");
      if (hit && hit.distCm <= 55) {
        if (activeTool === "window") {
          const nw: BlueprintWindow = {
            id: `w-${Date.now()}`,
            edgeIndex: hit.edgeIndex,
            interiorWallId: hit.interiorWallId,
            wall: hit.wallCardinal,
            pos: hit.pos,
            width: hit.fittedWidthCm,
          };
          setWindows((prev) => [...prev, nw]);
          setSelectedElement({ type: "window", id: nw.id });
          setSelectedInteriorWallId(null);
        } else {
          const nd: BlueprintDoor = {
            id: `d-${Date.now()}`,
            edgeIndex: hit.edgeIndex,
            interiorWallId: hit.interiorWallId,
            wall: hit.wallCardinal,
            pos: hit.pos,
            width: hit.fittedWidthCm,
          };
          setDoors((prev) => [...prev, nd]);
          setSelectedElement({ type: "door", id: nd.id });
          setSelectedInteriorWallId(null);
        }
      } else {
        setSelectedElement(null);
      }
      return;
    }

    // 2) โหมดปากกา -> วาดเส้นทีละจุด (Point-to-Point ละเอียดทุก 0.1 เมตร + เชื่อมครึ่งสามเหลี่ยม/ผนังเฉียงเข้ากับห้องหลักอัตโนมัติ)
    if (activeTool === "pencil" && penMode === "point-pen") {
      const prevPt = draftPointsCm.length > 0 ? draftPointsCm[draftPointsCm.length - 1] : null;
      const snapInfo = snapPointPenCursor(
        pt.xCm,
        pt.zCm,
        canvasPolyCm,
        interiorWalls,
        prevPt,
        isBlankCanvas,
        shiftKey
      );
      const [sx, sz] = snapInfo.pt;

      if (draftPointsCm.length >= 3) {
        const [fx, fz] = draftPointsCm[0];
        if (Math.hypot(sx - fx, sz - fz) <= 35) {
          finishPointPenPolygon(draftPointsCm, true);
          return;
        }
      }

      // กรณีเริ่มคลิกจากผนัง/ในห้องหลัก -> ลากออกไปนอกห้อง -> คลิกกลับมาแตะผนังห้องหลักอีกครั้ง: เชื่อมรวมเข้ากับห้องหลักทันที!
      if (!isBlankCanvas && canvasPolyCm.length >= 3 && draftPointsCm.length >= 2) {
        const [fx, fz] = draftPointsCm[0];
        const startNearWall = minDistToPolyBoundary(fx, fz, canvasPolyCm).distCm <= 28;
        const endNearWall = minDistToPolyBoundary(sx, sz, canvasPolyCm).distCm <= 28;
        const hasExteriorMid = draftPointsCm
          .slice(1)
          .some(([mx, mz]) => !isPointInOrNearRoom(mx, mz, canvasPolyCm, 14));
        if (startNearWall && endNearWall && hasExteriorMid && Math.hypot(sx - fx, sz - fz) >= 35) {
          const nextPts: Pt2[] = [...draftPointsCm, [sx, sz]];
          if (mergePointPenExtension(canvasPolyCm, nextPts)) {
            finishPointPenPolygon(nextPts, true);
            return;
          }
        }
      }

      setDraftPointsCm((prev) => {
        if (prev.length > 0) {
          const [lx, lz] = prev[prev.length - 1];
          if (Math.hypot(sx - lx, sz - lz) < 10) return prev;
        }
        return [...prev, [sx, sz]];
      });
      setSelectedElement(null);
      setSelectedInteriorWallId(null);
      setEditingWallIndex(null);
      return;
    }

    // 3) โหมดปากกา -> ลากวาดห้อง/ต่อเติม (+), ตัดเว้า (-), หรือลากกั้นกำแพงในห้องอัตโนมัติ!
    if (activeTool === "pencil" && (penMode === "paint-add" || penMode === "paint-erase")) {
      const gx = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(pt.xCm / GRID_CELL_CM)));
      const gz = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(pt.zCm / GRID_CELL_CM)));
      if (pt.xCm < -25 || pt.xCm > GRID_COLS * GRID_CELL_CM + 25 || pt.zCm < -25 || pt.zCm > GRID_ROWS * GRID_CELL_CM + 25) {
        return;
      }
      const dragMode: "add" | "erase" = penMode === "paint-erase" || altKey ? "erase" : "add";
      setSelectedElement(null);
      setSelectedInteriorWallId(null);
      setEditingWallIndex(null);
      setBoxDrag({
        mode: dragMode,
        startGx: gx,
        startGz: gz,
        curGx: gx,
        curGz: gz,
        startRawCm: [pt.xCm, pt.zCm],
        curRawCm: [pt.xCm, pt.zCm],
        shiftKey,
      });
    }
  }, [
    activeTool,
    penMode,
    isBlankCanvas,
    findClosestTargetWall,
    draftPointsCm,
    canvasPolyCm,
    interiorWalls,
    finishPointPenPolygon,
    mergePointPenExtension,
    clientToSvgAndCm,
    cancelActiveDrawing,
  ]);

  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 2) {
      e.preventDefault();
      cancelActiveDrawing();
      return;
    }
    handleCanvasInteractionStart(e.clientX, e.clientY, e.button, e.shiftKey, e.altKey);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      handleCanvasInteractionStart(e.clientX, e.clientY, 0, e.shiftKey, e.altKey);
    }
  };

  // Global Pointer/Touch/Mouse Move สำหรับการลากทุกชนิดแบบลื่นไหล ไม่กระตุก ทั้งบนคอมและมือถือ
  useEffect(() => {
    if (!boxDrag && !handleDrag && !draggingOpening && !draggingCompass) return;

    const handleMove = (e: MouseEvent | TouchEvent | PointerEvent) => {
      let clientX = 0;
      let clientY = 0;
      let isShiftKey = false;

      if ("touches" in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
        isShiftKey = (e as MouseEvent).shiftKey;
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      // A. หมุนเข็มทิศแบบละเอียดทีละ 0.1° (0.0° - 359.9°)
      if (draggingCompass && compassDragRef.current) {
        const dialEl = compassDialRef.current;
        if (dialEl) {
          const rect = dialEl.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const curAngleRad = Math.atan2(clientX - cx, -(clientY - cy));
          let stepRad = curAngleRad - compassDragRef.current.prevAngleRad;
          while (stepRad > Math.PI) stepRad -= 2 * Math.PI;
          while (stepRad <= -Math.PI) stepRad += 2 * Math.PI;
          compassDragRef.current.prevAngleRad = curAngleRad;

          const stepDeg = (stepRad * 180) / Math.PI;
          // ลากเมาส์ตามเข็มนาฬิกา (stepDeg > 0) -> หน้าปัดเข็มทิศหมุนตามเข็มนาฬิกาไปตามเมาส์/นิ้ว 1:1
          // เนื่องจากหน้าปัดแสดงผลด้วย rotate(-sun.orientationDeg) ดังนั้นค่า orientationDeg จะลดลงตาม stepDeg
          const newOrientation = (((sunOrientationRef.current - stepDeg) % 360) + 360) % 360;
          sunOrientationRef.current = newOrientation;
          setOrientationDeg01(newOrientation);
        }
        return;
      }

      const pt = clientToSvgAndCm(clientX, clientY);
      if (!pt) return;

      // B. ลากย้ายหน้าต่างหรือประตูไปตามผนังทุกด้านของห้อง (กันทะลุกำแพงมุมห้องและกำแพงกั้นในห้องอัตโนมัติ)
      if (draggingOpening && canvasPolyCm.length >= 3) {
        const curItem =
          draggingOpening.type === "door"
            ? doors.find((d) => d.id === draggingOpening.id)
            : windows.find((w) => w.id === draggingOpening.id);
        const wCm = curItem?.width ?? 80;
        const hit = findClosestTargetWall(
          pt.xCm,
          pt.zCm,
          wCm,
          draggingOpening.type === "door",
          draggingOpening.id
        );
        if (!hit) return;

        if (draggingOpening.type === "door") {
          setDoors((prev) =>
            prev.map((d) =>
              d.id === draggingOpening.id
                ? {
                    ...d,
                    edgeIndex: hit.edgeIndex,
                    interiorWallId: hit.interiorWallId,
                    wall: hit.wallCardinal,
                    pos: hit.pos,
                    width: hit.fittedWidthCm,
                  }
                : d
            )
          );
        } else {
          setWindows((prev) =>
            prev.map((w) =>
              w.id === draggingOpening.id
                ? {
                    ...w,
                    edgeIndex: hit.edgeIndex,
                    interiorWallId: undefined,
                    wall: hit.wallCardinal,
                    pos: hit.pos,
                    width: hit.fittedWidthCm,
                  }
                : w
            )
          );
        }
        return;
      }

      // C. ลากคลุมตารางเพื่อวาดห้อง / ต่อเติม / ตัดเว้า หรือลากกั้นกำแพงในห้อง
      if (boxDrag) {
        const gx = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(pt.xCm / GRID_CELL_CM)));
        const gz = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(pt.zCm / GRID_CELL_CM)));
        setBoxDrag((prev) =>
          prev
            ? {
                ...prev,
                curGx: gx,
                curGz: gz,
                curRawCm: [pt.xCm, pt.zCm],
                shiftKey: isShiftKey,
              }
            : null
        );
        return;
      }

      // D. ลากจุดมุมห้อง (Vertex), ขอบผนัง (Wall Edge), หรือจุดปลายกำแพงในห้อง ละเอียดทีละ 0.1 ม. (10 ซม.)
      if (handleDrag) {
        const dxCm = pt.xCm - handleDrag.startMouseCm[0];
        const dzCm = pt.zCm - handleDrag.startMouseCm[1];

        if (handleDrag.kind === "interior-end") {
          const baseWall = handleDrag.baseInteriorWalls.find((w) => w.id === handleDrag.wallId);
          if (!baseWall) return;
          const otherOtherWalls = handleDrag.baseInteriorWalls.filter(
            (w) => w.id !== handleDrag.wallId
          );
          const rawX = (handleDrag.end === 1 ? baseWall.x1 : baseWall.x2) + dxCm;
          const rawZ = (handleDrag.end === 1 ? baseWall.z1 : baseWall.z2) + dzCm;
          const anchorX = handleDrag.end === 1 ? baseWall.x2 : baseWall.x1;
          const anchorZ = handleDrag.end === 1 ? baseWall.z2 : baseWall.z1;

          let [nx, nz] = snapPointToRoomWalls(
            rawX,
            rawZ,
            canvasPolyCm,
            otherOtherWalls,
            20
          );
          if (!isShiftKey) {
            if (Math.abs(nx - anchorX) < 15) nx = anchorX;
            if (Math.abs(nz - anchorZ) < 15) nz = anchorZ;
          }
          const newLen = Math.hypot(nx - anchorX, nz - anchorZ);
          if (newLen >= 40 && isPointInOrNearRoom(nx, nz, canvasPolyCm, 20)) {
            setInteriorWalls((prev) =>
              prev.map((w) =>
                w.id === handleDrag.wallId
                  ? handleDrag.end === 1
                    ? { ...w, x1: nx, z1: nz }
                    : { ...w, x2: nx, z2: nz }
                  : w
              )
            );
            if (selectedInteriorWallId === handleDrag.wallId) {
              setInteriorWallLenInput(String(Number((newLen / 100).toFixed(2))));
            }
          }
          return;
        }

        if (handleDrag.kind === "edge") {
          const moved = movePolygonEdge(handleDrag.basePoly, handleDrag.index, dxCm, dzCm, 10);
          if (moved) {
            setCanvasPolyCm((prev) => {
              reattachOpeningsToPoly(prev, moved);
              return moved;
            });
            if (editingWallIndex !== null && editingWallIndex < moved.length) {
              const info = getEdgeInfo(moved, editingWallIndex);
              setWallLenInput(String(Number((info.lengthCm / 100).toFixed(2))));
            }
          }
        } else {
          const idx = handleDrag.index;
          const base = handleDrag.basePoly;
          const maxX = GRID_COLS * GRID_CELL_CM;
          const maxZ = GRID_ROWS * GRID_CELL_CM;
          const nx = Math.max(0, Math.min(maxX, Math.round((base[idx][0] + dxCm) / 10) * 10));
          const nz = Math.max(0, Math.min(maxZ, Math.round((base[idx][1] + dzCm) / 10) * 10));

          // ถ้ารูปเป็นสี่เหลี่ยมผืนผ้า 4 มุม ให้ยืดมุมแบบสี่เหลี่ยมเพื่อให้ใช้งานง่ายไม่เบี้ยว
          const normBase = normalizeCanvasPolygon(base);
          if (normBase?.isSimpleRect && base.length === 4) {
            const opp = base[(idx + 2) % 4];
            const minX = Math.min(nx, opp[0]);
            const maxX2 = Math.max(nx, opp[0]);
            const minZ = Math.min(nz, opp[1]);
            const maxZ2 = Math.max(nz, opp[1]);
            if (maxX2 - minX >= 100 && maxZ2 - minZ >= 100) {
              const rectPoly: Pt2[] = [
                [minX, minZ],
                [maxX2, minZ],
                [maxX2, maxZ2],
                [minX, maxZ2],
              ];
              setCanvasPolyCm((prev) => {
                reattachOpeningsToPoly(prev, rectPoly);
                return rectPoly;
              });
              if (editingWallIndex !== null && editingWallIndex < rectPoly.length) {
                const info = getEdgeInfo(rectPoly, editingWallIndex);
                setWallLenInput(String(Number((info.lengthCm / 100).toFixed(2))));
              }
            }
          } else {
            const next = base.map((p, i) => (i === idx ? ([nx, nz] as Pt2) : ([p[0], p[1]] as Pt2)));
            const validLengths = next.every((p, i) => {
              const q = next[(i + 1) % next.length];
              return Math.hypot(q[0] - p[0], q[1] - p[1]) >= 40;
            });
            if (validLengths && !hasSelfIntersection(next) && Math.abs(signedArea(next)) >= 2500) {
              const fixed = signedArea(next) < 0 ? [...next].reverse() : next;
              setCanvasPolyCm((prev) => {
                reattachOpeningsToPoly(prev, fixed);
                return fixed;
              });
              if (editingWallIndex !== null && editingWallIndex < fixed.length) {
                const info = getEdgeInfo(fixed, editingWallIndex);
                setWallLenInput(String(Number((info.lengthCm / 100).toFixed(2))));
              }
            }
          }
        }
      }
    };

    const handleUp = () => {
      if (boxDrag) {
        // กรณีวาดเข้าไปในตัวห้องที่มีอยู่แล้ว -> เพิ่มกำแพงกั้นภายในห้องแทน!
        if (boxDrag.mode === "add" && !isBlankCanvas && canvasPolyCm.length >= 3) {
          const iwRes = resolveInteriorWallDrag(
            boxDrag.startRawCm,
            boxDrag.curRawCm,
            canvasPolyCm,
            interiorWalls,
            boxDrag.shiftKey
          );
          if (iwRes.isInteriorWall) {
            if (iwRes.lengthCm >= 40) {
              const nw: CanvasInteriorWall = {
                id: `iw-${Date.now()}`,
                x1: iwRes.x1,
                z1: iwRes.z1,
                x2: iwRes.x2,
                z2: iwRes.z2,
              };
              setPolyHistory((h) => [
                ...h.slice(-19),
                { poly: canvasPolyCm, interiorWalls, isBlank: isBlankCanvas },
              ]);
              setInteriorWalls((prev) => [...prev, nw]);
              setSelectedInteriorWallId(nw.id);
              setInteriorWallLenInput(String(Number((iwRes.lengthCm / 100).toFixed(2))));
            }
            setBoxDrag(null);
            setHandleDrag(null);
            setDraggingOpening(null);
            setDraggingCompass(false);
            compassDragRef.current = null;
            return;
          }
        }

        const minGx = Math.min(boxDrag.startGx, boxDrag.curGx);
        const maxGx = Math.max(boxDrag.startGx, boxDrag.curGx);
        const minGz = Math.min(boxDrag.startGz, boxDrag.curGz);
        const maxGz = Math.max(boxDrag.startGz, boxDrag.curGz);
        const strokeW = maxGx - minGx + 1;
        const strokeD = maxGz - minGz + 1;

        const rectPoly: Pt2[] = [
          [minGx * GRID_CELL_CM, minGz * GRID_CELL_CM],
          [(maxGx + 1) * GRID_CELL_CM, minGz * GRID_CELL_CM],
          [(maxGx + 1) * GRID_CELL_CM, (maxGz + 1) * GRID_CELL_CM],
          [minGx * GRID_CELL_CM, (maxGz + 1) * GRID_CELL_CM],
        ];

        if (boxDrag.mode === "add") {
          if (!isBlankCanvas && canvasPolyCm.length >= 3) {
            const merged = unionRoomPolygons(canvasPolyCm, rectPoly);
            if (merged && merged.connected) {
              commitNewPoly(merged.poly);
            } else if (strokeW >= 2 && strokeD >= 2) {
              commitNewPoly(rectPoly);
            }
          } else if (strokeW >= 2 && strokeD >= 2) {
            commitNewPoly(rectPoly);
          }
        } else if (!isBlankCanvas && canvasPolyCm.length >= 3) {
          // โหมดตัดเว้ามุมห้อง (-) แบบรักษาแนวผนังเฉียง/สามเหลี่ยมเดิมไว้ครบถ้วน
          const carved = subtractRoomPolygons(canvasPolyCm, rectPoly);
          if (carved && Math.abs(signedArea(carved.poly)) >= 10000) {
            commitNewPoly(carved.poly);
          }
        }
      }

      setBoxDrag(null);
      setHandleDrag(null);
      setDraggingOpening(null);
      setDraggingCompass(false);
      compassDragRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    window.addEventListener("touchcancel", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
      window.removeEventListener("touchcancel", handleUp);
    };
  }, [
    boxDrag,
    handleDrag,
    draggingOpening,
    draggingCompass,
    canvasPolyCm,
    interiorWalls,
    isBlankCanvas,
    doors,
    windows,
    clientToSvgAndCm,
    findClosestTargetWall,
    commitNewPoly,
    reattachOpeningsToPoly,
    setOrientationDeg01,
    editingWallIndex,
    selectedInteriorWallId,
  ]);

  // ลบ/คัดลอก/เปลี่ยนความกว้างหน้าต่างหรือประตูที่เลือก
  const deleteSelected = useCallback(() => {
    if (!selectedElement) return;
    if (selectedElement.type === "door") {
      setDoors((prev) => prev.filter((d) => d.id !== selectedElement.id));
    } else {
      setWindows((prev) => prev.filter((w) => w.id !== selectedElement.id));
    }
    setSelectedElement(null);
  }, [selectedElement]);

  const duplicateSelected = useCallback(() => {
    if (!selectedElement || canvasPolyCm.length < 3) return;
    const n = canvasPolyCm.length;
    if (selectedElement.type === "door") {
      const cur = doors.find((d) => d.id === selectedElement.id);
      if (!cur) return;
      const nextEdge = ((cur.edgeIndex ?? 0) + 1) % n;
      const info = getEdgeInfo(canvasPolyCm, nextEdge);
      const dup: BlueprintDoor = {
        ...cur,
        id: `d-${Date.now()}`,
        edgeIndex: nextEdge,
        interiorWallId: undefined,
        wall: info.wallCardinal,
        pos: 0.5,
      };
      setDoors((prev) => [...prev, dup]);
      setSelectedElement({ type: "door", id: dup.id });
    } else {
      const cur = windows.find((w) => w.id === selectedElement.id);
      if (!cur) return;
      const nextEdge = ((cur.edgeIndex ?? 0) + 1) % n;
      const info = getEdgeInfo(canvasPolyCm, nextEdge);
      const dup: BlueprintWindow = {
        ...cur,
        id: `w-${Date.now()}`,
        edgeIndex: nextEdge,
        interiorWallId: undefined,
        wall: info.wallCardinal,
        pos: 0.5,
      };
      setWindows((prev) => [...prev, dup]);
      setSelectedElement({ type: "window", id: dup.id });
    }
  }, [selectedElement, doors, windows, canvasPolyCm]);

  const moveSelectedToNextWall = useCallback(() => {
    if (!selectedElement || canvasPolyCm.length < 3) return;
    const n = canvasPolyCm.length;
    if (selectedElement.type === "door") {
      setDoors((prev) =>
        prev.map((d) => {
          if (d.id !== selectedElement.id) return d;
          const nextEdge = ((d.edgeIndex ?? 0) + 1) % n;
          const info = getEdgeInfo(canvasPolyCm, nextEdge);
          return {
            ...d,
            edgeIndex: nextEdge,
            interiorWallId: undefined,
            wall: info.wallCardinal,
            pos: 0.5,
          };
        })
      );
    } else {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== selectedElement.id) return w;
          const nextEdge = ((w.edgeIndex ?? 0) + 1) % n;
          const info = getEdgeInfo(canvasPolyCm, nextEdge);
          return {
            ...w,
            edgeIndex: nextEdge,
            interiorWallId: undefined,
            wall: info.wallCardinal,
            pos: 0.5,
          };
        })
      );
    }
  }, [selectedElement, canvasPolyCm]);

  const changeSelectedWidth = useCallback(
    (newWidthCm: number) => {
      if (!selectedElement || canvasPolyCm.length < 3) return;
      if (selectedElement.type === "door") {
        setDoors((prev) =>
          prev.map((d) => {
            if (d.id !== selectedElement.id) return d;
            if (d.interiorWallId) {
              const iw = interiorWalls.find((item) => item.id === d.interiorWallId);
              if (!iw) return { ...d, width: newWidthCm };
              const dx = iw.x2 - iw.x1;
              const dz = iw.z2 - iw.z1;
              const lenCm = Math.hypot(dx, dz);
              const sibs = prev
                .filter((o) => o.id !== d.id && o.interiorWallId === iw.id)
                .map((o) => {
                  const c = o.pos * lenCm;
                  return { startCm: c - o.width / 2 - 12, endCm: c + o.width / 2 + 12 };
                });
              const clamped = clampOpeningOnSegment({
                rawPos: d.pos,
                desiredWidthCm: newWidthCm,
                minWidthCm: 55,
                segX1: iw.x1,
                segZ1: iw.z1,
                segEx: dx / lenCm,
                segEz: dz / lenCm,
                segLenCm: lenCm,
                cornerClearanceCm: 16,
                interiorWalls,
                excludeInteriorWallId: iw.id,
                siblingRangesCm: sibs,
              });
              return clamped
                ? { ...d, pos: clamped.pos, width: clamped.widthCm }
                : { ...d, width: newWidthCm };
            }
            const edgeIdx =
              d.edgeIndex !== undefined && d.edgeIndex < canvasPolyCm.length ? d.edgeIndex : 0;
            const info = getEdgeInfo(canvasPolyCm, edgeIdx);
            const sibs: OpeningObstacleRange[] = [
              ...windows
                .filter((w) => !w.interiorWallId && (w.edgeIndex ?? 0) === edgeIdx)
                .map((w) => {
                  const c = w.pos * info.lengthCm;
                  return { startCm: c - w.width / 2 - 14, endCm: c + w.width / 2 + 14 };
                }),
              ...prev
                .filter((o) => o.id !== d.id && !o.interiorWallId && (o.edgeIndex ?? 0) === edgeIdx)
                .map((o) => {
                  const c = o.pos * info.lengthCm;
                  return { startCm: c - o.width / 2 - 14, endCm: c + o.width / 2 + 14 };
                }),
            ];
            const clamped = clampOpeningOnSegment({
              rawPos: d.pos,
              desiredWidthCm: newWidthCm,
              minWidthCm: 55,
              segX1: info.x1,
              segZ1: info.z1,
              segEx: info.ex,
              segEz: info.ez,
              segLenCm: info.lengthCm,
              cornerClearanceCm: 16,
              interiorWalls,
              siblingRangesCm: sibs,
            });
            return clamped
              ? { ...d, pos: clamped.pos, width: clamped.widthCm }
              : { ...d, width: newWidthCm };
          })
        );
      } else {
        setWindows((prev) =>
          prev.map((w) => {
            if (w.id !== selectedElement.id) return w;
            const edgeIdx =
              w.edgeIndex !== undefined && w.edgeIndex < canvasPolyCm.length ? w.edgeIndex : 0;
            const info = getEdgeInfo(canvasPolyCm, edgeIdx);
            const sibs: OpeningObstacleRange[] = [
              ...prev
                .filter((o) => o.id !== w.id && !o.interiorWallId && (o.edgeIndex ?? 0) === edgeIdx)
                .map((o) => {
                  const c = o.pos * info.lengthCm;
                  return { startCm: c - o.width / 2 - 14, endCm: c + o.width / 2 + 14 };
                }),
              ...doors
                .filter((d) => !d.interiorWallId && (d.edgeIndex ?? 0) === edgeIdx)
                .map((d) => {
                  const c = d.pos * info.lengthCm;
                  return { startCm: c - d.width / 2 - 14, endCm: c + d.width / 2 + 14 };
                }),
            ];
            const clamped = clampOpeningOnSegment({
              rawPos: w.pos,
              desiredWidthCm: newWidthCm,
              minWidthCm: 55,
              segX1: info.x1,
              segZ1: info.z1,
              segEx: info.ex,
              segEz: info.ez,
              segLenCm: info.lengthCm,
              cornerClearanceCm: 24,
              interiorWalls,
              siblingRangesCm: sibs,
            });
            return clamped
              ? { ...w, pos: clamped.pos, width: clamped.widthCm }
              : { ...w, width: newWidthCm };
          })
        );
      }
    },
    [selectedElement, canvasPolyCm, interiorWalls, windows, doors]
  );

  const selectedDoor = useMemo(
    () => (selectedElement?.type === "door" ? doors.find((d) => d.id === selectedElement.id) : null),
    [selectedElement, doors]
  );
  const selectedWin = useMemo(
    () => (selectedElement?.type === "window" ? windows.find((w) => w.id === selectedElement.id) : null),
    [selectedElement, windows]
  );
  const selectedInteriorWall = useMemo(
    () =>
      selectedInteriorWallId
        ? interiorWalls.find((w) => w.id === selectedInteriorWallId) || null
        : null,
    [selectedInteriorWallId, interiorWalls]
  );

  // ตัวอย่างเส้นกำแพงกั้นในห้องขณะคลิกลากเข้าไปในตัวห้อง (Context-Aware Interior Wall Preview)
  const interiorWallDragPreview = useMemo(() => {
    if (!boxDrag || boxDrag.mode !== "add" || isBlankCanvas || canvasPolyCm.length < 3) {
      return null;
    }
    const res = resolveInteriorWallDrag(
      boxDrag.startRawCm,
      boxDrag.curRawCm,
      canvasPolyCm,
      interiorWalls,
      boxDrag.shiftKey
    );
    return res.isInteriorWall ? res : null;
  }, [boxDrag, isBlankCanvas, canvasPolyCm, interiorWalls]);

  // ข้อมูลพิกัดเมาส์และตัวอย่างเงาสีเขียวเชื่อมครึ่งสามเหลี่ยม/ผนังเฉียงสดๆ ในโหมด "วาดเส้น" (Point-to-Point)
  const pointPenCursorSnap = useMemo(() => {
    if (activeTool !== "pencil" || penMode !== "point-pen" || !cursorCm) return null;
    const prevPt = draftPointsCm.length > 0 ? draftPointsCm[draftPointsCm.length - 1] : null;
    return snapPointPenCursor(
      cursorCm[0],
      cursorCm[1],
      canvasPolyCm,
      interiorWalls,
      prevPt,
      isBlankCanvas,
      false
    );
  }, [activeTool, penMode, cursorCm, draftPointsCm, canvasPolyCm, interiorWalls, isBlankCanvas]);

  const pointPenMergePreview = useMemo(() => {
    if (
      activeTool !== "pencil" ||
      penMode !== "point-pen" ||
      isBlankCanvas ||
      canvasPolyCm.length < 3 ||
      draftPointsCm.length === 0
    ) {
      return null;
    }
    if (pointPenCursorSnap) {
      const [sx, sz] = pointPenCursorSnap.pt;
      const last = draftPointsCm[draftPointsCm.length - 1];
      const nextPts: Pt2[] =
        Math.hypot(sx - last[0], sz - last[1]) >= 15
          ? draftPointsCm.length >= 3 &&
            Math.hypot(sx - draftPointsCm[0][0], sz - draftPointsCm[0][1]) <= 35
            ? draftPointsCm
            : [...draftPointsCm, [sx, sz]]
          : draftPointsCm;

      if (nextPts.length >= 3) {
        const allIn = nextPts.every(([x, z]) => isPointInOrNearRoom(x, z, canvasPolyCm, 20));
        if (!allIn) {
          const liveMerge = mergePointPenExtension(canvasPolyCm, nextPts);
          if (liveMerge) {
            return {
              ...liveMerge,
              readyOnClick:
                pointPenCursorSnap.onMainWall ||
                (draftPointsCm.length >= 3 &&
                  Math.hypot(sx - draftPointsCm[0][0], sz - draftPointsCm[0][1]) <= 35),
            };
          }
        }
      }
    }
    if (draftMergeResult) {
      return { ...draftMergeResult, readyOnClick: false };
    }
    return null;
  }, [
    activeTool,
    penMode,
    isBlankCanvas,
    canvasPolyCm,
    draftPointsCm,
    pointPenCursorSnap,
    draftMergeResult,
  ]);

  // พิกัด SVG ของกล่องลากวาด (Box Drag Preview — ซ่อนอัตโนมัติเมื่อกำลังวาดกำแพงในห้อง)
  const boxDragPreview = useMemo(() => {
    if (!boxDrag || interiorWallDragPreview) return null;
    const minGx = Math.min(boxDrag.startGx, boxDrag.curGx);
    const maxGx = Math.max(boxDrag.startGx, boxDrag.curGx);
    const minGz = Math.min(boxDrag.startGz, boxDrag.curGz);
    const maxGz = Math.max(boxDrag.startGz, boxDrag.curGz);
    const [x, y] = cmToSvg(minGx * GRID_CELL_CM, minGz * GRID_CELL_CM);
    const wPx = (maxGx - minGx + 1) * GRID_CELL_PX;
    const hPx = (maxGz - minGz + 1) * GRID_CELL_PX;
    const wM = (((maxGx - minGx + 1) * GRID_CELL_CM) / 100).toFixed(2);
    const dM = (((maxGz - minGz + 1) * GRID_CELL_CM) / 100).toFixed(2);
    const aM2 = (
      (((maxGx - minGx + 1) * GRID_CELL_CM) / 100) *
      (((maxGz - minGz + 1) * GRID_CELL_CM) / 100)
    ).toFixed(1);
    return { x, y, wPx, hPx, wM, dM, aM2, mode: boxDrag.mode };
  }, [boxDrag, interiorWallDragPreview]);

  const formattedTime = `${Math.floor(sun.timeHour)
    .toString()
    .padStart(2, "0")}:${Math.round((sun.timeHour % 1) * 60)
    .toString()
    .padStart(2, "0")}`;

  const editingWallInfo =
    editingWallIndex !== null && !isBlankCanvas && editingWallIndex < canvasPolyCm.length
      ? getEdgeInfo(canvasPolyCm, editingWallIndex)
      : null;

  return (
    <div
      className={`relative flex flex-col overflow-hidden bg-gradient-to-b from-[#134694] via-[#0f3878] to-[#0a2552] select-none w-full text-white ${
        isFullscreen
          ? "h-full flex-1 rounded-none border-0"
          : "h-[calc(100dvh-7.75rem)] min-h-[560px] max-h-[680px] rounded-2xl border border-ink-200 shadow-card"
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        cancelActiveDrawing();
      }}
    >
      {/* แถบควบคุมหลักด้านบนแบบกะทัดรัด (เรียงบรรทัดเดียวบนจอคอม ไม่ตกบรรทัด) */}
      <div className="relative z-30 flex w-full flex-wrap lg:flex-nowrap items-center justify-between gap-1.5 border-b border-ink-200 bg-surface/95 px-3 py-2 text-ink-950 shadow-xs backdrop-blur-md">
        {/* ฝั่งซ้าย: สวิตช์โหมด 2D/3D + ขนาดห้องและเพดานในกล่องเดียว */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg border border-ink-200 bg-paper p-0.5 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-md bg-info px-2 py-0.5 font-bold text-white shadow-xs">
              <PenTool className="h-3 w-3" />
              <span>1. แปลน 2D</span>
            </span>
            <button
              type="button"
              disabled={isBlankCanvas}
              onClick={onProceedTo3D}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-ink-700 hover:bg-surface hover:text-info transition disabled:opacity-40"
            >
              <span>2. ห้อง 3D</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-paper px-2 py-0.5 text-[11px] text-ink-900">
            <span className="font-mono font-semibold text-ink-950">
              {isBlankCanvas ? "รอวาดห้อง" : `${widthM}×${depthM} ม.`}
            </span>
            {!isBlankCanvas && (
              <span className="font-mono font-bold text-info">({areaM2} ตร.ม.)</span>
            )}
            <span className="text-ink-200">|</span>
            <label className="flex items-center gap-1" title="พิมพ์ความสูงเพดานละเอียดระดับ 0.1 เมตร (1.8 - 6.0 ม.)">
              <span className="text-ink-600 hidden sm:inline">สูง</span>
              <input
                type="number"
                min="1.8"
                max="6.0"
                step="0.1"
                value={heightInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setHeightInput(val);
                  const parsed = parseFloat(val);
                  if (Number.isFinite(parsed) && parsed >= 1.8 && parsed <= 6.0) {
                    setHeightCm(Math.round(parsed * 100));
                  }
                }}
                onBlur={() => {
                  const parsed = parseFloat(heightInput);
                  if (Number.isFinite(parsed)) {
                    const clamped = Math.max(1.8, Math.min(6.0, Math.round(parsed * 100) / 100));
                    setHeightCm(Math.round(clamped * 100));
                    setHeightInput(String(Number(clamped.toFixed(2))));
                  } else {
                    setHeightInput(String(Number((heightCm / 100).toFixed(2))));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-11 rounded border border-ink-200 bg-surface px-1 py-0.5 text-center font-mono text-xs font-bold text-info focus:border-info focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-ink-600">ม.</span>
            </label>
          </div>
        </div>

        {/* ตรงกลาง: แถบเครื่องมือย่อยตามสิ่งที่กำลังทำอยู่ */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {selectedElement ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-info/30 bg-info-bg/70 px-2.5 py-1 text-ink-950">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-info pr-1.5 border-r border-info/20">
                {selectedElement.type === "door" ? (
                  <>
                    <DoorClosed className="h-3.5 w-3.5" /> ประตู
                  </>
                ) : (
                  <>
                    <WindowPaneIcon className="h-3.5 w-3.5" /> หน้าต่าง
                  </>
                )}
              </span>

              <div className="flex items-center gap-1 text-[11px]">
                {(selectedElement.type === "door" ? [70, 80, 90, 100] : [80, 120, 160, 200]).map(
                  (w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => changeSelectedWidth(w)}
                      className={`rounded-md px-1.5 py-0.5 transition ${
                        (selectedElement.type === "door" ? selectedDoor?.width : selectedWin?.width) === w
                          ? "bg-info text-white font-bold shadow-xs"
                          : "bg-surface text-ink-700 hover:bg-ink-100"
                      }`}
                    >
                      {w}cm
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={moveSelectedToNextWall}
                className="rounded-md bg-surface border border-ink-200 px-2 py-0.5 text-[11px] font-semibold text-ink-800 hover:bg-ink-100"
              >
                สลับผนัง
              </button>

              <button
                type="button"
                onClick={duplicateSelected}
                title="คัดลอกเพิ่มอีกบาน"
                className="rounded-md bg-surface border border-ink-200 p-1 hover:bg-ink-100 text-ink-800"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                title="ลบออก"
                className="rounded-md bg-bad p-1 hover:opacity-90 text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedElement(null)}
                title="ยกเลิกการเลือก"
                className="rounded-md bg-surface border border-ink-200 p-1 hover:bg-ink-100 text-ink-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : editingWallInfo && editingWallIndex !== null ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-info/35 bg-info-bg/80 px-2.5 py-1 text-ink-950 shadow-xs">
              <span className="inline-flex items-center gap-1 border-r border-info/20 pr-2 text-[11px] font-bold text-info">
                <Ruler className="h-3.5 w-3.5" />
                ผนัง #{editingWallIndex + 1} (
                {degToCardinal((editingWallInfo.outwardBaseDeg + sun.orientationDeg) % 360).cardinal}
                )
              </span>

              <button
                type="button"
                onClick={() => nudgeWallLengthMeters(-0.1)}
                title="ลดความยาวผนัง 0.1 เมตร"
                className="rounded-md bg-surface border border-ink-200 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-800 hover:bg-ink-100"
              >
                -0.1
              </button>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0.4"
                  max="13"
                  step="0.1"
                  value={wallLenInput}
                  onChange={(e) => setWallLenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseFloat(wallLenInput);
                      if (Number.isFinite(val)) applyWallLengthMeters(editingWallIndex, val);
                    } else if (e.key === "Escape") {
                      setEditingWallIndex(null);
                    }
                  }}
                  className="w-14 rounded-md border border-info/50 bg-surface px-1.5 py-0.5 text-center font-mono text-xs font-bold text-info focus:border-info focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-[11px] text-ink-600">ม.</span>
              </div>

              <button
                type="button"
                onClick={() => nudgeWallLengthMeters(0.1)}
                title="เพิ่มความยาวผนัง 0.1 เมตร"
                className="rounded-md bg-surface border border-ink-200 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-800 hover:bg-ink-100"
              >
                +0.1
              </button>

              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(wallLenInput);
                  if (Number.isFinite(val)) applyWallLengthMeters(editingWallIndex, val);
                }}
                className="inline-flex items-center gap-0.5 rounded-md bg-info px-2 py-0.5 text-[11px] font-bold text-white hover:opacity-95"
              >
                <Check className="h-3 w-3" />
                ตกลง
              </button>

              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(wallLenInput);
                  const baseLen = canvasPolyCm.length;
                  if (Number.isFinite(val)) {
                    applyWallLengthMeters(editingWallIndex, val);
                  }
                  if (baseLen >= 3) {
                    openWallEditor((editingWallIndex + 1) % baseLen);
                  }
                }}
                title="ไปแก้ไขผนังด้านถัดไป"
                className="rounded-md bg-surface border border-ink-200 px-2 py-0.5 text-[11px] font-semibold text-ink-800 hover:bg-ink-100"
              >
                ผนังถัดไป ↻
              </button>

              <button
                type="button"
                onClick={() => setEditingWallIndex(null)}
                title="ปิดช่องใส่ตัวเลขผนัง"
                className="rounded-md bg-surface border border-ink-200 p-1 text-ink-600 hover:bg-ink-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : selectedInteriorWall ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-info/35 bg-info-bg/80 px-2.5 py-1 text-ink-950 shadow-xs">
              <span className="inline-flex items-center gap-1 border-r border-info/20 pr-2 text-[11px] font-bold text-info">
                <Ruler className="h-3.5 w-3.5" />
                กำแพงในห้อง
              </span>

              <button
                type="button"
                onClick={() => nudgeInteriorWallLength(-0.1)}
                title="ลดความยาวกำแพง 0.1 เมตร"
                className="rounded-md bg-surface border border-ink-200 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-800 hover:bg-ink-100"
              >
                -0.1
              </button>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0.4"
                  max="13"
                  step="0.1"
                  value={interiorWallLenInput}
                  onChange={(e) => setInteriorWallLenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseFloat(interiorWallLenInput);
                      if (Number.isFinite(val)) {
                        applyInteriorWallLengthMeters(selectedInteriorWall.id, val);
                      }
                    } else if (e.key === "Escape") {
                      setSelectedInteriorWallId(null);
                    }
                  }}
                  className="w-14 rounded-md border border-info/50 bg-surface px-1.5 py-0.5 text-center font-mono text-xs font-bold text-info focus:border-info focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-[11px] text-ink-600">ม.</span>
              </div>

              <button
                type="button"
                onClick={() => nudgeInteriorWallLength(0.1)}
                title="เพิ่มความยาวกำแพง 0.1 เมตร"
                className="rounded-md bg-surface border border-ink-200 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-800 hover:bg-ink-100"
              >
                +0.1
              </button>

              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(interiorWallLenInput);
                  if (Number.isFinite(val)) {
                    applyInteriorWallLengthMeters(selectedInteriorWall.id, val);
                  }
                }}
                className="inline-flex items-center gap-0.5 rounded-md bg-info px-2 py-0.5 text-[11px] font-bold text-white hover:opacity-95"
              >
                <Check className="h-3 w-3" />
                ตกลง
              </button>

              <button
                type="button"
                onClick={deleteSelectedInteriorWall}
                title="ลบกำแพงในห้องนี้"
                className="rounded-md bg-bad p-1 text-white hover:opacity-90"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedInteriorWallId(null)}
                title="ยกเลิกการเลือก"
                className="rounded-md bg-surface border border-ink-200 p-1 text-ink-600 hover:bg-ink-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : activeTool === "pencil" ? (
            <>
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-ink-200 bg-paper p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setPenMode("paint-add");
                    setDraftPointsCm([]);
                  }}
                  title="คลิกลากเพื่อต่อเติมบล็อกห้องสี่เหลี่ยม หรือลากในห้องเพื่อเพิ่มกำแพงกั้น"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                    penMode === "paint-add"
                      ? "bg-info text-white shadow-xs"
                      : "text-ink-700 hover:bg-surface hover:text-ink-950"
                  }`}
                >
                  <Plus className="h-3 w-3" />
                  วาดเพิ่ม
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPenMode("paint-erase");
                    setDraftPointsCm([]);
                  }}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                    penMode === "paint-erase"
                      ? "bg-bad text-white shadow-xs"
                      : "text-ink-700 hover:bg-surface hover:text-ink-950"
                  }`}
                >
                  <Minus className="h-3 w-3" />
                  ตัดเว้า
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPenMode("point-pen");
                    setDraftPointsCm([]);
                  }}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                    penMode === "point-pen"
                      ? "bg-info text-white shadow-xs"
                      : "text-ink-700 hover:bg-surface hover:text-ink-950"
                  }`}
                >
                  <Waypoints className="h-3 w-3" />
                  วาดเส้น
                </button>
              </div>

              {/* เมนูทรงห้องสำเร็จรูป */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShapeMenuOpen((v) => !v);
                    setSunPanelOpen(false);
                  }}
                  className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition ${
                    shapeMenuOpen
                      ? "border-info bg-info-bg text-info shadow-xs"
                      : "border-ink-200 bg-paper text-ink-800 hover:bg-ink-100"
                  }`}
                >
                  <LayoutGrid className="h-3 w-3 text-info" />
                  <span>ทรงห้อง</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${shapeMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {shapeMenuOpen && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 w-52 rounded-2xl border border-ink-200 bg-surface p-1.5 text-xs text-ink-900 shadow-pop">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                      เลือกทรงห้องเริ่มต้น
                    </div>
                    {[
                      { id: "rect", label: "สี่เหลี่ยมมาตรฐาน" },
                      { id: "L-left", label: "ห้องตัว L (ซ้าย)" },
                      { id: "L-right", label: "ห้องตัว L (ขวา)" },
                      { id: "U", label: "ห้องตัว U" },
                      { id: "alcove", label: "ห้องมีซอกโต๊ะคอม" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          applyQuickShape(p.id as "rect" | "L-left" | "L-right" | "U" | "alcove");
                          setShapeMenuOpen(false);
                        }}
                        className="flex w-full items-center rounded-xl px-2.5 py-1.5 text-left font-medium text-ink-800 hover:bg-info-bg hover:text-info transition"
                      >
                        {p.label}
                      </button>
                    ))}
                    <div className="my-1 border-t border-ink-100" />
                    <button
                      type="button"
                      onClick={() => {
                        clearCanvasForFreshDraw();
                        setShapeMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left font-semibold text-bad hover:bg-bad-bg transition"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                      ล้างกระดานวาดใหม่
                    </button>
                  </div>
                )}
              </div>

              {!isBlankCanvas && canvasPolyCm.length >= 3 && (
                <button
                  type="button"
                  onClick={() => openWallEditor(0)}
                  title="คลิกเพื่อพิมพ์ตัวเลขความยาวผนังแต่ละด้านแบบละเอียด 0.1 เมตร (หรือคลิกที่ป้ายตัวเลขบนผนังโดยตรง)"
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-ink-200 bg-paper px-2 text-[11px] font-semibold text-ink-800 hover:bg-ink-100 transition"
                >
                  <Ruler className="h-3 w-3 text-info" />
                  <span>แก้เลขผนัง</span>
                </button>
              )}

              {polyHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndoRoomShape}
                  title="ย้อนกลับรูปทรงห้อง"
                  className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-paper px-2.5 py-1.5 text-[11px] font-semibold text-ink-800 hover:bg-ink-100"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">ย้อนกลับ</span>
                </button>
              )}

              {penMode === "point-pen" && isDraftInsideRoom && draftPointsCm.length >= 2 ? (
                <button
                  type="button"
                  onClick={() => finishPointPenPolygon(draftPointsCm, false)}
                  className="inline-flex items-center gap-1 rounded-xl bg-info px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xs hover:opacity-95"
                >
                  <Check className="h-3.5 w-3.5" />
                  สร้างกำแพงในห้อง ({draftPointsCm.length - 1})
                </button>
              ) : penMode === "point-pen" && draftMergeResult ? (
                <button
                  type="button"
                  onClick={() => finishPointPenPolygon(draftPointsCm, true)}
                  className="inline-flex items-center gap-1 rounded-xl bg-info px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xs hover:opacity-95"
                >
                  <Check className="h-3.5 w-3.5" />
                  เชื่อมรวมกับห้องหลัก ({draftPointsCm.length})
                </button>
              ) : (
                penMode === "point-pen" &&
                draftPointsCm.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => finishPointPenPolygon(draftPointsCm, true)}
                    className="inline-flex items-center gap-1 rounded-xl bg-info px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xs hover:opacity-95"
                  >
                    <Check className="h-3.5 w-3.5" />
                    เชื่อมปิดห้อง ({draftPointsCm.length})
                  </button>
                )
              )}

              {penMode === "point-pen" && draftPointsCm.length > 0 && (
                <button
                  type="button"
                  onClick={() => cancelActiveDrawing()}
                  title="ยกเลิกและลบเส้นที่กำลังวาด (คลิกขวา หรือปุ่ม Esc)"
                  className="inline-flex items-center gap-1 rounded-xl bg-bad px-2.5 py-1.5 text-[11px] font-bold text-white hover:opacity-90"
                >
                  <X className="h-3.5 w-3.5" />
                  ยกเลิกเส้น (คลิกขวา)
                </button>
              )}
            </>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl border border-info/30 bg-info-bg/70 px-3 py-1 text-[11px] font-medium text-ink-800">
              {activeTool === "window" ? (
                <>
                  <WindowPaneIcon className="h-3.5 w-3.5 text-bad shrink-0" />
                  <span>คลิกบนเส้นผนังเพื่อวางหน้าต่าง หรือลากบานสีแดงเพื่อย้าย</span>
                </>
              ) : (
                <>
                  <DoorClosed className="h-3.5 w-3.5 text-info shrink-0" />
                  <span>คลิกบนเส้นผนังเพื่อวางประตู หรือลากบานสีฟ้าเพื่อย้าย</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ฝั่งขวา: ปุ่มวัดขนาดห้องจริง + ปุ่มทิศและแสงแดด (Popover) + เปิดเต็มจอ + เข้าห้อง 3D */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {onOpenMeasure && (
            <button
              type="button"
              onClick={onOpenMeasure}
              title="วัดขนาดห้องจริงด้วยกล้องมือถือ / นับกระเบื้อง / เทียบ A4 / วาดแปลน"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-info/35 bg-info-bg px-2 font-bold text-info shadow-xs hover:bg-info hover:text-white transition"
            >
              <Ruler className="h-3 w-3" />
              <span>วัดห้อง</span>
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSunPanelOpen((v) => !v);
                setShapeMenuOpen(false);
              }}
              title="ตั้งค่าทิศห้อง เวลาแสงแดด และอุณหภูมิ"
              className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 font-semibold transition ${
                sunPanelOpen
                  ? "border-info bg-info-bg text-info shadow-xs"
                  : "border-ink-200 bg-paper text-ink-800 hover:bg-ink-100"
              }`}
            >
              <Compass className="h-3 w-3 text-info" />
              <span className="font-mono">
                {degToCardinal(sun.orientationDeg).cardinal} {Number(sun.orientationDeg.toFixed(0))}°
              </span>
              <Sun className="h-3 w-3 text-amber-500" />
              <span className="font-mono">{formattedTime}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${sunPanelOpen ? "rotate-180" : ""}`} />
            </button>

            {/* กล่องตั้งค่าทิศ แสงแดด และอุณหภูมิแบบลอย (สไตล์เดียวกับ 3D Studio) */}
            {sunPanelOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-[310px] sm:w-[356px] space-y-3 rounded-2xl border border-ink-200 bg-surface p-4 text-xs text-ink-900 shadow-pop">
                <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                  <span className="font-bold text-sm text-ink-950">ทิศห้อง แสงแดด & อุณหภูมิ</span>
                  <button
                    type="button"
                    onClick={() => setSunPanelOpen(false)}
                    className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* 1. ทิศห้อง (ละเอียดระดับ 0.1°) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-ink-600">ผนังด้านบนหันทิศ</span>
                    <span className="font-mono font-bold text-info">
                      {degToCardinal(sun.orientationDeg).label} ({sun.orientationDeg.toFixed(1)}°)
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
                        onClick={() => setOrientationDeg01(deg)}
                        className={`rounded-lg py-1 text-[11px] font-semibold transition ${
                          Math.abs(((sun.orientationDeg - deg + 540) % 360) - 180) < 22
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
                    min="0"
                    max="359.9"
                    step="0.1"
                    value={sun.orientationDeg}
                    onChange={(e) => setOrientationDeg01(Number(e.target.value))}
                    className="w-full accent-info cursor-pointer"
                  />
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] text-ink-500">พิมพ์องศาละเอียด (0.1°)</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setOrientationDeg01(sun.orientationDeg - 0.1)}
                        className="rounded-md bg-ink-100 px-2 py-0.5 font-mono text-[11px] font-bold text-ink-800 hover:bg-ink-200"
                      >
                        -0.1°
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="359.9"
                        step="0.1"
                        value={compassInput}
                        onChange={(e) => handleCompassInputChange(e.target.value)}
                        onBlur={commitCompassInput}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            commitCompassInput();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-16 rounded-md border border-ink-200 bg-surface px-1.5 py-0.5 text-center font-mono text-xs font-bold text-info focus:border-info focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setOrientationDeg01(sun.orientationDeg + 0.1)}
                        className="rounded-md bg-ink-100 px-2 py-0.5 font-mono text-[11px] font-bold text-ink-800 hover:bg-ink-200"
                      >
                        +0.1°
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. เวลาแสงเข้า */}
                <div className="space-y-1.5 border-t border-ink-100 pt-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-ink-600">ช่วงเวลาแสงแดด</span>
                    <span className="font-mono font-bold text-amber-600">{formattedTime} น.</span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="24"
                    step="0.25"
                    value={sun.timeHour}
                    onChange={(e) => setSun((prev) => ({ ...prev, timeHour: Number(e.target.value) }))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { label: "07:00", hour: 7.0, k: 3400 },
                      { label: "10:00", hour: 10.0, k: 5000 },
                      { label: "12:00", hour: 12.0, k: 5800 },
                      { label: "15:30", hour: 15.5, k: 4500 },
                      { label: "21:30", hour: 21.5, k: 7000 },
                    ].map(({ label, hour, k }) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => setSun((prev) => ({ ...prev, timeHour: hour, colorTempK: k }))}
                        className={`rounded-lg py-1 font-mono text-[11px] font-semibold transition ${
                          Math.abs(sun.timeHour - hour) < 0.4
                            ? "bg-info text-white font-bold"
                            : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. โทนแสง & อุณหภูมิ */}
                <div className="space-y-1.5 border-t border-ink-100 pt-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-ink-600">โทนสีแสง (Kelvin)</span>
                    <span className="font-mono font-bold text-ink-900">{sun.colorTempK}K</span>
                  </div>
                  <input
                    type="range"
                    min="2500"
                    max="7500"
                    step="100"
                    value={sun.colorTempK}
                    onChange={(e) =>
                      setSun((prev) => ({ ...prev, colorTempK: Number(e.target.value) }))
                    }
                    className="w-full accent-info cursor-pointer"
                  />

                  <div className="rounded-xl bg-paper border border-ink-100 p-2.5 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-ink-600">
                        <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                        อุณหภูมิห้องโดยประมาณ
                      </span>
                      <span className="font-mono font-bold text-ink-950">
                        ~{sunlightAdvice.roomTempC}°C (นอก {sunlightAdvice.outdoorTempC}°C)
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-600 leading-snug">
                      {sunlightAdvice.statusText}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullscreen ? "ออกจากโหมดเต็มจอ (กด Esc หรือ F)" : "ขยายเต็มจอ (กด F)"}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-ink-200 bg-paper px-2 font-semibold text-ink-800 hover:bg-ink-100 transition"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3 w-3" />
                  <span>ย่อจอ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3" />
                  <span>เต็มจอ</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            disabled={isBlankCanvas}
            onClick={onProceedTo3D}
            className="btn btn-primary h-7 rounded-lg px-2.5 text-[11px] font-bold shadow-xs disabled:opacity-40"
          >
            <span>ไป 3D</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* พื้นที่กระดาษแปลนห้องหลัก */}
      <div className="relative flex flex-1 min-h-0 w-full items-center justify-center overflow-hidden">
        {/* แถบเครื่องมือหลักฝั่งซ้าย 5 ปุ่มแบบกะทัดรัด */}
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5 rounded-2xl border border-white/25 bg-[#0a192f]/80 p-1.5 shadow-pop backdrop-blur-md">
          {/* 1. ปุ่ม X (รีเซ็ตค่าเริ่มต้น) */}
          <button
            type="button"
            onClick={onCancel || resetBlueprint}
            title="รีเซ็ตแปลนห้องใหม่"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-800 shadow transition-colors hover:bg-ink-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* 2. ปุ่มปากกาวาดตัวห้อง */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("pencil");
              setSelectedElement(null);
            }}
            title="ปากกาวาดตัวห้อง / ปรับขนาดผนัง"
            className={`flex h-8 w-8 items-center justify-center rounded-full shadow transition-colors ${
              activeTool === "pencil"
                ? "bg-info text-white ring-2 ring-white"
                : "bg-white text-ink-800 hover:bg-ink-100"
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
          </button>

          {/* 3. ปุ่มหน้าต่าง */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("window");
              setDraftPointsCm([]);
              setSelectedElement(null);
              setSelectedInteriorWallId(null);
            }}
            title="วางและขยับหน้าต่าง"
            className={`flex h-8 w-8 items-center justify-center rounded-full shadow transition-colors ${
              activeTool === "window"
                ? "bg-rose-500 text-white ring-2 ring-rose-200"
                : "bg-white text-ink-800 hover:bg-ink-100"
            }`}
          >
            <WindowPaneIcon className="h-3.5 w-3.5" />
          </button>

          {/* 4. ปุ่มประตู */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("door");
              setDraftPointsCm([]);
              setSelectedElement(null);
              setSelectedInteriorWallId(null);
            }}
            title="วางและขยับประตู (วางได้ทั้งผนังนอกและกำแพงในห้อง)"
            className={`flex h-8 w-8 items-center justify-center rounded-full shadow transition-colors ${
              activeTool === "door"
                ? "bg-sky-400 text-slate-950 ring-2 ring-sky-200"
                : "bg-white text-ink-800 hover:bg-ink-100"
            }`}
          >
            <DoorClosed className="h-3.5 w-3.5" />
          </button>

          {/* 5. ปุ่มไปต่อ (เข้าสู่ห้อง 3D) */}
          <button
            type="button"
            disabled={isBlankCanvas}
            onClick={onProceedTo3D}
            title="เข้าสู่ห้อง 3D"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-info text-white shadow transition-colors hover:opacity-95 disabled:opacity-40"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* เข็มทิศแบบหมุนได้ 0.1° แบบกะทัดรัด (มุมขวาบน) — รองรับทั้งเมาส์และสัมผัส Touch บนมือถือ */}
        <div
          className="absolute right-2.5 top-2.5 z-20 flex flex-col items-center rounded-2xl border border-white/20 bg-slate-900/80 px-2 py-2 shadow-xl backdrop-blur-md touch-none select-none"
          style={{ touchAction: "none" }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <svg
            ref={compassDialRef}
            viewBox="0 0 80 80"
            className="h-[54px] w-[54px] cursor-grab active:cursor-grabbing select-none touch-none"
            style={{ touchAction: "none" }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              startCompassDrag(e.clientX, e.clientY);
            }}
            onPointerDown={(e) => {
              if (e.button !== 0 && e.pointerType === "mouse") return;
              e.stopPropagation();
              if (e.cancelable) e.preventDefault();
              (e.currentTarget as SVGElement)?.setPointerCapture?.(e.pointerId);
              startCompassDrag(e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                e.stopPropagation();
                if (e.cancelable) e.preventDefault();
                startCompassDrag(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onWheel={(e) => {
              e.preventDefault();
              setOrientationDeg01(sun.orientationDeg + (e.deltaY < 0 ? 0.1 : -0.1));
            }}
          >
            <circle
              cx={40}
              cy={40}
              r={32}
              fill="rgba(15, 23, 42, 0.78)"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1.5}
            />
            {/* จุดแสดงทิศแสงอาทิตย์/ดวงจันทร์บนขอบเข็มทิศ */}
            <circle
              cx={40 + sunState.sunDirX * 32}
              cy={40 + sunState.sunDirZ * 32}
              r={5}
              fill={sunState.isNight ? "#818cf8" : "#fbbf24"}
              stroke="#ffffff"
              strokeWidth={1.4}
              pointerEvents="none"
            />
            <g transform={`translate(40, 40) rotate(${-sun.orientationDeg})`}>
              <polygon points="0,-20 4.5,0 -4.5,0" fill="#ef4444" />
              <polygon points="0,20 4.5,0 -4.5,0" fill="#e2e8f0" />
              <text x={0} y={-22} textAnchor="middle" fill="#fca5a5" className="font-mono text-[8.5px] font-black">
                N
              </text>
              <text x={24} y={3} textAnchor="middle" fill="#cbd5e1" className="font-mono text-[8px] font-bold">
                E
              </text>
              <text x={0} y={28} textAnchor="middle" fill="#cbd5e1" className="font-mono text-[8px] font-bold">
                S
              </text>
              <text x={-24} y={3} textAnchor="middle" fill="#cbd5e1" className="font-mono text-[8px] font-bold">
                W
              </text>
            </g>
            <circle cx={40} cy={40} r={3} fill="#fbbf24" />
          </svg>

          <button
            type="button"
            onClick={() => setSunPanelOpen((v) => !v)}
            title="แตะเพื่อเลือกทิศห้องอย่างละเอียด (เหนือ, ใต้, ออก, ตก)"
            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-bold text-amber-300 hover:text-amber-200 active:scale-95 transition"
          >
            <span>ทิศ {degToCardinal(sun.orientationDeg).cardinal}</span>
            <span className="text-[10px] text-amber-400/80">({sun.orientationDeg.toFixed(0)}°)</span>
          </button>

          {/* ช่องเขียนตัวเลขด้านล่างเข็มทิศ ปรับละเอียดทีละ 0.1° / 1° พร้อมปุ่มขนาดใหญ่สำหรับมือถือ */}
          <div
            className="mt-1 flex items-center gap-0.5 rounded-lg border border-white/20 bg-slate-950/85 px-1 py-0.5"
            title="หมุนเข็มทิศด้านบน หรือพิมพ์ตัวเลของศาละเอียด 0.1° ลงในช่องนี้ได้ทันที"
          >
            <button
              type="button"
              onClick={() => setOrientationDeg01(sun.orientationDeg - 1)}
              className="flex h-7 w-6.5 sm:h-5 sm:w-4 items-center justify-center rounded text-sm sm:text-[11px] font-black text-slate-200 hover:bg-white/15 active:bg-white/30"
              aria-label="ลดมุมเข็มทิศ 1 องศา"
            >
              -
            </button>
            <input
              type="number"
              min="0"
              max="359.9"
              step="0.1"
              aria-label="องศาเข็มทิศ"
              value={compassInput}
              onChange={(e) => handleCompassInputChange(e.target.value)}
              onBlur={commitCompassInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitCompassInput();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 bg-transparent text-center font-mono text-xs sm:text-[11px] font-bold text-white focus:text-amber-300 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="font-mono text-[10px] text-white/75">°</span>
            <button
              type="button"
              onClick={() => setOrientationDeg01(sun.orientationDeg + 1)}
              className="flex h-7 w-6.5 sm:h-5 sm:w-4 items-center justify-center rounded text-sm sm:text-[11px] font-black text-slate-200 hover:bg-white/15 active:bg-white/30"
              aria-label="เพิ่มมุมเข็มทิศ 1 องศา"
            >
              +
            </button>
          </div>
        </div>

        {/* ปุ่มถังขยะมุมขวาล่าง */}
        <button
          type="button"
          onClick={() => {
            if (selectedElement) {
              deleteSelected();
            } else if (selectedInteriorWallId) {
              deleteSelectedInteriorWall();
            } else if (draftPointsCm.length > 0) {
              setDraftPointsCm([]);
            } else {
              clearCanvasForFreshDraw();
            }
          }}
          title={
            selectedElement
              ? "ลบประตู/หน้าต่างที่เลือก"
              : selectedInteriorWallId
              ? "ลบกำแพงในห้องที่เลือก"
              : draftPointsCm.length > 0
              ? "ลบเส้นที่กำลังวาด"
              : "ล้างผนังห้องเพื่อวาดห้องใหม่"
          }
          className="absolute bottom-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-lg hover:bg-rose-50 hover:text-rose-600 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {/* แถบควบคุมมุมมองและซูมให้พอดีห้อง (Auto-Fit & Zoom) */}
        <div className="absolute bottom-3 right-13 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-slate-900/85 px-2 py-1 shadow-lg backdrop-blur-md text-[11px] text-white select-none">
          <button
            type="button"
            onClick={() => {
              setViewMode("fit");
              setCustomZoom(1);
            }}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold transition-all ${
              viewMode === "fit" && customZoom === 1
                ? "bg-sky-500 text-white shadow-xs"
                : "text-slate-300 hover:text-white hover:bg-white/10"
            }`}
            title="ปรับขนาดและมุมมองให้ห้องพอดีจอ ไม่เล็กไป ไม่ใหญ่เกิน"
          >
            <Maximize2 className="h-3 w-3" />
            <span>พอดีจอ</span>
          </button>
          <span className="text-white/25">|</span>
          <button
            type="button"
            onClick={() => {
              setViewMode("fit");
              setCustomZoom((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100));
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/15 text-white font-bold leading-none"
            title="ซูมออก (-)"
          >
            -
          </button>
          <span className="font-mono text-[10px] text-sky-300 min-w-[32px] text-center">
            {Math.round((viewMode === "full" ? 1 : customZoom) * 100)}%
          </span>
          <button
            type="button"
            onClick={() => {
              setViewMode("fit");
              setCustomZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100));
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/15 text-white font-bold leading-none"
            title="ซูมเข้า (+)"
          >
            +
          </button>
          <span className="text-white/25">|</span>
          <button
            type="button"
            onClick={() => {
              setViewMode("full");
              setCustomZoom(1);
            }}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all ${
              viewMode === "full"
                ? "bg-white/25 text-white"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="แสดงตารางทั้งหมด 11×7 เมตร (100%)"
          >
            ตารางเต็ม
          </button>
        </div>

        {/* กระดาษพิมพ์เขียว SVG (คำนวณ ViewBox ให้ห้องพอดีจอเสมอ ชัดเจน ใช้งานง่าย ไม่เล็กหรือใหญ่ล้น) */}
        <svg
          ref={svgRef}
          viewBox={`${computedViewBox.x} ${computedViewBox.y} ${computedViewBox.w} ${computedViewBox.h}`}
          preserveAspectRatio="xMidYMid meet"
          className={`w-full cursor-crosshair touch-none select-none ${
            isFullscreen ? "h-full max-h-full" : "h-full min-h-[260px]"
          }`}
          style={{ touchAction: "none" }}
          onMouseDown={handleCanvasMouseDown}
          onPointerDown={handleCanvasPointerDown}
          onMouseMove={(e) => {
            const pt = clientToSvgAndCm(e.clientX, e.clientY);
            if (pt) setCursorCm([pt.xCm, pt.zCm]);
          }}
          onPointerMove={(e) => {
            const pt = clientToSvgAndCm(e.clientX, e.clientY);
            if (pt) setCursorCm([pt.xCm, pt.zCm]);
          }}
          onMouseLeave={() => setCursorCm(null)}
          onPointerLeave={() => setCursorCm(null)}
          onDoubleClick={() => {
            if (activeTool === "pencil" && penMode === "point-pen") {
              if (isDraftInsideRoom && draftPointsCm.length >= 2) {
                finishPointPenPolygon(draftPointsCm, false);
              } else if (draftPointsCm.length >= 3) {
                finishPointPenPolygon(draftPointsCm, true);
              }
            }
          }}
        >
          <defs>
            <linearGradient id="sunbeam-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={sunState.sunColor} stopOpacity="0.52" />
              <stop offset="100%" stopColor={sunState.sunColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* เส้นตารางพิมพ์เขียว + จุดสีขาวทุก 0.50 เมตร */}
          <g pointerEvents="none">
            {Array.from({ length: GRID_COLS + 1 }).map((_, gx) => {
              const x = GRID_ORIGIN_X + gx * GRID_CELL_PX;
              return (
                <line
                  key={`vl-${gx}`}
                  x1={x}
                  y1={GRID_ORIGIN_Y}
                  x2={x}
                  y2={GRID_ORIGIN_Y + GRID_ROWS * GRID_CELL_PX}
                  stroke={gx % 2 === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)"}
                  strokeWidth={gx % 2 === 0 ? 1 : 0.7}
                />
              );
            })}
            {Array.from({ length: GRID_ROWS + 1 }).map((_, gz) => {
              const y = GRID_ORIGIN_Y + gz * GRID_CELL_PX;
              return (
                <line
                  key={`hl-${gz}`}
                  x1={GRID_ORIGIN_X}
                  y1={y}
                  x2={GRID_ORIGIN_X + GRID_COLS * GRID_CELL_PX}
                  y2={y}
                  stroke={gz % 2 === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)"}
                  strokeWidth={gz % 2 === 0 ? 1 : 0.7}
                />
              );
            })}
            {Array.from({ length: GRID_ROWS + 1 }).map((_, gz) =>
              Array.from({ length: GRID_COLS + 1 }).map((__, gx) => {
                const isMeter = gx % 2 === 0 && gz % 2 === 0;
                return (
                  <circle
                    key={`dot-${gx}-${gz}`}
                    cx={GRID_ORIGIN_X + gx * GRID_CELL_PX}
                    cy={GRID_ORIGIN_Y + gz * GRID_CELL_PX}
                    r={isMeter ? 2.8 : 1.7}
                    fill={isMeter ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.42)"}
                  />
                );
              })
            )}
          </g>

          {/* ข้อความแนะนำกลางกระดาษเมื่อกดล้างกระดานวาดใหม่ */}
          {isBlankCanvas && draftPointsCm.length === 0 && !boxDrag && (
            <g pointerEvents="none">
              <rect
                x={VB_W / 2 - 210}
                y={VB_H / 2 - 42}
                width={420}
                height={84}
                rx={16}
                fill="rgba(15, 23, 42, 0.78)"
                stroke="rgba(255,255,255,0.35)"
              />
              <text
                x={VB_W / 2}
                y={VB_H / 2 - 10}
                textAnchor="middle"
                fill="#fde047"
                className="font-sans text-sm font-bold"
              >
                ✏️ คลิกค้างแล้วลากบนตารางเพื่อวาดขนาดห้องของคุณได้เลย!
              </text>
              <text
                x={VB_W / 2}
                y={VB_H / 2 + 16}
                textAnchor="middle"
                fill="#dbeafe"
                className="font-sans text-xs"
              >
                (1 ช่องเล็ก = 0.50 ม. · วาดเสร็จแล้วลากต่อเติมเป็นห้องตัว L หรือซอกเว้าได้ทันที)
              </text>
            </g>
          )}

          {/* ลำแสงแดดส่องเข้าเฉพาะบานหน้าต่างที่รับแสงอาทิตย์ตามเวลาและทิศจริง */}
          {!isBlankCanvas && sunState.isDay && canvasPolyCm.length >= 3 && (
            <g pointerEvents="none">
              {windows.map((w) => {
                const idx =
                  w.edgeIndex !== undefined && w.edgeIndex < canvasPolyCm.length
                    ? w.edgeIndex
                    : 0;
                const info = getEdgeInfo(canvasPolyCm, idx);
                // cos มุมระหว่างดวงอาทิตย์กับเวกเตอร์ตั้งฉากออกนอกผนัง
                const dotSun = info.nx * sunState.sunDirX + info.nz * sunState.sunDirZ;
                if (dotSun <= 0.12) return null; // ดวงอาทิตย์อยู่ด้านหลังผนังนี้ แสงไม่เข้าบานนี้

                const halfW = Math.min(w.width / 2, info.lengthCm * 0.42);
                const cxCm = info.x1 + info.ex * info.lengthCm * w.pos;
                const czCm = info.z1 + info.ez * info.lengthCm * w.pos;
                const p1 = cmToSvg(cxCm - info.ex * halfW, czCm - info.ez * halfW);
                const p2 = cmToSvg(cxCm + info.ex * halfW, czCm + info.ez * halfW);

                // ทิศแสงพุ่งเข้าในห้อง = (-sunDirX, -sunDirZ)
                const rayLenPx = 125 * dotSun + 45;
                const p3: [number, number] = [
                  p2[0] - sunState.sunDirX * rayLenPx,
                  p2[1] - sunState.sunDirZ * rayLenPx,
                ];
                const p4: [number, number] = [
                  p1[0] - sunState.sunDirX * rayLenPx,
                  p1[1] - sunState.sunDirZ * rayLenPx,
                ];

                return (
                  <polygon
                    key={`ray-${w.id}`}
                    points={`${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]} ${p4[0]},${p4[1]}`}
                    fill={sunState.sunColor}
                    fillOpacity={sunState.isDawnOrDusk ? 0.34 : 0.24}
                  />
                );
              })}
            </g>
          )}

          {/* วาดตัวห้อง (Polygon ผนังสีขาวหนาขอบมน + คลิกตัวเลขความยาวผนังเพื่อพิมพ์ค่าละเอียด 0.1 ม.) */}
          {!isBlankCanvas && canvasPolyCm.length >= 3 && (
            <g>
              <polygon
                points={canvasPolyCm
                  .map(([x, z]) => cmToSvg(x, z).join(","))
                  .join(" ")}
                fill="rgba(255, 255, 255, 0.08)"
                stroke="#ffffff"
                strokeWidth={11}
                strokeLinejoin="round"
                strokeLinecap="round"
                pointerEvents="none"
              />

              {/* ไฮไลต์สีเหลืองทองบนเส้นผนังด้านที่กำลังพิมพ์ตัวเลขแก้ไข */}
              {editingWallInfo && editingWallIndex !== null && (() => {
                const [wx1, wy1] = cmToSvg(editingWallInfo.x1, editingWallInfo.z1);
                const [wx2, wy2] = cmToSvg(editingWallInfo.x2, editingWallInfo.z2);
                return (
                  <line
                    x1={wx1}
                    y1={wy1}
                    x2={wx2}
                    y2={wy2}
                    stroke="#fbbf24"
                    strokeWidth={13}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                );
              })()}

              {/* ป้ายความยาวผนังแต่ละด้าน + ทิศของผนัง (คลิกที่ป้ายเพื่อพิมพ์ตัวเลขความยาว 0.1 ม. ได้ทันที) */}
              {canvasPolyCm.map((_, i) => {
                const info = getEdgeInfo(canvasPolyCm, i);
                if (info.lengthCm < 40) return null;
                const midX = (info.x1 + info.x2) / 2 + info.nx * 44;
                const midZ = (info.z1 + info.z2) / 2 + info.nz * 44;
                const [lx, ly] = cmToSvg(midX, midZ);
                const wallCard = degToCardinal((info.outwardBaseDeg + sun.orientationDeg) % 360);
                const lenText = `${Number((info.lengthCm / 100).toFixed(2))}m · ${wallCard.cardinal}`;
                const isEditingThis = editingWallIndex === i;
                const isHovDim = hoveredHandle === `dim-${i}`;

                return (
                  <g
                    key={`dim-${i}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredHandle(`dim-${i}`)}
                    onMouseLeave={() => setHoveredHandle(null)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      openWallEditor(i);
                    }}
                  >
                    <title>คลิกเพื่อพิมพ์ความยาวผนังด้านนี้ (ละเอียดระดับ 0.1 เมตร)</title>
                    <rect
                      x={lx - 39}
                      y={ly - 10}
                      width={78}
                      height={20}
                      rx={10}
                      fill={
                        isEditingThis
                          ? "#fbbf24"
                          : isHovDim
                          ? "rgba(15, 23, 42, 0.88)"
                          : "rgba(15, 23, 42, 0.58)"
                      }
                      stroke={
                        isEditingThis
                          ? "#ffffff"
                          : isHovDim
                          ? "#fbbf24"
                          : "rgba(255,255,255,0.22)"
                      }
                      strokeWidth={isEditingThis || isHovDim ? 1.5 : 1}
                    />
                    <text
                      x={lx}
                      y={ly + 0.5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isEditingThis ? "#0f172a" : isHovDim ? "#fde047" : "#f8fafc"}
                      className="font-mono text-[9.5px] font-bold pointer-events-none"
                    >
                      {lenText}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* กำแพงกั้นภายในห้อง (Interior Partition Walls — วาดเพิ่มในห้อง พิมพ์ความยาว 0.1 ม. หรือคลิกขวา/ปุ่มลบได้) */}
          {!isBlankCanvas && interiorWalls.length > 0 && (
            <g pointerEvents={activeTool === "door" || activeTool === "window" ? "none" : "auto"}>
              {interiorWalls.map((iw) => {
                const dx = iw.x2 - iw.x1;
                const dz = iw.z2 - iw.z1;
                const lenCm = Math.hypot(dx, dz);
                if (lenCm < 20) return null;
                const [sx1, sy1] = cmToSvg(iw.x1, iw.z1);
                const [sx2, sy2] = cmToSvg(iw.x2, iw.z2);
                const isSel = selectedInteriorWallId === iw.id;
                const isHov = hoveredHandle === `iw-${iw.id}`;
                const nx = -dz / lenCm;
                const nz = dx / lenCm;
                const [lx, ly] = cmToSvg(
                  (iw.x1 + iw.x2) / 2 + nx * 26,
                  (iw.z1 + iw.z2) / 2 + nz * 26
                );
                const lenText = `${Number((lenCm / 100).toFixed(2))}m`;

                return (
                  <g key={iw.id}>
                    {isSel && (
                      <line
                        x1={sx1}
                        y1={sy1}
                        x2={sx2}
                        y2={sy2}
                        stroke="#fbbf24"
                        strokeWidth={14}
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                    )}
                    <line
                      x1={sx1}
                      y1={sy1}
                      x2={sx2}
                      y2={sy2}
                      stroke={isHov && !isSel ? "#fef08a" : "#ffffff"}
                      strokeWidth={9.5}
                      strokeLinecap="round"
                      pointerEvents="none"
                    />
                    {activeTool === "pencil" && penMode !== "point-pen" && (
                      <line
                        x1={sx1}
                        y1={sy1}
                        x2={sx2}
                        y2={sy2}
                        stroke="transparent"
                        strokeWidth={18}
                        strokeLinecap="round"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredHandle(`iw-${iw.id}`)}
                        onMouseLeave={() => setHoveredHandle(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectInteriorWall(iw.id);
                        }}
                      />
                    )}
                    {lenCm >= 40 && (
                      <g
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredHandle(`iw-${iw.id}`)}
                        onMouseLeave={() => setHoveredHandle(null)}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectInteriorWall(iw.id);
                        }}
                      >
                        <title>คลิกเพื่อแก้ไขความยาวกำแพงในห้อง (0.1 ม.) หรือลบออก</title>
                        <rect
                          x={lx - 26}
                          y={ly - 9.5}
                          width={52}
                          height={19}
                          rx={9.5}
                          fill={
                            isSel
                              ? "#fbbf24"
                              : isHov
                              ? "rgba(15, 23, 42, 0.9)"
                              : "rgba(15, 23, 42, 0.65)"
                          }
                          stroke={isSel ? "#ffffff" : isHov ? "#fbbf24" : "rgba(255,255,255,0.28)"}
                          strokeWidth={isSel || isHov ? 1.5 : 1}
                        />
                        <text
                          x={lx}
                          y={ly + 0.5}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={isSel ? "#0f172a" : isHov ? "#fde047" : "#f8fafc"}
                          className="font-mono text-[9px] font-bold pointer-events-none"
                        >
                          {lenText}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* เงาตัวอย่างหน้าต่าง/ประตูก่อนคลิกวาง (รองรับทั้งผนังนอกและกำแพงในห้อง) */}
          {openingPreview && !isBlankCanvas && (
            <g pointerEvents="none" opacity={0.7}>
              {(() => {
                const halfW = Math.min(openingPreview.widthCm / 2, openingPreview.lengthCm * 0.42);
                const cxCm =
                  openingPreview.x1 + openingPreview.ex * openingPreview.lengthCm * openingPreview.pos;
                const czCm =
                  openingPreview.z1 + openingPreview.ez * openingPreview.lengthCm * openingPreview.pos;
                const [x1, y1] = cmToSvg(
                  cxCm - openingPreview.ex * halfW,
                  czCm - openingPreview.ez * halfW
                );
                const [x2, y2] = cmToSvg(
                  cxCm + openingPreview.ex * halfW,
                  czCm + openingPreview.ez * halfW
                );
                return (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={openingPreview.type === "window" ? "#f87171" : "#60a5fa"}
                    strokeWidth={14}
                    strokeLinecap="round"
                  />
                );
              })()}
            </g>
          )}

          {/* หน้าต่างทั้งหมดบนผนัง (ลากย้ายตำแหน่งไปตามผนังได้ทุกบาน) */}
          {!isBlankCanvas &&
            canvasPolyCm.length >= 3 &&
            windows.map((w) => {
              const iw = w.interiorWallId
                ? interiorWalls.find((item) => item.id === w.interiorWallId)
                : null;
              const geom = iw
                ? (() => {
                    const dx = iw.x2 - iw.x1;
                    const dz = iw.z2 - iw.z1;
                    const lengthCm = Math.max(1, Math.hypot(dx, dz));
                    return {
                      x1: iw.x1,
                      z1: iw.z1,
                      ex: dx / lengthCm,
                      ez: dz / lengthCm,
                      lengthCm,
                    };
                  })()
                : (() => {
                    const idx =
                      w.edgeIndex !== undefined && w.edgeIndex < canvasPolyCm.length
                        ? w.edgeIndex
                        : 0;
                    return getEdgeInfo(canvasPolyCm, idx);
                  })();
              const halfW = Math.min(w.width / 2, geom.lengthCm * 0.44);
              const cxCm = geom.x1 + geom.ex * geom.lengthCm * w.pos;
              const czCm = geom.z1 + geom.ez * geom.lengthCm * w.pos;
              const [x1, y1] = cmToSvg(cxCm - geom.ex * halfW, czCm - geom.ez * halfW);
              const [x2, y2] = cmToSvg(cxCm + geom.ex * halfW, czCm + geom.ez * halfW);
              const isSelected = selectedElement?.type === "window" && selectedElement.id === w.id;
              const isHovered = hoveredHandle === `win-${w.id}`;

              return (
                <g
                  key={w.id}
                  className="cursor-grab active:cursor-grabbing touch-none select-none"
                  style={{ touchAction: "none" }}
                  onMouseEnter={() => setHoveredHandle(`win-${w.id}`)}
                  onMouseLeave={() => setHoveredHandle(null)}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    setSelectedInteriorWallId(null);
                    setSelectedElement({ type: "window", id: w.id });
                    setDraggingOpening({ type: "window", id: w.id });
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0 && e.pointerType === "mouse") return;
                    e.stopPropagation();
                    if (e.cancelable) e.preventDefault();
                    (e.currentTarget as SVGElement)?.setPointerCapture?.(e.pointerId);
                    setSelectedInteriorWallId(null);
                    setSelectedElement({ type: "window", id: w.id });
                    setDraggingOpening({ type: "window", id: w.id });
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setSelectedInteriorWallId(null);
                    setSelectedElement({ type: "window", id: w.id });
                    setDraggingOpening({ type: "window", id: w.id });
                  }}
                >
                  {/* พื้นที่จับคลิกกว้างพิเศษ ลากง่ายไม่มีหลุด */}
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={26} strokeLinecap="round" />
                  {isSelected && (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#ffffff"
                      strokeWidth={18}
                      strokeLinecap="round"
                    />
                  )}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isHovered ? "#fb7185" : "#f87171"}
                    strokeWidth={13}
                    strokeLinecap="round"
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

          {/* ประตูทั้งหมดบนผนังนอกและกำแพงในห้อง (ลากย้ายตำแหน่งไปตามผนังได้ทุกบาน) */}
          {!isBlankCanvas &&
            canvasPolyCm.length >= 3 &&
            doors.map((d) => {
              const iw = d.interiorWallId
                ? interiorWalls.find((item) => item.id === d.interiorWallId)
                : null;
              const geom = iw
                ? (() => {
                    const dx = iw.x2 - iw.x1;
                    const dz = iw.z2 - iw.z1;
                    const lengthCm = Math.max(1, Math.hypot(dx, dz));
                    return {
                      x1: iw.x1,
                      z1: iw.z1,
                      ex: dx / lengthCm,
                      ez: dz / lengthCm,
                      lengthCm,
                    };
                  })()
                : (() => {
                    const idx =
                      d.edgeIndex !== undefined && d.edgeIndex < canvasPolyCm.length
                        ? d.edgeIndex
                        : 0;
                    return getEdgeInfo(canvasPolyCm, idx);
                  })();
              const halfW = Math.min(d.width / 2, geom.lengthCm * 0.44);
              const cxCm = geom.x1 + geom.ex * geom.lengthCm * d.pos;
              const czCm = geom.z1 + geom.ez * geom.lengthCm * d.pos;
              const [x1, y1] = cmToSvg(cxCm - geom.ex * halfW, czCm - geom.ez * halfW);
              const [x2, y2] = cmToSvg(cxCm + geom.ex * halfW, czCm + geom.ez * halfW);
              const isSelected = selectedElement?.type === "door" && selectedElement.id === d.id;
              const isHovered = hoveredHandle === `door-${d.id}`;

              return (
                <g
                  key={d.id}
                  className="cursor-grab active:cursor-grabbing touch-none select-none"
                  style={{ touchAction: "none" }}
                  onMouseEnter={() => setHoveredHandle(`door-${d.id}`)}
                  onMouseLeave={() => setHoveredHandle(null)}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    setSelectedInteriorWallId(null);
                    setSelectedElement({ type: "door", id: d.id });
                    setDraggingOpening({ type: "door", id: d.id });
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0 && e.pointerType === "mouse") return;
                    e.stopPropagation();
                    if (e.cancelable) e.preventDefault();
                    (e.currentTarget as SVGElement)?.setPointerCapture?.(e.pointerId);
                    setSelectedInteriorWallId(null);
                    setSelectedElement({ type: "door", id: d.id });
                    setDraggingOpening({ type: "door", id: d.id });
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setSelectedInteriorWallId(null);
                    setSelectedElement({ type: "door", id: d.id });
                    setDraggingOpening({ type: "door", id: d.id });
                  }}
                >
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={26} strokeLinecap="round" />
                  {isSelected && (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#ffffff"
                      strokeWidth={18}
                      strokeLinecap="round"
                    />
                  )}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isHovered ? "#38bdf8" : "#60a5fa"}
                    strokeWidth={13}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

          {/* จุดดึงขอบผนัง (สีฟ้า), จุดดึงมุมห้อง (สีส้ม), และจุดปลายกำแพงในห้อง — ไม่มี CSS scale จึงนิ่งสนิท 100%! */}
          {activeTool === "pencil" &&
            penMode !== "point-pen" &&
            !isBlankCanvas &&
            !boxDrag &&
            canvasPolyCm.length >= 3 && (
              <g>
                {/* จุดดึงปลายกำแพงในห้อง (ปรับยืด/หดความยาวและมุมกำแพงกั้นในห้องละเอียด 0.1 ม.) */}
                {interiorWalls.map((iw) =>
                  ([1, 2] as const).map((end) => {
                    const exCm = end === 1 ? iw.x1 : iw.x2;
                    const ezCm = end === 1 ? iw.z1 : iw.z2;
                    const [hx, hy] = cmToSvg(exCm, ezCm);
                    const hid = `iw-end-${iw.id}-${end}`;
                    const isHov = hoveredHandle === hid;
                    const isSel = selectedInteriorWallId === iw.id;
                    return (
                      <g
                        key={hid}
                        className="cursor-move select-none touch-none"
                        style={{ touchAction: "none" }}
                        onMouseEnter={() => setHoveredHandle(hid)}
                        onMouseLeave={() => setHoveredHandle(null)}
                        data-wall={iw.id}
                        data-end={end}
                        onMouseDown={startInteriorEndDrag}
                        onPointerDown={startInteriorEndDrag}
                        onTouchStart={(e) => {
                          if (e.touches.length > 0) {
                            e.stopPropagation();
                            selectInteriorWall(iw.id);
                            setPolyHistory((h) => [...h.slice(-19), { poly: canvasPolyCm, interiorWalls, isBlank: isBlankCanvas }]);
                            const pt = clientToSvgAndCm(e.touches[0].clientX, e.touches[0].clientY);
                            if (!pt) return;
                            setHandleDrag({
                              kind: "interior-end",
                              wallId: iw.id,
                              end,
                              startMouseCm: [pt.xCm, pt.zCm],
                              basePoly: canvasPolyCm.map((p) => [p[0], p[1]]),
                              baseInteriorWalls: interiorWalls.map((w) => ({ ...w })),
                            });
                          }
                        }}
                      >
                        <circle cx={hx} cy={hy} r={28} fill="transparent" />
                        {(isHov || isSel) && (
                          <circle
                            cx={hx}
                            cy={hy}
                            r={10.5}
                            fill="rgba(251, 191, 36, 0.35)"
                            pointerEvents="none"
                          />
                        )}
                        <circle
                          cx={hx}
                          cy={hy}
                          r={isHov ? 7 : 5.5}
                          fill={isSel ? "#fbbf24" : "#38bdf8"}
                          stroke="#ffffff"
                          strokeWidth={2.2}
                          pointerEvents="none"
                        />
                      </g>
                    );
                  })
                )}

                {/* จุดสีฟ้าบนผนังแต่ละด้าน (หลบตำแหน่งประตู/หน้าต่างอัตโนมัติ ไม่ทับซ้อนกัน) */}
                {canvasPolyCm.map((_, i) => {
                  const info = getEdgeInfo(canvasPolyCm, i);
                  if (info.lengthCm < 80) return null;

                  let handleT = 0.5;
                  const edgeOpenings = [
                    ...windows.filter((w) => !w.interiorWallId && (w.edgeIndex ?? 0) === i),
                    ...doors.filter((d) => !d.interiorWallId && (d.edgeIndex ?? 0) === i),
                  ];
                  const isBlocked = (t: number) =>
                    edgeOpenings.some(
                      (o) => Math.abs(o.pos - t) * info.lengthCm < o.width / 2 + 22
                    );
                  if (isBlocked(0.5)) {
                    for (const cand of [0.75, 0.25, 0.82, 0.18, 0.65, 0.35]) {
                      if (!isBlocked(cand)) {
                        handleT = cand;
                        break;
                      }
                    }
                  }

                  const [mx, my] = cmToSvg(
                    info.x1 + info.ex * info.lengthCm * handleT,
                    info.z1 + info.ez * info.lengthCm * handleT
                  );
                  const hid = `edge-${i}`;
                  const isHov = hoveredHandle === hid;
                  const isHoriz = Math.abs(info.z1 - info.z2) < 2;

                  return (
                    <g
                      key={hid}
                      className={`${isHoriz ? "cursor-ns-resize" : "cursor-ew-resize"} select-none touch-none`}
                      style={{ touchAction: "none" }}
                      onMouseEnter={() => setHoveredHandle(hid)}
                      onMouseLeave={() => setHoveredHandle(null)}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        startEdgeDrag(i, e.clientX, e.clientY);
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0 && e.pointerType === "mouse") return;
                        e.stopPropagation();
                        if (e.cancelable) e.preventDefault();
                        (e.currentTarget as SVGElement)?.setPointerCapture?.(e.pointerId);
                        startEdgeDrag(i, e.clientX, e.clientY);
                      }}
                      onTouchStart={(e) => {
                        if (e.touches.length > 0) {
                          e.stopPropagation();
                          if (e.cancelable) e.preventDefault();
                          startEdgeDrag(i, e.touches[0].clientX, e.touches[0].clientY);
                        }
                      }}
                    >
                      {/* วงรับสัมผัสขนาดใหญ่ 30px สำหรับนิ้วบนมือถือ */}
                      <circle cx={mx} cy={my} r={30} fill="transparent" />
                      {isHov && (
                        <circle
                          cx={mx}
                          cy={my}
                          r={14}
                          fill="rgba(56, 189, 248, 0.35)"
                          stroke="rgba(56, 189, 248, 0.75)"
                          strokeWidth={1.5}
                          pointerEvents="none"
                        />
                      )}
                      <circle
                        cx={mx}
                        cy={my + 1}
                        r={isHov ? 9.5 : 8}
                        fill="rgba(0,0,0,0.35)"
                        pointerEvents="none"
                      />
                      <circle
                        cx={mx}
                        cy={my}
                        r={isHov ? 9 : 7.5}
                        fill="#38bdf8"
                        stroke="#ffffff"
                        strokeWidth={2.8}
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}

                {/* จุดสีส้มที่มุมห้องทุกมุม (ขยายให้ใหญ่ขึ้น ชัดเจน และแตะ/กดค้างลากบนมือถือได้ลื่นไหล 100%) */}
                {canvasPolyCm.map(([vxCm, vzCm], i) => {
                  const [vx, vy] = cmToSvg(vxCm, vzCm);
                  const hid = `vert-${i}`;
                  const isHov = hoveredHandle === hid;
                  const isDraggingThis = handleDrag?.kind === "vertex" && handleDrag.index === i;

                  return (
                    <g
                      key={hid}
                      className="cursor-move select-none touch-none"
                      style={{ touchAction: "none" }}
                      onMouseEnter={() => setHoveredHandle(hid)}
                      onMouseLeave={() => setHoveredHandle(null)}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        startVertexDrag(i, e.clientX, e.clientY);
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0 && e.pointerType === "mouse") return;
                        e.stopPropagation();
                        if (e.cancelable) e.preventDefault();
                        (e.currentTarget as SVGElement)?.setPointerCapture?.(e.pointerId);
                        startVertexDrag(i, e.clientX, e.clientY);
                      }}
                      onTouchStart={(e) => {
                        if (e.touches.length > 0) {
                          e.stopPropagation();
                          if (e.cancelable) e.preventDefault();
                          startVertexDrag(i, e.touches[0].clientX, e.touches[0].clientY);
                        }
                      }}
                    >
                      {/* วงรับสัมผัสขนาดใหญ่พิเศษ 38px สำหรับนิ้วมือบนสมาร์ทโฟน/แท็บเล็ต */}
                      <circle cx={vx} cy={vy} r={38} fill="transparent" />

                      {/* วงแหวนรัศมีภายนอกแสดงประกายแสงสีส้มเมื่อวางเมาส์หรือกำลังแตะค้างลาก */}
                      {(isHov || isDraggingThis) && (
                        <circle
                          cx={vx}
                          cy={vy}
                          r={isDraggingThis ? 26 : 22}
                          fill="rgba(245, 158, 11, 0.32)"
                          stroke="rgba(245, 158, 11, 0.85)"
                          strokeWidth={2}
                          pointerEvents="none"
                        />
                      )}

                      {/* วงเงาด้านหลังเพิ่มมิติความนูน */}
                      <circle
                        cx={vx}
                        cy={vy + 1.5}
                        r={isDraggingThis ? 17 : isHov ? 15 : 13.5}
                        fill="rgba(0,0,0,0.40)"
                        pointerEvents="none"
                      />

                      {/* จุดกลมสีส้มหลัก: ใหญ่ขึ้น ชัดเจน ขอบขาวหนา สำหรับลากขยายห้องบนมือถือ */}
                      <circle
                        cx={vx}
                        cy={vy}
                        r={isDraggingThis ? 16 : isHov ? 14 : 13}
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth={3.5}
                        pointerEvents="none"
                      />

                      {/* จุดศูนย์กลางสีขาว (Center Cross/Dot) เพื่อความแม่นยำในการเล็งขยายห้อง */}
                      <circle
                        cx={vx}
                        cy={vy}
                        r={4}
                        fill="#ffffff"
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}
              </g>
            )}

          {/* เส้นแสดงตัวอย่างขณะลากวาดกำแพงเข้าไปในตัวห้อง (Interior Partition Wall Live Preview) */}
          {interiorWallDragPreview && (
            <g pointerEvents="none">
              {(() => {
                const [x1, y1] = cmToSvg(interiorWallDragPreview.x1, interiorWallDragPreview.z1);
                const [x2, y2] = cmToSvg(interiorWallDragPreview.x2, interiorWallDragPreview.z2);
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2 - 20;
                const validLen = interiorWallDragPreview.lengthCm >= 40;
                const labelText = validLen
                  ? `+ กำแพง ${(interiorWallDragPreview.lengthCm / 100).toFixed(2)}m · คลิกขวายกเลิก`
                  : `ลากในห้องเพื่อเพิ่มกำแพง · คลิกขวายกเลิก`;
                return (
                  <>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#fde047"
                      strokeWidth={15}
                      strokeLinecap="round"
                      opacity={0.45}
                    />
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#ffffff"
                      strokeWidth={9.5}
                      strokeLinecap="round"
                    />
                    <circle cx={x1} cy={y1} r={6} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} />
                    <circle
                      cx={x2}
                      cy={y2}
                      r={6.5}
                      fill={validLen ? "#10b981" : "#fbbf24"}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <rect
                      x={mx - 102}
                      y={my - 12}
                      width={204}
                      height={24}
                      rx={8}
                      fill="rgba(15, 23, 42, 0.92)"
                      stroke="rgba(253, 224, 71, 0.65)"
                    />
                    <text
                      x={mx}
                      y={my + 0.5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fde047"
                      className="font-mono text-[10.5px] font-bold"
                    >
                      {labelText}
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* กรอบแสดงขนาดสดขณะคลิกลากวาดบล็อกห้อง (Grid Box Paint / Erase Preview) */}
          {boxDragPreview && (
            <g pointerEvents="none">
              <rect
                x={boxDragPreview.x}
                y={boxDragPreview.y}
                width={boxDragPreview.wPx}
                height={boxDragPreview.hPx}
                rx={6}
                fill={
                  boxDragPreview.mode === "erase"
                    ? "rgba(244, 63, 94, 0.32)"
                    : "rgba(253, 224, 71, 0.25)"
                }
                stroke={boxDragPreview.mode === "erase" ? "#fb7185" : "#fde047"}
                strokeWidth={4}
                strokeDasharray="8 5"
              />
              <rect
                x={boxDragPreview.x + boxDragPreview.wPx / 2 - 96}
                y={boxDragPreview.y + boxDragPreview.hPx / 2 - 13}
                width={192}
                height={26}
                rx={8}
                fill="rgba(15, 23, 42, 0.9)"
              />
              <text
                x={boxDragPreview.x + boxDragPreview.wPx / 2}
                y={boxDragPreview.y + boxDragPreview.hPx / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={boxDragPreview.mode === "erase" ? "#fda4af" : "#fde047"}
                className="font-mono text-[11px] font-bold"
              >
                {boxDragPreview.mode === "erase" ? "ตัดออก " : ""}
                {boxDragPreview.wM}×{boxDragPreview.dM}m · คลิกขวายกเลิก
              </text>
            </g>
          )}

          {/* จุดช่วยเล็งดูดติดผนัง/มุมห้องหลักก่อนคลิกจุดแรกในโหมดวาดเส้น */}
          {activeTool === "pencil" &&
            penMode === "point-pen" &&
            draftPointsCm.length === 0 &&
            pointPenCursorSnap && (
              <g pointerEvents="none">
                {(() => {
                  const [sx, sy] = cmToSvg(pointPenCursorSnap.pt[0], pointPenCursorSnap.pt[1]);
                  return (
                    <circle
                      cx={sx}
                      cy={sy}
                      r={pointPenCursorSnap.onMainWall ? 7.5 : 5}
                      fill={pointPenCursorSnap.onMainWall ? "#10b981" : "rgba(253, 224, 71, 0.85)"}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  );
                })()}
              </g>
            )}

          {/* เส้นกำลังวาด + เงาเชื่อมครึ่งสามเหลี่ยม/ส่วนต่อเติมสดในโหมดวาดเส้น (Point-to-Point Wall Pen) */}
          {activeTool === "pencil" && penMode === "point-pen" && draftPointsCm.length > 0 && (
            <g pointerEvents="none">
              {pointPenMergePreview && (
                <polygon
                  points={pointPenMergePreview.extPoly
                    .map(([px, pz]) => cmToSvg(px, pz).join(","))
                    .join(" ")}
                  fill="rgba(16, 185, 129, 0.28)"
                  stroke="#34d399"
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                  strokeDasharray="7 5"
                />
              )}

              <polyline
                points={draftPointsCm.map(([x, z]) => cmToSvg(x, z).join(",")).join(" ")}
                fill="none"
                stroke="#fde047"
                strokeWidth={8}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pointPenCursorSnap && (() => {
                const last = draftPointsCm[draftPointsCm.length - 1];
                const [sxCm, szCm] = pointPenCursorSnap.pt;
                const [x1, y1] = cmToSvg(last[0], last[1]);
                const [x2, y2] = cmToSvg(sxCm, szCm);
                const distM = (Math.hypot(sxCm - last[0], szCm - last[1]) / 100).toFixed(2);
                const readyMerge = Boolean(pointPenMergePreview?.readyOnClick);
                const badgeText = readyMerge
                  ? `${distM}m · คลิกเชื่อมรวมกับห้องหลัก`
                  : `${distM}m · คลิกขวาลบเส้น`;
                const badgeW = readyMerge ? 188 : 132;
                return (
                  <g>
                    {pointPenCursorSnap.alignXFrom && (
                      <line
                        x1={cmToSvg(pointPenCursorSnap.alignXFrom[0], pointPenCursorSnap.alignXFrom[1])[0]}
                        y1={cmToSvg(pointPenCursorSnap.alignXFrom[0], pointPenCursorSnap.alignXFrom[1])[1]}
                        x2={x2}
                        y2={y2}
                        stroke="#38bdf8"
                        strokeWidth={1.8}
                        strokeDasharray="4 4"
                      />
                    )}
                    {pointPenCursorSnap.alignZFrom && (
                      <line
                        x1={cmToSvg(pointPenCursorSnap.alignZFrom[0], pointPenCursorSnap.alignZFrom[1])[0]}
                        y1={cmToSvg(pointPenCursorSnap.alignZFrom[0], pointPenCursorSnap.alignZFrom[1])[1]}
                        x2={x2}
                        y2={y2}
                        stroke="#38bdf8"
                        strokeWidth={1.8}
                        strokeDasharray="4 4"
                      />
                    )}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={readyMerge ? "#34d399" : "#ffffff"}
                      strokeWidth={4}
                      strokeDasharray="8 6"
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r={pointPenCursorSnap.onMainWall ? 8 : 5.5}
                      fill={pointPenCursorSnap.onMainWall ? "#10b981" : "#fde047"}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <rect
                      x={(x1 + x2) / 2 - badgeW / 2}
                      y={(y1 + y2) / 2 - 11.5}
                      width={badgeW}
                      height={22}
                      rx={6}
                      fill="rgba(15,23,42,0.92)"
                      stroke={readyMerge ? "rgba(52, 211, 153, 0.75)" : "none"}
                    />
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={readyMerge ? "#6ee7b7" : "#fde047"}
                      className="font-mono text-[10.5px] font-bold"
                    >
                      {badgeText}
                    </text>
                  </g>
                );
              })()}
              {draftPointsCm.map(([px, pz], idx) => {
                const [sx, sy] = cmToSvg(px, pz);
                const isFirst = idx === 0 && draftPointsCm.length >= 3 && !isDraftInsideRoom;
                return (
                  <circle
                    key={`dp-${idx}`}
                    cx={sx}
                    cy={sy}
                    r={isFirst ? 10 : 6.5}
                    fill={isFirst ? "#10b981" : "#fde047"}
                    stroke="#ffffff"
                    strokeWidth={2.5}
                  />
                );
              })}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
