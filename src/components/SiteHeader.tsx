"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Box,
  ChevronDown,
  Cpu,
  Heart,
  Home,
  LayoutGrid,
  Menu,
  Monitor,
  Moon,
  Scale,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Sun,
  User,
  UserCheck,
  X,
  MessageCircle,
  Users,
  LifeBuoy,
  ShieldCheck,
} from "lucide-react";
import { useWishlistRooms } from "@/lib/wishlist";
import { useCart } from "@/lib/cart-store";
import { openCartDrawer } from "@/lib/toast";
import { useCompareProducts } from "@/lib/compare-store";
import type { CatalogCategoryRecord, SiteSettingsRecord } from "@/lib/types";
import {
  applyGlobalTheme,
  getStoredTheme,
  subscribeTheme,
  type ComproThemeMode,
} from "@/lib/theme";
import { EmailOtpLogin } from "./EmailOtpLogin";
import { CategoryAccordion } from "./CategoryAccordion";
import { CartSync } from "./CartSync";
import { SavedSync } from "./SavedSync";
import { SearchSuggest } from "./SearchSuggest";
import { useSession } from "@/lib/use-session";
import { MessagesIcon } from "./chat/MessagesIcon";
import { useFocusTrap } from "./useFocusTrap";
import { isLargeText, setLargeText, subscribeText } from "@/lib/text-size";

const NAV_ITEMS = [
  { href: "/rooms", label: "ไอเดียห้อง", icon: LayoutGrid },
  { href: "/design", label: "AI จัดห้อง", icon: Sparkles },
  { href: "/room-3d", label: "จัดห้อง 3D", icon: Box },
  { href: "/builder", label: "จัดสเปกคอม 3D", icon: Cpu },
  { href: "/monitors", label: "เลือกจอ", icon: Monitor },
  { href: "/compare", label: "เปรียบเทียบสเปก", icon: Scale },
  { href: "/community", label: "ชุมชน", icon: Users },
];

export function SiteHeader({
  siteSettings,
}: {
  siteSettings?: SiteSettingsRecord;
  categories?: CatalogCategoryRecord[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin } = useSession();
  const { count: wishlistCount } = useWishlistRooms();
  const { count: cartCount } = useCart();
  const { count: compareCount } = useCompareProducts();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const catRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const authRef = useRef<HTMLDivElement>(null);
  const themeMode = useSyncExternalStore(subscribeTheme, getStoredTheme, () => "light" as ComproThemeMode);

  // ปิดเมนูหมวดเมื่อคลิกข้างนอก หรือกด Esc
  useEffect(() => {
    if (!catOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!catRef.current?.contains(e.target as Node)) setCatOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCatOpen(false);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [catOpen]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const closeAll = useCallback(() => {
    setDrawerOpen(false);
    setCatOpen(false);
  }, []);
  const closeAuth = useCallback(() => setAuthModalOpen(false), []);
  useFocusTrap(drawerRef, drawerOpen, closeAll);
  useFocusTrap(authRef, authModalOpen, closeAuth);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    closeAll();
    router.push(q ? `/categories?q=${encodeURIComponent(q)}` : "/categories");
  }

  const searchForm = (
    <form onSubmit={handleSearchSubmit} role="search" className="relative w-full">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="ค้นหาสินค้า แบรนด์ หรือไอเดียห้อง"
        aria-label="ค้นหา"
        className="input min-h-11 rounded-full bg-ink-100/60 dark:bg-ink-800/50 border border-ink-200/50 pl-10 focus:bg-surface/90 focus:border-info/60 transition-all"
        autoComplete="off"
      />
      <SearchSuggest query={searchQuery} onPick={() => setSearchQuery("")} />
    </form>
  );

  return (
    <>
      {user && <CartSync />}
      {user && <SavedSync />}
      <header className="site-header sticky top-0 z-40 border-b border-ink-200/50 bg-surface/65 backdrop-blur-xl backdrop-saturate-150 shadow-xs transition-colors">
        {/* แถวบน: โลโก้ / ค้นหา / ไอคอน */}
        <div className="container-page flex h-16 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="icon-btn tap-target -ml-2 border-transparent px-0 lg:hidden"
            aria-label="เปิดเมนู"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link href="/" className="group flex min-h-11 min-w-0 shrink-0 items-center gap-2.5" aria-label="ComproNext หน้าแรก">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-105" aria-hidden="true">
              <img
                src="/compronext-logo.png"
                alt="ComproNext Logo"
                className="h-full w-full object-contain"
                width={36}
                height={36}
              />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-ink-950" aria-hidden="true">
              Compro<span className="text-info">Next</span>
            </span>
          </Link>

          <div className="mx-auto hidden w-full max-w-xl md:block">{searchForm}</div>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 md:ml-0">
            <TextSizeToggle className="hidden sm:inline-flex" />
            <ThemeToggle mode={themeMode} className="mr-1 hidden sm:inline-flex" />
            <Link href="/compare" className="icon-btn relative hidden border-transparent lg:inline-flex" aria-label={`เปรียบเทียบ ${compareCount} รายการ`}>
              <Scale className="h-5 w-5" aria-hidden="true" />
              {compareCount > 0 && <span className="icon-badge" aria-hidden="true">{compareCount}</span>}
            </Link>
            {user && <MessagesIcon />}
            <Link href="/saved" className="icon-btn relative hidden border-transparent sm:inline-flex" aria-label={`รายการที่ชอบ ${wishlistCount} รายการ`}>
              <Heart className="h-5 w-5" aria-hidden="true" />
              {wishlistCount > 0 && <span className="icon-badge" aria-hidden="true">{wishlistCount}</span>}
            </Link>
            <Link
              href="/cart"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || pathname === "/cart") return;
                e.preventDefault();
                openCartDrawer();
              }}
              className="icon-btn tap-target relative border-transparent"
              aria-label={`ตะกร้า ${cartCount} ชิ้น`}
            >
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              {cartCount > 0 && <span className="icon-badge" aria-hidden="true">{cartCount > 99 ? "99+" : cartCount}</span>}
            </Link>
            {isAdmin && (
              <Link href="/admin" className="icon-btn hidden border-info/40 bg-info-bg px-2.5 text-xs font-bold text-info lg:inline-flex" title="ระบบผู้ดูแลหลังบ้าน">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>หลังบ้าน</span>
              </Link>
            )}
            {user ? (
              <Link href="/account" className="icon-btn hidden lg:inline-flex" aria-label={`บัญชี ${user.name}`} title={user.name}>
                <UserCheck className="h-5 w-5" aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="icon-btn icon-btn-primary ml-1 hidden lg:inline-flex"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm font-semibold">เข้าสู่ระบบ</span>
              </button>
            )}
          </div>
        </div>

        {/* แถวล่าง (คอม): หมวดสินค้า + เมนูหลัก */}
        <nav aria-label="เมนูหลัก" className="hidden border-t border-ink-200/35 lg:block">
          <div className="container-page flex items-center gap-1 py-1.5">
            <Link
              href="/"
              aria-current={isActive("/") ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                isActive("/") ? "bg-info text-white shadow-sm" : "text-ink-700 hover:bg-ink-100 hover:text-ink-950"
              }`}
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              หน้าหลัก
            </Link>
            <div ref={catRef} className="relative">
              <button
                type="button"
                onClick={() => setCatOpen((v) => !v)}
                aria-expanded={catOpen}
                aria-controls="header-category-menu"
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                  catOpen || isActive("/categories") ? "bg-info text-white shadow-sm" : "text-ink-700 hover:bg-ink-100 hover:text-ink-950"
                }`}
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                หมวดสินค้า
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${catOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              <div
                id="header-category-menu"
                data-open={catOpen ? "" : undefined}
                aria-hidden={!catOpen}
                inert={!catOpen}
                className="menu-drop thin-scroll absolute left-0 top-full z-50 mt-2 max-h-[min(70vh,520px)] w-72 overflow-y-auto overscroll-contain rounded-2xl border border-ink-200 bg-surface p-2 shadow-pop"
              >
                  <CategoryAccordion onNavigate={closeAll} />
                  <Link href="/categories" onClick={closeAll} className="mt-1 block border-t border-ink-100 px-2 pb-1 pt-2.5 text-sm font-semibold text-info">
                    ดูสินค้าทั้งหมด →
                  </Link>
              </div>
            </div>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                  isActive(href) ? "bg-info text-white shadow-sm" : "text-ink-700 hover:bg-ink-100 hover:text-ink-950"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </nav>

        {/* ค้นหา (มือถือ) */}
        {!pathname.startsWith("/categories") && <div className="container-page pb-3 md:hidden">{searchForm}</div>}
      </header>

      {/* เมนูเต็ม (มือถือ) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนู">
          <button type="button" aria-label="ปิดเมนู" tabIndex={-1} className="absolute inset-0 bg-ink-950/50" onClick={closeAll} />
          <div ref={drawerRef} className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto overscroll-contain bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-pop">
            <div className="mb-5 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-ink-950">เมนู</span>
              <button type="button" className="icon-btn tap-target -mr-2 border-transparent" aria-label="ปิดเมนู" onClick={closeAll}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <ul className="mb-5 grid grid-cols-2 gap-2">
              {[{ href: "/", label: "หน้าหลัก", icon: Home }, { href: "/categories", label: "สินค้าทั้งหมด", icon: ShoppingBag }, ...NAV_ITEMS, { href: "/stores", label: "ร้านค้า & รีวิว", icon: Store }, { href: "/partner", label: "หลังร้านพาร์ตเนอร์", icon: Store }, ...(isAdmin ? [{ href: "/admin", label: "ผู้ดูแลหลังบ้าน", icon: ShieldCheck }] : []), { href: "/messages", label: "ข้อความ", icon: MessageCircle }, { href: "/saved", label: "ที่บันทึกไว้", icon: Heart }, { href: "/returns", label: "แจ้งปัญหา / ติดตามเคส", icon: LifeBuoy }].map(
                ({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={closeAll}
                      aria-current={isActive(href) ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        isActive(href) ? "border-info bg-info text-white" : "border-ink-200 text-ink-800 hover:border-info hover:text-info"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">{label}</span>
                    </Link>
                  </li>
                )
              )}
            </ul>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-500">หมวดสินค้า</p>
            <CategoryAccordion onNavigate={closeAll} />
            <div className="mt-6 flex min-h-12 items-center justify-between rounded-xl bg-ink-50 px-3 py-2">
              <span className="text-sm text-ink-700">โหมดมืด</span>
              <ThemeToggle mode={themeMode} />
            </div>
            <div className="mt-2 flex min-h-12 items-center justify-between rounded-xl bg-ink-50 px-3 py-2">
              <span className="text-sm text-ink-700">ตัวอักษรใหญ่</span>
              <TextSizeToggle />
            </div>
          </div>
        </div>
      )}

      {/* แถบเมนูล่างบนมือถือ */}
      <nav
        aria-label="เมนูมือถือ"
        className="bottom-nav"
        onClickCapture={(e) => {
          // แตะแท็บของหน้าที่อยู่ = เลื่อนกลับขึ้นบนนุ่มๆ (เหมือนแอป)
          const link = (e.target as HTMLElement).closest("a");
          if (link?.getAttribute("aria-current") === "page" && window.scrollY > 0) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
      >
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          <Home className="h-5 w-5" />
          หน้าหลัก
        </Link>
        <Link href="/categories" aria-current={isActive("/categories") ? "page" : undefined}>
          <Store className="h-5 w-5" />
          สินค้า
        </Link>
        <Link href="/design" aria-current={isActive("/design") ? "page" : undefined}>
          <span className="ai-fab">
            <Sparkles className="h-5 w-5" />
          </span>
          AI จัดห้อง
        </Link>
        <Link href="/builder" aria-current={isActive("/builder") ? "page" : undefined}>
          <Cpu className="h-5 w-5" />
          สเปกคอม 3D
        </Link>
        {user ? (
          <Link href="/account" aria-current={isActive("/account") ? "page" : undefined}>
            <UserCheck className="h-5 w-5" />
            บัญชี
          </Link>
        ) : (
          <Link href="/login" aria-current={isActive("/login") ? "page" : undefined}>
            <User className="h-5 w-5" />
            เข้าสู่ระบบ
          </Link>
        )}
      </nav>

      {authModalOpen && (
        <div
          ref={authRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="เข้าสู่ระบบหรือสมัครสมาชิก"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAuthModalOpen(false);
          }}
        >
          <EmailOtpLogin onClose={() => setAuthModalOpen(false)} />
        </div>
      )}
    </>
  );
}

/** สวิตช์เปิด/ปิดโหมดมืด — ปุ่มกลมเลื่อนแบบสปริง ไอคอนพระอาทิตย์/พระจันทร์หมุนสลับ หน้าเว็บเปลี่ยนสีเป็นวงกลมขยายจากปุ่ม */
/** ปุ่มตัวอักษรใหญ่ (กดสลับ) */
function TextSizeToggle({ className = "" }: { className?: string }) {
  const large = useSyncExternalStore(subscribeText, isLargeText, () => false);
  return (
    <button
      type="button"
      aria-pressed={large}
      aria-label="ตัวอักษรใหญ่"
      title={large ? "ตัวอักษรขนาดปกติ" : "ขยายตัวอักษร"}
      onClick={() => setLargeText(!large)}
      className={`text-size-btn icon-btn border-transparent font-display font-bold ${className}`}
    >
      <span className="text-xs">ก</span>
      <span className="text-base leading-none">ก</span>
    </button>
  );
}

function ThemeToggle({ mode, className = "" }: { mode: ComproThemeMode; className?: string }) {
  const dark = mode === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="โหมดมืด"
      title={dark ? "ปิดโหมดมืด" : "เปิดโหมดมืด"}
      onClick={(e) => {
        const knob = e.currentTarget.querySelector(".theme-knob")?.getBoundingClientRect() ?? e.currentTarget.getBoundingClientRect();
        applyGlobalTheme(dark ? "light" : "dark", { x: knob.left + knob.width / 2, y: knob.top + knob.height / 2 });
      }}
      className={`theme-switch ${className}`}
      data-on={dark ? "" : undefined}
    >
      <span className="theme-stars" aria-hidden="true" />
      <span className="theme-knob" aria-hidden="true">
        <Sun className="theme-sun h-3.5 w-3.5" />
        <Moon className="theme-moon h-3.5 w-3.5" />
      </span>
    </button>
  );
}
