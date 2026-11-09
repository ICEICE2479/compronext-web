import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PlanItem } from "@/lib/room-planner";
import {
  screenGameTex,
  screenMacTex,
  speakerFabricTex,
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
/** รูปจริงของสินค้า (ครอปเฉพาะตัวของ) — ใช้เป็นลายพรม / หน้ากรอบรูป */
export type ItemPhoto = THREE.Texture | null | undefined;

export function buildItem(it: PlanItem, M: Mats, night: boolean, photo?: ItemPhoto): THREE.Group {
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
      const isSofa =
        nameLower.includes("โซฟา") ||
        nameLower.includes("sofa") ||
        nameLower.includes("armchair") ||
        nameLower.includes("อาร์มแชร์") ||
        nameLower.includes("ปรับนอน") ||
        nameLower.includes("ลิคเซเล่") ||
        nameLower.includes("barsloev") ||
        nameLower.includes("lillesaeter") ||
        nameLower.includes("ekenaeset") ||
        nameLower.includes("ektorp") ||
        nameLower.includes("herrakra");

      const isDining =
        !isSofa &&
        !nameLower.includes("สำนักงาน") &&
        !nameLower.includes("office") &&
        !nameLower.includes("gaming") &&
        !nameLower.includes("เกม") &&
        !nameLower.includes("ล้อ") &&
        !nameLower.includes("hattefjall") &&
        !nameLower.includes("flintan") &&
        !nameLower.includes("markus");

      const isGaming = nameLower.includes("เกม") || nameLower.includes("gaming") || nameLower.includes("racer");
      const isHattefjall = nameLower.includes("hattefjall") || nameLower.includes("ฮัตเตฟแยลล์");
      const isFlintan = nameLower.includes("flintan") || nameLower.includes("ฟลินตัน");

      const chairColor = it.color || "#e6dfd3";

      if (isSofa) {
        // โซฟา / อาร์มแชร์ / เก้าอี้พักผ่อนโมเดิร์น (Modern Upholstered Lounge Armchair & Sofa Bed)
        const sofaMat = tex(fabricTex(chairColor), 0.9, [2, 2]);
        const seatH = Math.min(45, h * 0.48);
        const cushionW = w * 0.78;
        const cushionD = d * 0.78;

        // ขาไม้เตี้ย 4 ขา ทรงกรวยเฉียง (Angled Tapered Wooden Legs)
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const leg = cyl(g, M.woodLeg, 2.0, 1.2, 14, sx * (w * 0.4), 7, sz * (d * 0.4), 16);
            leg.rotation.z = sx * -0.15;
            leg.rotation.x = sz * 0.15;
          }
        }

        // ฐานรองโครงโซฟา (Solid Base Frame)
        rbox(g, sofaMat, w, 12, d, 0, 14, 0, 2.5);

        // เบาะนั่งหนานุ่มดึงกระดุม / รอยตะเข็บ (Plush Deep Seat Cushion)
        rbox(g, sofaMat, cushionW, 16, cushionD, 0, seatH, 2, 4.5);

        // พนักพิงหลังทรงหนานุ่มเอนสบาย (Thick Padded Backrest)
        const backH = h - seatH + 4;
        const backrest = rbox(g, sofaMat, cushionW, backH, 18, 0, seatH + backH / 2, -d / 2 + 9, 5.0);
        backrest.rotation.x = -0.1;

        // หมอนอิง / เบาะรองหลังเสริม
        ball(g, sofaMat, 12, 0, seatH + 14, -d / 2 + 16, 0.7, 1.8, 0.6).rotation.x = -0.15;

        // ที่วางแขนข้างซ้าย-ขวา หนาสัมผัสนุ่ม (Wide Padded Armrests)
        for (const sx of [-1, 1]) {
          const armH = backH * 0.75;
          rbox(g, sofaMat, 14, armH, d - 4, sx * (w / 2 - 7), 14 + armH / 2, 0, 4.0);
        }
        break;
      }

      if (isDining) {
        // เก้าอี้ไม้ 4 ขา สไตล์สแกนดิเนเวียน (Scandinavian 4-Legged Dining/Side Chair เช่น LISABO, SKANSNÄS)
        const woodMat = isWood ? woodBody : mk(chairColor, 0.55);
        const seatH = Math.min(46, h * 0.52);

        // ขาไม้ทรงเรียว 4 ขา เฉียงออกเล็กน้อยเพื่อความมั่นคง
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const legX = sx * (w * 0.38);
            const legZ = sz * (d * 0.38);
            const leg = cyl(g, M.woodLeg, 1.8, 1.1, seatH, legX, seatH / 2, legZ, 16);
            leg.rotation.z = sx * -0.09;
            leg.rotation.x = sz * 0.09;
          }
        }

        // คานไม้รับน้ำหนักใต้เบาะ (Under-seat Stretchers)
        rbox(g, woodMat, w * 0.74, 2.5, 2.0, 0, seatH - 3, d * 0.3, 0.5);
        rbox(g, woodMat, w * 0.74, 2.5, 2.0, 0, seatH - 3, -d * 0.3, 0.5);
        rbox(g, woodMat, 2.0, 2.5, d * 0.7, -w * 0.35, seatH - 3, 0, 0.5);
        rbox(g, woodMat, 2.0, 2.5, d * 0.7, w * 0.35, seatH - 3, 0, 0.5);

        // แผ่นเบาะนั่งทรงโค้งมน (Ergonomic Contoured Seat Pan)
        rbox(g, woodMat, w * 0.88, 3.2, d * 0.88, 0, seatH, 0, 2.0);

        // เบาะรองนั่งผ้านุ่ม (Upholstered Seat Pad)
        const padMat = tex(fabricTex(chairColor), 0.85, [1, 1]);
        rbox(g, padMat, w * 0.78, 2.2, d * 0.78, 0, seatH + 2.2, 0, 2.5);

        // เสาพนักพิงหลังคู่และแผ่นพนักพิงไม้ดัดโค้ง (Steam-bent Curved Backrest)
        for (const sx of [-1, 1]) {
          const postH = h - seatH;
          const post = cyl(g, M.woodLeg, 1.4, 1.6, postH, sx * (w * 0.34), seatH + postH / 2, -d * 0.36, 16);
          post.rotation.x = -0.12;
        }
        const backW = w * 0.84;
        const backH = 16;
        const backCurve = rbox(g, woodMat, backW, backH, 2.4, 0, h - backH / 2, -d * 0.42, 1.8);
        backCurve.rotation.x = -0.15;
        break;
      }

      // เก้าอี้ทำงาน / สำนักงาน / เกมมิ่ง (Office, Ergonomic & Gaming Chairs)
      const fabMat = isGaming
        ? tex(leatherTex(chairColor === "#2f3338" ? "#1e2229" : chairColor), 0.65, [2, 2])
        : tex(fabricTex(chairColor === "#2f3338" ? "#2b3038" : chairColor), 0.9, [2, 2]);

      const seatH = Math.min(52, Math.max(42, h * 0.42));
      const starR = Math.min(w, d) * 0.46; // รัศมีขา 5 แฉก

      // 1) ล้อคู่ 5 แฉก (Twin-wheel Casters) พร้อมแกนล้อและฝาครอบ
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const lx = Math.cos(a) * starR;
        const lz = Math.sin(a) * starR;

        // ขาเก้าอี้
        const legMat = isHattefjall ? M.white : M.darkGrey;
        const leg = rbox(g, legMat, starR * 0.95, 2.4, 4.2, lx * 0.48, 5.5, lz * 0.48, 1.0);
        leg.rotation.y = -a;

        // แกนหมุนและล้อคู่
        cyl(g, M.chrome, 0.8, 0.8, 3.5, lx, 4.2, lz, 16);
        cyl(g, M.black, 3.2, 3.2, 2.8, lx, 2.8, lz, 20).rotation.z = Math.PI / 2;
        torus(g, M.rubber, 3.0, 0.5, lx, 2.8, lz, 0, a, Math.PI / 2);
      }

      // ดุมกลางขา 5 แฉก
      cyl(g, isHattefjall ? M.white : M.darkGrey, 5.5, 6.2, 4.0, 0, 6.2, 0, 24);

      // โช้คปรับระดับไฮดรอลิก 3 ชั้น (Class-4 Telescoping Gas Lift)
      cyl(g, M.chrome, 1.8, 1.8, seatH - 12, 0, 6 + (seatH - 12) / 2, 0, 24);
      cyl(g, M.black, 3.4, 3.6, seatH * 0.45, 0, 6 + seatH * 0.22, 0, 24);

      // กล่องกลไกควบคุมการเอนใต้เบาะ
      rbox(g, M.black, 18, 6.0, 22, 0, seatH - 4.0, 0, 1.2);
      cyl(g, M.chrome, 0.7, 0.7, 14, 10, seatH - 4.5, 4, 16).rotation.z = Math.PI / 2;
      ball(g, M.black, 1.4, 17, seatH - 4.5, 4);

      // เบาะนั่งทรงสรีรศาสตร์ (Contoured Seat Cushion)
      const seatW = w * 0.88;
      const seatD = d * 0.86;
      rbox(g, fabMat, seatW, 8.5, seatD, 0, seatH, 1, 4.5);

      if (isGaming) {
        // ปีกข้างเบาะเกมมิ่งรองรับต้นขา
        for (const sx of [-1, 1]) {
          rbox(g, fabMat, 7.5, 5.5, seatD * 0.85, sx * (seatW / 2 - 3.5), seatH + 3.8, 1, 3.0);
        }
      }

      // พนักพิงหลัง
      const backH = h - seatH - (isHattefjall ? 8 : 4);
      const backZ = -seatD * 0.38;
      const backAngle = -0.12;

      if (isHattefjall) {
        // HATTEFJÄLL: พนักพิงโค้งมนกะทัดรัด หุ้มผ้าเบจ/ขาวพรีเมียม
        const backrest = rbox(g, fabMat, seatW * 0.75, backH, 7.0, 0, seatH + backH / 2 + 2, backZ, 4.5);
        backrest.rotation.x = backAngle;
        // โครงหลังอะลูมิเนียมสีขาวโค้งรับ
        rbox(g, M.white, 6.0, backH * 0.8, 3.5, 0, seatH + backH / 2 + 1, backZ - 4.0, 1.5).rotation.x = backAngle;

        // ที่วางแขนทรง Loop สีขาวโมเดิร์น
        for (const sx of [-1, 1]) {
          const armX = sx * (w * 0.42);
          torus(g, M.white, 9.0, 1.4, armX, seatH + 15, 0, 0, Math.PI / 2, 0);
        }
      } else if (isFlintan) {
        // FLINTAN: พนักพิงตาข่ายทรงสูงโปร่งเพรียวบาง ไม่มีที่ท้าวแขนเกะกะ
        const meshMat = tex(fabricTex(chairColor), 0.95, [3, 3]);
        // โครงขอบพนักพิง
        rbox(g, M.darkGrey, seatW * 0.78, backH, 3.0, 0, seatH + backH / 2 + 2, backZ, 2.0).rotation.x = backAngle;
        // ผืนตาข่ายระบายอากาศ
        rbox(g, meshMat, seatW * 0.72, backH - 4, 1.2, 0, seatH + backH / 2 + 2, backZ + 0.5, 1.0).rotation.x = backAngle;
        // แผ่นรองรับหลังส่วนล่าง Lumbar Bar
        rbox(g, M.black, seatW * 0.6, 6.0, 3.0, 0, seatH + 14, backZ - 2.5, 1.5).rotation.x = backAngle;
      } else {
        // พนักพิงหลังมาตรฐาน / เกมมิ่ง / MARKUS
        const backrest = rbox(g, fabMat, seatW * 0.84, backH, 8.5, 0, seatH + backH / 2 + 1, backZ, 5.5);
        backrest.rotation.x = backAngle;

        if (isGaming) {
          // ปีกโอบกระชับด้านข้างพนักพิง
          for (const sx of [-1, 1]) {
            const wing = rbox(g, fabMat, 6.5, backH * 0.75, 12.0, sx * (seatW * 0.42), seatH + backH * 0.45, backZ + 2.5, 4.0);
            wing.rotation.x = backAngle;
            wing.rotation.y = sx * 0.22;
          }
          // ช่องร้อยสายระบายอากาศคู่
          for (const sx of [-1, 1]) {
            rbox(g, M.black, 6.5, 4.5, 9.5, sx * 10, h - 18, backZ + 3.0, 2.0).rotation.x = backAngle;
          }
          // หมอนรองคอ & รองเอว
          ball(g, fabMat, 8.5, 0, h - 12, backZ + 5.5, 0.7, 1.5, 0.7).rotation.x = backAngle;
          ball(g, fabMat, 9.0, 0, seatH + 15, backZ + 5.5, 0.65, 1.4, 0.65).rotation.x = backAngle;
        } else {
          // แผ่นรองเอวและพนักพิงศีรษะ
          rbox(g, M.black, seatW * 0.65, 12, 4.0, 0, seatH + 16, backZ - 4.5, 2.5).rotation.x = backAngle;
          const headrest = rbox(g, fabMat, seatW * 0.52, 15, 7.0, 0, h - 4, backZ + 4.0, 4.0);
          headrest.rotation.x = -0.05;
          cyl(g, M.chrome, 1.2, 1.2, 10, 0, h - 11, backZ - 2.0, 16);
        }

        // ที่วางแขน 3D/4D ปรับระดับได้
        for (const sx of [-1, 1]) {
          const armX = sx * (w * 0.44);
          rbox(g, M.black, 3.8, 18, 4.5, armX, seatH + 6, 2, 1.0);
          rbox(g, M.chrome, 3.0, 12, 3.5, armX, seatH + 14, 2, 0.8);
          const cap = rbox(g, M.black, 8.5, 3.2, d * 0.52, armX, seatH + 20.5, 4, 2.2);
          cap.rotation.y = sx * -0.05;
        }
      }
      break;
    }

    case "desk": {
      const isStanding =
        nameLower.includes("ปรับระดับ") ||
        nameLower.includes("ไฟฟ้า") ||
        nameLower.includes("standing") ||
        nameLower.includes("lift");

      const isCorner =
        nameLower.includes("เข้ามุม") ||
        nameLower.includes("ตัว l") ||
        nameLower.includes("l-shape") ||
        nameLower.includes("corner");

      const hasAlexSupport =
        nameLower.includes("alex") || nameLower.includes("อเล็กซ์");

      const topT = 2.8; // ความหนาท็อปโต๊ะ
      const topY = h - topT / 2;

      if (isCorner) {
        // โต๊ะรูปตัว L (L-Shaped Battlestation Corner Desk)
        const wingW = Math.max(d, 60);
        const wingD = Math.max(w * 0.65, 80);
        // ท็อปโต๊ะหลัก
        rbox(g, woodBody, w, topT, wingW, 0, topY, 0, 1.4);
        // ปีกท็อปตัว L ยื่นออกไปด้านข้าง
        rbox(g, woodBody, wingW, topT, wingD, -w / 2 + wingW / 2, topY, wingW / 2 + wingD / 2, 1.4);

        // เสาขาโต๊ะเหล็ก 5 จุดรอบตัว L
        const legPts = [
          [-w / 2 + 8, -wingW / 2 + 8],
          [w / 2 - 8, -wingW / 2 + 8],
          [w / 2 - 8, wingW / 2 - 8],
          [-w / 2 + 8, wingW / 2 + wingD - 8],
          [-w / 2 + wingW - 8, wingW / 2 + wingD - 8],
        ];
        for (const [lx, lz] of legPts) {
          cyl(g, M.darkGrey, 2.6, 2.6, h - topT, lx, (h - topT) / 2, lz, 16);
          cyl(g, M.black, 3.4, 3.4, 1.5, lx, 0.75, lz, 16);
        }

        // ช่องร้อยสายไฟ 2 จุด
        cyl(g, M.darkGrey, 3.2, 3.2, topT + 0.2, 0, topY + 0.1, -wingW / 2 + 10, 24);
        cyl(g, M.black, 2.2, 2.2, topT + 0.4, 0, topY + 0.2, -wingW / 2 + 10, 24);
        cyl(g, M.darkGrey, 3.2, 3.2, topT + 0.2, -w / 2 + wingW / 2, topY + 0.1, wingW / 2 + wingD - 12, 24);
        cyl(g, M.black, 2.2, 2.2, topT + 0.4, -w / 2 + wingW / 2, topY + 0.2, wingW / 2 + wingD - 12, 24);
        break;
      }

      if (hasAlexSupport) {
        // โต๊ะยอดนิยม IKEA Battlestation: LAGKAPTEN + ตู้ลิ้นชัก ALEX รองรับข้างขวา + ขา ADILS ข้างซ้าย
        rbox(g, woodBody, w, topT, d, 0, topY, 0, 1.4);
        const alexW = Math.min(36, w * 0.32);
        const alexH = h - topT;
        const alexX = w / 2 - alexW / 2 - 2;
        // ตัวตู้ ALEX ใต้โต๊ะ
        rbox(g, woodBody, alexW, alexH, d * 0.92, alexX, alexH / 2, 0, 0.8);
        const numD = 5;
        const dH = (alexH - 4) / numD;
        for (let i = 0; i < numD; i++) {
          const dy = 2 + i * dH + dH / 2;
          rbox(g, woodBody, alexW - 1.2, dH - 0.8, 1.4, alexX, dy, (d * 0.92) / 2 + 0.4, 0.3);
          cyl(g, M.darkGrey, 3.5, 3.5, 1.2, alexX, dy + dH * 0.25, (d * 0.92) / 2 + 0.7, 20).rotation.x = Math.PI / 2;
        }
        // ขา Adils ทรงกระบอก 2 ขาด้านซ้าย
        const leftX = -w / 2 + 10;
        for (const sz of [-1, 1]) {
          cyl(g, M.darkGrey, 2.4, 2.4, alexH, leftX, alexH / 2, sz * (d * 0.38), 16);
          cyl(g, M.black, 3.2, 3.2, 1.5, leftX, 0.75, sz * (d * 0.38), 16);
        }
        // ช่องร้อยสายไฟ
        cyl(g, M.darkGrey, 3.2, 3.2, topT + 0.2, 0, topY + 0.1, -d / 2 + 10, 24);
        cyl(g, M.black, 2.2, 2.2, topT + 0.4, 0, topY + 0.2, -d / 2 + 10, 24);
        break;
      }

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
    // 4) คอมพิวเตอร์เคสเกมมิ่ง / อุปกรณ์ไอที (Gaming PC & Tech Gadgets)
    // ==========================================
    case "computer": {
      const isWristRest =
        nameLower.includes("wrist rest") ||
        nameLower.includes("ที่รองข้อมือ") ||
        nameLower.includes("palmrest");

      const isGamepad =
        nameLower.includes("gamepad") ||
        nameLower.includes("joystick") ||
        nameLower.includes("จอยสติ๊ก") ||
        nameLower.includes("controller");

      const isGpu =
        nameLower.includes("vga") ||
        nameLower.includes("การ์ดจอ") ||
        nameLower.includes("rtx") ||
        nameLower.includes("geforce") ||
        nameLower.includes("radeon");

      const isLiquidCooler =
        nameLower.includes("liquid cooler") ||
        nameLower.includes("ชุดน้ำ") ||
        nameLower.includes("aio");

      const isSmallGadget =
        nameLower.includes("m.2") ||
        nameLower.includes("enclosure") ||
        nameLower.includes("adapter") ||
        h < 15;

      if (isWristRest) {
        const padW = Math.max(w, 36);
        const padD = Math.max(d, 8);
        const padH = Math.min(h, 2.5);
        rbox(g, M.black, padW, 0.4, padD, 0, 0.2, 0, 0.5);
        rbox(g, M.fabric, padW - 0.6, padH, padD - 0.6, 0, padH / 2, 0, 1.2);
        break;
      }

      if (isGamepad) {
        // จอยเกมมิ่งคอนโทรลเลอร์ (Modern Gaming Controller เช่น Fantech EOS, Xbox, PS5)
        const gpMat = mk(it.color || "#1f2125", 0.45);
        // บอดี้หลักโค้งมน
        rbox(g, gpMat, 15, 4.0, 9.5, 0, 2.5, 0, 2.5);
        // ด้ามจับซ้าย-ขวา เอียงรับอุ้งมือ
        for (const sx of [-1, 1]) {
          const grip = rbox(g, gpMat, 4.2, 3.8, 8.5, sx * 5.8, 2.2, 2.5, 2.0);
          grip.rotation.y = sx * -0.25;
          grip.rotation.z = sx * -0.15;
        }
        // อนาล็อกสติ๊กซ้าย-ขวา
        cyl(g, M.darkGrey, 1.6, 1.2, 2.0, -3.8, 4.2, -1.0, 16);
        cyl(g, M.darkGrey, 1.6, 1.2, 2.0, 2.5, 4.2, 1.5, 16);
        // ปุ่ม D-Pad กากบาท
        rbox(g, M.black, 3.2, 0.8, 1.0, -3.8, 3.8, 1.8, 0.3);
        rbox(g, M.black, 1.0, 0.8, 3.2, -3.8, 3.8, 1.8, 0.3);
        // ปุ่ม ABXY 4 ปุ่ม
        ball(g, M.rgbCoral, 0.6, 5.0, 4.2, -1.8);
        ball(g, M.rgbGlow, 0.6, 3.8, 4.2, -0.6);
        ball(g, M.gold, 0.6, 5.0, 4.2, 0.6);
        ball(g, M.white, 0.6, 6.2, 4.2, -0.6);
        // ปุ่มไกปืน Triggers ด้านหน้า
        rbox(g, M.darkGrey, 4.0, 2.0, 1.5, -4.5, 3.0, -4.5, 0.5);
        rbox(g, M.darkGrey, 4.0, 2.0, 1.5, 4.5, 3.0, -4.5, 0.5);
        break;
      }

      if (isGpu) {
        // การ์ดจอแยกสำหรับประกอบคอม (Standalone High-End Graphics Card)
        const gpuW = Math.max(w, 28);
        const gpuH = 5.0;
        const gpuD = Math.max(d, 12);
        // ตัวการ์ดและ Backplate โลหะ
        rbox(g, M.darkGrey, gpuW, gpuH, gpuD, 0, gpuH / 2, 0, 0.8);
        rbox(g, M.metal, gpuW - 0.4, 0.8, gpuD - 0.4, 0, gpuH + 0.4, 0, 0.4);
        // แถบทองเหลือง PCIe Golden Fingers
        rbox(g, M.gold, 12, 0.5, 1.2, -4, 0.25, -gpuD / 2 - 0.6, 0.2);
        // พัดลมระบายความร้อน 3 ตัว
        for (let i = -1; i <= 1; i++) {
          const fx = i * (gpuW * 0.28);
          torus(g, M.chrome, 3.4, 0.4, fx, gpuH / 2, gpuD / 2 + 0.1, Math.PI / 2, 0, 0);
          cyl(g, M.black, 1.4, 1.4, 0.8, fx, gpuH / 2, gpuD / 2 + 0.2, 16).rotation.x = Math.PI / 2;
        }
        // แถบไฟ RGB เรืองแสงด้านข้างการ์ด
        rbox(g, M.rgbGlow, gpuW * 0.5, 1.4, 0.8, 0, gpuH / 2, -gpuD / 2 + 0.4, 0.3);
        break;
      }

      if (isLiquidCooler) {
        // ชุดน้ำปิดระบายความร้อนซีพียู (CPU AIO Liquid Cooler)
        // หม้อน้ำระบายความร้อน (Radiator)
        rbox(g, M.black, 28, 4.5, 12, 0, 2.25, 0, 0.8);
        // พัดลมหม้อน้ำคู่ 120mm
        for (const sx of [-1, 1]) {
          torus(g, M.rgbPurple, 4.8, 0.5, sx * 6.5, 4.8, 0, Math.PI / 2, 0, 0);
        }
        // ปั๊มบล็อกซีพียูหน้าปัดกระจก Infinity Mirror
        cyl(g, M.black, 3.8, 3.8, 4.0, 0, 2.0, 15, 24);
        cyl(g, M.rgbGlow, 3.2, 3.2, 0.4, 0, 4.1, 15, 24);
        // ท่อยางถักคู่เชื่อมระหว่างปั๊มและหม้อน้ำ
        torus(g, M.black, 8.0, 0.7, -3.5, 3.0, 8, 0, Math.PI / 3, 0);
        torus(g, M.black, 8.0, 0.7, 3.5, 3.0, 8, 0, -Math.PI / 3, 0);
        break;
      }

      if (isSmallGadget) {
        const gadW = Math.min(w, 15);
        const gadD = Math.min(d, 8);
        const gadH = Math.min(h, 2.5);
        rbox(g, M.darkGrey, gadW, gadH, gadD, 0, gadH / 2, 0, 0.6);
        rbox(g, M.metal, gadW - 0.6, 0.4, gadD - 0.6, 0, gadH + 0.1, 0, 0.4);
        rbox(g, M.rgbGlow, 0.8, 0.4, 0.4, gadW / 2 - 1.5, gadH + 0.2, 0, 0.2);
        rbox(g, M.black, 1.6, 0.6, 0.6, gadW / 2 + 0.1, gadH / 2, 0, 0.2);
        break;
      }

      // เคสคอมพิวเตอร์ Dual Chamber (Gaming PC Chassis)
      rbox(g, baseBody, w, h, d, 0, h / 2, 0, 1.6);
      const glassMat = M.glass;
      rbox(g, glassMat, 0.6, h - 5.5, d - 4.5, w / 2 + 0.2, h / 2, 0, 0.4);
      rbox(g, glassMat, w - 4.5, h - 5.5, 0.6, 0, h / 2, d / 2 + 0.2, 0.4);

      // เมนบอร์ดและการ์ดจอภายใน
      rbox(g, M.black, 2.0, h * 0.65, d * 0.68, -w * 0.15, h * 0.52, -2, 0.5);
      rbox(g, M.metal, 2.2, 8.0, 10.0, -w * 0.14, h * 0.72, -8, 0.4);

      const gpuW = w * 0.65;
      const gpuH = 7.5;
      const gpuD = d * 0.62;
      rbox(g, M.darkGrey, gpuW, gpuH, gpuD, 0.5, h * 0.42, 0, 1.0);
      rbox(g, M.metal, gpuW + 0.2, 1.2, gpuD - 1.0, 0.5, h * 0.42 + gpuH / 2, 0, 0.4);
      rbox(g, M.rgbGlow, 1.2, 1.8, 14.0, w / 2 - 1.2, h * 0.42, 0, 0.3);

      cyl(g, M.black, 4.0, 4.0, 3.2, -w * 0.12, h * 0.62, -2, 24).rotation.x = Math.PI / 2;
      cyl(g, M.rgbPurple, 3.2, 3.2, 0.5, -w * 0.12, h * 0.62, -0.3, 24).rotation.x = Math.PI / 2;
      torus(g, M.black, 9.0, 0.7, -w * 0.1, h * 0.74, 2, 0, Math.PI / 3, 0);

      for (const rz of [-1, 1]) {
        rbox(g, M.rgbCoral, 1.2, 5.0, 0.9, -w * 0.12, h * 0.65, rz * 1.8 + 5, 0.2);
      }

      for (let i = 0; i < 3; i++) {
        const fy = h * 0.25 + i * (h * 0.26);
        const fanR = Math.min(w, d) * 0.28;
        rbox(g, M.black, 1.5, fanR * 2, fanR * 2, w / 2 - 2.5, fy, d * 0.18, 0.5);
        torus(g, i % 2 === 0 ? M.rgbGlow : M.rgbPurple, fanR * 0.85, 0.6, w / 2 - 2.0, fy, d * 0.18, 0, Math.PI / 2, 0);
        cyl(g, M.darkGrey, fanR * 0.32, fanR * 0.32, 1.2, w / 2 - 2.0, fy, d * 0.18, 16).rotation.z = Math.PI / 2;
      }

      if (night) {
        const pcLight = new THREE.PointLight("#38bdf8", 1.8, 2.5, 2.0);
        pcLight.position.set(0, h * 0.5 * CM, 0);
        g.add(pcLight);
      }
      break;
    }

    case "monitor": {
      const isMonitorArm =
        nameLower.includes("monitor arm") ||
        nameLower.includes("ขายึดจอ") ||
        nameLower.includes("ขาตั้งจอ") ||
        nameLower.includes("แขนจับจอ") ||
        nameLower.includes("ergonoz");

      if (isMonitorArm) {
        // ขาจับจอคอมแก๊สสปริงกลศาสตร์ (Articulated Gas Spring Monitor Arm เช่น ERGONOZ)
        // ฐานแคลมป์ยึดขอบโต๊ะ C-Clamp
        rbox(g, M.darkGrey, 11, 4.0, 12, 0, 2.0, 0, 1.2);
        cyl(g, M.black, 4.2, 4.6, 6.0, 0, 5.0, 0, 24);
        cyl(g, M.chrome, 1.6, 1.6, 8.0, 0, -2.5, 2.0, 16); // สกรูหมุนล็อคใต้โต๊ะ

        // แขนท่อนล่าง (Lower Swivel Extension Arm)
        const arm1 = rbox(g, M.darkGrey, 4.5, 4.5, 22, -6, 14, 5, 1.2);
        arm1.rotation.y = 0.42;

        // ข้อต่อกลางแกนหมุน (Elbow Joint)
        cyl(g, M.black, 3.2, 3.2, 6.0, -12, 16, 14, 20);

        // แขนท่อนบนแก๊สสปริงไฮดรอลิกเฉียงขึ้น (Upper Gas Spring Counterbalance Arm)
        const arm2 = rbox(g, M.chrome, 4.0, 4.0, 26, -6, 28, 8, 1.0);
        arm2.rotation.x = -0.55;
        arm2.rotation.y = -0.35;

        // หัวปรับองศา VESA Tilt Joint
        ball(g, M.darkGrey, 3.4, 4, 38, 2);

        // แผ่นเพลทยึดหลังจอ VESA 75/100mm Plate
        rbox(g, M.black, 14, 14, 0.8, 5, 38, 5, 0.4);
        // สกรูทองเหลือง 4 มุม
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            cyl(g, M.gold, 0.4, 0.4, 1.4, 5 + sx * 4.5, 38 + sy * 4.5, 5.2, 12).rotation.x = Math.PI / 2;
          }
        }
        break;
      }

      const isOled = nameLower.includes("oled") || nameLower.includes("qd-oled");
      const is4K = nameLower.includes("4k") || nameLower.includes("uhd") || nameLower.includes("3840") || w >= 80;
      const isGaming =
        nameLower.includes("gaming") ||
        nameLower.includes("144hz") ||
        nameLower.includes("165hz") ||
        nameLower.includes("180hz") ||
        nameLower.includes("240hz") ||
        nameLower.includes("odyssey") ||
        nameLower.includes("tuf") ||
        nameLower.includes("rog") ||
        nameLower.includes("ultragear");
      const isMacPro =
        nameLower.includes("for mac") ||
        nameLower.includes("proart") ||
        nameLower.includes("colorpro") ||
        nameLower.includes("ultrasharp") ||
        nameLower.includes("benq");
      const isCurved = nameLower.includes("curved") || nameLower.includes("โค้ง") || (isGaming && w >= 80);

      const screenH = h * 0.68;
      const screenCenterY = h * 0.64;

      if (isGaming) {
        // ฐานจอเกมมิ่งทรงปีก V-Wing
        const wingSpan = Math.min(36, w * 0.55);
        for (const sx of [-1, 1]) {
          const wing = rbox(g, M.darkGrey, 3.2, 1.4, wingSpan * 0.65, sx * (wingSpan * 0.28), 0.7, wingSpan * 0.15, 0.6);
          wing.rotation.y = sx * 0.48;
        }
        rbox(g, M.darkGrey, 8.0, 1.8, 10.0, 0, 0.9, -wingSpan * 0.15, 1.2);
        torus(g, M.rgbCoral, 2.6, 0.5, 0, screenCenterY * 0.45, -6, Math.PI / 2, 0, 0);
      } else {
        // ฐานจอทำงานเรียบหรู Flat Aluminum Pedestal
        const baseW = Math.min(26, w * 0.42);
        const baseD = Math.min(20, d * 0.75);
        rbox(g, M.metal, baseW, 0.8, baseD, 0, 0.4, 0, 0.6);
        cyl(g, M.chrome, 3.2, 3.2, 1.2, 0, 0.9, -2, 24);
      }

      // เสาคอจอ
      const neckH = screenCenterY - 4;
      rbox(g, M.darkGrey, 4.8, neckH, 4.2, 0, neckH / 2 + 1, -6, 1.2);
      rbox(g, M.chrome, 3.8, neckH * 0.6, 3.2, 0, screenCenterY - neckH * 0.25, -6, 0.8);

      if (isOled) {
        // จอ OLED บางเฉียบ 4 มม.
        rbox(g, M.black, w, screenH * 0.65, 0.6, 0, screenCenterY + screenH * 0.18, -0.3, 0.3);
        rbox(g, M.darkGrey, w * 0.6, screenH * 0.45, 3.2, 0, screenCenterY - screenH * 0.22, -1.6, 1.0);
      } else {
        rbox(g, M.black, w, screenH, 3.2, 0, screenCenterY, -1.6, 1.4);
      }

      // ขอบจอด้านล่าง (Chin)
      if (isMacPro || is4K) {
        rbox(g, M.chrome, w, 1.8, 3.4, 0, screenCenterY - screenH / 2 + 0.9, -1.5, 0.4);
      }

      // แผงหน้าจอแสดงผลสมจริง (Display Screen Panel Texture)
      const activeScreenTex = isGaming ? screenGameTex() : isMacPro ? screenMacTex() : screenTex(night);
      const screenMat = tex(activeScreenTex, 0.2, [1, 1]);
      const screenMeshW = w - 1.2;
      const screenMeshH = screenH - (isMacPro ? 2.6 : 1.2);

      if (isCurved) {
        // หน้าจอโค้ง 1500R Curved
        const numSegments = 7;
        const segW = screenMeshW / numSegments;
        const curveR = 150;
        for (let i = 0; i < numSegments; i++) {
          const t = (i + 0.5) / numSegments - 0.5;
          const sx = t * screenMeshW;
          const sz = (1 - Math.cos(t * (screenMeshW / curveR))) * 4.5;
          const seg = rbox(g, screenMat, segW + 0.3, screenMeshH, 0.6, sx, screenCenterY, sz, 0.2);
          seg.rotation.y = -t * 0.42;
        }
      } else {
        rbox(g, screenMat, screenMeshW, screenMeshH, 0.6, 0, screenCenterY, 0.05, 0.2);
      }

      // ไฟแอมเบียนต์ด้านหลังจอ
      if (night) {
        const glowCol = isGaming ? "#06b6d4" : "#ffffff";
        const ambGlow = new THREE.PointLight(glowCol, isGaming ? 2.4 : 1.6, 3.5, 1.8);
        ambGlow.position.set(0, screenCenterY * CM, -0.15);
        g.add(ambGlow);
      }
      break;
    }

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

      // แผ่นเพลตไฟ RGB ส่องสว่างใต้คีย์แคป (Per-Key RGB Underglow Plate)
      rbox(g, M.rgbGlow, w - 1.2, 0.3, d - 1.2, 0, h * 0.75, 0, 0.4);

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

      // ปุ่มสวิตช์ปรับ DPI หลังล้อเลื่อน (DPI Toggle Switch)
      rbox(g, M.black, 1.2, 0.4, 1.4, 0, mH * 0.78, mD * 0.08, 0.2);

      // ไฟโลโก้ RGB เปล่งแสงบนหลังอุ้งมือเมาส์ (RGB Emblem Glow)
      ball(g, M.rgbGlow, 0.75, 0, mH * 0.82, -mD * 0.18, 0.3, 0.8, 1.2);
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
      const isPortable =
        nameLower.includes("jbl") ||
        nameLower.includes("go 4") ||
        nameLower.includes("grip") ||
        nameLower.includes("บลูทูธ") ||
        nameLower.includes("portable") ||
        w <= 12;

      const spkColor = it.color || "#2563eb";

      if (isPortable) {
        // ลำโพงบลูทูธพกพาพันธุ์อึด (JBL GO 4 / GRIP Rugged Bluetooth Speaker)
        const fabMat = tex(speakerFabricTex(spkColor), 0.75, [2, 2]);
        const rubberMat = mk(spkColor, 0.85);

        // ตัวลำโพงทรงก้อนขอบมนหุ้มผ้าทออย่างดี
        rbox(g, fabMat, w, h, d, 0, h / 2, 0, 2.2);

        // ยางกันกระแทกขอบมุมและสันด้านข้าง (Silicone Protective Bumpers)
        for (const sx of [-1, 1]) {
          rbox(g, rubberMat, 1.4, h + 0.4, d + 0.4, sx * (w / 2 - 0.7), h / 2, 0, 1.2);
        }

        // ปุ่มควบคุมนูน 3D ด้านบน (+, -, Play, Bluetooth)
        const btnY = h + 0.3;
        rbox(g, M.white, 2.2, 0.6, 2.2, -w * 0.25, btnY, 0, 0.4);
        rbox(g, M.white, 2.2, 0.6, 2.2, 0, btnY, 0, 0.4);
        rbox(g, M.white, 2.2, 0.6, 2.2, w * 0.25, btnY, 0, 0.4);

        // หูคล้องเชือกผ้าถักด้านข้าง (Integrated Fabric Lanyard Loop)
        torus(g, rubberMat, 2.0, 0.6, w / 2 + 1.2, h * 0.65, 0, 0, Math.PI / 2, 0);

        // ขายางกันลื่น 4 จุดด้านล่าง
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            rbox(g, M.rubber, 1.5, 0.5, 1.5, sx * (w * 0.35), 0.25, sz * (d * 0.35), 0.2);
          }
        }
        break;
      }

      // ลำโพงสตูดิโอมอนิเตอร์ตั้งโต๊ะ (Studio Monitors เช่น Yamaha HS, Audioengine)
      rbox(g, woodBody, w, h, d, 0, h / 2, 0, 1.4);
      rbox(g, M.black, w - 1.2, h - 1.2, 0.8, 0, h / 2, d / 2 + 0.4, 0.8);

      // ดอกลำโพง Kevlar Woofer
      const wooferR = Math.min(w, d) * 0.34;
      const wooferY = h * 0.38;
      const coneMat = tex(speakerConeTex(), 0.45);
      torus(g, M.rubber, wooferR, 0.8, 0, wooferY, d / 2 + 0.8, Math.PI / 2, 0, 0);
      disc(g, coneMat, wooferR * 0.9, 0, wooferY, d / 2 + 0.8);
      ball(g, M.black, wooferR * 0.32, 0, wooferY, d / 2 + 1.0);

      // ดอกทวีตเตอร์ Silk Dome Tweeter
      const tweetR = wooferR * 0.45;
      const tweetY = h * 0.76;
      torus(g, M.chrome, tweetR * 1.2, 0.4, 0, tweetY, d / 2 + 0.8, Math.PI / 2, 0, 0);
      ball(g, M.black, tweetR, 0, tweetY, d / 2 + 0.9);

      // ปุ่ม Volume และไฟ LED
      cyl(g, M.chrome, 1.2, 1.2, 1.4, w * 0.28, h * 0.12, d / 2 + 0.8, 16).rotation.x = Math.PI / 2;
      ball(g, M.rgbGlow, 0.4, -w * 0.28, h * 0.12, d / 2 + 0.8);
      break;
    }

    case "headphone": {
      const isInEar =
        nameLower.includes("inear") ||
        nameLower.includes("in-ear") ||
        nameLower.includes("earbud") ||
        nameLower.includes("earbuds") ||
        nameLower.includes("cetra") ||
        nameLower.includes("g333") ||
        nameLower.includes("tws") ||
        h <= 10;

      const hpColor = it.color || "#1f2125";
      const isGamingHeadset =
        nameLower.includes("gaming") ||
        nameLower.includes("เกม") ||
        nameLower.includes("razer") ||
        nameLower.includes("corsair") ||
        nameLower.includes("hyperx") ||
        nameLower.includes("blackshark") ||
        nameLower.includes("7.1");

      if (isInEar) {
        // หูฟัง In-Ear เกมมิ่งระดับพรีเมียม (In-Ear Monitors on Display Dock / Coiled Cable)
        // ถาดวางอะลูมิเนียมเรียบหรู
        rbox(g, M.darkGrey, 14, 1.2, 14, 0, 0.6, 0, 1.5);
        rbox(g, M.black, 12.5, 0.4, 12.5, 0, 1.2, 0, 1.0);

        // หูฟัง 2 ข้าง (ซ้าย/ขวา) พร้อมจุกซิลิโคนและบอดี้โลหะ CNC
        const accentCol = hpColor === "#1f2125" ? "#06b6d4" : hpColor;
        const earMat = mk(accentCol, 0.35, 0.85);

        for (const sx of [-1, 1]) {
          const ex = sx * 3.5;
          const ez = -1.5;
          // บอดี้หูฟังอะลูมิเนียมทรงกระบอก
          cyl(g, earMat, 1.1, 1.3, 2.2, ex, 2.4, ez, 16).rotation.x = Math.PI / 4;
          // จุกซิลิโคนอินเอียร์นุ่ม
          cyl(g, M.rubber, 0.8, 1.4, 1.2, ex, 3.2, ez + 1.1, 16).rotation.x = Math.PI / 4;
          // ก้านหางสายยาง
          cyl(g, M.black, 0.35, 0.35, 2.0, ex, 1.6, ez - 1.0, 12);
        }

        // สายถักขดวงกลมเรียบเนียน (Coiled Braided Cable)
        torus(g, M.darkGrey, 4.2, 0.35, 0, 1.4, 2.0, Math.PI / 2, 0, 0);
        // โมดูลไมค์และปุ่มควบคุม In-line Remote
        rbox(g, M.black, 1.2, 0.6, 3.2, 3.5, 1.5, 2.0, 0.3);
        break;
      }

      // หูฟัง Over-Ear พร้อมขาตั้งอะลูมิเนียม (Over-Ear Gaming & Studio Headset on Stand)
      // ฐานขาตั้งอะลูมิเนียมถ่วงน้ำหนักทรงกลม
      cyl(g, M.darkGrey, 7.5, 7.5, 1.4, 0, 0.7, 0, 32);
      cyl(g, M.chrome, 1.2, 1.2, h - 4, 0, (h - 4) / 2 + 1.2, 0, 24);
      rbox(g, M.darkGrey, 12.0, 1.8, 5.5, 0, h - 1.5, 0, 1.4);

      // ก้านคาดศีรษะ (Suspension Headband)
      torus(g, M.black, 10.0, 1.2, 0, h - 4.5, 0, 0, 0, Math.PI / 2);
      rbox(g, M.darkGrey, 11.0, 1.5, 4.0, 0, h - 2.8, 0, 1.2);

      // เอียร์คัพซ้าย-ขวา
      for (const sx of [-1, 1]) {
        const ex = sx * 9.5;
        const ey = h - 14.5;
        torus(g, M.chrome, 4.8, 0.5, ex, ey, 0, 0, Math.PI / 2, 0);
        cyl(g, M.darkGrey, 4.5, 4.5, 3.2, ex + sx * 0.6, ey, 0, 24).rotation.z = Math.PI / 2;
        torus(g, M.fabric, 3.8, 1.2, ex - sx * 0.8, ey, 0, 0, Math.PI / 2, 0);
        if (isGamingHeadset) {
          torus(g, M.rgbGlow, 2.5, 0.3, ex + sx * 2.3, ey, 0, 0, Math.PI / 2, 0);
        }
      }

      // ก้านบูมไมโครโฟน
      if (isGamingHeadset) {
        const micBoom = cyl(g, M.black, 0.45, 0.45, 9.5, -9.5 + 3.2, h - 17.5, 4.5, 12);
        micBoom.rotation.x = 0.85;
        micBoom.rotation.y = -0.55;
        ball(g, M.darkGrey, 1.3, -9.5 + 5.2, h - 19.5, 8.5);
      }
      break;
    }

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
      const bedColor = it.color || "#eeeeec";
      const isUpholstered =
        nameLower.includes("บุนวม") ||
        nameLower.includes("upholstered") ||
        nameLower.includes("tärnkullen") ||
        nameLower.includes("idanäs") ||
        nameLower.includes("grysna");

      const sheetMat = tex(fabricTex("#ffffff"), 0.95, [3, 3]);
      const duvetColor = bedColor === "#eeeeec" ? "#e2e8f0" : bedColor;
      const duvetMat = tex(fabricTex(duvetColor), 0.92, [3, 3]);
      const throwMat = tex(fabricTex("#64748b"), 0.95, [2, 2]);

      const frameMat = isWood ? woodBody : mk(bedColor, 0.6);

      // ฐานโครงเตียง (Bed Frame & Legs)
      rbox(g, frameMat, w, 22, d, 0, 15, 0, 1.8);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          cyl(g, isWood ? M.woodLeg : frameMat, 2.8, 2.0, 12, sx * (w / 2 - 8), 6, sz * (d / 2 - 8), 16);
        }
      }

      // ฟูกที่นอนหนานุ่มพรีเมียม (Plush Pillow-top Mattress with Piping)
      rbox(g, sheetMat, w - 4, 26, d - 6, 0, 39, 1, 5.0);

      // ผ้าห่มนวมหนานุ่มพับเปิดครึ่งบน (Puffy Down Duvet folded halfway)
      const duvetZ = d * 0.16;
      rbox(g, duvetMat, w - 2, 7.5, d * 0.62, 0, 52.5, duvetZ, 4.5);
      // รอยพับนวมด้านบน
      rbox(g, sheetMat, w - 2, 5.5, 14, 0, 53.5, duvetZ - d * 0.31, 3.5);

      // ผ้าพาดปลายเตียง (Accent Throw Blanket at foot of bed)
      rbox(g, throwMat, w + 0.5, 4.0, 24, 0, 53.0, d / 2 - 18, 3.0);

      // หมอนนอนใบใหญ่ 2 หรือ 4 ใบ
      const pillowCols = w > 130 ? [-1, 1] : [0];
      for (const px of pillowCols) {
        const pil = rbox(g, M.white, Math.min(58, w * 0.4), 13, 34, px * (w * 0.24), 54, -d / 2 + 25, 5.5);
        pil.rotation.x = -0.16;
        const dPil = rbox(g, duvetMat, 32, 10, 32, px * (w * 0.24), 57, -d / 2 + 38, 4.0);
        dPil.rotation.x = -0.22;
        dPil.rotation.y = px * 0.12;
      }

      const hasStorage =
        nameLower.includes("storage") ||
        nameLower.includes("กล่อง") ||
        nameLower.includes("ลิ้นชัก") ||
        nameLower.includes("brimnes") ||
        nameLower.includes("malm");

      // ลิ้นชักเก็บของใต้เตียง 2 ฝั่งซ้าย-ขวา (Underbed Storage Drawers)
      if (hasStorage) {
        for (const sx of [-1, 1]) {
          const drawerW = (d - 20) / 2;
          for (let di = 0; di < 2; di++) {
            const dz = -d / 2 + 15 + di * drawerW + drawerW / 2;
            rbox(g, frameMat, 1.5, 16, drawerW - 2, sx * (w / 2 + 0.6), 13, dz, 0.4);
            cyl(g, M.chrome, 3.2, 3.2, 1.0, sx * (w / 2 + 1.2), 17, dz, 20).rotation.z = Math.PI / 2;
          }
        }
      }

      // หัวเตียง (Headboard)
      const hbH = Math.max(90, h);
      if (isUpholstered) {
        // หัวเตียงบุผ้านวมลายตารางหรูหราสีตามสินค้าจริง (Upholstered Headboard)
        const headboardMat = tex(fabricTex(bedColor), 0.95, [2, 2]);
        rbox(g, headboardMat, w + 4, hbH, 10, 0, hbH / 2, -d / 2 + 4, 4.0);
        for (let row = 0; row < 3; row++) {
          for (let col = -3; col <= 3; col++) {
            ball(g, mk(bedColor, 0.8), 1.2, col * (w / 8), hbH * 0.45 + row * 16, -d / 2 + 9.5, 0.6);
          }
        }
      } else {
        // หัวเตียงไม้/โลหะโมเดิร์นสีตามสินค้าจริง (Wooden / Slatted Headboard เช่น BRUKSVARA, GULLABERG)
        rbox(g, frameMat, w + 4, hbH, 5.0, 0, hbH / 2, -d / 2 + 3, 1.2);
        rbox(g, frameMat, w + 6, 4.0, 7.0, 0, hbH - 2, -d / 2 + 3, 0.6); // บัวบนหัวเตียง
        // ซี่ระแนงหัวเตียงเพิ่มมิติ
        const numSlats = Math.round(w / 18);
        for (let si = 0; si < numSlats; si++) {
          const sx = -w / 2 + 8 + (si / (numSlats - 1)) * (w - 16);
          rbox(g, mk(bedColor, 0.7), 2.2, hbH * 0.45, 1.5, sx, hbH * 0.65, -d / 2 + 5.8, 0.3);
        }
      }
      break;
    }

    // ==========================================
    // 14) ตู้ลิ้นชัก ALEX/MALM / ราวแขวนผ้า / ชั้นตะแกรงเหล็ก OMAR / ตู้หนังสือ BILLY / KALLAX (Storage & Shelving)
    // ==========================================
    case "storage": {
      const isWireRack =
        nameLower.includes("omar") ||
        nameLower.includes("กัลวาไนซ์") ||
        nameLower.includes("ตะแกรง") ||
        nameLower.includes("ลวด") ||
        nameLower.includes("wire");

      const isClothesRail =
        nameLower.includes("ราวแขวนผ้า") ||
        nameLower.includes("ราวแขวน") ||
        nameLower.includes("ราวตาก") ||
        nameLower.includes("clothes rail") ||
        nameLower.includes("garment");

      const isDrawerUnit =
        nameLower.includes("alex") ||
        nameLower.includes("ลิ้นชัก") ||
        nameLower.includes("drawer") ||
        nameLower.includes("malm") ||
        nameLower.includes("hauga") ||
        nameLower.includes("lastare") ||
        nameLower.includes("vihals") ||
        nameLower.includes("kilberget") ||
        nameLower.includes("gursken") ||
        nameLower.includes("fågelfjället") ||
        nameLower.includes("storklinta") ||
        nameLower.includes("rådmansö");

      if (isWireRack) {
        // ชั้นวางตะแกรงเหล็ก OMAR / ลวดกัลวาไนซ์สไตล์อินดัสเทรียล
        const poleR = 1.3;
        const cornerInset = 2.0;
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const px = sx * (w / 2 - cornerInset);
            const pz = sz * (d / 2 - cornerInset);
            cyl(g, M.chrome, poleR, poleR, h, px, h / 2, pz, 16);
            cyl(g, M.black, poleR * 1.3, poleR * 1.3, 1.2, px, 0.6, pz, 16);
            cyl(g, M.black, poleR * 1.1, poleR * 1.1, 0.8, px, h + 0.4, pz, 16);
          }
        }
        const numShelves = Math.max(3, Math.round(h / 45));
        for (let k = 0; k < numShelves; k++) {
          const sy = 8 + (k / (numShelves - 1)) * (h - 14);
          rbox(g, M.chrome, w, 1.4, d, 0, sy, 0, 0.4);
          const numWires = Math.round(w / 4);
          for (let wi = 0; wi < numWires; wi++) {
            const wx = -w / 2 + 2.5 + wi * 4;
            cyl(g, M.chrome, 0.25, 0.25, d - 4, wx, sy, 0, 8).rotation.x = Math.PI / 2;
          }
          if (k === 1) {
            rbox(g, M.fabric, w * 0.45, 18, d * 0.75, -w * 0.2, sy + 9, 0, 0.8);
          }
        }
      } else if (isClothesRail) {
        // ราวแขวนผ้ามินิมอล (Minimal Clothes Rail)
        const railR = 1.4;
        rbox(g, baseBody, 4.0, 2.5, d * 0.8, -w / 2 + 4, 1.25, 0, 0.6);
        rbox(g, baseBody, 4.0, 2.5, d * 0.8, w / 2 - 4, 1.25, 0, 0.6);
        rbox(g, baseBody, w - 8, 2.0, 3.5, 0, 1.0, 0, 0.4);

        cyl(g, M.chrome, railR, railR, h - 3, -w / 2 + 4, h / 2, 0, 16);
        cyl(g, M.chrome, railR, railR, h - 3, w / 2 - 4, h / 2, 0, 16);

        const topRail = cyl(g, M.chrome, railR, railR, w - 8, 0, h - 2, 0, 16);
        topRail.rotation.z = Math.PI / 2;

        const numHangers = Math.max(4, Math.min(10, Math.round(w / 12)));
        const shirtMats = [
          mk("#f8fafc", 0.8),
          mk("#334155", 0.85),
          mk("#94a3b8", 0.8),
          mk("#e2e8f0", 0.75),
          mk("#475569", 0.85),
        ];
        for (let hi = 0; hi < numHangers; hi++) {
          const hx = -w / 2 + 10 + hi * ((w - 20) / (numHangers - 1));
          rbox(g, M.woodLeg, 12, 1.0, 0.8, hx, h - 6, 0, 0.3);
          torus(g, M.chrome, 1.2, 0.2, hx, h - 3.5, 0, 0, 0, Math.PI / 2);
          const sMat = shirtMats[hi % shirtMats.length];
          const shirtH = Math.min(55, h * 0.55);
          rbox(g, sMat, 8.5, shirtH, 4.5, hx, h - 6 - shirtH / 2, 0, 1.2);
        }
      } else if (isDrawerUnit) {
        // ตู้ลิ้นชัก ALEX / MALM / HAUGA / LASTARE / VIHALS
        const plinthH = 4.0;
        rbox(g, woodBody, w, h - plinthH, d, 0, (h + plinthH) / 2, 0, 0.8);
        rbox(g, mk(it.color, 0.75), w - 4, plinthH, d - 4, 0, plinthH / 2, 0, 0.4);

        let numDrawers = 4;
        const dMatch = nameLower.match(/(\d+)\s*(ลิ้นชัก|drawer)/);
        if (dMatch) {
          numDrawers = parseInt(dMatch[1], 10);
        } else if (nameLower.includes("alex")) {
          numDrawers = 5;
        } else {
          numDrawers = Math.max(2, Math.min(8, Math.round(h / 24)));
        }

        const isAlex = nameLower.includes("alex");
        const usableH = h - plinthH - 2;
        const dH = usableH / numDrawers;

        for (let i = 0; i < numDrawers; i++) {
          const dy = plinthH + 1 + i * dH + dH / 2;
          rbox(g, woodBody, w - 1.2, dH - 0.8, 1.8, 0, dy, d / 2 + 0.6, 0.4);

          if (isAlex) {
            cyl(g, M.darkGrey, 4.5, 4.5, 1.4, 0, dy + dH * 0.28, d / 2 + 0.9, 24).rotation.x = Math.PI / 2;
          } else {
            rbox(g, M.metal, Math.min(16, w * 0.25), 1.2, 1.6, 0, dy + dH * 0.25, d / 2 + 1.2, 0.3);
          }
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
    // 15) ของตกแต่งห้อง / อุปกรณ์จัดระเบียบ (Decor, Organizers & Wall Shelves)
    // ==========================================
    case "decor": {
      const isWallShelf =
        nameLower.includes("ชั้น") ||
        nameLower.includes("shelf") ||
        nameLower.includes("burhult") ||
        nameLower.includes("bergshult") ||
        nameLower.includes("pershult") ||
        nameLower.includes("แขวนผนัง") ||
        nameLower.includes("ติดผนัง");

      const isBox =
        nameLower.includes("กล่อง") ||
        nameLower.includes("dröna") ||
        nameLower.includes("drona") ||
        nameLower.includes("pärkla") ||
        nameLower.includes("jäll") ||
        nameLower.includes("box") ||
        nameLower.includes("basket") ||
        nameLower.includes("ถุงใส่ผ้า");

      const isTray =
        nameLower.includes("ถาด") ||
        nameLower.includes("komplement") ||
        nameLower.includes("แผ่นรอง") ||
        nameLower.includes("ที่แบ่งช่อง") ||
        nameLower.includes("tray") ||
        nameLower.includes("divider");

      const isFrame =
        nameLower.includes("กรอบรูป") ||
        nameLower.includes("frame") ||
        nameLower.includes("picture") ||
        nameLower.includes("art");

      const isWristRest =
        nameLower.includes("wrist rest") ||
        nameLower.includes("ที่รองข้อมือ") ||
        nameLower.includes("palmrest");

      if (isWristRest) {
        const padW = Math.max(w, 36);
        const padD = Math.max(d, 8);
        const padH = Math.min(h, 2.5);
        rbox(g, M.black, padW, 0.4, padD, 0, 0.2, 0, 0.5);
        rbox(g, M.fabric, padW - 0.6, padH, padD - 0.6, 0, padH / 2, 0, 1.2);
      } else if (isWallShelf) {
        // ชั้นวางของแขวนผนัง (Wall Shelf เช่น BURHULT / PERSHULT)
        const shelfT = 2.4;
        rbox(g, woodBody, w, shelfT, d, 0, h - shelfT / 2, 0, 0.6);
        const bW = 2.4;
        const bH = Math.min(24, d * 0.8);
        for (const sx of [-1, 1]) {
          const bx = sx * (w / 2 - 8);
          rbox(g, M.darkGrey, bW, bH, 1.2, bx, h - shelfT - bH / 2, -d / 2 + 0.6, 0.3);
          rbox(g, M.darkGrey, bW, 1.2, d * 0.75, bx, h - shelfT - 0.6, -d / 2 + (d * 0.75) / 2, 0.3);
          const strut = cyl(g, M.darkGrey, 0.6, 0.6, Math.hypot(bH, d * 0.75), bx, h - shelfT - bH * 0.45, -d / 2 + d * 0.35, 12);
          strut.rotation.x = Math.atan2(d * 0.75, bH);
        }
        cyl(g, M.potCeramic, 3.2, 2.6, 6, -w * 0.25, h + 3, 0, 16);
        ball(g, M.leaf, 4.2, -w * 0.25, h + 7.5, 0, 0.7);
        for (let bi = 0; bi < 4; bi++) {
          const bMat = M.book[bi % M.book.length];
          rbox(g, bMat, 2.4, 16 - bi * 1.5, d * 0.6, w * 0.15 + bi * 3, h + 8 - bi * 0.75, 0, 0.4);
        }
      } else if (isBox) {
        // กล่องเก็บของ DRÖNA / ตะกร้าผ้า
        rbox(g, M.fabric, w, h, d, 0, h / 2, 0, 1.4);
        rbox(g, M.darkGrey, w + 0.4, 1.2, d + 0.4, 0, h - 0.6, 0, 0.4);
        cyl(g, M.darkGrey, 3.2, 3.2, 1.2, 0, h * 0.72, d / 2 + 0.2, 24).rotation.x = Math.PI / 2;
      } else if (isTray) {
        // ถาดแบ่งช่อง KOMPLEMENT สำหรับลิ้นชักหรือโต๊ะ
        const wallT = 1.0;
        const baseH = 0.8;
        rbox(g, mk(it.color, 0.8), w, baseH, d, 0, baseH / 2, 0, 0.4);
        for (const sx of [-1, 1]) {
          rbox(g, mk(it.color, 0.8), wallT, h, d, sx * (w / 2 - wallT / 2), h / 2, 0, 0.3);
          rbox(g, mk(it.color, 0.8), w, h, wallT, 0, h / 2, sx * (d / 2 - wallT / 2), 0.3);
        }
        const cols = Math.max(2, Math.min(4, Math.round(w / 18)));
        const rows = Math.max(2, Math.min(4, Math.round(d / 18)));
        for (let c = 1; c < cols; c++) {
          rbox(g, mk(it.color, 0.8), 0.6, h * 0.85, d - wallT * 2, -w / 2 + c * (w / cols), h * 0.45, 0, 0.2);
        }
        for (let r = 1; r < rows; r++) {
          rbox(g, mk(it.color, 0.8), w - wallT * 2, h * 0.85, 0.6, 0, h * 0.45, -d / 2 + r * (d / rows), 0.2);
        }
      } else if (isFrame) {
        // กรอบรูปติดผนัง / ตั้งโต๊ะพร้อมขอบและกระจกใส
        const frameT = 2.0;
        const depth = Math.max(2.5, d);
        rbox(g, M.black, w, h, depth, 0, h / 2, 0, 0.4);
        rbox(g, M.white, w - frameT * 2, h - frameT * 2, 0.4, 0, h / 2, depth / 2 + 0.1, 0.2);
        rbox(g, mk(it.color, 0.9), w - frameT * 3.5, h - frameT * 3.5, 0.4, 0, h / 2, depth / 2 + 0.2, 0.2);
        // หน้ากรอบ = รูปสินค้าจริง (กรอบ + ภาพในกรอบตามที่ขายจริง)
        if (photo) {
          const face = new THREE.Mesh(new THREE.PlaneGeometry(w * CM, h * CM), tex(photo, 0.6));
          face.position.set(0, (h / 2) * CM, (depth / 2 + 0.3) * CM);
          g.add(face);
        }
        rbox(g, M.glass, w - frameT * 1.5, h - frameT * 1.5, 0.2, 0, h / 2, depth / 2 + 0.4, 0.1);
      } else {
        // ของแต่งห้องมินิมอล (Sculptural Desk Clock / Minimalist Ornament)
        cyl(g, M.potCeramic, w * 0.38, w * 0.42, h * 0.85, 0, h * 0.45, 0, 24);
        torus(g, M.gold, w * 0.22, 0.8, 0, h * 0.45, d * 0.42, 0, 0, 0);
        ball(g, M.chrome, w * 0.12, 0, h * 0.92, 0);
      }
      break;
    }

    // ==========================================
    // 15) กระถางต้นไม้ / ต้นไม้ปลอม / ต้นไม้จริง (Monstera, Fern, Hanging, Rubber Tree & Snake Plant)
    // ==========================================
    case "fake_plant":
    case "real_plant":
    case "plant_pot": {
      const isPotOnly =
        it.category === "plant_pot" ||
        (nameLower.includes("กระถาง") &&
          !nameLower.includes("ไม้ประดิษฐ์") &&
          !nameLower.includes("ต้นไม้") &&
          !nameLower.includes("fejka") &&
          !nameLower.includes("plant") &&
          !nameLower.includes("fern") &&
          !nameLower.includes("มินต์") &&
          !nameLower.includes("alocasia"));

      const isReal =
        it.category === "real_plant" ||
        nameLower.includes("ต้นไม้จริง") ||
        nameLower.includes("ยางอินเดีย") ||
        nameLower.includes("ลิ้นมังกร");

      const isRubberTree = nameLower.includes("ยางอินเดีย") || nameLower.includes("rubber");
      const isSnakePlant = nameLower.includes("ลิ้นมังกร") || nameLower.includes("snake");
      const isFern = nameLower.includes("fern") || nameLower.includes("เฟิร์น");
      const isHanging = nameLower.includes("hanging") || nameLower.includes("เครื่องแขวน");
      const isMint = nameLower.includes("mint") || nameLower.includes("มินต์");

      // พืชตั้งโต๊ะขนาดเล็ก vs ต้นไม้ตั้งพื้นขนาดใหญ่
      const isFloorPlant = h >= 70 || w >= 35;
      const potH = isPotOnly ? h : Math.min(28, h * 0.35);
      const potR = Math.min(w, d) * (isFloorPlant ? 0.32 : 0.38);

      if (isFloorPlant) {
        // ขาตั้งไม้ 3 ขา สำหรับต้นไม้ตั้งพื้นขนาดใหญ่ (Wooden Tripod Plant Stand)
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const lx = Math.cos(a) * potR * 1.15;
          const lz = Math.sin(a) * potR * 1.15;
          cyl(g, M.woodLeg, 1.4, 1.1, potH * 0.75, lx, potH * 0.35, lz, 16);
        }
        rbox(g, M.woodLeg, potR * 2.2, 1.8, 2.4, 0, potH * 0.35, 0, 0.5);
      }

      const potBaseY = isFloorPlant ? potH * 0.35 : 0;

      // กระถางเซรามิกโมเดิร์น
      cyl(g, M.potCeramic, potR, potR * 0.88, potH, 0, potBaseY + potH / 2, 0, 32);
      torus(g, M.potCeramic, potR, 1.0, 0, potBaseY + potH, 0, Math.PI / 2, 0, 0);

      // ดินปลูกต้นไม้อินทรีย์สีน้ำตาลเข้ม (Dark Organic Potting Soil)
      const soilY = potBaseY + potH - 0.5;
      cyl(g, M.soil, potR * 0.94, potR * 0.94, 1.5, 0, soilY, 0, 24);

      if (!isPotOnly) {
        const foliageH = Math.max(12, h - potH - potBaseY);

        if (isFern) {
          // ไม้ประดิษฐ์: เฟิร์น (Crocodile Fern / Boston Fern) ใบเรียวยาวโค้งแผ่รอบทิศ
          const numFronds = 16;
          for (let i = 0; i < numFronds; i++) {
            const a = (i / numFronds) * Math.PI * 2;
            const frondLen = potR * (1.2 + (i % 3) * 0.35);
            const frondH = foliageH * (0.6 + (i % 2) * 0.35);
            // ก้านและใบหยัก
            const stem = cyl(g, M.leaf, 0.5, 0.9, frondH, 0, soilY + frondH * 0.4, 0, 8);
            stem.rotation.x = Math.sin(a) * 0.55;
            stem.rotation.z = Math.cos(a) * 0.55;
            // ปลายใบโค้งทอดตัวลง
            const fx = Math.cos(a) * frondLen;
            const fy = soilY + frondH * 0.85;
            const fz = Math.sin(a) * frondLen;
            const leaf = ball(g, M.leaf2, frondLen * 0.45, fx, fy, fz, 0.15, 0.6, 1.4);
            leaf.rotation.set(0.6 * Math.sin(a), -a, 0.6 * Math.cos(a));
          }
        } else if (isHanging) {
          // ไม้เลื้อยแขวน (Trailing Hanging Ivy / Pothos) กิ่งระย้าทอดลงมาข้างกระถาง
          for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            const dropLen = foliageH * (0.4 + (i % 4) * 0.25);
            const vx = Math.cos(a) * (potR * 0.95);
            const vz = Math.sin(a) * (potR * 0.95);
            cyl(g, M.leaf, 0.4, 0.5, dropLen, vx, soilY - dropLen * 0.4, vz, 8);
            ball(g, M.leaf2, 2.8, vx * 1.15, soilY - dropLen * 0.8, vz * 1.15, 0.2, 0.8, 1.1);
          }
        } else if (isMint) {
          // มินต์ / ไม้พุ่มสมุนไพรในกระถาง (Potted Mint / Herb Bush) ทรงพุ่มกลมแน่น
          ball(g, M.leaf, potR * 1.1, 0, soilY + potR * 0.75, 0, 0.85, 1.0, 1.0);
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const mx = Math.cos(a) * potR * 0.75;
            const mz = Math.sin(a) * potR * 0.75;
            ball(g, M.leaf2, potR * 0.45, mx, soilY + potR * 0.9, mz, 0.5, 0.8, 0.8);
          }
        } else if (isReal && isRubberTree) {
          // ยางอินเดียดำ (Rubber Tree / Ficus Elastica)
          const trunkH = foliageH;
          cyl(g, M.soil, 1.4, 1.8, trunkH * 0.85, 0, soilY + trunkH * 0.42, 0, 16);
          const numLeaves = 12;
          for (let i = 0; i < numLeaves; i++) {
            const a = (i / numLeaves) * Math.PI * 2 + (i % 2) * 0.5;
            const ly = soilY + (i / numLeaves) * trunkH * 0.8 + 4;
            const leaf = ball(g, mk("#14342b", 0.3, 0.05), potR * 0.75, Math.cos(a) * potR * 0.65, ly, Math.sin(a) * potR * 0.65, 0.25, 0.6, 1.3);
            leaf.rotation.set(0.4 * Math.sin(a), -a, 0.4 * Math.cos(a));
          }
        } else if (isReal && isSnakePlant) {
          // ลิ้นมังกร (Snake Plant / Sansevieria)
          const numBlades = 9;
          for (let i = 0; i < numBlades; i++) {
            const a = (i / numBlades) * Math.PI * 2;
            const bH = foliageH * (0.6 + (i % 3) * 0.18);
            const bx = Math.cos(a) * potR * 0.4;
            const bz = Math.sin(a) * potR * 0.4;
            const blade = rbox(g, M.leaf, 3.2, bH, 0.8, bx, soilY + bH / 2, bz, 0.4);
            blade.rotation.y = a;
            blade.rotation.x = Math.sin(a) * 0.12;
            blade.rotation.z = Math.cos(a) * 0.12;
            rbox(g, M.gold, 0.4, bH, 0.85, bx + 1.5, soilY + bH / 2, bz, 0.2);
            rbox(g, M.gold, 0.4, bH, 0.85, bx - 1.5, soilY + bH / 2, bz, 0.2);
          }
        } else {
          // มอนสเตอร่า (Monstera Deliciosa)
          const numLeaves = 14;
          for (let i = 0; i < numLeaves; i++) {
            const a = (i / numLeaves) * Math.PI * 2 + (i % 3) * 0.45;
            const stemH = foliageH * (0.45 + (i / numLeaves) * 0.55);
            const reach = potR * (0.8 + (i % 4) * 0.4);

            const stem = cyl(g, M.leaf, 0.7, 1.1, stemH, 0, soilY + stemH * 0.45, 0, 12);
            stem.rotation.x = Math.sin(a) * 0.35;
            stem.rotation.z = Math.cos(a) * 0.35;

            const lx = Math.cos(a) * reach * 1.4;
            const ly = soilY + stemH * 0.85;
            const lz = Math.sin(a) * reach * 1.4;

            const leafMat = i % 2 === 0 ? M.leaf : M.leaf2;
            const leaf = ball(g, leafMat, reach * 0.9, lx, ly, lz, 0.22, 0.8, 1.2);
            leaf.rotation.set(0.6 * Math.sin(a), -a, 0.5 * Math.cos(a));
          }
        }
      }
      break;
    }

    // ==========================================
    // 16) โคมไฟและไฟแขวนจอ / ไฟ RGB & Ambient / โคมไฟตั้งโต๊ะ / โคมไฟพื้น
    // ==========================================
    case "lighting": {
      const isBulb =
        nameLower.includes("หลอดไฟ") ||
        nameLower.includes("bulb") ||
        nameLower.includes("kajplats") ||
        nameLower.includes("e14") ||
        nameLower.includes("e27");

      const isSnowman =
        nameLower.includes("สโนว์แมน") ||
        nameLower.includes("snowman") ||
        nameLower.includes("stråla") ||
        nameLower.includes("ประดับโต๊ะ");

      const isGlobe = nameLower.includes("fado") || nameLower.includes("ทรงกลม") || nameLower.includes("globe");

      const isRanarp = nameLower.includes("ranarp") || nameLower.includes("รอนนาร์ป");

      const isFloorLamp =
        h >= 100 ||
        nameLower.includes("ตั้งพื้น") ||
        nameLower.includes("floor") ||
        nameLower.includes("uplight") ||
        nameLower.includes("lersta") ||
        nameLower.includes("akterspring") ||
        nameLower.includes("barlast") ||
        nameLower.includes("årstid");

      const isLightBar =
        nameLower.includes("lightbar") ||
        nameLower.includes("light bar") ||
        nameLower.includes("ไฟแขวน") ||
        nameLower.includes("screenbar");

      const isRgbAmbient =
        nameLower.includes("varmblixt") ||
        nameLower.includes("stänkregn") ||
        nameLower.includes("nanoleaf") ||
        nameLower.includes("หกเหลี่ยม") ||
        nameLower.includes("ambient");

      if (isBulb) {
        // หลอดไฟ LED อัจฉริยะ (Smart LED Light Bulb เช่น KAJPLATS, Philips Hue)
        // ขั้วเกลียวโลหะทองเหลือง/สแตนเลส (E27/E14 Screw Base)
        cyl(g, M.chrome, 1.4, 1.4, 2.5, 0, 1.25, 0, 24);
        torus(g, M.chrome, 1.4, 0.25, 0, 0.8, 0, Math.PI / 2, 0, 0);
        torus(g, M.chrome, 1.4, 0.25, 0, 1.6, 0, Math.PI / 2, 0, 0);
        // คอระบายความร้อนเซรามิกสีขาว
        cyl(g, M.white, 2.4, 1.5, 2.8, 0, 3.8, 0, 24);
        // กระเปาะแก้วโอปอลขาวเรืองแสง (Frosted Opal Glass Dome)
        const bulbMat = night ? M.warmLight : M.warmWhite;
        ball(g, bulbMat, 3.6, 0, 7.0, 0, 1.15, 1.0, 1.0);
        if (night) {
          const bulbLight = new THREE.PointLight("#ffedd5", 2.8, 4.0, 1.5);
          bulbLight.position.set(0, 7.0 * CM, 0);
          g.add(bulbLight);
        }
      } else if (isSnowman) {
        // ไฟประดับรูปสโนว์แมน / เทศกาล (STRÅLA Sculptural Snowman Table Light)
        const snowMat = night ? M.warmLight : M.white;
        // ลำตัวล่าง
        ball(g, snowMat, 8.5, 0, 8.5, 0, 0.95, 1.0, 1.0);
        // หัว
        ball(g, snowMat, 6.0, 0, 20.0, 0);
        // หมวกทรงสูงสีดำ
        cyl(g, M.black, 6.2, 6.2, 0.8, 0, 24.5, 0, 24);
        cyl(g, M.black, 4.0, 4.0, 6.0, 0, 27.5, 0, 24);
        // ผ้าพันคอ
        torus(g, M.rgbCoral, 5.2, 0.9, 0, 15.5, 0, Math.PI / 2, 0, 0);
        // จมูกแครอทสีส้ม
        cyl(g, M.gold, 0.2, 0.8, 3.2, 0, 20.0, 6.5, 12).rotation.x = Math.PI / 2;
        if (night) {
          const snowLight = new THREE.PointLight("#fff7ed", 2.2, 3.5, 1.8);
          snowLight.position.set(0, 14.0 * CM, 0);
          g.add(snowLight);
        }
      } else if (isGlobe) {
        // โคมไฟตั้งโต๊ะทรงกลมแก้วโอปอล (FADO Spherical Globe Table Lamp)
        cyl(g, M.darkGrey, 8.0, 8.0, 1.2, 0, 0.6, 0, 32);
        const globeR = Math.min(w, h) * 0.42;
        const globeMat = night ? M.warmLight : M.warmWhite;
        ball(g, globeMat, globeR, 0, globeR + 1.2, 0);
        if (night) {
          const globeLight = new THREE.PointLight("#ffedd5", 2.6, 4.0, 1.5);
          globeLight.position.set(0, (globeR + 1.2) * CM, 0);
          g.add(globeLight);
        }
      } else if (isRanarp) {
        // โคมไฟตั้งโต๊ะย้อนยุคทรงกระดิ่งเหล็ก (RANARP Work Lamp with Brass Accents)
        const shadeCol = it.color || "#f8f9fa";
        const bodyMat = mk(shadeCol, 0.45);
        // ฐานเหล็กหล่อทรงกลม
        cyl(g, bodyMat, 9.5, 10.5, 2.6, 0, 1.3, 0, 32);
        // เสาเหล็กตรงพร้อมข้อต่อทองเหลือง
        cyl(g, bodyMat, 1.2, 1.2, h * 0.55, 0, h * 0.3, 0, 16);
        cyl(g, M.gold, 1.6, 1.6, 3.0, 0, h * 0.55, 0, 16);
        // แขนโค้งยื่นไปข้างหน้า
        const arm = cyl(g, bodyMat, 1.1, 1.1, h * 0.38, 0, h * 0.72, 6, 16);
        arm.rotation.x = 0.55;
        // โคมครอบทรงกระดิ่งเหล็ก (Flared Bell Shade)
        const bell = cyl(g, bodyMat, 4.0, 12.0, 14.0, 0, h * 0.85, 12, 32);
        bell.rotation.x = 0.85;
        torus(g, M.gold, 4.2, 0.6, 0, h * 0.92, 9, 0.85, 0, 0);
        // หลอดไฟอุ่น
        ball(g, night ? M.warmLight : M.white, 3.5, 0, h * 0.82, 13.5);
        if (night) {
          const spot = new THREE.SpotLight("#ffedd5", 2.5, 4.0, Math.PI / 3, 0.4);
          spot.position.set(0, h * 0.85 * CM, 12 * CM);
          spot.target.position.set(0, 0, 15 * CM);
          g.add(spot, spot.target);
        }
      } else if (isLightBar) {
        // ไฟแขวนหน้าจอถนอมสายตา (Monitor ScreenBar)
        const barW = Math.max(w, 45);
        cyl(g, M.darkGrey, 1.5, 1.5, barW, 0, h - 2, 0, 24).rotation.z = Math.PI / 2;
        cyl(g, night ? M.warmLight : M.white, 0.8, 0.8, barW - 4, 0, h - 3, 0.8, 16).rotation.z = Math.PI / 2;
        rbox(g, M.black, 4.5, 4.0, 6.5, 0, h - 3, -3.2, 0.8);
        if (night) {
          const barLight = new THREE.SpotLight("#ffedd5", 2.4, 3.5, Math.PI / 3, 0.35, 1.8);
          barLight.position.set(0, (h - 2) * CM, 0.05);
          barLight.target.position.set(0, 0, 0.25);
          g.add(barLight, barLight.target);
        }
      } else if (isRgbAmbient) {
        // ไฟ Ambient & โดนัท VARMBLIXT
        const isDonut = nameLower.includes("varmblixt");
        if (isDonut) {
          const donutMat = new THREE.MeshPhysicalMaterial({
            color: "#f97316",
            emissive: "#ea580c",
            emissiveIntensity: night ? 1.4 : 0.6,
            roughness: 0.1,
            metalness: 0.1,
            transparent: true,
            opacity: 0.85,
            clearcoat: 1.0,
          });
          owned.push(donutMat);
          torus(g, donutMat, Math.min(w, h) * 0.38, Math.min(w, h) * 0.14, 0, h / 2, 0, 0, 0, 0);
          if (night) {
            const glow = new THREE.PointLight("#fb923c", 2.5, 3.8, 1.6);
            glow.position.set(0, (h / 2) * CM, 0.1);
            g.add(glow);
          }
        } else {
          torus(g, M.rgbGlow, Math.min(w, h) * 0.36, 1.2, 0, h / 2, 0, 0, 0, 0);
          torus(g, M.rgbPurple, Math.min(w, h) * 0.22, 0.8, 0, h / 2, 0.5, 0, 0, 0);
          if (night) {
            const glow = new THREE.PointLight("#a855f7", 2.2, 3.5, 1.6);
            glow.position.set(0, (h / 2) * CM, 0.1);
            g.add(glow);
          }
        }
      } else if (isFloorLamp) {
        // โคมไฟตั้งพื้นทรงสูง (LERSTA / AKTERSPRING / BARLAST)
        const baseR = Math.max(12, Math.min(18, w * 0.45));
        cyl(g, M.darkGrey, baseR, baseR * 1.08, 3.2, 0, 1.6, 0, 32);
        const poleH = h - 35;
        cyl(g, M.chrome, 1.4, 1.4, poleH, 0, poleH / 2 + 3.2, 0, 20);
        const shadeR = Math.max(14, Math.min(22, w * 0.42));
        const shadeH = 28;
        const shadeY = h - shadeH / 2;
        cyl(g, M.warmWhite, shadeR, shadeR, shadeH, 0, shadeY, 0, 32);
        torus(g, M.gold, shadeR, 0.5, 0, shadeY + shadeH / 2, 0, Math.PI / 2, 0, 0);
        torus(g, M.gold, shadeR, 0.5, 0, shadeY - shadeH / 2, 0, Math.PI / 2, 0, 0);
        ball(g, night ? M.warmLight : M.white, 3.8, 0, shadeY, 0);
        if (night) {
          const floorLight = new THREE.PointLight("#ffedd5", 2.6, 4.5, 1.6);
          floorLight.position.set(0, shadeY * CM, 0);
          g.add(floorLight);
        }
      } else {
        // โคมไฟก้านสปริง TERTIAL
        const lampCol = it.color || "#ffffff";
        const bodyMat = mk(lampCol, 0.5);
        cyl(g, bodyMat, 8.5, 9.5, 2.4, 0, 1.2, 0, 32);
        cyl(g, M.gold, 1.2, 1.2, 1.5, 4.5, 2.6, 0, 16);
        const arm1H = h * 0.48;
        const arm1 = cyl(g, M.chrome, 0.9, 0.9, arm1H, 0, arm1H * 0.5 + 2, 0, 16);
        arm1.rotation.z = 0.28;
        const arm2H = h * 0.42;
        const arm2 = cyl(g, M.chrome, 0.9, 0.9, arm2H, -7, arm1H + arm2H * 0.4, 0, 16);
        arm2.rotation.z = -0.58;
        torus(g, M.chrome, 1.6, 0.4, -7, arm1H + 2, 0, 0, Math.PI / 2, 0);

        const shadeX = -15;
        const shadeY = h * 0.88;
        const shadeZ = 4;
        const shade = cyl(g, bodyMat, 4.5, 11.5, 14, shadeX, shadeY, shadeZ, 32);
        shade.rotation.z = 0.65;
        shade.rotation.x = 0.25;
        ball(g, night ? M.warmLight : M.white, 3.2, shadeX - 1.5, shadeY - 3.5, shadeZ + 1.2);
        if (night) {
          const lampLight = new THREE.PointLight("#ffedd5", 2.2, 3.2, 1.8);
          lampLight.position.set(shadeX * CM, (shadeY - 4) * CM, (shadeZ + 2) * CM);
          g.add(lampLight);
        }
      }
      break;
    }

    case "rug": {
      const rugMat = tex(rugTex(it.color === "#9aa6b2" ? "#64748b" : it.color), 0.98, [1, 1]);
      rbox(g, rugMat, w, 1.2, d, 0, 0.6, 0, 2.5);
      // ลายจริงของพรมจากรูปสินค้า วางบนผิวบน
      if (photo) {
        const top = new THREE.Mesh(new THREE.PlaneGeometry((w - 1) * CM, (d - 1) * CM).rotateX(-Math.PI / 2), tex(photo, 0.97));
        top.position.y = 1.25 * CM;
        top.receiveShadow = true;
        g.add(top);
      }
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
    // 19) กล้องเว็บแคม (Webcam: Logitech Brio / C270 / Razer Kiyo)
    // ==========================================
    case "webcam": {
      const isRingLight = nameLower.includes("kiyo") || nameLower.includes("ring");
      const isC270 = nameLower.includes("c270");

      rbox(g, M.black, 4.0, 1.2, 6.0, 0, 0.6, 0, 0.4);
      rbox(g, M.darkGrey, 3.5, 4.0, 1.2, 0, 2.6, -2.5, 0.3);
      cyl(g, M.metal, 0.8, 0.8, 3.8, 0, 2.0, 0, 16).rotation.z = Math.PI / 2;

      if (isRingLight) {
        cyl(g, M.black, 4.2, 4.2, 2.8, 0, 6.0, 0, 32).rotation.x = Math.PI / 2;
        torus(g, M.white, 3.2, 0.6, 0, 6.0, 1.4, 0, 0, 0);
        cyl(g, M.glass, 1.6, 1.6, 0.6, 0, 6.0, 1.5, 24).rotation.x = Math.PI / 2;
        ball(g, M.rgbGlow, 0.4, 0, 6.0, 1.6);
      } else if (isC270) {
        rbox(g, M.darkGrey, 7.5, 3.2, 3.0, 0, 5.0, 0, 1.2);
        cyl(g, M.metal, 1.2, 1.2, 0.6, -1.8, 5.0, 1.5, 20).rotation.x = Math.PI / 2;
        cyl(g, M.glass, 0.8, 0.8, 0.4, -1.8, 5.0, 1.7, 20).rotation.x = Math.PI / 2;
        cyl(g, M.black, 0.3, 0.3, 0.4, 1.8, 5.0, 1.5, 12).rotation.x = Math.PI / 2;
        rbox(g, M.leaf2, 0.4, 0.4, 0.2, 0.6, 5.0, 1.5, 0.2);
      } else {
        cyl(g, M.black, 2.2, 2.2, 9.5, 0, 5.2, 0, 24).rotation.z = Math.PI / 2;
        rbox(g, M.glass, 8.8, 3.6, 0.4, 0, 5.2, 2.1, 0.8);
        cyl(g, M.metal, 1.4, 1.4, 0.8, 0, 5.2, 2.2, 24).rotation.x = Math.PI / 2;
        cyl(g, M.glass, 0.9, 0.9, 0.4, 0, 5.2, 2.6, 20).rotation.x = Math.PI / 2;
        ball(g, M.rgbGlow, 0.25, 2.5, 5.2, 2.2);
      }
      break;
    }

    // ==========================================
    // 20) อุปกรณ์เสริมโต๊ะทำงาน / สตรีมมิ่ง (Desk Accessories & Streaming Gear)
    // ==========================================
    case "other": {
      const isWalkingPad =
        nameLower.includes("walking pad") ||
        nameLower.includes("treadmill") ||
        nameLower.includes("ลู่วิ่ง");

      const isLaptopStand =
        nameLower.includes("แท่นวางโน้ตบุ๊ก") ||
        nameLower.includes("ขาตั้งโน้ตบุ๊ก") ||
        nameLower.includes("laptop stand");

      const isStreamDeck =
        nameLower.includes("คอนโทรลเลอร์สตรีม") ||
        nameLower.includes("stream") ||
        nameLower.includes("lcd");

      const isAudioInterface =
        nameLower.includes("ออดิโอ") ||
        nameLower.includes("audio") ||
        nameLower.includes("interface");

      const isFootrest =
        nameLower.includes("ที่วางเท้า") ||
        nameLower.includes("footrest");

      if (isWalkingPad) {
        rbox(g, M.darkGrey, w, 12, d, 0, 6, 0, 2.5);
        rbox(g, M.rubber, w * 0.78, 1.2, d * 0.86, 0, 12.2, 0, 0.4);
        rbox(g, M.black, w * 0.4, 3.5, 8.0, 0, 12.0, -d / 2 + 6, 0.8);
        rbox(g, M.rgbGlow, w * 0.25, 1.0, 0.2, 0, 13.8, -d / 2 + 7, 0.2);
        for (const sx of [-1, 1]) {
          rbox(g, M.metal, 3.0, 2.0, d * 0.9, sx * (w / 2 - 2.5), 12.5, 0, 0.4);
        }
      } else if (isLaptopStand) {
        rbox(g, M.metal, w * 0.85, 0.6, d * 0.8, 0, 0.3, 0, 0.6);
        for (const sx of [-1, 1]) {
          const arm = rbox(g, M.metal, 2.4, 0.6, 18, sx * (w * 0.3), 8, -2, 0.3);
          arm.rotation.x = -0.55;
        }
        const plate = rbox(g, M.metal, w, 0.6, d, 0, 15, -1, 0.8);
        plate.rotation.x = -0.32;
        for (const sx of [-1, 1]) {
          rbox(g, M.rubber, 2.5, 1.8, 1.0, sx * (w * 0.32), 15.6, d * 0.38, 0.3);
        }
      } else if (isStreamDeck) {
        const body = rbox(g, M.darkGrey, w, h, d, 0, h / 2, 0, 1.0);
        body.rotation.x = 0.38;
        const btnCols = 5;
        const btnRows = 3;
        const bW = (w - 5) / btnCols;
        const bH = (d - 4) / btnRows;
        for (let r = 0; r < btnRows; r++) {
          for (let c = 0; c < btnCols; c++) {
            const bx = -w / 2 + 3.0 + c * bW + bW / 2;
            const bz = -d / 2 + 2.5 + r * bH + bH / 2;
            const btn = rbox(g, M.glass, bW * 0.78, 1.2, bH * 0.78, bx, h * 0.6, bz, 0.2);
            btn.rotation.x = 0.38;
            const iconMat = (r + c) % 3 === 0 ? M.rgbGlow : (r + c) % 3 === 1 ? M.rgbPurple : M.rgbCoral;
            const icon = rbox(g, iconMat, bW * 0.55, 0.4, bH * 0.55, bx, h * 0.65, bz, 0.1);
            icon.rotation.x = 0.38;
          }
        }
      } else if (isAudioInterface) {
        rbox(g, baseBody, w, h, d, 0, h / 2, 0, 0.8);
        rbox(g, M.black, w - 0.8, h - 0.8, 0.6, 0, h / 2, d / 2 + 0.3, 0.4);
        for (let ci = 0; ci < 2; ci++) {
          const cx = -w / 2 + 4.5 + ci * 6.5;
          torus(g, M.metal, 1.6, 0.4, cx, h / 2, d / 2 + 0.4, 0, 0, 0);
          cyl(g, M.black, 1.0, 1.0, 0.6, cx, h / 2, d / 2 + 0.4, 16).rotation.x = Math.PI / 2;
        }
        cyl(g, M.chrome, 2.2, 2.2, 1.8, 2.0, h / 2, d / 2 + 0.8, 24).rotation.x = Math.PI / 2;
        torus(g, M.gold, 1.0, 0.3, w / 2 - 3.5, h / 2, d / 2 + 0.4, 0, 0, 0);
      } else if (isFootrest) {
        rbox(g, M.darkGrey, w * 0.88, 3.5, d * 0.88, 0, 1.75, 0, 0.8);
        const footPlate = rbox(g, M.rubber, w, 2.0, d, 0, 7.5, 0, 1.0);
        footPlate.rotation.x = -0.26;
        for (let ri = -3; ri <= 3; ri++) {
          const rMesh = rbox(g, M.metal, w * 0.75, 0.6, 1.2, 0, 8.6 + ri * 0.8, ri * 4.2, 0.3);
          rMesh.rotation.x = -0.26;
        }
      } else {
        rbox(g, woodBody, w, h, d, 0, h / 2, 0, 0.8);
        rbox(g, M.darkGrey, w * 0.8, 0.8, d * 0.3, 0, h - 0.2, -d * 0.2, 0.4);
        cyl(g, M.gold, 0.6, 0.6, 14, -w * 0.2, h + 6, -d * 0.2, 16).rotation.x = 0.3;
      }
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
