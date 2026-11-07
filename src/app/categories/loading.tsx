import { Skel, TileGridSkel } from "@/components/skeleton/Skel";

/** โครงหน้ารายการสินค้า — แถบค้นหา ชิปหมวด แล้วตาราง */
export default function Loading() {
  return (
    <div className="container-page space-y-5 py-6" aria-busy="true" aria-label="กำลังโหลด">
      <Skel className="h-11 w-full rounded-xl" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <Skel key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <TileGridSkel count={12} />
    </div>
  );
}
