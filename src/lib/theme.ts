import { TEXT_BOOT } from "./text-size";

export type ComproThemeMode = "light" | "dark";

const KEY = "compronext_theme";

/** สคริปต์ตั้งธีมก่อนหน้าเว็บวาด (กันจอกะพริบขาวตอนเปิดในโหมดมืด) */
export const THEME_BOOT_SCRIPT = `(function(){${TEXT_BOOT};try{var t=localStorage.getItem("${KEY}");if(t&&t!=="light"){document.documentElement.setAttribute("data-theme","dark");document.documentElement.classList.add("dark")}}catch(e){}})();`;

function setDom(theme: ComproThemeMode) {
  const el = document.documentElement;
  if (theme === "dark") {
    el.setAttribute("data-theme", "dark");
    el.classList.add("dark");
  } else {
    el.removeAttribute("data-theme");
    el.classList.remove("dark");
  }
}

/** สลับธีมแบบจางนุ่มๆ (ใช้ View Transition ถ้าเบราว์เซอร์รองรับ) */
export function applyGlobalTheme(theme: ComproThemeMode, origin?: { x: number; y: number }) {
  if (typeof document === "undefined") return;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduce) {
    const vt = doc.startViewTransition(() => setDom(theme));
    // วงกลมขยายออกจากปุ่มที่กด (เหมือนแอปมือโปร)
    if (origin) {
      const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
      document.documentElement.dataset.vtCircle = "1";
      vt.ready
        .then(() =>
          document.documentElement.animate(
            { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
            { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" }
          ).finished
        )
        .catch(() => {})
        .finally(() => delete document.documentElement.dataset.vtCircle);
    }
  } else setDom(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new CustomEvent("compronext-theme-change", { detail: theme }));
}

/** อ่านธีมที่บันทึกไว้ (ธีมเก่า navy/cyber นับเป็นมืด) */
export function getStoredTheme(): ComproThemeMode {
  try {
    const saved = localStorage.getItem(KEY);
    return saved && saved !== "light" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener("compronext-theme-change", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("compronext-theme-change", onChange);
    window.removeEventListener("storage", onChange);
  };
}
