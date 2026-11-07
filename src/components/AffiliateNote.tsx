import Link from "next/link";

/** บอกผู้ใช้ว่าลิงก์ไปร้านอาจเป็นลิงก์พันธมิตร (ตามกฎโฆษณา/แพลตฟอร์ม) */
export function AffiliateNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-ink-600 ${className}`}>
      ลิงก์ไปร้านบางลิงก์เป็นลิงก์พันธมิตร เราอาจได้ค่าคอมมิชชันโดยราคาของคุณไม่เปลี่ยน ·{" "}
      <Link href="/terms#affiliate" className="underline-offset-2 hover:underline">
        รายละเอียด
      </Link>
    </p>
  );
}
