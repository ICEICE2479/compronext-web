/** ความยินยอมคุกกี้ (เก็บในเบราว์เซอร์) — null = ยังไม่ได้เลือก */
const KEY = "compronext:consent";
export function getConsent(): { analytics: boolean; at: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
export function setConsent(analytics: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ analytics, at: new Date().toISOString() }));
  } catch {
    /* โหมดส่วนตัว */
  }
}
export const analyticsAllowed = () => getConsent()?.analytics === true;
