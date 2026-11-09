"use client";

import { useRouter } from "next/navigation";
import { Box } from "lucide-react";
import { toast } from "@/lib/toast";
import { addProductToSaved3DRoom } from "./studio-tools";

export function TryIn3DRoomButton({
  product,
  className,
}: {
  product: {
    id: string;
    name: string;
    category: string;
    price: number;
    imageUrl?: string | null;
    dimensions?: { width: number | null; depth: number | null; height: number | null; unit?: string } | null;
    colors?: string[];
  };
  className?: string;
}) {
  const router = useRouter();

  function handleTryIn3D() {
    const { room } = addProductToSaved3DRoom(product);
    toast(`📦 วาง "${product.name}" ลงในห้อง 3D (${(room.w / 100).toFixed(1)}×${(room.d / 100).toFixed(1)} ม.) ของคุณแล้ว!`);
    router.push("/room-3d?mode=studio");
  }

  return (
    <button
      type="button"
      onClick={handleTryIn3D}
      className={
        className ??
        "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-info/35 bg-info-bg/80 px-4 text-xs font-bold text-info transition-all hover:bg-info hover:text-white"
      }
      title="ส่งสินค้าชิ้นนี้พร้อมขนาดจริงไปลองวางในห้อง 3D ของคุณ"
    >
      <Box className="h-4 w-4 shrink-0" />
      <span>📦 ลองวางในห้อง 3D ของฉัน</span>
    </button>
  );
}
