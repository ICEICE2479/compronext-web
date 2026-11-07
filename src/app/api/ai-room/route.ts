import { NextResponse } from "next/server";
import { getClientIp, getCurrentUser, isAdminAuthenticated, sanitizeText } from "@/lib/auth";
import { trackFunnel } from "@/lib/funnel";
import { getAllProducts, readDb } from "@/lib/data/store";
import { creditBalance, refundCredits, spendCredits } from "@/lib/ai-credits";
import { rateLimit } from "@/lib/rate-limit";
import {
  claudeAnalysis,
  generateRoomImage,
  getCloudflareCreds,
  getGeminiKey,
  imageGenerationAvailable,
  heuristicAnalysis,
  normalizeRoomPhoto,
  parseBudget,
  refineRoomImage,
  selectCandidates,
  type ImageGenResult,
  type RoomAnalysis,
  spotsOnImage,
} from "@/lib/ai-room";
import { peekAiQuota, takeAiQuota, type QuotaStatus } from "@/lib/ai-quota";
import { OWNED_OPTIONS, planPurchases } from "@/lib/buy-plan";
import { BodyTooLargeError, MAX_AI_ROOM_BODY_BYTES, readFormDataLimited } from "@/lib/body-limit";
import { capToBudget, pickRegenerated } from "@/lib/ai-room-picks";
import { trackEvent } from "@/lib/stats";
import { placeSpots } from "@/lib/hotspots";
import { fitsRoom, parseRoomSize, roomLabel } from "@/lib/room-planner";
import type { Product } from "@/lib/types";

export const maxDuration = 120;

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_PROMPT = 500;
const MAX_INSTRUCTION = 300;
const OWNED_ALLOWED = new Set<string>(OWNED_OPTIONS.map((o) => o.category));

const ERROR_TEXT: Record<NonNullable<ImageGenResult["error"]>, string> = {
  no_key: "ตอนนี้ยังสร้างภาพตัวอย่างห้องไม่ได้",
  generation_failed: "สร้างภาพไม่สำเร็จ ลองกดสร้างใหม่อีกครั้ง",
  no_image_returned: "AI ตอบกลับแต่ไม่มีภาพ",
  no_products: "ยังไม่มีสินค้าที่เหมาะกับห้องนี้",
};

const NO_KEY_HOWTO =
  "ผู้ดูแล: ใส่ CLOUDFLARE_ACCOUNT_ID และ CLOUDFLARE_API_TOKEN (ฟรี) หรือ GEMINI_API_KEY (ต้องเปิด billing) ในไฟล์ .env.local แล้วรีสตาร์ทเซิร์ฟเวอร์";

/** ข้อความผิดพลาดของภาพ — ลูกค้าเห็นแค่ข้อความสั้นๆ วิธีตั้งค่า/รายละเอียดเทคนิคเห็นเฉพาะแอดมิน */
async function imageErrorFor(r: Pick<ImageGenResult, "error" | "detail">) {
  if (!r.error) return null;
  const admin = await isAdminAuthenticated();
  const detail = admin ? (r.detail ?? (r.error === "no_key" ? NO_KEY_HOWTO : null)) : null;
  return { code: r.error, message: ERROR_TEXT[r.error], detail };
}

/** สินค้าทางเลือกในหมวดเดียวกัน สำหรับปุ่ม "เปลี่ยนชิ้นนี้" */
function buildAlternatives(picked: Product[], pool: Product[]): Record<string, Product[]> {
  const ids = new Set(picked.map((p) => p.id));
  const out: Record<string, Product[]> = {};
  for (const p of picked) {
    out[p.id] = pool.filter((x) => x.category === p.category && !ids.has(x.id)).slice(0, 6);
  }
  return out;
}

function quotaKey(request: Request, userId: string | null): string {
  return userId ? `u:${userId}` : `ip:${getClientIp(request)}`;
}

function quotaExceeded(quota: QuotaStatus, wanted: number) {
  const reset = "ใช้ได้อีกครั้งหลังเที่ยงคืน (00:00 น.)";
  const error =
    quota.remaining > 0
      ? `วันนี้เหลือ ${quota.remaining} ครั้ง ไม่พอสำหรับ ${wanted} ภาพ ลองสร้างทีละภาพนะ`
      : quota.loggedIn
        ? `วันนี้ใช้ AI ครบ ${quota.limit} ครั้งแล้ว ${reset} นะ`
        : `วันนี้ใช้ AI ครบ ${quota.limit} ครั้งแล้ว เข้าสู่ระบบฟรีเพื่อรับสิทธิ์เพิ่ม หรือ${reset}`;
  const withCredit = quota.loggedIn && quota.remaining <= 0 ? `${error} หรือเติมเครดิต AI ใช้ต่อได้ทันที` : error;
  return NextResponse.json({ ok: false, error: withCredit, needLogin: !quota.loggedIn, needCredits: quota.loggedIn, quota }, { status: 429 });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const quota: QuotaStatus = await peekAiQuota(quotaKey(request, user?.id ?? null), !!user);
  if (user) quota.credits = creditBalance(readDb(), user.id);
  return NextResponse.json({
    ok: true,
    analysis: process.env.ANTHROPIC_API_KEY ? "ai" : "basic",
    imageGeneration: imageGenerationAvailable(),
    imageProviders: [getGeminiKey() && "gemini", getCloudflareCreds() && "cloudflare"].filter(Boolean),
    quota,
  });
}

export async function POST(request: Request) {
  let form: FormData | null;
  try {
    form = await readFormDataLimited(request, MAX_AI_ROOM_BODY_BYTES);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return NextResponse.json({ ok: false, error: "รูปใหญ่เกินไป รองรับไม่เกิน 4MB" }, { status: 413 });
    }
    form = null;
  }
  const user = await getCurrentUser();
  if (!form) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const mode = form.get("mode") === "refine" ? "refine" : form.get("mode") === "regenerate" ? "regenerate" : "design";
  const variants = mode === "design" && form.get("variants") === "2" ? 2 : 1;

  // ---- ตรวจข้อมูลก่อน (ไม่หักโควตาถ้าข้อมูลผิด) ----
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ ok: false, error: "กรุณาถ่ายหรืออัปโหลดรูปห้องก่อน" }, { status: 400 });
  }
  if (photo.size > MAX_PHOTO_BYTES || !ALLOWED_TYPES.has(photo.type)) {
    return NextResponse.json({ ok: false, error: "รองรับรูป JPG / PNG / WEBP / HEIC ขนาดไม่เกิน 4MB" }, { status: 400 });
  }
  const rawInstruction = typeof form.get("instruction") === "string" ? String(form.get("instruction")) : "";
  const rawPrompt = typeof form.get("prompt") === "string" ? String(form.get("prompt")) : "";
  if (mode === "refine" && rawInstruction.length > MAX_INSTRUCTION) {
    return NextResponse.json({ ok: false, error: `คำสั่งแก้ภาพยาวได้ไม่เกิน ${MAX_INSTRUCTION} ตัวอักษร` }, { status: 400 });
  }
  if (mode !== "refine" && rawPrompt.length > MAX_PROMPT) {
    return NextResponse.json({ ok: false, error: `คำอธิบายห้องยาวได้ไม่เกิน ${MAX_PROMPT} ตัวอักษร` }, { status: 400 });
  }
  const instruction = sanitizeText(rawInstruction, MAX_INSTRUCTION);
  const prompt = sanitizeText(rawPrompt, MAX_PROMPT);
  if (mode === "refine" && instruction.length < 2) {
    return NextResponse.json({ ok: false, error: "พิมพ์สิ่งที่อยากให้แก้" }, { status: 400 });
  }
  if (mode !== "refine" && prompt.length < 3) {
    return NextResponse.json({ ok: false, error: "บอก AI หน่อยว่าอยากได้ห้องแบบไหน" }, { status: 400 });
  }

  // กันกดรัว: ไม่เกิน 3 คำขอ / 30 วินาที ต่อคน
  const key = quotaKey(request, user?.id ?? null);
  const burst = rateLimit(`ai-room:${key}`, 3, 30_000);
  if (!burst.ok) {
    return NextResponse.json(
      { ok: false, error: `กดถี่ไป รออีก ${burst.retryAfter} วินาทีแล้วลองใหม่นะ`, retryAfter: burst.retryAfter },
      { status: 429, headers: { "Retry-After": String(burst.retryAfter) } }
    );
  }

  const taken = await takeAiQuota(key, !!user, variants);
  const quotaStatus: QuotaStatus = {
    limit: taken.limit,
    used: taken.used,
    remaining: taken.remaining,
    resetAt: taken.resetAt,
    loggedIn: taken.loggedIn,
    ...(taken.degraded ? { degraded: true } : {}),
  };
  if (!taken.ok && taken.degraded) {
    return NextResponse.json(
      { ok: false, error: "ระบบนับสิทธิ์ AI ขัดข้องชั่วคราว ลองใหม่อีกครั้งในอีกสักครู่นะ", quota: quotaStatus },
      { status: 503 }
    );
  }
  // โควตาฟรีหมด → ใช้เครดิตที่เติมไว้ (ถ้ามี)
  let paidCredits = 0;
  if (!taken.ok) {
    const left = user ? spendCredits(user.id, variants) : null;
    if (left === null) {
      if (user) quotaStatus.credits = creditBalance(readDb(), user.id);
      return quotaExceeded(quotaStatus, variants);
    }
    paidCredits = variants;
    quotaStatus.credits = left;
  } else if (user) quotaStatus.credits = creditBalance(readDb(), user.id);
  /** สร้างภาพไม่ได้สักภาพ → คืนเครดิตที่หักไป */
  const refundIfNoImage = (count: number) => {
    if (paidCredits > 0 && count === 0 && user) {
      refundCredits(user.id, paidCredits);
      quotaStatus.credits = (quotaStatus.credits ?? 0) + paidCredits;
    }
  };

  let photoB64: string;
  try {
    photoB64 = await normalizeRoomPhoto(Buffer.from(await photo.arrayBuffer()));
  } catch {
    refundIfNoImage(0);
    return NextResponse.json({ ok: false, error: "อ่านไฟล์รูปไม่ได้ ลองใหม่อีกครั้ง", quota: quotaStatus }, { status: 400 });
  }

  // ---- แก้ภาพเดิมตามคำสั่ง (ไม่เลือกสินค้าใหม่) ----
  if (mode === "refine") {
    const r = await refineRoomImage(photoB64, instruction);
    refundIfNoImage(r.image ? 1 : 0);
    return NextResponse.json({
      ok: true,
      images: r.image ? [r.image] : [],
      imageError: await imageErrorFor(r),
      quota: quotaStatus,
    });
  }

  const all = getAllProducts();
  const byId = new Map(all.map((p) => [p.id, p]));
  const requestedIds = String(form.get("productIds") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);
  // ของที่มีอยู่แล้ว → ไม่แนะนำหมวดนั้น
  const owned = new Set(
    String(form.get("owned") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => OWNED_ALLOWED.has(x))
  );

  // งบจากแถบเลื่อนมาก่อน ไม่งั้นอ่านจากข้อความ
  const sliderBudget = Number(form.get("budget"));
  const budget = Number.isFinite(sliderBudget) && sliderBudget >= 1000 ? Math.min(sliderBudget, 1_000_000) : parseBudget(prompt);
  // ขนาดห้องที่ลูกค้าวัดมา → ไม่แนะนำของที่ใหญ่เกินห้อง + บอก AI
  const room = parseRoomSize(String(form.get("room") ?? ""));
  const fromPlan = form.get("source") === "plan3d";
  const roomPrompt = [
    fromPlan ? "Turn this 3D room mock-up into a photorealistic interior photo. Keep the same room shape, window and furniture positions." : "",
    prompt,
    room ? `(ห้องจริงขนาด ${roomLabel(room)} — เลือกของให้พอดีห้อง)` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const candidates = selectCandidates(all, prompt).filter((p) => !owned.has(p.category) && (!room || fitsRoom(p.dimensions, room)));

  let analysis: RoomAnalysis | null = null;
  let products: Product[];
  if (mode === "regenerate" && requestedIds.length > 0) {
    products = pickRegenerated(requestedIds, byId, owned, budget);
  } else {
    const raw = (await claudeAnalysis(photoB64, roomPrompt, budget, candidates)) ?? heuristicAnalysis(candidates, prompt, budget);
    products = capToBudget(
      raw.picks.map((x) => byId.get(x.id)).filter((p): p is Product => !!p && !owned.has(p.category)),
      budget
    );
    const kept = new Set(products.map((p) => p.id));
    analysis = { ...raw, picks: raw.picks.filter((x) => kept.has(x.id)) };
  }

  const aiSpots = new Map(analysis?.picks.map((x) => [x.id, x.spot]) ?? []);
  const spots = placeSpots(products.map((p) => ({ id: p.id, category: p.category, spot: aiSpots.get(p.id) })));

  const results = await Promise.all(
    Array.from({ length: variants }, (_, i) => generateRoomImage(photoB64, roomPrompt, products, i, spots))
  );
  const images = results.map((r) => r.image).filter((x): x is string => !!x);
  // จุดตัวเลขของแต่ละภาพ วางบนของที่ตรวจเจอจริงในภาพนั้น
  const imageSpots = await Promise.all(images.map((img) => spotsOnImage(img, products, spots)));
  const firstError = results.find((r) => !r.image);
  refundIfNoImage(images.length);

  for (const p of products) trackEvent(p.id, "aiPicks");
  trackFunnel("ai_design");

  const reasons = analysis ? Object.fromEntries(analysis.picks.filter((x) => x.reason).map((x) => [x.id, x.reason])) : undefined;
  const plan = planPurchases(
    products.map((p) => ({ id: p.id, name: p.name, price: p.price, category: p.category })),
    budget,
    reasons
  );

  return NextResponse.json({
    ok: true,
    mode: { analysis: process.env.ANTHROPIC_API_KEY ? "ai" : "basic" },
    budget,
    analysis,
    products,
    spots,
    imageSpots,
    alternatives: buildAlternatives(products, candidates.length ? candidates : all),
    images,
    imageError: images.length === 0 && firstError?.error ? await imageErrorFor(firstError) : null,
    plan,
    quota: quotaStatus,
  });
}
