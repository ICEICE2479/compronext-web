import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin/session";
import { readDb } from "@/lib/data/store";
import { getServerlessStackStatus } from "@/lib/serverless-stack";
import { readUploads } from "@/app/api/upload/route";
import { AdminClient } from "@/components/AdminClient";
import { AdminStats } from "@/components/AdminStats";
import { getAllStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ผู้ดูแลระบบ", description: "ระบบจัดการหลังบ้าน ComproNext", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  const db = readDb();
  const stackServices = getServerlessStackStatus();
  const initialFiles = readUploads();
  const stats = await getAllStats();

  return (
    <div className="container-page space-y-6 py-8">
      <div className="card p-6 border-l-4 border-l-info bg-white flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <p className="eyebrow">SERVERLESS BACKOFFICE & ADMIN CONSOLE</p>
          <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">
            ระบบจัดการหลังบ้าน ComproNext (Modern Serverless Stack)
          </h1>
          <p className="text-xs sm:text-sm text-ink-600">
            ควบคุมครบทั้ง 5 บริการคลาวด์ (Cloudflare · Neon DB · Clerk Auth · Resend Email · R2 Storage), จัดการสินค้า หมวดหมู่ เนื้อหาหน้าแรก บทความ แบนเนอร์ และข้อมูลเว็บไซต์ SEO
          </p>
        </div>
        <Link href="/admin/ops" className="btn btn-primary shrink-0 rounded-full">
          ศูนย์ควบคุม: ผู้ใช้ · รีวิว · ชุมชน · ดันสินค้า · ระบบ →
        </Link>
      </div>

      <AdminStats stats={stats} products={db.products} />

      <AdminClient
        initialDb={db}
        stackServices={stackServices}
        initialFiles={initialFiles}
        currentAdmin={{ username: session.username, role: session.role }}
      />
    </div>
  );
}
