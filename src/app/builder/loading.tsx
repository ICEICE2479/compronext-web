import { Skel } from "@/components/skeleton/Skel";

/** โครงหน้าจัดสเปก — ฉาก 3D กับรายการชิ้นส่วน */
export default function Loading() {
  return (
    <div className="container-page grid gap-6 py-6 lg:grid-cols-[1fr_380px]" aria-busy="true" aria-label="กำลังโหลด">
      <div className="space-y-3">
        <Skel className="h-8 w-56 rounded-lg" />
        <Skel className="aspect-[4/3] w-full rounded-3xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skel key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
