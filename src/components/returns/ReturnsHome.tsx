"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, LifeBuoy, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/use-session";
import { EmailOtpLogin } from "@/components/EmailOtpLogin";
import EmptyState from "@/components/EmptyState";
import Spinner from "@/components/Spinner";
import type { SupportCaseRecord } from "@/lib/returns";
import { CaseTracker, fmtWhen, StatusChip } from "./CaseBits";

/** หน้ารวมของลูกค้า: ปุ่มแจ้งปัญหา + ค้นเลขเคส + รายการเคสของฉัน */
export function ReturnsHome() {
  const { user } = useSession();
  const router = useRouter();
  const [cases, setCases] = useState<SupportCaseRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch("/api/returns", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && (d.ok ? setCases(d.cases) : setFailed(true)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user)
    return (
      <div className="mx-auto max-w-md">
        <p className="mb-3 text-center text-sm text-ink-600">เข้าสู่ระบบก่อน เพื่อให้ร้านติดต่อกลับและให้คุณติดตามเคสได้</p>
        <EmailOtpLogin />
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) router.push(`/returns/${encodeURIComponent(code.trim().toUpperCase())}`);
          }}
          className="flex gap-2"
        >
          <label className="relative flex-1">
            <span className="sr-only">เลขเคส</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="มีเลขเคสอยู่แล้ว เช่น RE-7K3M9Q" className="input h-11 w-full pl-9" />
          </label>
          <button type="submit" className="btn btn-outline h-11 rounded-full px-4">
            ดูสถานะ
          </button>
        </form>
        <Link href="/returns/new" className="btn btn-primary h-11 rounded-full px-5">
          <Plus className="h-4 w-4" /> แจ้งปัญหาใหม่
        </Link>
      </div>

      <h2 className="font-display text-lg font-bold text-ink-950">เคสของฉัน</h2>
      {failed ? (
        <EmptyState tone="error" title="โหลดเคสไม่สำเร็จ" description="เช็กอินเทอร์เน็ตแล้วลองรีเฟรชหน้า" />
      ) : !cases ? (
        <div className="flex justify-center py-10">
          <Spinner size={22} />
        </div>
      ) : cases.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy size={26} />}
          title="ยังไม่มีเคส"
          description="ถ้าสินค้าที่ซื้อจากร้านพาร์ตเนอร์มีปัญหา กดแจ้งได้เลย ร้านจะเห็นเรื่องทันที"
          action={{ label: "แจ้งปัญหาใหม่", href: "/returns/new" }}
        />
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Link href={`/returns/${c.code}`} className="card block space-y-3 p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-500">
                      <span className="font-mono font-semibold text-ink-700">{c.code}</span> · {c.storeName} · {fmtWhen(c.createdAt)}
                    </p>
                    <p className="truncate font-semibold text-ink-950">{c.productName}</p>
                  </div>
                  <StatusChip status={c.status} />
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-400" />
                </div>
                <CaseTracker status={c.status} compact />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
