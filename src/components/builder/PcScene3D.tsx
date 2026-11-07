"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Spinner from "../Spinner";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Armchair, Camera, Gamepad2, Power, Volume2, VolumeX, AlertTriangle, ArrowDownToLine, ArrowUpToLine, CheckCircle2, Expand, Fan, Hammer, Lightbulb, Monitor, MoreHorizontal, Pause, Play, PanelRightOpen, PanelRightClose, Ruler, Shrink, Wind, X } from "lucide-react";
import type { MonitorSpec, PcPart } from "@/lib/builder/types";
import { caseFootprint, type CasePlacement } from "@/lib/builder/desk";
import { buildDeskModel, deskLayout } from "./desk-model";
import { buildRoom, type RoomScene } from "./room-scene";
import { createScreenSim, type ScreenGame } from "./screen-sim";
import { createPcSound, type PcSound } from "./pc-sound";
import { formatTHB } from "@/lib/format";
import { CASE_SIZE_META, getCaseDimensions, getCaseScale, getCaseSizeClass, getCaseVolumeLiters } from "@/lib/builder/case-sizes";
import {
  airflowSummary,
  buildPcModel,
  checkFit,
  defaultMounts,
  MODEL_BOX,
  MODEL_FLOOR_Y,
  MODEL_SCALE as MODEL_SCALE_UNIT,
  MOUNT_IDS,
  MOUNTS,
  mountCaps,
  mountSlack,
  normalizeMounts,
  PART_LIFT,
  sanitizeMounts,
  pcLayout,
  radFanSize,
  type MountConfig,
  type MountId,
  type MountSetting,
} from "./pc-model";

/** เงาสัมผัสพื้นแบบนุ่ม (ไม่ต้องคำนวณเงาจริง) */
function contactShadow(w: number, d: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** พื้นสตูดิโอ: วงกลมเทาอ่อนจางขอบ ทำให้ของดูวางอยู่บนพื้นจริง ไม่ลอยกลางอากาศ */
function studioFloor(size: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(120,130,145,0.20)");
  grad.addColorStop(0.6, "rgba(120,130,145,0.09)");
  grad.addColorStop(1, "rgba(120,130,145,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 64), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}

/** ตำแหน่งกึ่งกลางของแต่ละชิ้นตอน "แยกทั้งหมด" (พิกัดโมเดล) — วางเรียงข้างเคส ไม่ซ้อนกับตัวเคส */
const EXPLODE_LAYOUT: Record<string, [number, number, number]> = {
  cooler: [-2.3, 3.85, 1.2],
  motherboard: [-2.3, 1.95, 1.0],
  gpu: [-2.3, 0.45, 1.4],
  cpu: [-0.1, 3.85, 1.6],
  ram: [-0.1, 2.8, 1.6],
  storage: [-0.1, 1.85, 1.6],
  psu: [-0.1, 0.45, 1.6],
};
/** เคส (และพัดลมเคส) ถอยไปทางขวา-หลัง ไม่ซ้อนกับชิ้นส่วน */
const EXPLODE_CASE: [number, number, number] = [3.2, 0, -0.9];
/** "แยกชิ้น" ขั้นแรก: เคสถอยไปข้างหลัง ชิ้นส่วนลอยออกมาด้านหน้า ไม่ซ้อนกับเคส */
const LEVEL1_CASE: [number, number, number] = [0.9, 0, -1.9];

/** ลำดับตอนโชว์ "ประกอบ" ทีละชิ้น */
/** โหมดสอนประกอบ: ทีละขั้นตามลำดับที่ช่างประกอบจริง */
const GUIDE: Array<{ key: string; title: string; tip: string }> = [
  { key: "case", title: "เตรียมเคส", tip: "ถอดกระจกข้างวางบนผ้านุ่ม ดูว่าหมุดรองเมนบอร์ด (standoff) ตรงขนาดบอร์ด เตรียมน็อตแยกถุงไว้" },
  { key: "psu", title: "ใส่พาวเวอร์ซัพพลาย", tip: "ใส่ใต้ฝาครอบ PSU หันพัดลมลงพื้น (เคสมีช่องลมล่าง) ขันน็อต 4 ตัวด้านหลัง ถ้าเป็นแบบถอดสายได้ ต่อสายที่จะใช้ไว้ก่อน" },
  { key: "motherboard", title: "ติดตั้งเมนบอร์ด", tip: "จัดพอร์ตหลังให้ตรงช่อง วางลงบนหมุดรอง ขันน็อตแบบทแยงมุม แน่นพอดี ไม่ต้องแรง" },
  { key: "cpu", title: "ใส่ซีพียู", tip: "ยกก้านล็อก วางซีพียูให้สามเหลี่ยมที่มุมตรงกับซ็อกเก็ต ห้ามกดหรือเลื่อน แล้วกดก้านล็อกลง (ฝาพลาสติกจะหลุดเอง)" },
  { key: "cooler", title: "ติดชุดระบายความร้อน", tip: "ทาซิลิโคนเม็ดเท่าเมล็ดถั่วกลางซีพียู (ถ้าชุดยังไม่ได้ทามา) ชุดน้ำ: ยึดหม้อน้ำก่อนแล้ววางปั๊ม ขันน็อตทแยงมุมทีละนิด" },
  { key: "ram", title: "ใส่แรม", tip: "ใส่ช่อง A2/B2 (ช่องที่ 2 และ 4 นับจากซีพียู) ร่องบากต้องตรง กดลงจนตัวล็อกดังคลิกทั้งสองฝั่ง" },
  { key: "storage", title: "ใส่ SSD M.2", tip: "ถอดฮีตซิงก์ M.2 ลอกฟิล์มที่แผ่นซับความร้อน เสียบ SSD เฉียง ~30° แล้วกดลงล็อก ปิดฮีตซิงก์กลับ" },
  { key: "gpu", title: "ใส่การ์ดจอ", tip: "ถอดฝาช่อง PCIe ด้านหลัง 2–3 ช่อง เสียบช่อง x16 บนสุดจนคลิก ขันน็อตยึด ต่อสายไฟให้สุด (12VHPWR ต้องไม่เหลือร่อง)" },
  { key: "cables", title: "ต่อสายไฟ", tip: "24-pin เมนบอร์ด, 8-pin ซีพียู, สายพัดลม/ปั๊มเข้า CPU_FAN/AIO_PUMP, สายหน้าเคส (ปุ่มเปิด, USB, เสียง) เก็บสายหลังถาด" },
  { key: "glass", title: "ปิดฝา + เปิดเครื่องครั้งแรก", tip: "ปิดกระจก เปิดเครื่องเข้า BIOS เช็กว่าเห็นแรม/SSD ครบ เปิด EXPO/XMP ให้แรมได้ความเร็วเต็ม แล้วลง Windows" },
];
const guideIndex = (key: string) => (key === "fans" ? 0 : key === "sideglass" ? GUIDE.length - 1 : GUIDE.findIndex((g) => g.key === key));
export const SLOT_LABEL_TH: Record<string, string> = {
  cpu: "ซีพียู",
  motherboard: "เมนบอร์ด",
  storage: "SSD",
  cooler: "ระบายความร้อน",
  ram: "แรม",
  gpu: "การ์ดจอ",
  psu: "พาวเวอร์ซัพพลาย",
  case: "เคส",
};
export type RgbMode = "static" | "breath" | "rainbow";
export type FanModelStyle = "sl_infinity" | "dual_ring" | "argb" | "stealth";

export interface PcSceneProps {
  build: {
    cpu?: PcPart | null;
    gpu?: PcPart | null;
    motherboard?: PcPart | null;
    ram?: PcPart | null;
    storage?: PcPart | null;
    cooler?: PcPart | null;
    psu?: PcPart | null;
    case?: PcPart | null;
    /** จอที่เลือก (ใช้ขนาดจอบนโต๊ะ) */
    monitor?: MonitorSpec | null;
  };
  ramQty?: number;
  /** จำนวนการ์ดจอ (ตามช่อง PCIe ของบอร์ด) */
  gpuQty?: number;
  /** จุดยึดพัดลม/หม้อน้ำ (เก็บไว้ในลิงก์แชร์) */
  mountConfig?: MountConfig | null;
  onMountsChange?: (m: MountConfig) => void;
  storageQty?: number;
  hddCount?: number;
  sataSsdCount?: number;
  rgbColor?: string;
  compactStage?: boolean;
  fanModel?: FanModelStyle;
  onFanModelChange?: (model: FanModelStyle) => void;
  /** ชิ้นที่เลือก/ชี้อยู่ (ไฮไลต์ในฉาก) */
  selectedSlot?: string | null;
  /** กด "เปลี่ยนชิ้นนี้" */
  onPickSlot?: (slot: string) => void;
  /** ชื่อสินค้าของแต่ละช่อง ไว้แสดงตอนชี้ */
  labels?: Record<string, string>;
  /** FPS ประมาณการรายเกม (โชว์บนจอในฉากตอนเปิดเครื่อง) */
  games?: ScreenGame[];
}

/** ถ่ายรูปฉาก + ลายน้ำ แล้วแชร์ (มือถือ) หรือดาวน์โหลด */
function saveSnapshot(src: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext("2d");
  if (!g) return;
  const bg = g.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, "#0b1020");
  bg.addColorStop(1, "#1e1b4b");
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0);
  const fs = Math.max(14, Math.round(c.width / 42));
  g.font = `bold ${fs}px sans-serif`;
  g.textAlign = "right";
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.fillText("ComproNext · จัดสเปกคอม 3D", c.width - fs + 2, c.height - fs + 2);
  g.fillStyle = "#ffffff";
  g.fillText("ComproNext · จัดสเปกคอม 3D", c.width - fs, c.height - fs);
  // toDataURL (ทำทันที) แทน toBlob — บางเครื่อง toBlob ช้ามากตอนฉาก 3D กำลังวาด
  // แปลงเองแทน fetch(data:) เพราะ CSP connect-src ไม่อนุญาต data:
  const bin = atob(c.toDataURL("image/png").split(",")[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });
  void (async () => {
    const file = new File([blob], "compronext-setup.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    // มือถือ → แชร์ตรงไปแอป · คอม → ดาวน์โหลด
    if (window.matchMedia("(pointer: coarse)").matches && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: "คอมเซ็ตของฉัน · ComproNext" });
        return;
      } catch {
        /* ผู้ใช้ยกเลิก → ดาวน์โหลดแทน */
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "compronext-setup.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  })();
}

type SubInfo = { key: string; label: string };
const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export function PcScene3D({
  build,
  ramQty = 2,
  gpuQty = 1,
  mountConfig = null,
  onMountsChange,
  storageQty = 2,
  hddCount = 0,
  sataSsdCount = 0,
  rgbColor: propRgbColor,
  compactStage = false,
  fanModel: propFanModel = "sl_infinity",
  onFanModelChange,
  selectedSlot = null,
  onPickSlot,
  labels = {},
  games = [],
}: PcSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [rgbColor, setRgbColor] = useState<string>(propRgbColor ?? "#38bdf8");
  const [glassOpen, setGlassOpen] = useState<boolean>(false);
  const [moreTools, setMoreTools] = useState(false);
  const [touched, setTouched] = useState(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(
    () => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [sceneReady, setSceneReady] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showLightPanel, setShowLightPanel] = useState<boolean>(false);
  /** 0 = ประกอบอยู่, 1 = แยกชิ้นหลัก, 2 = แยกทั้งหมด (ทุกชิ้นย่อย) */
  const [explodeLevel, setExplodeLevel] = useState<0 | 1 | 2>(0);
  const [rgbMode, setRgbMode] = useState<RgbMode>("rainbow");
  /** เปิด/ปิดเครื่อง (เปิด = บูตใหม่ + เกมเดโมบนจอ) */
  const [powerOn, setPowerOn] = useState(true);
  const [gameIdx, setGameIdx] = useState(0);
  /** มุมมองนั่งเก้าอี้หน้าจอ */
  const [seatView, setSeatView] = useState(false);
  const seatRef = useRef(false);
  /** เสียงพัดลม/บูต (จำค่าไว้ในเครื่อง) */
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return typeof window === "undefined" || window.localStorage.getItem("cn_pc_sound") !== "0";
    } catch {
      return true;
    }
  });
  const soundRef = useRef<PcSound | null>(null);
  const snapRef = useRef(false);
  useEffect(() => {
    soundRef.current?.setMuted(!soundOn);
    try {
      window.localStorage.setItem("cn_pc_sound", soundOn ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [soundOn]);
  useEffect(() => () => soundRef.current?.dispose(), []);
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  /** โหมดสอนประกอบ: ขั้นปัจจุบัน (null = ปิด) + เล่นอัตโนมัติ */
  const [guideStep, setGuideStep] = useState<number | null>(null);
  const [guideAuto, setGuideAuto] = useState(false);
  /** ชิ้นที่ยกขึ้นมาดู (กดในฉาก) + รายชื่อชิ้นย่อย */
  const [lifted, setLifted] = useState<string | null>(null);
  const [subLabels, setSubLabels] = useState<SubInfo[]>([]);
  const liftedRef = useRef<string | null>(null);
  /** โหมดเลือกจุดยึดพัดลม/หม้อน้ำ */
  const [mountMode, setMountMode] = useState(false);
  const [activeMount, setActiveMount] = useState<MountId | null>(null);
  const [showAirflow, setShowAirflow] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  /** คุณภาพสูง = เงาจริง (ค่าเริ่มต้น: คอมเปิด มือถือปิด) */
  const [hq, setHq] = useState(() => typeof window !== "undefined" && !window.matchMedia("(max-width: 767px)").matches);
  const [mounts, setMounts] = useState<MountConfig>(() => {
    const m = sanitizeMounts(mountConfig);
    return m ? normalizeMounts(build, m, gpuQty) : defaultMounts(build, gpuQty);
  });
  const onMountsRef = useRef(onMountsChange);
  useEffect(() => {
    onMountsRef.current = onMountsChange;
  });
  useEffect(() => {
    onMountsRef.current?.(mounts);
  }, [mounts]);
  const [fanModel, setFanModel] = useState<FanModelStyle>(propFanModel);
  /** โต๊ะคอมเทียบขนาด (ค่าเริ่มต้น: เปิด, เคสตั้งบนโต๊ะ) */
  const [showDesk, setShowDesk] = useState(true);
  const [placement, setPlacement] = useState<CasePlacement>("desk");

  // ค่าที่เปลี่ยนบ่อย เก็บใน ref → ฉากไม่ต้องสร้างใหม่ (ลื่นกว่า)
  const explodeRef = useRef(0);
  const glassOpenRef = useRef(false);
  const rgbModeRef = useRef<RgbMode>("rainbow");
  const powerRef = useRef(true);
  const powerAtRef = useRef(-1); // เวลาที่กดเปิด (วินาที performance) · -1 = ให้ลูปตั้งเอง
  const screenInfoRef = useRef<{ parts: string[]; game: ScreenGame | null }>({ parts: [], game: null });
  const rgbColorRef = useRef(new THREE.Color(propRgbColor ?? "#38bdf8"));
  const selectedRef = useRef<string | null>(selectedSlot);
  const hoverRef = useRef<string | null>(null);
  const guideRef = useRef<number | null>(null);
  const guideStartRef = useRef(0);
  const lowFpsRef = useRef<() => void>(() => {});
  const mountModeRef = useRef(false);
  const activeMountRef = useRef<MountId | null>(null);
  const airflowRef = useRef(false);
  const deskOnRef = useRef(true);
  const placementRef = useRef<CasePlacement>("desk");
  const subsInfoRef = useRef(new Map<string, SubInfo[]>());
  const camSaveRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  useEffect(() => {
    explodeRef.current = explodeLevel;
    if (guideRef.current !== guideStep) {
      guideRef.current = guideStep;
      guideStartRef.current = -1; // ลูปแอนิเมชันตั้งเวลาเริ่มขั้นเอง
    }
    glassOpenRef.current = glassOpen;
    rgbModeRef.current = rgbMode;
    seatRef.current = seatView;
    if (powerRef.current !== powerOn) {
      powerRef.current = powerOn;
      if (powerOn) powerAtRef.current = -1;
    }
    screenInfoRef.current = {
      parts: Object.entries(labels)
        .filter(([, n]) => n)
        .map(([slot, n]) => `${SLOT_LABEL_TH[slot] ?? slot}: ${n}`),
      game: games.length ? games[gameIdx % games.length] : null,
    };
    rgbColorRef.current.set(rgbColor);
    selectedRef.current = selectedSlot;
    mountModeRef.current = mountMode;
    activeMountRef.current = activeMount;
    airflowRef.current = showAirflow;
    deskOnRef.current = showDesk;
    placementRef.current = placement;
  });
  const controlsRef = useRef<OrbitControls | null>(null);
  const autoRotateRef = useRef(autoRotate);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  const caseSize = getCaseSizeClass(build.case);
  const caseDims = getCaseDimensions(build.case);
  const footprint = caseFootprint(caseDims);
  const layout = pcLayout(build);
  const isAio = layout.coolerType === "aio";

  // ซิงก์ค่าจาก props / เปลี่ยนชิ้นที่มีผลกับจุดยึด (ปรับ state ระหว่าง render แทน useEffect)
  const fitKey = [build.case?.id, build.cooler?.id, build.gpu?.id, build.motherboard?.id, gpuQty].join("|");
  const [prev, setPrev] = useState({ propRgbColor, propFanModel, fitKey });
  if (prev.propRgbColor !== propRgbColor || prev.propFanModel !== propFanModel || prev.fitKey !== fitKey) {
    setPrev({ propRgbColor, propFanModel, fitKey });
    if (propRgbColor && propRgbColor !== prev.propRgbColor) setRgbColor(propRgbColor);
    if (propFanModel && propFanModel !== prev.propFanModel) setFanModel(propFanModel);
    if (fitKey !== prev.fitKey) setMounts((m) => normalizeMounts(build, m, gpuQty));
  }

  const issues = useMemo(() => checkFit(build, mounts, gpuQty), [build, mounts, gpuQty]);
  const errors = issues.filter((i) => i.level === "error");
  const flow = useMemo(() => airflowSummary(build, mounts), [build, mounts]);

  function updateFanStyle(style: FanModelStyle) {
    setFanModel(style);
    onFanModelChange?.(style);
  }

  /** ใส่ค่าใหม่ที่จุดยึด (ย้ายหม้อน้ำ → จุดเดิมกลายเป็นพัดลม) */
  function applyMount(base: MountConfig, id: MountId, s: MountSetting): MountConfig {
    const next = { ...base, [id]: { ...s, reverse: base[id].reverse } };
    if (s.kind === "rad")
      for (const o of MOUNT_IDS) if (o !== id && next[o].kind === "rad") next[o] = { kind: "fans", count: Math.min(2, mountCaps(o).fans) };
    return next;
  }
  function mountOptions(id: MountId) {
    const caps = mountCaps(id);
    const opts: Array<{ label: string; s: MountSetting }> = [{ label: "ไม่ใส่", s: { kind: "none", count: 0 } }];
    for (let n = 1; n <= caps.fans; n++) opts.push({ label: `พัดลม ${n} ตัว`, s: { kind: "fans", count: n } });
    if (isAio) opts.push({ label: `หม้อน้ำ ${layout.radMm}`, s: { kind: "rad", count: layout.radMm / radFanSize(layout.radMm) } });
    return opts.map((o) => {
      const err = checkFit(build, applyMount(mounts, id, o.s), gpuQty).find((i) => i.level === "error" && i.mount === id);
      return { ...o, issue: err?.text ?? null, active: mounts[id].kind === o.s.kind && (o.s.kind !== "fans" || mounts[id].count === o.s.count) };
    });
  }
  const mountSummary = (id: MountId) => {
    const s = mounts[id];
    return s.kind === "none" ? "ว่าง" : s.kind === "rad" ? `หม้อน้ำ ${layout.radMm}` : `พัดลม ${s.count}`;
  };

  function setLift(slot: string | null) {
    liftedRef.current = slot;
    setLifted(slot);
    setSubLabels(slot ? subsInfoRef.current.get(slot) ?? [] : []);
  }

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    // สีตั้งต้นตอนสร้างฉาก (เปลี่ยนสีภายหลังจะอัปเดตสดในลูปแอนิเมชัน ไม่ต้องสร้างฉากใหม่)
    const rgbColor = `#${rgbColorRef.current.getHexString()}`;
    const width = container.clientWidth || 340;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    const saved = camSaveRef.current;
    camera.position.copy(saved?.pos ?? new THREE.Vector3(-4.1, 2.1, 7.3)); // มองจากด้านหน้า-กระจกข้าง

    const isSmall = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height, false);
    // ความละเอียดจอ: สูงสุด 1.5 เท่า (2 เท่ากินการ์ดจอเกือบ 2 เท่า แต่ตาแทบไม่เห็นต่าง)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = hq;
    renderer.shadowMap.type = THREE.PCFShadowMap; // ใช้ radius เบลอขอบเงาให้นุ่มเหมือนแสงจริง
    renderer.shadowMap.autoUpdate = false; // อัปเดตเงาทุก 3 เฟรม (เบาลงมาก ตาไม่เห็นต่าง)

    // แสงสะท้อนจากห้องจำลอง → โลหะ/กระจกสะท้อนแสงเหมือนจริง
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.autoRotate = autoRotateRef.current;
    controlsRef.current = controls;
    controls.addEventListener("start", () => {
      wantDir = null; // ผู้ใช้จับหมุนเอง → ไม่แย่งกล้อง
      controls.autoRotate = false; // หยุดหมุนเองเมื่อผู้ใช้จับหมุน
      if (seatRef.current) setSeatView(false);
    });
    controls.autoRotateSpeed = 0.8;
    controls.minDistance = 2.4;
    controls.maxDistance = 32;
    const homeTarget = new THREE.Vector3(0, 0.05, 0);
    const allTarget = new THREE.Vector3(0.55, 0.45, 0.4);
    const lvl1Target = new THREE.Vector3(0, 0.1, 1.1);
    controls.target.copy(saved?.target ?? homeTarget);

    // ---- แสง ----
    const ambient = new THREE.AmbientLight("#ffffff", 0.25);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight("#fff3e3", hq ? 1.75 : 1.45); // แสงหลักอุ่นนิดๆ เหมือนแสงห้อง
    keyLight.position.set(-2.2, 5.5, 7);
    if (hq) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      const sc = keyLight.shadow.camera;
      sc.left = sc.bottom = -9; // ครอบทั้งโต๊ะ + เคส (แสงเงาดวงเดียว)
      sc.right = sc.top = 9;
      sc.near = 0.5;
      sc.far = 32;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.02;
      keyLight.shadow.radius = 5;
    }
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight("#a5b4fc", 0.8); // แสงเสริมโทนเย็น ให้มิติ
    fillLight.position.set(-4.0, 3.0, -3.0);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight("#ffffff", 0.6);
    rimLight.position.set(5, 4, -2);
    scene.add(rimLight);
    // ไฟในเคส (เหมือนแถบไฟ LED ใต้ฝาบน) ให้เห็นชิ้นข้างในชัด ไม่มืดทึบ
    const caseLight = new THREE.PointLight("#eef2ff", 3, 7, 2);
    caseLight.position.set(0.2, 1.2, 0.9);
    scene.add(caseLight);

    // ---- โมเดลคอมแบบละเอียด (สร้างด้วยโค้ด ไม่ต้องโหลดไฟล์) ----
    const model = buildPcModel({ build, gpuCount: gpuQty, ramSticks: ramQty, storageCount: storageQty, hddCount, sataSsdCount, rgb: rgbColor, mounts, fanStyle: fanModel, isSmallScreen: isSmall });
    subsInfoRef.current = new Map(Array.from(model.subs.entries()).map(([slot, list]) => [slot, list.map((g) => ({ key: g.userData.sub as string, label: g.userData.label as string }))]));
    const subByKey = new Map<string, THREE.Group>();
    for (const [slot, list] of model.subs) for (const g of list) subByKey.set(`${slot}:${g.userData.sub}`, g);
    const pcGroup = new THREE.Group();
    pcGroup.add(model.root);
    scene.add(pcGroup);

    // ขนาดตามเคสที่เลือก (ยึดพื้นไว้ ไม่ลอย)
    const caseScale = getCaseScale(build.case);
    pcGroup.scale.set(caseScale.x, caseScale.y, caseScale.z);
    pcGroup.position.y = MODEL_FLOOR_Y * (1 - caseScale.y);

    // เส้นประเทียบขนาด Mid Tower
    let refOutline: THREE.LineSegments | null = null;
    if (showReference) {
      refOutline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(MODEL_BOX.depth, MODEL_BOX.height, MODEL_BOX.width)),
        new THREE.LineDashedMaterial({ color: "#93c5fd", dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.5 })
      );
      refOutline.computeLineDistances();
      scene.add(refOutline);
    }

    const shadow = contactShadow(MODEL_BOX.depth + 0.7, MODEL_BOX.width + 0.7);
    shadow.position.y = MODEL_FLOOR_Y - 0.005;
    shadow.scale.set(caseScale.x, caseScale.z, 1);
    scene.add(shadow);
    let floor: THREE.Mesh | null = null;
    if (hq) {
      floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.ShadowMaterial({ opacity: 0.16 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = MODEL_FLOOR_Y - 0.004;
      floor.receiveShadow = true;
      scene.add(floor);
    }

    const ground = studioFloor(22);
    ground.position.y = MODEL_FLOOR_Y - 0.006;
    scene.add(ground);

    // ---- โต๊ะ + จอ + คีย์บอร์ด + เมาส์ (สเกลจริง) — ซ่อนตอนซูมเข้าไปดูในเคส ----
    const screen = createScreenSim();
    const rgbMatShared = model.rgbMeshes[0]?.material as THREE.MeshStandardMaterial | undefined;
    const desk = buildDeskModel({ monitor: build.monitor, screen: screen.texture, rgbMat: rgbMatShared, caseDepthMm: getCaseDimensions(build.case).depthMm });
    scene.add(desk.root);
    // ห้องเกมมิ่งรอบโต๊ะ: สร้างหลังเฟรมแรก (เปิดฉากเร็วขึ้น ห้องโผล่ตามมาทันที)
    let room: RoomScene | null = null;
    const roomTimer = window.setTimeout(() => {
      room = buildRoom({ deskW: desk.desk.widthCm * 10, deskD: desk.desk.depthCm * 10, deskH: desk.desk.heightCm * 10, rgb: rgbColor });
      desk.root.add(room.root);
    }, 80);
    const baseLights = { amb: 0.25, key: keyLight.intensity, fill: fillLight.intensity, rim: rimLight.intensity };
    let dim = 0;
    let spin = powerRef.current ? 1 : 0;
    let powerT = powerRef.current ? 1 : 0;
    const sceneCaseDims = getCaseDimensions(build.case);
    const deskLayouts = { desk: deskLayout(desk, "desk", sceneCaseDims), floor: deskLayout(desk, "floor", sceneCaseDims) };
    const deskTarget = new THREE.Vector3();
    const deskTargetOf = (p: CasePlacement) => {
      const l = deskLayouts[p];
      return deskTarget.set((l.min[0] + l.max[0]) / 2, (l.min[1] + l.max[1]) / 2, (l.min[2] + l.max[2]) / 2);
    };
    /** ระยะกล้องให้เห็นโต๊ะ + เคสครบตามสัดส่วนจอ */
    const deskDist = (p: CasePlacement) => {
      const l = deskLayouts[p];
      const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const d = Math.max((l.max[0] - l.min[0]) / 2 / Math.tan(hHalf), (l.max[1] - l.min[1]) / 2 / Math.tan(vHalf)) + (l.max[2] - l.min[2]) / 2;
      return Math.min(30, Math.max(6, d * 1.1));
    };
    const deskModeNow = () => deskOnRef.current && explodeRef.current === 0 && !liftedRef.current && guideRef.current === null && !mountModeRef.current;
    let lastDesk = deskModeNow();
    let lastPlace = placementRef.current;
    if (!saved && lastDesk) {
      controls.target.copy(deskTargetOf(lastPlace));
      camera.position.copy(deskTarget).addScaledVector(new THREE.Vector3(0.15, 0.32, 1).normalize(), deskDist(lastPlace));
    }

    // ระยะเลื่อนตอนแยกทั้งหมด = ตำแหน่งปลายทาง − จุดกึ่งกลางเดิม
    const allOff = new Map<string, number[]>();
    for (const [key, c] of model.centers) {
      const t = EXPLODE_LAYOUT[key];
      if (t) allOff.set(key, [t[0] - c.x, t[1] - c.y, t[2] - c.z]);
    }
    allOff.set("case", EXPLODE_CASE);
    allOff.set("fans", EXPLODE_CASE);

    // ---- ชิ้นที่กด/ไฮไลต์/ยก/แยกได้ ----
    const parts = Array.from(model.parts.entries()).map(([key, g]) => {
      g.userData.base = g.position.clone();
      g.userData.lift = 0;
      return { key, g, slot: g.userData.slot as string, subs: key === g.userData.slot ? model.subs.get(key) ?? [] : [] };
    });
    // แยกวัสดุต่อชิ้น (ชุดเดียวต่อชิ้น) → ไฮไลต์ชิ้นเดียวไม่ลามชิ้นอื่น; ไฟ RGB ใช้วัสดุร่วม ไม่ต้องแยก
    const rgbSet = new Set<THREE.Material>(model.rgbMeshes.map((m) => m.material as THREE.Material));
    const pickMeshes: THREE.Object3D[] = [];
    const hiMats = new Map<string, THREE.MeshStandardMaterial[]>();
    for (const { g, slot } of parts) {
      if (g.userData.noPick) continue;
      const clones = new Map<THREE.Material, THREE.MeshStandardMaterial>();
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || Array.isArray(m.material)) return;
        pickMeshes.push(m);
        const src = m.material as THREE.MeshStandardMaterial;
        if (rgbSet.has(src) || !src.emissive || src.transparent) return;
        let c = clones.get(src);
        if (!c) {
          c = src.clone();
          clones.set(src, c);
        }
        m.material = c;
      });
      const list = hiMats.get(slot) ?? [];
      list.push(...clones.values());
      hiMats.set(slot, list);
    }
    const ghostMeshes = model.mountGhosts.children as THREE.Mesh[];
    for (const l of model.rgbLights) l.userData.baseI = l.intensity;
    const rgbMat = model.rgbMeshes[0]?.material as THREE.MeshStandardMaterial | undefined;
    const rgbBaseEI = rgbMat?.emissiveIntensity ?? 2;
    const slotOf = (o: THREE.Object3D | null): string | null => {
      for (let n = o; n; n = n.parent) if (n.userData.slot) return n.userData.noPick ? null : (n.userData.slot as string);
      return null;
    };
    const isShown = (o: THREE.Object3D | null): boolean => {
      for (let n = o; n; n = n.parent) if (!n.visible) return false;
      return true;
    };

    // ---- กด / ชี้ในฉาก ----
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const castAt = (clientX: number, clientY: number, list: THREE.Object3D[]) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(list, false).find((h) => isShown(h.object)) ?? null;
    };
    const pickAt = (x: number, y: number) => slotOf(castAt(x, y, pickMeshes)?.object ?? null);
    let down: { x: number; y: number } | null = null;
    let lastMove = 0;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return;
      if (mountModeRef.current) {
        const hit = castAt(e.clientX, e.clientY, ghostMeshes);
        setActiveMount(hit ? (hit.object.userData.mount as MountId) : null);
        return;
      }
      if (guideRef.current !== null) return;
      const slot = pickAt(e.clientX, e.clientY);
      // กดชิ้นเดิมซ้ำ/กดที่ว่าง = วางคืน
      const next = !slot || slot === liftedRef.current ? null : slot;
      setLift(next);
      if (next) controls.autoRotate = false;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || down || mountModeRef.current) return;
      const now = performance.now();
      if (now - lastMove < 60) return;
      lastMove = now;
      const slot = pickAt(e.clientX, e.clientY);
      if (slot !== hoverRef.current) {
        hoverRef.current = slot;
        renderer.domElement.style.cursor = slot ? "pointer" : "";
        setHoverSlot(slot);
      }
    };
    const onLeave = () => {
      hoverRef.current = null;
      setHoverSlot(null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    let explodeT = explodeRef.current ? 1 : 0;
    let allT = explodeRef.current === 2 ? 1 : 0;
    let wantDist = 0;
    let wantDir: THREE.Vector3 | null = null;
    const allDir = new THREE.Vector3(-0.1, 0.22, 1).normalize(); // แยกทั้งหมด: มองตรงด้านหน้า เห็นชิ้นเรียงชัด
    let lastLevel = explodeRef.current;
    let glassT = glassOpenRef.current ? 1 : 0;
    const rainbow = new THREE.Color();
    let frameNo = 0;
    const seatLook = new THREE.Vector3();
    const seatEye = new THREE.Vector3();
    const waveCol = new THREE.Color();
    const hiColor = new THREE.Color("#38bdf8");
    const black = new THREE.Color(0);
    const tmp = new THREE.Vector3();
    const focus = new THREE.Vector3();
    let lastHi = "";
    let detailK = 0;
    let fpsFrames = 0;
    let fpsTime = -2; // เว้น 2 วิแรก (โหลดฉาก)
    let fpsBad = 0;

    // Animation Loop — หยุดวาดเมื่อเลื่อนพ้นจอหรือสลับแท็บ (ประหยัดแบต/ไม่กินเฟรม)
    let frameId = 0;
    let visible = true;
    let lastT = performance.now();
    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting && document.visibilityState === "visible";
      if (visible && !was) {
        lastT = performance.now();
        frameId = requestAnimationFrame(animate);
      }
    });
    io.observe(container);
    const onVis = () => {
      const was = visible;
      visible = document.visibilityState === "visible";
      if (visible && !was) {
        lastT = performance.now();
        frameId = requestAnimationFrame(animate);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const animate = () => {
      if (!visible) return;
      frameId = requestAnimationFrame(animate);
      const nowMs = performance.now();
      const delta = Math.min((nowMs - lastT) / 1000, 0.1);
      lastT = nowMs;
      const now = nowMs / 1000;

      // เปิด/ปิดเครื่อง: พัดลมค่อยๆ หมุนขึ้น ไฟค่อยๆ ติด จอบูต
      const on = powerRef.current;
      if (on && powerAtRef.current === -1) powerAtRef.current = now;
      const since = on ? now - powerAtRef.current : -1;
      spin += ((on ? 1 : 0) - spin) * Math.min(1, delta * (on ? 1.2 : 0.8));
      powerT = on ? Math.min(1, Math.max(0, (since - 0.25) / 0.9)) : Math.max(0, powerT - delta * 3);
      for (const r of model.rotors) r.rotation.y += delta * 7.5 * spin;

      const ease = Math.min(1, delta * 5);
      const liftEase = Math.min(1, delta * 6);
      const liftedSlot = liftedRef.current;
      const level = explodeRef.current;
      explodeT += ((level ? 1 : 0) - explodeT) * ease;
      allT += ((level === 2 ? 1 : 0) - allT) * ease;
      const guideOpen = guideRef.current !== null && guideRef.current < GUIDE.length - 1;
      glassT += ((glassOpenRef.current || level || liftedSlot || guideOpen ? 1 : 0) - glassT) * ease;
      // แยกทั้งหมด → ถอยกล้องออกให้เห็นครบ (ครั้งเดียวตอนเปลี่ยนโหมด ไม่แย่งการหมุนของผู้ใช้)
      if (level !== lastLevel) {
        // ระยะกล้องให้เห็นครบตามสัดส่วนจอ (มือถือแคบ → ถอยไกลขึ้น)
        const fitW = 0.315 * Math.min(camera.aspect, 1.6);
        wantDist = level === 2 ? Math.max(12.5, 5.8 / fitW) : level === 1 ? Math.max(10.5, 4.4 / fitW) : 8.7;
        wantDir = level === 2 ? allDir : null;
        lastLevel = level;
      }
      // โหมดโต๊ะ: ถอยกล้องให้เห็นโต๊ะทั้งตัว / ออกจากโหมด → กลับระยะดูเคส
      const deskMode = deskModeNow();
      const place = placementRef.current;
      if (deskMode !== lastDesk || (deskMode && place !== lastPlace)) {
        if (deskMode) wantDist = deskDist(place);
        else if (level === 0) wantDist = 8.7;
        lastDesk = deskMode;
        lastPlace = place;
      }
      desk.root.visible = deskMode;
      if (deskMode) {
        const l = deskLayouts[place];
        desk.root.position.set(l.position[0], l.position[1], l.position[2]);
        desk.gear.position.x = l.gearX;
      }
      if (floor) floor.position.y = (deskMode ? deskLayouts[place].floorY : MODEL_FLOOR_Y) - 0.004;
      ground.position.y = (deskMode ? deskLayouts[place].floorY : MODEL_FLOOR_Y) - 0.006;
      if (deskMode) ground.position.x = deskLayouts[place].position[0] * 0.6;
      else ground.position.x = 0;
      if (wantDist || wantDir) {
        const off = tmp.subVectors(camera.position, controls.target);
        const d = off.length();
        if (wantDir) {
          off.normalize().lerp(wantDir, Math.min(1, delta * 2.5)).normalize();
          if (off.angleTo(wantDir) < 0.01) wantDir = null;
        } else off.normalize();
        const nd = wantDist ? d + (wantDist - d) * Math.min(1, delta * 3) : d;
        if (wantDist && Math.abs(d - wantDist) < 0.05) wantDist = 0;
        camera.position.copy(controls.target).addScaledVector(off, nd);
      }
      const caseOnly = liftedSlot === "case";

      // แยกชิ้น / ยกชิ้น / แยกละเอียด / ประกอบทีละชิ้น
      const gStep = guideRef.current;
      if (gStep !== null && guideStartRef.current === -1) guideStartRef.current = now;
      let focusSet = false;
      for (const { key, g, slot, subs } of parts) {
        const base = g.userData.base as THREE.Vector3;
        const o1 = PART_LIFT[key] ?? [0, 0, 0];
        const o2 = allOff.get(key) ?? o1;
        const off = [o1[0] + (o2[0] - o1[0]) * allT, o1[1] + (o2[1] - o1[1]) * allT, o1[2] + (o2[2] - o1[2]) * allT];
        g.userData.lift += ((liftedSlot === slot ? 1 : 0) - g.userData.lift) * liftEase;
        const lift = g.userData.lift as number;
        let k = Math.max(explodeT, lift);
        let drop = 0;
        let shown = true;
        if (gStep !== null) {
          // ชิ้นของขั้นนี้ลอยเข้ามาจากนอกเคส แล้ววางลงที่จริง
          const idx = guideIndex(key);
          shown = idx <= gStep;
          if (idx === gStep && idx > 0) {
            const e = 1 - (1 - Math.min(1, (now - guideStartRef.current) / 0.9)) ** 3;
            k = Math.max(k, 1 - e);
            drop = (1 - e) * 0.25;
          }
        }
        // สายไฟซ่อนตอนแยก/ยกชิ้น (ไม่ให้ลอยค้าง)
        if (key === "cables") shown = shown && explodeT < 0.05 && !liftedSlot;
        // แยกทั้งหมด → เอากระจกออก; ยกเคส → ซ่อนชิ้นข้างใน ให้เห็นโครงเคสชัด
        if ((key === "glass" || key === "sideglass") && allT > 0.5) shown = false;
        if (caseOnly && slot !== "case" && key !== "glass" && key !== "sideglass") shown = false;
        // แยกชิ้น → กระจกไม่ลอยค้าง (เอาออกไปเลย)
        if ((key === "glass" || key === "sideglass") && explodeT > 0.35) shown = false;
        g.visible = shown;
        if ((key === "case" || key === "fans") && !lift) {
          const c1 = LEVEL1_CASE;
          const c2 = EXPLODE_CASE;
          g.position.set(
            base.x + (c1[0] + (c2[0] - c1[0]) * allT) * explodeT,
            base.y + drop,
            base.z + (c1[2] + (c2[2] - c1[2]) * allT) * explodeT
          );
        } else if (key === "sideglass") g.position.set(base.x, base.y + drop, base.z + glassT * 1.1 + off[2] * explodeT);
        else g.position.set(base.x + off[0] * k, base.y + off[1] * k + drop, base.z + off[2] * k);
        // แยกชิ้นย่อยหลังยกขึ้นมาแล้ว
        if (subs.length) {
          const d = Math.max(smooth((lift - 0.45) / 0.55), smooth((allT - 0.3) / 0.7));
          for (const s of subs) {
            s.position.copy(s.userData.off as THREE.Vector3).multiplyScalar(d);
            if (s.userData.hideOnDetail) s.visible = d < 0.05;
          }
          if (slot === liftedSlot) {
            detailK = d;
            const c = model.centers.get(key);
            if (c && !caseOnly) {
              focus.copy(c).add(g.position);
              model.root.localToWorld(focus);
              focusSet = true;
            }
          }
        }
      }
      if (!liftedSlot) detailK = 0;
      // ขยับจุดมองไปที่ชิ้นที่ยก (มือถือเห็นชัดขึ้น)
      if (!(seatRef.current && desk.root.visible)) controls.target.lerp(focusSet ? focus : allT > 0.5 ? allTarget : explodeT > 0.5 ? lvl1Target : deskMode ? deskTargetOf(place) : homeTarget, Math.min(1, delta * 3));
      // ตรวจเฟรมเรต: ถ้าเครื่องไม่ไหว (ต่ำกว่า ~28 fps ต่อเนื่อง) ลดคุณภาพให้อัตโนมัติ
      if (hq) {
        fpsFrames++;
        fpsTime += delta;
        if (fpsTime > 3) {
          if (fpsFrames / fpsTime < 28 && ++fpsBad >= 2) lowFpsRef.current();
          else if (fpsFrames / fpsTime >= 28) fpsBad = 0;
          fpsFrames = 0;
          fpsTime = 0;
        }
      }

      // จุดยึด + ทิศลม
      model.mountGhosts.visible = mountModeRef.current;
      if (mountModeRef.current) {
        const act = activeMountRef.current;
        for (const gm of ghostMeshes) (gm.material as THREE.MeshBasicMaterial).opacity = gm.userData.mount === act ? 0.5 : 0.2 + 0.08 * Math.sin(now * 3);
      }
      model.airflow.visible = airflowRef.current;
      if (airflowRef.current) {
        const ph = (now * 0.9) % 1;
        for (const a of model.arrows) a.obj.position.copy(a.base).addScaledVector(a.dir, (ph - 0.5) * 0.35);
      }

      // ไฟ RGB: คงที่ / หายใจ / สายรุ้ง (วัสดุร่วมชุดเดียว → อัปเดตครั้งเดียวทั้งเครื่อง)
      const mode = rgbModeRef.current;
      const col = mode === "rainbow" ? rainbow.setHSL((now * 0.12) % 1, 1, 0.55) : rgbColorRef.current;
      const f = (mode === "breath" ? 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(now * 2.4)) : 1) * powerT;
      caseLight.intensity = 3 * Math.max(0.15, powerT);
      // ไฟห้อง: ไล่สีเป็นคลื่นตามตำแหน่ง (โหมดสายรุ้ง)
      if (desk.root.visible && room) {
        const colAt = (phase: number) => (mode === "rainbow" ? waveCol.setHSL((now * 0.12 + phase * 0.5) % 1, 1, 0.55) : col);
        for (const l of room.leds) {
          const c = colAt(l.phase);
          l.mat.color.copy(c).multiplyScalar(0.08 + 0.92 * powerT);
          l.mat.emissive.copy(c);
          l.mat.emissiveIntensity = 2 * f;
        }
        for (const gl of room.glows) {
          gl.mat.color.copy(colAt(gl.phase));
          gl.mat.opacity = gl.base * f;
        }
        for (const rl of room.lights) {
          rl.light.color.copy(colAt(rl.phase));
          rl.light.intensity = rl.base * f;
        }
        room.follow.position.x = desk.gear.position.x;
      }
      if (desk.root.visible) screen.draw(since, now, screenInfoRef.current);
      // โหมดห้อง: หรี่ไฟหลักให้ไฟ RGB/จอเด่น (บรรยากาศห้องเกม)
      dim += ((desk.root.visible ? 1 : 0) - dim) * Math.min(1, delta * 2);
      ambient.intensity = baseLights.amb * (1 - 0.75 * dim);
      keyLight.intensity = baseLights.key * (1 - 0.62 * dim);
      fillLight.intensity = baseLights.fill * (1 - 0.7 * dim);
      rimLight.intensity = baseLights.rim * (1 - 0.5 * dim);
      scene.environmentIntensity = 1 - 0.55 * dim;
      if (rgbMat) {
        rgbMat.emissive.copy(col);
        rgbMat.color.copy(col).multiplyScalar(0.08 + 0.92 * powerT); // ปิดเครื่อง = ไฟดับ เหลือสีพลาสติกเข้ม
        rgbMat.emissiveIntensity = rgbBaseEI * f;
      }
      for (const l of model.rgbLights) {
        l.color.copy(col);
        l.intensity = (l.userData.baseI as number) * f;
      }

      // ไฮไลต์ชิ้นที่ยก/เลือก/ชี้
      const gKey = gStep !== null ? GUIDE[gStep]?.key : null;
      const sel = liftedSlot ?? (gKey && gKey !== "case" && gKey !== "cables" && gKey !== "glass" ? gKey : null) ?? hoverRef.current ?? selectedRef.current;
      const pulse = 0.5 + 0.5 * Math.sin(now * 5);
      if (lastHi && lastHi !== sel) {
        for (const m of hiMats.get(lastHi) ?? []) {
          m.emissive.copy(black);
          m.emissiveIntensity = 1;
        }
      }
      lastHi = sel ?? "";
      if (sel) {
        const strong = sel === liftedSlot || sel === selectedRef.current;
        const scale = sel === liftedSlot && sel === "case" ? 0 : sel === "case" ? 0.12 : liftedSlot === sel || allT > 0.5 ? 0.5 : 1; // ชิ้นใหญ่/ตอนแยกละเอียด → เรืองแสงอ่อนลง
        for (const m of hiMats.get(sel) ?? []) {
          m.emissive.copy(hiColor);
          m.emissiveIntensity = (strong ? 0.12 + 0.18 * pulse : 0.14) * scale;
        }
      }

      // มุมนั่งเก้าอี้: กล้องไปอยู่ระดับสายตาหน้าจอ
      if (seatRef.current && desk.root.visible) {
        const [sx, sy, sz] = desk.screenCenterMm;
        seatLook.set(sx * MODEL_SCALE_UNIT, sy * MODEL_SCALE_UNIT, sz * MODEL_SCALE_UNIT);
        desk.gear.localToWorld(seatLook);
        seatEye.set(sx * MODEL_SCALE_UNIT, (sy + 140) * MODEL_SCALE_UNIT, (sz + 1050) * MODEL_SCALE_UNIT);
        desk.gear.localToWorld(seatEye);
        const k = Math.min(1, delta * 4);
        camera.position.lerp(seatEye, k);
        controls.target.lerp(seatLook, k);
        controls.autoRotate = false;
        wantDist = 0;
        wantDir = null;
      }
      controls.update();
      if (hq && frameNo++ % 3 === 0) renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
      if (snapRef.current) {
        snapRef.current = false;
        saveSnapshot(renderer.domElement);
      }

      // ป้ายลอยในฉาก (จุดยึด / ชื่อชิ้นย่อย) — ขยับตรงๆ ไม่ผ่าน React
      const ov = overlayRef.current;
      if (ov && ov.childElementCount) {
        const w = ov.clientWidth;
        const h = ov.clientHeight;
        ov.querySelectorAll<HTMLElement>("[data-anchor]").forEach((el) => {
          const a = el.dataset.anchor!;
          let ok = false;
          if (a.startsWith("p:")) {
            const pg = model.parts.get(a.slice(2));
            const c = model.centers.get(a.slice(2));
            if (pg && c) {
              tmp.copy(c).add(pg.position);
              model.root.localToWorld(tmp);
              ok = allT > 0.7 && !liftedSlot && pg.visible;
            }
          } else if (a.startsWith("m:")) {
            const p = model.mountAnchors.get(a.slice(2) as MountId);
            if (p) {
              tmp.copy(p);
              model.root.localToWorld(tmp);
              ok = mountModeRef.current;
            }
          } else {
            const g = subByKey.get(a.slice(2));
            if (g) {
              tmp.copy(g.userData.anchor as THREE.Vector3);
              g.localToWorld(tmp);
              ok = detailK > 0.6 && g.visible;
            }
          }
          tmp.project(camera);
          ok = ok && tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
          el.style.opacity = ok ? "1" : "0";
          el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
        });
      }
    };
    // คอมไพล์ shader แบบไม่บล็อกหน้าเว็บก่อนวาดเฟรมแรก (เปิดฉากไม่ค้าง)
    let disposed = false;
    let readyId = 0;
    const startLoop = () => {
      if (disposed) return;
      frameId = requestAnimationFrame(animate);
      readyId = requestAnimationFrame(() => setSceneReady(true));
    };
    renderer.compileAsync(scene, camera).then(startLoop, startLoop);

    const handleResize = () => {
      const w = container.clientWidth || 340;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(readyId);
      disposed = true;
      visible = false;
      camSaveRef.current = { pos: camera.position.clone(), target: controls.target.clone() };
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      resizeObserver.disconnect();
      controls.dispose();
      controlsRef.current = null;
      refOutline?.geometry.dispose();
      (refOutline?.material as THREE.Material | undefined)?.dispose();
      shadow.geometry.dispose();
      (shadow.material as THREE.MeshBasicMaterial).map?.dispose();
      (shadow.material as THREE.Material).dispose();
      ground.geometry.dispose();
      (ground.material as THREE.MeshBasicMaterial).map?.dispose();
      (ground.material as THREE.Material).dispose();
      floor?.geometry.dispose();
      (floor?.material as THREE.Material | undefined)?.dispose();
      for (const list of hiMats.values()) for (const m of list) m.dispose();
      model.dispose();
      desk.dispose();
      window.clearTimeout(roomTimer);
      (room as RoomScene | null)?.dispose();
      screen.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [build, ramQty, gpuQty, storageQty, hddCount, sataSsdCount, showReference, mounts, fanModel, hq]);

  const RGB_PRESETS = ["#38bdf8", "#f43f5e", "#a855f7", "#22c55e", "#f59e0b", "#f8fafc"];
  function startGuide() {
    setLift(null);
    setExplodeLevel(0);
    setMountMode(false);
    setShowLightPanel(false);
    setGuideStep(0);
    setGuideAuto(false);
  }
  // เครื่องไม่ไหว → ปิดเงาจริงให้เอง
  useEffect(() => {
    lowFpsRef.current = () => {
      if (hq) setHq(false);
    };
  });
  // เล่นอัตโนมัติ: ขยับขั้นทุก 3.5 วิ
  useEffect(() => {
    if (!guideAuto || guideStep === null) return;
    const t = window.setTimeout(() => {
      if (guideStep >= GUIDE.length - 1) setGuideAuto(false);
      else setGuideStep(guideStep + 1);
    }, 3500);
    return () => window.clearTimeout(t);
  }, [guideAuto, guideStep]);

  const shownSlot = hoverSlot ?? selectedSlot;
  const shownLabel = shownSlot ? SLOT_LABEL_TH[shownSlot] : null;
  const liftedPart = lifted ? build[lifted as keyof PcSceneProps["build"]] : null;

  function runTool(key: string) {
    if (key !== "assemble" && key !== "rotate" && key !== "light" && key !== "size") setGuideStep(null);
    if ((key === "desk" && !showDesk) || key === "place") {
      // เปิดโต๊ะ/ย้ายเคส → กลับมุมมองรวม ให้เห็นโต๊ะทันที
      setLift(null);
      setExplodeLevel(0);
      setMountMode(false);
      setActiveMount(null);
    }
    if (key === "assemble") {
      if (guideStep === null) startGuide();
      else setGuideStep(null);
    }
    else if (key === "explode") {
      setLift(null);
      setExplodeLevel((v) => ((v + 1) % 3) as 0 | 1 | 2);
    } else if (key === "glass") setGlassOpen((v) => !v);
    else if (key === "mounts") {
      setLift(null);
      setMountMode((v) => !v);
      setActiveMount(null);
      setShowLightPanel(false);
    } else if (key === "airflow") setShowAirflow((v) => !v);
    else if (key === "light") {
      setShowLightPanel((v) => !v);
      setMountMode(false);
      setActiveMount(null);
    } else if (key === "size") setShowReference((v) => !v);
    else if (key === "desk") setShowDesk((v) => !v);
    else if (key === "place") setPlacement((p) => (p === "desk" ? "floor" : "desk"));
    else if (key === "rotate") setAutoRotate((v) => !v);
    else if (key === "sound") setSoundOn((v) => !v);
    else if (key === "photo") snapRef.current = true;
    else if (key === "seat") {
      if (!showDesk) setShowDesk(true);
      setLift(null);
      setExplodeLevel(0);
      setMountMode(false);
      setSeatView((v) => !v);
    } else if (key === "power") {
      const next = !powerOn;
      if (!soundRef.current) soundRef.current = createPcSound();
      soundRef.current.setMuted(!soundOn);
      if (next) soundRef.current.powerOn();
      else soundRef.current.powerOff();
      setPowerOn(next);
      if (!showDesk) setShowDesk(true);
      setLift(null);
      setExplodeLevel(0);
    }
  }

  const tools: Array<{ key: string; label: string; icon: React.ReactNode; active?: boolean }> = [
    { key: "power", label: powerOn ? "ปิดเครื่อง" : "เปิดเครื่อง", icon: <Power className="h-4 w-4" />, active: !powerOn },
    { key: "assemble", label: "สอนประกอบ", icon: <Hammer className="h-4 w-4" />, active: guideStep !== null },
    {
      key: "explode",
      label: explodeLevel === 0 ? "แยกชิ้น" : explodeLevel === 1 ? "แยกทั้งหมด" : "รวมชิ้น",
      icon: explodeLevel === 2 ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />,
      active: explodeLevel > 0,
    },
    { key: "glass", label: glassOpen ? "ปิดฝา" : "เปิดฝา", icon: glassOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />, active: glassOpen },
    { key: "mounts", label: "จุดยึด", icon: <Fan className="h-4 w-4" />, active: mountMode },
    { key: "airflow", label: "ทิศลม", icon: <Wind className="h-4 w-4" />, active: showAirflow },
    { key: "light", label: "ไฟ", icon: <Lightbulb className="h-4 w-4" />, active: showLightPanel },
    { key: "size", label: "ขนาด", icon: <Ruler className="h-4 w-4" />, active: showReference },
    { key: "desk", label: "โต๊ะ", icon: <Monitor className="h-4 w-4" />, active: showDesk },
    ...(showDesk
      ? [
          {
            key: "place",
            label: placement === "desk" ? "เคสบนโต๊ะ" : "วางพื้นข้างโต๊ะ",
            icon: placement === "desk" ? <ArrowUpToLine className="h-4 w-4" /> : <ArrowDownToLine className="h-4 w-4" />,
          },
        ]
      : []),
    { key: "rotate", label: autoRotate ? "หยุด" : "หมุน", icon: autoRotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" /> },
    { key: "seat", label: "มุมนั่ง", icon: <Armchair className="h-4 w-4" />, active: seatView },
    { key: "photo", label: "ถ่ายรูป", icon: <Camera className="h-4 w-4" /> },
    { key: "sound", label: soundOn ? "เสียงเปิด" : "เสียงปิด", icon: soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" /> },
  ];
  const mountIssue = (id: MountId) => errors.some((i) => i.mount === id);
  // แถบล่างโชว์แค่ปุ่มหลัก ที่เหลือเก็บใน "เพิ่มเติม" (ไม่รกตา)
  const PRIMARY = new Set(["power", "assemble", "explode", "desk"]);
  const mainTools = tools.filter((t) => PRIMARY.has(t.key));
  const extraTools = tools.filter((t) => !PRIMARY.has(t.key));
  const extraActive = extraTools.some((t) => t.active);

  return (
    <div className="w-full">
    <div className="relative w-full overflow-hidden" data-full={explodeLevel > 0 || lifted || mountMode || guideStep !== null ? "" : undefined}>
      <div
        ref={mountRef}
        onPointerDown={() => setTouched(true)}
        className={`w-full cursor-grab touch-none active:cursor-grabbing ${compactStage ? "h-[380px] sm:h-[460px]" : "h-[420px] sm:h-[500px]"}`}
        aria-label="โมเดลคอมพิวเตอร์ 3 มิติ ลากเพื่อหมุน แตะชิ้นส่วนเพื่อยกขึ้นมาแยกดู"
      />

      {!sceneReady && (
        <div className="skeleton absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm text-ink-500" role="status" aria-live="polite">
          <Spinner size={24} />
          <span>กำลังโหลดโมเดล 3 มิติ…</span>
        </div>
      )}

      {/* ป้ายลอยในฉาก: ตำแหน่งอัปเดตจากลูป 3D */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0">
        {mountMode &&
          MOUNT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              data-anchor={`m:${id}`}
              onClick={() => setActiveMount(id)}
              style={{ opacity: 0 }}
              className={`pointer-events-auto absolute left-0 top-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-md transition-colors ${
                activeMount === id ? "bg-info text-white" : mountIssue(id) ? "bg-bad text-paper" : "bg-surface/95 text-ink-900 ring-1 ring-ink-200"
              }`}
            >
              {MOUNTS[id].label} · {mountSummary(id)}
            </button>
          ))}
        {explodeLevel === 2 &&
          !lifted &&
          Object.keys(SLOT_LABEL_TH).map((slot) => (
            <span
              key={slot}
              data-anchor={`p:${slot}`}
              style={{ opacity: 0 }}
              className="absolute left-0 top-0 whitespace-nowrap rounded-full bg-info px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-md transition-opacity duration-200"
            >
              {SLOT_LABEL_TH[slot]}
            </span>
          ))}
        {lifted &&
          subLabels.map((s) => (
            <span
              key={s.key}
              data-anchor={`s:${lifted}:${s.key}`}
              style={{ opacity: 0 }}
              className="absolute left-0 top-0 max-w-[46%] truncate rounded-md bg-ink-950/85 px-2 py-0.5 text-[10.5px] font-medium text-white shadow transition-opacity duration-200 sm:max-w-[40%]"
            >
              {s.label}
            </span>
          ))}
      </div>

      {/* มุมซ้ายบน: ขนาดเคส หรือชื่อชิ้นที่ชี้อยู่ (ไม่ลอยทับตัวเคสกลางจอ) */}
      {shownLabel && !lifted && !mountMode ? (
        <span key={shownSlot} className="scene-chip pointer-events-none absolute left-3 top-3 max-w-[calc(100%-9.5rem)] truncate rounded-full bg-ink-950/85 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur">
          {shownLabel}
          {labels[shownSlot!] ? ` · ${labels[shownSlot!]}` : ""}
        </span>
      ) : (
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-surface/85 px-2.5 py-1 text-[11px] font-semibold text-ink-700 shadow-sm backdrop-blur">
          {CASE_SIZE_META[caseSize].labelEn} · {getCaseVolumeLiters(caseDims)} ลิตร
          {showReference && <span className="ml-1 text-info">· เส้นประ = Mid Tower</span>}
        </span>
      )}

      {/* ขนาดเคสจริง + พื้นที่บนโต๊ะ (โชว์เมื่อกด "ขนาด") */}
      {showReference && !showAirflow && (
        <span className="pointer-events-none absolute bottom-16 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-surface/85 px-2.5 py-1 text-[11px] font-semibold text-ink-700 shadow-sm backdrop-blur">
          เคส {footprint.widthCm} × {footprint.heightCm} × {footprint.depthCm} ซม. · ใช้พื้นที่โต๊ะ ~{footprint.deskSharePct}%
        </span>
      )}

      {/* ผลเช็กว่าใส่ได้จริง */}
      <div className="absolute right-3 top-3 flex max-w-[60%] flex-col items-end gap-1.5">
        {errors.length ? (
          <button type="button" onClick={() => setShowIssues((v) => !v)} className="inline-flex items-center gap-1 rounded-full bg-bad px-2.5 py-1 text-[11px] font-semibold text-paper shadow-sm">
            <AlertTriangle className="h-3.5 w-3.5" /> ใส่ไม่ได้ {errors.length} จุด
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface/85 px-2.5 py-1 text-[11px] font-semibold text-ok shadow-sm backdrop-blur">
            <CheckCircle2 className="h-3.5 w-3.5" /> ใส่ได้จริงทุกจุด
          </span>
        )}
        {errors.length === 0 && issues.length > 0 && (
          <button type="button" onClick={() => setShowIssues((v) => !v)} className="rounded-full bg-surface/85 px-2.5 py-1 text-[11px] font-semibold text-warn shadow-sm backdrop-blur">
            ข้อควรรู้ {issues.length}
          </button>
        )}
        {showIssues && issues.length > 0 && (
          <ul className="scene-chip space-y-1 rounded-xl bg-surface/95 p-2 text-[11px] shadow-lg ring-1 ring-ink-200 backdrop-blur">
            {issues.map((i, n) => (
              <li key={n} className={i.level === "error" ? "text-bad" : "text-ink-600"}>
                • {i.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* การ์ดกลางบน: เลือกจุดยึด / ชิ้นที่ยก / ป้ายชิ้นที่ชี้ */}
      {lifted ? null : (
        <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center px-3">
          {mountMode ? (
            <span className="rounded-full bg-surface/85 px-3 py-1 text-[11px] text-ink-700 shadow-sm backdrop-blur">แตะจุดยึดเพื่อใส่พัดลมหรือหม้อน้ำ</span>
          ) : shownLabel || seatView ? null : touched && explodeLevel !== 2 ? null : (
            <span className="scene-chip rounded-full bg-surface/70 px-3 py-1 text-[11px] text-ink-600 backdrop-blur">
              {explodeLevel === 2 ? "แยกทั้งหมดแล้ว · แตะชิ้นเพื่อดูชื่อชิ้นย่อย" : "แตะชิ้นส่วนเพื่อยกขึ้นมาแยกดู"}
            </span>
          )}
        </div>
      )}

      {/* สรุปทิศลม */}
      {showAirflow && guideStep === null && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center px-3">
          <span className="scene-chip inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-full bg-surface/95 px-3 py-1.5 text-[11px] font-semibold text-ink-800 shadow-md backdrop-blur">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#38bdf8]" /> ลมเข้า {flow.intake}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#fb923c]" /> ลมออก {flow.exhaust}
            </span>
            <span className="text-ink-600">{flow.label}</span>
          </span>
        </div>
      )}

      {/* เกมบนจอ: กดเปลี่ยนเกม ดู FPS ของสเปกนี้ */}
      {showDesk && powerOn && explodeLevel === 0 && !lifted && !mountMode && guideStep === null && !showAirflow && !showReference && (
        <div className="absolute inset-x-0 bottom-16 flex justify-center px-3">
          {games.length > 0 ? (
            <button
              type="button"
              onClick={() => setGameIdx((i) => (i + 1) % games.length)}
              className="scene-chip inline-flex max-w-full items-center gap-1.5 rounded-full bg-ink-950/85 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md backdrop-blur"
              aria-label="เปลี่ยนเกมที่ทดสอบบนจอ"
            >
              <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{games[gameIdx % games.length].title}</span>
              <span className={games[gameIdx % games.length].fps >= 60 ? "text-ok" : games[gameIdx % games.length].fps >= 40 ? "text-warn" : "text-bad"}>
                ~{games[gameIdx % games.length].fps} FPS
              </span>
              <span className="text-white/60">· เปลี่ยนเกม</span>
            </button>
          ) : (
            <span className="scene-chip rounded-full bg-ink-950/80 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md backdrop-blur">เลือกซีพียู + การ์ดจอ แล้วดู FPS บนจอได้เลย</span>
          )}
        </div>
      )}

      {/* แถบเครื่องมือ: ปุ่มหลัก 4 ปุ่ม + เพิ่มเติม */}
      <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-2">
        {moreTools && (
          <div className="scene-chip grid max-w-full grid-cols-4 gap-1 rounded-2xl bg-surface/95 p-1.5 shadow-lg ring-1 ring-ink-200 backdrop-blur" role="group" aria-label="เครื่องมือเพิ่มเติม">
            {extraTools.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => runTool(t.key)}
                aria-pressed={t.active}
                className={`flex min-h-14 w-[4.6rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors ${t.active ? "bg-info text-white" : "text-ink-700 hover:bg-ink-100"}`}
              >
                {t.icon}
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex max-w-full gap-0.5 rounded-full bg-surface/90 p-1 shadow-md backdrop-blur">
          {mainTools.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => runTool(t.key)}
              aria-pressed={t.active}
              className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2 text-xs sm:gap-1.5 sm:px-2.5 font-semibold transition-colors ${t.active ? "bg-info text-white" : "text-ink-700 hover:bg-ink-100"}`}
            >
              {t.icon}
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMoreTools((v) => !v)}
            aria-expanded={moreTools}
            aria-label="เครื่องมือเพิ่มเติม"
            className={`relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors ${moreTools ? "bg-ink-900 text-paper" : "text-ink-700 hover:bg-ink-100"}`}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="hidden whitespace-nowrap sm:inline">เพิ่มเติม</span>
            {extraActive && !moreTools && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-info" />}
          </button>
        </div>
      </div>

    </div>
      {/* แผงควบคุมอยู่ใต้ฉาก — ไม่บังโมเดล */}
      {(guideStep !== null || (mountMode && activeMount) || showLightPanel || lifted) && (
        <div className="scene-dock space-y-2 px-3 pb-3 pt-2">
      {lifted && (
        <div className="flex justify-center">
          <div key={lifted} className="scene-chip flex w-full max-w-sm items-center gap-3 rounded-2xl bg-surface p-2.5 pl-3.5 shadow-sm ring-1 ring-ink-200">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-info">
                {SLOT_LABEL_TH[lifted] ?? lifted}
                {subLabels.length > 1 && <span className="font-normal text-ink-600"> · แยก {subLabels.filter((s) => s.key !== "tubes").length} ชิ้นย่อย</span>}
              </p>
              <p className="truncate text-sm font-semibold text-ink-950">{liftedPart?.name ?? "ยังไม่ได้เลือก"}</p>
              {liftedPart && <p className="text-xs font-bold text-ink-700">{formatTHB(liftedPart.price)}</p>}
            </div>
            {onPickSlot && (
              <button type="button" onClick={() => onPickSlot(lifted)} className="h-9 shrink-0 rounded-full bg-info px-3.5 text-xs font-semibold text-white hover:opacity-90">
                เปลี่ยนชิ้นนี้
              </button>
            )}
            <button type="button" onClick={() => setLift(null)} className="h-9 shrink-0 rounded-full bg-ink-100 px-3 text-xs font-semibold text-ink-800 hover:bg-ink-200">
              วางคืน
            </button>
          </div>
        </div>
      )}
      {/* สอนประกอบทีละขั้น */}
      {guideStep !== null && (
        <div className="flex justify-center">
          <div key={guideStep} className="scene-chip w-full max-w-md rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-ink-200">
            <div className="flex items-start gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info text-xs font-bold text-white">{guideStep + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-950">
                  {GUIDE[guideStep].title}
                  <span className="ml-1.5 text-[11px] font-normal text-ink-600">
                    ขั้น {guideStep + 1}/{GUIDE.length}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-700">{GUIDE[guideStep].tip}</p>
              </div>
              <button type="button" onClick={() => setGuideStep(null)} aria-label="ปิดโหมดสอนประกอบ" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-ink-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <div className="flex flex-1 gap-0.5" aria-hidden>
                {GUIDE.map((_, i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full ${i <= guideStep ? "bg-info" : "bg-ink-200"}`} />
                ))}
              </div>
              <button type="button" onClick={() => setGuideAuto((v) => !v)} aria-pressed={guideAuto} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-800" aria-label={guideAuto ? "หยุดเล่นอัตโนมัติ" : "เล่นอัตโนมัติ"}>
                {guideAuto ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button type="button" disabled={guideStep === 0} onClick={() => setGuideStep(guideStep - 1)} className="h-9 shrink-0 rounded-full bg-ink-100 px-3 text-xs font-semibold text-ink-800 disabled:opacity-40">
                ก่อนหน้า
              </button>
              <button
                type="button"
                onClick={() => (guideStep >= GUIDE.length - 1 ? setGuideStep(null) : setGuideStep(guideStep + 1))}
                className="h-9 shrink-0 rounded-full bg-info px-3.5 text-xs font-semibold text-white"
              >
                {guideStep >= GUIDE.length - 1 ? "เสร็จ" : "ถัดไป"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mountMode && activeMount && (
        <div className="flex justify-center">
          <div key={activeMount} className="scene-chip w-full max-w-md rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-ink-200">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink-950">จุดยึดด้าน{MOUNTS[activeMount].label}</p>
                <p className="text-[11px] text-ink-600">
                  พัดลมสูงสุด {mountCaps(activeMount).fans} ตัว · หม้อน้ำยาวสุด {mountCaps(activeMount).radMax || "—"} มม. · {MOUNTS[activeMount].intake ? "ดูดลมเข้า" : "เป่าลมออก"}
                </p>
              </div>
              <button type="button" onClick={() => setActiveMount(null)} aria-label="ปิด" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-ink-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {mountOptions(activeMount).map((o) => (
                <button
                  key={o.label}
                  type="button"
                  disabled={!!o.issue}
                  title={o.issue ?? undefined}
                  data-active={o.active}
                  onClick={() => setMounts((m) => applyMount(m, activeMount, o.s))}
                  className="chip shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {o.label}
                </button>
              ))}
            </div>
            {mounts[activeMount].kind !== "none" && (
              <div className="mt-3 space-y-2.5 border-t border-ink-100 pt-2.5">
                <MountSlider
                  key={`${activeMount}-${mounts[activeMount].kind}-${mounts[activeMount].count}`}
                  value={mounts[activeMount].offset ?? 0}
                  slack={mountSlack(activeMount, mounts[activeMount], layout.radMm)}
                  vertical={MOUNTS[activeMount].along === "y"}
                  onCommit={(v) => setMounts((m) => ({ ...m, [activeMount]: { ...m[activeMount], offset: v } }))}
                />
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 font-semibold text-ink-700">ทิศลม</span>
                  {([false, true] as const).map((rev) => {
                    const isIn = MOUNTS[activeMount].intake !== rev;
                    return (
                      <button
                        key={String(rev)}
                        type="button"
                        data-active={!!mounts[activeMount].reverse === rev}
                        onClick={() => setMounts((m) => ({ ...m, [activeMount]: { ...m[activeMount], reverse: rev } }))}
                        className="chip rounded-full"
                      >
                        <span className={`h-2 w-2 rounded-full ${isIn ? "bg-[#38bdf8]" : "bg-[#fb923c]"}`} />
                        {isIn ? "ดูดลมเข้า" : "เป่าลมออก"}
                        {!rev && <span className="text-[10px] opacity-70">แนะนำ</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {mountOptions(activeMount)
              .filter((o) => o.issue)
              .slice(0, 2)
              .map((o) => (
                <p key={o.label} className="mt-1.5 text-[11px] text-bad">
                  {o.label}: {o.issue}
                </p>
              ))}
          </div>
        </div>
      )}
      {showLightPanel && (
        <div className="scene-chip mx-auto max-w-md space-y-2.5 rounded-2xl bg-surface p-3 text-xs shadow-sm ring-1 ring-ink-200">
          <p className="font-semibold text-ink-800">สีไฟ RGB</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {RGB_PRESETS.map((hex) => (
              <button key={hex} type="button" onClick={() => setRgbColor(hex)} aria-label={`สีไฟ ${hex}`} className="flex h-8 w-8 items-center justify-center rounded-full">
                <span
                  className={`h-5 w-5 rounded-full ring-offset-2 ring-offset-surface transition-transform ${rgbColor === hex && rgbMode !== "rainbow" ? "scale-110 ring-2 ring-info" : "ring-1 ring-ink-200"}`}
                  style={{ backgroundColor: hex }}
                />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["static", "ไฟนิ่ง"],
                ["breath", "หายใจ"],
                ["rainbow", "สายรุ้ง"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" data-active={rgbMode === id} onClick={() => setRgbMode(id)} className="chip rounded-full">
                {label}
              </button>
            ))}
          </div>
          <p className="font-semibold text-ink-800">แบบพัดลม</p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["sl_infinity", "Infinity"],
                ["dual_ring", "Dual Ring"],
                ["argb", "ARGB"],
                ["stealth", "ไม่มีไฟ"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" data-active={fanModel === id} onClick={() => updateFanStyle(id)} className="chip rounded-full">
                {label}
              </button>
            ))}
          </div>
          <p className="font-semibold text-ink-800">คุณภาพภาพ</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" data-active={hq} onClick={() => setHq(true)} className="chip rounded-full">
              สูง (เงาจริง)
            </button>
            <button type="button" data-active={!hq} onClick={() => setHq(false)} className="chip rounded-full">
              ประหยัด (ลื่นกว่า)
            </button>
          </div>
        </div>
      )}        </div>
      )}

    </div>
  );
}

/** เลื่อนตำแหน่งพัดลม/หม้อน้ำ — ขยับเห็นค่าทันที แต่สร้างฉากใหม่ตอนปล่อยนิ้ว (ไม่หน่วง) */
function MountSlider({ value, slack, vertical, onCommit }: { value: number; slack: number; vertical: boolean; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(value);
  if (slack <= 0) return <p className="text-[11px] text-ink-600">เต็มช่องพอดี เลื่อนตำแหน่งไม่ได้</p>;
  const commit = (v: number) => {
    const c = Math.max(-slack, Math.min(slack, Math.round(v)));
    setDraft(c);
    if (c !== value) onCommit(c);
  };
  const [lo, hi] = vertical ? ["ลง", "ขึ้น"] : ["หน้า", "หลัง"];
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 font-semibold text-ink-700">เลื่อน</span>
      <button type="button" onClick={() => commit(draft - 10)} aria-label={`เลื่อน${lo}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 font-bold text-ink-800">
        −
      </button>
      <input
        type="range"
        aria-label="ตำแหน่ง (มม.)"
        min={-slack}
        max={slack}
        step={5}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={() => commit(draft)}
        onKeyUp={() => commit(draft)}
        onBlur={() => commit(draft)}
        style={{ ["--fill" as string]: `${((draft + slack) / (2 * slack)) * 100}%` }}
        className="range min-w-0 flex-1"
      />
      <button type="button" onClick={() => commit(draft + 10)} aria-label={`เลื่อน${hi}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 font-bold text-ink-800">
        +
      </button>
      <span className="w-12 shrink-0 text-right tabular-nums text-ink-600">{draft > 0 ? "+" : ""}{draft} มม.</span>
    </div>
  );
}
