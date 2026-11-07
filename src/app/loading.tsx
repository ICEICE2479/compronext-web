import { ProductTileSkeleton } from "@/components/ProductTileSkeleton";

/** โครงหน้าระหว่างโหลด (แสดงทันทีตอนเปลี่ยนหน้า) — ขนาดเท่าหน้าจริง กันหน้ากระโดด */
export default function Loading() {
  return (
    <div className="space-y-14 pb-16" aria-busy="true" aria-live="polite">
      <span className="sr-only">กำลังโหลด</span>

      {/* HERO */}
      <section className="container-page pt-6 sm:pt-10" aria-hidden>
        <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-5">
            <div className="skeleton h-6 w-24 rounded-full" />
            <div className="space-y-2">
              <div className="skeleton h-9 w-11/12 rounded-lg sm:h-12" />
              <div className="skeleton h-9 w-2/3 rounded-lg sm:h-12" />
            </div>
            <div className="max-w-xl space-y-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-4/5 rounded" />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="skeleton h-12 w-52 rounded-full" />
              <div className="skeleton h-12 w-40 rounded-full" />
            </div>
          </div>
          <div className="skeleton aspect-[4/3] w-full rounded-2xl lg:aspect-[5/4]" />
        </div>
      </section>

      {/* หมวดแบบไอคอน */}
      <section className="container-page" aria-hidden>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 p-2">
              <div className="skeleton h-12 w-12 rounded-2xl" />
              <div className="skeleton h-3 w-12 rounded" />
            </div>
          ))}
        </div>
      </section>

      {/* รายการสินค้า */}
      <section className="container-page space-y-4" aria-hidden>
        <div className="skeleton h-7 w-48 rounded-lg" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <ProductTileSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
