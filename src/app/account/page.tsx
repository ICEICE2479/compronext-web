import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { AccountClient } from "@/components/AccountClient";
import { readDb } from "@/lib/data/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "บัญชีของฉัน",
  description: "จัดการบัญชี ดีไซน์ที่บันทึก และการตั้งค่าความเป็นส่วนตัวของคุณบน ComproNext",
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  const designs = user
    ? readDb()
        .designs.filter((d) => d.userId === user.id)
        .map((d) => ({ id: d.id, imageUrl: d.imageUrl, prompt: d.prompt }))
    : [];

  return (
    <div className="container-page space-y-6 py-8">
      <div className="space-y-2">
        <p className="eyebrow">บัญชีสมาชิก</p>
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">บัญชีของฉัน</h1>
        <p className="text-sm text-ink-600">เข้าสู่ระบบด้วยรหัส OTP ทางอีเมล</p>
      </div>

      <AccountClient initialUser={user} designs={designs} />
    </div>
  );
}
