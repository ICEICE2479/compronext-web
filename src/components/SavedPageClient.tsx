"use client";

import { useMemo } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import type { RoomWithTotals } from "@/lib/types";
import { useWishlistRooms } from "@/lib/wishlist";
import { RoomCard } from "./RoomCard";
import { SavedBuildsList } from "./builder/SavedBuildsList";

export function SavedPageClient({ allRooms }: { allRooms: RoomWithTotals[] }) {
  const { ids, clear } = useWishlistRooms();
  const savedRooms = useMemo(() => {
    const set = new Set(ids);
    return allRooms.filter((r) => set.has(r.id));
  }, [allRooms, ids]);

  return (
    <div className="space-y-12">
      {/* Saved Rooms Section */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-ink-950">
              ห้องคอมพิวเตอร์ที่บันทึกไว้ ({savedRooms.length} ห้อง)
            </h2>
            <p className="text-xs text-ink-600">
              บันทึกไว้ในเบราว์เซอร์ของคุณทันทีโดยไม่ต้องสมัครสมาชิก
            </p>
          </div>
          {savedRooms.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="btn btn-outline btn-sm text-bad"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>ล้างรายการห้องที่บันทึกไว้ทั้งหมด</span>
            </button>
          )}
        </div>

        {savedRooms.length === 0 ? (
          <EmptyState
            icon={<Bookmark className="h-8 w-8" aria-hidden="true" />}
            title="ยังไม่มีห้องคอมพิวเตอร์ในรายการที่บันทึกไว้ (Wishlist)"
            description="กดปุ่มไอคอนคั่นหน้าบนการ์ดห้องตัวอย่างหรือหน้ารายละเอียดห้อง เพื่อเก็บไว้เปรียบเทียบภายหลัง"
            action={{ label: "สำรวจห้องคอมพิวเตอร์ทั้งหมด →", href: "/rooms" }}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {savedRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </section>

      {/* Saved PC Builds Section */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink-950">
            สเปกคอมพิวเตอร์ 3D ที่บันทึกไว้
          </h2>
          <p className="text-xs text-ink-500">
            รายการสเปกที่คุณจัดไว้ในหน้า Custom 3D PC Builder
          </p>
        </div>
        <SavedBuildsList />
      </section>
    </div>
  );
}
