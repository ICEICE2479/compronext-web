import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { getCurrentUser } from "@/lib/auth";
import { MessagesClient } from "@/components/chat/MessagesClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ข้อความ", description: "แชทกับร้านค้าพาร์ตเนอร์และลูกค้าของคุณบน ComproNext", robots: { index: false } };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) {
    return (
      <div className="container-page flex min-h-[50vh] items-center justify-center py-12">
        <h1 className="sr-only">ข้อความ</h1>
        <EmptyState
          icon={<MessageCircle className="h-12 w-12 text-ink-400" aria-hidden="true" />}
          title="เข้าสู่ระบบเพื่อดูข้อความกับร้านค้า"
          description="แชทกับร้านพาร์ตเนอร์ได้โดยตรงหลังเข้าสู่ระบบ"
          action={{ label: "เข้าสู่ระบบ", href: "/login" }}
        />
      </div>
    );
  }
  return (
    <div className="container-page py-4 sm:py-8">
      <h1 className="sr-only">ข้อความ</h1>
      <MessagesClient initialThreadId={sp.t ?? null} />
    </div>
  );
}
