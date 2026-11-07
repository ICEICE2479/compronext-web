import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, getDevPasscodeHint, isAdminAuthenticated } from "@/lib/auth";
import { countAdmins, ownerEmails } from "@/lib/admin/accounts";
import { AdminLoginClient } from "@/components/AdminLoginClient";
import { AccountClient } from "@/components/AccountClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ผู้ดูแลระบบ", description: "เข้าสู่ระบบผู้ดูแล ComproNext", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const authed = await isAdminAuthenticated();
  if (authed) {
    redirect("/admin");
  }
  const { owner } = await searchParams;
  const user = await getCurrentUser();
  const owners = ownerEmails();
  const isOwner = !!user?.email && owners.includes(user.email.toLowerCase());
  const noAdminsYet = (await countAdmins()) === 0;

  return (
    <div className="space-y-6">
      {/* ทางง่ายสำหรับเจ้าของเว็บ: ล็อกอินด้วยอีเมล (OTP) → กดปุ่มเดียวเข้าหลังบ้าน */}
      {owners.length > 0 && (
        <section className="container-page max-w-md space-y-3 pt-8">
          <h1 className="font-display text-2xl font-bold text-ink-950">เข้าหลังบ้าน</h1>
          {isOwner ? (
            <form action="/api/admin/owner" method="post" className="space-y-2">
              <button type="submit" className="btn btn-primary h-12 w-full rounded-full text-base">
                เข้าหลังบ้านเลย
              </button>
              <p className="text-center text-xs text-ink-600">ในฐานะเจ้าของเว็บ ({user!.email})</p>
            </form>
          ) : (
            <>
              <p className="text-sm text-ink-700">
                เจ้าของเว็บ: ใส่อีเมลที่ตั้งไว้ตอนติดตั้ง แล้วรับรหัส 6 หลักทางอีเมล จากนั้นกด “เข้าหลังบ้านเลย”
              </p>
              {owner === "denied" && <p className="rounded-lg bg-bad-bg p-3 text-sm font-semibold text-bad">อีเมลนี้ไม่ใช่อีเมลเจ้าของเว็บ</p>}
              {user ? (
                <p className="rounded-lg bg-warn-bg p-3 text-sm text-ink-800">ตอนนี้ล็อกอินด้วย {user.email} ซึ่งไม่ใช่อีเมลเจ้าของเว็บ — ออกจากระบบแล้วล็อกอินใหม่ด้วยอีเมลเจ้าของ</p>
              ) : (
                <AccountClient initialUser={null} />
              )}
            </>
          )}
        </section>
      )}
      <details className="container-page max-w-md" open={true}>
        <summary className="cursor-pointer py-2 text-sm font-semibold text-ink-600">เข้าด้วยชื่อผู้ใช้ + รหัสผ่านแอดมิน</summary>
        <AdminLoginClient demoPasscodeHint={noAdminsYet ? getDevPasscodeHint() : null} />
      </details>
    </div>
  );
}
