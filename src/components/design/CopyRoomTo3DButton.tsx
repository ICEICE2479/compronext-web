"use client";

import { useRouter } from "next/navigation";
import { Box } from "lucide-react";
import { toast } from "@/lib/toast";
import { copyRoomSetToSaved3DRoom } from "./studio-tools";

export function CopyRoomTo3DButton({
  roomName,
  products,
  compact = false,
}: {
  roomName: string;
  products: Array<{
    id: string;
    name: string;
    category: string;
    price?: number;
    imageUrl?: string | null;
    dimensions?: { width: number | null; depth: number | null; height: number | null; unit?: string } | null;
    colors?: string[];
  }>;
  compact?: boolean;
}) {
  const router = useRouter();

  function handleCopy() {
    if (!products.length) return;
    const { room, items } = copyRoomSetToSaved3DRoom(products);
    toast(`✨ ก๊อปปี้เซ็ต "${roomName}" (${items.length} ชิ้น) ลงห้อง 3D ขนาด ${(room.w / 100).toFixed(1)}×${(room.d / 100).toFixed(1)} ม. แล้ว!`);
    router.push("/room-3d?mode=studio");
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        compact
          ? "inline-flex h-8 items-center gap-1 rounded-full border border-info/30 bg-info-bg/80 px-2.5 text-[11px] font-bold text-info transition-colors hover:bg-info hover:text-white"
          : "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-info/35 bg-info-bg/85 px-4 text-xs font-bold text-info transition-all hover:bg-info hover:text-white"
      }
      title="นำสินค้าทุกชิ้นในห้องตัวอย่างนี้ไปจัดวางลงในขนาดห้อง 3D ของคุณทันที"
    >
      <Box className={compact ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />
      <span>{compact ? "ลองวางในห้อง 3D" : "✨ ก๊อปปี้เซ็ตนี้เข้าห้อง 3D ของฉัน"}</span>
    </button>
  );
}
