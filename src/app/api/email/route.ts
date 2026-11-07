import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sendComproNextEmail } from "@/lib/serverless-stack";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "ไม่อนุญาต (เฉพาะผู้ดูแลระบบ)" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    subject?: string;
    roomOrBuildTitle?: string;
    totalPriceFormatted?: string;
    itemsSummary?: string[];
  };

  const to = (body.to || "").trim();
  if (!to || !to.includes("@")) {
    return NextResponse.json(
      { ok: false, error: "กรุณากรอกอีเมลผู้รับให้ถูกต้อง" },
      { status: 400 }
    );
  }

  const result = await sendComproNextEmail({
    to,
    subject:
      body.subject || "สรุปไอเดียจัดห้องคอมและใบเสนอราคาจาก ComproNext",
    roomOrBuildTitle:
      body.roomOrBuildTitle || "Gaming RGB Black Battlestation",
    totalPriceFormatted: body.totalPriceFormatted || "฿99,690",
    itemsSummary:
      body.itemsSummary && body.itemsSummary.length > 0
        ? body.itemsSummary
        : [
            "โต๊ะเกมมิ่งท็อปลายคาร์บอน 140×70 ซม. — ฿4,990",
            "คอมประกอบ RTX 4070 SUPER / Ryzen 7 7800X3D — ฿58,900",
            "จอเกม 27 นิ้ว QHD 170Hz IPS (×2) — ฿17,980",
          ],
  });

  return NextResponse.json(result);
}
