import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { RetryButton } from "./RetryButton";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "ออฟไลน์",
  description: "ขณะนี้ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่อีกครั้ง",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <WifiOff className="h-14 w-14 text-ink-500" aria-hidden="true" />
      <h1 className="font-display text-2xl font-bold text-ink-950">ไม่มีอินเทอร์เน็ต</h1>
      <p className="max-w-sm text-sm text-ink-600">ตะกร้าและรายการที่ชอบยังเก็บไว้ในเครื่อง ต่อเน็ตแล้วกดลองใหม่ได้เลย</p>
      <RetryButton />
    </div>
  );
}
