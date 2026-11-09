import type { Metadata } from "next";
import { Room3DStudioClient } from "@/components/design/Room3DStudioClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "จัดห้อง 3D & วาดแปลนห้อง | ComproNext",
  description:
    "วาดแปลนห้อง กำหนดขนาดกว้าง ยาว สูง ประตู หน้าต่าง ทิศทางแสงแดดตามเวลาจริง พร้อมเปิดเต็มจอนั่งจัดวางสินค้า 2,100+ ชิ้นแบบ 3D",
};

export default function Room3DPage() {
  return (
    <div className="container-page py-3 sm:py-4">
      <Room3DStudioClient />
    </div>
  );
}
