import type { Metadata } from "next";
import { Room3DStudioClient } from "@/components/design/Room3DStudioClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "จัดห้อง 3D (My Dream Setup) | ComproNext",
  description:
    "วาดแปลนห้อง กำหนดขนาดกว้าง ยาว สูง ประตู หน้าต่าง ทิศเข็มทิศ และแสงแดดตามเวลาจริงสไตล์ My Dream Setup พร้อมเปิดเต็มจอนั่งจัดวางสินค้า 2,100+ ชิ้นแบบ 3D",
};

export default function Room3DPage() {
  return (
    <div className="mx-auto w-full max-w-[1720px] px-2 py-2 sm:px-4 sm:py-3">
      <Room3DStudioClient />
    </div>
  );
}
