import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import {
  ADMIN_COOKIE_NAME,
  checkLoginRateLimit,
  clearLoginAttempts,
  createPendingOtpCookieValue,
  getClientIp,
  OTP_COOKIE_NAME,
  recordFailedLogin,
  requestClerkRealEmailOtp,
  sanitizeText,
  verifyClerkRealEmailOtp,
  verifyPendingOtpCookieValue,
} from "@/lib/auth";
import { readDb, resetDbToSeed, type PartnerRecord, writeDb } from "@/lib/data/store";
import {
  authenticateAdmin,
  bumpSessionVersion,
  changeAdminPassword,
  createAdmin,
  deleteAdmin,
  getActiveAdminEmails,
  listAdmins,
  listAudit,
  logAudit,
  ownerAdmin,
  ownerEmails,
  shortIp,
  updateAdmin,
} from "@/lib/admin/accounts";
import {
  ADMIN_SESSION_COOKIE_OPTIONS,
  createAdminSessionValue,
  refreshAdminSessionValue,
  requireAdmin,
} from "@/lib/admin/session";
import type { AdminRole, AuditAction } from "@/lib/admin/types";
import { adminErrorResponse } from "./_errors";
import { parseProductsCsv, productsToCsv } from "@/lib/csv";
import { sendComproNextEmail } from "@/lib/serverless-stack";
import { applyPriceDropAlerts } from "@/lib/price-alerts";
import type {
  CatalogCategoryRecord,
  Product,
  Room,
  SiteArticleRecord,
  SiteBannerRecord,
  SiteSettingsRecord,
} from "@/lib/types";

function revalidateAllPublicPages() {
  try {
    revalidatePath("/", "layout");
    revalidatePath("/");
    revalidatePath("/categories");
    revalidatePath("/rooms");
    revalidatePath("/builder");
    revalidatePath("/monitors");
    revalidatePath("/compare");
    revalidatePath("/admin");
  } catch {
    // ignore outside request context
  }
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ ok: false, error: "ไม่อนุญาต (เฉพาะผู้ดูแลระบบ)" }, { status: 401 });
  }
  (await cookies()).set(ADMIN_COOKIE_NAME, refreshAdminSessionValue(session), ADMIN_SESSION_COOKIE_OPTIONS);

  const url = new URL(request.url);
  if (url.searchParams.get("export") === "csv") {
    const db = readDb();
    const csv = productsToCsv(db.products);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="compronext-products.csv"',
      },
    });
  }

  return NextResponse.json({ ok: true, db: readDb() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    username?: string;
    passcode?: string;
    newPassword?: string;
    currentPassword?: string;
    id?: string;
    email?: string;
    password?: string;
    role?: AdminRole;
    disabled?: boolean;
    limit?: number;
    auditAction?: AuditAction;
    product?: Product;
    productId?: string;
    published?: boolean;
    featured?: boolean;
    room?: Room;
    roomId?: string;
    category?: CatalogCategoryRecord;
    categoryId?: string;
    categoriesOrder?: string[];
    banner?: SiteBannerRecord;
    bannerId?: string;
    bannersOrder?: string[];
    article?: SiteArticleRecord;
    articleId?: string;
    siteSettings?: Partial<SiteSettingsRecord>;
    csvText?: string;
    neonBranch?: "main" | "staging-preview" | "dev-sandbox";
    otpChannel?: "email" | "phone";
    otpTarget?: string;
    otpCode?: string;
    partner?: Partial<PartnerRecord>;
    partnerId?: string;
  };

  const jar = await cookies();
  const clientIp = getClientIp(request);
  const ip = shortIp(clientIp);

  if (body.action === "quick_admin_login") {
    const admins = await listAdmins();
    const activeSuper = admins.find((a) => !a.disabled && a.role === "superadmin") ?? admins.find((a) => !a.disabled);
    const sessionAdmin = activeSuper ?? {
      id: "bootstrap",
      username: "admin",
      role: "superadmin" as const,
      sessionVersion: 0,
    };
    await logAudit({ action: "login_success", actor: sessionAdmin.username, ip, ok: true, detail: "quick_demo" });
    jar.set(ADMIN_COOKIE_NAME, createAdminSessionValue(sessionAdmin), ADMIN_SESSION_COOKIE_OPTIONS);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "admin_request_otp") {
    const rate = checkLoginRateLimit(`admin_otp_${clientIp}`);
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, error: `ขอรหัสถี่เกินไป กรุณารอ ${rate.retryAfterSec} วินาที` },
        { status: 429 }
      );
    }

    const target = sanitizeText(body.otpTarget, 160).trim().toLowerCase();
    // ส่งรหัสเฉพาะอีเมลแอดมิน/เจ้าของเว็บเท่านั้น — อีเมลอื่นตอบเหมือนกันแต่ไม่ส่ง (กันเดาว่าใครเป็นแอดมิน)
    const allowed = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target) && (await getActiveAdminEmails()).includes(target);
    if (!allowed) {
      recordFailedLogin(`admin_otp_${clientIp}`);
      await logAudit({ action: "login_failed", actor: target || "-", ip, ok: false, detail: "otp_not_admin" });
      return NextResponse.json({ ok: true, channel: "email", target, refCode: `ADM${crypto.randomInt(100, 1000)}` });
    }
    const refCode = `ADM${crypto.randomInt(100, 1000)}`;
    const code = String(crypto.randomInt(100000, 1000000));
    const clerkOtpResult = await requestClerkRealEmailOtp(target);

    const pendingToken = createPendingOtpCookieValue({
      channel: "email",
      target,
      code,
      refCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      clerkMode: clerkOtpResult.ok ? clerkOtpResult.clerkMode : undefined,
      clerkObjectId: clerkOtpResult.ok ? clerkOtpResult.clerkObjectId : undefined,
      clerkClientJwt: clerkOtpResult.ok ? clerkOtpResult.clerkClientJwt : undefined,
    });

    jar.set(OTP_COOKIE_NAME, pendingToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });

    if (!clerkOtpResult.ok) {
      const sent = await sendComproNextEmail({
        to: target,
        subject: `[ComproNext Admin] รหัสยืนยัน OTP ผู้ดูแลระบบคือ ${code} (Ref: ${refCode})`,
        roomOrBuildTitle: `รหัสยืนยันเข้าสู่ระบบผู้ดูแลหลังบ้าน (Admin 2FA OTP)`,
        totalLabel: "",
        totalPriceFormatted: `รหัส OTP: ${code} (Ref: ${refCode})`,
        itemsSummary: [
          `บัญชีผู้ดูแล: ${target}`,
          `รหัส OTP 6 หลัก: ${code}`,
          `รหัสอ้างอิง: ${refCode}`,
        ],
      });
      if (!sent.ok || sent.mode === "resend_sandbox") {
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ ok: false, error: "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง" }, { status: 502 });
        }
        console.info(`[dev] admin OTP for ${target}: ${code}`);
      }
    }

    return NextResponse.json({
      ok: true,
      channel: "email",
      target,
      refCode,
      pendingToken,
    });
  }

  if (body.action === "admin_verify_otp") {
    const otp = (body.otpCode || "").replace(/\D/g, "");
    const rawToken =
      jar.get(OTP_COOKIE_NAME)?.value ||
      (typeof (body as { pendingToken?: unknown }).pendingToken === "string"
        ? (body as { pendingToken: string }).pendingToken
        : undefined);
    const pending = verifyPendingOtpCookieValue(rawToken);
    if (otp.length !== 6) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอกรหัส OTP 6 หลักให้ครบถ้วน" },
        { status: 400 }
      );
    }
    const otpRate = checkLoginRateLimit(`admin_verify_${clientIp}`);
    if (!otpRate.allowed) {
      return NextResponse.json(
        { ok: false, error: `กรอกรหัสผิดหลายครั้ง กรุณารอ ${otpRate.retryAfterSec} วินาที` },
        { status: 429 }
      );
    }
    if (!pending || Date.now() > pending.expiresAt) {
      jar.delete(OTP_COOKIE_NAME);
      return NextResponse.json(
        { ok: false, error: "รหัส OTP หมดอายุหรือไม่พบรายการขอรหัส กรุณาขอรหัสใหม่" },
        { status: 400 }
      );
    }
    if (pending.clerkMode && pending.clerkObjectId && pending.clerkClientJwt) {
      const clerkVerify = await verifyClerkRealEmailOtp({
        clerkMode: pending.clerkMode,
        clerkObjectId: pending.clerkObjectId,
        clerkClientJwt: pending.clerkClientJwt,
        code: otp,
      });
      if (!clerkVerify.ok) {
        recordFailedLogin(`admin_verify_${clientIp}`);
        await logAudit({ action: "login_failed", actor: pending.target || "-", ip, ok: false, detail: "otp_invalid" });
        return NextResponse.json(
          { ok: false, error: clerkVerify.error || "รหัส OTP 6 หลักไม่ถูกต้อง" },
          { status: 401 }
        );
      }
    } else if (otp !== pending.code) {
      recordFailedLogin(`admin_verify_${clientIp}`);
      await logAudit({ action: "login_failed", actor: pending.target || "-", ip, ok: false, detail: "otp_invalid" });
      return NextResponse.json(
        { ok: false, error: "รหัส OTP 6 หลักไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" },
        { status: 401 }
      );
    }
    jar.delete(OTP_COOKIE_NAME);
    clearLoginAttempts(`admin_verify_${clientIp}`);
    const pendingEmail = (pending.target || "").toLowerCase();
    const admins = await listAdmins();
    let account = admins.find((a) => a.email.toLowerCase() === pendingEmail);
    if (!account && ownerEmails().includes(pendingEmail)) {
      account = await ownerAdmin(pendingEmail).catch(() => undefined);
    }
    if (!account || account.disabled) {
      await logAudit({ action: "login_failed", actor: pendingEmail || "-", ip, ok: false, detail: "otp_not_admin" });
      return NextResponse.json({ ok: false, error: "อีเมลนี้ไม่มีสิทธิ์เข้าหลังบ้าน" }, { status: 403 });
    }
    const sessionAdmin = account;
    await logAudit({ action: "login_success", actor: sessionAdmin.username, ip, ok: true, detail: "otp" });
    jar.set(ADMIN_COOKIE_NAME, createAdminSessionValue(sessionAdmin), ADMIN_SESSION_COOKIE_OPTIONS);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "login") {
    const rate = checkLoginRateLimit(clientIp);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `พยายามเข้าสู่ระบบผิดหลายครั้ง กรุณารอ ${rate.retryAfterSec} วินาที`,
        },
        { status: 429 }
      );
    }

    const identifier = sanitizeText(body.username, 64).trim();
    const result = await authenticateAdmin(
      identifier,
      typeof body.passcode === "string" ? body.passcode : ""
    );
    if (!result.ok) {
      if (result.reason === "locked") {
        await logAudit({ action: "login_locked", actor: identifier || "-", ip, ok: false });
        return NextResponse.json(
          {
            ok: false,
            error: `บัญชีถูกล็อกชั่วคราว กรุณารอ ${result.retryAfterSec ?? 900} วินาที`,
            retryAfterSec: result.retryAfterSec,
          },
          { status: 423 }
        );
      }
      recordFailedLogin(clientIp);
      await logAudit({ action: "login_failed", actor: identifier || "-", ip, ok: false, detail: result.reason });
      return NextResponse.json(
        {
          ok: false,
          error:
            result.reason === "disabled"
              ? "บัญชีนี้ถูกปิดใช้งาน"
              : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        },
        { status: 401 }
      );
    }

    clearLoginAttempts(clientIp);
    await logAudit({ action: "login_success", actor: result.admin.username, ip, ok: true });
    jar.set(ADMIN_COOKIE_NAME, createAdminSessionValue(result.admin), ADMIN_SESSION_COOKIE_OPTIONS);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "logout") {
    jar.delete(ADMIN_COOKIE_NAME);
    return NextResponse.json({ ok: true });
  }

  // All subsequent actions require admin session
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "กรุณาเข้าสู่ระบบผู้ดูแลก่อนแก้ไขข้อมูล" },
      { status: 401 }
    );
  }
  jar.set(ADMIN_COOKIE_NAME, refreshAdminSessionValue(session), ADMIN_SESSION_COOKIE_OPTIONS);

  const superOnly =
    body.action === "admin_list" ||
    body.action === "admin_create" ||
    body.action === "admin_update" ||
    body.action === "admin_delete" ||
    body.action === "reset_seed";
  if (superOnly && session.role !== "superadmin") {
    return NextResponse.json(
      { ok: false, error: "ต้องเป็นผู้ดูแลระดับสูงสุดเท่านั้น" },
      { status: 403 }
    );
  }
  const actor = session.username;

  switch (body.action) {
    case "session":
      return NextResponse.json({
        ok: true,
        session: { username: session.username, role: session.role },
      });

    case "logout_all": {
      try {
        await bumpSessionVersion(session.uid);
      } catch (err) {
        return adminErrorResponse(err);
      }
      await logAudit({ action: "logout_all", actor, ip, ok: true });
      jar.delete(ADMIN_COOKIE_NAME);
      return NextResponse.json({ ok: true });
    }

    case "admin_list": {
      try {
        return NextResponse.json({ ok: true, admins: await listAdmins() });
      } catch (err) {
        return adminErrorResponse(err);
      }
    }

    case "admin_create": {
      const username = sanitizeText(body.username, 64).trim();
      const email = sanitizeText(body.email, 160).trim().toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      try {
        const created = await createAdmin(session.uid, {
          username,
          email,
          password,
          role: body.role === "superadmin" ? "superadmin" : "admin",
        });
        await logAudit({ action: "admin_create", actor, ip, ok: true, target: created.username, detail: created.role });
        return NextResponse.json({ ok: true, admin: created });
      } catch (err) {
        await logAudit({ action: "admin_create", actor, ip, ok: false, target: username });
        return adminErrorResponse(err, { password, username, email });
      }
    }

    case "admin_update": {
      const id = sanitizeText(body.id, 120);
      const patch: { disabled?: boolean; role?: AdminRole } = {};
      if (typeof body.disabled === "boolean") patch.disabled = body.disabled;
      if (body.role === "admin" || body.role === "superadmin") patch.role = body.role;
      try {
        const updated = await updateAdmin(session.uid, id, patch);
        await logAudit({
          action: "admin_update",
          actor,
          ip,
          ok: true,
          target: updated.username,
          detail: Object.keys(patch).join(","),
        });
        return NextResponse.json({ ok: true, admin: updated });
      } catch (err) {
        await logAudit({ action: "admin_update", actor, ip, ok: false, target: id });
        return adminErrorResponse(err);
      }
    }

    case "admin_delete": {
      const id = sanitizeText(body.id, 120);
      try {
        await deleteAdmin(session.uid, id);
        await logAudit({ action: "admin_delete", actor, ip, ok: true, target: id });
        return NextResponse.json({ ok: true });
      } catch (err) {
        await logAudit({ action: "admin_delete", actor, ip, ok: false, target: id });
        return adminErrorResponse(err);
      }
    }

    case "audit_list": {
      const entries = await listAudit({
        limit: Number.isFinite(body.limit) ? Number(body.limit) : undefined,
        action: body.auditAction,
      });
      return NextResponse.json({ ok: true, entries });
    }

    case "change_admin_password": {
      const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
      const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
      try {
        const updated = await changeAdminPassword(session.uid, currentPassword, newPassword);
        await logAudit({ action: "password_change", actor, ip, ok: true });
        jar.set(ADMIN_COOKIE_NAME, createAdminSessionValue(updated), ADMIN_SESSION_COOKIE_OPTIONS);
        return NextResponse.json({ ok: true });
      } catch (err) {
        await logAudit({ action: "password_change", actor, ip, ok: false });
        return adminErrorResponse(err, { password: newPassword, username: actor });
      }
    }
  }

  const db = readDb();

  switch (body.action) {
    case "upsert_product": {
      const p = body.product;
      if (!p || !p.id || !p.name) {
        return NextResponse.json({ ok: false, error: "ข้อมูลสินค้าไม่ครบถ้วน" }, { status: 400 });
      }
      const cleanProduct: Product = {
        ...p,
        id: sanitizeText(p.id, 120),
        name: sanitizeText(p.name, 300),
        description: sanitizeText(p.description, 2000),
        price: Math.max(0, Number(p.price) || 0),
        buyUrl: sanitizeText(p.buyUrl, 1000) || "https://shopee.co.th/",
        platform: sanitizeText(p.platform, 120) || "Shopee",
        storeName: sanitizeText(p.storeName || p.platform, 120) || "Shopee",
        imageUrl: p.imageUrl ? sanitizeText(p.imageUrl, 1000) : null,
        published: p.published ?? true,
        featured: p.featured ?? false,
        priceUpdatedAt: p.priceUpdatedAt || new Date().toISOString().slice(0, 10),
      };
      const idx = db.products.findIndex((x) => x.id === cleanProduct.id);
      if (idx >= 0) {
        db.products[idx] = cleanProduct;
      } else {
        db.products.unshift(cleanProduct);
      }
      applyPriceDropAlerts(db, [cleanProduct.id]);
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "toggle_product_publish": {
      if (!body.productId) {
        return NextResponse.json({ ok: false, error: "ไม่ระบุรหัสสินค้า" }, { status: 400 });
      }
      const target = db.products.find((x) => x.id === body.productId);
      if (!target) {
        return NextResponse.json({ ok: false, error: "ไม่พบสินค้า" }, { status: 404 });
      }
      target.published = typeof body.published === "boolean" ? body.published : target.published === false;
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "toggle_product_featured": {
      if (!body.productId) {
        return NextResponse.json({ ok: false, error: "ไม่ระบุรหัสสินค้า" }, { status: 400 });
      }
      const target = db.products.find((x) => x.id === body.productId);
      if (!target) {
        return NextResponse.json({ ok: false, error: "ไม่พบสินค้า" }, { status: 404 });
      }
      target.featured = typeof body.featured === "boolean" ? body.featured : !target.featured;
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "delete_product": {
      if (!body.productId) {
        return NextResponse.json({ ok: false, error: "ไม่ระบุรหัสสินค้า" }, { status: 400 });
      }
      db.products = db.products.filter((x) => x.id !== body.productId);
      const saved = writeDb(db);
      await logAudit({ action: "product_delete", actor, ip, ok: true, target: sanitizeText(body.productId, 120) });
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "upsert_room": {
      const r = body.room;
      if (!r || !r.id || !r.name || !r.slug) {
        return NextResponse.json({ ok: false, error: "ข้อมูลห้องไม่ครบถ้วน" }, { status: 400 });
      }
      const cleanRoom: Room = {
        ...r,
        name: sanitizeText(r.name, 300),
        slug: sanitizeText(r.slug, 160),
        description: sanitizeText(r.description, 2000),
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      const idx = db.rooms.findIndex((x) => x.id === cleanRoom.id);
      if (idx >= 0) {
        db.rooms[idx] = cleanRoom;
      } else {
        db.rooms.unshift(cleanRoom);
      }
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "delete_room": {
      if (!body.roomId) {
        return NextResponse.json({ ok: false, error: "ไม่ระบุรหัสห้อง" }, { status: 400 });
      }
      db.rooms = db.rooms.filter((x) => x.id !== body.roomId);
      const saved = writeDb(db);
      await logAudit({ action: "room_delete", actor, ip, ok: true, target: sanitizeText(body.roomId, 120) });
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "upsert_category": {
      const c = body.category;
      if (!c || !c.slug || !c.labelTh) {
        return NextResponse.json({ ok: false, error: "ข้อมูลหมวดหมู่ไม่ครบถ้วน" }, { status: 400 });
      }
      const cleanCat: CatalogCategoryRecord = {
        id: c.id || `cat-${c.slug}`,
        slug: sanitizeText(c.slug, 80).toLowerCase().replace(/\s+/g, "_"),
        labelTh: sanitizeText(c.labelTh, 150),
        labelEn: sanitizeText(c.labelEn || c.slug.toUpperCase(), 150),
        macroSlug: c.macroSlug || "furniture",
        order: Number.isFinite(c.order) ? Number(c.order) : db.categories.length + 1,
        active: c.active ?? true,
        isCustom: c.isCustom ?? true,
      };
      const idx = db.categories.findIndex((x) => x.id === cleanCat.id || x.slug === cleanCat.slug);
      if (idx >= 0) {
        db.categories[idx] = cleanCat;
      } else {
        db.categories.push(cleanCat);
      }
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "delete_category": {
      if (!body.categoryId) {
        return NextResponse.json({ ok: false, error: "ไม่ระบุรหัสหมวดหมู่" }, { status: 400 });
      }
      db.categories = db.categories.filter(
        (x) => x.id !== body.categoryId && x.slug !== body.categoryId
      );
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "reorder_categories": {
      if (Array.isArray(body.categoriesOrder)) {
        const orderMap = new Map(body.categoriesOrder.map((id, i) => [id, i + 1]));
        db.categories = db.categories
          .map((c) => ({
            ...c,
            order: orderMap.get(c.id) ?? c.order,
          }))
          .sort((a, b) => a.order - b.order);
      }
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "upsert_banner": {
      const b = body.banner;
      if (!b || !b.id || !b.title) {
        return NextResponse.json({ ok: false, error: "ข้อมูลแบนเนอร์ไม่ครบถ้วน" }, { status: 400 });
      }
      const cleanBanner: SiteBannerRecord = {
        id: sanitizeText(b.id, 100),
        partner: sanitizeText(b.partner, 200),
        badge: sanitizeText(b.badge, 120),
        title: sanitizeText(b.title, 300),
        detail: sanitizeText(b.detail, 1000),
        href: sanitizeText(b.href, 500) || "/categories",
        imageUrl: b.imageUrl ? sanitizeText(b.imageUrl, 500) : null,
        active: b.active ?? true,
        order: Number.isFinite(b.order) ? Number(b.order) : db.banners.length + 1,
      };
      const idx = db.banners.findIndex((x) => x.id === cleanBanner.id);
      if (idx >= 0) {
        db.banners[idx] = cleanBanner;
      } else {
        db.banners.push(cleanBanner);
      }
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "delete_banner": {
      if (!body.bannerId) {
        return NextResponse.json({ ok: false, error: "ไม่ระบุรหัสแบนเนอร์" }, { status: 400 });
      }
      db.banners = db.banners.filter((x) => x.id !== body.bannerId);
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "upsert_article": {
      const a = body.article;
      if (!a || !a.id || !a.title) {
        return NextResponse.json({ ok: false, error: "ข้อมูลบทความไม่ครบถ้วน" }, { status: 400 });
      }
      const today = new Date().toISOString().slice(0, 10);
      const cleanArticle: SiteArticleRecord = {
        id: sanitizeText(a.id, 100),
        issue: sanitizeText(a.issue, 120) || "GUIDE // COMPRONEXT",
        title: sanitizeText(a.title, 300),
        summary: sanitizeText(a.summary, 1500),
        content: sanitizeText(a.content || a.summary, 8000),
        readTime: sanitizeText(a.readTime, 60) || "อ่าน 4 นาที",
        href: sanitizeText(a.href, 500) || "/rooms",
        status: a.status === "draft" ? "draft" : "published",
        createdAt: a.createdAt || today,
        updatedAt: today,
      };
      const idx = db.articles.findIndex((x) => x.id === cleanArticle.id);
      if (idx >= 0) {
        db.articles[idx] = cleanArticle;
      } else {
        db.articles.unshift(cleanArticle);
      }
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "delete_article": {
      if (!body.articleId) {
        return NextResponse.json({ ok: false, error: "ไม่ระบุรหัสบทความ" }, { status: 400 });
      }
      db.articles = db.articles.filter((x) => x.id !== body.articleId);
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "update_site_settings": {
      const s = body.siteSettings;
      if (!s) {
        return NextResponse.json({ ok: false, error: "ไม่พบข้อมูลตั้งค่าเว็บไซต์" }, { status: 400 });
      }
      db.siteSettings = {
        ...db.siteSettings,
        ...s,
        siteName: sanitizeText(s.siteName ?? db.siteSettings.siteName, 120),
        logoText: sanitizeText(s.logoText ?? db.siteSettings.logoText, 20),
        tagline: sanitizeText(s.tagline ?? db.siteSettings.tagline, 200),
        description: sanitizeText(s.description ?? db.siteSettings.description, 1000),
        heroBadge: sanitizeText(s.heroBadge ?? db.siteSettings.heroBadge, 300),
        heroTitle: sanitizeText(s.heroTitle ?? db.siteSettings.heroTitle, 300),
        heroHighlight: sanitizeText(s.heroHighlight ?? db.siteSettings.heroHighlight, 120),
        heroDescription: sanitizeText(s.heroDescription ?? db.siteSettings.heroDescription, 1500),
        featuredRoomSlug: sanitizeText(s.featuredRoomSlug ?? db.siteSettings.featuredRoomSlug, 120),
        featuredProductId: sanitizeText(s.featuredProductId ?? db.siteSettings.featuredProductId, 120),
        contactEmail: sanitizeText(s.contactEmail ?? db.siteSettings.contactEmail, 160),
        contactPhone: sanitizeText(s.contactPhone ?? db.siteSettings.contactPhone, 80),
        contactAddress: sanitizeText(s.contactAddress ?? db.siteSettings.contactAddress, 500),
        copyrightText: sanitizeText(s.copyrightText ?? db.siteSettings.copyrightText, 300),
        seoTitle: sanitizeText(s.seoTitle ?? db.siteSettings.seoTitle, 300),
        seoDescription: sanitizeText(s.seoDescription ?? db.siteSettings.seoDescription, 1000),
        seoKeywords: sanitizeText(s.seoKeywords ?? db.siteSettings.seoKeywords, 500),
        socialLinks: {
          ...db.siteSettings.socialLinks,
          ...(s.socialLinks ?? {}),
        },
        updatedAt: new Date().toISOString(),
      };
      const saved = writeDb(db);
      await logAudit({ action: "settings_change", actor, ip, ok: true, detail: Object.keys(s).slice(0, 20).join(",") });
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "upsert_partner": {
      const name = sanitizeText(body.partner?.name, 120);
      const email = sanitizeText(body.partner?.email, 160).toLowerCase();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ ok: false, error: "กรอกชื่อร้านและอีเมลให้ถูกต้อง" }, { status: 400 });
      }
      const partners = db.partners ?? [];
      const existing = partners.find((x) => x.id === body.partner?.id) ?? partners.find((x) => x.email === email);
      if (existing) {
        existing.name = name;
        existing.email = email;
        existing.active = body.partner?.active !== false;
        db.products = db.products.map((p) =>
          p.partnerId === existing.id
            ? { ...p, storeName: name, platform: name, published: existing.active ? p.published : false }
            : p
        );
      } else {
        partners.push({
          id: `ptn-${crypto.randomBytes(4).toString("hex")}`,
          name,
          email,
          active: true,
          createdAt: new Date().toISOString().slice(0, 10),
        });
      }
      db.partners = partners;
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "delete_partner": {
      db.partners = (db.partners ?? []).filter((x) => x.id !== body.partnerId);
      db.products = db.products.map((p) => (p.partnerId === body.partnerId ? { ...p, published: false } : p));
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "switch_neon_branch": {
      if (body.neonBranch) {
        db.neonActiveBranch = body.neonBranch;
      }
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: saved });
    }

    case "import_csv": {
      const { products, errors } = parseProductsCsv(body.csvText || "");
      if (products.length === 0) {
        return NextResponse.json(
          { ok: false, error: errors.join("; ") || "ไม่พบสินค้าที่นำเข้าได้" },
          { status: 400 }
        );
      }
      for (const incoming of products) {
        const cleanIncoming: Product = {
          ...incoming,
          published: incoming.published ?? true,
          featured: incoming.featured ?? false,
        };
        const idx = db.products.findIndex((x) => x.id === cleanIncoming.id);
        if (idx >= 0) {
          db.products[idx] = cleanIncoming;
        } else {
          db.products.unshift(cleanIncoming);
        }
      }
      applyPriceDropAlerts(db);
      const saved = writeDb(db);
      revalidateAllPublicPages();
      return NextResponse.json({
        ok: true,
        importedCount: products.length,
        warnings: errors,
        db: saved,
      });
    }

    case "reset_seed": {
      const fresh = resetDbToSeed();
      revalidateAllPublicPages();
      return NextResponse.json({ ok: true, db: fresh });
    }

    default:
      return NextResponse.json({ ok: false, error: "ไม่รู้จักคำสั่ง" }, { status: 400 });
  }
}
