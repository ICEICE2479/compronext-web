import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { AccountClient } from "@/components/AccountClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  description: "เข้าสู่ระบบ ComproNext ด้วยรหัส OTP ทางอีเมล, LINE หรือ Google",
};

const LOGIN_ERRORS: Record<string, string> = {
  line_not_configured: "ล็อกอินด้วย LINE ยังไม่เปิดใช้ ใช้อีเมลรับรหัสแทนได้เลย",
  line_cancelled: "ยกเลิกการเข้าสู่ระบบด้วย LINE",
  line_state: "ลิงก์เข้าสู่ระบบหมดอายุ ลองใหม่อีกครั้ง",
  line_failed: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง",
  google_not_configured: "ล็อกอินด้วย Google ยังไม่เปิดใช้ ใช้อีเมลรับรหัสแทนได้เลย",
  google_cancelled: "ยกเลิกการเข้าสู่ระบบด้วย Google",
  google_state: "ลิงก์เข้าสู่ระบบหมดอายุ ลองใหม่อีกครั้ง",
  google_failed: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await getCurrentUser();

  return (
    <div className="container-page space-y-6 py-8">
      <div className="space-y-2 text-center">
        <p className="eyebrow">เข้าสู่ระบบ</p>
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">เข้าสู่ระบบ ComproNext</h1>
        <p className="text-sm text-ink-600">รับรหัส 6 หลักทางอีเมลเพื่อเข้าใช้งาน</p>
      </div>

      {error && LOGIN_ERRORS[error] && (
        <p className={`mx-auto max-w-md rounded-lg p-3 text-center text-sm font-semibold ${error.endsWith("_not_configured") ? "bg-info-bg text-info" : "bg-bad-bg text-bad"}`}>{LOGIN_ERRORS[error]}</p>
      )}
      <AccountClient initialUser={user} />
    </div>
  );
}
