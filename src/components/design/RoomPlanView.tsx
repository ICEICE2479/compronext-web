"use client";

import { forwardRef } from "react";
import { outwardNormal, shapeMetrics, type Pt2 } from "@/lib/room-shape";

/**
 * แปลนห้องแบบแอปวัดห้อง: เส้นขอบดำ + ความยาวทุกด้าน (นอกห้อง) + ชื่อ · พื้นที่ ตร.ม. / รอบห้อง ม.
 * เป็น SVG ล้วน → บันทึกเป็นรูป PNG ได้ (planToPng)
 */
export const RoomPlanView = forwardRef<SVGSVGElement, { shape: Pt2[]; name: string; className?: string }>(function RoomPlanView({ shape, name, className }, ref) {
  const { areaM2, perimeterM, sides } = shapeMetrics(shape);
  const maxX = Math.max(...shape.map((p) => p[0]));
  const maxZ = Math.max(...shape.map((p) => p[1]));
  const big = Math.max(maxX, maxZ, 100);
  const font = big * 0.045;
  const pad = font * 3.2;
  const W = maxX + pad * 2;
  const H = maxZ + pad * 2 + font * 4.2;
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`${-pad} ${-pad} ${W} ${H}`} className={className} role="img" aria-label={`แปลน${name} ${areaM2} ตารางเมตร`}>
      <rect x={-pad} y={-pad} width={W} height={H} fill="#ffffff" />
      <polygon points={shape.map((p) => p.join(",")).join(" ")} fill="#f8fafc" stroke="#111111" strokeWidth={big * 0.011} strokeLinejoin="miter" />
      {shape.map((p, i) => {
        const q = shape[(i + 1) % shape.length];
        if (sides[i] < 15) return null; // ด้านสั้นมาก (เสา/ขอบผนัง) ไม่ใส่ตัวเลข กันทับกัน
        const [nx, nz] = outwardNormal(shape, i);
        const mx = (p[0] + q[0]) / 2 + nx * font * 1.1;
        const mz = (p[1] + q[1]) / 2 + nz * font * 1.1;
        let ang = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
        if (ang > 90) ang -= 180;
        if (ang < -90) ang += 180;
        return (
          <text key={i} x={mx} y={mz} transform={`rotate(${ang} ${mx} ${mz})`} textAnchor="middle" dominantBaseline="central" fontSize={font} fill="#52525b" fontFamily="system-ui, sans-serif">
            {(sides[i] / 100).toFixed(2)} m
          </text>
        );
      })}
      <text x={0} y={maxZ + pad + font * 0.6} fontSize={font * 1.35} fill="#3f3f46" fontFamily="system-ui, sans-serif" fontWeight={600}>
        {name}
      </text>
      <text x={0} y={maxZ + pad + font * 2.3} fontSize={font * 1.05} fill="#71717a" fontFamily="system-ui, sans-serif">
        {areaM2} ตร.ม. / {perimeterM} ม.
      </text>
    </svg>
  );
});

/** SVG แปลน → รูป PNG (กว้าง 1080 px) */
export async function planToPng(svg: SVGSVGElement): Promise<Blob | null> {
  const vb = svg.viewBox.baseVal;
  const w = 1080;
  const h = Math.round((w * vb.height) / vb.width);
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok();
      img.onerror = () => bad(new Error("draw"));
      img.src = url;
    });
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) return null;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    return await new Promise((r) => c.toBlob(r, "image/png"));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
