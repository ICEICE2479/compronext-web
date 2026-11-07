"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bookmark,
  Box,
  Camera,
  Check,
  Columns2,
  ExternalLink,
  Mic,
  MicOff,
  ScanSearch,
  ImagePlus,
  Lightbulb,
  Loader2,
  RefreshCw,
  Repeat2,
  ShoppingCart,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import type { Product } from "@/lib/types";
import { formatTHB } from "@/lib/format";
import { ProductTile, productToCartInput } from "@/components/ProductTile";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ShareButton } from "@/components/ShareButton";
import { openCartDrawer, toast } from "@/lib/toast";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { useVoiceInput } from "@/lib/use-voice-input";
import { haptic } from "@/lib/haptics";
import type { Spot } from "@/lib/hotspots";
import { useCoverMap } from "@/lib/use-cover-map";
import { composeRoomPreview } from "@/lib/room-composite";
import { OWNED_OPTIONS, type BuyPlan } from "@/lib/buy-plan";
import { writeBudget } from "@/lib/budget-store";
import { resizeImageFile } from "@/lib/image-resize";
import { QuotaBadge, type QuotaInfo } from "@/components/design/QuotaBadge";
import { BuyPlanView } from "@/components/design/BuyPlanView";
import { RoomPlanStudio } from "@/components/design/RoomPlanStudio";
import { RoomSizeInputs } from "@/components/design/RoomSizeInputs";
import { PlanCloud } from "@/components/design/PlanCloud";
import { autoLayout, decodePlan, encodePlan, DEFAULT_ROOM, itemFromProduct, type PlanItem, type RoomSize } from "@/lib/room-planner";
import { adviseFromStats, enhancePhoto, measurePhoto } from "@/lib/photo-quality";

const PLAN_KEY = "cn-room-plan-v1";
type SavedPlan = { room: RoomSize; roomSet: boolean; items: PlanItem[]; at?: number };
function loadPlan(): SavedPlan | null {
  try {
    const raw = window.localStorage.getItem(PLAN_KEY);
    const v = raw ? (JSON.parse(raw) as SavedPlan) : null;
    return v && v.room && Array.isArray(v.items) ? v : null;
  } catch {
    return null;
  }
}

interface Analysis {
  roomType: string;
  styleSummary: string;
  picks: Array<{ id: string; reason: string }>;
  tips: string[];
}
interface ImageError {
  code: string;
  message: string;
  detail: string | null;
}

const EXAMPLES = [
  "ห้องนอนมินิมอลโทนขาว-ไม้ งบ 2 หมื่น",
  "มุมทำงานเล็กๆ ข้างหน้าต่าง อยากได้ไฟอุ่นๆ",
  "ห้องเกมโทนดำ ไฟ RGB งบ 5 หมื่น",
  "อยากให้ห้องดูอบอุ่น มีต้นไม้ ไม่รก",
];

const REFINE_EXAMPLES = ["เปลี่ยนผนังเป็นสีเขียวอ่อน", "เอาพรมออก", "ให้แสงอุ่นขึ้นแบบตอนเย็น"];


const STYLE_CARDS = [
  { id: "minimal", label: "มินิมอล", img: "/rooms/w800/real-01-a.webp", phrase: "สไตล์มินิมอล โทนขาว-ไม้ โล่ง สะอาดตา" },
  { id: "cozy", label: "อบอุ่น", img: "/rooms/w800/room-03-a.webp", phrase: "ห้องอบอุ่น ไฟโทนส้ม มีต้นไม้" },
  { id: "gaming", label: "เกมมิ่ง", img: "/rooms/w800/real-04-a.webp", phrase: "ห้องเกมโทนดำ ไฟ RGB" },
  { id: "work", label: "ทำงาน", img: "/rooms/w800/real-14-a.webp", phrase: "มุมทำงานโปรดักทีฟ โต๊ะกว้าง ไฟอ่านหนังสือ" },
  { id: "creator", label: "ครีเอเตอร์", img: "/rooms/w800/real-12-a.webp", phrase: "มุมครีเอเตอร์ จอใหญ่ ไฟถ่ายวิดีโอ" },
  { id: "health", label: "สุขภาพ", img: "/rooms/w800/real-03-a.webp", phrase: "เน้น ergonomic เก้าอี้เพื่อสุขภาพ โต๊ะปรับระดับ" },
] as const;

const STEPS = ["วิเคราะห์รูปห้อง", "เลือกของจากร้านพาร์ตเนอร์", "สร้างภาพห้องใหม่"];
const BUDGET_MAX = 100000;
const DEMO_PHOTO = "/rooms/room-04-a.jpg";
const DEMO_PROMPT = "อยากได้มุมทำงานที่ดูสะอาดตา มีต้นไม้ ไฟอุ่นๆ";
const DEMO_CACHE_KEY = "compronext_demo_result_v1";

interface DemoCache {
  analysis: Analysis | null;
  products: Product[];
  alternatives: Record<string, Product[]>;
  images: string[];
  spots: Record<string, Spot>;
  /** จุดตัวเลขต่อภาพ (วางบนของที่ตรวจเจอในภาพนั้น) */
  imageSpots?: Array<Record<string, Spot>>;
}

const spotsByImage = (images: string[], list: unknown): Record<string, Record<string, Spot>> =>
  Array.isArray(list) ? Object.fromEntries(images.flatMap((u, i) => (list[i] && typeof list[i] === "object" ? [[u, list[i] as Record<string, Spot>]] : []))) : {};

// รูปห้องตัวอย่างให้ลองได้ทันที (เช่นตอนสาธิต)
const SAMPLE_ROOMS = ["/rooms/room-04-a.jpg", "/rooms/room-06-a.jpg", "/rooms/room-10-a.jpg"];
const MAX_RAW_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function cartInput(p: Product) {
  return { ...productToCartInput(p), category: p.category };
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

export function DesignStudio({ loggedIn, demo = false }: { loggedIn: boolean; demo?: boolean }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(demo ? DEMO_PROMPT : "");
  const [style, setStyle] = useState<string | null>(demo ? "cozy" : null);
  const [budget, setBudget] = useState(demo ? 30000 : 0);
  const [step, setStep] = useState(0);
  const [spots, setSpots] = useState<Record<string, Spot>>({});
  const [view, setView] = useState<"shop" | "compare">("shop");
  const [activeSpot, setActiveSpot] = useState<string | null>(null);
  const [imgSpots, setImgSpots] = useState<Record<string, Record<string, Spot>>>({});
  const [fromCache, setFromCache] = useState(false);
  const voice = useVoiceInput((text) => setPrompt((p) => (p ? `${p} ${text}` : text).slice(0, 500)));
  const [twoVariants, setTwoVariants] = useState(false);
  const [busy, setBusy] = useState<null | "design" | "regenerate" | "refine" | "save">(null);
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [alternatives, setAlternatives] = useState<Record<string, Product[]>>({});
  const [images, setImages] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [imageError, setImageError] = useState<ImageError | null>(null);
  const [dirty, setDirty] = useState(false);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [refineText, setRefineText] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  /** กันกดรัว: ระหว่างส่งคำขอ + พัก 5 วิ หลังได้ผล */
  const inflight = useRef(false);
  const [cooling, setCooling] = useState(false);
  const [owned, setOwned] = useState<string[]>([]);
  const [plan, setPlan] = useState<BuyPlan | null>(null);
  /** ภาพที่ระบบวางสินค้าลงรูปห้องเอง (ไม่ใช่ AI) — แก้ภาพด้วยคำสั่งไม่ได้ */
  const [composites, setComposites] = useState<string[]>([]);
  /** โหมด: รูปห้องจริง + AI / ห้อง 3D จัดเอง */
  const [mode, setMode] = useState<"photo" | "plan">("photo");
  const [room, setRoom] = useState<RoomSize>(DEFAULT_ROOM);
  /** ลูกค้ากรอกขนาดห้องเองแล้ว (ส่งให้ AI) */
  const [roomSet, setRoomSet] = useState(false);
  const [planItems, setPlanItemsState] = useState<PlanItem[]>([]);
  const [photoTips, setPhotoTips] = useState<{ tips: string[]; original: Blob | null; blurry: boolean } | null>(null);
  const [fromPlan, setFromPlan] = useState(false);
  const planLoaded = useRef(false);

  // ห้อง 3D ที่จัดไว้ + ขนาดห้อง จำไว้ในเครื่อง
  useEffect(() => {
    // ลิงก์แชร์ห้อง (?plan=...) มาก่อนห้องที่จำไว้ในเครื่อง
    const shared = new URLSearchParams(window.location.search).get("plan");
    const fromLink = shared ? decodePlan(shared) : null;
    const saved = fromLink ? { room: fromLink.room, roomSet: true, items: fromLink.items } : loadPlan();
    queueMicrotask(() => {
      if (fromLink) {
        setMode("plan");
        toast("เปิดห้อง 3D จากลิงก์แชร์แล้ว");
      }
      if (saved) {
        setRoom(saved.room);
        setRoomSet(saved.roomSet);
        setPlanItemsState(saved.items);
      }
      planLoaded.current = true;
    });
    // สมาชิก: ห้องในบัญชีใหม่กว่าในเครื่อง → ใช้ของบัญชี (จัดจากอีกเครื่อง)
    if (!loggedIn || fromLink) return;
    fetch("/api/room-plans", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const cur = d?.ok ? (d.plans as Array<{ id: string; code: string; updatedAt: string }>).find((p) => p.id === "current") : null;
        const plan = cur ? decodePlan(cur.code) : null;
        if (!cur || !plan || Date.parse(cur.updatedAt) <= (saved?.at ?? 0) + 1000) return;
        setRoom(plan.room);
        setRoomSet(true);
        setPlanItemsState(plan.items);
      })
      .catch(() => {});
  }, [loggedIn]);
  useEffect(() => {
    if (!planLoaded.current) return;
    try {
      window.localStorage.setItem(PLAN_KEY, JSON.stringify({ room, roomSet, items: planItems, at: Date.now() } satisfies SavedPlan));
    } catch {
      /* ที่เก็บเต็ม */
    }
    // สมาชิก: บันทึกเข้าบัญชีอัตโนมัติ (รอหยุดแก้ 3 วิ)
    if (!loggedIn || (!roomSet && planItems.length === 0)) return;
    const t = setTimeout(() => {
      void fetch("/api/room-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "current", code: encodePlan(room, planItems) }),
      }).catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, [room, roomSet, planItems, loggedIn]);
  function openPlanCode(code: string) {
    const plan = decodePlan(code);
    if (!plan) return toast("เปิดห้องนี้ไม่ได้", { tone: "error" });
    setRoom(plan.room);
    setRoomSet(true);
    setPlanItemsState(plan.items);
    toast("เปิดห้องแล้ว");
  }
  const setPlanItems = useCallback((fn: (prev: PlanItem[]) => PlanItem[]) => setPlanItemsState(fn), []);
  function changeRoom(r: RoomSize) {
    setRoom(r);
    setRoomSet(true);
  }

  const hasResult = analysis !== null || products.length > 0;
  const currentImage = images[selected] ?? null;
  const isComposite = !!currentImage && composites.includes(currentImage);
  const shownImage = currentImage ?? preview;
  // จุดตัวเลข = % ของภาพจริง → แปลงให้ตรงภาพที่ถูกครอปในกรอบ 4:3
  const photoBoxRef = useRef<HTMLDivElement>(null);
  const toBox = useCoverMap(photoBoxRef, shownImage);
  const stylePhrase = STYLE_CARDS.find((c) => c.id === style)?.phrase ?? "";
  const fullPrompt = [stylePhrase, prompt.trim()].filter(Boolean).join(" · ");
  const generating = busy === "design" || busy === "regenerate";

  useEffect(() => {
    let alive = true;
    fetch("/api/ai-room")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.quota) setQuota(d.quota as QuotaInfo);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // ขั้นตอนระหว่างรอ (คำขอเดียว จึงเดินตามเวลาโดยประมาณ)
  useEffect(() => {
    if (!generating) return;
    const t1 = window.setTimeout(() => setStep(1), 2500);
    const t2 = window.setTimeout(() => setStep(2), 7000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [generating]);

  // โหมดสาธิต: ใส่รูปห้องตัวอย่างให้เลย
  useEffect(() => {
    if (!demo) return;
    let alive = true;
    fetch(DEMO_PHOTO)
      .then((r) => r.blob())
      .then((blob) => {
        if (!alive) return;
        setPhoto(blob);
        setPreview(URL.createObjectURL(blob));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [demo]);

  /** วางสินค้าลงในรูปห้อง (ใช้ตอน AI สร้างภาพไม่ได้) */
  async function addComposite(list: Product[], sp: Record<string, Spot>, replace = false): Promise<boolean> {
    if (!preview) return false;
    const url = await composeRoomPreview(
      preview,
      list.map((p) => ({ id: p.id, category: p.category, imageUrl: p.imageUrl })),
      sp
    );
    if (!url) return false;
    setComposites((c) => [url, ...c]);
    setImages((prev) => (replace ? [url, ...prev.filter((x) => !composites.includes(x))] : [url, ...prev]));
    setSelected(0);
    return true;
  }

  /** ห้อง 3D → ส่งให้ AI วาดเป็นห้องจริง (ทางออกของคนที่ไม่มีรูป/กล้องไม่ชัด) */
  async function usePlanAsPhoto(blob: Blob, planSpots: Record<string, Spot>) {
    if (preview) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(blob);
    const snapshotUrl = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(blob);
    });
    setPhoto(blob);
    setPreview(url);
    setPhotoTips(null);
    setFromPlan(true);
    setMode("photo");
    const ids = [...new Set(planItems.map((i) => i.productId).filter((x): x is string => !!x))];
    await design({ photo: blob, productIds: ids, snapshotUrl, spots: planSpots });
  }

  /** เปิดโหมดห้อง 3D — ถ้ายังว่างและมีผล AI แล้ว ใส่ของที่ AI เลือกให้เลย */
  function openPlan() {
    setMode("plan");
    if (!planItems.length && products.length) setPlanItems(() => autoLayout(products.map((p) => itemFromProduct(p)), room));
  }

  function applyResult(r: DemoCache) {
    setAnalysis(r.analysis);
    setProducts(r.products);
    setAlternatives(r.alternatives ?? {});
    setImages(r.images ?? []);
    setSpots(r.spots ?? {});
    setImgSpots(spotsByImage(r.images ?? [], r.imageSpots));
    setSelected(0);
    setView("shop");
    setActiveSpot(null);
    setDirty(false);
  }

  /** โหมดสาธิต: ใช้ผลลัพธ์จริงครั้งก่อนที่เก็บไว้ (กันเน็ต/คีย์ล่มตอนนำเสนอ) */
  function loadDemoCache(): boolean {
    try {
      const raw = window.localStorage.getItem(DEMO_CACHE_KEY);
      if (!raw) return false;
      applyResult(JSON.parse(raw) as DemoCache);
      setImageError(null);
      setFromCache(true);
      toast("ใช้ผลลัพธ์สาธิตที่บันทึกไว้ครั้งก่อน");
      return true;
    } catch {
      return false;
    }
  }
  const reasons = new Map(analysis?.picks.map((p) => [p.id, p.reason]));
  const total = products.reduce((s, p) => s + p.price, 0);

  async function pickSample(src: string) {
    const blob = await fetch(src).then((r) => r.blob());
    await onPick(new File([blob], "sample-room.jpg", { type: blob.type || "image/jpeg" }));
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("ไฟล์นี้ไม่ใช่รูปภาพ เลือกไฟล์ JPG / PNG / WebP นะ");
    if (file.size > MAX_RAW_BYTES) return setError("รูปใหญ่เกินไป (เกิน 15 MB) ลองเลือกรูปอื่น");
    let small: Blob = await resizeImageFile(file);
    if (small.size > MAX_UPLOAD_BYTES) return setError("รูปยังใหญ่เกิน 4 MB หลังย่อ ลองเลือกรูปอื่น");
    // กล้องไม่ดี/ห้องมืด → ปรับแสงให้อัตโนมัติ + บอกวิธีถ่ายให้ดีขึ้น
    setPhotoTips(null);
    setFromPlan(false);
    try {
      const stats = await measurePhoto(small);
      const advice = adviseFromStats(stats);
      if (advice.enhance) {
        const better = await enhancePhoto(small, stats);
        setPhotoTips({ tips: advice.tips, original: small, blurry: advice.blurry });
        small = better;
      } else if (advice.tips.length) setPhotoTips({ tips: advice.tips, original: null, blurry: advice.blurry });
    } catch {
      /* เบราว์เซอร์เก่า วัดไม่ได้ — ใช้รูปเดิม */
    }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(small);
    setPreview(URL.createObjectURL(small));
    setError(null);
    setAnalysis(null);
    setProducts([]);
    setImages([]);
    setImageError(null);
    setShareUrl(null);
    setSpots({});
    setPlan(null);
    setFromCache(false);
  }

  async function callApi(fd: FormData) {
    if (inflight.current) throw new Error("กำลังทำงานอยู่ รอสักครู่นะ");
    inflight.current = true;
    let res: Response;
    try {
      res = await fetch("/api/ai-room", { method: "POST", body: fd });
    } finally {
      inflight.current = false;
      setCooling(true);
      setTimeout(() => setCooling(false), 5000);
    }
    const data = await res.json().catch(() => ({ ok: false, error: "เชื่อมต่อไม่สำเร็จ" }));
    if (data?.quota) setQuota(data.quota as QuotaInfo);
    if (res.status === 429) throw new Error(data.error || "วันนี้ใช้ AI ครบโควตาแล้ว ไว้มาใหม่หลังเที่ยงคืนนะ");
    if (!data.ok) throw new Error(data.error || "AI ทำงานไม่สำเร็จ ลองใหม่อีกครั้ง");
    return data;
  }

  /**
   * plan = มาจากห้อง 3D: ใช้ภาพห้อง 3D เป็นรูปอ้างอิง + ของในห้อง 3D (ถ้าเป็นสินค้าจริง)
   * ถ้า AI วาดภาพไม่ได้ ใช้ภาพห้อง 3D นั้นแสดงแทน
   */
  async function design(plan?: { photo: Blob; productIds: string[]; snapshotUrl: string; spots: Record<string, Spot> }) {
    const ph = plan?.photo ?? photo;
    if (!ph) return setError("ถ่ายหรือเลือกรูปห้องก่อนนะ");
    if (fullPrompt.length < 3 && !plan) return setError("เลือกสไตล์ หรือบอก AI หน่อยว่าอยากได้ห้องแบบไหน");
    setStep(0);
    setBusy("design");
    setError(null);
    setShareUrl(null);
    setFromCache(false);
    const fd = new FormData();
    fd.append("photo", ph, "room.jpg");
    if (plan) {
      fd.append("source", "plan3d");
      if (plan.productIds.length) {
        fd.append("mode", "regenerate");
        fd.append("productIds", plan.productIds.join(","));
      }
    } else if (fromPlan) fd.append("source", "plan3d");
    fd.append("prompt", fullPrompt.length >= 3 ? fullPrompt : "ห้องที่จัดตามภาพ 3D ให้สวยและใช้งานได้จริง");
    fd.append("variants", twoVariants ? "2" : "1");
    if (budget > 0) fd.append("budget", String(budget));
    if (owned.length > 0) fd.append("owned", owned.join(","));
    if (roomSet || plan) fd.append("room", `${room.w},${room.d},${room.h}`);
    writeBudget(budget > 0 ? budget : null);
    try {
      const data = await callApi(fd);
      const result: DemoCache = {
        analysis: data.analysis,
        products: data.products,
        alternatives: data.alternatives ?? {},
        images: data.images ?? [],
        spots: data.spots ?? {},
        imageSpots: data.imageSpots,
      };
      if (demo && result.images.length === 0 && loadDemoCache()) return;
      applyResult(result);
      setPlan((data.plan as BuyPlan | undefined) ?? null);
      setImageError(data.imageError);
      if (!result.images.length) {
        if (plan) {
          // AI ใช้ไม่ได้ → โชว์ภาพห้อง 3D ที่จัดไว้แทน (จุดแตะตรงตำแหน่งของในห้อง 3D)
          setSpots((sp) => ({ ...sp, ...plan.spots }));
          setComposites((c) => [plan.snapshotUrl, ...c]);
          setImages([plan.snapshotUrl]);
          setSelected(0);
        } else await addComposite(result.products, result.spots);
      }
      haptic([10, 40, 10]);
      if (demo && result.images.length > 0) {
        try {
          window.localStorage.setItem(DEMO_CACHE_KEY, JSON.stringify({ ...result, images: result.images.slice(0, 1) }));
        } catch {
          // ที่เก็บเต็ม — ข้ามไป
        }
      }
    } catch (e) {
      if (demo && loadDemoCache()) return;
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    if (!photo) return;
    setStep(1);
    setBusy("regenerate");
    setError(null);
    setShareUrl(null);
    const fd = new FormData();
    fd.append("mode", "regenerate");
    fd.append("photo", photo, "room.jpg");
    fd.append("prompt", fullPrompt);
    if (budget > 0) fd.append("budget", String(budget));
    if (owned.length > 0) fd.append("owned", owned.join(","));
    if (roomSet || fromPlan) fd.append("room", `${room.w},${room.d},${room.h}`);
    if (fromPlan) fd.append("source", "plan3d");
    fd.append("productIds", products.map((p) => p.id).join(","));
    try {
      const data = await callApi(fd);
      setAlternatives(data.alternatives ?? alternatives);
      setImages((prev) => [...(data.images ?? []), ...prev]);
      if (data.spots) setSpots(data.spots);
      setImgSpots((m) => ({ ...m, ...spotsByImage(data.images ?? [], data.imageSpots) }));
      if (data.plan) setPlan(data.plan as BuyPlan);
      setImageError(data.imageError);
      if (!data.images?.length) await addComposite(products, data.spots ?? spots, true);
      setSelected(0);
      setView("shop");
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function refine() {
    if (!currentImage || refineText.trim().length < 2) return;
    setBusy("refine");
    setError(null);
    setShareUrl(null);
    const fd = new FormData();
    fd.append("mode", "refine");
    const base = await dataUrlToBlob(currentImage);
    fd.append("photo", await resizeImageFile(new File([base], "base.png", { type: base.type || "image/png" })), "base.jpg");
    fd.append("instruction", refineText.trim());
    try {
      const data = await callApi(fd);
      if (data.images?.length) {
        setImages((prev) => [data.images[0], ...prev]);
        setSelected(0);
        setRefineText("");
      }
      setImageError(data.imageError);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function swap(oldId: string, next: Product) {
    setPlan(null);
    setProducts((list) => list.map((p) => (p.id === oldId ? next : p)));
    setSpots(({ [oldId]: spot, ...rest }) => (spot ? { ...rest, [next.id]: spot } : rest));
    setAlternatives((alts) => {
      const old = products.find((p) => p.id === oldId);
      const pool = (alts[oldId] ?? []).filter((p) => p.id !== next.id);
      const { [oldId]: _removed, ...rest } = alts;
      void _removed;
      return { ...rest, [next.id]: old ? [old, ...pool] : pool };
    });
    setSwapFor(null);
    if (isComposite && !fromPlan) {
      // ภาพแบบวางสินค้า: วาดใหม่ทันที ไม่ต้องรอ AI
      const list = products.map((p) => (p.id === oldId ? next : p));
      const { [oldId]: spot, ...rest } = spots;
      void addComposite(list, spot ? { ...rest, [next.id]: spot } : rest, true);
      return;
    }
    setDirty(true);
  }

  async function save() {
    if (!currentImage) return;
    setBusy("save");
    setError(null);
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: currentImage, prompt, productIds: products.map((p) => p.id) }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setShareUrl(data.shareUrl);
      toast("บันทึกห้องแล้ว แชร์ลิงก์ได้เลย");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* เลือกโหมด: รูปห้องจริง หรือ ห้อง 3D จัดเอง (ใช้ร่วมกัน: ของที่ AI เลือก ↔ ห้อง 3D ↔ ภาพ AI) */}
      <div className="inline-flex rounded-full bg-ink-100 p-1" role="tablist" aria-label="วิธีจัดห้อง">
        {(
          [
            ["photo", "รูปห้อง + AI", Camera],
            ["plan", "ห้อง 3D จัดเอง", Box],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => (k === "plan" ? openPlan() : setMode("photo"))}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${mode === k ? "bg-surface text-ink-950 shadow-sm" : "text-ink-600 hover:text-ink-900"}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

    <div className="grid items-start gap-6 lg:grid-cols-12">
      {/* ซ้าย: รูปห้อง / ห้อง 3D */}
      <section className="min-w-0 space-y-3 lg:col-span-7">
        {mode === "plan" ? (
          <>
            <RoomPlanStudio room={room} items={planItems} setItems={setPlanItems} onRoomChange={changeRoom} aiProducts={products} onUseAsPhoto={usePlanAsPhoto} />
            <PlanCloud loggedIn={loggedIn} code={mode === "plan" ? encodePlan(room, planItems) : ""} onOpen={openPlanCode} />
          </>
        ) : (
        <>
        <div ref={photoBoxRef} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-ink-200 bg-ink-50">
          {shownImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shownImage} alt="รูปห้อง" width={1200} height={800} decoding="async" className="h-full w-full object-cover" />
              {!busy && (
                <button type="button" className="icon-btn absolute right-3 top-3 bg-white/90" aria-label="เปลี่ยนรูปห้อง" onClick={() => galleryRef.current?.click()}>
                  <X className="h-4 w-4" />
                </button>
              )}
              {currentImage && view === "shop" && (
                <div className="absolute inset-0" onClick={() => setActiveSpot(null)}>
                  {products.map((p, i) => {
                    const raw = (imgSpots[currentImage] ?? spots)[p.id];
                    if (!raw) return null;
                    const sp = toBox(raw.x, raw.y);
                    if (!sp.visible) return null;
                    const open = activeSpot === p.id;
                    return (
                      <div key={p.id} className="absolute" style={{ left: `${sp.x}%`, top: `${sp.y}%` }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic(8);
                            setActiveSpot(open ? null : p.id);
                          }}
                          aria-label={`ดู ${p.name}`}
                          className={`hotspot -translate-x-1/2 -translate-y-1/2 ${open ? "is-open" : ""}`}
                        >
                          {i + 1}
                        </button>
                        {open && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute z-10 w-56 rounded-xl bg-white p-2.5 text-left shadow-xl ${sp.y > 55 ? "bottom-6" : "top-6"} ${sp.x > 60 ? "right-0" : sp.x < 40 ? "left-0" : "-left-28"}`}
                          >
                            <p className="line-clamp-2 text-xs font-semibold text-ink-950">{p.name}</p>
                            <p className="mt-0.5 text-[11px] text-ink-500">{p.storeName || p.platform}</p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="font-display text-base font-bold text-ink-950">{formatTHB(p.price)}</span>
                              <span className="flex gap-1">
                                <Link href={`/products/${p.id}`} className="icon-btn h-9 w-9 p-0" aria-label="ดูสินค้า">
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                                <AddToCartButton item={cartInput(p)} className="h-9 w-9 p-0" />
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {currentImage && view === "compare" && preview && <BeforeAfterSlider before={preview} after={currentImage} />}
              {currentImage && preview && !busy && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSpot(null);
                    setView(view === "shop" ? "compare" : "shop");
                  }}
                  className="absolute bottom-3 left-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-xs font-semibold text-ink-900 shadow"
                >
                  {view === "shop" ? <Columns2 className="h-4 w-4" /> : <ScanSearch className="h-4 w-4" />}
                  {view === "shop" ? "เทียบก่อน/หลัง" : "แตะดูของในภาพ"}
                </button>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <Camera className="h-12 w-12 text-ink-300" />
              <p className="text-sm text-ink-600">ถ่ายรูปห้องให้เห็นมุมกว้าง แสงสว่างพอ</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className="icon-btn icon-btn-primary" onClick={() => cameraRef.current?.click()}>
                  <Camera className="h-4 w-4" /> ถ่ายรูป
                </button>
                <button type="button" className="icon-btn" onClick={() => galleryRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> เลือกจากเครื่อง
                </button>
              </div>
              <button type="button" onClick={openPlan} className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-3.5 py-2 text-xs font-semibold text-info hover:brightness-95">
                <Box className="h-4 w-4" /> กล้องไม่ชัด / ไม่มีรูป? สร้างห้อง 3D จากขนาดที่วัดได้
              </button>
              <div className="space-y-1.5">
                <p className="text-[11px] text-ink-500">หรือลองด้วยรูปห้องตัวอย่าง</p>
                <div className="flex justify-center gap-2">
                  {SAMPLE_ROOMS.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => pickSample(src)}
                      className="h-14 w-20 overflow-hidden rounded-lg border border-ink-200 hover:border-info"
                      aria-label="ใช้รูปห้องตัวอย่าง"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" width={400} height={300} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {busy && busy !== "save" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink-950/60 p-6 text-white">
              {busy === "refine" ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin" />
                  <p className="text-sm font-semibold">AI กำลังแก้ภาพ…</p>
                </>
              ) : (
                <ol className="space-y-2.5" aria-live="polite">
                  {STEPS.map((label, i) => (
                    <li key={label} className={`flex items-center gap-2.5 text-sm transition-opacity ${i > step ? "opacity-45" : ""}`}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
                        {i < step ? <Check className="h-4 w-4" /> : i === step ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-[11px]">{i + 1}</span>}
                      </span>
                      <span className={i === step ? "font-semibold" : ""}>{label}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-[11px] text-white/70">ประมาณ 20–60 วินาที</p>
            </div>
          )}
        </div>
        {photoTips && !hasResult && (
          <div className="scene-chip space-y-2 rounded-xl border border-info/20 bg-info-bg p-3 text-xs text-ink-800">
            <ul className="space-y-0.5">
              {photoTips.tips.map((t) => (
                <li key={t} className="flex gap-1.5">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" /> {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {photoTips.original && (
                <button
                  type="button"
                  onClick={() => {
                    if (!photoTips.original) return;
                    if (preview) URL.revokeObjectURL(preview);
                    setPhoto(photoTips.original);
                    setPreview(URL.createObjectURL(photoTips.original));
                    setPhotoTips(null);
                  }}
                  className="rounded-full border border-ink-300 bg-surface px-3 py-1.5 font-semibold text-ink-800"
                >
                  ใช้รูปเดิม (ไม่ปรับแสง)
                </button>
              )}
              {photoTips.blurry && (
                <button type="button" onClick={openPlan} className="rounded-full bg-info px-3 py-1.5 font-semibold text-white">
                  ใช้ห้อง 3D แทน
                </button>
              )}
            </div>
          </div>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPick(e.target.files?.[0])} />
        <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={src.slice(-40) + i}
                type="button"
                onClick={() => {
                  setSelected(i);
                  setActiveSpot(null);
                }}
                className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === selected ? "border-info" : "border-transparent"}`}
                aria-label={`ภาพแบบที่ ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" width={400} height={300} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {imageError && hasResult && !isComposite && (
          <div
            className={`flex gap-2 rounded-xl border p-3 text-xs text-ink-800 ${
              imageError.code === "no_key" ? "border-info/20 bg-info-bg" : "border-warn/30 bg-warn-bg"
            }`}
          >
            <AlertTriangle className={`h-4 w-4 shrink-0 ${imageError.code === "no_key" ? "text-info" : "text-warn"}`} />
            <div>
              <p className="font-semibold">{imageError.message} — ดูสินค้าที่ระบบเลือกให้ได้เลย</p>
              {imageError.detail && <p className="mt-0.5 break-words text-ink-600">{imageError.detail}</p>}
            </div>
          </div>
        )}
        {currentImage && (
          <p className="text-[11px] text-ink-500">
            {isComposite
              ? fromPlan
                ? "ภาพจากห้อง 3D ที่คุณจัด (ยังไม่ได้ให้ AI วาดเป็นภาพจริง) · แตะตัวเลขบนภาพเพื่อดูสินค้า"
                : "ภาพจำลองวางสินค้าลงในรูปห้องของคุณ (ขนาด/มุมโดยประมาณ) · แตะตัวเลขบนภาพเพื่อดูสินค้า · กดเปลี่ยนชิ้นแล้วภาพอัปเดตทันที"
              : `${fromCache ? "ผลลัพธ์สาธิตที่บันทึกไว้ครั้งก่อน · " : ""}ภาพจำลองโดย AI ของจริงอาจต่างเล็กน้อย · แตะตัวเลขบนภาพเพื่อดูสินค้า`}
          </p>
        )}

        {/* แก้ภาพต่อ (เฉพาะภาพจาก AI) */}
        {currentImage && !isComposite && (
          <div className="card space-y-2 p-4">
            <label htmlFor="refine" className="flex items-center gap-1.5 text-sm font-bold text-ink-950">
              <Wand2 className="h-4 w-4 text-info" /> อยากให้แก้อะไรในภาพนี้?
            </label>
            <div className="flex gap-2">
              <input
                id="refine"
                value={refineText}
                maxLength={300}
                onChange={(e) => setRefineText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refine()}
                placeholder="เช่น เปลี่ยนผนังเป็นสีเขียวอ่อน"
                className="input flex-1"
              />
              <button type="button" disabled={!!busy || cooling || refineText.trim().length < 2} onClick={refine} className="icon-btn icon-btn-primary h-11">
                {busy === "refine" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {REFINE_EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => setRefineText(ex)} className="rounded-full border border-ink-200 px-2.5 py-0.5 text-[11px] text-ink-700 hover:border-info hover:text-info">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        </>
        )}
      </section>

      {/* ขวา: บอกความต้องการ */}
      <section className="min-w-0 space-y-4 lg:col-span-5">
        <div className="card space-y-3 p-5">
          <QuotaBadge quota={quota} guest={!loggedIn} />
          <p className="font-display text-lg font-bold text-ink-950">อยากได้ห้องแบบไหน?</p>
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
            {STYLE_CARDS.map((c) => {
              const on = style === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    haptic(8);
                    setStyle(on ? null : c.id);
                  }}
                  className={`relative h-20 w-28 shrink-0 snap-start overflow-hidden rounded-xl border-2 text-left sm:w-auto ${on ? "border-info" : "border-transparent"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.img} alt="" width={400} height={300} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <span className="absolute bottom-1.5 left-2 text-xs font-bold text-white">{c.label}</span>
                  {on && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-info text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative">
            <label htmlFor="design-prompt" className="sr-only">รายละเอียดเพิ่มเติม</label>
            <textarea
              id="design-prompt"
              rows={3}
              maxLength={500}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={voice.supported ? "พิมพ์หรือกดไมค์พูด เช่น อยากได้ที่เก็บของเยอะๆ" : "เช่น อยากได้ที่เก็บของเยอะๆ มีต้นไม้"}
              className="input resize-none pr-14"
            />
            {voice.supported && (
              <button
                type="button"
                onClick={voice.toggle}
                aria-pressed={voice.listening}
                aria-label={voice.listening ? "หยุดฟัง" : "พูดแทนพิมพ์"}
                className={`icon-btn absolute bottom-2 right-2 h-10 w-10 p-0 ${voice.listening ? "icon-btn-primary animate-pulse" : "bg-white"}`}
              >
                {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
          </div>
          <RoomSizeInputs room={room} set={roomSet} onChange={changeRoom} />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="budget" className="font-semibold text-ink-800">งบรวม</label>
              <span className="font-display font-bold text-ink-950">{budget > 0 ? formatTHB(budget) : "ไม่จำกัด"}</span>
            </div>
            <input
              id="budget"
              type="range"
              min={0}
              max={BUDGET_MAX}
              step={1000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-[var(--color-info)]"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                aria-label="งบรวม (บาท)"
                value={budget > 0 ? budget : ""}
                placeholder="พิมพ์งบ (บาท)"
                onChange={(e) => setBudget(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                className="input flex-1"
              />
              <span className="text-sm text-ink-600">บาท</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-ink-800">มีของเหล่านี้อยู่แล้ว (ไม่ต้องแนะนำซ้ำ)</p>
            <div className="flex flex-wrap gap-1.5">
              {OWNED_OPTIONS.map((o) => {
                const on = owned.includes(o.category);
                return (
                  <button
                    key={o.category}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setOwned((l) => (on ? l.filter((c) => c !== o.category) : [...l, o.category]))}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-1 text-xs ${on ? "border-info bg-info-bg font-semibold text-info" : "border-ink-200 text-ink-700 hover:border-info"}`}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setPrompt(ex)} className="rounded-full border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:border-info hover:text-info">
                {ex}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={twoVariants} onChange={(e) => setTwoVariants(e.target.checked)} />
            ขอ 2 แบบให้เลือก (ใช้โควตา 2 ครั้ง)
          </label>
          {error && <p className="rounded-lg bg-bad-bg p-3 text-xs font-semibold text-bad">{error}</p>}
          <button type="button" disabled={!!busy || cooling || (quota !== null && quota.remaining <= 0 && !(quota.credits ?? 0))} onClick={() => design()} className="btn btn-primary w-full py-3">
            {busy === "design" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span>{busy === "design" ? "กำลังจัดห้อง..." : cooling ? "รอสักครู่…" : hasResult ? "จัดใหม่ทั้งหมด" : "ให้ AI จัดห้อง"}</span>
          </button>
          <p className="text-[11px] text-ink-500">รูปห้องใช้เพื่อสร้างภาพครั้งนี้เท่านั้น ไม่ถูกเก็บไว้ (ยกเว้นคุณกดบันทึกเอง)</p>
        </div>

        {analysis && (
          <div className="card space-y-3 p-5">
            <p className="text-xs font-semibold text-info">{analysis.roomType}</p>
            <p className="text-sm text-ink-800">{analysis.styleSummary}</p>
            {analysis.tips.length > 0 && (
              <ul className="space-y-1.5">
                {analysis.tips.map((t) => (
                  <li key={t} className="flex gap-2 text-xs text-ink-600">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 text-warn" />
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {currentImage && (
          <div className="card space-y-3 p-5">
            {shareUrl ? (
              <>
                <p className="text-sm font-semibold text-ok">บันทึกแล้ว ✓</p>
                <div className="flex flex-wrap gap-2">
                  <ShareButton title={prompt || "ห้องที่ AI จัดให้"} url={shareUrl} />
                  <Link href={shareUrl} className="icon-btn h-11 px-4 text-sm font-semibold">
                    เปิดหน้าแชร์
                  </Link>
                </div>
              </>
            ) : loggedIn ? (
              <button type="button" disabled={!!busy} onClick={save} className="icon-btn h-11 w-full">
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
                <span className="text-sm font-semibold">บันทึกห้องนี้ & รับลิงก์แชร์</span>
              </button>
            ) : (
              <Link href="/login" className="icon-btn h-11 w-full text-sm font-semibold">
                <Bookmark className="h-4 w-4" /> เข้าสู่ระบบเพื่อบันทึก & แชร์
              </Link>
            )}
          </div>
        )}
      </section>

      {hasResult && (
        <section className="space-y-4 lg:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-ink-950">
              ของในห้องนี้ ({products.length} ชิ้น) · {formatTHB(total)}
            </h2>
            {mode === "photo" && (
              <button
                type="button"
                onClick={() => {
                  setMode("plan");
                  // ใส่ของที่ AI เลือกที่ยังไม่อยู่ในห้อง 3D
                  setPlanItems((list) => {
                    const missing = products.filter((p) => !list.some((i) => i.productId === p.id)).map((p) => itemFromProduct(p));
                    return missing.length ? [...list, ...autoLayout([...list, ...missing], room).slice(list.length)] : list;
                  });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="btn btn-outline h-10 rounded-full px-4 text-sm"
              >
                <Box className="h-4 w-4" /> จัดวางเองในห้อง 3D
              </button>
            )}
            {products.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dirty && (
                  <button type="button" disabled={!!busy || cooling} onClick={regenerate} className="icon-btn h-11 px-4">
                    {busy === "regenerate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="text-sm font-semibold">สร้างภาพใหม่ด้วยของที่เลือก</span>
                  </button>
                )}
                <AddToCartButton item={products.map((p) => cartInput(p))} label="ใส่ตะกร้าทั้งชุด" className="h-11" />
                <button type="button" onClick={openCartDrawer} className="icon-btn h-11" aria-label="ดูตะกร้า">
                  <ShoppingCart className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {plan && products.length > 0 && !dirty && (
            <BuyPlanView
              plan={plan}
              savings={products.reduce((sum, p) => {
                const cheapest = Math.min(...(alternatives[p.id] ?? []).map((a) => a.price));
                return sum + (Number.isFinite(cheapest) && cheapest < p.price ? p.price - cheapest : 0);
              }, 0)}
            />
          )}
          {products.length === 0 ? (
            <p className="text-sm text-ink-600">ยังหาสินค้าที่ตรงไม่เจอ ลองพิมพ์รายละเอียดเพิ่ม หรือขยายงบ</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <div key={p.id} className="relative space-y-1.5">
                  {spots[p.id] && currentImage && (
                    <span className="pointer-events-none absolute left-2 top-2 z-[1] flex h-6 w-6 items-center justify-center rounded-full bg-ink-950 text-[11px] font-bold text-white">{i + 1}</span>
                  )}
                  <ProductTile product={p} />
                  <div className="flex items-start justify-between gap-2 px-1">
                    <p className="text-[11px] text-ink-500">{reasons.get(p.id) ?? ""}</p>
                    {(alternatives[p.id]?.length ?? 0) > 0 && (
                      <button type="button" onClick={() => setSwapFor(swapFor === p.id ? null : p.id)} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-info">
                        <Repeat2 className="h-3.5 w-3.5" /> เปลี่ยน
                      </button>
                    )}
                  </div>
                  {swapFor === p.id && (
                    <ul className="space-y-1 rounded-xl border border-ink-200 bg-white p-2">
                      {alternatives[p.id].map((alt) => (
                        <li key={alt.id}>
                          <button type="button" onClick={() => swap(p.id, alt)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-ink-50">
                            <span className="line-clamp-1 text-ink-800">{alt.name}</span>
                            <span className="shrink-0 font-semibold text-ink-950">{formatTHB(alt.price)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
    </div>
  );
}
