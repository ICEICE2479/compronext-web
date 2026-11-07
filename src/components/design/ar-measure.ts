import * as THREE from "three";
import { lengthFrom3d } from "@/lib/measure";

/**
 * วัดห้องด้วย AR (WebXR hit-test) — ส่องพื้น แตะ 2 จุดได้ความกว้าง แตะอีก 2 จุดได้ความลึก
 * (วัดทีละด้าน ไม่ต้องหามุมห้อง ใช้ได้แม้มีของวางบังมุม) · ระหว่างเล็งโชว์ระยะสดจากจุดล่าสุดถึงเป้า
 * คืน กว้าง/ลึก (ซม.) + พื้นที่ เมื่อผู้ใช้กด "เสร็จ" · กดปิด = null
 * ใช้ได้กับเบราว์เซอร์ที่รองรับ immersive-ar (Chrome บน Android ที่มี ARCore)
 */

export async function runArMeasure(): Promise<{ w: number; d: number; areaM2: number } | null> {
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (!xr) throw new Error("เบราว์เซอร์นี้ไม่รองรับ AR");

  // ---------- DOM overlay (ข้อความ + ปุ่มบนภาพกล้อง) ----------
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:system-ui,sans-serif;color:#fff";
  overlay.innerHTML = `
    <div data-msg style="position:absolute;top:calc(16px + env(safe-area-inset-top));left:16px;right:16px;padding:10px 14px;border-radius:14px;background:rgba(15,23,42,.75);font-size:15px;font-weight:600;text-align:center">ส่องกล้องลงพื้น ค่อยๆ ขยับจนเห็นวงกลมเป้า</div>
    <div data-sides style="position:absolute;top:calc(70px + env(safe-area-inset-top));left:16px;right:16px;font-size:13px;text-align:center;text-shadow:0 1px 3px #000"></div>
    <div style="position:absolute;bottom:calc(24px + env(safe-area-inset-bottom));left:16px;right:16px;display:flex;gap:10px;pointer-events:auto">
      <button data-undo style="flex:1;height:52px;border-radius:26px;border:0;background:rgba(255,255,255,.9);color:#0f172a;font-size:15px;font-weight:700">ย้อนจุด</button>
      <button data-done style="flex:1.4;height:52px;border-radius:26px;border:0;background:#2563eb;color:#fff;font-size:15px;font-weight:700">เสร็จ</button>
      <button data-close style="width:52px;height:52px;border-radius:26px;border:0;background:rgba(255,255,255,.9);color:#0f172a;font-size:20px">✕</button>
    </div>`;
  document.body.appendChild(overlay);
  const msg = overlay.querySelector<HTMLElement>("[data-msg]")!;
  const sides = overlay.querySelector<HTMLElement>("[data-sides]")!;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.domElement.style.cssText = "position:fixed;inset:0;z-index:2147483646";
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);
  scene.add(new THREE.HemisphereLight("#ffffff", "#bbbbff", 2));

  // เป้าบนพื้น
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
  const dotGeo = new THREE.SphereGeometry(0.025, 16, 12);
  const dotMat = new THREE.MeshBasicMaterial({ color: "#2563eb" });
  const lineMat = new THREE.LineBasicMaterial({ color: "#facc15" });
  const points: THREE.Vector3[] = [];
  const marks: THREE.Object3D[] = [];
  let line: THREE.Line | null = null;
  // เส้นยางยืดจากจุดล่าสุดถึงเป้า (เห็นระยะสดก่อนแตะ)
  const liveGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const live = new THREE.Line(liveGeo, new THREE.LineBasicMaterial({ color: "#ffffff" }));
  live.visible = false;
  scene.add(live);
  const reticlePos = new THREE.Vector3();
  let lastFound = 0;
  const STEP = ["ความกว้าง", "ความลึก"];

  const redraw = () => {
    for (const m of marks) scene.remove(m);
    marks.length = 0;
    for (const p of points) {
      const d = new THREE.Mesh(dotGeo, dotMat);
      d.position.copy(p);
      scene.add(d);
      marks.push(d);
    }
    if (line) {
      scene.remove(line);
      line.geometry.dispose();
    }
    // วาดเป็นคู่: (จุด1-2) = กว้าง, (จุด3-4) = ลึก
    const segs: THREE.Vector3[] = [];
    for (let i = 0; i + 1 < points.length; i += 2) segs.push(points[i], points[i + 1]);
    line = segs.length ? new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs), lineMat) : null;
    if (line) scene.add(line);
    const lens: string[] = [];
    for (let i = 0; i + 1 < points.length; i += 2) lens.push(`${STEP[i / 2]}: ${(lengthFrom3d(points[i], points[i + 1]) / 100).toFixed(2)} ม.`);
    sides.textContent = lens.join(" · ");
    updateMsg();
  };
  const updateMsg = () => {
    if (!reticle.visible) {
      msg.textContent = "ยังหาพื้นไม่เจอ — ส่องกล้องลงพื้น (เปิดไฟห้องให้สว่าง) แล้วขยับมือถือช้าๆ ซ้าย-ขวา";
      return;
    }
    const n = points.length;
    msg.textContent =
      n >= 4
        ? "วัดครบแล้ว กด “เสร็จ” ได้เลย"
        : n % 2 === 0
          ? `วัด${STEP[n / 2]}: เล็งเป้าที่ขอบผนังด้านหนึ่ง (ตรงพื้น) แล้วแตะจอ`
          : `เดินไปเล็งขอบผนังอีกฝั่ง แล้วแตะจอ`;
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
    dotGeo.dispose();
    dotMat.dispose();
    lineMat.dispose();
  }

  return new Promise((resolve) => {
    let finished = false;
    const finish = async (ok: boolean) => {
      if (finished) return;
      finished = true;
      let r: { w: number; d: number; areaM2: number } | null = null;
      if (ok && points.length >= 2) {
        const w = Math.round(lengthFrom3d(points[0], points[1]));
        const d = points.length >= 4 ? Math.round(lengthFrom3d(points[2], points[3])) : w;
        r = { w, d, areaM2: Math.round((w * d) / 1000) / 10 };
      }
      await session.end().catch(() => {});
      cleanup();
      resolve(r);
    };
    overlay.querySelector("[data-undo]")!.addEventListener("click", (e) => {
      e.stopPropagation();
      points.pop();
      redraw();
    });
    overlay.querySelector("[data-done]")!.addEventListener("click", (e) => {
      e.stopPropagation();
      if (points.length >= 4 || points.length === 2) finish(true);
      else msg.textContent = points.length < 2 ? "แตะ 2 จุดเพื่อวัดความกว้างก่อน" : "แตะอีก 1 จุดให้ครบความลึก";
    });
    overlay.querySelector("[data-close]")!.addEventListener("click", (e) => {
      e.stopPropagation();
      finish(false);
    });
    session.addEventListener("end", () => finish(false));
    // แตะจอ (select) = ปักจุดที่เป้า
    session.addEventListener("select", () => {
      if (!reticle.visible || points.length >= 4) return;
      points.push(new THREE.Vector3().setFromMatrixPosition(reticle.matrix));
      navigator.vibrate?.(15);
      redraw();
    });

    (async () => {
      renderer.xr.setReferenceSpaceType("local");
      await renderer.xr.setSession(session);
      const viewer = await session.requestReferenceSpace("viewer");
      const hitSource = await session.requestHitTestSource?.({ space: viewer });
      redraw();
      renderer.setAnimationLoop((_t, frame?: XRFrame) => {
        if (frame && hitSource) {
          const ref = renderer.xr.getReferenceSpace();
          const hits = frame.getHitTestResults(hitSource);
          const pose = hits[0] && ref ? hits[0].getPose(ref) : undefined;
          const was = reticle.visible;
          // เจอพื้นแล้วค้างเป้าไว้ 0.4 วิ กันกะพริบ
          if (pose) {
            reticle.matrix.fromArray(pose.transform.matrix);
            reticlePos.setFromMatrixPosition(reticle.matrix);
            lastFound = performance.now();
          }
          reticle.visible = !!pose || performance.now() - lastFound < 400;
          if (was !== reticle.visible) updateMsg();
          // ระยะสด
          const last = points.length % 2 === 1 ? points[points.length - 1] : null;
          live.visible = !!last && reticle.visible;
          if (last && reticle.visible) {
            liveGeo.setFromPoints([last, reticlePos]);
            sides.textContent = `${STEP[(points.length - 1) / 2]} ตอนนี้: ${(lengthFrom3d(last, reticlePos) / 100).toFixed(2)} ม.`;
          }
        }
        renderer.render(scene, camera);
      });
    })().catch(() => finish(false));
  });
}
