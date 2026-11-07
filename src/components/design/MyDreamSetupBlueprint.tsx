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
import { signedArea, type Pt2 } from "@/lib/room-shape";
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
  cellKey,
  makeRectCells,
  cellsToRoomPolygon,
  normalizeCanvasPolygon,
  polygonToCells,
  cmToSvg,
  svgToCm,
  getEdgeInfo,
  findClosestWallEdge,
  movePolygonEdge,
  setPolygonEdgeLength,
  hasSelfIntersection,
} from "@/lib/blueprint-geometry";

export interface BlueprintDoor {
  id: string;
  edgeIndex?: number;
  wall: "top" | "bottom" | "left" | "right";
  /** Position from 0.08 to 0.92 along the wall segment */
  pos: number;
  width: number; // in cm (e.g. 80cm)
}

export interface BlueprintWindow {
  id: string;
  edgeIndex?: number;
  wall: "top" | "bottom" | "left" | "right";
  /** Position from 0.08 to 0.92 along the wall segment */
  pos: number;
  width: number; // in cm (e.g. 120cm)
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
}: MyDreamSetupBlueprintProps) {
  // เครื่องมือหลักฝั่งซ้าย: ปากกาวาดห้อง | หน้าต่าง | ประตู
  const [activeTool, setActiveTool] = useState<"pencil" | "window" | "door">("pencil");
  // โหมดย่อยของปากกาวาดห้อง: วาด/ต่อเติมบล็อก | เว้ามุม | คลิกจุดต่อจุด
  const [penMode, setPenMode] = useState<PenDrawMode>("paint-add");

  // รูปทรงห้องปัจจุบันบนกระดาษพิมพ์เขียว (หน่วย ซม. บนตารางคงที่ -> ไม่เด้ง ไม่ซูมเอง)
  const [canvasPolyCm, setCanvasPolyCm] = useState<Pt2[]>(() => initialCanvasPolyFromRoom(room));
  const [polyHistory, setPolyHistory] = useState<Pt2[][]>([]);
  const [isBlankCanvas, setIsBlankCanvas] = useState(false);

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

  // ผนังที่กำลังคลิกพิมพ์ตัวเลขความยาว (ละเอียดระดับ 0.1 เมตร / 0.01 เมตร)
  const [editingWallIndex, setEditingWallIndex] = useState<number | null>(null);
  const [wallLenInput, setWallLenInput] = useState("");

  // ทิศทางเข็มทิศ (ละเอียด 0.1°) & แสงอาทิตย์ตามเวลา + เมนูทรงห้องสำเร็จรูป
  const [sun, setSun] = useState<SunSettings>(room.sunSettings || initialSunSettings);
  const [compassInput, setCompassInput] = useState(() =>
    String(Number(((room.sunSettings || initialSunSettings).orientationDeg || 0).toFixed(1)))
  );
  const [sunPanelOpen, setSunPanelOpen] = useState(false);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);

  // สถานะการลากวาดบล็อกบนตาราง (Grid Box Drag)
  const [boxDrag, setBoxDrag] = useState<{
    mode: "add" | "erase";
    startGx: number;
    startGz: number;
    curGx: number;
    curGz: number;
  } | null>(null);

  // สถานะการลากจุดมุมห้องหรือเส้นผนัง (Zero-jitter SVG drag)
  const [handleDrag, setHandleDrag] = useState<
    | { kind: "vertex"; index: number; startMouseCm: Pt2; basePoly: Pt2[] }
    | { kind: "edge"; index: number; startMouseCm: Pt2; basePoly: Pt2[] }
    | null
  >(null);

  // สถานะการลากย้ายหน้าต่างหรือประตูไปตามผนัง
  const [draggingOpening, setDraggingOpening] = useState<{
    type: "door" | "window";
    id: string;
  } | null>(null);

  // สถานะการหมุนวงเข็มทิศบนกระดาษ
  const [draggingCompass, setDraggingCompass] = useState(false);

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

  // ย้ายประตู/หน้าต่างให้เกาะผนังที่ใกล้ที่สุดเสมอเมื่อรูปทรงห้องเปลี่ยน
  const reattachOpeningsToPoly = useCallback((oldPoly: Pt2[], nextPoly: Pt2[]) => {
    if (nextPoly.length < 3) return;

    const mapOpening = <T extends BlueprintDoor | BlueprintWindow>(item: T): T => {
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
        edgeIndex: hit.edgeIndex,
        wall: hit.wallCardinal,
        pos: hit.pos,
      };
    };

    setWindows((prev) => prev.map(mapOpening));
    setDoors((prev) => prev.map(mapOpening));
  }, []);

  // อัปเดต Polygon พร้อมเก็บประวัติ Undo
  const commitNewPoly = useCallback(
    (nextPolyRaw: Pt2[]) => {
      const norm = normalizeCanvasPolygon(nextPolyRaw);
      if (!norm) return;
      setCanvasPolyCm((prev) => {
        setPolyHistory((h) => [...h.slice(-19), prev]);
        reattachOpeningsToPoly(prev, norm.canvasPolyCm);
        return norm.canvasPolyCm;
      });
      setIsBlankCanvas(false);
    },
    [reattachOpeningsToPoly]
  );

  const handleUndoRoomShape = () => {
    setPolyHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setCanvasPolyCm((cur) => {
        reattachOpeningsToPoly(cur, last);
        return last;
      });
      setIsBlankCanvas(false);
      return h.slice(0, -1);
    });
  };

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

    const nextRoom: RoomSize = {
      ...roomBaseRef.current,
      w: normalizedRoom.widthCm,
      d: normalizedRoom.depthCm,
      h: heightCm,
      shape: normalizedRoom.isSimpleRect ? undefined : normalizedRoom.localShapeCm,
      orientation: sun.orientationDeg,
      sunSettings: sun,
      win: winConfig,
      windows: windows.map((w) => ({
        id: w.id,
        edgeIndex: w.edgeIndex,
        wall: w.wall,
        pos: w.pos,
        width: w.width,
      })),
      doors: doors.map((d) => ({
        id: d.id,
        edgeIndex: d.edgeIndex,
        wall: d.wall,
        pos: d.pos,
        width: d.width,
      })),
    };

    onChangeRef.current(nextRoom, doors, windows, sun);
  }, [normalizedRoom, isBlankCanvas, heightCm, doors, windows, sun]);

  // พื้นที่และตัวเลขขนาดห้อง
  const areaM2 = useMemo(() => {
    if (isBlankCanvas || canvasPolyCm.length < 3) return "0.0";
    return (Math.abs(signedArea(canvasPolyCm)) / 10000).toFixed(1);
  }, [canvasPolyCm, isBlankCanvas]);

  const widthM = String(Number((widthCm / 100).toFixed(2)));
  const depthM = String(Number((depthCm / 100).toFixed(2)));

  // เปิดกล่องแก้ไขความยาวผนังด้านที่เลือก (หน่วย เมตร ละเอียดระดับ 0.1 ม.)
  const openWallEditor = useCallback(
    (edgeIdx: number) => {
      if (isBlankCanvas || canvasPolyCm.length < 3) return;
      const safeIdx = ((edgeIdx % canvasPolyCm.length) + canvasPolyCm.length) % canvasPolyCm.length;
      const info = getEdgeInfo(canvasPolyCm, safeIdx);
      setSelectedElement(null);
      setEditingWallIndex(safeIdx);
      setWallLenInput(String(Number((info.lengthCm / 100).toFixed(2))));
    },
    [canvasPolyCm, isBlankCanvas]
  );

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
    const sx = ((clientX - rect.left) / rect.width) * VB_W;
    const sy = ((clientY - rect.top) / rect.height) * VB_H;
    const [xCm, zCm] = svgToCm(sx, sy);
    return { sx, sy, xCm, zCm };
  }, []);

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
    const hit = findClosestWallEdge(canvasPolyCm, cursorCm[0], cursorCm[1], wCm);
    if (!hit || hit.distCm > 55) return null;
    return { ...hit, widthCm: wCm, type: activeTool };
  }, [activeTool, cursorCm, isBlankCanvas, draggingOpening, canvasPolyCm]);

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
    commitNewPoly(pts);
  };

  // ล้างกระดานเพื่อเริ่มวาดห้องเองจากหน้าว่างเปล่า
  const clearCanvasForFreshDraw = () => {
    if (!isBlankCanvas && canvasPolyCm.length >= 3) {
      setPolyHistory((h) => [...h.slice(-19), canvasPolyCm]);
    }
    setIsBlankCanvas(true);
    setDraftPointsCm([]);
    setSelectedElement(null);
    setEditingWallIndex(null);
    setActiveTool("pencil");
    if (penMode === "paint-erase") setPenMode("paint-add");
  };

  // รีเซ็ตกลับค่าเริ่มต้นทั้งหมด
  const resetBlueprint = () => {
    const defPoly = initialCanvasPolyFromRoom({ w: 350, d: 400, h: 260 });
    setCanvasPolyCm(defPoly);
    setIsBlankCanvas(false);
    setDraftPointsCm([]);
    setHeightCm(260);
    setHeightInput("2.6");
    setDoors([{ id: `d-${Date.now()}`, edgeIndex: 1, wall: "right", pos: 0.7, width: 80 }]);
    setWindows([{ id: `w-${Date.now()}`, edgeIndex: 0, wall: "top", pos: 0.4, width: 120 }]);
    setSun(DEFAULT_SUN_SETTINGS);
    setCompassInput("0.0");
    setSelectedElement(null);
    setEditingWallIndex(null);
  };

  // ปิดเส้นผนังในโหมดวาดจุดต่อจุด (Point-to-Point)
  const finishPointPenPolygon = useCallback(
    (pts: Pt2[]) => {
      if (pts.length < 3) return;
      if (hasSelfIntersection(pts)) return;
      const norm = normalizeCanvasPolygon(pts);
      if (!norm) return;
      commitNewPoly(pts);
      setDraftPointsCm([]);
    },
    [commitNewPoly]
  );

  // คลิกหรือเริ่มลากบนพื้นกระดาษพิมพ์เขียว
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setSunPanelOpen(false);
    setShapeMenuOpen(false);
    if (e.button !== 0 && e.button !== 2) return;
    const pt = clientToSvgAndCm(e.clientX, e.clientY);
    if (!pt) return;

    // 1) โหมดวางหน้าต่าง หรือ ประตู: คลิกใกล้ผนังเพื่อวางทันที
    if (activeTool === "window" || activeTool === "door") {
      if (isBlankCanvas) return;
      const wCm = activeTool === "window" ? 120 : 80;
      const hit = findClosestWallEdge(canvasPolyCm, pt.xCm, pt.zCm, wCm);
      if (hit && hit.distCm <= 55) {
        if (activeTool === "window") {
          const nw: BlueprintWindow = {
            id: `w-${Date.now()}`,
            edgeIndex: hit.edgeIndex,
            wall: hit.wallCardinal,
            pos: hit.pos,
            width: Math.min(120, Math.max(60, Math.round(hit.lengthCm - 30))),
          };
          setWindows((prev) => [...prev, nw]);
          setSelectedElement({ type: "window", id: nw.id });
        } else {
          const nd: BlueprintDoor = {
            id: `d-${Date.now()}`,
            edgeIndex: hit.edgeIndex,
            wall: hit.wallCardinal,
            pos: hit.pos,
            width: Math.min(80, Math.max(60, Math.round(hit.lengthCm - 25))),
          };
          setDoors((prev) => [...prev, nd]);
          setSelectedElement({ type: "door", id: nd.id });
        }
      } else {
        setSelectedElement(null);
      }
      return;
    }

    // 2) โหมดปากกา -> วาดเส้นทีละจุด (Point-to-Point ละเอียดทุก 0.1 เมตร = 10 ซม.)
    if (activeTool === "pencil" && penMode === "point-pen") {
      const snapCm = 10;
      const maxX = GRID_COLS * GRID_CELL_CM;
      const maxZ = GRID_ROWS * GRID_CELL_CM;
      const sx = Math.max(0, Math.min(maxX, Math.round(pt.xCm / snapCm) * snapCm));
      const sz = Math.max(0, Math.min(maxZ, Math.round(pt.zCm / snapCm) * snapCm));

      if (draftPointsCm.length >= 3) {
        const [fx, fz] = draftPointsCm[0];
        if (Math.hypot(sx - fx, sz - fz) <= 35) {
          finishPointPenPolygon(draftPointsCm);
          return;
        }
      }
      setDraftPointsCm((prev) => [...prev, [sx, sz]]);
      setSelectedElement(null);
      setEditingWallIndex(null);
      return;
    }

    // 3) โหมดปากกา -> ลากคลุมช่องตารางเพื่อวาดห้องใหม่ / ต่อเติม (+) / เว้ามุม (-)
    if (activeTool === "pencil" && (penMode === "paint-add" || penMode === "paint-erase")) {
      const gx = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(pt.xCm / GRID_CELL_CM)));
      const gz = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(pt.zCm / GRID_CELL_CM)));
      if (pt.xCm < -25 || pt.xCm > GRID_COLS * GRID_CELL_CM + 25 || pt.zCm < -25 || pt.zCm > GRID_ROWS * GRID_CELL_CM + 25) {
        return;
      }
      const erase = penMode === "paint-erase" || e.altKey || e.button === 2;
      setSelectedElement(null);
      setEditingWallIndex(null);
      setBoxDrag({
        mode: erase ? "erase" : "add",
        startGx: gx,
        startGz: gz,
        curGx: gx,
        curGz: gz,
      });
    }
  };

  // Global Pointer/Mouse Move สำหรับการลากทุกชนิดแบบลื่นไหล ไม่กระตุก
  useEffect(() => {
    if (!boxDrag && !handleDrag && !draggingOpening && !draggingCompass) return;

    const onMouseMove = (e: MouseEvent) => {
      // A. หมุนเข็มทิศแบบละเอียดทีละ 0.1° (0.0° - 359.9°)
      if (draggingCompass) {
        const dialEl = compassDialRef.current;
        if (dialEl) {
          const rect = dialEl.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const angleRad = Math.atan2(e.clientX - cx, -(e.clientY - cy));
          const rawDeg = (((angleRad * 180) / Math.PI) % 360 + 360) % 360;
          setOrientationDeg01(rawDeg);
        }
        return;
      }

      const pt = clientToSvgAndCm(e.clientX, e.clientY);
      if (!pt) return;

      // B. ลากย้ายหน้าต่างหรือประตูไปตามผนังทุกด้านของห้อง
      if (draggingOpening && canvasPolyCm.length >= 3) {
        const curItem =
          draggingOpening.type === "door"
            ? doors.find((d) => d.id === draggingOpening.id)
            : windows.find((w) => w.id === draggingOpening.id);
        const wCm = curItem?.width ?? 80;
        const hit = findClosestWallEdge(canvasPolyCm, pt.xCm, pt.zCm, wCm);
        if (!hit) return;

        if (draggingOpening.type === "door") {
          setDoors((prev) =>
            prev.map((d) =>
              d.id === draggingOpening.id
                ? { ...d, edgeIndex: hit.edgeIndex, wall: hit.wallCardinal, pos: hit.pos }
                : d
            )
          );
        } else {
          setWindows((prev) =>
            prev.map((w) =>
              w.id === draggingOpening.id
                ? { ...w, edgeIndex: hit.edgeIndex, wall: hit.wallCardinal, pos: hit.pos }
                : w
            )
          );
        }
        return;
      }

      // C. ลากคลุมตารางเพื่อวาดห้อง / ต่อเติม / ตัดเว้า
      if (boxDrag) {
        const gx = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(pt.xCm / GRID_CELL_CM)));
        const gz = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(pt.zCm / GRID_CELL_CM)));
        setBoxDrag((prev) => (prev ? { ...prev, curGx: gx, curGz: gz } : null));
        return;
      }

      // D. ลากจุดมุมห้อง (Vertex) หรือขอบผนัง (Wall Edge) ละเอียดทีละ 0.1 เมตร (10 ซม.)
      if (handleDrag) {
        const dxCm = pt.xCm - handleDrag.startMouseCm[0];
        const dzCm = pt.zCm - handleDrag.startMouseCm[1];

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

    const onMouseUp = () => {
      if (boxDrag) {
        const minGx = Math.min(boxDrag.startGx, boxDrag.curGx);
        const maxGx = Math.max(boxDrag.startGx, boxDrag.curGx);
        const minGz = Math.min(boxDrag.startGz, boxDrag.curGz);
        const maxGz = Math.max(boxDrag.startGz, boxDrag.curGz);
        const strokeW = maxGx - minGx + 1;
        const strokeD = maxGz - minGz + 1;

        const baseCells = isBlankCanvas ? new Set<string>() : polygonToCells(canvasPolyCm);
        const strokeCells: string[] = [];
        for (let gz = minGz; gz <= maxGz; gz++) {
          for (let gx = minGx; gx <= maxGx; gx++) {
            strokeCells.push(cellKey(gx, gz));
          }
        }

        if (boxDrag.mode === "add") {
          // ตรวจว่าลากต่อจากห้องเดิม หรือวาดห้องใหม่แยกออกมา
          const touchesExisting =
            !isBlankCanvas &&
            strokeCells.some((k) => {
              if (baseCells.has(k)) return true;
              const [gx, gz] = k.split(",").map(Number);
              return (
                baseCells.has(cellKey(gx + 1, gz)) ||
                baseCells.has(cellKey(gx - 1, gz)) ||
                baseCells.has(cellKey(gx, gz + 1)) ||
                baseCells.has(cellKey(gx, gz - 1))
              );
            });

          if (touchesExisting) {
            // ต่อเติมขยายห้องเดิม (คลิก 1 ช่องขึ้นไปก็ขยายได้ทันที)
            const merged = new Set(baseCells);
            for (const k of strokeCells) merged.add(k);
            const res = cellsToRoomPolygon(merged, strokeCells[0]);
            if (res) commitNewPoly(res.canvasPolyCm);
          } else if (strokeW >= 2 && strokeD >= 2) {
            // วาดห้องใหม่ตรงจุดที่ลาก (ต้องใหญ่ตั้งแต่ 1.0 x 1.0 ม. ขึ้นไปเพื่อกันการเผลอคลิกพลาด)
            const fresh = new Set(strokeCells);
            const res = cellsToRoomPolygon(fresh, strokeCells[0]);
            if (res) commitNewPoly(res.canvasPolyCm);
          }
        } else if (!isBlankCanvas && baseCells.size > 0) {
          // โหมดตัดเว้ามุมห้อง (-)
          const carved = new Set(baseCells);
          for (const k of strokeCells) carved.delete(k);
          if (carved.size >= 4) {
            const res = cellsToRoomPolygon(carved);
            if (res && Math.abs(signedArea(res.canvasPolyCm)) >= 10000) {
              commitNewPoly(res.canvasPolyCm);
            }
          }
        }
      }

      setBoxDrag(null);
      setHandleDrag(null);
      setDraggingOpening(null);
      setDraggingCompass(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    boxDrag,
    handleDrag,
    draggingOpening,
    draggingCompass,
    canvasPolyCm,
    isBlankCanvas,
    doors,
    windows,
    clientToSvgAndCm,
    commitNewPoly,
    reattachOpeningsToPoly,
    setOrientationDeg01,
    editingWallIndex,
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
          return { ...d, edgeIndex: nextEdge, wall: info.wallCardinal, pos: 0.5 };
        })
      );
    } else {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== selectedElement.id) return w;
          const nextEdge = ((w.edgeIndex ?? 0) + 1) % n;
          const info = getEdgeInfo(canvasPolyCm, nextEdge);
          return { ...w, edgeIndex: nextEdge, wall: info.wallCardinal, pos: 0.5 };
        })
      );
    }
  }, [selectedElement, canvasPolyCm]);

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

  const selectedDoor = useMemo(
    () => (selectedElement?.type === "door" ? doors.find((d) => d.id === selectedElement.id) : null),
    [selectedElement, doors]
  );
  const selectedWin = useMemo(
    () => (selectedElement?.type === "window" ? windows.find((w) => w.id === selectedElement.id) : null),
    [selectedElement, windows]
  );

  // พิกัด SVG ของกล่องลากวาด (Box Drag Preview)
  const boxDragPreview = useMemo(() => {
    if (!boxDrag) return null;
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
  }, [boxDrag]);

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
      className={`relative flex flex-col overflow-hidden bg-gradient-to-b from-[#2f76eb] to-[#2563eb] select-none w-full text-white ${
        isFullscreen
          ? "h-full flex-1 rounded-none border-0"
          : "min-h-[600px] lg:h-[calc(100dvh-5.25rem)] rounded-2xl border border-[#1d4ed8] shadow-xl"
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* แถบควบคุมหลักเพียงแถวเดียวด้านบน: เรียบ สะอาด จัดหมวดหมู่เป็นระเบียบ */}
      <div className="relative z-30 flex w-full flex-wrap items-center justify-between gap-2 border-b border-white/15 bg-slate-900/45 px-3.5 py-2 backdrop-blur-md sm:px-5">
        {/* ฝั่งซ้าย: ชื่อหน้า + ขนาดห้องและเพดานในกล่องเดียว */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white">
              <PenTool className="h-3.5 w-3.5" />
            </span>
            <h1 className="font-display text-sm font-bold tracking-wide text-white sm:text-base">
              วาดแปลนห้อง
            </h1>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-950/35 px-3 py-1 text-xs">
            <span className="font-mono font-semibold text-white">
              {isBlankCanvas ? "รอวาดห้อง" : `${widthM} × ${depthM} ม.`}
            </span>
            {!isBlankCanvas && (
              <span className="font-mono font-bold text-amber-300">({areaM2} ตร.ม.)</span>
            )}
            <span className="text-white/25">|</span>
            <label className="flex items-center gap-1" title="พิมพ์ความสูงเพดานละเอียดระดับ 0.1 เมตร (1.8 - 6.0 ม.)">
              <span className="text-blue-100 hidden sm:inline">เพดาน</span>
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
                className="w-11 rounded border border-white/20 bg-white/10 px-1 py-0.5 text-center font-mono text-xs font-bold text-white focus:border-amber-300 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-blue-100">ม.</span>
            </label>
          </div>
        </div>

        {/* ตรงกลาง: แถบเครื่องมือย่อยตามสิ่งที่กำลังทำอยู่ (ไม่ซ้อนหลายบรรทัด) */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {selectedElement ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/25 bg-slate-950/65 px-2.5 py-1 text-white">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 pr-1.5 border-r border-white/15">
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
                          ? "bg-amber-400 text-slate-950 font-bold"
                          : "bg-white/10 hover:bg-white/20"
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
                className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold hover:bg-white/20"
              >
                สลับผนัง
              </button>

              <button
                type="button"
                onClick={duplicateSelected}
                title="คัดลอกเพิ่มอีกบาน"
                className="rounded-md bg-white/10 p-1 hover:bg-white/20 text-white"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                title="ลบออก"
                className="rounded-md bg-rose-500/90 p-1 hover:bg-rose-500 text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedElement(null)}
                title="ยกเลิกการเลือก"
                className="rounded-md bg-white/10 p-1 hover:bg-white/20 text-white/80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : editingWallInfo && editingWallIndex !== null ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-300/60 bg-slate-950/75 px-2.5 py-1 text-white shadow-sm">
              <span className="inline-flex items-center gap-1 border-r border-white/15 pr-2 text-[11px] font-bold text-amber-300">
                <Ruler className="h-3.5 w-3.5" />
                ผนัง #{editingWallIndex + 1} (
                {degToCardinal((editingWallInfo.outwardBaseDeg + sun.orientationDeg) % 360).cardinal}
                )
              </span>

              <button
                type="button"
                onClick={() => nudgeWallLengthMeters(-0.1)}
                title="ลดความยาวผนัง 0.1 เมตร"
                className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-bold hover:bg-white/20"
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
                  className="w-14 rounded-md border border-amber-300/60 bg-slate-900 px-1.5 py-0.5 text-center font-mono text-xs font-bold text-amber-300 focus:border-amber-300 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-[11px] text-slate-300">ม.</span>
              </div>

              <button
                type="button"
                onClick={() => nudgeWallLengthMeters(0.1)}
                title="เพิ่มความยาวผนัง 0.1 เมตร"
                className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-bold hover:bg-white/20"
              >
                +0.1
              </button>

              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(wallLenInput);
                  if (Number.isFinite(val)) applyWallLengthMeters(editingWallIndex, val);
                }}
                className="inline-flex items-center gap-0.5 rounded-md bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-slate-950 hover:bg-amber-300"
              >
                <Check className="h-3 w-3" />
                ตกลง
              </button>

              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(wallLenInput);
                  let baseLen = canvasPolyCm.length;
                  if (Number.isFinite(val)) {
                    applyWallLengthMeters(editingWallIndex, val);
                  }
                  if (baseLen >= 3) {
                    openWallEditor((editingWallIndex + 1) % baseLen);
                  }
                }}
                title="ไปแก้ไขผนังด้านถัดไป"
                className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold hover:bg-white/20"
              >
                ผนังถัดไป ↻
              </button>

              <button
                type="button"
                onClick={() => setEditingWallIndex(null)}
                title="ปิดช่องใส่ตัวเลขผนัง"
                className="rounded-md bg-white/10 p-1 text-white/80 hover:bg-white/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : activeTool === "pencil" ? (
            <>
              <div className="inline-flex items-center gap-0.5 rounded-xl border border-white/15 bg-slate-950/40 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setPenMode("paint-add");
                    setDraftPointsCm([]);
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    penMode === "paint-add"
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  วาดเพิ่ม
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPenMode("paint-erase");
                    setDraftPointsCm([]);
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    penMode === "paint-erase"
                      ? "bg-rose-500 text-white shadow-sm"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  <Minus className="h-3.5 w-3.5" />
                  ตัดเว้า
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPenMode("point-pen");
                    setDraftPointsCm([]);
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    penMode === "point-pen"
                      ? "bg-emerald-400 text-slate-950 shadow-sm"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  <Waypoints className="h-3.5 w-3.5" />
                  วาดเส้น
                </button>
              </div>

              {/* เมนูทรงห้องสำเร็จรูป (รวมไว้ในปุ่มเดียวไม่ให้รกตา) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShapeMenuOpen((v) => !v);
                    setSunPanelOpen(false);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    shapeMenuOpen ? "bg-white text-slate-900" : "bg-slate-950/35 text-white hover:bg-slate-950/55"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>ทรงห้อง</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${shapeMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {shapeMenuOpen && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 w-48 rounded-2xl border border-white/20 bg-slate-900/95 p-1.5 text-xs text-white shadow-2xl backdrop-blur-xl">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                        className="flex w-full items-center rounded-xl px-2.5 py-1.5 text-left font-medium text-slate-100 hover:bg-white/10 transition"
                      >
                        {p.label}
                      </button>
                    ))}
                    <div className="my-1 border-t border-white/10" />
                    <button
                      type="button"
                      onClick={() => {
                        clearCanvasForFreshDraw();
                        setShapeMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left font-semibold text-rose-300 hover:bg-rose-500/20 transition"
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
                  className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-slate-950/35 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-950/55 transition"
                >
                  <Ruler className="h-3.5 w-3.5 text-amber-300" />
                  <span>ใส่ตัวเลขผนัง</span>
                </button>
              )}

              {polyHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndoRoomShape}
                  title="ย้อนกลับรูปทรงห้อง"
                  className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-slate-950/35 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-950/55"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">ย้อนกลับ</span>
                </button>
              )}

              {penMode === "point-pen" && draftPointsCm.length >= 3 && (
                <button
                  type="button"
                  onClick={() => finishPointPenPolygon(draftPointsCm)}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-2.5 py-1.5 text-[11px] font-bold text-white shadow hover:bg-emerald-400"
                >
                  <Check className="h-3.5 w-3.5" />
                  เชื่อมปิดห้อง ({draftPointsCm.length})
                </button>
              )}
            </>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-slate-950/45 px-3 py-1 text-[11px] font-medium text-blue-100">
              {activeTool === "window" ? (
                <>
                  <WindowPaneIcon className="h-3.5 w-3.5 text-rose-300 shrink-0" />
                  <span>คลิกบนเส้นผนังเพื่อวางหน้าต่าง หรือลากบานสีแดงเพื่อย้าย</span>
                </>
              ) : (
                <>
                  <DoorClosed className="h-3.5 w-3.5 text-sky-300 shrink-0" />
                  <span>คลิกบนเส้นผนังเพื่อวางประตู หรือลากบานสีฟ้าเพื่อย้าย</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ฝั่งขวา: ปุ่มทิศและแสงแดด (Popover) + เปิดเต็มจอ + เข้าห้อง 3D */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSunPanelOpen((v) => !v);
                setShapeMenuOpen(false);
              }}
              title="ตั้งค่าทิศห้อง เวลาแสงแดด และอุณหภูมิ"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-semibold transition ${
                sunPanelOpen
                  ? "border-amber-300 bg-amber-400 text-slate-950 shadow-sm"
                  : "border-white/20 bg-slate-950/35 text-white hover:bg-slate-950/55"
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span className="font-mono">
                {degToCardinal(sun.orientationDeg).cardinal} {Number(sun.orientationDeg.toFixed(1))}°
              </span>
              <span className="opacity-40">·</span>
              <Sun className="h-3.5 w-3.5 text-amber-300" />
              <span className="font-mono">{formattedTime}</span>
              <span className="hidden sm:inline opacity-40">·</span>
              <span className="hidden sm:inline font-mono">{sunlightAdvice.roomTempC}°C</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sunPanelOpen ? "rotate-180" : ""}`} />
            </button>

            {/* กล่องตั้งค่าทิศ แสงแดด และอุณหภูมิแบบลอย (เปิดเมื่อกดใช้ ไม่รกหน้าจอ) */}
            {sunPanelOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-[310px] sm:w-[356px] space-y-3 rounded-2xl border border-white/20 bg-slate-900/95 p-4 text-xs text-white shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-bold text-sm text-white">ทิศห้อง แสงแดด & อุณหภูมิ</span>
                  <button
                    type="button"
                    onClick={() => setSunPanelOpen(false)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* 1. ทิศห้อง (ละเอียดระดับ 0.1°) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">ผนังด้านบนหันทิศ</span>
                    <span className="font-mono font-bold text-amber-300">
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
                            ? "bg-amber-400 text-slate-950 font-bold"
                            : "bg-white/10 text-slate-200 hover:bg-white/20"
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
                    className="w-full accent-amber-400"
                  />
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] text-slate-400">พิมพ์องศาละเอียด (0.1°)</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setOrientationDeg01(sun.orientationDeg - 0.1)}
                        className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] font-bold hover:bg-white/20"
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
                        className="w-16 rounded-md border border-white/20 bg-slate-950 px-1.5 py-0.5 text-center font-mono text-xs font-bold text-amber-300 focus:border-amber-300 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setOrientationDeg01(sun.orientationDeg + 0.1)}
                        className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] font-bold hover:bg-white/20"
                      >
                        +0.1°
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. เวลาแสงเข้า */}
                <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">ช่วงเวลาแสงแดด</span>
                    <span className="font-mono font-bold text-amber-300">{formattedTime} น.</span>
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
                            ? "bg-amber-400 text-slate-950 font-bold"
                            : "bg-white/10 text-slate-200 hover:bg-white/20"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. โทนแสง & อุณหภูมิ */}
                <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">โทนสีแสง (Kelvin)</span>
                    <span className="font-mono font-bold text-sky-300">{sun.colorTempK}K</span>
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
                    className="w-full accent-sky-400"
                  />

                  <div className="rounded-xl bg-white/5 p-2.5 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        <Thermometer className="h-3.5 w-3.5 text-amber-300" />
                        อุณหภูมิห้องโดยประมาณ
                      </span>
                      <span className="font-mono font-bold text-emerald-300">
                        ~{sunlightAdvice.roomTempC}°C (นอก {sunlightAdvice.outdoorTempC}°C)
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-200/90 leading-snug">
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-slate-950/35 px-3 py-1.5 font-semibold text-white hover:bg-slate-950/55 transition"
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
          )}

          <button
            type="button"
            disabled={isBlankCanvas}
            onClick={onProceedTo3D}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 font-bold text-white shadow-sm hover:bg-emerald-400 transition disabled:opacity-40"
          >
            <span>จัดห้อง 3D</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* พื้นที่กระดาษแปลนห้องหลัก */}
      <div className="relative flex flex-1 min-h-0 w-full items-center justify-center overflow-hidden">
        {/* แถบเครื่องมือหลักฝั่งซ้าย 5 ปุ่ม (เรียบสะอาด ใช้งานง่าย) */}
        <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 rounded-2xl border border-white/20 bg-slate-900/45 p-2 shadow-xl backdrop-blur-md">
          {/* 1. ปุ่ม X (รีเซ็ตค่าเริ่มต้น) */}
          <button
            type="button"
            onClick={onCancel || resetBlueprint}
            title="รีเซ็ตแปลนห้องใหม่"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-800 shadow transition-colors hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>

          {/* 2. ปุ่มปากกาวาดตัวห้อง */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("pencil");
              setSelectedElement(null);
            }}
            title="ปากกาวาดตัวห้อง / ปรับขนาดผนัง"
            className={`flex h-10 w-10 items-center justify-center rounded-full shadow transition-colors ${
              activeTool === "pencil"
                ? "bg-slate-950 text-amber-300 ring-2 ring-amber-300"
                : "bg-white text-slate-800 hover:bg-slate-100"
            }`}
          >
            <PenTool className="h-4 w-4" />
          </button>

          {/* 3. ปุ่มหน้าต่าง */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("window");
              setDraftPointsCm([]);
              setSelectedElement(null);
            }}
            title="วางและขยับหน้าต่าง"
            className={`flex h-10 w-10 items-center justify-center rounded-full shadow transition-colors ${
              activeTool === "window"
                ? "bg-rose-500 text-white ring-2 ring-rose-200"
                : "bg-white text-slate-800 hover:bg-slate-100"
            }`}
          >
            <WindowPaneIcon className="h-4 w-4" />
          </button>

          {/* 4. ปุ่มประตู */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("door");
              setDraftPointsCm([]);
              setSelectedElement(null);
            }}
            title="วางและขยับประตู"
            className={`flex h-10 w-10 items-center justify-center rounded-full shadow transition-colors ${
              activeTool === "door"
                ? "bg-sky-400 text-slate-950 ring-2 ring-sky-200"
                : "bg-white text-slate-800 hover:bg-slate-100"
            }`}
          >
            <DoorClosed className="h-4 w-4" />
          </button>

          {/* 5. ปุ่มไปต่อ (เข้าสู่ห้อง 3D) */}
          <button
            type="button"
            disabled={isBlankCanvas}
            onClick={onProceedTo3D}
            title="เข้าสู่ห้อง 3D"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow transition-colors hover:bg-emerald-400 disabled:opacity-40"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* เข็มทิศแบบหมุนได้ 0.1° + ช่องพิมพ์ตัวเลขด้านล่างเข็มทิศโดยตรง (มุมขวาบน) */}
        <div
          className="absolute right-3 sm:right-4 top-3 z-20 flex flex-col items-center rounded-2xl border border-white/20 bg-slate-900/65 px-2 py-2 shadow-xl backdrop-blur-md"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg
            ref={compassDialRef}
            viewBox="0 0 80 80"
            className="h-[68px] w-[68px] cursor-grab active:cursor-grabbing select-none"
            onMouseDown={(e) => {
              e.stopPropagation();
              setDraggingCompass(true);
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

          <span className="mt-0.5 font-mono text-[10px] font-bold text-amber-300">
            ทิศ {degToCardinal(sun.orientationDeg).cardinal}
          </span>

          {/* ช่องเขียนตัวเลขด้านล่างเข็มทิศ ปรับละเอียดทีละ 0.1° */}
          <div
            className="mt-1 flex items-center gap-0.5 rounded-lg border border-white/20 bg-slate-950/80 px-1 py-0.5"
            title="หมุนเข็มทิศด้านบน หรือพิมพ์ตัวเลของศาละเอียด 0.1° ลงในช่องนี้ได้ทันที"
          >
            <button
              type="button"
              onClick={() => setOrientationDeg01(sun.orientationDeg - 0.1)}
              className="flex h-5 w-4 items-center justify-center rounded text-[11px] font-bold text-slate-300 hover:bg-white/15 hover:text-white"
              aria-label="ลดมุมเข็มทิศ 0.1 องศา"
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
              className="w-11 bg-transparent text-center font-mono text-[11px] font-bold text-white focus:text-amber-300 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="font-mono text-[10px] text-white/75">°</span>
            <button
              type="button"
              onClick={() => setOrientationDeg01(sun.orientationDeg + 0.1)}
              className="flex h-5 w-4 items-center justify-center rounded text-[11px] font-bold text-slate-300 hover:bg-white/15 hover:text-white"
              aria-label="เพิ่มมุมเข็มทิศ 0.1 องศา"
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
            } else if (draftPointsCm.length > 0) {
              setDraftPointsCm((prev) => prev.slice(0, -1));
            } else {
              clearCanvasForFreshDraw();
            }
          }}
          title={
            selectedElement
              ? "ลบประตู/หน้าต่างที่เลือก"
              : "ล้างผนังห้องเพื่อวาดห้องใหม่"
          }
          className="absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-lg hover:bg-rose-50 hover:text-rose-600 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {/* กระดาษพิมพ์เขียว SVG (สเกลคงที่ 1 ช่อง = 0.50 ม. ไม่สั่น ไม่เด้ง รองรับเต็มจอทุกความละเอียด) */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className={`w-full cursor-crosshair touch-none ${
            isFullscreen ? "h-full max-h-full" : "h-full min-h-[360px]"
          }`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={(e) => {
            const pt = clientToSvgAndCm(e.clientX, e.clientY);
            if (pt) setCursorCm([pt.xCm, pt.zCm]);
          }}
          onMouseLeave={() => setCursorCm(null)}
          onDoubleClick={() => {
            if (activeTool === "pencil" && penMode === "point-pen" && draftPointsCm.length >= 3) {
              finishPointPenPolygon(draftPointsCm);
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

          {/* เงาตัวอย่างหน้าต่าง/ประตูก่อนคลิกวาง */}
          {openingPreview && !isBlankCanvas && (
            <g pointerEvents="none" opacity={0.7}>
              {(() => {
                const info = getEdgeInfo(canvasPolyCm, openingPreview.edgeIndex);
                const halfW = Math.min(openingPreview.widthCm / 2, info.lengthCm * 0.42);
                const cxCm = info.x1 + info.ex * info.lengthCm * openingPreview.pos;
                const czCm = info.z1 + info.ez * info.lengthCm * openingPreview.pos;
                const [x1, y1] = cmToSvg(cxCm - info.ex * halfW, czCm - info.ez * halfW);
                const [x2, y2] = cmToSvg(cxCm + info.ex * halfW, czCm + info.ez * halfW);
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
              const idx =
                w.edgeIndex !== undefined && w.edgeIndex < canvasPolyCm.length ? w.edgeIndex : 0;
              const info = getEdgeInfo(canvasPolyCm, idx);
              const halfW = Math.min(w.width / 2, info.lengthCm * 0.44);
              const cxCm = info.x1 + info.ex * info.lengthCm * w.pos;
              const czCm = info.z1 + info.ez * info.lengthCm * w.pos;
              const [x1, y1] = cmToSvg(cxCm - info.ex * halfW, czCm - info.ez * halfW);
              const [x2, y2] = cmToSvg(cxCm + info.ex * halfW, czCm + info.ez * halfW);
              const isSelected = selectedElement?.type === "window" && selectedElement.id === w.id;
              const isHovered = hoveredHandle === `win-${w.id}`;

              return (
                <g
                  key={w.id}
                  className="cursor-grab active:cursor-grabbing"
                  onMouseEnter={() => setHoveredHandle(`win-${w.id}`)}
                  onMouseLeave={() => setHoveredHandle(null)}
                  onMouseDown={(e) => {
                    e.stopPropagation();
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

          {/* ประตูทั้งหมดบนผนัง (ลากย้ายตำแหน่งไปตามผนังได้ทุกบาน) */}
          {!isBlankCanvas &&
            canvasPolyCm.length >= 3 &&
            doors.map((d) => {
              const idx =
                d.edgeIndex !== undefined && d.edgeIndex < canvasPolyCm.length ? d.edgeIndex : 0;
              const info = getEdgeInfo(canvasPolyCm, idx);
              const halfW = Math.min(d.width / 2, info.lengthCm * 0.44);
              const cxCm = info.x1 + info.ex * info.lengthCm * d.pos;
              const czCm = info.z1 + info.ez * info.lengthCm * d.pos;
              const [x1, y1] = cmToSvg(cxCm - info.ex * halfW, czCm - info.ez * halfW);
              const [x2, y2] = cmToSvg(cxCm + info.ex * halfW, czCm + info.ez * halfW);
              const isSelected = selectedElement?.type === "door" && selectedElement.id === d.id;
              const isHovered = hoveredHandle === `door-${d.id}`;

              return (
                <g
                  key={d.id}
                  className="cursor-grab active:cursor-grabbing"
                  onMouseEnter={() => setHoveredHandle(`door-${d.id}`)}
                  onMouseLeave={() => setHoveredHandle(null)}
                  onMouseDown={(e) => {
                    e.stopPropagation();
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

          {/* จุดดึงขอบผนัง (สีฟ้า) และจุดดึงมุมห้อง (สีส้ม) — ไม่มี CSS scale จึงนิ่งสนิท 100% ไม่สั่น! */}
          {activeTool === "pencil" &&
            penMode !== "point-pen" &&
            !isBlankCanvas &&
            !boxDrag &&
            canvasPolyCm.length >= 3 && (
              <g>
                {/* จุดสีฟ้าบนผนังแต่ละด้าน (หลบตำแหน่งประตู/หน้าต่างอัตโนมัติ ไม่ทับซ้อนกัน) */}
                {canvasPolyCm.map((_, i) => {
                  const info = getEdgeInfo(canvasPolyCm, i);
                  if (info.lengthCm < 80) return null;

                  let handleT = 0.5;
                  const edgeOpenings = [
                    ...windows.filter((w) => (w.edgeIndex ?? 0) === i),
                    ...doors.filter((d) => (d.edgeIndex ?? 0) === i),
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
                      className={isHoriz ? "cursor-ns-resize" : "cursor-ew-resize"}
                      onMouseEnter={() => setHoveredHandle(hid)}
                      onMouseLeave={() => setHoveredHandle(null)}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const pt = clientToSvgAndCm(e.clientX, e.clientY);
                        if (!pt) return;
                        setPolyHistory((h) => [...h.slice(-19), canvasPolyCm]);
                        setHandleDrag({
                          kind: "edge",
                          index: i,
                          startMouseCm: [pt.xCm, pt.zCm],
                          basePoly: canvasPolyCm.map((p) => [p[0], p[1]]),
                        });
                      }}
                    >
                      {/* วงรับเมาส์โปร่งใสขนาดใหญ่ 18px */}
                      <circle cx={mx} cy={my} r={18} fill="transparent" />
                      {isHov && (
                        <circle
                          cx={mx}
                          cy={my}
                          r={12}
                          fill="rgba(56, 189, 248, 0.35)"
                          pointerEvents="none"
                        />
                      )}
                      <circle
                        cx={mx}
                        cy={my}
                        r={isHov ? 8 : 6.5}
                        fill="#38bdf8"
                        stroke="#ffffff"
                        strokeWidth={2.5}
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}

                {/* จุดสีส้มที่มุมห้องทุกมุม (ลากปรับมุมห้องได้โดยไม่กระพริบ/ไม่เด้งหนีเมาส์) */}
                {canvasPolyCm.map(([vxCm, vzCm], i) => {
                  const [vx, vy] = cmToSvg(vxCm, vzCm);
                  const hid = `vert-${i}`;
                  const isHov = hoveredHandle === hid;

                  return (
                    <g
                      key={hid}
                      className="cursor-move"
                      onMouseEnter={() => setHoveredHandle(hid)}
                      onMouseLeave={() => setHoveredHandle(null)}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const pt = clientToSvgAndCm(e.clientX, e.clientY);
                        if (!pt) return;
                        setPolyHistory((h) => [...h.slice(-19), canvasPolyCm]);
                        setHandleDrag({
                          kind: "vertex",
                          index: i,
                          startMouseCm: [pt.xCm, pt.zCm],
                          basePoly: canvasPolyCm.map((p) => [p[0], p[1]]),
                        });
                      }}
                    >
                      <circle cx={vx} cy={vy} r={20} fill="transparent" />
                      {isHov && (
                        <circle
                          cx={vx}
                          cy={vy}
                          r={14}
                          fill="rgba(245, 158, 11, 0.38)"
                          pointerEvents="none"
                        />
                      )}
                      <circle
                        cx={vx}
                        cy={vy}
                        r={isHov ? 9.5 : 8}
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth={2.8}
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}
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
                x={boxDragPreview.x + boxDragPreview.wPx / 2 - 76}
                y={boxDragPreview.y + boxDragPreview.hPx / 2 - 13}
                width={152}
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
                className="font-mono text-xs font-bold"
              >
                {boxDragPreview.mode === "erase" ? "ตัดออก " : ""}
                {boxDragPreview.wM}×{boxDragPreview.dM}m ({boxDragPreview.aM2}ตร.ม.)
              </text>
            </g>
          )}

          {/* เส้นกำลังวาดในโหมดคลิกจุดต่อจุด (Point-to-Point Wall Pen) */}
          {activeTool === "pencil" && penMode === "point-pen" && draftPointsCm.length > 0 && (
            <g pointerEvents="none">
              <polyline
                points={draftPointsCm.map(([x, z]) => cmToSvg(x, z).join(",")).join(" ")}
                fill="none"
                stroke="#fde047"
                strokeWidth={8}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {cursorCm && (() => {
                const last = draftPointsCm[draftPointsCm.length - 1];
                const sxCm = Math.round(cursorCm[0] / 10) * 10;
                const szCm = Math.round(cursorCm[1] / 10) * 10;
                const [x1, y1] = cmToSvg(last[0], last[1]);
                const [x2, y2] = cmToSvg(sxCm, szCm);
                const distM = (Math.hypot(sxCm - last[0], szCm - last[1]) / 100).toFixed(2);
                return (
                  <g>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#ffffff"
                      strokeWidth={4}
                      strokeDasharray="8 6"
                    />
                    <rect x={(x1 + x2) / 2 - 28} y={(y1 + y2) / 2 - 11} width={56} height={20} rx={5} fill="rgba(15,23,42,0.88)" />
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fde047"
                      className="font-mono text-[11px] font-bold"
                    >
                      {distM}m
                    </text>
                  </g>
                );
              })()}
              {draftPointsCm.map(([px, pz], idx) => {
                const [sx, sy] = cmToSvg(px, pz);
                const isFirst = idx === 0 && draftPointsCm.length >= 3;
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
