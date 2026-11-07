import { NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/google-login";
import { isLineConfigured } from "@/lib/line-login";

/** ช่องทางล็อกอินที่เปิดใช้จริง — ปุ่มที่ยังไม่ได้ตั้งค่าจะไม่แสดงให้ลูกค้าเห็น */
export function GET() {
  return NextResponse.json(
    { line: isLineConfigured(), google: isGoogleConfigured() },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
