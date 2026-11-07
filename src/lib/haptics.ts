/** สั่นสั้นๆ บนมือถือที่รองรับ (Android) — iOS Safari ไม่รองรับก็เงียบไป */
export function haptic(pattern: number | number[] = 12) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}
