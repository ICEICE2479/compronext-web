import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PlanItem } from "@/lib/room-planner";
import {
  deskmatTex,
  fabricTex,
  keysTex,
  leatherTex,
  metalBrushedTex,
  pcMeshTex,
  rugTex,
  screenTex,
  speakerConeTex,
  woodTex,
} from "./room3d-textures";

/**
 * โมเดลสินค้า 3 มิติ สมจริงระดับสูง (High-Fidelity Photorealistic 3D Models)
 * ออกแบบตามโครงสร้างสินค้าจริงทุกสัดส่วน: บานตู้, กระจกเงา, มือจับ, ล้อเก้าอี้ 5 แฉก, โช้คไฮดรอลิก,
 * เบาะ Ergonomic, เคสเกมมิ่งใสเห็นการ์ดจอ/ชุดน้ำ, จอขอบบางพร้อมโคมไฟแขวนจอ และรายละเอียด PBR ครบถ้วน
 * ทุกชิ้นวางฐานที่ y = 0 กึ่งกลาง x/z = 0 หันหน้าไปทาง +z (หน่วย ซม. แล้วคูณ CM = 0.01 เป็นเมตร)
 */
export const CM = 0.01;

export type Mats = ReturnType<typeof makeMats>;

export function makeMats() {
  const std = (color: string, rough = 0.6, metal = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

  return {
    std,
    metal: std("#22262c", 0.35, 0.8),
    chrome: std("#d8dce4", 0.18, 0.95),
    gold: std("#f59e0b", 0.25, 0.85),
    black: std("#121417", 0.55, 0.05),
    darkGrey: std("#1f242c", 0.6, 0.1),
    fabric: std("#2f3338", 0.92, 0.0),
    white: std("#f8f9fa", 0.65, 0.0),
    warmWhite: std("#f3efe6", 0.75, 0.0),
    leaf: std("#2d6a4f", 0.65, 0.0),
    leaf2: std("#40916c", 0.6, 0.0),
    soil: std("#2b1d14", 0.98, 0.0),
    potCeramic: std("#d8b4a0", 0.45, 0.05),
    woodLeg: std("#c29b6e", 0.65, 0.0),
    rubber: std("#0f172a", 0.9, 0.0),
    mirror: new THREE.MeshStandardMaterial({
      color: "#e2e8f0",
      roughness: 0.04,
      metalness: 0.98,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#1e293b",
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.45,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    }),
    rgbGlow: new THREE.MeshStandardMaterial({
      color: "#06b6d4",
      emissive: "#06b6d4",
      emissiveIntensity: 2.2,
      roughness: 0.2,
    }),
    rgbPurple: new THREE.MeshStandardMaterial({
      color: "#a855f7",
      emissive: "#a855f7",
      emissiveIntensity: 2.4,
      roughness: 0.2,
    }),
    rgbCoral: new THREE.MeshStandardMaterial({
      color: "#f43f5e",
      emissive: "#f43f5e",
      emissiveIntensity: 2.4,
      roughness: 0.2,
    }),
    warmLight: new THREE.MeshStandardMaterial({
      color: "#fffbeb",
      emissive: "#fbbf24",
      emissiveIntensity: 2.0,
    }),
    book: [
      std("#b91c1c", 0.75),
      std("#1d4ed8", 0.75),
      std("#b45309", 0.75),
      std("#15803d", 0.75),
      std("#6b21a8", 0.75),
      std("#0f172a", 0.75),
    ],
  };
}

/** กล่องขอบมนลบเหลี่ยม 3 มิติ (Rounded Box Mesh Helper) */
function rbox(
  g: THREE.Group,
  m: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  r = 1.0
) {
  const bevel = Math.max(0.01, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w * CM, h * CM, d * CM, 2, bevel * CM), m);
  mesh.position.set(x * CM, y * CM, z * CM);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** ทรงกระบอกสมจริง (Cylinder Mesh Helper) */
function cyl(
  g: THREE.Group,
  m: THREE.Material,
  rTop: number,
  rBot: number,
  h: number,
  x: number,
  y: number,
  z: number,
  seg = 24
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop * CM, rBot * CM, h * CM, seg), m);
  mesh.position.set(x * CM, y * CM, z * CM);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** ทรงกลม/รูปไข่สมจริง (Sphere Mesh Helper) */
function ball(
  g: THREE.Group,
  m: THREE.Material,
  r: number,
  x: number,
  y: number,
  z: number,
  sy = 1,
  sx = 1,
  sz = 1
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r * CM, 20, 16), m);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x * CM, y * CM, z * CM);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** ทรงวงแหวน Torus (สำหรับไฟวงแหวน, ข้อต่อ, สายเคเบิล) */
function torus(
  g: THREE.Group,
  m: THREE.Material,
  radius: number,
  tube: number,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotY = 0,
  rotZ = 0
) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius * CM, tube * CM, 12, 32), m);
  mesh.position.set(x * CM, y * CM, z * CM);
  mesh.rotation.set(rotX, rotY, rotZ);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}

/** แผ่นกลม Disc (สำหรับดอกลำโพง, ฐาน, ปุ่มหมุน) */
function disc(
  g: THREE.Group,
  m: THREE.Material,
  radius: number,
  x: number,
  y: number,
  z: number,
  rotX = 0
) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius * CM, 32), m);
  mesh.position.set(x * CM, y * CM, z * CM);
  mesh.rotation.x = rotX;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/**
 * สร้างโมเดล 3 มิติ สมจริงระดับสูงตามประเภท ข้อมูล และสเปกสินค้าจริง
 */
export function buildItem(it: PlanItem, M: Mats, night: boolean): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = it;
  const nameLower = (it.name || "").toLowerCase();

  const owned: THREE.Material[] = [];
  const mk = (color: string, rough = 0.6, metal = 0) => {
    const m = M.std(color, rough, metal);
    owned.push(m);
    return m;
  };
  g.userData.disposables = owned;

  const tex = (map: THREE.Texture, rough: number, repeat: [number, number] = [1, 1], metal = 0) => {
    const t = map.clone();
    t.needsUpdate = true;
    t.repeat.set(repeat[0], repeat[1]);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: metal });
    owned.push(m);
    (g.userData.textures ??= []).push(t);
    return m;
  };

  const isWood =
    /^#(b|c|d|a|e[0-7])/i.test(it.color) &&
    !/^#(a8b0ba|ffffff|000000|1f2125|eeeeec)/i.test(it.color);
  const woodBody = isWood ? tex(woodTex(it.color), 0.52, [Math.max(1, w / 110), Math.max(1, h / 120)]) : mk(it.color, 0.58);
  const baseBody = mk(it.color, 0.62);

  switch (it.category) {
    // ==========================================
    // 1) ตู้เสื้อผ้า (Wardrobe: เช่น KLEPPSTAD, BRIMNES, LASTARE, BRUKSVARA)
    // ==========================================
    case "wardrobe": {
      const isSliding = nameLower.includes("บานเลื่อน") || nameLower.includes("sliding");
      const hasMirror =
        nameLower.includes("กระจก") || nameLower.includes("mirror") || nameLower.includes("brimnes");
      const hasDrawers =
        nameLower.includes("ลิ้นชัก") || nameLower.includes("drawer") || nameLower.includes("bruksvara");
      const numDoors =
        nameLower.includes("3 บาน") || nameLower.includes("3-door")
          ? 3
          : nameLower.includes("2 บาน") || nameLower.includes("2-door")
          ? 2
          : nameLower.includes("1 บาน")
          ? 1
          : Math.max(2, Math.min(4, Math.round(w / 45)));

      const tWall = 2.0; // ความหนาแผ่นไม้โครงตู้
      const plinthH = 7.0; // ฐานล่างเว้าเข้า (Plinth / Kickplate)
      const plinthInset = 3.5;
      const drawerSectionH = hasDrawers ? 42.0 : 0;
      const doorSectionH = h - plinthH - drawerSectionH - tWall;

      // ฐานล่างเว้าเข้าป้องกันเตะโดน (Kickplate Plinth)
      rbox(g, mk(it.color, 0.75), w - plinthInset * 2, plinthH, d - plinthInset * 2, 0, plinthH / 2, -plinthInset / 2, 0.5);

      // แผ่นล่างของตู้
      rbox(g, woodBody, w, tWall, d, 0, plinthH + tWall / 2, 0, 0.4);

      // แผ่นข้างซ้าย-ขวา
      for (const sx of [-1, 1]) {
        rbox(g, woodBody, tWall, h - plinthH, d, sx * (w / 2 - tWall / 2), plinthH + (h - plinthH) / 2, 0, 0.4);
      }

      // แผ่นหลังตู้แบบร่องหลืบ
      rbox(g, mk(it.color, 0.8), w - tWall * 2, h - plinthH - tWall, 0.8, 0, plinthH + (h - plinthH) / 2, -d / 2 + 0.6, 0.2);

      // แผ่นท็อปบนสุดของตู้ยื่นออกมาเล็กน้อยแบบโมเดิร์น
      rbox(g, woodBody, w + 1.2, tWall + 0.6, d + 1.2, 0, h - (tWall + 0.6) / 2, 0, 0.6);

      // กรณีมีลิ้นชักด้านล่าง (Drawers Section เช่น BRUKSVARA หรือ BRIMNES)
      if (hasDrawers) {
        const dH = drawerSectionH / 2;
        for (let di = 0; di < 2; di++) {
          const dy = plinthH + tWall + di * dH + dH / 2;
          rbox(g, woodBody, w - tWall * 2 - 0.8, dH - 0.8, 2.2, 0, dy, d / 2 + 0.5, 0.6);
          // มือจับลิ้นชักอะลูมิเนียมเรียบหรู
          rbox(g, M.chrome, 14, 1.4, 2.2, 0, dy, d / 2 + 1.8, 0.4);
        }
      }

      // บานประตูตู้เสื้อผ้า (Wardrobe Doors)
      const doorStartY = plinthH + tWall + drawerSectionH;
      const doorCenterY = doorStartY + doorSectionH / 2;
      const doorW = (w - tWall * 2 - 0.8 * (numDoors - 1)) / numDoors;

      if (isSliding) {
        // ประตูบานเลื่อน (Sliding Doors): ซ้อนรางใน-นอก มีมิติเหลื่อมกัน
        const sDoorW = (w - tWall * 2) * 0.53;
        for (let si = 0; si < 2; si++) {
          const sx = si === 0 ? -w / 4 + 1.5 : w / 4 - 1.5;
          const sz = d / 2 + (si === 0 ? 0.3 : 2.5);
          // บานเลื่อน
          rbox(g, woodBody, sDoorW, doorSectionH - 1.2, 2.0, sx, doorCenterY, sz, 0.8);
          // ร่องมือจับบานเลื่อนทรงยาวแบบฝัง (Integrated Flush Pull Handle)
          rbox(g, M.chrome, 1.2, 36, 1.0, sx + (si === 0 ? sDoorW / 2 - 3.5 : -sDoorW / 2 + 3.5), doorCenterY, sz + 0.8, 0.3);
        }
      } else {
        // ประตูบานเปิดแบบมีร่องเงา Shaker Bevel และกระจกเงา
        for (let i = 0; i < numDoors; i++) {
          const dx = -w / 2 + tWall + doorW * (i + 0.5) + (i > 0 ? 0.8 * i : 0);
          const isMirrorDoor = hasMirror && (numDoors === 3 ? i === 1 : i === numDoors - 1);

          if (isMirrorDoor) {
            // บานกระจกเงาสะท้อนชัดเจน (Full-height Mirror Door)
            rbox(g, M.chrome, doorW - 0.6, doorSectionH - 0.6, 1.8, dx, doorCenterY, d / 2 + 0.6, 0.4);
            rbox(g, M.mirror, doorW - 2.8, doorSectionH - 3.2, 0.6, dx, doorCenterY, d / 2 + 1.6, 0.2);
            // มือจับเล็กชิดขอบกระจก
            rbox(g, M.chrome, 1.2, 18, 2.2, dx + doorW / 2 - 2.8, doorCenterY, d / 2 + 2.2, 0.3);
          } else {
            // บานไม้สไตล์ Shaker คิ้วกรอบนูนมีมิติ
            rbox(g, woodBody, doorW - 0.6, doorSectionH - 0.6, 2.0, dx, doorCenterY, d / 2 + 0.6, 0.6);
            // ร่องคิ้วบานด้านใน (Shaker Inset Bevel)
            rbox(g, mk(it.color, 0.72), doorW - 8, doorSectionH - 10, 0.8, dx, doorCenterY, d / 2 + 1.2, 0.3);
            // มือจับแท่งยาวสแตนเลส (Vertical Stainless Bar Handle)
            const handleX = i === 0 ? dx + doorW / 2 - 4.5 : dx - doorW / 2 + 4.5;
            rbox(g, M.chrome, 1.4, 28, 2.6, handleX, doorCenterY, d / 2 + 2.5, 0.4);
            rbox(g, M.chrome, 1.2, 1.2, 2.2, handleX, doorCenterY + 11, d / 2 + 1.5, 0.2);
            rbox(g, M.chrome, 1.2, 1.2, 2.2, handleX, doorCenterY - 11, d / 2 + 1.5, 0.2);
          }
        }
      }
      break;
    }

    // ==========================================
    // 2) เก้าอี้ (Chair: Ergonomic & Gaming Chair เช่น MARKUS, Secretlab, Herman Miller)
    // ==========================================
    case "chair": {
      const isGaming = nameLower.includes("เกม") || nameLower.includes("gaming") || nameLower.includes("racer");
      const fabMat = isGaming
        ? tex(leatherTex(it.color === "#2f3338" ? "#1e2229" : it.color), 0.65, [2, 2])
        : tex(fabricTex(it.color === "#2f3338" ? "#2b3038" : it.color), 0.9, [2, 2]);

      const seatH = Math.min(52, Math.max(42, h * 0.42));
      const starR = Math.min(w, d) * 0.46; // รัศมีขา 5 แฉก

      // 1) ล้อคู่ 5 แฉก (Twin-wheel Casters) พร้อมแกนล้อและฝาครอบ
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const lx = Math.cos(a) * starR;
        const lz = Math.sin(a) * starR;

        // ขาเก้าอี้ทรงสปอร์ตลู่ลง
        const leg = rbox(g, M.darkGrey, starR * 0.95, 2.4, 4.2, lx * 0.48, 5.5, lz * 0.48, 1.0);
        leg.rotation.y = -a;

        // แกนหมุนและล้อคู่
        cyl(g, M.chrome, 0.8, 0.8, 3.5, lx, 4.2, lz, 16);
        cyl(g, M.black, 3.2, 3.2, 2.8, lx, 2.8, lz, 20).rotation.z = Math.PI / 2;
        torus(g, M.rubber, 3.0, 0.5, lx, 2.8, lz, 0, a, Math.PI / 2);
      }

      // ดุมกลางขา 5 แฉก
      cyl(g, M.darkGrey, 5.5, 6.2, 4.0, 0, 6.2, 0, 24);

      // โช้คปรับระดับไฮดรอลิก 3 ชั้น (Class-4 Telescoping Gas Lift)
      cyl(g, M.chrome, 1.8, 1.8, seatH - 12, 0, 6 + (seatH - 12) / 2, 0, 24);
      cyl(g, M.black, 3.4, 3.6, seatH * 0.45, 0, 6 + seatH * 0.22, 0, 24);

      // กล่องกลไกควบคุมการเอนใต้เบาะ (Under-seat Tilt Mechanism + Tension Knob)
      rbox(g, M.black, 18, 6.0, 22, 0, seatH - 4.0, 0, 1.2);
      cyl(g, M.chrome, 0.7, 0.7, 14, 10, seatH - 4.5, 4, 16).rotation.z = Math.PI / 2;
      ball(g, M.black, 1.4, 17, seatH - 4.5, 4); // หัวคันโยกปรับระดับ

      // เบาะนั่งทรงสรีรศาสตร์ (Contoured Ergonomic Seat Cushion)
      const seatW = w * 0.88;
      const seatD = d * 0.86;
      rbox(g, fabMat, seatW, 9.0, seatD, 0, seatH, 1, 4.5);
      // ปีกข้างเบาะรองรับต้นขา
      for (const sx of [-1, 1]) {
        rbox(g, fabMat, 7.5, 5.5, seatD * 0.85, sx * (seatW / 2 - 3.5), seatH + 3.8, 1, 3.0);
      }

      // พนักพิงหลัง S-Curve (Ergonomic Backrest)
      const backH = h - seatH - 4;
      const backZ = -seatD * 0.38;
      const backAngle = -0.12;

      const backrest = rbox(g, fabMat, seatW * 0.84, backH, 8.5, 0, seatH + backH / 2 + 1, backZ, 5.5);
      backrest.rotation.x = backAngle;

      // ปีกโอบกระชับด้านข้างพนักพิง (Lateral Kidney Bolsters)
      for (const sx of [-1, 1]) {
        const wing = rbox(g, fabMat, 6.5, backH * 0.75, 12.0, sx * (seatW * 0.42), seatH + backH * 0.45, backZ + 2.5, 4.0);
        wing.rotation.x = backAngle;
        wing.rotation.y = sx * 0.22;
      }

      if (isGaming) {
        // ช่องร้อยสายระบายอากาศคู่ (Dual Racing Harness Pass-through Vents)
        for (const sx of [-1, 1]) {
          const vent = rbox(g, M.black, 6.5, 4.5, 9.5, sx * 10, h - 18, backZ + 3.0, 2.0);
          vent.rotation.x = backAngle;
          rbox(g, M.darkGrey, 4.5, 2.5, 10.0, sx * 10, h - 18, backZ + 3.0, 1.2).rotation.x = backAngle;
        }

        // หมอนรองคอเมมโมรี่โฟม (Memory Foam Neck Pillow with Straps)
        const neckPillow = ball(g, fabMat, 8.5, 0, h - 12, backZ + 5.5, 0.7, 1.5, 0.7);
        neckPillow.rotation.x = backAngle;

        // หมอนรองเอวปรับระดับได้ (Adjustable Lumbar Cushion)
        const lumbarPillow = ball(g, fabMat, 9.0, 0, seatH + 15, backZ + 5.5, 0.65, 1.4, 0.65);
        lumbarPillow.rotation.x = backAngle;
      } else {
        // แผ่นรองเอวพนักพิงตาข่าย (Adjustable Lumbar Support Pad)
        const lumbar = rbox(g, M.black, seatW * 0.65, 12, 4.0, 0, seatH + 16, backZ - 4.5, 2.5);
        lumbar.rotation.x = backAngle;

        // พนักพิงศีรษะโค้งมนรับต้นคอ (Contoured Headrest)
        const headrest = rbox(g, fabMat, seatW * 0.52, 15, 7.0, 0, h - 4, backZ + 4.0, 4.0);
        headrest.rotation.x = -0.05;
        // ก้านยึดพนักพิงศีรษะ
        cyl(g, M.chrome, 1.2, 1.2, 10, 0, h - 11, backZ - 2.0, 16);
      }

      // ที่วางแขน 3D/4D (Adjustable Padded Armrests)
      for (const sx of [-1, 1]) {
        const armX = sx * (w * 0.44);
        // เสาเหล็กยึดจากใต้เบาะ
        rbox(g, M.black, 3.8, 18, 4.5, armX, seatH + 6, 2, 1.0);
        rbox(g, M.chrome, 3.0, 12, 3.5, armX, seatH + 14, 2, 0.8);
        // แผ่นรองแขน PU โค้งเว้ารับท่อนแขน
        const cap = rbox(g, M.black, 8.5, 3.2, d * 0.52, armX, seatH + 20.5, 4, 2.2);
        cap.rotation.y = sx * -0.05;
      }
      break;
    }

    // ==========================================
    // 3) โต๊ะคอม / โต๊ะทำงาน (Desk: Gaming & Standing Desk เช่น FREDDE, BEKANT, UPPSPEL)
    // ==========================================
    case "desk": {
      const isStanding =
        nameLower.includes("ปรับระดับ") ||
        nameLower.includes("ไฟฟ้า") ||
        nameLower.includes("standing") ||
        nameLower.includes("lift");

      const topT = 2.8; // ความหนาท็อปโต๊ะ
      const topY = h - topT / 2;

      // 1) ท็อปโต๊ะไม้ขอบมน + ปาดเว้า Ergonomic ด้านหน้า
      rbox(g, woodBody, w, topT, d, 0, topY, 0, 1.4);

      // ช่องร้อยสายไฟซ้าย-ขวา (Dual Cable Grommet Caps)
      for (const sx of [-1, 1]) {
        cyl(g, M.darkGrey, 3.2, 3.2, topT + 0.2, sx * (w / 2 - 14), topY + 0.1, -d / 2 + 10, 24);
        cyl(g, M.black, 2.2, 2.2, topT + 0.4, sx * (w / 2 - 14), topY + 0.2, -d / 2 + 10, 24);
      }

      // 2) ขาโต๊ะเหล็กทรงพลัง (Telescoping Lifting Columns หรือ โครงขา A-Frame)
      const legInsetX = Math.min(18, w * 0.12);
      const legInsetZ = d * 0.35;

      for (const sx of [-1, 1]) {
        const lx = sx * (w / 2 - legInsetX);

        if (isStanding) {
          // ขาโต๊ะปรับระดับไฟฟ้า 3 ตอน (3-Stage Motorized Telescopic Legs)
          cyl(g, M.darkGrey, 4.5, 4.5, (h - topT) * 0.38, lx, (h - topT) * 0.8, 0, 4).rotation.y = Math.PI / 4;
          cyl(g, M.darkGrey, 5.2, 5.2, (h - topT) * 0.36, lx, (h - topT) * 0.48, 0, 4).rotation.y = Math.PI / 4;
          cyl(g, M.darkGrey, 6.0, 6.0, (h - topT) * 0.34, lx, (h - topT) * 0.17, 0, 4).rotation.y = Math.PI / 4;

          // ฐานเท้าโต๊ะเหล็กยาวมั่นคง (Heavy Low-Profile Feet)
          rbox(g, M.darkGrey, 8.5, 2.2, d * 0.88, lx, 1.1, 0, 0.8);
          // ปุ่มหมุนปรับระดับพื้นด้านล่าง 2 จุด
          for (const sz of [-1, 1]) {
            cyl(g, M.black, 2.4, 2.4, 0.8, lx, 0.4, sz * (d * 0.36), 16);
          }
        } else {
          // ขาเหล็กกล่อง A-Frame แข็งแกร่ง
          rbox(g, M.darkGrey, 4.5, h - topT - 2, 4.5, lx, (h - topT) / 2, -legInsetZ, 0.6);
          rbox(g, M.darkGrey, 4.5, h - topT - 2, 4.5, lx, (h - topT) / 2, legInsetZ, 0.6);
          rbox(g, M.darkGrey, 5.5, 2.5, d * 0.84, lx, 1.25, 0, 0.8);
          rbox(g, M.darkGrey, 5.5, 3.5, d * 0.84, lx, h - topT - 1.75, 0, 0.8);
        }
      }

      // คานเหล็กเสริมความแข็งแรงใต้โต๊ะ (Heavy Crossbar Beam)
      rbox(g, M.darkGrey, w - legInsetX * 2 - 8, 4.5, 4.0, 0, h - topT - 3.5, 0, 0.5);

      // ถาดตะแกรงเหล็กเก็บสายไฟใต้โต๊ะ (Under-desk Cable Management Tray)
      rbox(g, M.black, w * 0.55, 8.0, 14.0, 0, h - topT - 5.5, -d / 2 + 15, 1.5);

      // แผงควบคุมดิจิทัล LED หน้าโต๊ะด้านขวา (Digital Height Display Controller)
      const ctrl = rbox(g, M.black, 10.0, 2.4, 4.5, w / 2 - 12, h - topT - 1.2, d / 2 - 1.5, 0.6);
      ctrl.rotation.x = 0.25;
      rbox(g, M.rgbGlow, 3.5, 1.0, 0.2, w / 2 - 13, h - topT - 0.8, d / 2 + 0.8, 0.2); // ไฟตัวเลข LED 75.0

      // ที่แขวนหูฟังด้านข้างซ้าย (Side Headphone Hook)
      rbox(g, M.chrome, 1.2, 5.5, 8.0, -w / 2 + 0.6, h - topT - 4, d * 0.15, 0.4);
      break;
    }

    // ==========================================
    // 4) คอมพิวเตอร์เคสเกมมิ่งระดับท็อป (Gaming PC Chassis)
    // ==========================================
    case "computer": {
      // โครงเคสหลักสีดำ/ขาว ผิวด้านเรียบหรู (Dual Chamber Chassis เช่น Lian Li O11 / NZXT H9)
      rbox(g, baseBody, w, h, d, 0, h / 2, 0, 1.6);

      // กระจกเทมเปอร์ใสพาโนรามาด้านข้างและด้านหน้า (Tempered Glass Side & Front Panels)
      const glassMat = M.glass;
      // กระจกข้าง
      rbox(g, glassMat, 0.6, h - 5.5, d - 4.5, w / 2 + 0.2, h / 2, 0, 0.4);
      // กระจกหน้า
      rbox(g, glassMat, w - 4.5, h - 5.5, 0.6, 0, h / 2, d / 2 + 0.2, 0.4);

      // แผงเมนบอร์ดด้านใน (Internal Motherboard with VRM Heatsinks)
      rbox(g, M.black, 2.0, h * 0.65, d * 0.68, -w * 0.15, h * 0.52, -2, 0.5);
      rbox(g, M.metal, 2.2, 8.0, 10.0, -w * 0.14, h * 0.72, -8, 0.4); // ฮีตซิงก์ภาคจ่ายไฟ

      // การ์ดจอตัวท็อป 3 พัดลมพร้อมไฟ RGB (Triple-Fan Gaming GPU เช่น RTX 4080 / 4090)
      const gpuW = w * 0.65;
      const gpuH = 7.5;
      const gpuD = d * 0.62;
      rbox(g, M.darkGrey, gpuW, gpuH, gpuD, 0.5, h * 0.42, 0, 1.0);
      rbox(g, M.metal, gpuW + 0.2, 1.2, gpuD - 1.0, 0.5, h * 0.42 + gpuH / 2, 0, 0.4); // Backplate
      // ไฟโลโก้ด้านข้างการ์ดจอ "GEFORCE RTX"
      rbox(g, M.rgbGlow, 1.2, 1.8, 14.0, w / 2 - 1.2, h * 0.42, 0, 0.3);

      // ชุดน้ำปิด 360mm AIO Cooler (CPU Liquid Cooler with Braided Tubes)
      cyl(g, M.black, 4.0, 4.0, 3.2, -w * 0.12, h * 0.62, -2, 24).rotation.x = Math.PI / 2;
      cyl(g, M.rgbPurple, 3.2, 3.2, 0.5, -w * 0.12, h * 0.62, -0.3, 24).rotation.x = Math.PI / 2; // หน้าปัดปั๊มเรืองแสง
      // สายยางถักคู่ไปยังหม้อน้ำด้านบน
      torus(g, M.black, 9.0, 0.7, -w * 0.1, h * 0.74, 2, 0, Math.PI / 3, 0);

      // แรมคู่พร้อมไฟ RGB Diffuser (Dual RGB RAM Sticks)
      for (const rz of [-1, 1]) {
        rbox(g, M.rgbCoral, 1.2, 5.0, 0.9, -w * 0.12, h * 0.65, rz * 1.8 + 5, 0.2);
      }

      // พัดลมเคส ARGB 3 ตัวเรียงกันด้านหน้า/ข้าง (ARGB Case Fans with Halo Rings)
      for (let i = 0; i < 3; i++) {
        const fy = h * 0.25 + i * (h * 0.26);
        const fanR = Math.min(w, d) * 0.28;
        // กรอบพัดลม
        rbox(g, M.black, 1.5, fanR * 2, fanR * 2, w / 2 - 2.5, fy, d * 0.18, 0.5);
        // วงแหวนไฟ Halo RGB
        torus(g, i % 2 === 0 ? M.rgbGlow : M.rgbPurple, fanR * 0.85, 0.6, w / 2 - 2.0, fy, d * 0.18, 0, Math.PI / 2, 0);
        // ดุมใบพัด
        cyl(g, M.darkGrey, fanR * 0.32, fanR * 0.32, 1.2, w / 2 - 2.0, fy, d * 0.18, 16).rotation.z = Math.PI / 2;
      }

      // แสงไฟนีออน RGB ด้านในเคสตอนกลางคืน (Real Ambient Case Glow Light)
      if (night) {
        const pcLight = new THREE.PointLight("#38bdf8", 1.8, 2.5, 2.0);
        pcLight.position.set(0, h * 0.5 * CM, 0);
        g.add(pcLight);
      }
      break;
    }

    // ==========================================
    // 5) หน้าจอเกมมิ่ง / หน้าจอมอนิเตอร์ (Gaming & Professional Monitor)
    // ==========================================
    case "monitor": {
      const isCurved = nameLower.includes("curved") || nameLower.includes("โค้ง") || w >= 80;
      const screenH = h * 0.68;
      const screenCenterY = h * 0.64;

      // 1) ฐานจอเหล็กแข็งแกร่ง (Heavy Metal V-Wing Gaming Base)
      rbox(g, M.darkGrey, 28, 1.4, 20, 0, 0.7, 0, 2.0);
      rbox(g, M.chrome, 8, 1.8, 8, 0, 1.0, -3, 1.5); // จุดหมุนข้อต่อฐาน

      // เสาคอจอปรับระดับสูง-ต่ำ (Telescoping Monitor Arm Column + Cable Clip)
      const neckH = screenCenterY - 4;
      rbox(g, M.darkGrey, 4.8, neckH, 4.2, 0, neckH / 2 + 1, -6, 1.2);
      rbox(g, M.chrome, 3.8, neckH * 0.6, 3.2, 0, screenCenterY - neckH * 0.25, -6, 0.8);
      torus(g, M.rgbCoral, 2.8, 0.5, 0, neckH * 0.45, -6, Math.PI / 2, 0, 0); // แหวนร้อยสายไฟสีส้มแดง

      // 2) กรอบหลังหน้าจอโค้งมนโมเดิร์น (Monitor Enclosure)
      rbox(g, M.black, w, screenH, 3.2, 0, screenCenterY, -1.6, 1.4);

      // วงแหวนไฟ Ambient RGB ด้านหลังจอ (Rear Ambient Halo Lighting)
      torus(g, M.rgbGlow, Math.min(w, screenH) * 0.26, 0.8, 0, screenCenterY, -3.2, 0, 0, 0);
      if (night) {
        const haloLight = new THREE.PointLight("#38bdf8", 1.4, 2.2, 2.0);
        haloLight.position.set(0, screenCenterY * CM, -0.15);
        g.add(haloLight);
      }

      // 3) หน้าจอแสดงผล 4K ขอบบางเฉียบ (Ultra-slim 3-Sided Borderless Display)
      const screenMat = new THREE.MeshStandardMaterial({
        map: screenTex(night),
        emissiveMap: screenTex(night),
        emissive: "#ffffff",
        emissiveIntensity: night ? 1.2 : 0.65,
        roughness: 0.15,
      });
      owned.push(screenMat);

      // ขอบล่างจอ (Chin Bezel with Logo Emblem)
      rbox(g, M.darkGrey, w, 1.8, 3.4, 0, screenCenterY - screenH / 2 + 0.9, -1.5, 0.4);
      rbox(g, M.chrome, 3.5, 0.8, 0.4, 0, screenCenterY - screenH / 2 + 0.9, 0.3, 0.2); // ตราโลโก้สีเงิน

      // พาเนลหน้าจอ
      const scr = rbox(g, screenMat, w - 1.2, screenH - 2.2, 0.4, 0, screenCenterY + 0.5, 0.2, 0.2);
      scr.castShadow = false;

      // 4) โคมไฟแขวนหน้าจอถนอมสายตา (Monitor Light Bar เช่น BenQ ScreenBar)
      const barW = Math.min(48, w * 0.65);
      const barY = screenCenterY + screenH / 2 + 2.5;
      // ตัวบาร์อะลูมิเนียม
      cyl(g, M.darkGrey, 1.4, 1.4, barW, 0, barY, 1.5, 24).rotation.z = Math.PI / 2;
      // แถบหลอดไฟ LED หันเฉียงลงโต๊ะ
      cyl(g, night ? M.warmLight : M.white, 0.8, 0.8, barW - 4, 0, barY - 0.8, 1.8, 16).rotation.z = Math.PI / 2;
      // ขาหนีบจอถ่วงน้ำหนักด้านหลัง
      rbox(g, M.black, 4.5, 4.0, 7.5, 0, barY - 1.0, -1.8, 1.0);
      cyl(g, M.darkGrey, 2.5, 2.5, 5.0, 0, barY - 3.5, -4.5, 20).rotation.z = Math.PI / 2;

      if (night) {
        // แสงไฟจาก Light Bar ส่องลงมาบนโต๊ะ
        const barLight = new THREE.SpotLight("#ffedd5", 2.2, 3.2, Math.PI / 3, 0.4, 1.8);
        barLight.position.set(0, barY * CM, 0.05);
        barLight.target.position.set(0, 0, 0.25);
        g.add(barLight, barLight.target);
      }
      break;
    }

    // ==========================================
    // 6) คีย์บอร์ดแมคคานิคอล (Custom Mechanical Keyboard)
    // ==========================================
    case "keyboard": {
      // ตัวเคสอะลูมิเนียม CNC ชุบอโนไดซ์สีเข้ม เอียง 7 องศา (7° Ergonomic Incline CNC Case)
      rbox(g, M.darkGrey, w, h * 0.75, d, 0, h * 0.38, 0, 1.2);

      // ปุ่มคีย์บอร์ดหลากสี PBT Double-shot Keycaps
      const km = new THREE.MeshStandardMaterial({
        map: keysTex(),
        roughness: 0.55,
        metalness: 0.05,
      });
      owned.push(km);
      rbox(g, km, w - 1.8, 0.9, d - 1.8, 0, h * 0.78 + 0.4, 0, 0.3);

      // ลูกบิดหมุนปรับเสียงอะลูมิเนียมเจียรลายเพชร (Rotary Volume Knob Encoder)
      cyl(g, M.gold, 1.4, 1.4, 1.6, w / 2 - 3.5, h + 0.8, -d / 2 + 3.5, 24);

      // สายถักขดสปริง Custom Coiled Aviator Cable พร้อมหัวต่อโลหะ
      torus(g, M.fabric, 3.2, 0.5, 0, 1.0, -d / 2 - 5.0, Math.PI / 2, 0, 0);
      cyl(g, M.chrome, 0.9, 0.9, 3.5, 0, 1.0, -d / 2 - 1.5, 16).rotation.x = Math.PI / 2;
      break;
    }

    // ==========================================
    // 7) เมาส์เกมมิ่ง (Ergonomic Esports Wireless Mouse)
    // ==========================================
    case "mouse": {
      // โครงตัวเมาส์ทรงโค้งโอบรับฝ่ามือ (Ergonomic Contoured Shell)
      const mW = Math.max(w, 6.2);
      const mD = Math.max(d, 11.5);
      const mH = Math.max(h, 3.8);

      // ฐานเมาส์
      rbox(g, M.black, mW * 0.85, 0.8, mD * 0.85, 0, 0.4, 0, 1.0);
      // แผ่นรองลื่น PTFE ใต้เมาส์
      rbox(g, M.white, mW * 0.7, 0.2, 2.0, 0, 0.1, -mD * 0.35, 0.5);
      rbox(g, M.white, mW * 0.7, 0.2, 2.5, 0, 0.1, mD * 0.35, 0.5);

      // หลังเมาส์นูนรับอุ้งมือ
      const hump = ball(g, baseBody, mW * 0.5, 0, mH * 0.45, -mD * 0.08, (mH / mW) * 1.5, 1.0, 1.8);
      hump.rotation.x = -0.15;

      // ล้อเลื่อนยางมีร่องบาก (Tactile Rubber Scroll Wheel)
      torus(g, M.chrome, 1.1, 0.4, 0, mH * 0.85, mD * 0.24, 0, Math.PI / 2, 0);
      torus(g, M.rubber, 1.0, 0.35, 0, mH * 0.85, mD * 0.24, 0, Math.PI / 2, 0);

      // ปุ่มคลิกซ้าย-ขวาแยกชิ้น (Split Primary Buttons)
      for (const sx of [-1, 1]) {
        rbox(g, baseBody, mW * 0.42, 1.2, mD * 0.38, sx * (mW * 0.24), mH * 0.65, mD * 0.24, 0.6);
      }

      // ปุ่มด้านข้างนิ้วโป้ง (Side Thumb Buttons)
      rbox(g, M.chrome, 0.5, 1.0, 2.2, -mW * 0.48, mH * 0.45, -0.5, 0.2);
      rbox(g, M.chrome, 0.5, 1.0, 2.2, -mW * 0.48, mH * 0.45, 2.2, 0.2);
      break;
    }

    // ==========================================
    // 8) แผ่นรองโต๊ะ Deskmat XXL (Topographic Deskmat)
    // ==========================================
    case "keyboard_pad":
    case "mousepad": {
      const padMat = tex(deskmatTex(it.color === "#2f3338" ? "#181b20" : it.color), 0.95, [1, 1]);
      rbox(g, padMat, w, Math.max(0.6, h), d, 0, Math.max(0.3, h / 2), 0, 1.8);
      break;
    }

    // ==========================================
    // 9) ลำโพงคู่ Studio Monitors (Pair of Studio Speakers)
    // ==========================================
    case "speaker": {
      // ตู้ลำโพงไม้ MDF ปาดมุม Baffle (MDF Acoustic Cabinet)
      rbox(g, baseBody, w, h, d, 0, h / 2, 0, 1.2);
      // แผงหน้าตู้ Baffle
      rbox(g, M.darkGrey, w - 0.8, h - 0.8, 1.5, 0, h / 2, d / 2 + 0.6, 0.6);

      // ดอกลำโพงวูฟเฟอร์ใยเคฟลาร์สีทอง (Woven Kevlar Cone Woofer)
      const coneR = Math.min(w, h) * 0.32;
      const coneMat = new THREE.MeshStandardMaterial({
        map: speakerConeTex(),
        roughness: 0.45,
        metalness: 0.1,
      });
      owned.push(coneMat);
      disc(g, coneMat, coneR, 0, h * 0.42, d / 2 + 1.4);

      // ดอกทวีตเตอร์เสียงแหลมผ้าไหม (Silk Dome Tweeter in Waveguide)
      const twR = coneR * 0.45;
      disc(g, M.black, twR * 1.5, 0, h * 0.78, d / 2 + 1.35);
      ball(g, M.chrome, twR, 0, h * 0.78, d / 2 + 1.4, 0.4);

      // ท่อเบสรีเฟล็กซ์ด้านหน้า (Front Bass Reflex Port)
      cyl(g, M.black, coneR * 0.25, coneR * 0.25, 2.0, 0, h * 0.16, d / 2 + 0.8, 20).rotation.x = Math.PI / 2;

      // แผ่นโฟมซับแรงสั่นเอียงรับหู (Acoustic Foam Isolation Wedge Pads)
      const wedge = rbox(g, M.rubber, w * 0.9, 1.8, d * 0.9, 0, 0.9, 0, 0.4);
      wedge.rotation.x = -0.06;
      break;
    }

    // ==========================================
    // 10) หูฟังพร้อมขาตั้งอะลูมิเนียม (Headphones on Aluminum Stand)
    // ==========================================
    case "headphone": {
      // ฐานขาตั้งอะลูมิเนียมถ่วงน้ำหนักทรงกลม
      cyl(g, M.darkGrey, 7.5, 7.5, 1.4, 0, 0.7, 0, 32);
      // เสาอะลูมิเนียมตรง
      cyl(g, M.chrome, 1.2, 1.2, h - 4, 0, (h - 4) / 2 + 1.2, 0, 24);
      // ส่วนรองรับก้านหูฟังซิลิโคนโค้งมนด้านบน
      rbox(g, M.darkGrey, 12.0, 1.8, 5.5, 0, h - 1.5, 0, 1.4);

      // ตัวหูฟังระดับพรีเมียม (Over-Ear Headphones)
      // ก้านคาดศีรษะบุหนังนุ่ม (Padded Leather Headband)
      torus(g, M.black, 10.0, 1.2, 0, h - 4.5, 0, 0, 0, Math.PI / 2);
      rbox(g, M.darkGrey, 11.0, 1.5, 4.0, 0, h - 2.8, 0, 1.2);

      // ฟองน้ำครอบหูซ้าย-ขวา (Plush Leather Earcups)
      for (const sx of [-1, 1]) {
        const ex = sx * 9.5;
        const ey = h - 14.5;
        // ก้ามปูจับอะลูมิเนียม
        torus(g, M.chrome, 4.8, 0.5, ex, ey, 0, 0, Math.PI / 2, 0);
        // ฝาครอบหูฟังลายรังผึ้ง
        cyl(g, M.darkGrey, 4.5, 4.5, 3.2, ex + sx * 0.6, ey, 0, 24).rotation.z = Math.PI / 2;
        // เบาะฟองน้ำนุ่มแนบหู
        torus(g, M.fabric, 3.8, 1.2, ex - sx * 0.8, ey, 0, 0, Math.PI / 2, 0);
      }
      break;
    }

    // ==========================================
    // 11) ไมโครโฟนบรอดคาสต์พร้อมแขนจับบูม (Studio Microphone with Boom Arm)
    // ==========================================
    case "microphone": {
      // ตัวหนีบขอบโต๊ะ C-Clamp
      rbox(g, M.black, 4.5, 8.0, 5.5, 0, 4.0, 0, 0.8);
      // แขนบูมท่อนล่างและท่อนบน (Articulated Scissor Boom Arm)
      const a1 = cyl(g, M.darkGrey, 0.8, 0.8, h * 0.48, 0, h * 0.28, 0, 16);
      a1.rotation.z = 0.35;
      const a2 = cyl(g, M.darkGrey, 0.8, 0.8, h * 0.45, 6, h * 0.65, 0, 16);
      a2.rotation.z = -0.65;

      // สปริงและลูกบิดปรับความตึง (Tension Springs & Knobs)
      cyl(g, M.chrome, 1.4, 1.4, 2.5, 6, h * 0.65, 0, 16).rotation.x = Math.PI / 2;

      // ตัวไมค์ Shure SM7B Style พร้อมฟองน้ำกรองเสียง (Mic Capsule + Pop Filter)
      const micX = -4.0;
      const micY = h * 0.85;
      const micZ = 6.0;

      // โครง Shock Mount ทรง U
      torus(g, M.black, 4.5, 0.6, micX, micY, micZ, 0, Math.PI / 2, 0);

      // กระบอกไมค์โลหะและฟองน้ำกันลมสีดำหนานุ่ม
      const micBody = cyl(g, M.darkGrey, 2.8, 2.8, 7.5, micX, micY, micZ, 24);
      micBody.rotation.x = 0.5;
      const foam = cyl(g, M.fabric, 3.2, 3.2, 7.0, micX, micY - 2.8, micZ + 2.8, 24);
      foam.rotation.x = 0.5;
      ball(g, M.fabric, 3.2, micX, micY - 5.8, micZ + 5.5, 0.8); // ปลายมนของไมค์
      break;
    }

    // ==========================================
    // 12) แขนจับจอไฮดรอลิก (Gas-Spring Monitor Arm)
    // ==========================================
    case "monitor_arm": {
      // ฐานหนีบโต๊ะ Heavy-Duty Desk Clamp
      rbox(g, M.darkGrey, 12, 10, 10, 0, 5, 0, 1.2);
      cyl(g, M.darkGrey, 2.8, 2.8, 16, 0, 14, 0, 24);
      // ข้อต่อท่อนล่าง
      cyl(g, M.darkGrey, 2.4, 2.4, h * 0.45, 4, 18 + h * 0.2, 3, 20).rotation.z = 0.45;
      // แขนแก๊สสปริงท่อนบน
      cyl(g, M.chrome, 2.0, 2.0, h * 0.42, 2, h * 0.65, 8, 20).rotation.z = -0.55;
      // แป้น VESA 75/100 พร้อมลูกบอลปรับมุมก้ม-เงย
      ball(g, M.chrome, 3.2, 0, h * 0.85, 12);
      rbox(g, M.darkGrey, 14, 14, 1.4, 0, h * 0.85, 14, 0.8);
      break;
    }

    // ==========================================
    // 13) เตียงนอน (Bed: Platform Bed with Tufted Headboard & Puffy Duvet)
    // ==========================================
    case "bed": {
      const sheetMat = tex(fabricTex("#f8fafc"), 0.95, [3, 3]);
      const duvetMat = tex(fabricTex("#3b82f6"), 0.92, [3, 3]);
      const throwMat = tex(fabricTex("#94a3b8"), 0.95, [2, 2]);

      // ฐานโครงเตียงไม้และขาเตียงทรงสแกนดิเนเวียน (Bed Frame & Legs)
      rbox(g, woodBody, w, 22, d, 0, 15, 0, 2.0);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          cyl(g, M.woodLeg, 2.8, 2.0, 12, sx * (w / 2 - 8), 6, sz * (d / 2 - 8), 16);
        }
      }

      // ฟูกที่นอนหนานุ่มพรีเมียม (Plush Pillow-top Mattress with Piping)
      rbox(g, sheetMat, w - 4, 26, d - 6, 0, 39, 1, 5.0);

      // ผ้าห่มนวมหนานุ่มพับเปิดครึ่งบน (Puffy Down Duvet folded halfway)
      const duvetZ = d * 0.16;
      rbox(g, duvetMat, w - 2, 7.5, d * 0.62, 0, 52.5, duvetZ, 4.5);
      // รอยพับนวมด้านบน
      rbox(g, sheetMat, w - 2, 5.5, 14, 0, 53.5, duvetZ - d * 0.31, 3.5);

      // ผ้าพาดปลายเตียงเนื้อวาฟเฟิล (Accent Throw Blanket at foot of bed)
      rbox(g, throwMat, w + 0.5, 4.0, 24, 0, 53.0, d / 2 - 18, 3.0);

      // หมอนนอนใบใหญ่ 2 หรือ 4 ใบ (King Sleeping Pillows with Fabric Flanges)
      const pillowCols = w > 130 ? [-1, 1] : [0];
      for (const px of pillowCols) {
        const pil = rbox(g, M.white, Math.min(58, w * 0.4), 13, 34, px * (w * 0.24), 54, -d / 2 + 25, 5.5);
        pil.rotation.x = -0.16;
        // หมอนอิงประดับ (Decorative Cushion)
        const dPil = rbox(g, duvetMat, 32, 10, 32, px * (w * 0.24), 57, -d / 2 + 38, 4.0);
        dPil.rotation.x = -0.22;
        dPil.rotation.y = px * 0.12;
      }

      // หัวเตียงบุผ้านวมลายตารางหรูหรา (Tufted Channel Upholstered Headboard)
      const hbH = Math.max(90, h);
      rbox(g, tex(fabricTex("#64748b"), 0.95, [2, 2]), w + 4, hbH, 10, 0, hbH / 2, -d / 2 + 4, 4.0);
      // กระดุมบุหัวเตียง (Tufting Buttons)
      for (let row = 0; row < 3; row++) {
        for (let col = -3; col <= 3; col++) {
          ball(g, M.darkGrey, 1.2, col * (w / 8), hbH * 0.45 + row * 16, -d / 2 + 9.5, 0.6);
        }
      }
      break;
    }

    // ==========================================
    // 14) ตู้ลิ้นชัก ALEX / ชั้นวางของ KALLAX / ตู้หนังสือ BILLY (Storage & Shelving)
    // ==========================================
    case "storage": {
      const isAlexDrawer = nameLower.includes("alex") || nameLower.includes("ลิ้นชัก") || nameLower.includes("drawer");

      if (isAlexDrawer) {
        // ตู้ลิ้นชัก IKEA ALEX 5 ลิ้นชักอันโด่งดัง (Signature Scooped Cutout Handles)
        rbox(g, woodBody, w, h, d, 0, h / 2, 0, 1.2);
        const numDrawers = 5;
        const dH = (h - 6) / numDrawers;

        for (let i = 0; i < numDrawers; i++) {
          const dy = 4 + i * dH + dH / 2;
          // หน้าบานลิ้นชัก
          rbox(g, woodBody, w - 1.2, dH - 0.8, 1.8, 0, dy, d / 2 + 0.6, 0.4);
          // ร่องมือจับเว้าโค้งทรงรีอันเป็นเอกลักษณ์ของ ALEX
          cyl(g, M.darkGrey, 4.5, 4.5, 1.4, 0, dy + dH * 0.28, d / 2 + 0.9, 24).rotation.x = Math.PI / 2;
        }
      } else {
        // ชั้นวางของ KALLAX / BILLY พร้อมหนังสือและของแต่ง
        const t = 2.4;
        for (const sx of [-1, 1]) rbox(g, woodBody, t, h, d, sx * (w / 2 - t / 2), h / 2, 0, 0.6);
        rbox(g, woodBody, w, h, 1.2, 0, h / 2, -d / 2 + 0.6, 0.3);

        const shelves = Math.max(2, Math.round(h / 36));
        for (let k = 0; k <= shelves; k++) {
          rbox(g, woodBody, w, t, d, 0, (h - t) * (k / shelves) + t / 2, 0, 0.5);
        }

        // จัดวางหนังสือสมจริงและของตกแต่งในแต่ละชั้น
        for (let sh = 0; sh < shelves; sh++) {
          let curX = -w / 2 + 6;
          const y0 = (h - t) * (sh / shelves) + t;

          // สลับวางกระถางต้นไม้เล็กหรือของแต่งสไตล์มินิมอล
          if (sh % 2 === 1) {
            cyl(g, M.potCeramic, 4.5, 3.8, 8, curX + 6, y0 + 4, 0, 20);
            ball(g, M.leaf, 5.5, curX + 6, y0 + 10, 0, 0.7);
            curX += 16;
          }

          // หนังสือเรียงกันพร้อมสันสีสันหลากหลายและเล่มที่เอียงพิง
          for (let b = 0; curX < w / 2 - 10 && b < 8; b++) {
            const bThick = 2.8 + ((b * 7 + sh * 3) % 4);
            const bHeight = Math.min(28, (h / shelves) * 0.76) - ((b * 5) % 6);
            const bookMat = M.book[(b + sh) % M.book.length];

            const book = rbox(g, bookMat, bThick, bHeight, d * 0.7, curX + bThick / 2, y0 + bHeight / 2, 0, 0.4);
            // หนังสือเล่มสุดท้ายเอียงพิงธรรมชาติ
            if (b === 5) {
              book.rotation.z = 0.18;
              book.position.x += 1.5;
            }
            curX += bThick + 0.6;
          }
        }
      }
      break;
    }

    // ==========================================
    // 15) ต้นไม้ตกแต่ง (Monstera Deliciosa in Ribbed Ceramic Planter)
    // ==========================================
    case "fake_plant":
    case "real_plant":
    case "plant_pot": {
      const potH = it.category === "plant_pot" ? h : Math.min(36, h * 0.32);
      const potR = Math.min(w, d) * 0.32;

      // ขาตั้งไม้ 3 ขาสไตล์สแกนดิเนเวียน (Wooden Tripod Plant Stand)
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const lx = Math.cos(a) * potR * 1.15;
        const lz = Math.sin(a) * potR * 1.15;
        cyl(g, M.woodLeg, 1.4, 1.1, potH * 0.75, lx, potH * 0.35, lz, 16);
      }
      rbox(g, M.woodLeg, potR * 2.2, 1.8, 2.4, 0, potH * 0.35, 0, 0.5);

      // กระถางเซรามิกทรงกระบอกผิวร่อง Fluted
      cyl(g, M.potCeramic, potR, potR * 0.88, potH, 0, potH * 0.65, 0, 32);
      // ขอบปากกระถาง
      torus(g, M.potCeramic, potR, 1.2, 0, potH * 1.15, 0, Math.PI / 2, 0, 0);

      // ดินปลูกต้นไม้สีน้ำตาลเข้ม (Potting Soil)
      cyl(g, M.soil, potR * 0.94, potR * 0.94, 2.0, 0, potH * 1.1, 0, 24);

      if (it.category !== "plant_pot") {
        // ลำต้นมอนสเตอร่าแตกกิ่งก้านอินทรีย์ธรรมชาติ (Organic Monstera Stems)
        const numLeaves = 14;
        for (let i = 0; i < numLeaves; i++) {
          const a = (i / numLeaves) * Math.PI * 2 + (i % 3) * 0.45;
          const stemH = (h - potH) * (0.45 + (i / numLeaves) * 0.55);
          const reach = potR * (0.8 + (i % 4) * 0.4);

          // ก้านใบ
          const stem = cyl(g, M.leaf, 0.7, 1.1, stemH, 0, potH * 1.1 + stemH * 0.45, 0, 12);
          stem.rotation.x = Math.sin(a) * 0.35;
          stem.rotation.z = Math.cos(a) * 0.35;

          // ใบมอนสเตอร่าฉลุแฉกแวววาว (Glossy Broad Fenestrated Monstera Leaf)
          const lx = Math.cos(a) * reach * 1.4;
          const ly = potH * 1.1 + stemH * 0.85;
          const lz = Math.sin(a) * reach * 1.4;

          const leafMat = i % 2 === 0 ? M.leaf : M.leaf2;
          const leaf = ball(g, leafMat, reach * 0.9, lx, ly, lz, 0.22, 0.8, 1.2);
          leaf.rotation.set(0.6 * Math.sin(a), -a, 0.5 * Math.cos(a));
        }
      }
      break;
    }

    // ==========================================
    // 16) โคมไฟตั้งโต๊ะ / โคมไฟพื้น (Architect Desk Lamp & Ambient Lighting)
    // ==========================================
    case "lighting": {
      // ฐานเหล็กหล่อทรงกลมถ่วงน้ำหนักพร้อมสวิตช์
      cyl(g, M.darkGrey, 8.5, 9.5, 2.4, 0, 1.2, 0, 32);
      cyl(g, M.gold, 1.2, 1.2, 1.5, 4.5, 2.6, 0, 16); // สวิตช์ทองเหลือง

      // ก้านข้อต่อสปริงยืดหด 2 ท่อน (Articulated Spring Arms)
      const arm1H = h * 0.48;
      const arm1 = cyl(g, M.chrome, 0.9, 0.9, arm1H, 0, arm1H * 0.5 + 2, 0, 16);
      arm1.rotation.z = 0.28;

      const arm2H = h * 0.42;
      const arm2 = cyl(g, M.chrome, 0.9, 0.9, arm2H, -7, arm1H + arm2H * 0.4, 0, 16);
      arm2.rotation.z = -0.58;

      // สปริงและลูกบิดปรับมุม (Springs & Knuckle Joints)
      torus(g, M.chrome, 1.6, 0.4, -7, arm1H + 2, 0, 0, Math.PI / 2, 0);

      // โคมครอบสปันเมทัลทรงกรวย (Spun-Metal Lamp Shade)
      const shadeX = -15;
      const shadeY = h * 0.88;
      const shadeZ = 4;
      const shade = cyl(g, baseBody, 4.5, 11.5, 14, shadeX, shadeY, shadeZ, 32);
      shade.rotation.z = 0.65;
      shade.rotation.x = 0.25;

      // หลอดไฟ LED แสงอุ่น 2700K Warm Light
      ball(g, night ? M.warmLight : M.white, 3.2, shadeX - 1.5, shadeY - 3.5, shadeZ + 1.2);

      if (night) {
        // แสงไฟโคมไฟส่องสว่างนวลตาในห้อง
        const lampLight = new THREE.PointLight("#ffedd5", 2.2, 3.2, 1.8);
        lampLight.position.set(shadeX * CM, (shadeY - 4) * CM, (shadeZ + 2) * CM);
        g.add(lampLight);
      }
      break;
    }

    // ==========================================
    // 17) พรมปูพื้นห้อง (Woven Area Rug with Tassels)
    // ==========================================
    case "rug": {
      const rugMat = tex(rugTex(it.color === "#9aa6b2" ? "#64748b" : it.color), 0.98, [1, 1]);
      rbox(g, rugMat, w, 1.2, d, 0, 0.6, 0, 2.5);
      break;
    }

    // ==========================================
    // 18) ประตูห้อง (Architectural Door with Frame & Lever Handle)
    // ==========================================
    case "door": {
      const frameMat = mk("#f8fafc", 0.6);
      const doorLeafMat = isWood ? woodBody : mk(it.color, 0.58);

      // วงกบประตู 3 ด้าน (Door Jamb Trim)
      const jW = 6.0;
      rbox(g, frameMat, jW, h, d, -w / 2 + jW / 2, h / 2, 0, 0.6);
      rbox(g, frameMat, jW, h, d, w / 2 - jW / 2, h / 2, 0, 0.6);
      rbox(g, frameMat, w, jW, d, 0, h - jW / 2, 0, 0.6);

      // บานประตูไม้ลูกฟัก 2 ช่อง (Molded 2-Panel Door Leaf)
      const leafW = w - jW * 2;
      const leafH = h - jW;
      rbox(g, doorLeafMat, leafW, leafH, d * 0.55, 0, leafH / 2, 0, 0.8);

      // คิ้วลูกฟักบน-ล่าง
      rbox(g, mk(it.color, 0.7), leafW * 0.72, leafH * 0.38, 0.8, 0, leafH * 0.72, d * 0.28, 0.4);
      rbox(g, mk(it.color, 0.7), leafW * 0.72, leafH * 0.42, 0.8, 0, leafH * 0.28, d * 0.28, 0.4);

      // มือจับก้านโยกสแตนเลสพร้อมกุญแจ (Lever Door Handle & Rose Escutcheon)
      const handleX = w / 2 - jW - 8.0;
      const handleY = h * 0.48;
      cyl(g, M.chrome, 3.2, 3.2, 0.8, handleX, handleY, d * 0.3, 24).rotation.x = Math.PI / 2;
      rbox(g, M.chrome, 12.0, 2.2, 4.5, handleX - 4.5, handleY, d * 0.36, 0.6);
      break;
    }

    // ==========================================
    // ค่าตั้งต้นสำหรับหมวดอื่น ๆ
    // ==========================================
    default:
      rbox(g, baseBody, w, h, d, 0, h / 2, 0, Math.min(w, d, h) * 0.14);
  }

  return g;
}

/**
 * เคลียร์คืนหน่วยความจำ GPU ทันทีเมื่อสิ่งของถูกลบหรือเปลี่ยนแบบ
 */
export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
  for (const m of (g.userData.disposables as THREE.Material[] | undefined) ?? []) m.dispose();
  for (const t of (g.userData.textures as THREE.Texture[] | undefined) ?? []) t.dispose();
}
