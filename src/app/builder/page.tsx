import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { BuilderClient } from "@/components/builder/BuilderClient";

export const metadata: Metadata = {
  title: "จัดสเปกคอม 3D & เช็ก FPS",
  description: "เลือกชิ้นส่วนคอม ดูในเคส 3D เช็กความเข้ากันได้ ประเมิน FPS และราคารวมในหน้าเดียว",
};

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string; monitor?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="container-page space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">จัดสเปกคอม 3D</h1>
        <PageIntro what="เลือกชิ้นส่วนคอม ดูในเคส 3D เช็กความเข้ากันได้และ FPS" next="เริ่มจากซีพียูหรือการ์ดจอ แล้วค่อยเลือกชิ้นอื่นตามที่ระบบแนะนำ" />
        <Link href="/builder/guide" className="inline-flex min-h-11 items-center text-sm font-semibold text-info hover:underline">
          มือใหม่? อ่านคู่มือเลือกชิ้นส่วน
        </Link>
      </div>

      <BuilderClient
        initialEncodedBuild={sp.b ?? null}
        initialMonitorId={sp.monitor ?? null}
      />
    </div>
  );
}
