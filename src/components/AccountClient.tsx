"use client";

import { PushToggle } from "@/components/PushToggle";
import { DigestToggle } from "@/components/DigestToggle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark, CheckCircle2, Cpu, LayoutGrid, LogOut, Store } from "lucide-react";
import type { UserSession } from "@/lib/auth";
import { EmailOtpLogin } from "./EmailOtpLogin";
import { AccountPrivacy } from "./AccountPrivacy";
import { refreshSession } from "@/lib/use-session";
import { PostToCommunity } from "./PostToCommunity";

export function AccountClient({
  initialUser,
  designs = [],
}: {
  initialUser: UserSession | null;
  designs?: Array<{ id: string; imageUrl: string; prompt: string }>;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(initialUser);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    // ล้างหน้าที่เก็บไว้ดูออฟไลน์ + ยกเลิกแจ้งเตือนในเครื่องนี้ (เครื่องใช้ร่วมกันจะได้ไม่เห็นข้อมูลเดิม)
    try {
      for (const k of await caches.keys()) if (k.startsWith("cn-pages-")) await caches.delete(k);
      const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager.getSubscription();
      await sub?.unsubscribe();
    } catch {
      /* เบราว์เซอร์ไม่รองรับ */
    }
    setUser(null);
    setLoading(false);
    router.refresh();
    void refreshSession();
  }

  if (!user) {
    return (
      <div className="py-4">
        <EmailOtpLogin onSuccess={setUser} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
    <div className="card mx-auto max-w-xl space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-500">บัญชีของคุณ</p>
          <h2 className="font-display text-xl font-bold text-ink-950 break-words">{user.name}</h2>
          <p className="text-sm text-ink-700 break-all">{user.email}</p>
        </div>
        {user.emailVerified && (
          <span className="badge bg-ok-bg text-ok">
            <CheckCircle2 className="h-3.5 w-3.5" />
            ยืนยันอีเมลแล้ว
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
        <span>แจ้งเตือนข้อความจากร้าน และของที่ติดตามลดราคา</span>
        <PushToggle />
        <DigestToggle />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Link href="/rooms" className="btn btn-outline text-xs">
          <LayoutGrid className="h-4 w-4" />
          <span>สำรวจห้อง 3D</span>
        </Link>
        <Link href="/builder" className="btn btn-outline text-xs">
          <Cpu className="h-4 w-4" />
          <span>จัดสเปกคอม</span>
        </Link>
        <Link href="/partner" className="btn btn-outline text-xs">
          <Store className="h-4 w-4" />
          <span>หลังร้านพาร์ตเนอร์</span>
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/saved" className="btn btn-outline flex-1">
          <Bookmark className="h-4 w-4" />
          <span>รายการที่บันทึกไว้</span>
        </Link>
        <button type="button" onClick={handleLogout} disabled={loading} aria-busy={loading} className="btn btn-outline tap-target flex-1 cursor-pointer">
          <LogOut className="h-4 w-4" />
          <span>{loading ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}</span>
        </button>
      </div>
      <AccountPrivacy
        onDeleted={() => {
          setUser(null);
          router.refresh();
          void refreshSession();
        }}
      />
    </div>
    {designs.length > 0 && (
      <section className="mx-auto max-w-4xl space-y-3">
        <h2 className="font-display text-xl font-bold text-ink-950">ห้องที่ AI จัดให้ฉัน</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {designs.map((d) => (
            <div key={d.id} className="tile">
              <Link href={`/d/${d.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.imageUrl} alt={d.prompt} width={800} height={600} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
                <p className="line-clamp-2 px-3 pt-3 text-xs text-ink-700">{d.prompt || "ห้องของฉัน"}</p>
              </Link>
              <div className="p-3 pt-2">
                <PostToCommunity kind="room" designId={d.id} defaultTitle={(d.prompt || "ห้องของฉัน").slice(0, 80)} className="chip rounded-full text-xs" label="โพสต์" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )}
    </div>
  );
}
