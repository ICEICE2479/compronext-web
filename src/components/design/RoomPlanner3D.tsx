"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { fabricTex, plasterTex } from "./room3d-textures";
import { dragTo, footprint, settleOnTop, type PlanItem, type RoomSize } from "@/lib/room-planner";
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
  onMove: (uid: string, x: number, z: number, y: number) => void;
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

/**
 * ห้อง 3D แบบไดโอรามา (ผนังหลัง + ผนังซ้าย ตัดผนังหน้าออกให้เห็นข้างใน)
 * ลากของบนพื้นเพื่อย้าย · ลากพื้นที่ว่างเพื่อหมุนมุมกล้อง · หยิกเพื่อซูม
 */
export const RoomPlanner3D = forwardRef<RoomPlanner3DHandle, Props>(function RoomPlanner3D({ room, items, selected, night, sunSettings, onSelect, onMove }, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    itemsRoot: THREE.Group;
    roomRoot: THREE.Group;
    lights: { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight; win: THREE.PointLight };
    meshes: Map<string, { group: THREE.Group; key: string }>;
    selBox: THREE.Box3Helper;
    fit: () => void;
    resetView: () => void;
  } | null>(null);
  const propsRef = useRef({ room, items, onSelect, onMove });
  useEffect(() => {
    propsRef.current = { room, items, onSelect, onMove };
  }, [room, items, onSelect, onMove]);

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
    let drag: { uid: string; dx: number; dz: number; y: number; moved: boolean; riders: PlanItem[] } | null = null;
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
      renderer.render(scene, camera);
    };
    const selBox = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color("#2563eb"));
    selBox.visible = false;
    scene.add(selBox);
    api.current = { renderer, scene, camera, controls, itemsRoot, roomRoot, lights: { hemi, sun, win }, meshes: new Map(), selBox, fit, resetView };
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
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
      toNdc(e);
      const hits = ray.intersectObjects(itemsRoot.children, true);
      // ของบนโต๊ะอยู่หน้าโต๊ะ → เลือกตัวที่อยู่สูงกว่าก่อน
      const uid = hits.length ? uidOf(hits[0].object) : null;
      if (!uid) return;
      const it = propsRef.current.items.find((i) => i.uid === uid);
      if (!it) return;
      plane.constant = -it.y * CM;
      if (!ray.ray.intersectPlane(plane, hit)) return;
      // ของที่วางอยู่บนชิ้นนี้ ย้ายตามไปด้วย
      const riders = propsRef.current.items.filter(
        (o) => o.uid !== it.uid && o.y > 0 && Math.abs(o.y - (it.y + it.h)) < 1 && Math.abs(o.x - it.x) * 2 < footprint(it).w && Math.abs(o.z - it.z) * 2 < footprint(it).d
      );
      drag = { uid, dx: it.x - hit.x / CM, dz: it.z - hit.z / CM, y: it.y, moved: false, riders };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
      propsRef.current.onSelect(uid);
    };
    const onMoveEv = (e: PointerEvent) => {
      if (!drag) return;
      toNdc(e);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      const snap = (v: number) => Math.round(v / 5) * 5;
      const base = propsRef.current.items.find((i) => i.uid === drag!.uid);
      if (!base) return;
      const d0 = drag as typeof drag & { last?: { x: number; z: number; y: number } };
      // เริ่มจากตำแหน่งล่าสุดที่วางได้ แล้วขยับไปหาเมาส์โดยไม่ทับของอื่น
      const it = d0.last ? { ...base, x: d0.last.x, z: d0.last.z, y: d0.last.y } : base;
      const next = dragTo(it, { x: snap(hit.x / CM + drag.dx), z: snap(hit.z / CM + drag.dz) }, propsRef.current.items, propsRef.current.room);
      drag.moved = true;
      const m = api.current?.meshes.get(it.uid);
      if (m) {
        m.group.position.x = next.x * CM;
        m.group.position.z = next.z * CM;
        m.group.userData.ty = next.y * CM;
        m.group.updateMatrixWorld(true);
        api.current?.selBox.box.setFromObject(m.group).expandByScalar(0.02);
      }
      for (const r of drag.riders) {
        const rm = api.current?.meshes.get(r.uid);
        if (!rm) continue;
        rm.group.position.x = (r.x + next.x - base.x) * CM;
        rm.group.position.z = (r.z + next.z - base.z) * CM;
        rm.group.userData.ty = (r.y + next.y - base.y) * CM;
      }
      (drag as typeof drag & { last?: { x: number; z: number; y: number } }).last = { x: next.x, z: next.z, y: next.y };
    };
    const onUp = (e: PointerEvent) => {
      const d = drag as (typeof drag & { last?: { x: number; z: number; y: number } }) | null;
      if (d?.moved && d.last) {
        const base = propsRef.current.items.find((i) => i.uid === d.uid);
        // ปล่อยบนของ → ขยับให้อยู่บนพื้นผิวเต็มตัว
        const fin = base ? settleOnTop({ ...base, ...d.last }, propsRef.current.items) : { ...d.last };
        propsRef.current.onMove(d.uid, fin.x, fin.z, fin.y);
        if (base) for (const r of d.riders) propsRef.current.onMove(r.uid, r.x + fin.x - base.x, r.z + fin.z - base.z, r.y + fin.y - base.y);
      }
      if (!d && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5) propsRef.current.onSelect(null);
      drag = null;
      downAt = null;
      controls.enabled = true;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMoveEv);
    renderer.domElement.addEventListener("pointerup", onUp);
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMoveEv);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      for (const { group } of api.current?.meshes.values() ?? []) disposeGroup(group);
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
    const buildWindow = (along: number, customWidthM?: number) => {
      const winW = customWidthM
        ? Math.min(Math.max(0.45, customWidthM), Math.max(0.45, along - 0.16))
        : Math.min(1.4, along * 0.4);
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
      // ผ้าม่านสองข้างหน้าต่าง (จับจีบ)
      const curtainTex = fabricTex(night ? "#5b4b6e" : "#d9cbb5").clone();
      curtainTex.needsUpdate = true;
      curtainTex.repeat.set(3, 1);
      const curtain = new THREE.MeshStandardMaterial({ map: curtainTex, roughness: 0.95, side: THREE.DoubleSide });
      const cw = Math.min(0.35, winW * 0.3);
      const ch = Math.min(H - 0.15, winH + 0.6);
      for (const side of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(cw, ch, 24, 1);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / cw) * Math.PI * 6) * 0.018);
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, curtain);
        m.position.set(side * (winW / 2 + cw / 2 - 0.02), (wy + winH / 2 + 0.12) - ch / 2 - wy, 0.07);
        m.castShadow = true;
        grp.add(m);
      }
      local(new THREE.CylinderGeometry(0.012, 0.012, winW + cw * 2 + 0.1, 12).rotateZ(Math.PI / 2), trim, 0, winH / 2 + 0.14, 0.08);
      return grp;
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
    if (room.shape && room.shape.length >= 3) {
      // ---------- ห้องตามแปลนที่วัดมา ----------
      const poly = room.shape;
      const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x * CM, -z * CM)));
      const base = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }).rotateX(-Math.PI / 2);
      add(base, new THREE.MeshStandardMaterial({ color: night ? "#2a2326" : "#d8d2ca", roughness: 1 }), 0, -0.32, 0);
      const ft = floorTexture(room);
      ft.repeat.set(1 / 1.6, 1 / 1.6); // UV ของ ShapeGeometry = เมตร → ไม้แผ่นละ 1.6 ม.
      add(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.55 }), 0, 0, 0, false);
      // ผนังฝั่งไกลกล้อง = เต็มความสูง · ฝั่งใกล้กล้อง = ขอบเตี้ย (มองเห็นข้างใน)
      const cam = new THREE.Vector2(6, 6.4).normalize();
      const lk = Math.min(1, Math.max(0.75, Math.max(W, D) / 4)); // ห้องเล็ก → ป้ายเล็กลง ไม่บังของ
      const walls = poly.map(([x1, z1], i) => {
        const [x2, z2] = poly[(i + 1) % poly.length];
        const len = Math.hypot(x2 - x1, z2 - z1);
        const ex = (x2 - x1) / len;
        const ez = (z2 - z1) / len;
        const nx = ez;
        const nz = -ex; // ทิศออกนอกห้อง (แปลนวนทวนเข็ม)
        return { x1: x1 * CM, z1: z1 * CM, len: len * CM, cm: len, ex, ez, nx, nz, full: nx * cam.x + nz * cam.y < -0.15 };
      });
      for (const w of walls) {
        const mx = w.x1 + (w.ex * w.len) / 2;
        const mz = w.z1 + (w.ez * w.len) / 2;
        const rot = Math.atan2(-w.ez, w.ex);
        const hh = w.full ? H : 0.12;
        const wall = add(new THREE.BoxGeometry(w.len + T, hh, T), wallMat, mx + (w.nx * T) / 2, hh / 2, mz + (w.nz * T) / 2);
        wall.rotation.y = rot;
        if (w.full) {
          const tr = add(new THREE.BoxGeometry(w.len, 0.08, 0.015), trim, mx - w.nx * 0.008, 0.04, mz - w.nz * 0.008, false);
          tr.rotation.y = rot;
          if (night) {
            const l = add(new THREE.BoxGeometry(w.len, 0.02, 0.02), led(), mx - w.nx * 0.03, H - 0.05, mz - w.nz * 0.03, false);
            l.rotation.y = rot;
          }
        }
        // ป้ายความยาวผนัง (ด้านสั้นมากข้าม ไม่รก)
        if (w.cm >= 30) {
          const lb = labelSprite(m(Math.round(w.cm)), night);
          lb.scale.multiplyScalar(lk);
          lb.position.set(mx + w.nx * 0.32, 0.05, mz + w.nz * 0.32);
          a.roomRoot.add(lb);
        }
      }
      const lh = labelSprite(`สูง ${m(room.h)}`, night);
      lh.scale.multiplyScalar(lk);
      lh.position.set(poly[0][0] * CM, H + 0.15, poly[0][1] * CM);
      a.roomRoot.add(lh);
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
          if (!ww || ww.len < 0.45) continue;
          const px = ww.x1 + ww.ex * ww.len * winSpec.pos;
          const pz = ww.z1 + ww.ez * ww.len * winSpec.pos;
          const rotY = Math.atan2(-ww.nx, -ww.nz);
          if (ww.full) {
            const grp = buildWindow(ww.len, (winSpec.width || 120) * CM);
            grp.rotation.y = rotY;
            grp.position.set(px - ww.nx * 0.03, wy, pz - ww.nz * 0.03);
            a.roomRoot.add(grp);
          } else {
            // ผนังฝั่งใกล้กล้องที่ตัดเตี้ย: แสดงขอบหน้าต่างกระจกเตี้ยบนขอบผนัง
            const sillW = Math.min(Math.max(0.45, (winSpec.width || 120) * CM), Math.max(0.45, ww.len - 0.14));
            const sill = new THREE.Mesh(
              new THREE.BoxGeometry(sillW, 0.05, T + 0.05),
              new THREE.MeshStandardMaterial({ color: "#f87171", emissive: "#fca5a5", emissiveIntensity: 0.35 })
            );
            sill.rotation.y = rotY;
            sill.position.set(px + (ww.nx * T) / 2, 0.13, pz + (ww.nz * T) / 2);
            a.roomRoot.add(sill);
          }
          if (!hasWin) {
            winLight.set(px - ww.nx * 0.5, wy, pz - ww.nz * 0.5);
            hasWin = true;
          }
        }
      } else {
        // หน้าต่างบนผนังเต็มที่ยาวสุดของฝั่งที่เลือก (หลัง = หันออก −z · ซ้าย = หันออก −x)
        const full = walls.filter((w) => w.full && w.len > 0.6);
        const side = full.filter((w) => (winWall === "left" ? w.nx < -0.7 : w.nz < -0.7));
        const ww = (side.length ? side : full).sort((p, q) => q.len - p.len)[0];
        if (hasWin && ww) {
          const grp = buildWindow(ww.len);
          const px = ww.x1 + ww.ex * ww.len * winPos;
          const pz = ww.z1 + ww.ez * ww.len * winPos;
          grp.rotation.y = Math.atan2(-ww.nx, -ww.nz);
          grp.position.set(px - ww.nx * 0.03, wy, pz - ww.nz * 0.03);
          a.roomRoot.add(grp);
          winLight.set(px - ww.nx * 0.5, wy, pz - ww.nz * 0.5);
        } else hasWin = false;
      }

      if (room.doors && room.doors.length > 0) {
        for (const doorSpec of room.doors) {
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
          if (!dw || dw.len < 0.55) continue;
          const px = dw.x1 + dw.ex * dw.len * doorSpec.pos;
          const pz = dw.z1 + dw.ez * dw.len * doorSpec.pos;
          const dGrp = buildWallDoor(dw.len, (doorSpec.width || 80) * CM, dw.full);
          dGrp.rotation.y = Math.atan2(-dw.nx, -dw.nz);
          dGrp.position.set(px - dw.nx * 0.01, 0, pz - dw.nz * 0.01);
          a.roomRoot.add(dGrp);
        }
      }
    } else {
      // ฐาน + พื้นไม้
      add(new THREE.BoxGeometry(W + T * 2 + 0.3, 0.3, D + T * 2 + 0.3), new THREE.MeshStandardMaterial({ color: night ? "#2a2326" : "#d8d2ca", roughness: 1 }), W / 2, -0.15 - 0.02, D / 2);
      add(new THREE.BoxGeometry(W, 0.02, D), new THREE.MeshStandardMaterial({ map: floorTexture(room), roughness: 0.55 }), W / 2, -0.01, D / 2, false);
      // ผนังหลัง + ผนังซ้าย + ขอบเตี้ยผนังหน้า/ขวา + บัวพื้น
      add(new THREE.BoxGeometry(W + T, H, T), wallMat, W / 2 - T / 2, H / 2, -T / 2);
      add(new THREE.BoxGeometry(T, H, D), wallMat, -T / 2, H / 2, D / 2);
      add(new THREE.BoxGeometry(W + T, 0.12, T), wallMat, W / 2, 0.06, D + T / 2);
      add(new THREE.BoxGeometry(T, 0.12, D + T), wallMat, W + T / 2, 0.06, D / 2);
      add(new THREE.BoxGeometry(W, 0.08, 0.015), trim, W / 2, 0.04, 0.008, false);
      add(new THREE.BoxGeometry(0.015, 0.08, D), trim, 0.008, 0.04, D / 2, false);

      const rectWalls = [
        { x1: 0, z1: 0, len: W, ex: 1, ez: 0, nx: 0, nz: -1, full: true, wall: "top" },
        { x1: W, z1: 0, len: D, ex: 0, ez: 1, nx: 1, nz: 0, full: false, wall: "right" },
        { x1: W, z1: D, len: W, ex: -1, ez: 0, nx: 0, nz: 1, full: false, wall: "bottom" },
        { x1: 0, z1: D, len: D, ex: 0, ez: -1, nx: -1, nz: 0, full: true, wall: "left" },
      ];

      if (room.windows && room.windows.length > 0) {
        hasWin = false;
        for (const winSpec of room.windows) {
          const ww =
            winSpec.edgeIndex !== undefined && rectWalls[winSpec.edgeIndex]
              ? rectWalls[winSpec.edgeIndex]
              : rectWalls.find((rw) => rw.wall === winSpec.wall) || rectWalls[0];
          const px = ww.x1 + ww.ex * ww.len * winSpec.pos;
          const pz = ww.z1 + ww.ez * ww.len * winSpec.pos;
          const rotY = Math.atan2(-ww.nx, -ww.nz);
          if (ww.full) {
            const grp = buildWindow(ww.len, (winSpec.width || 120) * CM);
            grp.rotation.y = rotY;
            grp.position.set(px - ww.nx * 0.03, wy, pz - ww.nz * 0.03);
            a.roomRoot.add(grp);
          } else {
            const sillW = Math.min(Math.max(0.45, (winSpec.width || 120) * CM), Math.max(0.45, ww.len - 0.14));
            const sill = new THREE.Mesh(
              new THREE.BoxGeometry(sillW, 0.05, T + 0.05),
              new THREE.MeshStandardMaterial({ color: "#f87171", emissive: "#fca5a5", emissiveIntensity: 0.35 })
            );
            sill.rotation.y = rotY;
            sill.position.set(px + (ww.nx * T) / 2, 0.13, pz + (ww.nz * T) / 2);
            a.roomRoot.add(sill);
          }
          if (!hasWin) {
            winLight.set(px - ww.nx * 0.5, wy, pz - ww.nz * 0.5);
            hasWin = true;
          }
        }
      } else if (hasWin) {
        const grp = buildWindow(winWall === "back" ? W : D);
        if (winWall === "back") grp.position.set(W * winPos, wy, 0.03);
        else {
          grp.rotation.y = Math.PI / 2;
          grp.position.set(0.03, wy, D * winPos);
          winLight.set(0.5, wy, D * winPos);
        }
        a.roomRoot.add(grp);
      }

      if (room.doors && room.doors.length > 0) {
        for (const doorSpec of room.doors) {
          const dw =
            doorSpec.edgeIndex !== undefined && rectWalls[doorSpec.edgeIndex]
              ? rectWalls[doorSpec.edgeIndex]
              : rectWalls.find((rw) => rw.wall === doorSpec.wall) || rectWalls[1];
          const px = dw.x1 + dw.ex * dw.len * doorSpec.pos;
          const pz = dw.z1 + dw.ez * dw.len * doorSpec.pos;
          const dGrp = buildWallDoor(dw.len, (doorSpec.width || 80) * CM, dw.full);
          dGrp.rotation.y = Math.atan2(-dw.nx, -dw.nz);
          dGrp.position.set(px - dw.nx * 0.01, 0, pz - dw.nz * 0.01);
          a.roomRoot.add(dGrp);
        }
      }

      // ป้ายขนาดห้อง: ขอบหน้า (กว้าง) + ขอบขวา (ลึก) + ความสูง
      const lw = labelSprite(m(room.w), night);
      lw.position.set(W / 2, 0.05, D + 0.3);
      const ld = labelSprite(m(room.d), night);
      ld.position.set(W + 0.35, 0.05, D / 2);
      const lh = labelSprite(`สูง ${m(room.h)}`, night);
      lh.position.set(-0.05, H + 0.15, 0);
      a.roomRoot.add(lw, ld, lh);
      if (night) {
        // แถบไฟ LED ใต้ฝ้า (อารมณ์ห้องเกมกลางคืน)
        add(new THREE.BoxGeometry(W, 0.02, 0.02), led(), W / 2, H - 0.05, 0.03, false);
        add(new THREE.BoxGeometry(0.02, 0.02, D), led(), 0.03, H - 0.05, D / 2, false);
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

  // ---------- กรอบสีฟ้ารอบชิ้นที่เลือก ----------
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const rec = selected ? a.meshes.get(selected) : undefined;
    a.selBox.visible = !!rec;
    if (rec) {
      rec.group.updateMatrixWorld(true);
      a.selBox.box.setFromObject(rec.group).expandByScalar(0.02);
    }
  }, [selected, items]);

  useImperativeHandle(ref, () => ({
    snapshot: async () => {
      const a = api.current;
      if (!a) return null;
      // พื้นหลังทึบ (JPEG ไม่มีความโปร่งใส) + ซ่อนกรอบเลือก
      const prevBg = a.scene.background;
      a.scene.background = new THREE.Color(night ? "#1c1820" : "#eef1f5");
      const selVis = a.selBox.visible;
      a.selBox.visible = false;
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
      return blob ? { blob, spots } : null;
    },
    resetView: () => api.current?.resetView(),
  }));

  return <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" aria-label="ห้อง 3 มิติ ลากของเพื่อย้าย ลากพื้นที่ว่างเพื่อหมุนมุมมอง" />;
});
