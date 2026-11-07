import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MODEL_SCALE as S } from "./pc-model";

/**
 * ห้องเกมมิ่งรอบโต๊ะคอม: พื้นไม้ ผนัง 2 ด้าน หน้าต่างวิวเมืองกลางคืน ชั้นวาง ต้นไม้ เก้าอี้เกมมิ่ง
 * ไฟ RGB: แผงหกเหลี่ยมบนผนัง (ไล่สีเป็นคลื่น) + แถบไฟใต้โต๊ะ/หลังจอ + แสงฟุ้งบนผนัง
 * พิกัดเดียวกับโต๊ะ (desk-model): หน่วย มม. ผิวโต๊ะ y = 0, หน้าโต๊ะ +z → ใส่เป็นลูกของ desk.root
 */

export interface RoomScene {
  root: THREE.Group;
  /** ของที่ขยับซ้ายขวาตามชุดจอ (เก้าอี้ + ไฟหลังจอ) */
  follow: THREE.Group;
  /** วัสดุไฟ RGB แยกชิ้น (ไล่สีเป็นคลื่นได้) — phase = ตำแหน่งในคลื่น 0..1 */
  leds: Array<{ mat: THREE.MeshStandardMaterial; phase: number }>;
  /** แสงฟุ้ง (additive) ที่ต้องเปลี่ยนสีตาม RGB */
  glows: Array<{ mat: THREE.MeshBasicMaterial; phase: number; base: number }>;
  /** ไฟ RGB ที่ส่องห้อง */
  lights: Array<{ light: THREE.PointLight; phase: number; base: number }>;
  dispose: () => void;
}

const u = (mm: number) => mm * S;

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** พื้นไม้ลามิเนตแผ่นยาว */
function floorTex() {
  return canvasTexture(
    512,
    512,
    (g) => {
      const r = rng(11);
      const rows = 6;
      const rh = 512 / rows;
      for (let i = 0; i < rows; i++) {
        let x = -r() * 400;
        while (x < 512) {
          const len = 190 + r() * 150;
          const tone = 0.82 + r() * 0.22;
          g.fillStyle = `rgb(${Math.round(112 * tone)},${Math.round(82 * tone)},${Math.round(58 * tone)})`;
          g.fillRect(x, i * rh, len, rh);
          for (let k = 0; k < 8; k++) {
            g.strokeStyle = `rgba(60,38,22,${0.06 + r() * 0.1})`;
            g.lineWidth = 0.6 + r() * 1.6;
            const y = i * rh + r() * rh;
            g.beginPath();
            g.moveTo(x, y);
            for (let s = 0; s <= len; s += 16) g.lineTo(x + s, y + Math.sin(s / 30 + k) * 1.5);
            g.stroke();
          }
          g.fillStyle = "rgba(20,12,6,0.55)";
          g.fillRect(x, i * rh, 2, rh);
          x += len;
        }
        g.fillStyle = "rgba(20,12,6,0.6)";
        g.fillRect(0, i * rh, 512, 2);
      }
    },
    [3, 3]
  );
}

/** ผนังทาสีเข้ม เนื้อสีเรียบมีลายจางๆ */
function wallTex(base: string) {
  return canvasTexture(
    512,
    512,
    (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, 512, 512);
      const r = rng(5);
      for (let i = 0; i < 5000; i++) {
        g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.018)" : "rgba(0,0,0,0.05)";
        g.fillRect(r() * 512, r() * 512, 2, 2);
      }
    },
    [4, 3]
  );
}

/** วิวเมืองกลางคืนนอกหน้าต่าง */
function cityTex() {
  return canvasTexture(512, 384, (g) => {
    g.scale(0.5, 0.5); // วาดในพิกัด 1024×768 ลงผืน 512×384 (ประหยัดหน่วยความจำ)
    const sky = g.createLinearGradient(0, 0, 0, 768);
    sky.addColorStop(0, "#050a1f");
    sky.addColorStop(0.6, "#1b1f4a");
    sky.addColorStop(1, "#4a2a5e");
    g.fillStyle = sky;
    g.fillRect(0, 0, 1024, 768);
    const r = rng(23);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`;
      g.fillRect(r() * 1024, r() * 300, 1.5, 1.5);
    }
    g.fillStyle = "rgba(255,240,210,0.9)";
    g.beginPath();
    g.arc(820, 120, 36, 0, Math.PI * 2);
    g.fill();
    for (let layer = 0; layer < 2; layer++) {
      let x = -20;
      while (x < 1044) {
        const bw = 50 + r() * 90;
        const bh = (layer ? 220 : 320) + r() * (layer ? 220 : 260);
        const top = 768 - bh;
        g.fillStyle = layer ? "#0a0d1c" : "#151a33";
        g.fillRect(x, top, bw, bh);
        for (let wy = top + 10; wy < 760; wy += 16)
          for (let wx = x + 6; wx < x + bw - 8; wx += 12)
            if (r() > (layer ? 0.55 : 0.7)) {
              g.fillStyle = r() > 0.85 ? "rgba(125,211,252,0.85)" : "rgba(253,224,150,0.8)";
              g.fillRect(wx, wy, 5, 7);
            }
        x += bw + 4;
      }
    }
  });
}

/** แสงฟุ้งวงกลม (ใช้แทน bloom) */
function glowTex() {
  return canvasTexture(256, 256, (g) => {
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.32)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  });
}

/** ปกหนังสือ/โปสเตอร์ */
function posterTex() {
  return canvasTexture(512, 720, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 720);
    bg.addColorStop(0, "#1e1b4b");
    bg.addColorStop(1, "#7c3aed");
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 720);
    g.fillStyle = "#f472b6";
    g.beginPath();
    g.arc(256, 300, 150, Math.PI, 0);
    g.fill();
    g.fillStyle = "#1e1b4b";
    for (let i = 0; i < 6; i++) g.fillRect(100, 190 + i * 20, 312, 6 + i);
    g.strokeStyle = "#22d3ee";
    g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.moveTo(0, 420 + i * i * 4);
      g.lineTo(512, 420 + i * i * 4);
      g.stroke();
    }
    for (let i = -6; i <= 6; i++) {
      g.beginPath();
      g.moveTo(256 + i * 12, 420);
      g.lineTo(256 + i * 110, 720);
      g.stroke();
    }
    g.fillStyle = "#f8fafc";
    g.font = "bold 54px sans-serif";
    g.textAlign = "center";
    g.fillText("LEVEL UP", 256, 640);
  });
}

/** รวม mesh ที่อยู่นิ่งและใช้วัสดุเดียวกันเป็นก้อนเดียว (ลด draw call) — ข้ามไฟ/แสงฟุ้งที่เปลี่ยนสี */
function mergeStatic(group: THREE.Group, owned: Array<{ dispose: () => void }>) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const bins = new Map<THREE.Material, THREE.Mesh[]>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || m.parent === null) return;
    const mat = m.material as THREE.Material & { emissiveIntensity?: number; blending?: THREE.Blending };
    if (mat.blending === THREE.AdditiveBlending || (mat as THREE.MeshStandardMaterial).emissiveIntensity! > 1) return; // ไฟ RGB เปลี่ยนสีอยู่
    if (o.parent !== group && !isStaticChild(o, group)) return;
    const list = bins.get(mat) ?? [];
    list.push(m);
    bins.set(mat, list);
  });
  for (const [mat, list] of bins) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
      return g;
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    owned.push(merged);
    for (const m of list) m.removeFromParent();
    const one = new THREE.Mesh(merged, mat);
    one.receiveShadow = true;
    group.add(one);
  }
}

/** ลูกที่ซ้อนใน Group ย่อย (เช่นพนักพิงเก้าอี้) แต่ไม่ใช่ follow group ที่ขยับ */
function isStaticChild(o: THREE.Object3D, group: THREE.Group): boolean {
  for (let n = o.parent; n && n !== group; n = n.parent) if (n.userData.dynamic) return false;
  return true;
}

export function buildRoom(opts: { deskW: number; deskD: number; deskH: number; rgb: string }): RoomScene {
  const { deskW, deskD, deskH } = opts;
  const owned: Array<{ dispose: () => void }> = [];
  const own = <T extends { dispose: () => void }>(x: T) => (owned.push(x), x);
  const root = new THREE.Group();
  const leds: RoomScene["leds"] = [];
  const glows: RoomScene["glows"] = [];
  const lights: RoomScene["lights"] = [];
  const floorY = -deskH;
  const wallZ = -deskD / 2 - 45;
  const wallX = -deskW / 2 - 650;
  const wallH = 2600;

  const std = (p: THREE.MeshStandardMaterialParameters) => own(new THREE.MeshStandardMaterial(p));
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = root) => {
    own(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(u(x), u(y), u(z));
    // ของในห้องไม่ทิ้งเงา (ลดงานวาดเงา) รับเงาอย่างเดียว
    m.castShadow = false;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, parent?: THREE.Object3D, r = 0) =>
    mesh(r > 0 ? new RoundedBoxGeometry(u(w), u(h), u(d), 3, u(Math.min(r, w / 2, h / 2, d / 2))) : new THREE.BoxGeometry(u(w), u(h), u(d)), mat, x, y, z, parent);
  const led = (w: number, h: number, d: number, x: number, y: number, z: number, phase: number, parent?: THREE.Object3D) => {
    const mat = std({ color: opts.rgb, emissive: opts.rgb, emissiveIntensity: 2.4, roughness: 0.4 });
    leds.push({ mat, phase });
    const m = box(mat, w, h, d, x, y, z, parent);
    m.castShadow = false;
    return m;
  };
  const gTex = own(glowTex());
  const follow = new THREE.Group();
  follow.userData.dynamic = true;
  root.add(follow);
  const glow = (w: number, h: number, x: number, y: number, z: number, phase: number, base: number, rotY = 0, parent: THREE.Object3D = root) => {
    const mat = own(new THREE.MeshBasicMaterial({ map: gTex, color: opts.rgb, transparent: true, opacity: base, blending: THREE.AdditiveBlending, depthWrite: false }));
    glows.push({ mat, phase, base });
    const m = mesh(new THREE.PlaneGeometry(u(w), u(h)), mat, x, y, z, parent);
    m.rotation.y = rotY;
    m.castShadow = m.receiveShadow = false;
    m.renderOrder = 2;
    return m;
  };
  /** ไฟส่องห้องจริง (PointLight) กินเครื่องมาก → ใช้แสงฟุ้ง (glow) แทนทั้งหมด */
  const rgbLight = (...args: [number, number, number, number, number, number, THREE.Object3D?]) => {
    void args;
  };

  // ---------- พื้น + พรม ----------
  const fTex = own(floorTex());
  const floor = mesh(new THREE.PlaneGeometry(u(5200), u(4200)), std({ map: fTex, roughness: 0.62, metalness: 0.02 }), -400, floorY, 1000);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  const rugTex = own(
    canvasTexture(512, 512, (g) => {
      g.fillStyle = "#262a33";
      g.fillRect(0, 0, 512, 512);
      const r = rng(3);
      for (let i = 0; i < 12000; i++) {
        g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.12)";
        g.fillRect(r() * 512, r() * 512, 2, 3);
      }
      g.strokeStyle = "rgba(148,163,184,0.25)";
      g.lineWidth = 10;
      g.strokeRect(24, 24, 464, 464);
    })
  );
  const rug = mesh(new THREE.PlaneGeometry(u(1900), u(1500)), std({ map: rugTex, roughness: 1 }), -100, floorY + 3, 650);
  rug.rotation.x = -Math.PI / 2;
  rug.castShadow = false;

  // ---------- ผนัง (มองจากด้านหลังจะโปร่ง → หมุนกล้องได้รอบ) ----------
  const back = mesh(new THREE.PlaneGeometry(u(5200), u(wallH)), std({ map: own(wallTex("#262b3a")), roughness: 0.92 }), -400, floorY + wallH / 2, wallZ);
  back.castShadow = false;
  const side = mesh(new THREE.PlaneGeometry(u(4200), u(wallH)), std({ map: own(wallTex("#2b2f3d")), roughness: 0.92 }), wallX, floorY + wallH / 2, 1000);
  side.rotation.y = Math.PI / 2;
  side.castShadow = false;
  // บัวพื้น
  const trim = std({ color: "#11131a", roughness: 0.6 });
  box(trim, 5200, 80, 14, -400, floorY + 40, wallZ + 7);
  box(trim, 14, 80, 4200, wallX + 7, floorY + 40, 1000);

  // ---------- หน้าต่างวิวเมือง (ผนังซ้าย) ----------
  const winZ = 700;
  const winY = floorY + 1500;
  const city = own(cityTex());
  const glass = mesh(new THREE.PlaneGeometry(u(1300), u(1000)), own(new THREE.MeshBasicMaterial({ map: city })), wallX + 4, winY, winZ);
  glass.rotation.y = Math.PI / 2;
  glass.castShadow = false;
  const frame = std({ color: "#e5e7eb", roughness: 0.5 });
  box(frame, 40, 1080, 40, wallX + 20, winY, winZ - 670);
  box(frame, 40, 1080, 40, wallX + 20, winY, winZ + 670);
  box(frame, 40, 40, 1380, wallX + 20, winY + 520, winZ);
  box(frame, 70, 40, 1420, wallX + 35, winY - 520, winZ);
  box(frame, 30, 1000, 24, wallX + 16, winY, winZ);
  // ผ้าม่าน
  const curtain = std({ color: "#3f3a52", roughness: 0.95 });
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) box(curtain, 60, 1700, 90, wallX + 70 + (k % 2) * 18, winY - 180, winZ + s * (760 + k * 70), undefined, 30);
  box(std({ color: "#9ca3af", metalness: 0.8, roughness: 0.3 }), 20, 20, 1900, wallX + 70, winY + 640, winZ);

  // ---------- ไฟ RGB บนผนัง: แผงหกเหลี่ยม ----------
  const hexGeo = own(new THREE.CylinderGeometry(u(115), u(115), u(22), 6));
  const hexBase = std({ color: "#0f1117", roughness: 0.5 });
  const hexCells: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [0.5, 0.866],
    [1.5, 0.866],
    [2, 0],
    [1, -0.866],
    [-0.5, 0.866],
  ];
  const hx0 = -deskW / 2 + 120;
  const hy0 = 560;
  hexCells.forEach(([cx, cy], i) => {
    const x = hx0 + cx * 230;
    const y = hy0 + cy * 230;
    const base = new THREE.Mesh(hexGeo, hexBase);
    base.rotation.x = Math.PI / 2;
    base.rotation.y = Math.PI / 6;
    base.position.set(u(x), u(y), u(wallZ + 12));
    root.add(base);
    const mat = std({ color: opts.rgb, emissive: opts.rgb, emissiveIntensity: 1.8, roughness: 0.5 });
    const face = new THREE.Mesh(hexGeo, mat);
    face.rotation.copy(base.rotation);
    face.scale.set(0.82, 0.3, 0.82);
    face.position.set(u(x), u(y), u(wallZ + 26));
    root.add(face);
    leds.push({ mat, phase: i / hexCells.length });
    glow(560, 560, x, y, wallZ + 6, i / hexCells.length, 0.7);
  });
  rgbLight(hx0 + 230, hy0 + 100, wallZ + 300, 2, 1600, 0.3);

  // ---------- แถบไฟใต้โต๊ะ + หลังจอ ----------
  led(deskW - 120, 8, 8, 0, -32, deskD / 2 - 30, 0.1);
  glow(deskW + 200, 520, 0, -260, wallZ + 3, 0.15, 0.55);
  rgbLight(0, -200, 0, 1.2, 1300, 0.15);
  // แสงฟุ้งหลังจอ (bias light)
  glow(1500, 900, 0, 380, wallZ + 4, 0.6, 0.6, 0, follow);
  rgbLight(0, 380, wallZ + 120, 1.5, 1400, 0.6, follow);

  // ---------- ชั้นวางบนผนังขวา + ของ ----------
  const shelfX = deskW / 2 - 260;
  const shelfY = 780;
  const wood = std({ color: "#6b4a2f", roughness: 0.6 });
  box(wood, 520, 24, 200, shelfX, shelfY, wallZ + 100, undefined, 4);
  box(wood, 520, 24, 200, shelfX, shelfY + 330, wallZ + 100, undefined, 4);
  const r = rng(9);
  const bookCols = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#e5e7eb", "#8b5cf6"];
  let bx = shelfX - 230;
  for (let i = 0; i < 7; i++) {
    const bw = 28 + r() * 22;
    const bh = 170 + r() * 80;
    box(std({ color: bookCols[i % bookCols.length], roughness: 0.7 }), bw, bh, 150, bx + bw / 2, shelfY + 12 + bh / 2, wallZ + 95, undefined, 3);
    bx += bw + 3;
  }
  // ต้นไม้กระถางเล็ก
  const pot = std({ color: "#d6d3d1", roughness: 0.8 });
  mesh(new THREE.CylinderGeometry(u(55), u(42), u(110), 24), pot, shelfX + 170, shelfY + 12 + 55, wallZ + 100);
  const leaf = std({ color: "#2f7d4a", roughness: 0.75 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const m = mesh(new THREE.SphereGeometry(u(42), 12, 8), leaf, shelfX + 170 + Math.cos(a) * 45, shelfY + 160 + r() * 70, wallZ + 100 + Math.sin(a) * 40);
    m.scale.set(1, 1.5, 0.7);
  }
  // หุ่นโชว์/ไฟ LED บนชั้นบน
  led(480, 6, 6, shelfX, shelfY + 330 - 16, wallZ + 196, 0.85);
  for (let i = 0; i < 3; i++) box(std({ color: ["#f43f5e", "#22d3ee", "#facc15"][i], roughness: 0.4, metalness: 0.2 }), 70, 120 + i * 30, 70, shelfX - 150 + i * 150, shelfY + 342 + (120 + i * 30) / 2, wallZ + 100, undefined, 18);

  // ---------- โปสเตอร์ ----------
  const poster = mesh(new THREE.PlaneGeometry(u(500), u(700)), std({ map: own(posterTex()), roughness: 0.5 }), deskW / 2 + 380, 700, wallZ + 12);
  poster.castShadow = false;
  box(std({ color: "#0b0b0f", roughness: 0.4 }), 530, 730, 14, deskW / 2 + 380, 700, wallZ + 4); // กรอบ (หลังรูป)

  // ---------- เก้าอี้เกมมิ่ง ----------
  const chair = new THREE.Group();
  follow.add(chair);
  const leather = std({ color: "#17181c", roughness: 0.55, metalness: 0.05 });
  const accent = std({ color: "#dc2626", roughness: 0.5 });
  const chrome = std({ color: "#3b3f46", roughness: 0.3, metalness: 0.9 });
  const seatY = floorY + 480;
  const parent = chair;
  // ฐาน 5 แฉก + ล้อ
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = box(chrome, 320, 30, 50, Math.cos(a) * 160, floorY + 85, Math.sin(a) * 160, parent, 10);
    arm.rotation.y = -a;
    mesh(new THREE.SphereGeometry(u(32), 12, 10), leather, Math.cos(a) * 320, floorY + 32, Math.sin(a) * 320, parent);
  }
  mesh(new THREE.CylinderGeometry(u(28), u(34), u(340), 20), chrome, 0, floorY + 250, 0, parent);
  // เบาะนั่ง + ปีกข้าง
  box(leather, 520, 100, 500, 0, seatY, 0, parent, 40);
  for (const s of [-1, 1]) {
    box(leather, 70, 70, 480, s * 255, seatY + 55, 0, parent, 30);
    box(accent, 8, 102, 470, s * 205, seatY + 2, 0, parent);
    // ที่วางแขน
    box(chrome, 30, 220, 40, s * 300, seatY + 110, -40, parent, 8);
    box(leather, 80, 34, 260, s * 300, seatY + 230, -20, parent, 14);
  }
  // พนักพิง (เอนนิดๆ) + หมอนรองคอ
  const backrest = new THREE.Group();
  backrest.position.set(0, u(seatY + 40), u(-250));
  backrest.rotation.x = -0.18;
  parent.add(backrest);
  box(leather, 500, 820, 110, 0, 410, 0, backrest, 50);
  for (const s of [-1, 1]) {
    box(leather, 80, 640, 130, s * 230, 360, 20, backrest, 36);
    box(accent, 10, 700, 10, s * 160, 380, 57, backrest);
  }
  box(accent, 220, 110, 40, 0, 700, 70, backrest, 20);
  box(leather, 300, 160, 70, 0, 260, 70, backrest, 30);
  // เก้าอี้ถอยออกมาทางซ้าย หันเข้าโต๊ะ (ไม่บังมุมกล้อง)
  // เก้าอี้ดึงออกมาหน้าโต๊ะเยื้องซ้าย หันเข้าหาจอ (ไม่บังมุมกล้อง)
  chair.position.set(u(-760), 0, u(deskD / 2 + 560));
  chair.rotation.y = Math.PI + 0.75;

  // ---------- ต้นไม้ใหญ่ข้างโต๊ะ + โคมไฟตั้งพื้น ----------
  const bigPot = std({ color: "#e7e5e4", roughness: 0.7 });
  const px = deskW / 2 + 260;
  const pz = -deskD / 2 + 160;
  mesh(new THREE.CylinderGeometry(u(150), u(120), u(330), 28), bigPot, px, floorY + 165, pz);
  mesh(new THREE.CylinderGeometry(u(140), u(140), u(20), 28), std({ color: "#3f2a1d", roughness: 1 }), px, floorY + 325, pz);
  mesh(new THREE.CylinderGeometry(u(12), u(16), u(700), 8), std({ color: "#5b4632", roughness: 0.9 }), px, floorY + 680, pz);
  const leafBig = std({ color: "#2f6b3f", roughness: 0.7 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.4;
    const yy = floorY + 760 + r() * 520;
    const rad = 120 + r() * 140;
    const m = mesh(new THREE.SphereGeometry(u(95), 12, 8), leafBig, px + Math.cos(a) * rad, yy, pz + Math.sin(a) * rad * 0.8);
    m.scale.set(1.5, 0.35, 0.9);
    m.rotation.set(r() * 0.6, -a, 0.4 + r() * 0.5);
  }
  // โคมไฟตั้งพื้นมุมซ้าย (แสงอุ่น)
  const lx = wallX + 260;
  const lz = wallZ + 280;
  const lampMetal = std({ color: "#111317", roughness: 0.35, metalness: 0.8 });
  mesh(new THREE.CylinderGeometry(u(130), u(140), u(20), 28), lampMetal, lx, floorY + 10, lz);
  mesh(new THREE.CylinderGeometry(u(10), u(10), u(1500), 10), lampMetal, lx, floorY + 760, lz);
  const shade = std({ color: "#fde8c4", emissive: "#fbbf6a", emissiveIntensity: 1.4, roughness: 0.8, side: THREE.DoubleSide });
  mesh(new THREE.CylinderGeometry(u(120), u(190), u(260), 28, 1, true), shade, lx, floorY + 1600, lz);
  const lampGlow = own(new THREE.MeshBasicMaterial({ map: gTex, color: "#fbbf6a", transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  const lg = mesh(new THREE.PlaneGeometry(u(1100), u(1100)), lampGlow, lx + 300, floorY + 1550, wallZ + 6, root);
  lg.renderOrder = 2;

  mergeStatic(root, owned);
  mergeStatic(chair, owned);

  return {
    root,
    follow,
    leds,
    glows,
    lights,
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}
