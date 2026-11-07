import * as THREE from "three";
import { heightOnVertical, type Pt2 } from "@/lib/room-shape";

/**
 * วัดรูปห้องด้วย AR แบบแอปวัดขนาด (WebXR hit-test · Chrome บน Android ที่มี ARCore)
 * 1) เดินรอบห้อง แตะมุมห้องทีละมุมบนพื้น → เส้นขาว + ป้ายเหลือง “L1. 3.20 ม.” ทุกด้าน (เห็นระยะสดก่อนแตะ)
 * 2) เล็งกลับมาที่จุดแรก (เป้าเป็นสีเขียว) แตะ = ปิดรูปห้อง
 * 3) วัดความสูง: เส้นตั้งขึ้นจากมุมแรก เงยกล้องเล็งฝ้า แตะ = ได้ความสูง (ข้ามได้)
 * คืนมุมห้อง (ซม. บนพื้น) + ความสูง · กดปิด = null
 */
export interface TraceResult {
  points: Pt2[];
  h: number | null;
}

const PILL = "position:absolute;left:0;top:0;padding:4px 12px;border-radius:999px;background:#facc15;color:#111;font:700 14px system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35);will-change:transform";
const BTN = "height:52px;border-radius:26px;border:0;font:700 15px system-ui,sans-serif";
const fmt = (m: number) => `${m.toFixed(2)} ม.`;

export async function runArRoomTrace(): Promise<TraceResult | null> {
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (!xr) throw new Error("เบราว์เซอร์นี้ไม่รองรับ AR");

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;overflow:hidden";
  overlay.innerHTML = `
    <div data-labels style="position:absolute;inset:0"></div>
    <div data-msg style="position:absolute;top:calc(16px + env(safe-area-inset-top));left:16px;right:16px;padding:10px 14px;border-radius:14px;background:rgba(15,23,42,.78);font-size:15px;font-weight:600;text-align:center"></div>
    <div data-sum style="position:absolute;top:calc(74px + env(safe-area-inset-top));left:16px;right:16px;font-size:13px;text-align:center;text-shadow:0 1px 3px #000"></div>
    <div style="position:absolute;bottom:calc(24px + env(safe-area-inset-bottom));left:16px;right:16px;display:flex;gap:10px;pointer-events:auto">
      <button data-undo style="${BTN};flex:1;background:rgba(255,255,255,.92);color:#0f172a">↶ ย้อน</button>
      <button data-next style="${BTN};flex:1.5;background:#facc15;color:#111"></button>
      <button data-close aria-label="ปิด" style="${BTN};width:52px;background:rgba(255,255,255,.92);color:#0f172a;font-size:20px">✕</button>
    </div>`;
  document.body.appendChild(overlay);
  const q = <T extends HTMLElement>(s: string) => overlay.querySelector<T>(s)!;
  const msg = q("[data-msg]");
  const sum = q("[data-sum]");
  const labelsBox = q("[data-labels]");
  const nextBtn = q<HTMLButtonElement>("[data-next]");
  // แตะปุ่มบนจอ ไม่ให้นับเป็นการแตะปักจุดใน AR
  nextBtn.parentElement!.addEventListener("beforexrselect", (e) => e.preventDefault());

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.domElement.style.cssText = "position:fixed;inset:0;z-index:2147483646";
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);

  // เป้าบนพื้น (ขาว · ใกล้จุดแรก = เขียว แตะแล้วปิดรูป)
  const reticleMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const reticle = new THREE.Group();
  reticle.add(new THREE.Mesh(new THREE.RingGeometry(0.07, 0.085, 40).rotateX(-Math.PI / 2), reticleMat));
  reticle.add(new THREE.Mesh(new THREE.CircleGeometry(0.012, 16).rotateX(-Math.PI / 2), reticleMat));
  reticle.visible = false;
  scene.add(reticle);

  const white = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const unitBar = new THREE.BoxGeometry(0.012, 0.004, 1).translate(0, 0, 0.5);
  const dotGeo = new THREE.SphereGeometry(0.02, 16, 12);
  const bar = (a: THREE.Vector3, b: THREE.Vector3, m = new THREE.Mesh(unitBar, white)) => {
    m.position.copy(a);
    m.lookAt(b);
    m.scale.z = Math.max(0.001, a.distanceTo(b));
    return m;
  };

  const pts: THREE.Vector3[] = [];
  const marks = new THREE.Group();
  scene.add(marks);
  const live = new THREE.Mesh(unitBar, white);
  live.visible = false;
  scene.add(live);
  const vert = new THREE.Mesh(unitBar, white);
  vert.visible = false;
  scene.add(vert);
  const target = new THREE.Vector3();
  let found = false;
  let lastFound = 0;
  let mode: "floor" | "height" = "floor";
  let snap = false;
  let liveH: number | null = null;

  // ป้ายเหลือง (DOM) — วางตามตำแหน่งบนจอทุกเฟรม
  const pool: HTMLDivElement[] = [];
  const pill = (i: number) => {
    while (pool.length <= i) {
      const d = document.createElement("div");
      d.style.cssText = PILL;
      labelsBox.appendChild(d);
      pool.push(d);
    }
    return pool[i];
  };

  const rebuild = () => {
    for (const c of [...marks.children]) marks.remove(c);
    pts.forEach((p, i) => {
      const d = new THREE.Mesh(dotGeo, white);
      d.position.copy(p);
      marks.add(d);
      if (i > 0) marks.add(bar(pts[i - 1], p));
    });
    if (mode === "height" && pts.length >= 3) marks.add(bar(pts[pts.length - 1], pts[0]));
    status();
  };
  const perimeter = () => pts.reduce((s, p, i) => (i ? s + p.distanceTo(pts[i - 1]) : s), 0) + (mode === "height" && pts.length >= 3 ? pts[pts.length - 1].distanceTo(pts[0]) : 0);
  const status = () => {
    sum.textContent = pts.length > 1 ? `${pts.length} มุม · รอบห้อง ${fmt(perimeter())}` : "";
    if (mode === "height") {
      msg.textContent = "ปิดรูปห้องแล้ว ✓ วัดความสูง: เงยกล้องเล็งมุมฝ้าเหนือจุดแรก แล้วแตะจอ";
      nextBtn.textContent = "ข้าม (สูง 2.60 ม.)";
      return;
    }
    nextBtn.textContent = pts.length >= 3 ? "ปิดรูปห้อง" : "แตะมุมห้อง";
    nextBtn.style.opacity = pts.length >= 3 ? "1" : ".55";
    if (!found) msg.textContent = "ส่องกล้องลงพื้น เปิดไฟห้องให้สว่าง แล้วขยับมือถือช้าๆ จนเห็นวงกลม";
    else if (snap) msg.textContent = "เป้าเป็นสีเขียว — แตะเพื่อปิดรูปห้อง";
    else if (!pts.length) msg.textContent = "เล็งวงกลมที่มุมห้อง (ตรงที่ผนังชนพื้น) แล้วแตะจอ";
    else msg.textContent = `เดินไปมุมถัดไป แล้วแตะ (มุมที่ ${pts.length + 1}) · ครบแล้วเล็งกลับจุดแรก`;
  };

  let session: XRSession;
  try {
    session = await xr.requestSession("immersive-ar", { requiredFeatures: ["hit-test"], optionalFeatures: ["dom-overlay"], domOverlay: { root: overlay } });
  } catch {
    cleanup();
    throw new Error("เปิดกล้อง AR ไม่ได้ (อนุญาตกล้อง หรือเครื่องไม่รองรับ ARCore)");
  }

  function cleanup() {
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer.domElement.remove();
    overlay.remove();
    for (const g of [unitBar, dotGeo]) g.dispose();
    white.dispose();
    reticleMat.dispose();
  }

  return new Promise<TraceResult | null>((resolve) => {
    let finished = false;
    const finish = async (h: number | null | false) => {
      if (finished) return;
      finished = true;
      const out: TraceResult | null = h === false || pts.length < 3 ? null : { points: pts.map((p) => [Math.round(p.x * 100), Math.round(p.z * 100)] as Pt2), h: h === null ? null : Math.round(h * 100) };
      await session.end().catch(() => {});
      cleanup();
      resolve(out);
    };
    const close = () => {
      mode = "height";
      liveH = null;
      navigator.vibrate?.([20, 40, 20]);
      rebuild();
    };
    q("[data-undo]").addEventListener("click", (e) => {
      e.stopPropagation();
      if (mode === "height") mode = "floor";
      else pts.pop();
      rebuild();
    });
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (mode === "height") finish(null);
      else if (pts.length >= 3) close();
    });
    q("[data-close]").addEventListener("click", (e) => {
      e.stopPropagation();
      finish(false);
    });
    session.addEventListener("end", () => finish(false));
    session.addEventListener("select", () => {
      if (mode === "height") {
        if (liveH !== null && liveH > 1.6 && liveH < 4.6) finish(liveH);
        else msg.textContent = "ยังเล็งความสูงไม่ได้ — เงยกล้องขึ้นช้าๆ ให้เส้นตั้งชนฝ้า";
        return;
      }
      if (!found) return;
      if (snap) return close();
      pts.push(target.clone());
      navigator.vibrate?.(15);
      rebuild();
    });

    const tmp = new THREE.Vector3();
    const inv = new THREE.Matrix4();
    const viewerM = new THREE.Matrix4();
    const toScreen = (v: THREE.Vector3, cam: THREE.Camera) => {
      tmp.copy(v).applyMatrix4(inv.copy(cam.matrixWorld).invert());
      if (tmp.z > -0.05) return null; // อยู่หลังกล้อง
      tmp.applyMatrix4((cam as THREE.PerspectiveCamera).projectionMatrix);
      return { x: ((tmp.x + 1) / 2) * window.innerWidth, y: ((1 - tmp.y) / 2) * window.innerHeight };
    };
    const place = (el: HTMLDivElement, a: THREE.Vector3, b: THREE.Vector3, text: string, cam: THREE.Camera) => {
      const sa = toScreen(a, cam);
      const sb = toScreen(b, cam);
      if (!sa || !sb) return void (el.style.display = "none");
      let ang = (Math.atan2(sb.y - sa.y, sb.x - sa.x) * 180) / Math.PI;
      if (ang > 90) ang -= 180;
      if (ang < -90) ang += 180;
      el.style.display = "block";
      el.textContent = text;
      el.style.transform = `translate(${(sa.x + sb.x) / 2}px,${(sa.y + sb.y) / 2}px) translate(-50%,-50%) rotate(${ang}deg)`;
    };

    (async () => {
      renderer.xr.setReferenceSpaceType("local");
      await renderer.xr.setSession(session);
      const viewer = await session.requestReferenceSpace("viewer");
      const hitSource = await session.requestHitTestSource?.({ space: viewer });
      rebuild();
      renderer.setAnimationLoop((_t, frame?: XRFrame) => {
        const ref = renderer.xr.getReferenceSpace();
        if (frame && hitSource && ref) {
          const pose = frame.getHitTestResults(hitSource)[0]?.getPose(ref);
          const was = found;
          const wasSnap = snap;
          if (pose) {
            target.setFromMatrixPosition(viewerM.fromArray(pose.transform.matrix));
            lastFound = performance.now();
          }
          found = !!pose || performance.now() - lastFound < 400;
          // ใกล้จุดแรก ≤ 20 ซม. → ดูดเข้าจุดแรก
          snap = mode === "floor" && found && pts.length >= 3 && Math.hypot(target.x - pts[0].x, target.z - pts[0].z) < 0.2;
          if (snap) target.copy(pts[0]);
          reticle.visible = mode === "floor" && found;
          reticle.position.copy(target);
          reticleMat.color.set(snap ? "#22c55e" : "#ffffff");
          if (was !== found || wasSnap !== snap) status();
          live.visible = mode === "floor" && found && pts.length > 0;
          if (live.visible) bar(pts[pts.length - 1], target, live);
          // ความสูง: เส้นตั้งจากมุมแรก ↔ แนวเล็งกล้อง
          liveH = null;
          if (mode === "height") {
            const vp = frame.getViewerPose(ref);
            if (vp) {
              const m = viewerM.fromArray(vp.transform.matrix);
              const o = new THREE.Vector3().setFromMatrixPosition(m);
              const dir = new THREE.Vector3(0, 0, -1).transformDirection(m);
              liveH = heightOnVertical(pts[0], o, dir);
            }
          }
          vert.visible = mode === "height" && liveH !== null && liveH > 0.05;
          if (vert.visible) bar(pts[0], tmp.copy(pts[0]).setY(pts[0].y + liveH!), vert);
        }
        renderer.render(scene, camera);
        // ป้ายทุกด้าน + ด้านที่กำลังลาก + ความสูง
        const xrCam = renderer.xr.getCamera();
        const cam = xrCam.cameras[0] ?? xrCam;
        let n = 0;
        const segs: Array<[THREE.Vector3, THREE.Vector3]> = [];
        for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
        if (mode === "height" && pts.length >= 3) segs.push([pts[pts.length - 1], pts[0]]);
        else if (live.visible) segs.push([pts[pts.length - 1], target.clone()]);
        segs.forEach(([a, b], i) => place(pill(n++), a, b, `L${i + 1}. ${fmt(a.distanceTo(b))}`, cam));
        if (vert.visible) {
          const top = pts[0].clone().setY(pts[0].y + liveH!);
          place(pill(n++), pts[0], top, `สูง ${fmt(liveH!)}`, cam);
        }
        for (let i = n; i < pool.length; i++) pool[i].style.display = "none";
      });
    })().catch(() => finish(false));
  });
}
