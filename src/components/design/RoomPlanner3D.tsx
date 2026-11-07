"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { fabricTex, plasterTex } from "./room3d-textures";
import {
  clampToRoom,
  dragTo,
  findNearestWallForItem,
  getItemAxes,
  normalizeRotDeg,
  rotateItemSafely,
  settleOnTop,
  type PlanItem,
  type RoomSize,
} from "@/lib/room-planner";
import { buildItem, CM, disposeGroup, makeMats } from "./room3d-models";
import { calculateSunState, type SunSettings } from "@/lib/sun-simulation";

export interface RoomPlanner3DHandle {
  /** ภาพมุมกล้องปัจจุบัน (ใช้ส่งให้ AI วาดเป็นห้องจริง) + ตำแหน่งของแต่ละชิ้นบนภาพ (%) ไว้วางจุดแตะ */
  snapshot: () => Promise<{ blob: Blob; spots: Record<string, { x: number; y: number }> } | null>;
  resetView: () => void;
}

interface Props {
  room: RoomSize;
  items: PlanItem[];
  selected: string | null;
  night: boolean;
  sunSettings?: SunSettings;
  onSelect: (uid: string | null) => void;
  onMove: (uid: string, x: number, z: number, y: number, rot?: number) => void;
  onBatchMove?: (moves: Array<{ uid: string; x: number; z: number; y: number; rot: number }>) => void;
  onDelete?: (uid: string) => void;
  onDragStateChange?: (dragging: boolean, overDeleteZone: boolean, uid: string | null) => void;
  checkDeleteZone?: (clientX: number, clientY: number) => boolean;
}

interface SelectionAngleGizmo {
  group: THREE.Group;
  ringWrap: THREE.Group;
  pointerPivot: THREE.Group;
  badge: THREE.Sprite;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  lastText: string;
}

function buildSelectionAngleGizmo(): SelectionAngleGizmo {
  const group = new THREE.Group();
  group.visible = false;

  const ringWrap = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.955, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: "#0ea5e9",
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthTest: false,
    })
  );
  disc.renderOrder = 7;

  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.955, 1.0, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: "#38bdf8",
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
    })
  );
  outerRing.renderOrder = 8;
  ringWrap.add(disc, outerRing);

  const tickMat = new THREE.MeshBasicMaterial({
    color: "#7dd3fc",
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const isMajor = i % 2 === 0;
    const tick = new THREE.Mesh(
      new THREE.PlaneGeometry(isMajor ? 0.028 : 0.018, isMajor ? 0.11 : 0.065).rotateX(-Math.PI / 2),
      tickMat
    );
    tick.position.set(Math.sin(a) * 0.91, 0.001, Math.cos(a) * 0.91);
    tick.rotation.y = a;
    tick.renderOrder = 8;
    ringWrap.add(tick);
  }

  const pointerPivot = new THREE.Group();
  const arrowMat = new THREE.MeshBasicMaterial({
    color: "#f59e0b",
    transparent: true,
    opacity: 0.98,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.46).rotateX(-Math.PI / 2), arrowMat);
  shaft.position.set(0, 0.002, 0.82);
  shaft.renderOrder = 9;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 3).rotateX(Math.PI / 2), arrowMat);
  tip.position.set(0, 0.003, 1.13);
  tip.renderOrder = 9;

  // ขอบเขตคลิก/ลากเฉพาะสำหรับลูกศรสีเหลือง (Dedicated Yellow Arrow Hit Area)
  const arrowHitGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.72, 16).rotateX(Math.PI / 2);
  const arrowHitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const arrowHit = new THREE.Mesh(arrowHitGeo, arrowHitMat);
  arrowHit.position.set(0, 0.005, 0.96);

  shaft.userData = { isRotateHandle: true, isArrowHandle: true };
  tip.userData = { isRotateHandle: true, isArrowHandle: true };
  arrowHit.userData = { isRotateHandle: true, isArrowHandle: true };
  pointerPivot.userData = { isRotateHandle: true, isArrowHandle: true };
  pointerPivot.add(shaft, tip, arrowHit);
  ringWrap.add(pointerPivot);

  const canvas = document.createElement("canvas");
  canvas.width = 340;
  canvas.height = 88;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const badge = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  );
  badge.scale.set(0.82, 0.21, 1);
  badge.renderOrder = 14;
  badge.userData = { isRotateHandle: true, isBadge: true };

  group.add(ringWrap, badge);
  return { group, ringWrap, pointerPivot, badge, canvas, ctx, tex, lastText: "" };
}

function updateSelectionAngleGizmo(gizmo: SelectionAngleGizmo, it: PlanItem | null | undefined) {
  if (!it) {
    gizmo.group.visible = false;
    return;
  }
  gizmo.group.visible = true;
  const radiusM = Math.max(0.28, Math.hypot(it.w, it.d) * 0.5 * CM + 0.12);
  gizmo.ringWrap.position.set(it.x * CM, it.y * CM + 0.008, it.z * CM);
  gizmo.ringWrap.scale.set(radiusM, 1, radiusM);
  const norm = normalizeRotDeg(it.rot);
  gizmo.pointerPivot.rotation.y = (-norm * Math.PI) / 180;

  const degStr = Number.isInteger(norm) ? `${norm}°` : `${norm.toFixed(1)}°`;
  const text = `↻ หมุน ${degStr}`;
  if (gizmo.lastText !== text) {
    gizmo.lastText = text;
    const { ctx, canvas } = gizmo;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(6, 8, canvas.width - 12, canvas.height - 16, 36);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    gizmo.tex.needsUpdate = true;
  }
  gizmo.badge.position.set(it.x * CM, (it.y + it.h) * CM + 0.24, it.z * CM);
}

/** ป้ายตัวเลขขนาดผนัง (sprite หันหาจอเสมอ) */
function labelSprite(text: string, night: boolean): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 80;
  const g = c.getContext("2d")!;
  g.fillStyle = night ? "rgba(20,18,26,0.85)" : "rgba(255,255,255,0.92)";
  g.beginPath();
  g.roundRect(4, 8, 248, 64, 32);
  g.fill();
  g.fillStyle = night ? "#f5f3ff" : "#0f172a";
  g.font = "bold 38px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(0.62, 0.2, 1);
  sp.renderOrder = 10;
  return sp;
}

/** ลายพื้นไม้ (ไม้ลามิเนตแผ่นยาว) */
function floorTexture(room: RoomSize) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  let seed = 9;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    let x = -r() * 200;
    while (x < 512) {
      const len = 160 + r() * 160;
      const t = 0.82 + r() * 0.18;
      g.fillStyle = `rgb(${Math.round(184 * t)},${Math.round(140 * t)},${Math.round(98 * t)})`;
      g.fillRect(x, i * 64, len, 64);
      g.fillStyle = "rgba(60,35,15,0.35)";
      g.fillRect(x, i * 64, 2, 64);
      x += len;
    }
    g.fillStyle = "rgba(60,35,15,0.3)";
    g.fillRect(0, i * 64, 512, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(room.w / 160, room.d / 160);
  tex.anisotropy = 8;
  return tex;
}

interface DynamicWallSeg {
  edgeIndex: number;
  isInterior?: boolean;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  mx: number;
  mz: number;
  nx: number;
  nz: number;
  factor: number;
  targetFull: boolean;
  upperPivot: THREE.Group;
  decorGroup: THREE.Group;
  cutGroup: THREE.Group;
}

const SAMPLES_WHEN_UP = [0.04, 0.16, 0.3, 0.5, 0.7, 0.84, 0.96];
const SAMPLES_WHEN_DOWN = [0.006, 0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92, 0.994];

/**
 * ตรวจสอบว่ากำแพงด้านนี้ควรซ่อนหลบลงหรือไม่เมื่อมองจากกล้อง (camX, camZ):
 * 1) กำแพงหันด้านนอกเข้าหากล้อง หรือทำมุมเฉียดแนวสายตา (dot > threshold)
 * 2) สำหรับห้องตัว L / ตัว U / ทรงหลายเหลี่ยม: หากแนวสายตาจากกล้องพุ่งทะลุกำแพงนี้ไปเจอพื้นที่ห้องส่วนอื่นที่อยู่ด้านหลัง (แปลว่ากำแพงนี้ตั้งขวางบังห้องอีกโซนอยู่) ให้ซ่อนกำแพงนี้ลงอัตโนมัติ!
 * 3) สำหรับกำแพงกั้นภายในห้อง (isInterior): ตั้งแสดงให้เห็นโซนกั้นห้องชัดเจน และหลบลงเฉพาะตอนซูมกล้องเข้าไปใกล้ประชิด
 */
function shouldHideWallForCamera(
  seg: DynamicWallSeg,
  camX: number,
  camZ: number,
  polyM: Array<[number, number]>,
  currentlyFull: boolean
): boolean {
  if (seg.isInterior) {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const lenSq = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((camX - seg.x1) * dx + (camZ - seg.z1) * dz) / lenSq));
    const px = seg.x1 + dx * t;
    const pz = seg.z1 + dz * t;
    const dist = Math.hypot(camX - px, camZ - pz);
    return dist < (currentlyFull ? 1.05 : 1.25);
  }

  const dotThreshold = currentlyFull ? -0.14 : -0.22;
  for (const t of [0.1, 0.5, 0.9]) {
    const px = seg.x1 + (seg.x2 - seg.x1) * t;
    const pz = seg.z1 + (seg.z2 - seg.z1) * t;
    const dwx = camX - px;
    const dwz = camZ - pz;
    const dLen = Math.hypot(dwx, dwz) || 1;
    const dot = (dwx * seg.nx + dwz * seg.nz) / dLen;
    if (dot > dotThreshold) return true;
  }

  // ตรวจการบดบังพื้นที่ห้องโซนอื่นด้านหลังกำแพง (สำคัญสำหรับห้องตัว L, ตัว U และทรงเว้ามุมทุกแบบ)
  const n = polyM.length;
  if (n > 3) {
    const samples = currentlyFull ? SAMPLES_WHEN_UP : SAMPLES_WHEN_DOWN;
    const vMargin = currentlyFull ? 0.002 : 0.001;
    for (const t of samples) {
      const px = seg.x1 + (seg.x2 - seg.x1) * t;
      const pz = seg.z1 + (seg.z2 - seg.z1) * t;
      const rx = px - camX;
      const rz = pz - camZ;

      for (let j = 0; j < n; j++) {
        if (j === seg.edgeIndex) continue;
        const [ax, az] = polyM[j];
        const [bx, bz] = polyM[(j + 1) % n];
        const sx = bx - ax;
        const sz = bz - az;
        const denom = rx * sz - rz * sx;
        if (Math.abs(denom) < 1e-7) continue;

        const apx = ax - px;
        const apz = az - pz;
        const u = (apx * sz - apz * sx) / denom;
        if (u <= 0.008) continue;

        const v = (apx * rz - apz * rx) / denom;
        if (v >= vMargin && v <= 1 - vMargin) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * ห้อง 3D แบบไดโอรามา พร้อมระบบซ่อนกำแพงด้านหน้ากล้องอัตโนมัติ (Dynamic Camera-Facing Wall Cutaway)
 * รองรับห้องสี่เหลี่ยม ห้องตัว L ห้องตัว U และทรงหลายเหลี่ยมทุกแบบ หมุนมองจากมุมไหน กำแพงที่บังสายตาจะหลบลงอัตโนมัติ 360°
 */
export const RoomPlanner3D = forwardRef<RoomPlanner3DHandle, Props>(function RoomPlanner3D(
  {
    room,
    items,
    selected,
    night,
    sunSettings,
    onSelect,
    onMove,
    onBatchMove,
    onDelete,
    onDragStateChange,
    checkDeleteZone,
  },
  ref
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    itemsRoot: THREE.Group;
    roomRoot: THREE.Group;
    wallSegments: DynamicWallSeg[];
    wallPolyM: Array<[number, number]>;
    roomHeightM: number;
    heightSprite: THREE.Sprite | null;
    lights: { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight; win: THREE.PointLight };
    meshes: Map<string, { group: THREE.Group; key: string }>;
    selBox: THREE.Box3Helper;
    selGizmo: SelectionAngleGizmo;
    fit: () => void;
    resetView: () => void;
  } | null>(null);
  const propsRef = useRef({
    room,
    items,
    selected,
    onSelect,
    onMove,
    onBatchMove,
    onDelete,
    onDragStateChange,
    checkDeleteZone,
  });
  useEffect(() => {
    propsRef.current = {
      room,
      items,
      selected,
      onSelect,
      onMove,
      onBatchMove,
      onDelete,
      onDragStateChange,
      checkDeleteZone,
    };
  }, [
    room,
    items,
    selected,
    onSelect,
    onMove,
    onBatchMove,
    onDelete,
    onDragStateChange,
    checkDeleteZone,
  ]);

  // ---------- ตั้งฉากครั้งเดียว ----------
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const isSmall = window.innerWidth < 640;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    // แสงสะท้อนรอบทิศ (ทำให้โลหะ/กระจก/ไม้เคลือบดูเป็นของจริง)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.25;
    // กล้องแบบเปอร์สเปกทีฟ (เหมือนถ่ายรูปห้องจริง ของไกลเล็กลง) แทนแบบไอโซเมตริก
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.25;
    let viewDist = 10;

    const hemi = new THREE.HemisphereLight("#fff7ec", "#8a7a6a", 1);
    const sun = new THREE.DirectionalLight("#fff1dc", 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    const win = new THREE.PointLight("#ffd8a8", 0, 6, 1.5);
    scene.add(hemi, sun, sun.target, win);

    const roomRoot = new THREE.Group();
    const itemsRoot = new THREE.Group();
    scene.add(roomRoot, itemsRoot);

    const fit = () => {
      const { room: r } = propsRef.current;
      const w = el.clientWidth || 600;
      const h = el.clientHeight || 450;
      renderer.setSize(w, h, false);
      // ระยะกล้องให้เห็นทั้งห้อง (แนวทแยงพื้น + ความสูงผนัง) ตามสัดส่วนจอ
      const span = Math.max((r.w + r.d) * 0.62 + r.h * 0.25, r.h * 1.6) * CM;
      const aspect = w / h;
      camera.aspect = aspect;
      const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
      const hHalf = Math.atan(Math.tan(vHalf) * aspect);
      viewDist = Math.max(span / 2 / Math.tan(vHalf), span / 2 / Math.tan(hHalf)) * 0.98 + span * 0.12;
      controls.minDistance = viewDist * 0.35;
      controls.maxDistance = viewDist * 1.8;
      camera.updateProjectionMatrix();
    };
    const resetView = () => {
      const { room: r } = propsRef.current;
      const c = new THREE.Vector3((r.w * CM) / 2, (r.h * CM) / 3, (r.d * CM) / 2);
      controls.target.copy(c);
      camera.position.copy(c).addScaledVector(new THREE.Vector3(6, 4.3, 6.4).normalize(), viewDist);
      controls.update();
    };

    // ประกาศก่อน frame() — ลูปเรนเดอร์อ่านค่านี้
    let drag: {
      uid: string;
      dx: number;
      dz: number;
      y: number;
      moved: boolean;
      riders: PlanItem[];
      startWallKey: string | null;
      activeWallKey: string | null;
      curRot: number;
      hasCustomRotOnStartWall: boolean;
      isOverDelete?: boolean;
      last?: { x: number; z: number; y: number; rot: number };
    } | null = null;
    let rotDrag: {
      uid: string;
      centerX: number;
      centerZ: number;
      itemY: number;
      initRot: number;
      initPointerAngleRad: number;
      riders: PlanItem[];
      moved: boolean;
      last?: { x: number; z: number; y: number; rot: number };
    } | null = null;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      // กระโดดขึ้น/ลงของแบบนุ่มๆ ตอนลากผ่านของอื่น
      for (const g of itemsRoot.children) {
        const ty = g.userData.ty as number | undefined;
        if (ty === undefined || Math.abs(g.position.y - ty) < 0.0005) continue;
        g.position.y += (ty - g.position.y) * 0.35;
        if (drag && g.userData.uid === drag.uid) selBox.box.setFromObject(g).expandByScalar(0.02);
      }
      controls.update();

      // ซ่อนกำแพงด้านหน้ากล้องและกำแพงภายในที่ขวางสายตา (รวมถึงห้องตัว L / ตัว U / ซอกเว้า) อัตโนมัติแบบนุ่มนวล 360°
      const curApi = api.current;
      const segs = curApi?.wallSegments;
      if (curApi && segs && segs.length > 0) {
        const camX = camera.position.x;
        const camZ = camera.position.z;
        const polyM = curApi.wallPolyM;
        let anchorSeg: DynamicWallSeg | null = null;

        for (const seg of segs) {
          const hide = shouldHideWallForCamera(seg, camX, camZ, polyM, seg.targetFull);
          seg.targetFull = !hide;

          const goal = seg.targetFull ? 1 : 0;
          if (Math.abs(seg.factor - goal) > 0.002) {
            seg.factor += (goal - seg.factor) * 0.24;
          } else {
            seg.factor = goal;
          }
          const showUpper = seg.factor > 0.02;
          seg.upperPivot.visible = showUpper;
          if (showUpper) {
            seg.upperPivot.scale.y = Math.max(0.01, seg.factor);
          }
          const showFullDecor = seg.factor > 0.62;
          seg.decorGroup.visible = showFullDecor;
          seg.cutGroup.visible = !showFullDecor;

          if (!anchorSeg && !seg.isInterior && seg.factor > 0.75) {
            anchorSeg = seg;
          }
        }

        // ย้ายป้าย "สูง X ม." ไปเกาะกับกำแพงฝั่งหลังที่ตั้งอยู่เสมอ ไม่ให้ลอยค้างกลางอากาศเมื่อกำแพงหน้าหลบลง
        if (curApi.heightSprite) {
          if (anchorSeg) {
            curApi.heightSprite.visible = true;
            curApi.heightSprite.position.set(anchorSeg.x1, curApi.roomHeightM + 0.16, anchorSeg.z1);
          } else {
            curApi.heightSprite.visible = false;
          }
        }
      }

      renderer.render(scene, camera);
    };
    const selBox = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color("#2563eb"));
    selBox.visible = false;
    const selGizmo = buildSelectionAngleGizmo();
    scene.add(selBox, selGizmo.group);
    api.current = {
      renderer,
      scene,
      camera,
      controls,
      itemsRoot,
      roomRoot,
      wallSegments: [],
      wallPolyM: [],
      roomHeightM: 2.6,
      heightSprite: null,
      lights: { hemi, sun, win },
      meshes: new Map(),
      selBox,
      selGizmo,
      fit,
      resetView,
    };
    fit();
    resetView();
    frame();

    // ---------- ลากของ ----------
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let downAt: { x: number; y: number } | null = null;

    const toNdc = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };
    const uidOf = (o: THREE.Object3D | null): string | null => {
      for (let x = o; x; x = x.parent) if (x.userData.uid) return x.userData.uid as string;
      return null;
    };
    const getRiders = (it: PlanItem) => {
      const itAxes = getItemAxes(it.rot);
      return propsRef.current.items.filter((o) => {
        if (o.uid === it.uid || o.y <= 0 || Math.abs(o.y - (it.y + it.h)) > 2) return false;
        const rx = o.x - it.x;
        const rz = o.z - it.z;
        const lx = Math.abs(rx * itAxes.ux + rz * itAxes.uz);
        const lz = Math.abs(rx * itAxes.vx + rz * itAxes.vz);
        return lx <= it.w * 0.55 && lz <= it.d * 0.55;
      });
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
      toNdc(e);

      // 1) ตรวจสอบว่าผู้ใช้คลิกที่ Rotation Gizmo หรือป้ายบอกมุมรอบสิ่งของที่เลือกอยู่หรือไม่
      const curSel = propsRef.current.selected;
      const selItem = curSel ? propsRef.current.items.find((i) => i.uid === curSel) : null;
      let clickedGizmo = false;
      let clickedBadge = false;
      if (selItem && selGizmo.group.visible) {
        const arrowHits = ray.intersectObjects(selGizmo.pointerPivot.children, true);
        if (arrowHits.length > 0 && arrowHits[0].object.userData?.isRotateHandle) {
          clickedGizmo = true;
        }
        if (!clickedGizmo) {
          const badgeHits = ray.intersectObject(selGizmo.badge, false);
          if (badgeHits.length > 0) {
            clickedBadge = true;
          }
        }
      }

      // 2) ตรวจสอบว่าคลิกที่โมเดลสิ่งของใดในห้องหรือไม่
      const hits = ray.intersectObjects(itemsRoot.children, true);
      const uid = hits.length ? uidOf(hits[0].object) : null;
      const isRightClick = e.button === 2 || e.altKey;

      // ก. หากคลิกที่ป้ายบอกมุม ↻ หมุน X° -> หมุนเพิ่มทีละ +45° ทันที
      if (clickedBadge && selItem) {
        e.preventDefault();
        e.stopPropagation();
        const next = rotateItemSafely(selItem, selItem.rot + 45, propsRef.current.items, propsRef.current.room);
        propsRef.current.onMove(selItem.uid, next.x, next.z, next.y, next.rot);
        return;
      }

      // ข. หากคลิกที่ปุ่ม/วงแหวนหมุนรอบสิ่งของ → เข้าสู่โหมดหมุนด้วยเมาส์ 360° ทันที
      if (clickedGizmo && selItem) {
        e.preventDefault();
        e.stopPropagation();
        controls.enabled = false;
        renderer.domElement.setPointerCapture(e.pointerId);
        plane.constant = -selItem.y * CM;
        if (!ray.ray.intersectPlane(plane, hit)) return;

        const centerX = selItem.x * CM;
        const centerZ = selItem.z * CM;
        rotDrag = {
          uid: selItem.uid,
          centerX,
          centerZ,
          itemY: selItem.y,
          initRot: selItem.rot,
          initPointerAngleRad: Math.atan2(hit.x - centerX, hit.z - centerZ),
          riders: getRiders(selItem),
          moved: false,
          last: { x: selItem.x, z: selItem.z, y: selItem.y, rot: selItem.rot },
        };
        renderer.domElement.style.cursor = "grabbing";
        return;
      }

      // ค. หากคลิกขวาที่ตัวสิ่งของ → หมุนสิ่งของด้วยเมาส์ 360° ทันที
      if (uid && isRightClick) {
        const it = propsRef.current.items.find((i) => i.uid === uid);
        if (!it) return;
        e.preventDefault();
        e.stopPropagation();
        propsRef.current.onSelect(uid);
        controls.enabled = false;
        renderer.domElement.setPointerCapture(e.pointerId);
        plane.constant = -it.y * CM;
        if (!ray.ray.intersectPlane(plane, hit)) return;

        const centerX = it.x * CM;
        const centerZ = it.z * CM;
        rotDrag = {
          uid: it.uid,
          centerX,
          centerZ,
          itemY: it.y,
          initRot: it.rot,
          initPointerAngleRad: Math.atan2(hit.x - centerX, hit.z - centerZ),
          riders: getRiders(it),
          moved: false,
          last: { x: it.x, z: it.z, y: it.y, rot: it.rot },
        };
        renderer.domElement.style.cursor = "grabbing";
        return;
      }

      // ง. หากคลิกซ้ายที่ตัวสิ่งของ → โหมดเลื่อนตำแหน่ง
      if (!uid) return;
      const it = propsRef.current.items.find((i) => i.uid === uid);
      if (!it) return;
      plane.constant = -it.y * CM;
      if (!ray.ray.intersectPlane(plane, hit)) return;

      const initProbe = clampToRoom({ ...it }, propsRef.current.room);
      const initWall = findNearestWallForItem(initProbe, propsRef.current.room, 28);

      const angleDiff = initWall
        ? Math.abs((((normalizeRotDeg(it.rot) - initWall.targetRot + 180) % 360 + 360) % 360) - 180)
        : 0;

      // ถ้าสิ่งของปัจจุบันมีองศาที่แตกต่างจากองศากำแพงเดิมเกิน 5° แสดงว่าเป็นองศาที่ตั้งใจหมุนไว้สำหรับกำแพงด้านนี้ (เช่น กั้นห้อง, เข้ามุม)
      const hasCustomRotOnStartWall = initWall ? angleDiff > 5 : false;

      drag = {
        uid,
        dx: it.x - hit.x / CM,
        dz: it.z - hit.z / CM,
        y: it.y,
        moved: false,
        riders: getRiders(it),
        startWallKey: initWall?.key ?? null,
        activeWallKey: initWall?.key ?? null,
        curRot: it.rot,
        hasCustomRotOnStartWall,
        isOverDelete: false,
      };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
      propsRef.current.onSelect(uid);
      propsRef.current.onDragStateChange?.(true, false, uid);
    };
    const onMoveEv = (e: PointerEvent) => {
      // 1) โหมดหมุนด้วยเมาส์ (Mouse Rotation)
      if (rotDrag) {
        toNdc(e);
        plane.constant = -rotDrag.itemY * CM;
        if (!ray.ray.intersectPlane(plane, hit)) return;

        const curAngleRad = Math.atan2(hit.x - rotDrag.centerX, hit.z - rotDrag.centerZ);
        const deltaRad = curAngleRad - rotDrag.initPointerAngleRad;
        const deltaDeg = (deltaRad * 180) / Math.PI;
        let newRot = normalizeRotDeg(rotDrag.initRot + deltaDeg);
        if (e.shiftKey) {
          // กด Shift สแนปทีละ 15 องศา
          newRot = Math.round(newRot / 15) * 15;
        }

        const curRoom = propsRef.current.room;
        const allItems = propsRef.current.items;
        const base = allItems.find((i) => i.uid === rotDrag!.uid);
        if (!base) return;

        const riderIds = new Set(rotDrag.riders.map((r) => r.uid));
        const nonRiders = riderIds.size > 0 ? allItems.filter((o) => !riderIds.has(o.uid)) : allItems;
        const next = rotateItemSafely(base, newRot, nonRiders, curRoom);

        rotDrag.last = { x: next.x, z: next.z, y: next.y, rot: next.rot };
        rotDrag.moved = true;

        const curApi = api.current;
        const m = curApi?.meshes.get(base.uid);
        if (m && curApi) {
          m.group.position.x = next.x * CM;
          m.group.position.z = next.z * CM;
          m.group.rotation.y = (-next.rot * Math.PI) / 180;
          m.group.updateMatrixWorld(true);
          curApi.selBox.box.setFromObject(m.group).expandByScalar(0.02);
          updateSelectionAngleGizmo(curApi.selGizmo, next);
        }

        const dRad = ((next.rot - base.rot) * Math.PI) / 180;
        const cosD = Math.cos(dRad);
        const sinD = Math.sin(dRad);
        for (const r of rotDrag.riders) {
          const rm = curApi?.meshes.get(r.uid);
          if (!rm) continue;
          const rx = r.x - base.x;
          const rz = r.z - base.z;
          const rnx = next.x + rx * cosD - rz * sinD;
          const rnz = next.z + rx * sinD + rz * cosD;
          const rRot = normalizeRotDeg(r.rot + (next.rot - base.rot));
          rm.group.position.x = rnx * CM;
          rm.group.position.z = rnz * CM;
          rm.group.userData.ty = (r.y + next.y - base.y) * CM;
          rm.group.rotation.y = (-rRot * Math.PI) / 180;
        }
        return;
      }

      // 2) เมาส์ชี้ผ่าน (Hover Effect เปลี่ยน Cursor)
      if (!drag) {
        toNdc(e);
        const curSel = propsRef.current.selected;
        const selItem = curSel ? propsRef.current.items.find((i) => i.uid === curSel) : null;
        let hoverGizmo = false;
        if (selItem && selGizmo.group.visible) {
          const arrowHits = ray.intersectObjects(selGizmo.pointerPivot.children, true);
          if (arrowHits.length > 0 && arrowHits[0].object.userData?.isRotateHandle) {
            hoverGizmo = true;
          }
          if (!hoverGizmo) {
            const bHits = ray.intersectObject(selGizmo.badge, false);
            if (bHits.length > 0) hoverGizmo = true;
          }
        }
        if (hoverGizmo) {
          renderer.domElement.style.cursor = "grab";
        } else {
          const hits = ray.intersectObjects(itemsRoot.children, true);
          renderer.domElement.style.cursor = hits.length > 0 ? "pointer" : "default";
        }
        return;
      }

      // 3) โหมดเลื่อนตำแหน่งสิ่งของ (Move Drag)
      const isOverDelete = Boolean(
        propsRef.current.checkDeleteZone?.(e.clientX, e.clientY) ||
        (typeof document !== "undefined" &&
          document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-catalog-sidebar='true'], [data-drop-delete-zone='true']"))
      );
      if (drag.isOverDelete !== isOverDelete) {
        drag.isOverDelete = isOverDelete;
        propsRef.current.onDragStateChange?.(true, isOverDelete, drag.uid);
        const curApi = api.current;
        if (curApi) {
          (curApi.selBox.material as THREE.LineBasicMaterial).color.setHex(isOverDelete ? 0xf43f5e : 0x2563eb);
        }
      }
      if (isOverDelete) {
        renderer.domElement.style.cursor = "not-allowed";
      } else {
        renderer.domElement.style.cursor = "grabbing";
      }

      toNdc(e);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      const snap = (v: number) => Math.round(v * 2) / 2;
      const base = propsRef.current.items.find((i) => i.uid === drag!.uid);
      if (!base) return;

      const rawX = snap(hit.x / CM + drag.dx);
      const rawZ = snap(hit.z / CM + drag.dz);
      const curRoom = propsRef.current.room;
      const allItems = propsRef.current.items;

      // เมื่อลากสิ่งของเข้าไปชิด/ติดกำแพงห้องจริง (ระยะประชิด <= 14 ซม.) ถึงค่อยปรับหมุนตามกำแพง
      // ถ้าผู้ใช้เคยตั้งองศาไว้เอง (preserveRot) จะไม่หมุนตามกำแพงกลับไปเองเด็ดขาด ("ไม่ยึดติดหรือหมุนไปเอง")
      const isChairNearDesk =
        base.category === "chair" &&
        allItems.some(
          (o) =>
            o.uid !== base.uid &&
            o.category === "desk" &&
            Math.hypot(o.x - rawX, o.z - rawZ) <= Math.max(o.w, o.d) * 0.72 + 45
        );
      if (!e.shiftKey && !isChairNearDesk) {
        const probe = clampToRoom({ ...base, x: rawX, z: rawZ, rot: drag.curRot }, curRoom);
        const nearWall = findNearestWallForItem(probe, curRoom, 14, drag.activeWallKey);
        if (!nearWall) {
          // ปลดล็อกการเกาะกำแพงเมื่อดึงสิ่งของออกมาห่างกำแพงเกิน 24 ซม.
          if (!findNearestWallForItem(probe, curRoom, 24, drag.activeWallKey)) {
            drag.activeWallKey = null;
          }
        } else {
          const isSameWall = drag.startWallKey !== null && nearWall.key === drag.startWallKey;
          if (isSameWall && drag.hasCustomRotOnStartWall) {
            // ถ้าเป็นกำแพงด้านเดิมในจุดที่มันหันอยู่ตอนกดสิ่งของนั้น จะขยับได้โดยไม่ปรับมุมเอง
            drag.activeWallKey = nearWall.key;
          } else if (nearWall.key !== drag.activeWallKey) {
            // แต่ถ้าขยับไปอีกกำแพงหนึ่ง หรือลากมาจากกลางห้อง มันถึงจะค่อยปรับหมุนตามกำแพงใหม่
            drag.curRot = nearWall.targetRot;
            drag.activeWallKey = nearWall.key;
            drag.startWallKey = nearWall.key;
            drag.hasCustomRotOnStartWall = false;
          }
        }
      }

      const riderIds = new Set(drag.riders.map((r) => r.uid));
      const nonRiders = riderIds.size > 0 ? allItems.filter((o) => !riderIds.has(o.uid)) : allItems;

      // เริ่มจากตำแหน่งล่าสุดที่วางได้ แล้วขยับไปหาเมาส์โดยไม่ทะลุกำแพงและไม่ทับของอื่น
      const it = drag.last
        ? { ...base, x: drag.last.x, z: drag.last.z, y: drag.last.y, rot: drag.curRot }
        : { ...base, rot: drag.curRot };
      const next = dragTo(it, { x: rawX, z: rawZ }, nonRiders, curRoom);
      drag.moved = true;

      const curApi = api.current;
      const m = curApi?.meshes.get(it.uid);
      if (m && curApi) {
        m.group.position.x = next.x * CM;
        m.group.position.z = next.z * CM;
        m.group.userData.ty = next.y * CM;
        m.group.rotation.y = (-next.rot * Math.PI) / 180;
        m.group.updateMatrixWorld(true);
        curApi.selBox.box.setFromObject(m.group).expandByScalar(0.02);
        updateSelectionAngleGizmo(curApi.selGizmo, next);
      }

      const dRad = ((next.rot - base.rot) * Math.PI) / 180;
      const cosD = Math.cos(dRad);
      const sinD = Math.sin(dRad);
      for (const r of drag.riders) {
        const rm = curApi?.meshes.get(r.uid);
        if (!rm) continue;
        const rx = r.x - base.x;
        const rz = r.z - base.z;
        const rnx = next.x + rx * cosD - rz * sinD;
        const rnz = next.z + rx * sinD + rz * cosD;
        const rRot = normalizeRotDeg(r.rot + (next.rot - base.rot));
        rm.group.position.x = rnx * CM;
        rm.group.position.z = rnz * CM;
        rm.group.userData.ty = (r.y + next.y - base.y) * CM;
        rm.group.rotation.y = (-rRot * Math.PI) / 180;
      }
      drag.last = { x: next.x, z: next.z, y: next.y, rot: next.rot };
    };
    const onUp = (e: PointerEvent) => {
      // ก. โหมดหมุนด้วยเมาส์ (Mouse Rotation) สิ้นสุด
      if (rotDrag) {
        if (rotDrag.moved && rotDrag.last) {
          const curRoom = propsRef.current.room;
          const base = propsRef.current.items.find((i) => i.uid === rotDrag!.uid);
          if (base) {
            if (rotDrag.riders.length > 0) {
              const dRad = ((rotDrag.last.rot - base.rot) * Math.PI) / 180;
              const cosD = Math.cos(dRad);
              const sinD = Math.sin(dRad);
              const moves: Array<{ uid: string; x: number; z: number; y: number; rot: number }> = [
                { uid: base.uid, x: rotDrag.last.x, z: rotDrag.last.z, y: rotDrag.last.y, rot: rotDrag.last.rot },
              ];
              for (const r of rotDrag.riders) {
                const rx = r.x - base.x;
                const rz = r.z - base.z;
                const rClamped = clampToRoom(
                  {
                    ...r,
                    x: Math.round((rotDrag.last.x + rx * cosD - rz * sinD) * 10) / 10,
                    z: Math.round((rotDrag.last.z + rx * sinD + rz * cosD) * 10) / 10,
                    y: r.y + (rotDrag.last.y - base.y),
                    rot: normalizeRotDeg(r.rot + (rotDrag.last.rot - base.rot)),
                  },
                  curRoom
                );
                moves.push({
                  uid: r.uid,
                  x: rClamped.x,
                  z: rClamped.z,
                  y: rClamped.y,
                  rot: rClamped.rot,
                });
              }
              if (propsRef.current.onBatchMove) {
                propsRef.current.onBatchMove(moves);
              } else {
                for (const mv of moves) propsRef.current.onMove(mv.uid, mv.x, mv.z, mv.y, mv.rot);
              }
            } else {
              propsRef.current.onMove(base.uid, rotDrag.last.x, rotDrag.last.z, rotDrag.last.y, rotDrag.last.rot);
            }
          }
        }
        rotDrag = null;
        downAt = null;
        controls.enabled = true;
        renderer.domElement.style.cursor = "default";
        return;
      }

      // ข. โหมดเลื่อนตำแหน่ง (Move Drag) สิ้นสุด
      const d = drag;
      if (d) {
        propsRef.current.onDragStateChange?.(false, false, null);
        const curApi = api.current;
        if (curApi) {
          (curApi.selBox.material as THREE.LineBasicMaterial).color.setHex(0x2563eb);
        }

        const isOverDelete = Boolean(
          d.isOverDelete ||
          propsRef.current.checkDeleteZone?.(e.clientX, e.clientY) ||
          (typeof document !== "undefined" &&
            document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-catalog-sidebar='true'], [data-drop-delete-zone='true']"))
        );
        if (isOverDelete) {
          // ลากตัวสินค้ามาปล่อยที่คลังสินค้า/ขอบขวาเพื่อลบทันที!
          const deletedUid = d.uid;
          drag = null;
          downAt = null;
          controls.enabled = true;
          renderer.domElement.style.cursor = "default";
          propsRef.current.onSelect(null);
          if (propsRef.current.onDelete) {
            propsRef.current.onDelete(deletedUid);
          }
          return;
        }
      }

      if (d?.moved && d.last) {
        const curRoom = propsRef.current.room;
        const base = propsRef.current.items.find((i) => i.uid === d.uid);
        // ปล่อยบนของ → ขยับให้อยู่บนพื้นผิวเต็มตัวและไม่ทะลุกำแพง
        const fin = base
          ? settleOnTop({ ...base, ...d.last }, propsRef.current.items, curRoom)
          : { ...d.last };

        if (base && d.riders.length > 0) {
          const dRad = ((fin.rot - base.rot) * Math.PI) / 180;
          const cosD = Math.cos(dRad);
          const sinD = Math.sin(dRad);
          const moves: Array<{ uid: string; x: number; z: number; y: number; rot: number }> = [
            { uid: d.uid, x: fin.x, z: fin.z, y: fin.y, rot: fin.rot },
          ];
          for (const r of d.riders) {
            const rx = r.x - base.x;
            const rz = r.z - base.z;
            const rClamped = clampToRoom(
              {
                ...r,
                x: Math.round((fin.x + rx * cosD - rz * sinD) * 10) / 10,
                z: Math.round((fin.z + rx * sinD + rz * cosD) * 10) / 10,
                y: r.y + fin.y - base.y,
                rot: normalizeRotDeg(r.rot + (fin.rot - base.rot)),
              },
              curRoom
            );
            moves.push({
              uid: r.uid,
              x: rClamped.x,
              z: rClamped.z,
              y: rClamped.y,
              rot: rClamped.rot,
            });
          }
          if (propsRef.current.onBatchMove) {
            propsRef.current.onBatchMove(moves);
          } else {
            for (const mv of moves) propsRef.current.onMove(mv.uid, mv.x, mv.z, mv.y, mv.rot);
          }
        } else {
          propsRef.current.onMove(d.uid, fin.x, fin.z, fin.y, fin.rot);
        }
      }
      if (!d && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5) propsRef.current.onSelect(null);
      drag = null;
      downAt = null;
      controls.enabled = true;
      renderer.domElement.style.cursor = "default";
    };
    const onDragKeyRotate = (e: KeyboardEvent) => {
      if (!drag) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.code === "KeyR" || e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.shiftKey ? -45 : 45;
        drag.curRot = normalizeRotDeg(drag.curRot + delta);
        drag.hasCustomRotOnStartWall = true;
        if (drag.activeWallKey) {
          drag.startWallKey = drag.activeWallKey;
        }

        const curRoom = propsRef.current.room;
        const allItems = propsRef.current.items;
        const base = allItems.find((i) => i.uid === drag!.uid);
        if (!base) return;

        const riderIds = new Set(drag.riders.map((r) => r.uid));
        const nonRiders = riderIds.size > 0 ? allItems.filter((o) => !riderIds.has(o.uid)) : allItems;

        const it = drag.last
          ? { ...base, x: drag.last.x, z: drag.last.z, y: drag.last.y, rot: drag.curRot }
          : { ...base, rot: drag.curRot };
        const next = dragTo(it, { x: it.x, z: it.z }, nonRiders, curRoom);
        drag.last = { x: next.x, z: next.z, y: next.y, rot: next.rot };

        const curApi = api.current;
        const m = curApi?.meshes.get(it.uid);
        if (m && curApi) {
          m.group.position.x = next.x * CM;
          m.group.position.z = next.z * CM;
          m.group.userData.ty = next.y * CM;
          m.group.rotation.y = (-next.rot * Math.PI) / 180;
          m.group.updateMatrixWorld(true);
          curApi.selBox.box.setFromObject(m.group).expandByScalar(0.02);
          updateSelectionAngleGizmo(curApi.selGizmo, next);
        }

        const dRad = ((next.rot - base.rot) * Math.PI) / 180;
        const cosD = Math.cos(dRad);
        const sinD = Math.sin(dRad);
        for (const r of drag.riders) {
          const rm = curApi?.meshes.get(r.uid);
          if (!rm) continue;
          const rx = r.x - base.x;
          const rz = r.z - base.z;
          const rnx = next.x + rx * cosD - rz * sinD;
          const rnz = next.z + rx * sinD + rz * cosD;
          const rRot = normalizeRotDeg(r.rot + (next.rot - base.rot));
          rm.group.position.x = rnx * CM;
          rm.group.position.z = rnz * CM;
          rm.group.userData.ty = (r.y + next.y - base.y) * CM;
          rm.group.rotation.y = (-rRot * Math.PI) / 180;
        }
      }
    };
    window.addEventListener("keydown", onDragKeyRotate, true);
    const onCancelEv = () => {
      if (drag) {
        propsRef.current.onDragStateChange?.(false, false, null);
        drag = null;
      }
      rotDrag = null;
      downAt = null;
      controls.enabled = true;
      renderer.domElement.style.cursor = "default";
    };
    renderer.domElement.addEventListener("contextmenu", onContextMenu);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMoveEv);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onCancelEv);
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onDragKeyRotate, true);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMoveEv);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onCancelEv);
      controls.dispose();
      for (const { group } of api.current?.meshes.values() ?? []) disposeGroup(group);
      selGizmo.group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | undefined;
        mat?.dispose?.();
      });
      selGizmo.tex.dispose();
      roomRoot.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  // ---------- ตัวห้อง (สร้างใหม่เมื่อขนาด/โหมดไฟเปลี่ยน) ----------
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    a.roomRoot.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.MeshStandardMaterial | undefined;
      mat?.map?.dispose();
      mat?.dispose?.();
    });
    a.roomRoot.clear();
    a.wallSegments = [];
    const W = room.w * CM;
    const D = room.d * CM;
    const H = room.h * CM;
    const T = 0.1;
    const wallTex = plasterTex(night ? "#7a6670" : "#efe9e1").clone();
    wallTex.needsUpdate = true;
    wallTex.repeat.set(Math.max(1, room.w / 150), Math.max(1, room.h / 150));
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92 });
    const trim = new THREE.MeshStandardMaterial({ color: night ? "#e9e1d6" : "#f8f6f2", roughness: 0.7 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      m.castShadow = shadow;
      a.roomRoot.add(m);
      return m;
    };
    // หน้าต่าง (มีมู่ลี่ + ผ้าม่าน) — ด้านหน้าของกลุ่ม (+z) หันเข้าห้อง
    const winWall = room.win?.wall ?? "back";
    const winPos = room.win?.pos ?? 0.68;
    const wy = H * 0.58;
    const winH = Math.min(1.2, H * 0.45);
    const winLight = new THREE.Vector3(W * winPos, wy, 0.5);
    let hasWin = winWall !== "none";
    const buildWindow = (maxSpanM: number, customWidthM?: number, maxSideOverhangM = 0.11) => {
      const winW = customWidthM
        ? Math.min(Math.max(0.4, customWidthM), Math.max(0.4, maxSpanM - maxSideOverhangM * 2))
        : Math.min(1.4, Math.max(0.4, maxSpanM * 0.4));
      const grp = new THREE.Group();
      const local = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        grp.add(m);
      };
      local(new THREE.BoxGeometry(winW + 0.08, winH + 0.08, 0.04), trim, 0, 0, -0.02);
      local(
        new THREE.BoxGeometry(winW, winH, 0.02),
        new THREE.MeshStandardMaterial({ color: night ? "#1f2a4d" : "#dff1ff", emissive: night ? "#29386b" : "#cfe9ff", emissiveIntensity: night ? 0.5 : 0.9 }),
        0,
        0,
        0
      );
      const slat = new THREE.MeshStandardMaterial({ color: "#f3efe6", roughness: 0.6 });
      for (let i = 0; i < 12; i++) local(new THREE.BoxGeometry(winW, 0.012, 0.03), slat, 0, winH / 2 - (i + 0.5) * (winH / 12), 0.03);
      // ผ้าม่านสองข้างหน้าต่าง (พับเก็บชิดขอบวงกบในระยะปลอดภัย ไม่ยื่นทะลุกำแพงข้างเคียง)
      const curtainTex = fabricTex(night ? "#5b4b6e" : "#d9cbb5").clone();
      curtainTex.needsUpdate = true;
      curtainTex.repeat.set(3, 1);
      const curtain = new THREE.MeshStandardMaterial({ map: curtainTex, roughness: 0.95, side: THREE.DoubleSide });
      const cw = Math.min(0.24, Math.max(0.12, winW * 0.2));
      const ch = Math.min(H - 0.15, winH + 0.6);
      const curtainOut = Math.min(cw * 0.3, Math.max(0.02, maxSideOverhangM - 0.035));
      for (const side of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(cw, ch, 24, 1);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / cw) * Math.PI * 6) * 0.018);
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, curtain);
        m.position.set(side * (winW / 2 - cw / 2 + curtainOut), (wy + winH / 2 + 0.12) - ch / 2 - wy, 0.07);
        m.castShadow = true;
        grp.add(m);
      }
      const rodLen = winW + (curtainOut + 0.03) * 2;
      local(new THREE.CylinderGeometry(0.012, 0.012, rodLen, 12).rotateZ(Math.PI / 2), trim, 0, winH / 2 + 0.14, 0.08);
      return { grp, winW };
    };

    const buildWallDoor = (along: number, customWidthM: number, fullWall: boolean) => {
      const dw = Math.min(Math.max(0.6, customWidthM), Math.max(0.6, along - 0.14));
      const dh = Math.min(2.05, H - 0.12);
      const grp = new THREE.Group();
      const leafMat = new THREE.MeshStandardMaterial({ color: night ? "#3b3530" : "#e7dfd3", roughness: 0.65 });
      const handleMat = new THREE.MeshStandardMaterial({ color: "#d4af37", metalness: 0.85, roughness: 0.25 });
      if (fullWall) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.1, dh + 0.05, 0.05), trim);
        frame.position.set(0, dh / 2, 0.01);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.04), leafMat);
        leaf.position.set(0, dh / 2, 0.025);
        leaf.castShadow = true;
        leaf.receiveShadow = true;
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 14, 14), handleMat);
        knob.position.set(dw * 0.36, 0.98, 0.06);
        grp.add(frame, leaf, knob);
      } else {
        // ผนังฝั่งใกล้กล้องที่ตัดเตี้ย: แสดงธรณีประตูและเสาวงกบเตี้ยเพื่อให้เห็นตำแหน่งประตูชัดโดยไม่บังมุมมองห้อง
        const sill = new THREE.Mesh(
          new THREE.BoxGeometry(dw, 0.04, T + 0.06),
          new THREE.MeshStandardMaterial({ color: "#60a5fa", roughness: 0.45 })
        );
        sill.position.set(0, 0.13, -T / 2);
        const postL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, T + 0.04), trim);
        postL.position.set(-dw / 2, 0.11, -T / 2);
        const postR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, T + 0.04), trim);
        postR.position.set(dw / 2, 0.11, -T / 2);
        grp.add(sill, postL, postR);
      }
      return grp;
    };
    const m = (cm: number) => `${(cm / 100).toFixed(2).replace(/\.?0+$/, "")} ม.`;
    let ledMat: THREE.MeshStandardMaterial | null = null;
    const led = () => (ledMat ??= new THREE.MeshStandardMaterial({ color: "#c084fc", emissive: "#c084fc", emissiveIntensity: 2.5 }));
    const isCustomShape = Boolean(room.shape && room.shape.length >= 3);
    const poly: [number, number][] =
      room.shape && room.shape.length >= 3
        ? room.shape
        : [
            [0, 0],
            [room.w, 0],
            [room.w, room.d],
            [0, room.d],
          ];

    if (isCustomShape) {
      // ---------- พื้นตามแปลนหลายเหลี่ยมที่วาดเอง ----------
      const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x * CM, -z * CM)));
      const base = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }).rotateX(-Math.PI / 2);
      add(base, new THREE.MeshStandardMaterial({ color: night ? "#2a2326" : "#d8d2ca", roughness: 1 }), 0, -0.32, 0);
      const ft = floorTexture(room);
      ft.repeat.set(1 / 1.6, 1 / 1.6);
      add(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.55 }), 0, 0, 0, false);
    } else {
      // ---------- พื้นห้องสี่เหลี่ยมมาตรฐาน ----------
      add(new THREE.BoxGeometry(W + T * 2 + 0.3, 0.3, D + T * 2 + 0.3), new THREE.MeshStandardMaterial({ color: night ? "#2a2326" : "#d8d2ca", roughness: 1 }), W / 2, -0.15 - 0.02, D / 2);
      add(new THREE.BoxGeometry(W, 0.02, D), new THREE.MeshStandardMaterial({ map: floorTexture(room), roughness: 0.55 }), W / 2, -0.01, D / 2, false);
    }

    // ---------- สร้างผนังทุกด้านพร้อมระบบซ่อนกำแพงด้านหน้ากล้องอัตโนมัติ (Dynamic Cutaway) ----------
    const lk = Math.min(1, Math.max(0.75, Math.max(W, D) / 4));
    const curbH = 0.1;
    const upperH = Math.max(0.1, H - curbH);
    const camPos = a.camera.position;
    const polyM: Array<[number, number]> = poly.map(([px, pz]) => [px * CM, pz * CM]);
    a.wallPolyM = polyM;
    a.roomHeightM = H;
    a.heightSprite = null;

    const walls = poly.map(([x1, z1], i) => {
      const [x2, z2] = poly[(i + 1) % poly.length];
      const lenCm = Math.hypot(x2 - x1, z2 - z1) || 1;
      const ex = (x2 - x1) / lenCm;
      const ez = (z2 - z1) / lenCm;
      const nx = ez;
      const nz = -ex; // ทิศออกนอกห้อง
      const len = lenCm * CM;
      const x1M = x1 * CM;
      const z1M = z1 * CM;
      const x2M = x2 * CM;
      const z2M = z2 * CM;
      const mx = x1M + (ex * len) / 2;
      const mz = z1M + (ez * len) / 2;
      const rot = Math.atan2(-ez, ex);

      // 1) ขอบฐานเตี้ยติดพื้น 10 ซม. (อยู่ตลอดเพื่อให้เห็นแนวขอบห้องชัดแม้กำแพงหลบลง)
      const curb = add(
        new THREE.BoxGeometry(len + T, curbH, T),
        wallMat,
        mx + (nx * T) / 2,
        curbH / 2,
        mz + (nz * T) / 2
      );
      curb.rotation.y = rot;

      // 2) ตัวกำแพงเต็มความสูง (ย่อ/ขยายขึ้นลงอัตโนมัติเมื่อหมุนกล้อง)
      const upperPivot = new THREE.Group();
      upperPivot.position.set(mx + (nx * T) / 2, curbH, mz + (nz * T) / 2);
      upperPivot.rotation.y = rot;
      const upperMesh = new THREE.Mesh(new THREE.BoxGeometry(len + T, upperH, T), wallMat);
      upperMesh.position.set(0, upperH / 2, 0);
      upperMesh.castShadow = true;
      upperMesh.receiveShadow = true;
      upperPivot.add(upperMesh);
      a.roomRoot.add(upperPivot);

      // 3) กลุ่มของตกแต่งบนผนังเต็ม (บัวพื้น + ไฟ LED ฝ้า + หน้าต่าง 3D + ประตู 3D)
      const decorGroup = new THREE.Group();
      // 4) กลุ่มสัญลักษณ์ขอบเตี้ยเมื่อกำแพงด้านหน้าหลบลง (ขอบหน้าต่างสีแดง / ธรณีประตูสีฟ้า)
      const cutGroup = new THREE.Group();
      a.roomRoot.add(decorGroup, cutGroup);

      const tr = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.015), trim);
      tr.position.set(mx - nx * 0.008, 0.04, mz - nz * 0.008);
      tr.rotation.y = rot;
      decorGroup.add(tr);

      if (night) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.02), led());
        l.position.set(mx - nx * 0.03, H - 0.05, mz - nz * 0.03);
        l.rotation.y = rot;
        decorGroup.add(l);
      }

      const seg: DynamicWallSeg = {
        edgeIndex: i,
        x1: x1M,
        z1: z1M,
        x2: x2M,
        z2: z2M,
        mx,
        mz,
        nx,
        nz,
        factor: 1,
        targetFull: true,
        upperPivot,
        decorGroup,
        cutGroup,
      };
      const initHide = shouldHideWallForCamera(seg, camPos.x, camPos.z, polyM, true);
      seg.targetFull = !initHide;
      seg.factor = initHide ? 0 : 1;

      upperPivot.visible = !initHide;
      upperPivot.scale.y = !initHide ? 1 : 0.01;
      decorGroup.visible = !initHide;
      cutGroup.visible = initHide;
      a.wallSegments.push(seg);

      if (isCustomShape && lenCm >= 30) {
        const lb = labelSprite(m(Math.round(lenCm)), night);
        lb.scale.multiplyScalar(lk);
        lb.position.set(mx + nx * 0.32, 0.05, mz + nz * 0.32);
        a.roomRoot.add(lb);
      }

      return { x1: x1M, z1: z1M, len, cm: lenCm, ex, ez, nx, nz, seg };
    });

    // ---------- สร้างกำแพงกั้นภายในห้อง (Interior Partition Walls) ----------
    const interiorWallMap = new Map<
      string,
      { x1: number; z1: number; len: number; cm: number; ex: number; ez: number; nx: number; nz: number; seg: DynamicWallSeg }
    >();
    if (room.interiorWalls && room.interiorWalls.length > 0) {
      room.interiorWalls.forEach((iw, idx) => {
        const lenCm = Math.hypot(iw.x2 - iw.x1, iw.z2 - iw.z1);
        if (lenCm < 25) return;
        const ex = (iw.x2 - iw.x1) / lenCm;
        const ez = (iw.z2 - iw.z1) / lenCm;
        const nx = ez;
        const nz = -ex;
        const len = lenCm * CM;
        const x1M = iw.x1 * CM;
        const z1M = iw.z1 * CM;
        const x2M = iw.x2 * CM;
        const z2M = iw.z2 * CM;
        const mx = (x1M + x2M) * 0.5;
        const mz = (z1M + z2M) * 0.5;
        const rot = Math.atan2(-ez, ex);

        const curb = add(new THREE.BoxGeometry(len, curbH, T), wallMat, mx, curbH / 2, mz);
        curb.rotation.y = rot;

        const upperPivot = new THREE.Group();
        upperPivot.position.set(mx, curbH, mz);
        upperPivot.rotation.y = rot;
        const upperMesh = new THREE.Mesh(new THREE.BoxGeometry(len, upperH, T), wallMat);
        upperMesh.position.set(0, upperH / 2, 0);
        upperMesh.castShadow = true;
        upperMesh.receiveShadow = true;
        upperPivot.add(upperMesh);
        a.roomRoot.add(upperPivot);

        const decorGroup = new THREE.Group();
        const cutGroup = new THREE.Group();
        a.roomRoot.add(decorGroup, cutGroup);

        // บัวพื้นทั้งสองฝั่งของกำแพงกั้นในห้อง
        for (const side of [-1, 1]) {
          const tr = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.015), trim);
          tr.position.set(mx + nx * side * (T / 2 + 0.006), 0.04, mz + nz * side * (T / 2 + 0.006));
          tr.rotation.y = rot;
          decorGroup.add(tr);
        }

        const seg: DynamicWallSeg = {
          edgeIndex: -100 - idx,
          isInterior: true,
          x1: x1M,
          z1: z1M,
          x2: x2M,
          z2: z2M,
          mx,
          mz,
          nx,
          nz,
          factor: 1,
          targetFull: true,
          upperPivot,
          decorGroup,
          cutGroup,
        };
        const initHide = shouldHideWallForCamera(seg, camPos.x, camPos.z, polyM, true);
        seg.targetFull = !initHide;
        seg.factor = initHide ? 0 : 1;
        upperPivot.visible = !initHide;
        upperPivot.scale.y = !initHide ? 1 : 0.01;
        decorGroup.visible = !initHide;
        cutGroup.visible = initHide;
        a.wallSegments.push(seg);

        interiorWallMap.set(iw.id, { x1: x1M, z1: z1M, len, cm: lenCm, ex, ez, nx, nz, seg });
      });
    }

    if (isCustomShape) {
      const lh = labelSprite(`สูง ${m(room.h)}`, night);
      lh.scale.multiplyScalar(lk);
      const firstUp = a.wallSegments.find((s) => !s.isInterior && s.targetFull) || a.wallSegments[0];
      lh.position.set(firstUp ? firstUp.x1 : 0, H + 0.16, firstUp ? firstUp.z1 : 0);
      a.heightSprite = lh;
      a.roomRoot.add(lh);
    } else {
      const lw = labelSprite(m(room.w), night);
      lw.position.set(W / 2, 0.05, D + 0.3);
      const ld = labelSprite(m(room.d), night);
      ld.position.set(W + 0.35, 0.05, D / 2);
      const lh = labelSprite(`สูง ${m(room.h)}`, night);
      const firstUp = a.wallSegments.find((s) => !s.isInterior && s.targetFull) || a.wallSegments[0];
      lh.position.set(firstUp ? firstUp.x1 : -0.05, H + 0.16, firstUp ? firstUp.z1 : 0);
      a.heightSprite = lh;
      a.roomRoot.add(lw, ld, lh);
    }

    // ตัวช่วยคำนวณช่วงวางหน้าต่าง/ประตูใน 3D ให้ไม่ชนมุมกำแพง ไม่ทะลุกำแพงกั้นในห้อง และไม่ซ้อนทับบานอื่น
    const usedWallSpans = new Map<string, Array<[number, number]>>();
    const fitOpening3D = (
      wallKey: string,
      segX1: number,
      segZ1: number,
      segEx: number,
      segEz: number,
      segLenM: number,
      rawPos: number,
      desiredWidthM: number,
      cornerPadM: number,
      sideOverhangM: number,
      excludeIwId?: string
    ): { sM: number; widthM: number; spanM: number } | null => {
      const minW = 0.42;
      const baseStart = cornerPadM;
      const baseEnd = segLenM - cornerPadM;
      if (baseEnd - baseStart < minW + sideOverhangM * 2) return null;

      const blocked: Array<[number, number]> = [...(usedWallSpans.get(wallKey) ?? [])];

      if (room.interiorWalls) {
        for (const iw of room.interiorWalls) {
          if (excludeIwId && iw.id === excludeIwId) continue;
          const ix1 = iw.x1 * CM;
          const iz1 = iw.z1 * CM;
          const ix2 = iw.x2 * CM;
          const iz2 = iw.z2 * CM;
          const idx = ix2 - ix1;
          const idz = iz2 - iz1;
          const iLen = Math.hypot(idx, idz);
          if (iLen < 0.1) continue;
          const iex = idx / iLen;
          const iez = idz / iLen;
          const cross = segEx * iez - segEz * iex;
          if (Math.abs(cross) <= 0.2) continue;

          for (const [px, pz] of [
            [ix1, iz1],
            [ix2, iz2],
          ]) {
            const rx = px - segX1;
            const rz = pz - segZ1;
            const proj = rx * segEx + rz * segEz;
            const perp = Math.abs(rx * -segEz + rz * segEx);
            if (perp <= 0.2 && proj > 0.04 && proj < segLenM - 0.04) {
              blocked.push([proj - (T / 2 + 0.1), proj + (T / 2 + 0.1)]);
            }
          }

          const qpx = ix1 - segX1;
          const qpz = iz1 - segZ1;
          const t = (qpx * iez - qpz * iex) / cross;
          const u = (qpx * segEz - qpz * segEx) / cross;
          if (u >= -0.04 && u <= iLen + 0.04 && t > 0.04 && t < segLenM - 0.04) {
            blocked.push([t - (T / 2 + 0.1), t + (T / 2 + 0.1)]);
          }
        }
      }

      blocked.sort((a, b) => a[0] - b[0]);
      const merged: Array<[number, number]> = [];
      for (const [b0, b1] of blocked) {
        const c0 = Math.max(baseStart, b0);
        const c1 = Math.min(baseEnd, b1);
        if (c1 <= c0) continue;
        if (merged.length === 0 || c0 > merged[merged.length - 1][1]) {
          merged.push([c0, c1]);
        } else {
          merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], c1);
        }
      }

      const minTotal = minW + sideOverhangM * 2;
      const freeSpans: Array<[number, number]> = [];
      let cur = baseStart;
      for (const [m0, m1] of merged) {
        if (m0 - cur >= minTotal) freeSpans.push([cur, m0]);
        cur = Math.max(cur, m1);
      }
      if (baseEnd - cur >= minTotal) freeSpans.push([cur, baseEnd]);
      if (freeSpans.length === 0) return null;

      const targetS = Math.max(0, Math.min(segLenM, rawPos * segLenM));
      const fullSpans = freeSpans.filter(([a, b]) => b - a >= desiredWidthM + sideOverhangM * 2);
      const pool = fullSpans.length > 0 ? fullSpans : freeSpans;

      let best: { sM: number; widthM: number; spanM: number; dist: number } | null = null;
      for (const [spanA, spanB] of pool) {
        const spanM = spanB - spanA;
        const widthM = Math.max(minW, Math.min(desiredWidthM, spanM - sideOverhangM * 2));
        const halfTotal = widthM / 2 + sideOverhangM;
        const sM = Math.max(spanA + halfTotal, Math.min(spanB - halfTotal, targetS));
        const dist = Math.abs(sM - targetS);
        if (!best || dist < best.dist) {
          best = { sM, widthM, spanM, dist };
        }
      }
      if (!best) return null;

      const used = usedWallSpans.get(wallKey) ?? [];
      const halfTotal = best.widthM / 2 + sideOverhangM;
      used.push([best.sM - halfTotal - 0.02, best.sM + halfTotal + 0.02]);
      usedWallSpans.set(wallKey, used);

      return { sM: best.sM, widthM: best.widthM, spanM: best.spanM };
    };

    // ---------- วางหน้าต่างทุกบาน (สลับแสดงบานเต็ม/ขอบเตี้ยตามการหมุนกล้องอัตโนมัติ + กันทะลุกำแพง 100%) ----------
    if (room.windows && room.windows.length > 0) {
      hasWin = false;
      for (const winSpec of room.windows) {
        const fallbackIdx =
          winSpec.wall === "top"
            ? walls.findIndex((w) => w.nz < -0.5)
            : winSpec.wall === "right"
            ? walls.findIndex((w) => w.nx > 0.5)
            : winSpec.wall === "bottom"
            ? walls.findIndex((w) => w.nz > 0.5)
            : walls.findIndex((w) => w.nx < -0.5);
        const idx =
          winSpec.edgeIndex !== undefined && winSpec.edgeIndex >= 0 && winSpec.edgeIndex < walls.length
            ? winSpec.edgeIndex
            : Math.max(0, fallbackIdx);
        const ww = walls[idx];
        if (!ww || ww.len < 0.7) continue;

        const sideOverhangM = 0.11;
        const fit = fitOpening3D(
          `outer:${idx}`,
          ww.x1,
          ww.z1,
          ww.ex,
          ww.ez,
          ww.len,
          winSpec.pos,
          (winSpec.width || 120) * CM,
          0.14,
          sideOverhangM
        );
        if (!fit) continue;

        const px = ww.x1 + ww.ex * fit.sM;
        const pz = ww.z1 + ww.ez * fit.sM;
        const rotY = Math.atan2(-ww.nx, -ww.nz);

        const { grp, winW } = buildWindow(fit.spanM, fit.widthM, sideOverhangM);
        grp.rotation.y = rotY;
        grp.position.set(px - ww.nx * 0.03, wy, pz - ww.nz * 0.03);
        ww.seg.decorGroup.add(grp);

        const sill = new THREE.Mesh(
          new THREE.BoxGeometry(winW, 0.05, T + 0.05),
          new THREE.MeshStandardMaterial({ color: "#f87171", emissive: "#fca5a5", emissiveIntensity: 0.35 })
        );
        sill.rotation.y = rotY;
        sill.position.set(px + (ww.nx * T) / 2, curbH + 0.025, pz + (ww.nz * T) / 2);
        ww.seg.cutGroup.add(sill);

        if (!hasWin) {
          winLight.set(px - ww.nx * 0.5, wy, pz - ww.nz * 0.5);
          hasWin = true;
        }
      }
    } else if (hasWin) {
      const candidates = walls.filter((w) => w.len > 0.75);
      const side = candidates.filter((w) => (winWall === "left" ? w.nx < -0.7 : w.nz < -0.7));
      const ww = (side.length ? side : candidates).sort((p, q) => q.len - p.len)[0];
      if (ww) {
        const wIdx = walls.indexOf(ww);
        const sideOverhangM = 0.11;
        const desiredW = Math.min(1.4, ww.len * 0.4);
        const fit = fitOpening3D(
          `outer:${wIdx}`,
          ww.x1,
          ww.z1,
          ww.ex,
          ww.ez,
          ww.len,
          winPos,
          desiredW,
          0.14,
          sideOverhangM
        );
        if (fit) {
          const px = ww.x1 + ww.ex * fit.sM;
          const pz = ww.z1 + ww.ez * fit.sM;
          const rotY = Math.atan2(-ww.nx, -ww.nz);

          const { grp, winW } = buildWindow(fit.spanM, fit.widthM, sideOverhangM);
          grp.rotation.y = rotY;
          grp.position.set(px - ww.nx * 0.03, wy, pz - ww.nz * 0.03);
          ww.seg.decorGroup.add(grp);

          const sill = new THREE.Mesh(
            new THREE.BoxGeometry(winW, 0.05, T + 0.05),
            new THREE.MeshStandardMaterial({ color: "#f87171", emissive: "#fca5a5", emissiveIntensity: 0.35 })
          );
          sill.rotation.y = rotY;
          sill.position.set(px + (ww.nx * T) / 2, curbH + 0.025, pz + (ww.nz * T) / 2);
          ww.seg.cutGroup.add(sill);

          winLight.set(px - ww.nx * 0.5, wy, pz - ww.nz * 0.5);
        } else {
          hasWin = false;
        }
      } else {
        hasWin = false;
      }
    }

    // ---------- วางประตูทุกบาน (สลับบานประตูเต็ม/ธรณีประตูตามการหมุนกล้องอัตโนมัติ + กันชนกำแพง 100%) ----------
    if (room.doors && room.doors.length > 0) {
      for (const doorSpec of room.doors) {
        if (doorSpec.interiorWallId && interiorWallMap.has(doorSpec.interiorWallId)) {
          const iw = interiorWallMap.get(doorSpec.interiorWallId)!;
          if (iw.len < 0.6) continue;
          const fit = fitOpening3D(
            `iw:${doorSpec.interiorWallId}`,
            iw.x1,
            iw.z1,
            iw.ex,
            iw.ez,
            iw.len,
            doorSpec.pos,
            (doorSpec.width || 80) * CM,
            0.08,
            0.06,
            doorSpec.interiorWallId
          );
          const sM = fit ? fit.sM : iw.len * doorSpec.pos;
          const doorWM = fit ? fit.widthM : (doorSpec.width || 80) * CM;
          const px = iw.x1 + iw.ex * sM;
          const pz = iw.z1 + iw.ez * sM;
          for (const side of [-1, 1]) {
            const rotY = Math.atan2(-iw.nx * side, -iw.nz * side);
            const dFull = buildWallDoor(iw.len, doorWM, true);
            dFull.rotation.y = rotY;
            dFull.position.set(px + iw.nx * side * (T / 2 - 0.01), 0, pz + iw.nz * side * (T / 2 - 0.01));
            iw.seg.decorGroup.add(dFull);
          }
          const rotCut = Math.atan2(-iw.nx, -iw.nz);
          const dCut = buildWallDoor(iw.len, doorWM, false);
          dCut.rotation.y = rotCut;
          dCut.position.set(px + iw.nx * (T / 2), 0, pz + iw.nz * (T / 2));
          iw.seg.cutGroup.add(dCut);
          continue;
        }

        const fallbackIdx =
          doorSpec.wall === "top"
            ? walls.findIndex((w) => w.nz < -0.5)
            : doorSpec.wall === "right"
            ? walls.findIndex((w) => w.nx > 0.5)
            : doorSpec.wall === "bottom"
            ? walls.findIndex((w) => w.nz > 0.5)
            : walls.findIndex((w) => w.nx < -0.5);
        const idx =
          doorSpec.edgeIndex !== undefined && doorSpec.edgeIndex >= 0 && doorSpec.edgeIndex < walls.length
            ? doorSpec.edgeIndex
            : Math.max(0, fallbackIdx);
        const dw = walls[idx];
        if (!dw || dw.len < 0.6) continue;
        const fit = fitOpening3D(
          `outer:${idx}`,
          dw.x1,
          dw.z1,
          dw.ex,
          dw.ez,
          dw.len,
          doorSpec.pos,
          (doorSpec.width || 80) * CM,
          0.12,
          0.06
        );
        if (!fit) continue;
        const px = dw.x1 + dw.ex * fit.sM;
        const pz = dw.z1 + dw.ez * fit.sM;
        const rotY = Math.atan2(-dw.nx, -dw.nz);

        const dFull = buildWallDoor(fit.spanM, fit.widthM, true);
        dFull.rotation.y = rotY;
        dFull.position.set(px - dw.nx * 0.01, 0, pz - dw.nz * 0.01);
        dw.seg.decorGroup.add(dFull);

        const dCut = buildWallDoor(fit.spanM, fit.widthM, false);
        dCut.rotation.y = rotY;
        dCut.position.set(px - dw.nx * 0.01, 0, pz - dw.nz * 0.01);
        dw.seg.cutGroup.add(dCut);
      }
    }
    // จำลองแสงอาทิตย์ & สภาพอากาศตามเวลาจริง
    const activeSun: SunSettings = sunSettings || room.sunSettings || {
      timeHour: night ? 21.5 : 14.5,
      orientationDeg: room.orientation || 0,
      colorTempK: 5200,
      sunIntensity: 1.8,
    };
    const sunState = calculateSunState(activeSun, room.w, room.d, room.h);

    a.lights.hemi.color.set(sunState.hemiSky);
    a.lights.hemi.groundColor.set(sunState.hemiGround);
    a.lights.hemi.intensity = sunState.isNight ? 0.38 : 0.88;

    a.lights.sun.intensity = sunState.intensity;
    a.lights.sun.color.set(sunState.sunColor);
    a.lights.sun.position.set(sunState.sunX, sunState.sunY, sunState.sunZ);
    a.lights.sun.target.position.set(W / 2, 0, D / 2);

    const sc = a.lights.sun.shadow.camera;
    sc.left = -Math.max(W, D);
    sc.right = Math.max(W, D);
    sc.top = Math.max(W, D);
    sc.bottom = -Math.max(W, D);
    sc.far = 30;
    sc.updateProjectionMatrix();

    // แสงหน้าต่าง (Window glow)
    a.lights.win.intensity = !hasWin || sunState.isNight ? 0 : 1.35;
    a.lights.win.color.set(sunState.sunColor);
    a.lights.win.position.copy(winLight);
    a.renderer.toneMappingExposure = sunState.isNight ? 1.25 : 1.05;
    a.fit();
  }, [room, night, sunSettings]);

  // ---------- ของในห้อง (สร้างใหม่เฉพาะชิ้นที่ขนาด/หมวด/สีเปลี่ยน) ----------
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const M = makeMats();
    const seen = new Set<string>();
    for (const it of items) {
      seen.add(it.uid);
      const key = `${it.category}|${it.w}|${it.d}|${it.h}|${it.color}|${night}`;
      let rec = a.meshes.get(it.uid);
      if (!rec || rec.key !== key) {
        if (rec) {
          a.itemsRoot.remove(rec.group);
          disposeGroup(rec.group);
        }
        const group = buildItem(it, M, night);
        group.userData.uid = it.uid;
        a.itemsRoot.add(group);
        rec = { group, key };
        a.meshes.set(it.uid, rec);
      }
      rec.group.position.set(it.x * CM, it.y * CM, it.z * CM);
      rec.group.userData.ty = it.y * CM;
      rec.group.rotation.y = (-it.rot * Math.PI) / 180;
    }
    for (const [uid, rec] of a.meshes)
      if (!seen.has(uid)) {
        a.itemsRoot.remove(rec.group);
        disposeGroup(rec.group);
        a.meshes.delete(uid);
      }
  }, [items, night]);

  // ---------- กรอบสีฟ้า + วงแหวนเข็มทิศแสดงองศาสดรอบชิ้นที่เลือก ----------
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const rec = selected ? a.meshes.get(selected) : undefined;
    const selItem = selected ? items.find((i) => i.uid === selected) : undefined;
    a.selBox.visible = !!rec;
    if (rec) {
      rec.group.updateMatrixWorld(true);
      a.selBox.box.setFromObject(rec.group).expandByScalar(0.02);
    }
    updateSelectionAngleGizmo(a.selGizmo, rec && selItem ? selItem : null);
  }, [selected, items]);

  useImperativeHandle(ref, () => ({
    snapshot: async () => {
      const a = api.current;
      if (!a) return null;
      // พื้นหลังทึบ (JPEG ไม่มีความโปร่งใส) + ซ่อนกรอบเลือกและวงแหวนบอกองศา
      const prevBg = a.scene.background;
      a.scene.background = new THREE.Color(night ? "#1c1820" : "#eef1f5");
      const selVis = a.selBox.visible;
      const gizmoVis = a.selGizmo.group.visible;
      a.selBox.visible = false;
      a.selGizmo.group.visible = false;
      a.renderer.render(a.scene, a.camera);
      const spots: Record<string, { x: number; y: number }> = {};
      const v = new THREE.Vector3();
      for (const it of items) {
        if (!it.productId) continue;
        v.set(it.x * CM, (it.y + it.h * 0.6) * CM, it.z * CM).project(a.camera);
        spots[it.productId] = { x: Math.min(95, Math.max(5, ((v.x + 1) / 2) * 100)), y: Math.min(95, Math.max(5, ((1 - v.y) / 2) * 100)) };
      }
      const blob = await new Promise<Blob | null>((resolve) => a.renderer.domElement.toBlob((b) => resolve(b), "image/jpeg", 0.92));
      a.scene.background = prevBg;
      a.selBox.visible = selVis;
      a.selGizmo.group.visible = gizmoVis;
      return blob ? { blob, spots } : null;
    },
    resetView: () => api.current?.resetView(),
  }));

  return <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" aria-label="ห้อง 3 มิติ ลากของเพื่อย้าย ลากพื้นที่ว่างเพื่อหมุนมุมมอง" />;
});
