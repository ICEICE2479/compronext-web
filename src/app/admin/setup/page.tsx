import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { countAdmins } from "@/lib/admin/accounts";
import { AdminSetupForm } from "./AdminSetupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ตั้งค่าผู้ดูแลระบบคนแรก",
  description: "สร้างบัญชีซูเปอร์แอดมินคนแรกของ ComproNext",
  robots: { index: false, follow: false },
};

export default async function AdminSetupPage() {
  if ((await countAdmins()) > 0) notFound();
  return <AdminSetupForm />;
}
