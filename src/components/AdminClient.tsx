"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  Eye,
  EyeOff,
  FolderKanban,
  GitBranch,
  Globe,
  HardDriveUpload,
  History,
  KeyRound,
  ShieldCheck,
  LogOut,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import type {
  CatalogCategoryRecord,
  Product,
  ProductCategory,
  ProductStatus,
  Room,
  RoomStatus,
  RoomStyle,
  SiteArticleRecord,
  SiteBannerRecord,
  SiteSettingsRecord,
} from "@/lib/types";
import {
  PRODUCT_STATUSES,
  ROOM_STATUSES,
  ROOM_STYLES,
} from "@/lib/types";
import type { RuntimeDatabase } from "@/lib/data/store";
import type { StackServiceStatus } from "@/lib/serverless-stack";
import type { UploadedFileRecord } from "@/app/api/upload/route";
import {
  CATEGORY_LABELS,
  formatTHB,
  PRODUCT_STATUS_LABELS,
  ROOM_STATUS_LABELS,
  STYLE_LABELS,
} from "@/lib/format";
import { calculateRoomTotals } from "@/lib/pricing";
import { searchLink } from "@/lib/links";
import { ProductVisual } from "@/components/ProductVisual";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { AccountSecurityPanel } from "@/components/admin/AccountSecurityPanel";
import type { AdminRole } from "@/lib/admin/types";

type AdminTab =
  | "serverless"
  | "users"
  | "partners"
  | "media"
  | "products"
  | "rooms"
  | "content"
  | "categories"
  | "settings"
  | "csv"
  | "security"
  | "admins"
  | "audit";

export function AdminClient({
  initialDb,
  stackServices,
  initialFiles,
  currentAdmin,
}: {
  initialDb: RuntimeDatabase;
  stackServices: StackServiceStatus[];
  initialFiles: UploadedFileRecord[];
  currentAdmin: { username: string; role: AdminRole };
}) {
  const router = useRouter();
  const [db, setDb] = useState<RuntimeDatabase>(initialDb);
  const [activeTab, setActiveTab] = useState<AdminTab>("products");
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [csvInput, setCsvInput] = useState("");

  // Content, Categories & Site Settings state
  const [editingBanner, setEditingBanner] = useState<SiteBannerRecord | null>(null);
  const [editingArticle, setEditingArticle] = useState<SiteArticleRecord | null>(null);
  const [editingCategory, setEditingCategory] = useState<CatalogCategoryRecord | null>(null);
  const [siteSettingsForm, setSiteSettingsForm] = useState<SiteSettingsRecord>(
    initialDb.siteSettings
  );

  // R2 Media Upload State
  const [files, setFiles] = useState<UploadedFileRecord[]>(initialFiles);
  const [uploading, setUploading] = useState(false);

  // Resend Email Test State
  const [testEmailTo, setTestEmailTo] = useState("customer@compronext.app");
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);

  const products = db.products;
  const rooms = db.rooms;
  const users = db.users;
  const categories = db.categories || [];
  const banners = db.banners || [];
  const articles = db.articles || [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const filteredProducts = products.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.id.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.platform.toLowerCase().includes(q)
    );
  });

  const redirectToLogin = useCallback(() => {
    router.push("/admin/login");
    router.refresh();
  }, [router]);

  // Keep-alive: ping at most every 5 min while the user is active; 401 -> login.
  const lastActivityRef = useRef(0);
  const lastPingRef = useRef(0);
  useEffect(() => {
    lastActivityRef.current = Date.now();
    lastPingRef.current = Date.now();
    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));
    const FIVE_MIN = 5 * 60 * 1000;
    const timer = window.setInterval(async () => {
      const now = Date.now();
      if (document.hidden) return;
      if (now - lastActivityRef.current > FIVE_MIN) return;
      if (now - lastPingRef.current < FIVE_MIN) return;
      lastPingRef.current = now;
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "session" }),
        });
        if (res.status === 401) redirectToLogin();
      } catch {
        // network blip: retry next cycle
      }
    }, 30 * 1000);
    return () => {
      window.clearInterval(timer);
      events.forEach((ev) => window.removeEventListener(ev, markActive));
    };
  }, [redirectToLogin]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
  }

  async function handleLogout() {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    redirectToLogin();
  }

  async function postAdminAction(payload: Record<string, unknown>, successMsg: string) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      redirectToLogin();
      return false;
    }
    const data = await res.json();
    if (data.ok && data.db) {
      setDb(data.db);
      setSiteSettingsForm(data.db.siteSettings);
      flash(successMsg);
      if (data.emailResult?.previewHtml) {
        setEmailPreviewHtml(data.emailResult.previewHtml);
      }
      router.refresh();
      return true;
    }
    flash(data.error || "ดำเนินการไม่สำเร็จ");
    return false;
  }

  async function saveProduct(p: Product) {
    const ok = await postAdminAction(
      { action: "upsert_product", product: p },
      `บันทึกสินค้า "${p.name}" ลงฐานข้อมูลและอัปเดตหน้าเว็บหลักเรียบร้อย`
    );
    if (ok) setEditingProduct(null);
  }

  async function deleteProduct(id: string) {
    await postAdminAction(
      { action: "delete_product", productId: id },
      `ลบสินค้ารหัส ${id} ออกจากเว็บไซต์เรียบร้อย`
    );
  }

  async function handleProductImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.ok && data.file?.url) {
      setFiles(data.files);
      setEditingProduct({ ...editingProduct, imageUrl: data.file.url });
      flash(`อัปโหลดรูปภาพสินค้า "${data.file.fileName}" สำเร็จ!`);
    } else {
      flash(data.error || "อัปโหลดรูปภาพไม่สำเร็จ");
    }
  }

  async function saveRoom(r: Room) {
    const ok = await postAdminAction(
      { action: "upsert_room", room: r },
      `บันทึกห้องตัวอย่าง "${r.name}" เรียบร้อย`
    );
    if (ok) setEditingRoom(null);
  }

  async function deleteRoom(id: string) {
    await postAdminAction({ action: "delete_room", roomId: id }, `ลบห้องรหัส ${id} แล้ว`);
  }

  async function saveCategory(c: CatalogCategoryRecord) {
    const ok = await postAdminAction(
      { action: "upsert_category", category: c },
      `บันทึกหมวดหมู่ "${c.labelTh}" เรียบร้อย`
    );
    if (ok) setEditingCategory(null);
  }

  async function deleteCategory(id: string) {
    await postAdminAction(
      { action: "delete_category", categoryId: id },
      `ลบหมวดหมู่รหัส ${id} แล้ว`
    );
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const temp = sorted[index];
    sorted[index] = sorted[targetIdx];
    sorted[targetIdx] = temp;
    await postAdminAction(
      { action: "reorder_categories", categoriesOrder: sorted.map((c) => c.id) },
      "จัดเรียงลำดับหมวดหมู่เรียบร้อย"
    );
  }

  async function saveBanner(b: SiteBannerRecord) {
    const ok = await postAdminAction(
      { action: "upsert_banner", banner: b },
      `บันทึกแบนเนอร์โปรโมชั่น "${b.title}" เรียบร้อย`
    );
    if (ok) setEditingBanner(null);
  }

  async function deleteBanner(id: string) {
    await postAdminAction(
      { action: "delete_banner", bannerId: id },
      `ลบแบนเนอร์รหัส ${id} แล้ว`
    );
  }

  async function saveArticle(a: SiteArticleRecord) {
    const ok = await postAdminAction(
      { action: "upsert_article", article: a },
      `บันทึกบทความ "${a.title}" (${a.status === "published" ? "เผยแพร่" : "ฉบับร่าง"}) เรียบร้อย`
    );
    if (ok) setEditingArticle(null);
  }

  async function deleteArticle(id: string) {
    await postAdminAction(
      { action: "delete_article", articleId: id },
      `ลบบทความรหัส ${id} แล้ว`
    );
  }

  async function handleSaveSiteSettings(e: React.FormEvent) {
    e.preventDefault();
    await postAdminAction(
      { action: "update_site_settings", siteSettings: siteSettingsForm },
      "บันทึกข้อมูลเว็บไซต์ โลโก้ ข้อมูลติดต่อ SEO และ Social Links เรียบร้อย"
    );
  }

  async function handleImportCsv(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import_csv", csvText: csvInput }),
    });
    if (res.status === 401) {
      redirectToLogin();
      return;
    }
    const data = await res.json();
    if (data.ok) {
      setDb(data.db);
      setCsvInput("");
      flash(`นำเข้าสินค้าจาก CSV สำเร็จ ${data.importedCount} รายการ`);
      router.refresh();
    } else {
      flash(data.error || "นำเข้า CSV ไม่สำเร็จ");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.ok) {
      setFiles(data.files);
      flash(`อัปโหลดไฟล์ "${data.file.fileName}" ขึ้น Cloudflare R2 / UploadThing สำเร็จ!`);
    } else {
      flash(data.error || "อัปโหลดไม่สำเร็จ");
    }
  }

  async function handleSendCustomEmail(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: testEmailTo,
        subject: "แจ้งเตือนสถานะคำสั่งซื้อและใบเสนอราคาจากระบบหลังบ้าน ComproNext",
        roomOrBuildTitle: "ทดสอบส่งอีเมลจาก ComproNext",
        totalPriceFormatted: "฿72,880",
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setEmailPreviewHtml(data.previewHtml);
      flash(`ส่งอีเมลผ่าน Resend API ไปยัง ${testEmailTo} สำเร็จ (${data.messageId})`);
    }
  }

  const publishedProductsCount = products.filter((p) => p.published !== false).length;

  function getCategoryLabel(catSlug: string): string {
    const fromDb = categories.find((c) => c.slug === catSlug);
    if (fromDb) return fromDb.labelTh;
    return (CATEGORY_LABELS as Record<string, string>)[catSlug] || catSlug;
  }

  return (
    <div className="space-y-6 animate-reveal">
      {/* KPI SUMMARY STRIP */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4 border-l-4 border-l-info">
          <span className="text-xs font-semibold text-ink-500 block">
            1. ฐานข้อมูล & สินค้าออนไลน์
          </span>
          <span className="font-display text-lg font-bold text-ink-950 mt-0.5 block">
            {publishedProductsCount} / {products.length} สินค้า
          </span>
          <span className="text-xs text-ok font-semibold">
            {categories.length} หมวด · {rooms.length} ห้องตัวอย่าง
          </span>
        </div>

        <div className="card p-4 border-l-4 border-l-ok">
          <span className="text-xs font-semibold text-ink-500 block">
            3. เนื้อหา บทความ & แบนเนอร์
          </span>
          <span className="font-display text-lg font-bold text-ink-950 mt-0.5 block">
            {articles.length} บทความ · {banners.length} แบนเนอร์
          </span>
          <span className="text-xs text-ok font-semibold">
            ซิงก์ขึ้นหน้าแรกอัตโนมัติ
          </span>
        </div>

        <div className="card p-4 border-l-4 border-l-info">
          <span className="text-xs font-semibold text-ink-500 block">
            สมาชิก (ล็อกอินด้วยอีเมล)
          </span>
          <span className="font-display text-lg font-bold text-ink-950 mt-0.5 block">
            {users.length} บัญชี
          </span>
        </div>

        <div className="card p-4 border-l-4 border-l-info">
          <span className="text-xs font-semibold text-ink-500 block">
            5. ไฟล์มีเดีย (Cloudflare R2)
          </span>
          <span className="font-display text-lg font-bold text-ink-950 mt-0.5 block">
            {files.length} ไฟล์ในถังเก็บ
          </span>
          <span className="text-xs text-ok font-semibold">Zero Egress Fee 0฿</span>
        </div>
      </div>

      {/* ADMIN NAVIGATION TABS */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`btn btn-sm ${
              activeTab === "products" ? "btn-primary" : "btn-outline"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>1. จัดการสินค้า ({products.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("content")}
            className={`btn btn-sm ${
              activeTab === "content" ? "btn-primary" : "btn-outline"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>2. เนื้อหา บทความ & แบนเนอร์</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`btn btn-sm ${
              activeTab === "categories" ? "btn-primary" : "btn-outline"
            }`}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            <span>3. จัดการหมวดหมู่ ({categories.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`btn btn-sm ${
              activeTab === "settings" ? "btn-primary" : "btn-outline"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>4. ข้อมูลเว็บไซต์ & SEO</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rooms")}
            className={`btn btn-sm ${
              activeTab === "rooms" ? "btn-primary" : "btn-outline"
            }`}
          >
            <span>5. ห้องตัวอย่าง ({rooms.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`btn btn-sm ${
              activeTab === "users" ? "btn-primary" : "btn-outline"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>6. สมาชิก ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("partners")}
            className={`btn btn-sm ${activeTab === "partners" ? "btn-primary" : "btn-outline"}`}
          >
            <span>ร้านพาร์ตเนอร์ ({(db.partners ?? []).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("media")}
            className={`btn btn-sm ${
              activeTab === "media" ? "btn-primary" : "btn-outline"
            }`}
          >
            <HardDriveUpload className="h-3.5 w-3.5" />
            <span>7. อัปโหลดไฟล์ & อีเมล</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("csv")}
            className={`btn btn-sm ${
              activeTab === "csv" ? "btn-primary" : "btn-outline"
            }`}
          >
            <span>8. นำเข้า/ส่งออก CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("serverless")}
            className={`btn btn-sm ${
              activeTab === "serverless" ? "btn-primary" : "btn-outline"
            }`}
          >
            <Cloud className="h-3.5 w-3.5" />
            <span>10. Serverless Stack</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`btn btn-sm ${activeTab === "security" ? "btn-primary" : "btn-outline"}`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>ความปลอดภัย</span>
          </button>
          {currentAdmin.role === "superadmin" && (
            <button
              type="button"
              onClick={() => setActiveTab("admins")}
              className={`btn btn-sm ${activeTab === "admins" ? "btn-primary" : "btn-outline"}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>แอดมิน</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`btn btn-sm ${activeTab === "audit" ? "btn-primary" : "btn-outline"}`}
          >
            <History className="h-3.5 w-3.5" />
            <span>บันทึกกิจกรรม</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentAdmin.role === "superadmin" && (
            <button
              type="button"
              onClick={() =>
                postAdminAction(
                  { action: "reset_seed" },
                  "รีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้นเรียบร้อย"
                )
              }
              className="btn btn-outline btn-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>รีเซ็ตค่าเริ่มต้น</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-outline btn-sm text-bad"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" className="rounded-[var(--radius-sm)] border border-info/30 bg-info-bg px-4 py-3 text-sm font-semibold text-info flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="tap-target text-xs underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* =====================================================================
         TAB 1: PRODUCTS MANAGEMENT (CRUD + IMAGE UPLOAD + PUBLISH/FEATURED)
         ===================================================================== */}
      {activeTab === "products" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-ink-950">
                ตารางจัดการสินค้าทั้งหมด ({products.length} รายการ)
              </h2>
              <p className="text-xs text-ink-500">
                เพิ่ม แก้ไข ลบ อัปโหลดรูปภาพ ปรับราคา ลิงก์ร้านค้า และเปิด/ปิดการเผยแพร่สินค้าบนหน้าเว็บหลักแบบเรียลไทม์
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-400" />
                <input
                  type="search"
                  aria-label="ค้นหาสินค้า"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="ค้นหาชื่อสินค้า รหัส หรือหมวด..."
                  className="input pl-8 py-1.5 text-xs w-full sm:w-60"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingProduct({
                    id: `prod-${Date.now()}`,
                    name: "สินค้าใหม่",
                    description: "รายละเอียดสินค้าและคุณสมบัติเด่น",
                    imageUrl: null,
                    price: 1990,
                    currency: "THB",
                    buyUrl: searchLink("Shopee", "อุปกรณ์จัดโต๊ะคอม"),
                    storeName: "Shopee",
                    platform: "Shopee",
                    category: "desk",
                    colors: ["black"],
                    materials: ["steel"],
                    dimensions: { width: 120, depth: 60, height: 75, unit: "cm" },
                    ports: [],
                    specs: {},
                    placement: "desk",
                    status: "available",
                    priceUpdatedAt: new Date().toISOString().slice(0, 10),
                    isSample: false,
                    published: true,
                    featured: false,
                  })
                }
                className="btn btn-primary btn-sm"
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มสินค้าใหม่</span>
              </button>
            </div>
          </div>

          {editingProduct && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveProduct(editingProduct);
              }}
              className="card p-6 space-y-4 border-2 border-info"
            >
              <div className="flex items-center justify-between border-b border-ink-200 pb-3">
                <h3 className="font-display text-lg font-bold text-ink-950">
                  แก้ไข / เพิ่มสินค้า: {editingProduct.id}
                </h3>
                <div className="flex items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5 font-semibold text-ink-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.published !== false}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          published: e.target.checked,
                        })
                      }
                    />
                    <span>เผยแพร่บนเว็บไซต์หลัก (Published)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 font-semibold text-info cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.featured)}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          featured: e.target.checked,
                        })
                      }
                    />
                    <span>ตั้งเป็นสินค้าแนะนำ (Featured)</span>
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label">ชื่อสินค้า</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, name: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">หมวดสินค้า</label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        category: e.target.value as ProductCategory,
                      })
                    }
                    className="select"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.labelTh} ({c.labelEn})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ราคา (THB)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editingProduct.price}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        price: Number(e.target.value),
                        priceUpdatedAt: new Date().toISOString().slice(0, 10),
                      })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">สถานะสต็อกสินค้า</label>
                  <select
                    value={editingProduct.status}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        status: e.target.value as ProductStatus,
                      })
                    }
                    className="select"
                  >
                    {PRODUCT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {PRODUCT_STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ลิงก์ซื้อสินค้า (Affiliate URL)</label>
                  <input
                    type="url"
                    required
                    value={editingProduct.buyUrl}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, buyUrl: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">แพลตฟอร์มร้านค้าพาร์ทเนอร์</label>
                  <input
                    type="text"
                    value={editingProduct.platform}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        platform: e.target.value,
                        storeName: e.target.value,
                      })
                    }
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">รายละเอียดสินค้า</label>
                  <input
                    type="text"
                    value={editingProduct.description}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        description: e.target.value,
                      })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">รูปภาพสินค้า (URL หรืออัปโหลดไฟล์)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingProduct.imageUrl ?? ""}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          imageUrl: e.target.value.trim() || null,
                        })
                      }
                      placeholder="/uploads/... หรือ https://..."
                      className="input flex-1"
                    />
                    <label className="btn btn-outline btn-sm shrink-0 cursor-pointer">
                      <Upload className="h-3.5 w-3.5 text-info" />
                      <span>{uploading ? "..." : "อัปโหลด"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProductImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm">
                  <Save className="h-3.5 w-3.5" />
                  <span>บันทึกสินค้าขึ้นเว็บไซต์หลัก</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="btn btn-outline btn-sm"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          )}

          <div className="card overflow-x-auto">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อสินค้า</th>
                  <th>หมวด</th>
                  <th>ราคา (THB)</th>
                  <th>สถานะสต็อก</th>
                  <th>การเผยแพร่</th>
                  <th>แนะนำ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isPublished = p.published !== false;
                  return (
                    <tr key={p.id} className={!isPublished ? "opacity-60 bg-ink-50" : ""}>
                      <td className="font-mono text-xs text-ink-500">{p.id}</td>
                      <td className="font-medium text-ink-950">
                        <div className="flex items-center gap-2">
                          <ProductVisual
                            name={p.name}
                            category={p.category}
                            imageUrl={p.imageUrl}
                            size="xs"
                          />
                          <div className="min-w-0">
                            <span className="truncate max-w-[220px] block font-semibold">
                              {p.name}
                            </span>
                            <span className="text-xs text-ink-500">{p.platform}</span>
                          </div>
                        </div>
                      </td>
                      <td>{getCategoryLabel(p.category)}</td>
                      <td>
                        <input
                          type="number"
                          key={`${p.id}-${p.price}`}
                          defaultValue={p.price}
                          aria-label={`ราคาของ ${p.name}`}
                          onBlur={(e) => {
                            const nextPrice = Number(e.target.value);
                            if (Number.isFinite(nextPrice) && nextPrice !== p.price) {
                              saveProduct({
                                ...p,
                                price: Math.round(nextPrice),
                                priceUpdatedAt: new Date().toISOString().slice(0, 10),
                              });
                            }
                          }}
                          className="input w-28 py-1 text-xs font-semibold"
                        />
                      </td>
                      <td>
                        <select
                          value={p.status}
                          aria-label={`สถานะของ ${p.name}`}
                          onChange={(e) =>
                            saveProduct({
                              ...p,
                              status: e.target.value as ProductStatus,
                              priceUpdatedAt: new Date().toISOString().slice(0, 10),
                            })
                          }
                          className="select w-32 py-1 text-xs"
                        >
                          {PRODUCT_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {PRODUCT_STATUS_LABELS[st]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            postAdminAction(
                              {
                                action: "toggle_product_publish",
                                productId: p.id,
                                published: !isPublished,
                              },
                              `${!isPublished ? "เปิดเผยแพร่" : "ซ่อน"}สินค้า "${p.name}" เรียบร้อย`
                            )
                          }
                          className={`badge cursor-pointer ${
                            isPublished ? "bg-ok-bg text-ok" : "bg-ink-200 text-ink-700"
                          }`}
                        >
                          {isPublished ? (
                            <>
                              <Eye className="h-3 w-3" />
                              <span>เผยแพร่</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" />
                              <span>ซ่อนไว้</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            postAdminAction(
                              {
                                action: "toggle_product_featured",
                                productId: p.id,
                                featured: !p.featured,
                              },
                              `อัปเดตสถานะสินค้าแนะนำของ "${p.name}" เรียบร้อย`
                            )
                          }
                          className={`badge cursor-pointer ${
                            p.featured ? "bg-info text-white" : "bg-ink-100 text-ink-600"
                          }`}
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>{p.featured ? "แนะนำ" : "ทั่วไป"}</span>
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="btn btn-outline btn-sm"
                          >
                            แก้ไขเต็ม
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProduct(p.id)}
                            className="btn btn-outline btn-sm text-bad"
                            aria-label={`ลบ ${p.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
         TAB 2: CONTENT MANAGEMENT (HERO, BANNERS, ARTICLES/NEWS)
         ===================================================================== */}
      {activeTab === "content" && (
        <div className="space-y-8">
          {/* 2A. Homepage Hero & Flagship Product Content */}
          <form onSubmit={handleSaveSiteSettings} className="card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-200 pb-3">
              <div>
                <span className="eyebrow">HOMEPAGE HERO & FEATURED CONTENT</span>
                <h2 className="font-display text-lg font-bold text-ink-950">
                  จัดการเนื้อหาหน้าแรก (Hero Section & สินค้าแนะนำหลัก)
                </h2>
              </div>
              <button type="submit" className="btn btn-primary btn-sm">
                <Save className="h-3.5 w-3.5" />
                <span>บันทึกเนื้อหาหน้าแรก</span>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">ป้ายข้อความด้านบน (Hero Badge)</label>
                <input
                  type="text"
                  value={siteSettingsForm.heroBadge}
                  onChange={(e) =>
                    setSiteSettingsForm({ ...siteSettingsForm, heroBadge: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">คำเน้นสีฟ้าในหัวข้อหลัก (Hero Highlight)</label>
                <input
                  type="text"
                  value={siteSettingsForm.heroHighlight}
                  onChange={(e) =>
                    setSiteSettingsForm({
                      ...siteSettingsForm,
                      heroHighlight: e.target.value,
                    })
                  }
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">หัวข้อหลักหน้าแรก (Hero Headline)</label>
                <input
                  type="text"
                  value={siteSettingsForm.heroTitle}
                  onChange={(e) =>
                    setSiteSettingsForm({ ...siteSettingsForm, heroTitle: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">คำอธิบายหน้าแรก (Hero Description)</label>
                <textarea
                  rows={2}
                  value={siteSettingsForm.heroDescription}
                  onChange={(e) =>
                    setSiteSettingsForm({
                      ...siteSettingsForm,
                      heroDescription: e.target.value,
                    })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">สินค้าแนะนำหลักบนหน้าแรก (Flagship Product)</label>
                <select
                  value={siteSettingsForm.featuredProductId}
                  onChange={(e) =>
                    setSiteSettingsForm({
                      ...siteSettingsForm,
                      featuredProductId: e.target.value,
                    })
                  }
                  className="select"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatTHB(p.price)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">ห้องตัวอย่างเด่นบนหน้าแรก (Featured Room)</label>
                <select
                  value={siteSettingsForm.featuredRoomSlug}
                  onChange={(e) =>
                    setSiteSettingsForm({
                      ...siteSettingsForm,
                      featuredRoomSlug: e.target.value,
                    })
                  }
                  className="select"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.slug}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </form>

          {/* 2B. Banners / Partner Campaigns Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="eyebrow">PARTNER BANNERS & CAMPAIGNS</span>
                <h2 className="font-display text-lg font-bold text-ink-950">
                  จัดการแบนเนอร์และแคมเปญโปรโมชั่นหน้าแรก ({banners.length} รายการ)
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingBanner({
                    id: `deal-${Date.now()}`,
                    partner: "Shopee & Lazada Official",
                    badge: "โปรโมชั่นพิเศษ",
                    title: "หัวข้อแคมเปญโปรโมชั่นใหม่",
                    detail: "รายละเอียดแคมเปญส่วนลดร้านค้าพาร์ทเนอร์",
                    href: "/categories",
                    imageUrl: "/rooms/room-01-a.jpg",
                    active: true,
                    order: banners.length + 1,
                  })
                }
                className="btn btn-primary btn-sm"
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มแบนเนอร์ใหม่</span>
              </button>
            </div>

            {editingBanner && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveBanner(editingBanner);
                }}
                className="card p-5 space-y-4 border-2 border-info"
              >
                <h3 className="font-display text-base font-bold text-ink-950">
                  แก้ไข / เพิ่มแบนเนอร์: {editingBanner.id}
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">ชื่อพาร์ทเนอร์</label>
                    <input
                      type="text"
                      required
                      value={editingBanner.partner}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, partner: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">ป้ายโปรโมชั่น (Badge)</label>
                    <input
                      type="text"
                      required
                      value={editingBanner.badge}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, badge: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">ลิงก์ปลายทาง (URL)</label>
                    <input
                      type="text"
                      required
                      value={editingBanner.href}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, href: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">หัวข้อแบนเนอร์</label>
                    <input
                      type="text"
                      required
                      value={editingBanner.title}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, title: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingBanner.active}
                        onChange={(e) =>
                          setEditingBanner({ ...editingBanner, active: e.target.checked })
                        }
                      />
                      <span>เปิดแสดงผลบนหน้าแรก</span>
                    </label>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="label">รายละเอียดแบนเนอร์</label>
                    <input
                      type="text"
                      value={editingBanner.detail}
                      onChange={(e) =>
                        setEditingBanner({ ...editingBanner, detail: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm">
                    <Save className="h-3.5 w-3.5" />
                    <span>บันทึกแบนเนอร์</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBanner(null)}
                    className="btn btn-outline btn-sm"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className={`card p-4 flex flex-col justify-between gap-3 ${
                    !b.active ? "opacity-60 bg-ink-50" : ""
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-info">{b.partner}</span>
                      <span className="badge bg-info text-white">{b.badge}</span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-ink-950">{b.title}</h3>
                    <p className="text-xs text-ink-600">{b.detail}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-ink-100 pt-2.5 text-xs">
                    <span className={b.active ? "text-ok font-semibold" : "text-ink-500"}>
                      {b.active ? "● แสดงบนหน้าแรก" : "○ ซ่อนไว้"}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingBanner(b)}
                        className="btn btn-outline btn-sm"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteBanner(b.id)}
                        className="btn btn-outline btn-sm text-bad"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2C. News & Articles Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="eyebrow">KNOWLEDGE BASE & NEWS ARTICLES</span>
                <h2 className="font-display text-lg font-bold text-ink-950">
                  จัดการข่าวสารและบทความคู่มือจัดโต๊ะคอม ({articles.length} บทความ)
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingArticle({
                    id: `art-${Date.now()}`,
                    issue: `GUIDE 0${articles.length + 1} // TECH & WORKSPACE`,
                    title: "หัวข้อบทความหรือข่าวสารใหม่",
                    summary: "สรุปเนื้อหาสำคัญของบทความที่จะแสดงบนหน้าแรก",
                    content: "เนื้อหาบทความฉบับเต็ม...",
                    readTime: "อ่าน 4 นาที",
                    href: "/builder",
                    status: "published",
                    createdAt: new Date().toISOString().slice(0, 10),
                    updatedAt: new Date().toISOString().slice(0, 10),
                  })
                }
                className="btn btn-primary btn-sm"
              >
                <Plus className="h-4 w-4" />
                <span>เขียนบทความ/ข่าวสารใหม่</span>
              </button>
            </div>

            {editingArticle && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveArticle(editingArticle);
                }}
                className="card p-5 space-y-4 border-2 border-info"
              >
                <h3 className="font-display text-base font-bold text-ink-950">
                  แก้ไข / เขียนบทความ: {editingArticle.id}
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">หมวด/ลำดับบทความ (Issue Tag)</label>
                    <input
                      type="text"
                      required
                      value={editingArticle.issue}
                      onChange={(e) =>
                        setEditingArticle({ ...editingArticle, issue: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">เวลาในการอ่าน</label>
                    <input
                      type="text"
                      value={editingArticle.readTime}
                      onChange={(e) =>
                        setEditingArticle({ ...editingArticle, readTime: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">สถานะบทความ (เผยแพร่ / ฉบับร่าง)</label>
                    <select
                      value={editingArticle.status}
                      onChange={(e) =>
                        setEditingArticle({
                          ...editingArticle,
                          status: e.target.value as "published" | "draft",
                        })
                      }
                      className="select"
                    >
                      <option value="published">เผยแพร่ทันที (Published)</option>
                      <option value="draft">บันทึกฉบับร่าง (Draft)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">ชื่อบทความ / ข่าวสาร</label>
                    <input
                      type="text"
                      required
                      value={editingArticle.title}
                      onChange={(e) =>
                        setEditingArticle({ ...editingArticle, title: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">ลิงก์หน้าที่เกี่ยวข้อง (Href)</label>
                    <input
                      type="text"
                      value={editingArticle.href}
                      onChange={(e) =>
                        setEditingArticle({ ...editingArticle, href: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="label">เนื้อหาสรุปย่อ (Summary แสดงบนหน้าแรก)</label>
                    <textarea
                      rows={2}
                      required
                      value={editingArticle.summary}
                      onChange={(e) =>
                        setEditingArticle({ ...editingArticle, summary: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="label">เนื้อหาฉบับเต็ม</label>
                    <textarea
                      rows={4}
                      value={editingArticle.content}
                      onChange={(e) =>
                        setEditingArticle({ ...editingArticle, content: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm">
                    <Save className="h-3.5 w-3.5" />
                    <span>บันทึกบทความ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingArticle(null)}
                    className="btn btn-outline btn-sm"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {articles.map((art) => (
                <div
                  key={art.id}
                  className={`card p-5 flex flex-col justify-between gap-3 ${
                    art.status === "draft" ? "opacity-65 bg-ink-50" : ""
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-info">{art.issue}</span>
                      <span
                        className={`badge ${
                          art.status === "published"
                            ? "bg-ok-bg text-ok"
                            : "bg-warn-bg text-warn"
                        }`}
                      >
                        {art.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-ink-950">
                      {art.title}
                    </h3>
                    <p className="text-xs text-ink-600">{art.summary}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-ink-100 pt-3 text-xs">
                    <span className="text-ink-500">
                      {art.readTime} · อัปเดต {art.updatedAt}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingArticle(art)}
                        className="btn btn-outline btn-sm"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteArticle(art.id)}
                        className="btn btn-outline btn-sm text-bad"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
         TAB 3: CATEGORIES MANAGEMENT (ADD, EDIT, DELETE, REORDER)
         ===================================================================== */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-ink-950">
                จัดการหมวดหมู่สินค้า ({categories.length} หมวด)
              </h2>
              <p className="text-xs text-ink-500">
                เพิ่ม ลบ แก้ไขชื่อหมวดหมู่ และจัดเรียงลำดับการแสดงผลบนหน้าแคตตาล็อกและหน้าแรก
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setEditingCategory({
                  id: `cat-${Date.now()}`,
                  slug: `custom_${Date.now().toString().slice(-4)}`,
                  labelTh: "หมวดหมู่สินค้าใหม่",
                  labelEn: "NEW CATEGORY",
                  macroSlug: "furniture",
                  order: categories.length + 1,
                  active: true,
                  isCustom: true,
                })
              }
              className="btn btn-primary btn-sm"
            >
              <Plus className="h-4 w-4" />
              <span>เพิ่มหมวดหมู่ใหม่</span>
            </button>
          </div>

          {editingCategory && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveCategory(editingCategory);
              }}
              className="card p-5 space-y-4 border-2 border-info"
            >
              <h3 className="font-display text-base font-bold text-ink-950">
                แก้ไข / เพิ่มหมวดหมู่: {editingCategory.slug}
              </h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="label">รหัสหมวด (Slug)</label>
                  <input
                    type="text"
                    required
                    value={editingCategory.slug}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, slug: e.target.value })
                    }
                    className="input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="label">ชื่อหมวดภาษาไทย</label>
                  <input
                    type="text"
                    required
                    value={editingCategory.labelTh}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, labelTh: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">ชื่อหมวดภาษาอังกฤษ</label>
                  <input
                    type="text"
                    required
                    value={editingCategory.labelEn}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, labelEn: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">กลุ่มหมวดใหญ่ (5 หมวดหลัก)</label>
                  <select
                    value={editingCategory.macroSlug}
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        macroSlug: e.target.value as CatalogCategoryRecord["macroSlug"],
                      })
                    }
                    className="select"
                  >
                    <option value="computers">01 // Computers & Workstations</option>
                    <option value="components">02 // PC Components & Hardware</option>
                    <option value="monitors">03 // Monitors & Displays</option>
                    <option value="gaming-gear">04 // Gaming Gear & Creator Audio</option>
                    <option value="furniture">05 // Ergonomic Desk & Furniture</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCategory.active}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, active: e.target.checked })
                    }
                  />
                  <span>เปิดใช้งานหมวดหมู่นี้บนหน้าเว็บ</span>
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm">
                    <Save className="h-3.5 w-3.5" />
                    <span>บันทึกหมวดหมู่</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="btn btn-outline btn-sm"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="card overflow-x-auto">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>รหัส (Slug)</th>
                  <th>ชื่อหมวดหมู่ (TH / EN)</th>
                  <th>กลุ่มหมวดหลัก</th>
                  <th>จำนวนสินค้า</th>
                  <th>สถานะ</th>
                  <th>จัดเรียง / จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {[...categories]
                  .sort((a, b) => a.order - b.order)
                  .map((cat, idx) => {
                    const prodCount = products.filter((p) => p.category === cat.slug).length;
                    return (
                      <tr key={cat.id}>
                        <td className="font-mono text-xs font-bold text-ink-500">
                          #{idx + 1}
                        </td>
                        <td className="font-mono text-xs text-info">{cat.slug}</td>
                        <td>
                          <span className="font-bold text-ink-950 block">{cat.labelTh}</span>
                          <span className="text-xs text-ink-500">{cat.labelEn}</span>
                        </td>
                        <td className="text-xs font-semibold text-ink-700">{cat.macroSlug}</td>
                        <td>{prodCount} รายการ</td>
                        <td>
                          <span
                            className={`badge ${
                              cat.active
                                ? "bg-ok-bg text-ok"
                                : "bg-ink-200 text-ink-700"
                            }`}
                          >
                            {cat.active ? "เปิดใช้งาน" : "ซ่อน"}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveCategory(idx, -1)}
                              disabled={idx === 0}
                              className="btn btn-outline btn-sm px-2"
                              title="เลื่อนขึ้น"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCategory(idx, 1)}
                              disabled={idx === categories.length - 1}
                              className="btn btn-outline btn-sm px-2"
                              title="เลื่อนลง"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategory(cat)}
                              className="btn btn-outline btn-sm"
                            >
                              แก้ไข
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCategory(cat.id)}
                              className="btn btn-outline btn-sm text-bad"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
         TAB 4: SITE SETTINGS, LOGO, CONTACT, SEO & SOCIAL MEDIA LINKS
         ===================================================================== */}
      {activeTab === "settings" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSaveSiteSettings}
            className="card p-6 space-y-5 lg:col-span-8"
          >
            <div className="flex items-center justify-between border-b border-ink-200 pb-3">
              <div>
                <span className="eyebrow">SITE CONFIGURATION & SEO</span>
                <h2 className="font-display text-lg font-bold text-ink-950">
                  ตั้งค่าข้อมูลเว็บไซต์ โลโก้ ข้อมูลติดต่อ SEO และ Social Media
                </h2>
              </div>
              <button type="submit" className="btn btn-primary btn-sm">
                <Save className="h-3.5 w-3.5" />
                <span>บันทึกการตั้งค่าเว็บไซต์</span>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">ชื่อเว็บไซต์ (Site Name)</label>
                <input
                  type="text"
                  value={siteSettingsForm.siteName}
                  onChange={(e) =>
                    setSiteSettingsForm({ ...siteSettingsForm, siteName: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">ตัวย่อโลโก้ (Logo Monogram)</label>
                <input
                  type="text"
                  value={siteSettingsForm.logoText}
                  onChange={(e) =>
                    setSiteSettingsForm({ ...siteSettingsForm, logoText: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">สโลแกนใต้โลโก้ (Tagline)</label>
                <input
                  type="text"
                  value={siteSettingsForm.tagline}
                  onChange={(e) =>
                    setSiteSettingsForm({ ...siteSettingsForm, tagline: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">คำอธิบายเว็บไซต์ใน Footer</label>
                <textarea
                  rows={2}
                  value={siteSettingsForm.description}
                  onChange={(e) =>
                    setSiteSettingsForm({ ...siteSettingsForm, description: e.target.value })
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="label">อีเมลติดต่อ (Contact Email)</label>
                <input
                  type="email"
                  value={siteSettingsForm.contactEmail}
                  onChange={(e) =>
                    setSiteSettingsForm({
                      ...siteSettingsForm,
                      contactEmail: e.target.value,
                    })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">เบอร์โทรศัพท์ติดต่อ</label>
                <input
                  type="text"
                  value={siteSettingsForm.contactPhone}
                  onChange={(e) =>
                    setSiteSettingsForm({
                      ...siteSettingsForm,
                      contactPhone: e.target.value,
                    })
                  }
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">ที่อยู่สำนักงาน / ข้อมูลติดต่อ</label>
                <input
                  type="text"
                  value={siteSettingsForm.contactAddress}
                  onChange={(e) =>
                    setSiteSettingsForm({
                      ...siteSettingsForm,
                      contactAddress: e.target.value,
                    })
                  }
                  className="input"
                />
              </div>

              <div className="sm:col-span-2 border-t border-ink-200 pt-3">
                <span className="eyebrow block mb-2">SEO META TAGS</span>
                <div className="grid gap-3">
                  <div>
                    <label className="label">SEO Title</label>
                    <input
                      type="text"
                      value={siteSettingsForm.seoTitle}
                      onChange={(e) =>
                        setSiteSettingsForm({
                          ...siteSettingsForm,
                          seoTitle: e.target.value,
                        })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">SEO Meta Description</label>
                    <textarea
                      rows={2}
                      value={siteSettingsForm.seoDescription}
                      onChange={(e) =>
                        setSiteSettingsForm({
                          ...siteSettingsForm,
                          seoDescription: e.target.value,
                        })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">SEO Keywords (คั่นด้วยจุลภาค)</label>
                    <input
                      type="text"
                      value={siteSettingsForm.seoKeywords}
                      onChange={(e) =>
                        setSiteSettingsForm({
                          ...siteSettingsForm,
                          seoKeywords: e.target.value,
                        })
                      }
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 border-t border-ink-200 pt-3">
                <span className="eyebrow block mb-2">SOCIAL MEDIA LINKS</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Facebook URL</label>
                    <input
                      type="url"
                      value={siteSettingsForm.socialLinks.facebook}
                      onChange={(e) =>
                        setSiteSettingsForm({
                          ...siteSettingsForm,
                          socialLinks: {
                            ...siteSettingsForm.socialLinks,
                            facebook: e.target.value,
                          },
                        })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">LINE Official URL</label>
                    <input
                      type="url"
                      value={siteSettingsForm.socialLinks.line}
                      onChange={(e) =>
                        setSiteSettingsForm({
                          ...siteSettingsForm,
                          socialLinks: {
                            ...siteSettingsForm.socialLinks,
                            line: e.target.value,
                          },
                        })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">YouTube URL</label>
                    <input
                      type="url"
                      value={siteSettingsForm.socialLinks.youtube}
                      onChange={(e) =>
                        setSiteSettingsForm({
                          ...siteSettingsForm,
                          socialLinks: {
                            ...siteSettingsForm.socialLinks,
                            youtube: e.target.value,
                          },
                        })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">TikTok URL</label>
                    <input
                      type="url"
                      value={siteSettingsForm.socialLinks.tiktok}
                      onChange={(e) =>
                        setSiteSettingsForm({
                          ...siteSettingsForm,
                          socialLinks: {
                            ...siteSettingsForm.socialLinks,
                            tiktok: e.target.value,
                          },
                        })
                      }
                      className="input"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>

        </div>
      )}

      {activeTab === "security" && (
        <AccountSecurityPanel currentAdmin={currentAdmin} onSessionEnded={redirectToLogin} />
      )}
      {activeTab === "admins" && currentAdmin.role === "superadmin" && (
        <AdminUsersPanel currentAdmin={currentAdmin} onSessionEnded={redirectToLogin} />
      )}
      {activeTab === "audit" && <AuditLogPanel onSessionEnded={redirectToLogin} />}

      {/* =====================================================================
         TAB 5: ROOMS MANAGEMENT (CRUD)
         ===================================================================== */}
      {activeTab === "rooms" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-ink-950">
              จัดการห้องคอมพิวเตอร์ตัวอย่าง (สถานะ แบบร่าง / เผยแพร่ / ซ่อน และสินค้าในห้อง)
            </h2>
            <button
              type="button"
              onClick={() =>
                setEditingRoom({
                  id: `r-${Date.now()}`,
                  slug: `custom-room-${Date.now()}`,
                  name: "ห้องคอมพิวเตอร์ตัวอย่างใหม่",
                  description: "คำอธิบายห้องตัวอย่าง",
                  images: ["/rooms/room-01-a.jpg"],
                  style: "gaming",
                  colors: ["black"],
                  materials: ["steel", "wood"],
                  lighting: ["rgb"],
                  items: products.slice(0, 3).map((p) => ({ productId: p.id, quantity: 1 })),
                  status: "draft",
                  featured: false,
                  popularity: 100,
                  createdAt: new Date().toISOString().slice(0, 10),
                  updatedAt: new Date().toISOString().slice(0, 10),
                  isSample: false,
                })
              }
              className="btn btn-primary btn-sm"
            >
              <Plus className="h-4 w-4" />
              <span>สร้างห้องตัวอย่างใหม่</span>
            </button>
          </div>

          {editingRoom && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveRoom(editingRoom);
              }}
              className="card p-6 space-y-4 border-2 border-info"
            >
              <h3 className="font-display text-lg font-bold text-ink-950">
                แก้ไขห้อง: {editingRoom.name}
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label">ชื่อห้อง</label>
                  <input
                    type="text"
                    required
                    value={editingRoom.name}
                    onChange={(e) =>
                      setEditingRoom({ ...editingRoom, name: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Slug (URL)</label>
                  <input
                    type="text"
                    required
                    value={editingRoom.slug}
                    onChange={(e) =>
                      setEditingRoom({ ...editingRoom, slug: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">สไตล์ห้อง</label>
                  <select
                    value={editingRoom.style}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        style: e.target.value as RoomStyle,
                      })
                    }
                    className="select"
                  >
                    {ROOM_STYLES.map((st) => (
                      <option key={st} value={st}>
                        {STYLE_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">สถานะการเผยแพร่</label>
                  <select
                    value={editingRoom.status}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        status: e.target.value as RoomStatus,
                      })
                    }
                    className="select"
                  >
                    {ROOM_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {ROOM_STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">คำอธิบายห้อง</label>
                  <input
                    type="text"
                    value={editingRoom.description}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        description: e.target.value,
                      })
                    }
                    className="input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="label">
                  รหัสสินค้าในห้อง (รูปแบบ productId:quantity คั่นด้วยจุลภาค)
                </label>
                <input
                  type="text"
                  value={editingRoom.items
                    .map((it) => `${it.productId}:${it.quantity}`)
                    .join(", ")}
                  onChange={(e) => {
                    const nextItems = e.target.value
                      .split(",")
                      .map((part) => part.trim())
                      .filter(Boolean)
                      .map((pair) => {
                        const [pid, q] = pair.split(":");
                        return {
                          productId: pid.trim(),
                          quantity: Math.max(1, Number(q) || 1),
                        };
                      });
                    setEditingRoom({ ...editingRoom, items: nextItems });
                  }}
                  className="input font-mono text-xs"
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm">
                  <Save className="h-3.5 w-3.5" />
                  <span>บันทึกห้อง</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="btn btn-outline btn-sm"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          )}

          <div className="card overflow-x-auto">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อห้อง</th>
                  <th>สไตล์</th>
                  <th>จำนวนสินค้า</th>
                  <th>ราคารวมพร้อมซื้อ (คำนวณสด)</th>
                  <th>สถานะห้อง</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => {
                  const totals = calculateRoomTotals(r, productMap);
                  return (
                    <tr key={r.id}>
                      <td className="font-mono text-xs text-ink-500">{r.id}</td>
                      <td className="font-medium text-ink-950">{r.name}</td>
                      <td>{STYLE_LABELS[r.style]}</td>
                      <td>{totals.itemCount} ชิ้น</td>
                      <td className="font-display font-bold text-info">
                        {formatTHB(totals.availableTotal)}
                      </td>
                      <td>
                        <select
                          value={r.status}
                          aria-label={`สถานะของห้อง ${r.name}`}
                          onChange={(e) =>
                            saveRoom({
                              ...r,
                              status: e.target.value as RoomStatus,
                            })
                          }
                          className="select w-28 py-1 text-xs"
                        >
                          {ROOM_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {ROOM_STATUS_LABELS[st]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingRoom(r)}
                            className="btn btn-outline btn-sm"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRoom(r.id)}
                            className="btn btn-outline btn-sm text-bad"
                            aria-label={`ลบห้อง ${r.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "partners" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink-950">ร้านพาร์ตเนอร์</h2>
            <p className="text-xs text-ink-500">
              เพิ่มอีเมลร้านค้า แล้วให้ร้านล็อกอินด้วยอีเมลนั้นที่ /partner เพื่อลงสินค้า รูป และไฟล์ 3D เอง
            </p>
          </div>
          <form
            className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const fd = new FormData(f);
              const ok = await postAdminAction(
                { action: "upsert_partner", partner: { name: fd.get("name"), email: fd.get("email"), active: true } },
                "เพิ่มร้านพาร์ตเนอร์แล้ว"
              );
              if (ok) f.reset();
            }}
          >
            <input name="name" required placeholder="ชื่อร้าน" className="input" />
            <input name="email" type="email" required placeholder="อีเมลร้าน" className="input" />
            <button type="submit" className="btn btn-primary">เพิ่มร้าน</button>
          </form>
          <div className="card overflow-x-auto">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>ร้าน</th>
                  <th>อีเมล</th>
                  <th>สินค้า</th>
                  <th>สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(db.partners ?? []).map((pt) => (
                  <tr key={pt.id}>
                    <td className="font-bold text-ink-950">{pt.name}</td>
                    <td className="text-xs">{pt.email}</td>
                    <td className="text-xs">{products.filter((p) => p.partnerId === pt.id).length}</td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-sm ${pt.active ? "btn-primary" : "btn-outline"}`}
                        onClick={() =>
                          postAdminAction(
                            { action: "upsert_partner", partner: { ...pt, active: !pt.active } },
                            pt.active ? "ปิดร้านแล้ว" : "เปิดร้านแล้ว"
                          )
                        }
                      >
                        {pt.active ? "เปิดอยู่" : "ปิดอยู่"}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          if (window.confirm(`ลบร้าน ${pt.name}? สินค้าของร้านจะถูกซ่อน`)) {
                            postAdminAction({ action: "delete_partner", partnerId: pt.id }, "ลบร้านแล้ว");
                          }
                        }}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink-950">สมาชิก</h2>
            <p className="text-xs text-ink-500">บัญชีที่ล็อกอินด้วยรหัส OTP ทางอีเมล</p>
          </div>

          <div className="card overflow-x-auto">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>อีเมล</th>
                  <th>วันที่สมัคร</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-bold text-ink-950">{u.fullName}</td>
                    <td className="text-xs text-ink-700">{u.email}</td>
                    <td className="text-xs text-ink-500">{u.joinedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
         TAB 8: CLOUDFLARE R2 MEDIA STORAGE & RESEND TRANSACTIONAL EMAIL
         ===================================================================== */}
      {activeTab === "media" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Cloudflare R2 / UploadThing Manager */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-200 pb-3">
              <div>
                <span className="eyebrow">CLOUDFLARE R2 / UPLOADTHING</span>
                <h3 className="font-display text-lg font-bold text-ink-950">
                  คลังไฟล์รูปภาพห้องคอมและสินค้า (Zero Egress Fee)
                </h3>
              </div>
              <span className="badge bg-ok-bg text-ok">{files.length} ไฟล์</span>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-[6px] border-2 border-dashed border-info/50 bg-info-bg/30 p-5 text-center transition-colors hover:border-info hover:bg-info-bg/60">
              <HardDriveUpload className="h-6 w-6 text-info" />
              <span className="mt-2 text-xs font-bold text-ink-950">
                {uploading
                  ? "กำลังอัปโหลดขึ้นถังเก็บไฟล์ R2..."
                  : "คลิกเลือกไฟล์รูปภาพจากเครื่องเพื่ออัปโหลดขึ้น R2 / UploadThing"}
              </span>
              <span className="text-xs text-ink-500">
                รองรับ JPG, PNG, WEBP ขนาดไม่เกิน 8 MB (คัดลอก URL ไปใส่ในสินค้าหรือห้องตัวอย่างได้ทันที)
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="overflow-hidden rounded-[5px] border border-ink-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={f.fileName}
                    width={160}
                    height={96}
                    loading="lazy"
                    decoding="async"
                    className="h-24 w-full object-cover"
                  />
                  <div className="p-2 text-xs space-y-0.5">
                    <p className="font-semibold text-ink-950 truncate">{f.fileName}</p>
                    <p className="font-mono text-xs text-info truncate">{f.url}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resend Email Console */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-200 pb-3">
              <div>
                <span className="eyebrow">RESEND + REACT EMAIL</span>
                <h3 className="font-display text-lg font-bold text-ink-950">
                  ระบบส่งอีเมลแจ้งเตือนลูกค้า / ใบเสนอราคา / ใบเสร็จ
                </h3>
              </div>
              <span className="badge bg-info text-white">Transactional API</span>
            </div>

            <form onSubmit={handleSendCustomEmail} className="space-y-3">
              <div>
                <label className="label">ส่งอีเมลทดสอบไปยังผู้รับ</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    className="input flex-1"
                  />
                  <button type="submit" className="btn btn-primary shrink-0">
                    <Send className="h-4 w-4" />
                    <span>ส่งอีเมลทันที</span>
                  </button>
                </div>
              </div>
            </form>

            {emailPreviewHtml ? (
              <div className="space-y-2 rounded-[6px] border border-ink-200 bg-ink-50 p-3">
                <span className="text-xs font-bold text-ok block">
                  ตัวอย่างอีเมลที่เรนเดอร์และส่งออกจากระบบล่าสุด:
                </span>
                <div
                  className="rounded-[4px] bg-white p-3 text-xs overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: emailPreviewHtml }}
                />
              </div>
            ) : (
              <div className="rounded-[6px] border border-ink-200 bg-ink-50 p-4 text-xs text-ink-600">
                กดปุ่ม &ldquo;ส่งอีเมลทันที&rdquo; ด้านบน หรือกด &ldquo;ส่งใบเสร็จทางอีเมล&rdquo; ในแท็บคำสั่งซื้อเพื่อดูตัวอย่างอีเมลที่สร้างด้วย React Email
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
         TAB 9: CSV IMPORT / EXPORT
         ===================================================================== */}
      {activeTab === "csv" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-ink-950">
              ส่งออกรายการสินค้าทั้งหมดเป็นไฟล์ CSV
            </h2>
            <p className="text-xs text-ink-600">
              ดาวน์โหลดข้อมูลสินค้าทั้งหมดในฐานข้อมูลไปแก้ไขใน Excel / Google Sheets แล้วนำกลับเข้ามาอัปเดตได้ทันที
            </p>
            <a href="/api/admin?export=csv" className="btn btn-primary btn-sm">
              <Download className="h-4 w-4" />
              <span>ดาวน์โหลดไฟล์ compronext-products.csv</span>
            </a>
          </div>

          <form onSubmit={handleImportCsv} className="card p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-ink-950">
              นำเข้าสินค้าจากข้อมูล CSV (Bulk Upsert)
            </h2>
            <textarea
              rows={5}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder="วางข้อมูล CSV ที่มีหัวตาราง id,name,category,price,status,buyUrl..."
              className="input font-mono text-xs"
              required
            />
            <button type="submit" className="btn btn-primary btn-sm">
              <Upload className="h-4 w-4" />
              <span>นำเข้าและอัปเดตฐานข้อมูลทันที</span>
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
         TAB 10: MODERN SERVERLESS STACK (Cloudflare, Neon, Clerk, Resend, R2)
         ===================================================================== */}
      {activeTab === "serverless" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {stackServices.map((svc) => (
              <div
                key={svc.id}
                className="market-card p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`badge ${
                        svc.configured
                          ? "bg-ok-bg text-ok"
                          : "bg-info-bg text-info"
                      }`}
                    >
                      {svc.modeLabel}
                    </span>
                    {svc.id === "cloudflare" && <Cloud className="h-4 w-4 text-info" />}
                    {svc.id === "neon" && <Database className="h-4 w-4 text-info" />}
                    {svc.id === "clerk" && <KeyRound className="h-4 w-4 text-info" />}
                    {svc.id === "resend" && <Mail className="h-4 w-4 text-info" />}
                    {svc.id === "storage" && (
                      <HardDriveUpload className="h-4 w-4 text-info" />
                    )}
                  </div>
                  <h3 className="font-display text-base font-bold text-ink-950">
                    {svc.name}
                  </h3>
                  <p className="text-xs text-ink-600">{svc.role}</p>
                </div>

                <div className="space-y-1.5 border-t border-ink-100 pt-3 text-xs">
                  <p className="font-semibold text-ok">{svc.freeTierHighlight}</p>
                  <p className="font-mono text-ink-500 truncate" title={svc.envKeys.join(", ")}>
                    ENV: {svc.envKeys.join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Neon Serverless PostgreSQL Branching */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-200 pb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-info" />
                  <div>
                    <h3 className="font-display text-base font-bold text-ink-950">
                      Neon Serverless PostgreSQL & SQLite Engine
                    </h3>
                    <p className="text-xs text-ink-500">
                      ฐานข้อมูลทำงานแบบ Persistent Relational SQLite + Neon Branching
                    </p>
                  </div>
                </div>
                <span className="badge bg-ok-bg text-ok">SQLite + JSON Sync</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    {
                      id: "main",
                      title: "main (Production)",
                      desc: "ข้อมูลจริงหน้าเว็บ",
                    },
                    {
                      id: "staging-preview",
                      title: "staging-preview",
                      desc: "ทดสอบโปรโมชั่นพาร์ทเนอร์",
                    },
                    {
                      id: "dev-sandbox",
                      title: "dev-sandbox",
                      desc: "สำหรับนักพัฒนา",
                    },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      postAdminAction(
                        { action: "switch_neon_branch", neonBranch: b.id },
                        `สลับฐานข้อมูลไปยัง Branch "${b.id}" เรียบร้อย`
                      )
                    }
                    className={`rounded-[6px] border p-3 text-left transition-all cursor-pointer ${
                      db.neonActiveBranch === b.id
                        ? "border-info bg-info text-white"
                        : "border-ink-200 bg-white text-ink-900 hover:border-info"
                    }`}
                  >
                    <span className="font-mono text-xs font-bold block">{b.title}</span>
                    <span
                      className={`text-xs ${
                        db.neonActiveBranch === b.id ? "text-white/85" : "text-ink-500"
                      }`}
                    >
                      {b.desc}
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-[5px] bg-[#0a2540] p-3.5 font-mono text-xs text-white space-y-1">
                <p className="text-[#93c5fd]">
                  # สถานะการเชื่อมต่อฐานข้อมูลจริง (SQLite + Neon PostgreSQL)
                </p>
                <p>
                  Active Branch: <strong>{db.neonActiveBranch}</strong> | Engine: node:sqlite (.data/compronext.sqlite)
                </p>
                <p>
                  Tables: <code>products, rooms, categories, banners, articles, orders, users, admin_accounts</code>
                </p>
              </div>
            </div>

            {/* Cloudflare Pages & Edge Config */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-200 pb-3">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-info" />
                  <div>
                    <h3 className="font-display text-base font-bold text-ink-950">
                      Cloudflare Pages / Workers & R2 Zero-Egress
                    </h3>
                    <p className="text-xs text-ink-500">
                      โฮสต์หน้าเว็บ รันโค้ดฝั่งหลังบ้าน ทำ CDN และเก็บไฟล์โดยไม่เสียค่าแบนด์วิดท์ขาออก
                    </p>
                  </div>
                </div>
                <span className="badge bg-info text-white">Unlimited Bandwidth</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-[5px] border border-ink-200 bg-ink-50 p-3.5 space-y-1">
                  <span className="font-bold text-ink-950 block">
                    1. ฐานข้อมูล Neon PostgreSQL
                  </span>
                  <code className="text-info block font-mono">
                    ใส่ DATABASE_URL ใน Vercel — เว็บสร้างตารางให้เอง
                  </code>
                </div>
                <div className="rounded-[5px] border border-ink-200 bg-ink-50 p-3.5 space-y-1">
                  <span className="font-bold text-ink-950 block">
                    2. ที่เก็บไฟล์ (รูป/โมเดล 3D)
                  </span>
                  <code className="text-info block font-mono">
                    Vercel → Storage → Blob (ได้ BLOB_READ_WRITE_TOKEN)
                  </code>
                </div>
                <div className="rounded-[5px] border border-ink-200 bg-ink-50 p-3.5 space-y-1 sm:col-span-2">
                  <span className="font-bold text-ink-950 block">
                    3. Deploy ขึ้น Vercel
                  </span>
                  <code className="text-info block font-mono">
                    git push ขึ้น GitHub → Vercel build ให้อัตโนมัติ
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
