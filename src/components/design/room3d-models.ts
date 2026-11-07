import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PlanItem } from "@/lib/room-planner";
import { fabricTex, keysTex, rugTex, screenTex, woodTex } from "./room3d-textures";

/**
 * โมเดลของในห้อง (สร้างด้วยโค้ด โลว์โพลีแบบไดโอรามา) — หน่วย ซม. แล้วย่อเป็นเมตรตอนวาง
 * ทุกชิ้นวางฐานที่ y = 0 กึ่งกลาง x/z = 0 หันหน้าไปทาง +z
 */
export const CM = 0.01;

type Mats = ReturnType<typeof makeMats>;
export function makeMats() {
  const std = (color: string, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  return {
    std,
    metal: std("#2b2e33", 0.35, 0.8),
    chrome: std("#c9ced6", 0.2, 1),
    black: std("#16181b", 0.5, 0.1),
    fabric: std("#2f3338", 0.9),
    white: std("#f1f1ef", 0.7),
    leaf: std("#3f8a4d", 0.8),
    leaf2: std("#2f6f3d", 0.8),
    soil: std("#3b2a1f", 1),
    book: [std("#c0392b", 0.7), std("#2e86de", 0.7), std("#f1c40f", 0.7), std("#27ae60", 0.7), std("#8e44ad", 0.7)],
    screen: new THREE.MeshStandardMaterial({ color: "#0b1530", emissive: "#3b82f6", emissiveIntensity: 0.9, roughness: 0.2 }),
    rgb: new THREE.MeshStandardMaterial({ color: "#a855f7", emissive: "#a855f7", emissiveIntensity: 2 }),
    warm: new THREE.MeshStandardMaterial({ color: "#fff2d6", emissive: "#ffd79a", emissiveIntensity: 1.4 }),
  };
}

function rbox(g: THREE.Group, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, r = 1.5) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w * CM, h * CM, d * CM, 2, Math.min(r, w / 2, h / 2, d / 2) * CM), m);
  mesh.position.set(x * CM, y * CM, z * CM);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function cyl(g: THREE.Group, m: THREE.Material, rTop: number, rBot: number, h: number, x: number, y: number, z: number, seg = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop * CM, rBot * CM, h * CM, seg), m);
  mesh.position.set(x * CM, y * CM, z * CM);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function ball(g: THREE.Group, m: THREE.Material, r: number, x: number, y: number, z: number, sy = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r * CM, 14, 10), m);
  mesh.scale.y = sy;
  mesh.position.set(x * CM, y * CM, z * CM);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}

/** สร้างโมเดลตามหมวด ขนาดตามข้อมูลสินค้า (w × d × h ซม.) */
export function buildItem(it: PlanItem, M: Mats, night: boolean): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = it;
  const owned: THREE.Material[] = [];
  const mk = (color: string, rough = 0.6, metal = 0) => {
    const m = M.std(color, rough, metal);
    owned.push(m);
    return m;
  };
  g.userData.disposables = owned;
  const body = mk(it.color, 0.6);
  // วัสดุพร้อมลาย (ลายแคชร่วมกัน ไม่ต้อง dispose ทีละชิ้น)
  const tex = (map: THREE.Texture, rough: number, repeat: [number, number] = [1, 1], metal = 0) => {
    const t = map.clone();
    t.needsUpdate = true;
    t.repeat.set(repeat[0], repeat[1]);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: metal });
    owned.push(m);
    (g.userData.textures ??= []).push(t);
    return m;
  };
  const isWood = /^#(b|c|d|a)/i.test(it.color) && !/^#(a8b0ba)/i.test(it.color);
  const woodBody = isWood ? tex(woodTex(it.color), 0.55, [Math.max(1, w / 120), 1]) : body;
  switch (it.category) {
    case "desk": {
      // ท็อปไม้ขอบมน + ขาเหล็กทรงตัว A + คานใต้ท็อป + ถาดเก็บสาย
      rbox(g, woodBody, w, 2.5, d, 0, h - 1.25, 0, 0.8);
      for (const sx of [-1, 1]) {
        rbox(g, M.metal, 5, 3, d - 6, sx * (w / 2 - 8), h - 4, 0, 0.6);
        for (const sz of [-1, 1]) rbox(g, M.metal, 4, h - 4, 4, sx * (w / 2 - 8), (h - 4) / 2, sz * (d / 2 - 6), 0.8);
        rbox(g, M.metal, 6, 1.5, d - 4, sx * (w / 2 - 8), 0.75, 0, 0.5);
      }
      rbox(g, M.metal, w - 22, 3, 2, 0, h - 9, -d / 2 + 6, 0.5);
      rbox(g, M.black, w * 0.5, 6, 10, 0, h - 9, -d / 2 + 12, 1);
      break;
    }
    case "chair": {
      // เก้าอี้เกมมิ่ง/สำนักงาน: ฐาน 5 แฉก + ล้อ + โช้ค + เบาะ + พนักพิงสูง + หมอนรองคอ + ที่วางแขน
      const fab = tex(fabricTex(it.color === "#2f3338" ? "#2a2d33" : it.color), 0.92, [2, 2]);
      const seatH = Math.min(50, h * 0.42);
      cyl(g, M.chrome, 2.6, 2.6, seatH - 12, 0, (seatH - 12) / 2 + 8, 0, 20);
      cyl(g, M.black, 4.5, 5, 6, 0, 9, 0, 20);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const arm = rbox(g, M.black, 30, 3, 5, Math.cos(a) * 13, 6, Math.sin(a) * 13, 1.2);
        arm.rotation.y = -a;
        ball(g, M.black, 3.2, Math.cos(a) * 27, 3.2, Math.sin(a) * 27);
      }
      rbox(g, fab, w * 0.9, 9, d * 0.88, 0, seatH, 2, 4);
      const back = rbox(g, fab, w * 0.78, h - seatH - 8, 9, 0, seatH + (h - seatH) / 2 + 2, -d * 0.4, 6);
      back.rotation.x = -0.14;
      const neck = rbox(g, fab, w * 0.45, 12, 7, 0, h - 12, -d * 0.47 + 4, 5);
      neck.rotation.x = -0.14;
      for (const sx of [-1, 1]) {
        rbox(g, M.black, 4, 18, 4, sx * w * 0.42, seatH + 9, 2, 1);
        rbox(g, M.black, 7, 3, d * 0.5, sx * w * 0.42, seatH + 19, 4, 1.4);
      }
      break;
    }
    case "bed": {
      // ฐานไม้ + ที่นอน + ผ้าห่มพับ + หมอน + หัวเตียงบุผ้า
      const sheet = tex(fabricTex("#f3efe8"), 0.95, [3, 3]);
      const blanket = tex(fabricTex("#7f9cbd"), 0.95, [3, 3]);
      rbox(g, woodBody, w, 24, d, 0, 12, 0, 2.5);
      rbox(g, sheet, w - 6, 20, d - 8, 0, 34, 2, 6);
      rbox(g, blanket, w - 2, 5, d * 0.58, 0, 45.5, d * 0.2, 4);
      rbox(g, blanket, w - 2, 4, 14, 0, 46, -d * 0.1, 3);
      for (const sx of w > 120 ? [-1, 1] : [0]) {
        const pil = rbox(g, M.white, Math.min(55, w * 0.38), 11, 32, sx * w * 0.24, 49, -d / 2 + 24, 5);
        pil.rotation.x = -0.12;
      }
      rbox(g, tex(fabricTex("#8a8f98"), 0.95, [2, 2]), w + 4, 90, 9, 0, 45, -d / 2 + 4, 4);
      break;
    }
    case "wardrobe": {
      rbox(g, woodBody, w, h, d, 0, h / 2, 0, 1.2);
      rbox(g, woodBody, w + 2, 4, d + 2, 0, h - 2, 0, 1);
      rbox(g, M.black, w - 4, 6, d - 4, 0, 3, 0, 0.5);
      const doors = Math.max(2, Math.round(w / 50));
      for (let i = 1; i < doors; i++) rbox(g, mk("#3b3530", 0.8), 0.6, h - 14, 0.6, -w / 2 + (w / doors) * i, h / 2 + 2, d / 2 + 0.2, 0.2);
      for (let i = 0; i < doors; i++) rbox(g, M.chrome, 1.2, 22, 1.8, -w / 2 + (w / doors) * (i + 0.5) + (i % 2 ? -10 : 10), h * 0.55, d / 2 + 1, 0.5);
      break;
    }
    case "storage": {
      const t = 2;
      for (const sx of [-1, 1]) rbox(g, woodBody, t, h, d, sx * (w / 2 - t / 2), h / 2, 0, 0.5);
      rbox(g, woodBody, w, h, 1, 0, h / 2, -d / 2 + 0.5, 0.2);
      const shelves = Math.max(2, Math.round(h / 35));
      for (let k = 0; k <= shelves; k++) rbox(g, woodBody, w, t, d, 0, (h - t) * (k / shelves) + t / 2, 0, 0.5);
      for (let sh = 0; sh < shelves; sh++) {
        let x = -w / 2 + 5;
        const y0 = (h - t) * (sh / shelves) + t;
        for (let b = 0; x < w / 2 - 8 && b < 9; b++) {
          if ((b + sh) % 5 === 4) {
            // ของแต่งบนชั้น: กระถางเล็ก
            cyl(g, mk("#d9c9b6", 0.8), 4, 3.5, 8, x + 5, y0 + 4, 0);
            ball(g, M.leaf, 5, x + 5, y0 + 11, 0, 0.8);
            x += 12;
            continue;
          }
          const bw = 3 + ((b * 7 + sh * 3) % 4);
          const bh = Math.min(28, (h / shelves) * 0.72) - ((b * 5) % 6);
          const book = rbox(g, M.book[(b + sh) % M.book.length], bw, bh, d * 0.72, x + bw / 2, y0 + bh / 2, 0, 0.4);
          if (b % 4 === 3) book.rotation.z = 0.12;
          x += bw + 0.6;
        }
      }
      break;
    }
    case "rug": {
      rbox(g, tex(rugTex(it.color === "#9aa6b2" ? "#8f9aa6" : it.color), 1, [1, 1]), w, 1.2, d, 0, 0.6, 0, 3);
      break;
    }
    case "monitor": {
      // ฐาน + คอ + จอขอบบาง + ภาพหน้าจอ (กลางคืนสว่างขึ้น)
      rbox(g, M.metal, 22, 1.2, 17, 0, 0.6, 0, 3);
      rbox(g, M.metal, 4, h * 0.45, 2.5, 0, h * 0.26, -4, 1);
      rbox(g, M.black, w, h * 0.6, 2, 0, h * 0.62, -0.5, 0.8);
      const sm = new THREE.MeshStandardMaterial({ map: screenTex(night), emissiveMap: screenTex(night), emissive: "#ffffff", emissiveIntensity: night ? 1.1 : 0.55, roughness: 0.15 });
      owned.push(sm);
      const scr = rbox(g, sm, w - 1.6, h * 0.6 - 2.4, 0.2, 0, h * 0.62 + 0.4, 0.6, 0.1);
      scr.castShadow = false;
      if (night) {
        const glow = new THREE.PointLight("#93c5fd", 0.6, 1.6, 2);
        glow.position.set(0, h * 0.62 * CM, 0.25);
        g.add(glow);
      }
      break;
    }
    case "keyboard": {
      rbox(g, M.black, w, h, d, 0, h / 2, 0, 0.8);
      const km = new THREE.MeshStandardMaterial({ map: keysTex(), roughness: 0.6 });
      owned.push(km);
      rbox(g, km, w - 1.5, 0.8, d - 1.5, 0, h + 0.2, 0, 0.2);
      break;
    }
    case "keyboard_pad":
    case "mousepad": {
      rbox(g, tex(fabricTex("#26292f"), 0.98, [3, 1]), w, h, d, 0, h / 2, 0, 0.8);
      break;
    }
    case "mouse": {
      ball(g, M.black, Math.max(w, d) / 2, 0, h / 2, 0, (h / Math.max(w, d)) * 1.2);
      ball(g, M.metal, 0.6, 0, h, -d * 0.2, 1);
      break;
    }
    case "lighting": {
      // โคมไฟตั้งโต๊ะแขนพับ
      cyl(g, M.black, 7, 8, 2, 0, 1, 0, 24);
      const a1 = rbox(g, M.black, 1.4, h * 0.5, 1.4, 0, h * 0.25 + 1, 0, 0.5);
      a1.rotation.z = 0.25;
      const a2 = rbox(g, M.black, 1.4, h * 0.45, 1.4, -6, h * 0.7, 0, 0.5);
      a2.rotation.z = -0.6;
      const shade = cyl(g, night ? M.warm : mk("#e8e1d3", 0.5), 5, 10, 12, -13, h * 0.86, 3, 24);
      shade.rotation.z = 0.5;
      if (night) {
        const light = new THREE.PointLight("#ffc27a", 1.6, 2.4, 1.6);
        light.position.set(-14 * CM, h * 0.78 * CM, 6 * CM);
        g.add(light);
      }
      break;
    }
    case "computer": {
      // เคสกระจก + พัดลมไฟวงแหวน 3 ตัวด้านหน้า
      rbox(g, M.black, w, h, d, 0, h / 2, 0, 1.5);
      const glass = new THREE.MeshPhysicalMaterial({ color: "#1e2a3a", roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1 });
      owned.push(glass);
      const gl = rbox(g, glass, 0.6, h - 6, d - 6, w / 2 + 0.2, h / 2, 0, 0.3);
      gl.castShadow = false;
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.32 * CM, 0.7 * CM, 8, 32), M.rgb);
        ring.position.set(0, (h * 0.22 + i * (h * 0.27)) * CM, (d / 2 + 0.3) * CM);
        g.add(ring);
      }
      break;
    }
    case "fake_plant":
    case "real_plant":
    case "plant_pot": {
      const potH = it.category === "plant_pot" ? h : Math.min(32, h * 0.3);
      const pot = mk("#c8794f", 0.85);
      cyl(g, pot, w * 0.3, w * 0.23, potH, 0, potH / 2, 0, 24);
      cyl(g, pot, w * 0.32, w * 0.32, 2.5, 0, potH - 1.25, 0, 24);
      cyl(g, M.soil, w * 0.28, w * 0.28, 1, 0, potH - 1, 0);
      if (it.category !== "plant_pot") {
        // ใบยาวแผ่ออกรอบต้น (แบบต้นไทรใบสัก/มอนสเตอร่า)
        cyl(g, mk("#5b4636", 0.9), 1.1, 1.5, (h - potH) * 0.7, 0, potH + (h - potH) * 0.35, 0, 6);
        const n = 22;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + (i % 3) * 0.4;
          const y = potH + (h - potH) * (0.35 + ((i * 7) % 10) / 16);
          const leaf = ball(g, i % 2 ? M.leaf : M.leaf2, w * 0.24, Math.cos(a) * w * 0.24, y, Math.sin(a) * w * 0.24, 0.32);
          leaf.scale.x = 0.55;
          leaf.rotation.set(0.5 * Math.sin(a), -a, 0.6);
        }
      }
      break;
    }
    case "speaker":
    case "headphone":
    case "microphone":
    case "webcam":
    case "monitor_arm": {
      rbox(g, M.black, w, h, d, 0, h / 2, 0, Math.min(w, d) * 0.3);
      if (it.category === "speaker") cyl(g, mk("#3a3f46"), w * 0.3, w * 0.3, 1, 0, h * 0.55, d / 2).rotation.x = Math.PI / 2;
      break;
    }
    case "door": {
      // วงกบ + บานประตู + มือจับ (บางชิดผนัง)
      const frame = mk("#f4f1ea", 0.6);
      rbox(g, frame, 5, h, d, -w / 2 + 2.5, h / 2, 0, 0.5);
      rbox(g, frame, 5, h, d, w / 2 - 2.5, h / 2, 0, 0.5);
      rbox(g, frame, w, 5, d, 0, h - 2.5, 0, 0.5);
      rbox(g, mk("#c49a6c", 0.55), w - 10, h - 6, d * 0.6, 0, (h - 6) / 2, 0, 0.8);
      ball(g, M.chrome, 2.5, w / 2 - 12, h * 0.48, d * 0.5);
      break;
    }
    default:
      rbox(g, body, w, h, d, 0, h / 2, 0, Math.min(w, d, h) * 0.12);
  }
  return g;
}

export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
  for (const m of (g.userData.disposables as THREE.Material[] | undefined) ?? []) m.dispose();
  for (const t of (g.userData.textures as THREE.Texture[] | undefined) ?? []) t.dispose();
}
