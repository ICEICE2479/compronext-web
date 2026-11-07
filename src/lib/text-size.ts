/** ตัวอักษรใหญ่ (ขยายทั้งหน้า ~12%) — จำไว้ในเครื่อง */
const KEY = "compronext_text";

export const TEXT_BOOT = `try{if(localStorage.getItem("${KEY}")==="lg")document.documentElement.dataset.text="lg"}catch(e){}`;

export function isLargeText(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.text === "lg";
}

export function setLargeText(on: boolean) {
  const el = document.documentElement;
  if (on) el.dataset.text = "lg";
  else delete el.dataset.text;
  try {
    if (on) localStorage.setItem(KEY, "lg");
    else localStorage.removeItem(KEY);
  } catch {
    /* โหมดส่วนตัว */
  }
  window.dispatchEvent(new Event("compronext-text-change"));
}

export function subscribeText(fn: () => void) {
  window.addEventListener("compronext-text-change", fn);
  return () => window.removeEventListener("compronext-text-change", fn);
}
