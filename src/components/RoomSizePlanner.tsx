"use client";

import { useState } from "react";
import { CheckCircle2, Ruler, AlertTriangle } from "lucide-react";

export function RoomSizePlanner({
  deskWidthCm,
  deskDepthCm,
  roomName,
}: {
  deskWidthCm: number;
  deskDepthCm: number;
  roomName: string;
}) {
  const [userWidthCm, setUserWidthCm] = useState<number>(220);
  const [userDepthCm, setUserDepthCm] = useState<number>(180);

  // ระยะเผื่อเก้าอี้ถอยหลัง ~75 ซม.
  const requiredDepth = deskDepthCm + 75;

  const widthClearance = userWidthCm - deskWidthCm;
  const depthClearance = userDepthCm - requiredDepth;
  const fitsWell = widthClearance >= 15 && depthClearance >= 0;

  return (
    <div className="card p-6 space-y-4 border-l-4 border-l-info">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center border-b border-ink-200 pb-3">
        <div>
          <span className="eyebrow">2D ROOM SPACE & DESK FIT SIMULATOR</span>
          <h2 className="font-display text-lg font-bold text-ink-950">
            จำลองวัดขนาดมุมห้องจริงของคุณกับโต๊ะชุดนี้ ({roomName})
          </h2>
          <p className="text-xs text-ink-500">
            กรอกความกว้างและความลึกของมุมห้องจริง (ซม.) เพื่อตรวจสอบว่าวางโต๊ะขนาด{" "}
            <strong>
              {deskWidthCm} × {deskDepthCm} ซม.
            </strong>{" "}
            พร้อมระยะถอยเก้าอี้ได้พอดีหรือไม่
          </p>
        </div>

        <span
          className={`badge px-3 py-1.5 text-xs ${
            fitsWell ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"
          }`}
        >
          {fitsWell ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>วางในห้องของคุณได้พอดี</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4" />
              <span>พื้นที่ค่อนข้างแคบ โปรดเช็กระยะ</span>
            </>
          )}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-center">
        <div className="lg:col-span-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ความกว้างมุมห้องของคุณ (ซม.)</label>
              <input
                type="number"
                min={100}
                max={600}
                value={userWidthCm}
                onChange={(e) => setUserWidthCm(Math.max(100, Number(e.target.value) || 100))}
                className="input font-display font-bold"
              />
            </div>
            <div>
              <label className="label">ความลึกมุมห้องของคุณ (ซม.)</label>
              <input
                type="number"
                min={100}
                max={600}
                value={userDepthCm}
                onChange={(e) => setUserDepthCm(Math.max(100, Number(e.target.value) || 100))}
                className="input font-display font-bold"
              />
            </div>
          </div>

          <div className="rounded-[5px] border border-ink-200 bg-ink-50 p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-600">ขนาดหน้าโต๊ะของห้องตัวอย่างนี้:</span>
              <strong className="text-ink-950">
                กว้าง {deskWidthCm} × ลึก {deskDepthCm} ซม.
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-600">พื้นที่ด้านข้างที่เหลือ (ซ้าย-ขวา):</span>
              <strong className={widthClearance >= 0 ? "text-ok" : "text-bad"}>
                {widthClearance >= 0
                  ? `เหลือพื้นที่ ${widthClearance} ซม.`
                  : `โต๊ะกว้างเกินห้อง ${Math.abs(widthClearance)} ซม.`}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-600">พื้นที่ถอยเก้าอี้และทางเดินด้านหลัง:</span>
              <strong className={depthClearance >= 0 ? "text-ok" : "text-warn"}>
                {depthClearance >= 0
                  ? `ถอยเก้าอี้ได้สบาย (เหลือทางเดิน ${depthClearance + 75} ซม.)`
                  : `ระยะถอยเก้าอี้แคบกว่ามาตรฐาน ${Math.abs(depthClearance)} ซม.`}
              </strong>
            </div>
          </div>
        </div>

        {/* 2D Visual Blueprint Box */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center rounded-[6px] border border-ink-200 bg-ink-50/60 p-4">
          <div className="text-[11px] font-bold text-info mb-2 flex items-center gap-1">
            <Ruler className="h-3.5 w-3.5" />
            <span>ผังจำลองมุมมองด้านบน (Top-Down Floorplan)</span>
          </div>
          <div className="relative flex items-start justify-center rounded-[4px] border-2 border-dashed border-info/50 bg-white p-4 w-full max-w-xs h-44">
            <span className="absolute right-2 bottom-1 text-[10px] font-mono text-ink-400">
              ห้องของคุณ: {userWidthCm}×{userDepthCm} ซม.
            </span>

            {/* Desk Box */}
            <div
              className="flex flex-col items-center justify-center rounded-[4px] border-2 border-info bg-info-bg text-info font-bold text-xs shadow-xs"
              style={{
                width: `${Math.min(95, Math.max(35, Math.round((deskWidthCm / userWidthCm) * 100)))}%`,
                height: `${Math.min(60, Math.max(25, Math.round((deskDepthCm / userDepthCm) * 100)))}%`,
              }}
            >
              <span>โต๊ะ {deskWidthCm}×{deskDepthCm} ซม.</span>
            </div>

            {/* Chair Circle */}
            <div className="absolute bottom-8 h-9 w-9 rounded-full border-2 border-ink-700 bg-ink-100 flex items-center justify-center text-[10px] font-bold text-ink-800">
              เก้าอี้
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
