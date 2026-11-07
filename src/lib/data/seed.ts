/**
 * ข้อมูลทดลอง (SAMPLE DATA) — ยังไม่ได้ตรวจสอบกับร้านค้าจริง
 * - ราคาเป็นราคาประมาณการเพื่อทดสอบระบบเท่านั้น
 * - buyUrl เป็น "ลิงก์ค้นหา" บนแพลตฟอร์ม ไม่ใช่ลิงก์สินค้าที่ยืนยันแล้ว
 * - สถานะสต็อกบางชิ้นถูกตั้งเป็น "หมด/ลิงก์เสีย" เพื่อสาธิตการแสดงผล
 * แทนที่ด้วยข้อมูลจริงผ่านหน้า Admin หรือ CSV import
 */
import { searchLink, type SamplePlatform } from "../links";
import { resolveRealProductImage } from "../product-images";
import type { Dimensions, Placement, Product, ProductCategory, ProductStatus, Room } from "../types";

interface P {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  colors: string[];
  materials?: string[];
  dims?: [number | null, number | null, number | null] | null;
  placement?: Placement;
  ports?: string[];
  specs?: Record<string, string>;
  description?: string;
  platform?: SamplePlatform;
  status?: ProductStatus;
  date?: string;
  query?: string;
}

const DEFAULT_PLACEMENT: Record<ProductCategory, Placement> = {
  desk: "floor",
  computer: "floor",
  monitor: "desk",
  mouse: "desk",
  keyboard: "desk",
  mousepad: "desk",
  keyboard_pad: "desk",
  microphone: "other",
  headphone: "other",
  speaker: "desk",
  webcam: "other",
  chair: "floor",
  lighting: "other",
  monitor_arm: "desk",
  decor: "desk",
  storage: "floor",
  wardrobe: "floor",
  bed: "floor",
  plant_pot: "desk",
  fake_plant: "desk",
  real_plant: "desk",
  rug: "floor",
  other: "other",
};

function defaultPlatformForCategory(category: ProductCategory): SamplePlatform {
  if (category === "computer" || category === "monitor") return "JIB";
  if (category === "keyboard" || category === "mouse" || category === "headphone" || category === "microphone") return "iHAVECPU";
  if (category === "wardrobe" || category === "bed" || category === "storage" || category === "plant_pot" || category === "fake_plant" || category === "rug") return "IKEA";
  return "Shopee";
}

function p(o: P): Product {
  const platform = o.platform ?? defaultPlatformForCategory(o.category);
  const dims: Dimensions | null =
    o.dims === null || o.dims === undefined
      ? null
      : { width: o.dims[0], depth: o.dims[1], height: o.dims[2], unit: "cm" };
  return {
    id: o.id,
    name: o.name,
    description:
      o.description ?? `${o.name} — สินค้าคัดสรรพร้อมเปรียบเทียบราคาจาก JIB, iHAVECPU, Advice, IKEA, Shopee และร้านค้าชั้นนำ`,
    imageUrl: resolveRealProductImage({ id: o.id, name: o.name, category: o.category }),
    price: o.price,
    currency: "THB",
    buyUrl: searchLink(platform, o.query ?? o.name.replace(/\s*\(.*?\)\s*/g, " ").trim()),
    storeName: `${platform} & ร้านค้าชั้นนำ`,
    platform,
    category: o.category,
    colors: o.colors,
    materials: o.materials ?? [],
    dimensions: dims,
    ports: o.ports ?? [],
    specs: o.specs ?? {},
    placement: o.placement ?? DEFAULT_PLACEMENT[o.category],
    status: o.status ?? "available",
    priceUpdatedAt: o.date ?? "2026-10-28",
    isSample: false,
  };
}

const GPU_PORTS = ["HDMI 2.1", "DisplayPort 1.4a", "DisplayPort 1.4a", "DisplayPort 1.4a"];

export const SEED_PRODUCTS: Product[] = [
  // ---------- Room 1: Gaming RGB Black ----------
  p({ id: "desk-gaming-carbon-140", name: "โต๊ะเกมมิ่งท็อปลายคาร์บอน 140×70 ซม.", category: "desk", price: 4990, colors: ["black"], materials: ["steel", "mdf"], dims: [140, 70, 75], specs: { "รับน้ำหนัก": "80 กก.", "ขาโต๊ะ": "เหล็กทรง Z" }, query: "โต๊ะเกมมิ่ง คาร์บอน 140 ซม" }),
  p({ id: "pc-gaming-4070s-7800x3d", name: "คอมประกอบเกมมิ่ง RTX 4070 SUPER / Ryzen 7 7800X3D", category: "computer", price: 58900, colors: ["black"], materials: ["steel", "glass"], dims: [23, 45, 48], ports: GPU_PORTS, specs: { CPU: "Ryzen 7 7800X3D", GPU: "RTX 4070 SUPER 12GB", RAM: "32GB DDR5-6000", SSD: "1TB NVMe Gen4", PSU: "750W 80+ Gold" }, query: "คอมประกอบ RTX 4070 SUPER 7800X3D" }),
  p({ id: "mon-27-qhd-170-ips", name: "จอเกม 27 นิ้ว QHD 170Hz IPS", category: "monitor", price: 8990, colors: ["black"], materials: ["plastic"], dims: [61.4, 21, 46], ports: ["HDMI 2.0", "HDMI 2.0", "DisplayPort 1.4"], specs: { "ความละเอียด": "2560×1440", "รีเฟรชเรต": "170Hz", "พาเนล": "IPS 1ms", VESA: "100×100" }, query: "จอ 27 นิ้ว 2K 170Hz IPS" }),
  p({ id: "kb-75-rgb-black", name: "คีย์บอร์ดเมคานิคอล 75% RGB Hot-swap", category: "keyboard", price: 2490, colors: ["black"], materials: ["aluminum", "plastic"], dims: [32, 14, 4], specs: { "สวิตช์": "Linear", "การเชื่อมต่อ": "USB-C / 2.4G / Bluetooth" }, query: "คีย์บอร์ด mechanical 75% RGB hotswap" }),
  p({ id: "mouse-gaming-58g-black", name: "เมาส์เกมไร้สายน้ำหนักเบา 58 กรัม", category: "mouse", price: 1890, colors: ["black"], materials: ["plastic"], dims: [6.3, 12, 4], specs: { "เซนเซอร์": "26K DPI", "น้ำหนัก": "58 g" } }),
  p({ id: "pad-xxl-rgb-90", name: "แผ่นรองเมาส์ XXL ไฟ RGB 90×40 ซม.", category: "mousepad", price: 890, colors: ["black"], materials: ["fabric", "rubber"], dims: [90, 40, 0.4], query: "แผ่นรองเมาส์ RGB 90x40" }),
  p({ id: "hs-gaming-71-black", name: "หูฟังเกมมิ่งเสียงรอบทิศทาง 7.1", category: "headphone", price: 1990, colors: ["black"], materials: ["plastic", "pu_leather"], dims: [18, 9, 20], specs: { "การเชื่อมต่อ": "USB / 3.5 มม." } }),
  p({ id: "chair-gaming-black", name: "เก้าอี้เกมมิ่งหนัง PU ปรับเอน 155°", category: "chair", price: 5490, colors: ["black"], materials: ["pu_leather", "steel"], dims: [70, 70, 130], specs: { "รับน้ำหนัก": "150 กก." } }),
  p({ id: "light-strip-rgb-5m", name: "ไฟเส้น LED Strip RGB 5 เมตร ควบคุมผ่านแอป", category: "lighting", price: 590, colors: ["black"], placement: "wall", specs: { "ความยาว": "5 ม.", "ควบคุม": "แอป / รีโมท / ซิงค์เพลง" } }),
  p({ id: "lightbar-monitor-black", name: "ไฟแขวนจอ Monitor Light Bar ปรับอุณหภูมิสี", category: "lighting", price: 1290, colors: ["black"], materials: ["aluminum"], dims: [45, 9, 3], placement: "other" }),
  p({ id: "spk-21-rgb", name: "ลำโพง 2.1 พร้อมซับวูฟเฟอร์ ไฟ RGB", category: "speaker", price: 1490, colors: ["black"], materials: ["plastic", "mdf"], dims: [30, 10, 20], specs: { "กำลังขับ": "40W RMS", "หมายเหตุ": "ขนาดบนโต๊ะคือคู่ลำโพงหน้า ซับวางพื้น" } }),
  p({ id: "decor-neon-gamepad", name: "ป้ายไฟนีออน LED ลายจอยเกม", category: "decor", price: 790, colors: ["purple", "blue"], materials: ["plastic"], dims: [40, 2, 25], placement: "wall", status: "out_of_stock", date: "2026-10-25" }),
  p({ id: "rug-round-black-120", name: "พรมกลมกันลื่นสำหรับเก้าอี้ 120 ซม.", category: "rug", price: 990, colors: ["black"], materials: ["fabric", "rubber"], dims: [120, 120, 0.6] }),

  // ---------- Room 2: Gaming White ----------
  p({ id: "desk-white-120", name: "โต๊ะคอมสีขาว 120×60 ซม. พร้อมรางเก็บสาย", category: "desk", price: 3990, colors: ["white"], materials: ["steel", "mdf"], dims: [120, 60, 75] }),
  p({ id: "pc-white-4060ti-14400f", name: "คอมประกอบเคสขาว RTX 4060 Ti / Core i5-14400F", category: "computer", price: 38900, colors: ["white"], materials: ["steel", "glass"], dims: [22, 42, 46], ports: GPU_PORTS, specs: { CPU: "Core i5-14400F", GPU: "RTX 4060 Ti 8GB", RAM: "32GB DDR5-5600", SSD: "1TB NVMe", PSU: "650W 80+ Bronze" }, query: "คอมประกอบ เคสขาว RTX 4060 Ti" }),
  p({ id: "mon-27-qhd-165-white", name: "จอเกม 27 นิ้ว QHD 165Hz สีขาว", category: "monitor", price: 7990, colors: ["white"], materials: ["plastic"], dims: [61.4, 21, 45], ports: ["HDMI 2.0", "HDMI 2.0", "DisplayPort 1.4"], specs: { "ความละเอียด": "2560×1440", "รีเฟรชเรต": "165Hz", "พาเนล": "Fast IPS" }, query: "จอ 27 นิ้ว 2K 165Hz สีขาว" }),
  p({ id: "kb-65-white", name: "คีย์บอร์ดเมคานิคอล 65% สีขาว คีย์แคป PBT", category: "keyboard", price: 1990, colors: ["white", "pink"], materials: ["plastic"], dims: [32, 11, 4] }),
  p({ id: "mouse-wireless-white", name: "เมาส์เกมไร้สายสีขาว 2.4G", category: "mouse", price: 1290, colors: ["white"], materials: ["plastic"], dims: [6.2, 12, 4] }),
  p({ id: "pad-white-pink-80", name: "แผ่นรองเมาส์ลายพาสเทล 80×30 ซม.", category: "mousepad", price: 590, colors: ["white", "pink"], materials: ["fabric", "rubber"], dims: [80, 30, 0.3] }),
  p({ id: "hs-white-cat", name: "หูฟังเกมมิ่งสีขาว ไฟ RGB หูแมว", category: "headphone", price: 1490, colors: ["white", "pink"], materials: ["plastic"], dims: [18, 9, 21] }),
  p({ id: "chair-gaming-white-pink", name: "เก้าอี้เกมมิ่งสีขาว-ชมพู พร้อมหมอนรองคอ", category: "chair", price: 4990, colors: ["white", "pink"], materials: ["pu_leather", "steel"], dims: [68, 68, 128] }),
  p({ id: "lightbar-white", name: "ไฟแขวนจอสีขาว ปรับแสงอุ่น-เย็น", category: "lighting", price: 1190, colors: ["white"], materials: ["aluminum"], dims: [45, 9, 3], placement: "other" }),
  p({ id: "stand-headset-white", name: "ขาตั้งหูฟังสีขาว พร้อม USB Hub", category: "decor", price: 590, colors: ["white"], materials: ["plastic"], dims: null, description: "ข้อมูลขนาดยังไม่ครบ (ตัวอย่างสำหรับทดสอบสถานะ 'ข้อมูลไม่เพียงพอ')" }),
  p({ id: "spk-white-mini", name: "ลำโพงคอมพิวเตอร์สีขาว ไฟ RGB", category: "speaker", price: 990, colors: ["white"], materials: ["plastic"], dims: [20, 9, 15] }),
  p({ id: "rug-white-fluffy", name: "พรมขนนุ่มสีขาว 120×160 ซม.", category: "rug", price: 890, colors: ["white"], materials: ["fabric"], dims: [160, 120, 2] }),

  // ---------- Room 3: Minimal white wood ----------
  p({ id: "desk-oak-white-120", name: "โต๊ะท็อปไม้โอ๊ค ขาเหล็กขาว 120×60 ซม.", category: "desk", price: 6490, colors: ["white", "wood"], materials: ["wood", "steel"], dims: [120, 60, 74] }),
  p({ id: "minipc-m-class", name: "มินิพีซีทำงาน ขนาดเล็ก (RAM 16GB / SSD 512GB)", category: "computer", price: 21900, colors: ["silver"], materials: ["aluminum"], dims: [13, 13, 5], placement: "desk", ports: ["HDMI 2.1", "USB-C (Thunderbolt)", "USB-C (Thunderbolt)"], specs: { RAM: "16GB", SSD: "512GB", "รองรับจอ": "2 จอ" }, query: "มินิพีซี 16GB 512GB" }),
  p({ id: "mon-27-4k-usbc", name: "จอ 27 นิ้ว 4K IPS USB-C 65W", category: "monitor", price: 12900, colors: ["white", "silver"], materials: ["plastic", "aluminum"], dims: [61.3, 20, 45], ports: ["HDMI 2.0", "DisplayPort 1.4", "USB-C (DP Alt)"], specs: { "ความละเอียด": "3840×2160", "รีเฟรชเรต": "60Hz", "สี": "99% sRGB", "จ่ายไฟ USB-C": "65W" } }),
  p({ id: "arm-single-white", name: "แขนจับจอเดี่ยวแบบสปริงแก๊ส สีขาว", category: "monitor_arm", price: 1490, colors: ["white"], materials: ["aluminum"], dims: [12, 12, 45], specs: { "รองรับจอ": "17–32 นิ้ว / 2–9 กก.", VESA: "75/100" } }),
  p({ id: "kb-lowprofile-white", name: "คีย์บอร์ดไร้สายโปรไฟล์บาง สีขาว", category: "keyboard", price: 2290, colors: ["white"], materials: ["aluminum", "plastic"], dims: [36, 12, 2] }),
  p({ id: "mouse-minimal-white", name: "เมาส์ไร้สายเงียบ ดีไซน์มินิมอล", category: "mouse", price: 1190, colors: ["white"], materials: ["plastic"], dims: [6, 11, 3.5] }),
  p({ id: "mat-felt-gray-70", name: "แผ่นรองโต๊ะสักหลาด สีเทา 70×30 ซม.", category: "mousepad", price: 690, colors: ["gray"], materials: ["felt"], dims: [70, 30, 0.4] }),
  p({ id: "lamp-wood-desk", name: "โคมไฟตั้งโต๊ะฐานไม้ แสงวอร์ม", category: "lighting", price: 1290, colors: ["wood", "white"], materials: ["wood", "metal"], dims: [15, 15, 40], placement: "desk" }),
  p({ id: "decor-plant-ceramic", name: "กระถางต้นไม้เซรามิกพร้อมต้นไม้ปลอม", category: "fake_plant", price: 390, colors: ["white", "green"], materials: ["ceramic"], dims: [12, 12, 22] }),
  p({ id: "chair-mesh-white", name: "เก้าอี้ทำงานเออร์โกโนมิกผ้าตาข่าย สีขาว", category: "chair", price: 3990, colors: ["white", "gray"], materials: ["mesh", "plastic"], dims: [64, 64, 115] }),
  p({ id: "shelf-floating-oak", name: "ชั้นวางลอยติดผนังไม้โอ๊ค 80 ซม.", category: "storage", price: 790, colors: ["wood"], materials: ["wood"], dims: [80, 20, 3], placement: "wall" }),
  p({ id: "rug-beige-140", name: "พรมทอสีเบจ 140×200 ซม.", category: "rug", price: 1490, colors: ["beige"], materials: ["fabric"], dims: [200, 140, 1] }),

  // ---------- Room 4: Space-saving work ----------
  p({ id: "desk-wall-fold-100", name: "โต๊ะพับติดผนังประหยัดพื้นที่ 100×50 ซม.", category: "desk", price: 2490, colors: ["gray", "white"], materials: ["mdf", "steel"], dims: [100, 50, 75], placement: "wall" }),
  p({ id: "laptop-14-usbc", name: "โน้ตบุ๊กทำงาน 14 นิ้ว น้ำหนักเบา (พอร์ต USB-C เท่านั้น)", category: "computer", price: 24900, colors: ["gray"], materials: ["aluminum"], dims: [31, 22, 1.8], placement: "desk", ports: ["USB-C (DP Alt)", "USB-C (DP Alt)"], specs: { CPU: "Core Ultra 5", RAM: "16GB", "หน้าจอ": "14 นิ้ว 2.8K" }, query: "โน้ตบุ๊ก 14 นิ้ว Core Ultra 5 16GB" }),
  p({ id: "stand-laptop-alu", name: "แท่นวางโน้ตบุ๊กอะลูมิเนียม ปรับระดับ", category: "other", price: 690, colors: ["silver"], materials: ["aluminum"], dims: [24, 22, 15], placement: "desk" }),
  p({ id: "mon-24-fhd-75", name: "จอ 24 นิ้ว Full HD IPS 75Hz", category: "monitor", price: 3290, colors: ["black"], materials: ["plastic"], dims: [54, 18, 41], ports: ["HDMI 1.4", "VGA"], specs: { "ความละเอียด": "1920×1080", "รีเฟรชเรต": "75Hz" } }),
  p({ id: "kb-compact-gray", name: "คีย์บอร์ดไร้สายขนาดเล็ก สีเทา (Multi-device)", category: "keyboard", price: 1290, colors: ["gray"], materials: ["plastic"], dims: [29, 11, 2] }),
  p({ id: "mouse-vertical", name: "เมาส์แนวตั้งเพื่อสุขภาพข้อมือ", category: "mouse", price: 990, colors: ["black"], materials: ["plastic"], dims: [7, 12, 7] }),
  p({ id: "lamp-clamp-led", name: "โคมไฟ LED แบบหนีบโต๊ะ ปรับแสง 3 ระดับ", category: "lighting", price: 890, colors: ["black"], materials: ["metal"], dims: [10, 10, 50], placement: "desk" }),
  p({ id: "chair-fold-fabric", name: "เก้าอี้ทำงานพับได้ เบาะผ้า สีเทา", category: "chair", price: 1990, colors: ["gray"], materials: ["fabric", "steel"], dims: [52, 55, 95] }),
  p({ id: "pegboard-wall", name: "แผ่นเพ็กบอร์ดติดผนัง พร้อมตะขอ", category: "storage", price: 690, colors: ["white"], materials: ["metal"], dims: [60, 2, 40], placement: "wall" }),
  p({ id: "drawer-under-desk", name: "ลิ้นชักใต้โต๊ะแบบติดตั้งง่าย", category: "storage", price: 490, colors: ["gray"], materials: ["plastic"], dims: [35, 25, 8], placement: "other" }),
  p({ id: "webcam-1080", name: "เว็บแคม Full HD พร้อมไมค์ตัดเสียงรบกวน", category: "webcam", price: 1190, colors: ["black"], materials: ["plastic"] }),

  // ---------- Room 5: Student budget ----------
  p({ id: "desk-pine-100", name: "โต๊ะไม้สนสำหรับนักเรียน 100×50 ซม.", category: "desk", price: 1590, colors: ["wood"], materials: ["wood"], dims: [100, 50, 75] }),
  p({ id: "laptop-156-budget", name: "โน้ตบุ๊กนักเรียน 15.6 นิ้ว (RAM 8GB / SSD 512GB)", category: "computer", price: 15900, colors: ["gray"], materials: ["plastic"], dims: [36, 24, 2], placement: "desk", ports: ["HDMI 1.4", "USB-A"], specs: { RAM: "8GB", SSD: "512GB" }, query: "โน้ตบุ๊ก 15.6 นิ้ว 8GB 512GB นักเรียน" }),
  p({ id: "mon-22-fhd-100", name: "จอ 22 นิ้ว Full HD 100Hz", category: "monitor", price: 2490, colors: ["black"], materials: ["plastic"], dims: [50, 17, 38], ports: ["HDMI 1.4", "VGA"], specs: { "ความละเอียด": "1920×1080", "รีเฟรชเรต": "100Hz" } }),
  p({ id: "combo-kb-mouse", name: "ชุดคีย์บอร์ด+เมาส์ไร้สาย ราคาประหยัด", category: "keyboard", price: 490, colors: ["black"], materials: ["plastic"], dims: [44, 13, 3] }),
  p({ id: "pad-basic", name: "แผ่นรองเมาส์ผ้าขนาดมาตรฐาน", category: "mousepad", price: 99, colors: ["black"], materials: ["fabric"], dims: [22, 18, 0.3], status: "broken_link", date: "2026-10-20" }),
  p({ id: "hs-budget", name: "หูฟังครอบหูพร้อมไมค์ สำหรับเรียนออนไลน์", category: "headphone", price: 390, colors: ["black"], materials: ["plastic"] }),
  p({ id: "lamp-led-student", name: "โคมไฟอ่านหนังสือ LED ถนอมสายตา", category: "lighting", price: 290, colors: ["white"], materials: ["plastic"], dims: [13, 13, 38], placement: "desk" }),
  p({ id: "chair-office-basic", name: "เก้าอี้สำนักงานพื้นฐาน มีพนักพิง", category: "chair", price: 1290, colors: ["black"], materials: ["mesh", "plastic"], dims: [58, 58, 95] }),
  p({ id: "shelf-book-small", name: "ชั้นวางหนังสือ 3 ชั้น", category: "storage", price: 590, colors: ["wood"], materials: ["mdf"], dims: [60, 24, 90] }),
  p({ id: "stand-laptop-plastic", name: "ขาตั้งโน้ตบุ๊กพับได้", category: "other", price: 199, colors: ["black"], materials: ["plastic"], dims: [25, 22, 8], placement: "desk" }),
  p({ id: "board-cork", name: "บอร์ดไม้ก๊อกติดผนัง 40×60 ซม.", category: "decor", price: 250, colors: ["wood"], materials: ["wood"], dims: [60, 2, 40], placement: "wall" }),
  p({ id: "rug-small-gray", name: "พรมเช็ดเท้าใต้โต๊ะ 80×120 ซม.", category: "rug", price: 290, colors: ["gray"], materials: ["fabric"], dims: [120, 80, 0.5] }),

  // ---------- Room 6: Streamer ----------
  p({ id: "desk-l-black-160", name: "โต๊ะทรงตัว L สีดำ 160×60 ซม.", category: "desk", price: 5990, colors: ["black"], materials: ["steel", "mdf"], dims: [160, 60, 75] }),
  p({ id: "pc-stream-4070-7700", name: "คอมสตรีม RTX 4070 / Ryzen 7 7700", category: "computer", price: 49900, colors: ["black"], materials: ["steel", "glass"], dims: [23, 45, 48], ports: GPU_PORTS, specs: { CPU: "Ryzen 7 7700", GPU: "RTX 4070 12GB (NVENC)", RAM: "32GB DDR5", SSD: "2TB NVMe" } }),
  p({ id: "mon-24-fhd-ips-dp", name: "จอ 24 นิ้ว Full HD IPS 100Hz (หมุนแนวตั้งได้)", category: "monitor", price: 3990, colors: ["black"], materials: ["plastic"], dims: [54, 18, 41], ports: ["HDMI 1.4", "DisplayPort 1.2"], specs: { "ขาตั้ง": "Pivot / ปรับสูง", "ความละเอียด": "1920×1080" } }),
  p({ id: "mic-xlr-dynamic", name: "ไมโครโฟนไดนามิก XLR/USB สำหรับสตรีม", category: "microphone", price: 3490, colors: ["black"], materials: ["metal"] }),
  p({ id: "audio-interface-2ch", name: "ออดิโออินเทอร์เฟซ 2 ช่อง USB-C", category: "other", price: 3990, colors: ["red", "black"], materials: ["metal"], dims: [18, 10, 5], placement: "desk" }),
  p({ id: "boom-arm", name: "ขาตั้งไมค์บูมอาร์มแบบหนีบโต๊ะ", category: "microphone", price: 1290, colors: ["black"], materials: ["steel"] }),
  p({ id: "webcam-4k", name: "เว็บแคม 4K HDR สำหรับสตรีม", category: "webcam", price: 4990, colors: ["black"], materials: ["plastic"] }),
  p({ id: "keylight-panel", name: "ไฟสตูดิโอ Key Light LED แบบหนีบโต๊ะ", category: "lighting", price: 2490, colors: ["black"], materials: ["aluminum"], dims: [10, 10, 100], placement: "desk" }),
  p({ id: "stream-deck-15", name: "คอนโทรลเลอร์สตรีม 15 ปุ่ม LCD", category: "other", price: 5490, colors: ["black"], materials: ["plastic"], dims: [12, 9, 6], placement: "desk" }),
  p({ id: "hs-studio-closed", name: "หูฟังมอนิเตอร์สตูดิโอแบบปิด", category: "headphone", price: 2990, colors: ["black"], materials: ["plastic", "pu_leather"] }),
  p({ id: "foam-acoustic-12", name: "แผ่นซับเสียงอะคูสติกโฟม 12 แผ่น", category: "decor", price: 790, colors: ["black", "blue"], materials: ["fabric"], placement: "wall" }),
  p({ id: "light-hex-rgb", name: "ไฟ LED หกเหลี่ยม RGB ติดผนัง 10 ชิ้น", category: "lighting", price: 1690, colors: ["blue", "pink"], materials: ["plastic"], placement: "wall", platform: "Lazada" }),

  // ---------- Room 7: Creator / editor ----------
  p({ id: "desk-creator-160", name: "โต๊ะทำงานกว้าง 160×75 ซม. ท็อปไม้ ขาดำ", category: "desk", price: 7490, colors: ["wood", "black"], materials: ["wood", "steel"], dims: [160, 75, 75] }),
  p({ id: "pc-ws-4080s-9950x", name: "เวิร์กสเตชันตัดต่อ RTX 4080 SUPER / Ryzen 9 9950X", category: "computer", price: 98900, colors: ["gray"], materials: ["aluminum", "glass"], dims: [24, 50, 52], ports: GPU_PORTS, specs: { CPU: "Ryzen 9 9950X", GPU: "RTX 4080 SUPER 16GB", RAM: "64GB DDR5", SSD: "2TB + 4TB NVMe" } }),
  p({ id: "mon-34-uw-qhd", name: "จอ Ultrawide 34 นิ้ว WQHD 100Hz 99% sRGB", category: "monitor", price: 13900, colors: ["black"], materials: ["plastic"], dims: [81.5, 25, 46], ports: ["HDMI 2.0", "HDMI 2.0", "DisplayPort 1.4", "USB-C (DP Alt)"], specs: { "ความละเอียด": "3440×1440", "รีเฟรชเรต": "100Hz", "สี": "99% sRGB" }, platform: "Lazada" }),
  p({ id: "mon-27-4k-pro-color", name: "จอ 27 นิ้ว 4K สำหรับงานสี 99% Adobe RGB", category: "monitor", price: 18900, colors: ["gray"], materials: ["plastic"], dims: [61.4, 21, 46], ports: ["HDMI 2.0", "DisplayPort 1.4", "USB-C (DP Alt)"], specs: { "ความละเอียด": "3840×2160", "สี": "99% Adobe RGB, Delta E < 2" }, status: "out_of_stock", date: "2026-10-22" }),
  p({ id: "calibrator", name: "เครื่องคาลิเบรตสีจอ (Colorimeter)", category: "other", price: 7990, colors: ["black"], materials: ["plastic"], placement: "other" }),
  p({ id: "kb-productivity", name: "คีย์บอร์ดไร้สายสำหรับงานโปรดักทีฟ (Backlit)", category: "keyboard", price: 3490, colors: ["gray"], materials: ["aluminum", "plastic"], dims: [43, 15, 2.5] }),
  p({ id: "mouse-productivity", name: "เมาส์ไร้สายล้อเลื่อนเร็ว ปุ่มปรับแต่งได้", category: "mouse", price: 2890, colors: ["gray"], materials: ["plastic"], dims: [8.4, 12.5, 5] }),
  p({ id: "edit-controller", name: "คอนโทรลเลอร์ตัดต่อวิดีโอ (Jog Wheel)", category: "other", price: 9900, colors: ["black"], materials: ["metal", "plastic"], dims: [38, 13, 4], placement: "desk" }),
  p({ id: "hs-studio-open", name: "หูฟังสตูดิโอแบบเปิด สำหรับมิกซ์เสียง", category: "headphone", price: 4490, colors: ["gray"], materials: ["plastic", "fabric"] }),
  p({ id: "lightbar-pro", name: "ไฟแขวนจอแบบโค้ง รองรับจอ Ultrawide", category: "lighting", price: 1890, colors: ["black"], materials: ["aluminum"], placement: "other" }),
  p({ id: "chair-ergo-premium", name: "เก้าอี้เออร์โกโนมิกระดับพรีเมียม ปรับได้ 8 จุด", category: "chair", price: 12900, colors: ["gray", "black"], materials: ["mesh", "aluminum"], dims: [68, 66, 120] }),
  p({ id: "spk-studio-monitor", name: "ลำโพงมอนิเตอร์สตูดิโอ 4 นิ้ว (คู่)", category: "speaker", price: 6990, colors: ["black"], materials: ["mdf"], dims: [30, 20, 23] }),

  // ---------- Room 8: Health / standing ----------
  p({ id: "desk-standing-140", name: "โต๊ะปรับระดับไฟฟ้า 2 มอเตอร์ 140×70 ซม.", category: "desk", price: 11900, colors: ["white", "wood"], materials: ["steel", "mdf"], dims: [140, 70, 120], specs: { "ช่วงความสูง": "72–120 ซม.", "มอเตอร์": "2 ตัว", "หน่วยความจำ": "4 ระดับ" } }),
  p({ id: "mon-27-eyecare", name: "จอ 27 นิ้ว QHD ถนอมสายตา Flicker-free / Low Blue Light", category: "monitor", price: 6990, colors: ["black"], materials: ["plastic"], dims: [61.4, 21, 46], ports: ["HDMI 2.0", "DisplayPort 1.4", "USB-C (DP Alt)"], specs: { "ความละเอียด": "2560×1440", "รับรอง": "TÜV Low Blue Light", "ขาตั้ง": "ปรับสูง/ก้ม/เงย/หมุน" } }),
  p({ id: "chair-ergo-lumbar", name: "เก้าอี้เพื่อสุขภาพ พนักพิงรองรับหลังส่วนล่าง", category: "chair", price: 8990, colors: ["black"], materials: ["mesh", "aluminum"], dims: [66, 66, 118] }),
  p({ id: "kb-split-ergo", name: "คีย์บอร์ดแยกสองฝั่งเพื่อสุขภาพ", category: "keyboard", price: 3990, colors: ["black"], materials: ["plastic"], dims: [36, 16, 3] }),
  p({ id: "wrist-rest-foam", name: "ที่รองข้อมือเมมโมรี่โฟม", category: "keyboard_pad", price: 490, colors: ["black"], materials: ["fabric"], dims: [36, 8, 2] }),
  p({ id: "mat-antifatigue", name: "แผ่นยืนลดความเมื่อยล้า (Anti-fatigue Mat)", category: "rug", price: 1290, colors: ["gray"], materials: ["rubber"], dims: [90, 50, 2] }),
  p({ id: "footrest", name: "ที่วางเท้าเพื่อสุขภาพ ปรับมุมได้", category: "other", price: 890, colors: ["black"], materials: ["plastic"], placement: "floor" }),
  p({ id: "lamp-eyecare-auto", name: "โคมไฟถนอมสายตา ปรับแสงอัตโนมัติ", category: "lighting", price: 1990, colors: ["white"], materials: ["aluminum"], dims: [18, 18, 45], placement: "desk" }),

  // ---------- Room 9: Dark luxury ----------
  p({ id: "desk-walnut-160", name: "โต๊ะไม้วอลนัทแท้ 160×70 ซม. ขาเหล็กดำ", category: "desk", price: 18900, colors: ["walnut", "black"], materials: ["wood", "steel"], dims: [160, 70, 74], platform: "Lazada" }),
  p({ id: "pc-sff-4070tis", name: "คอมเคสเล็ก SFF RTX 4070 Ti SUPER ดีไซน์เรียบ", category: "computer", price: 64900, colors: ["black"], materials: ["aluminum"], dims: [18, 37, 30], ports: GPU_PORTS, specs: { GPU: "RTX 4070 Ti SUPER 16GB", CPU: "Core Ultra 7 265K", RAM: "32GB DDR5" } }),
  p({ id: "mon-32-4k-black", name: "จอ 32 นิ้ว 4K IPS 144Hz ขอบบาง", category: "monitor", price: 16900, colors: ["black"], materials: ["aluminum", "plastic"], dims: [71.4, 23, 50], ports: ["HDMI 2.1", "HDMI 2.1", "DisplayPort 1.4", "USB-C (DP Alt)"], specs: { "ความละเอียด": "3840×2160", "รีเฟรชเรต": "144Hz" } }),
  p({ id: "kb-alu-black", name: "คีย์บอร์ดบอดี้อะลูมิเนียม สีดำด้าน (Gasket)", category: "keyboard", price: 5990, colors: ["black"], materials: ["aluminum"], dims: [33, 13, 3.5] }),
  p({ id: "mouse-premium-black", name: "เมาส์ไร้สายพรีเมียม สีดำ", category: "mouse", price: 2890, colors: ["black"], materials: ["plastic"], dims: [7, 12.5, 4] }),
  p({ id: "mat-leather-90", name: "แผ่นรองโต๊ะหนังแท้ สีดำ 90×40 ซม.", category: "mousepad", price: 1490, colors: ["black"], materials: ["leather"], dims: [90, 40, 0.3] }),
  p({ id: "hs-premium-wireless", name: "หูฟังไร้สายตัดเสียงรบกวนระดับพรีเมียม", category: "headphone", price: 9990, colors: ["black"], materials: ["aluminum", "leather"] }),
  p({ id: "chair-exec-leather", name: "เก้าอี้ผู้บริหารหนังแท้ สีดำ", category: "chair", price: 14900, colors: ["black"], materials: ["leather", "aluminum"], dims: [70, 72, 125] }),
  p({ id: "lamp-brass", name: "โคมไฟตั้งโต๊ะทองเหลือง สไตล์วินเทจ", category: "lighting", price: 3490, colors: ["brass"], materials: ["metal"], dims: [15, 15, 42], placement: "desk" }),
  p({ id: "spk-bookshelf-wood", name: "ลำโพงบุ๊กเชลฟ์ตู้ไม้ (คู่)", category: "speaker", price: 7990, colors: ["walnut"], materials: ["wood"], dims: [34, 22, 25] }),
  p({ id: "stand-headset-brass", name: "ขาแขวนหูฟังทองเหลือง", category: "decor", price: 1290, colors: ["brass"], materials: ["metal"], dims: [12, 12, 28] }),
  p({ id: "rug-dark-gray", name: "พรมขนสั้นสีเทาเข้ม 160×230 ซม.", category: "rug", price: 3990, colors: ["gray"], materials: ["fabric"], dims: [230, 160, 1] }),

  // ---------- Room 10: Premium ----------
  p({ id: "desk-motor-200", name: "โต๊ะปรับระดับไฟฟ้าขนาดใหญ่ 200×80 ซม.", category: "desk", price: 24900, colors: ["black", "walnut"], materials: ["wood", "steel"], dims: [200, 80, 125], specs: { "ช่วงความสูง": "65–125 ซม.", "รับน้ำหนัก": "150 กก." } }),
  p({ id: "pc-flagship-5090", name: "คอมเรือธง RTX 5090 / Ryzen 9 9950X3D", category: "computer", price: 189000, colors: ["black"], materials: ["aluminum", "glass"], dims: [25, 52, 55], ports: ["HDMI 2.1b", "DisplayPort 2.1b", "DisplayPort 2.1b", "DisplayPort 2.1b"], specs: { CPU: "Ryzen 9 9950X3D", GPU: "RTX 5090 32GB", RAM: "96GB DDR5", PSU: "1200W 80+ Platinum" } }),
  p({ id: "mon-27-oled-360", name: "จอ OLED 27 นิ้ว QHD 360Hz", category: "monitor", price: 32900, colors: ["black"], materials: ["metal"], dims: [61, 23, 46], ports: ["HDMI 2.1", "HDMI 2.1", "DisplayPort 1.4"], specs: { "ความละเอียด": "2560×1440", "รีเฟรชเรต": "360Hz", "พาเนล": "QD-OLED 0.03ms" } }),
  p({ id: "arm-triple", name: "แขนจับจอ 3 จอ แบบสปริงแก๊ส", category: "monitor_arm", price: 4990, colors: ["black"], materials: ["aluminum"], dims: [20, 15, 50] }),
  p({ id: "kb-custom-premium", name: "คีย์บอร์ดคัสตอมเคสอะลูมิเนียม CNC", category: "keyboard", price: 8900, colors: ["black", "silver"], materials: ["aluminum"], dims: [33, 12, 4] }),
  p({ id: "mouse-pro-wireless", name: "เมาส์ไร้สายระดับโปร 8K Polling", category: "mouse", price: 4490, colors: ["black"], materials: ["plastic"], dims: [6.4, 12.5, 4] }),
  p({ id: "mat-leather-120", name: "แผ่นรองโต๊ะหนังขนาดใหญ่ 120×50 ซม.", category: "mousepad", price: 2490, colors: ["black"], materials: ["leather"], dims: [120, 50, 0.3] }),
  p({ id: "hs-audiophile-dac", name: "ชุดหูฟังออดิโอไฟล์ + DAC/AMP", category: "headphone", price: 24900, colors: ["silver"], materials: ["aluminum"] }),
  p({ id: "spk-active-premium", name: "ลำโพงแอคทีฟระดับไฮเอนด์ (คู่)", category: "speaker", price: 32000, colors: ["black"], materials: ["wood"], dims: [36, 25, 30] }),
  p({ id: "chair-premium-ergo", name: "เก้าอี้เออร์โกโนมิกระดับท็อป รับประกัน 12 ปี", category: "chair", price: 59900, colors: ["black"], materials: ["mesh", "aluminum"], dims: [70, 70, 115], status: "out_of_stock", date: "2026-10-24" }),
  p({ id: "light-smart-ambient", name: "ชุดไฟ Ambient อัจฉริยะ ซิงค์กับหน้าจอ", category: "lighting", price: 6990, colors: ["black"], materials: ["plastic"], placement: "wall" }),
  p({ id: "decor-pixel-clock", name: "นาฬิกา Pixel LED แสดงผลอัจฉริยะ", category: "decor", price: 2490, colors: ["black"], materials: ["plastic"], dims: [20, 8, 20] }),
  p({ id: "rug-premium-wool", name: "พรมขนสัตว์ทอมือ 200×300 ซม.", category: "rug", price: 8900, colors: ["gray", "black"], materials: ["fabric"], dims: [300, 200, 1.5] }),

  // ---------- หมวดหมู่ของใช้ในห้อง (Room Items: เตียง ชั้นวางของ กระถางต้นไม้ ต้นไม้ปลอม ต้นไม้จริง ของตกแต่ง พรมแต่งห้อง) ----------
  // เตียงนอน (bed)
  p({ id: "bed-minimal-oak-5ft", name: "เตียงนอนไม้โอ๊คมินิมอล 5 ฟุต พร้อมหัวเตียงซ่อนไฟ", category: "bed", price: 7990, colors: ["wood", "white"], materials: ["wood"], dims: [158, 208, 95], placement: "floor", platform: "IKEA", specs: { "ขนาด": "5 ฟุต (Queen Size)", "วัสดุ": "โครงไม้โอ๊คแท้ + ระแนงไม้สน", "หัวเตียง": "มีช่องวางของ + ไฟซ่อน Warm White" } }),
  p({ id: "bed-storage-drawers-6ft", name: "เตียงนอน 6 ฟุต พร้อมลิ้นชักเก็บของใต้เตียง 4 ช่อง", category: "bed", price: 11900, colors: ["white", "gray"], materials: ["wood", "mdf"], dims: [188, 210, 100], placement: "floor", platform: "IKEA", specs: { "ขนาด": "6 ฟุต (King Size)", "ลิ้นชัก": "4 ช่องใหญ่ ล้อเลื่อนเงียบ", "รับน้ำหนัก": "350 กก." } }),
  p({ id: "bed-gaming-led-35ft", name: "เตียงนอนเกมมิ่ง 3.5 ฟุต โครงเหล็กดำ ไฟ RGB หัวเตียง", category: "bed", price: 5490, colors: ["black", "blue"], materials: ["steel", "pu_leather"], dims: [112, 205, 98], placement: "floor", platform: "Index Living Mall", specs: { "ขนาด": "3.5 ฟุต (Single Size)", "พอร์ตชาร์จ": "USB-A + USB-C ที่หัวเตียง", "ไฟ": "LED RGB ปรับผ่านรีโมท" } }),
  p({ id: "bed-sofa-foldable-gray", name: "โซฟาเบดปรับนอนได้ 3 ระดับ ผ้าลินินสีเทา สำหรับห้องคอม", category: "bed", price: 4590, colors: ["gray"], materials: ["fabric", "steel"], dims: [180, 95, 78], placement: "floor", platform: "IKEA", specs: { "รูปแบบ": "Sofa Bed พับกางเป็นเตียงได้", "เบาะ": "High-Density Foam หุ้มผ้าลินินระบายอากาศ" } }),

  // ชั้นวางของ (storage)
  p({ id: "shelf-steel-5tier-black", name: "ชั้นวางของเหล็กฉาก 5 ชั้น สีดำด้าน รับน้ำหนักสูง", category: "storage", price: 1690, colors: ["black"], materials: ["steel"], dims: [90, 40, 180], placement: "floor", platform: "HomePro", specs: { "จำนวนชั้น": "5 ชั้น ปรับระดับความสูงได้", "รับน้ำหนัก": "60 กก./ชั้น" } }),
  p({ id: "shelf-cube-display-white", name: "ตู้โชว์โมเดลและชั้นวางของ 8 ช่อง สีขาวมินิมอล", category: "storage", price: 2290, colors: ["white", "wood"], materials: ["mdf", "wood"], dims: [77, 39, 147], placement: "floor", platform: "IKEA", specs: { "ช่องจัดเก็บ": "8 ช่อง (ใส่กล่องเสริมได้)", "เหมาะสำหรับ": "วางกล่องอุปกรณ์ไอที ฟิกเกอร์ และหนังสือ" } }),

  // กระถางต้นไม้ (plant_pot)
  p({ id: "pot-ceramic-nordic-white", name: "กระถางต้นไม้เซรามิกทรงกระบอก สไตล์นอร์ดิก พร้อมจานรองไม้", category: "plant_pot", price: 290, colors: ["white", "wood"], materials: ["ceramic", "wood"], dims: [16, 16, 17], placement: "desk", platform: "IKEA", specs: { "ขนาดกระถาง": "เส้นผ่านศูนย์กลาง 6 นิ้ว", "อุปกรณ์เสริม": "ถาดรองไม้ไผ่แท้ + รูระบายน้ำ" } }),
  p({ id: "pot-terracotta-stand-wood", name: "กระถางปูนเปลือยมินิมอล พร้อมขาตั้งไม้สักวางพื้น", category: "plant_pot", price: 690, colors: ["gray", "wood"], materials: ["ceramic", "wood"], dims: [28, 28, 45], placement: "floor", platform: "HomePro", specs: { "ขนาดกระถาง": "10 นิ้ว พร้อมขาตั้งไม้", "เหมาะสำหรับ": "ต้นมอนสเตอร่า / ยางอินเดีย ในห้องคอม" } }),
  p({ id: "pot-selfwatering-matte-black", name: "กระถางต้นไม้รดน้ำอัตโนมัติ สีดำด้าน (Self-Watering Pot)", category: "plant_pot", price: 350, colors: ["black"], materials: ["plastic"], dims: [15, 15, 16], placement: "desk", platform: "Shopee", specs: { "ระบบ": "เชือกดูดซับน้ำอัตโนมัติ อยู่ได้ 10-14 วัน", "ตัวบอกระดับน้ำ": "มีหลอดวัดระดับน้ำด้านข้าง" } }),

  // ต้นไม้ปลอม (fake_plant)
  p({ id: "fake-plant-monstera-70cm", name: "ต้นมอนสเตอร่าปลอม เกรดพรีเมียม ดัดก้านได้ สูง 70 ซม.", category: "fake_plant", price: 650, colors: ["green", "black"], materials: ["plastic"], dims: [45, 45, 70], placement: "floor", platform: "IKEA", specs: { "ความสูง": "70 ซม. (18 ใบ)", "วัสดุใบ": "PE ยางสัมผัสมันเงาเสมือนจริง ล้างน้ำได้" } }),
  p({ id: "fake-plant-olive-tree-120cm", name: "ต้นโอลีฟปลอมแต่งห้อง สไตล์คาเฟ่มินิมอล สูง 120 ซม.", category: "fake_plant", price: 1290, colors: ["green", "wood"], materials: ["plastic", "wood"], dims: [50, 50, 120], placement: "floor", platform: "IKEA", specs: { "ความสูง": "120 ซม.", "ลำต้น": "กิ่งไม้เลียนแบบธรรมชาติ พร้อมผลโอลีฟจำลอง" } }),
  p({ id: "fake-plant-hanging-ivy", name: "ต้นไม้ปลอมใบเลื้อยแขวนผนัง/ชั้นวาง (ชุด 2 พุ่ม)", category: "fake_plant", price: 240, colors: ["green"], materials: ["plastic"], dims: [20, 20, 65], placement: "wall", platform: "IKEA", specs: { "ความยาวสายเลื้อย": "65 ซม.", "การติดตั้ง": "วางบนชั้นลอย เพ็กบอร์ด หรือหลังจอคอม" } }),

  // ต้นไม้จริง (real_plant)
  p({ id: "real-plant-snake-airpurifier", name: "ต้นลิ้นมังกรแคระ (ต้นไม้จริงฟอกอากาศบนโต๊ะคอม)", category: "real_plant", price: 250, colors: ["green", "white"], materials: ["ceramic"], dims: [14, 14, 25], placement: "desk", platform: "Shopee", specs: { "ชนิด": "ต้นไม้จริง (Sansevieria Hahnii)", "การดูแล": "รดน้ำสัปดาห์ละ 1 ครั้ง ทนแสงน้อยในห้องแอร์", "คุณสมบัติ": "ดูดซับสารพิษและคายออกซิเจนเวลากลางคืน" } }),
  p({ id: "real-plant-rubber-black", name: "ต้นยางอินเดียดำ (ต้นไม้จริงแต่งมุมห้อง พร้อมกระถาง)", category: "real_plant", price: 590, colors: ["green", "black"], materials: ["ceramic"], dims: [25, 25, 60], placement: "floor", platform: "HomePro", specs: { "ชนิด": "ต้นไม้จริง (Ficus Elastica Burgundy)", "การดูแล": "รดน้ำ 3-4 วันครั้ง ชอบแสงรำไรริมหน้าต่าง", "คุณสมบัติ": "ดักจับฝุ่นละอองในห้องทำงาน" } }),
  p({ id: "real-plant-monstera-deliciosa", name: "ต้นมอนสเตอร่าใบแฉก (ต้นไม้จริงคัดฟอร์มสวย พร้อมกระถางเซรามิก)", category: "real_plant", price: 890, colors: ["green", "white"], materials: ["ceramic"], dims: [40, 40, 65], placement: "floor", platform: "Shopee", specs: { "ชนิด": "ต้นไม้จริง (Monstera Deliciosa)", "การดูแล": "เลี้ยงในร่ม/ห้องแอร์ได้ รดน้ำสัปดาห์ละ 2 ครั้ง" } }),
  p({ id: "real-plant-zamioculcas-desk", name: "ต้นกวักมรกตดำแคระ (ต้นไม้จริงมงคล-ทนทานสูง ตั้งโต๊ะทำงาน)", category: "real_plant", price: 320, colors: ["green", "black"], materials: ["ceramic"], dims: [15, 15, 28], placement: "desk", platform: "Shopee", specs: { "ชนิด": "ต้นไม้จริง (Zamioculcas Raven)", "การดูแล": "ทนแสงไฟนีออน/LED รดน้ำสัปดาห์ละ 1 ครั้ง" } }),

  // ของตกแต่งต่างๆ เพิ่มเติม (decor)
  p({ id: "decor-astronaut-projector", name: "โคมไฟโปรเจคเตอร์นักบินอวกาศ ฉายดาวและเนบิวลาเต็มเพดานห้อง", category: "decor", price: 590, colors: ["white", "blue", "purple"], materials: ["plastic"], dims: [12, 11, 23], placement: "desk", platform: "Shopee", specs: { "เอฟเฟกต์": "เนบิวลา 8 สี + ดาวเลเซอร์", "การควบคุม": "รีโมทไร้สาย + ตั้งเวลาปิดอัตโนมัติ" } }),
  p({ id: "decor-framed-cyber-art", name: "ชุดกรอบรูปโปสเตอร์แต่งผนังห้องเกมมิ่ง & Setup (เซ็ต 3 ชิ้น)", category: "decor", price: 690, colors: ["black", "blue"], materials: ["wood", "glass"], dims: [90, 3, 40], placement: "wall", platform: "IKEA", specs: { "ขนาด": "30×40 ซม. จำนวน 3 กรอบ", "การติดตั้ง": "เทปแรงยึดสูง ไม่ต้องเจาะผนัง" } }),

  // พรมแต่งห้อง เพิ่มเติม (rug)
  p({ id: "rug-geometric-nordic-160", name: "พรมแต่งห้องลายกราฟิกนอร์ดิก ทอแน่นกันลื่น 160×230 ซม.", category: "rug", price: 1590, colors: ["gray", "white", "black"], materials: ["fabric", "rubber"], dims: [230, 160, 1.2], placement: "floor", platform: "IKEA", specs: { "ขนาด": "160×230 ซม.", "ผิวสัมผัส": "ผ้าทอเนื้อนุ่ม รองรับล้อเก้าอี้เกมมิ่ง" } }),
];

function room(r: Omit<Room, "status" | "isSample" | "featured" | "updatedAt"> & Partial<Pick<Room, "status" | "featured" | "updatedAt">>): Room {
  return {
    status: "published",
    featured: false,
    isSample: true,
    updatedAt: r.createdAt,
    ...r,
  };
}

const i = (
  productId: string,
  quantity = 1,
  note?: string,
  coords?: { x: number; y: number }
) => ({
  productId,
  quantity,
  ...(note ? { note } : {}),
  ...(coords ? { x: coords.x, y: coords.y } : {}),
});

export const SEED_ROOMS: Room[] = [
  room({
    id: "r01",
    slug: "gaming-rgb-black",
    name: "Gaming RGB Black Battlestation",
    description: "ห้องเกมโทนดำเต็มรูปแบบ จอคู่ QHD 170Hz คอมสเปกแรง และไฟ RGB รอบห้อง เหมาะกับสายแข่งขันและสตรีมเบา ๆ",
    images: ["/rooms/room-01-a.jpg", "/rooms/room-01-b.jpg"],
    style: "gaming",
    colors: ["black", "purple", "blue"],
    materials: ["steel", "mdf", "pu_leather"],
    lighting: ["rgb", "low"],
    items: [i("desk-gaming-carbon-140"), i("pc-gaming-4070s-7800x3d"), i("mon-27-qhd-170-ips", 2), i("kb-75-rgb-black"), i("mouse-gaming-58g-black"), i("pad-xxl-rgb-90"), i("hs-gaming-71-black"), i("chair-gaming-black"), i("light-strip-rgb-5m"), i("lightbar-monitor-black"), i("spk-21-rgb"), i("decor-neon-gamepad"), i("rug-round-black-120")],
    featured: true,
    popularity: 982,
    createdAt: "2026-09-02",
  }),
  room({
    id: "r02",
    slug: "gaming-white-pastel",
    name: "Gaming White Pastel",
    description: "เซ็ตอัปเกมมิ่งสีขาวทั้งชุด แต่งแสงพาสเทลนุ่มตา เคสขาวกระจกใส เหมาะกับคนชอบห้องสว่างและสะอาดตา",
    images: ["/rooms/room-02-a.jpg", "/rooms/room-02-b.jpg"],
    style: "gaming",
    colors: ["white", "pink"],
    materials: ["steel", "mdf", "pu_leather"],
    lighting: ["rgb", "bright"],
    items: [i("desk-white-120"), i("pc-white-4060ti-14400f"), i("mon-27-qhd-165-white"), i("kb-65-white"), i("mouse-wireless-white"), i("pad-white-pink-80"), i("hs-white-cat"), i("chair-gaming-white-pink"), i("lightbar-white"), i("stand-headset-white"), i("spk-white-mini"), i("rug-white-fluffy")],
    featured: true,
    popularity: 845,
    createdAt: "2026-09-10",
  }),
  room({
    id: "r03",
    slug: "minimal-white-oak",
    name: "Minimal White & Oak",
    description: "มินิมอลโทนขาว-ไม้โอ๊ค จอ 4K เดียวบนแขนจับจอ สายไฟน้อยที่สุดด้วย USB-C ตัวเดียว เหมาะกับงานโฟกัสสูง",
    images: ["/rooms/room-03-a.jpg", "/rooms/room-03-b.jpg"],
    style: "minimal",
    colors: ["white", "wood", "gray"],
    materials: ["wood", "steel", "felt"],
    lighting: ["bright", "adjustable"],
    items: [i("desk-oak-white-120"), i("minipc-m-class"), i("mon-27-4k-usbc"), i("arm-single-white"), i("kb-lowprofile-white"), i("mouse-minimal-white"), i("mat-felt-gray-70"), i("lamp-wood-desk"), i("decor-plant-ceramic", 2), i("chair-mesh-white"), i("shelf-floating-oak"), i("rug-beige-140")],
    featured: true,
    popularity: 910,
    createdAt: "2026-08-20",
  }),
  room({
    id: "r04",
    slug: "space-saving-work",
    name: "โต๊ะทำงานประหยัดพื้นที่",
    description: "มุมทำงานสำหรับคอนโดขนาดเล็ก โต๊ะพับติดผนัง โน้ตบุ๊ก + จอเสริม และของจัดเก็บแนวตั้ง ใช้พื้นที่ไม่ถึง 1 ตารางเมตร",
    images: ["/rooms/room-04-a.jpg", "/rooms/room-04-b.jpg"],
    style: "work",
    colors: ["gray", "white"],
    materials: ["mdf", "steel", "aluminum"],
    lighting: ["medium", "adjustable"],
    items: [i("desk-wall-fold-100"), i("laptop-14-usbc"), i("stand-laptop-alu"), i("mon-24-fhd-75", 1, "โน้ตบุ๊กมีแต่ USB-C ต้องใช้ตัวแปลง USB-C → HDMI (ยังไม่รวมในรายการ)"), i("kb-compact-gray"), i("mouse-vertical"), i("lamp-clamp-led"), i("chair-fold-fabric"), i("pegboard-wall"), i("drawer-under-desk"), i("webcam-1080")],
    popularity: 640,
    createdAt: "2026-09-18",
  }),
  room({
    id: "r05",
    slug: "student-budget",
    name: "ห้องนักเรียนงบประหยัด",
    description: "ชุดโต๊ะเรียนครบในงบไม่ถึง 25,000 บาท โน้ตบุ๊ก + จอ 22 นิ้ว ไฟอ่านหนังสือถนอมสายตา เตียงนอน และชั้นวางหนังสือ",
    images: ["/rooms/room-05-a.jpg", "/rooms/room-05-b.jpg"],
    style: "student",
    colors: ["wood", "black", "white"],
    materials: ["wood", "mdf", "plastic"],
    lighting: ["medium", "adjustable"],
    items: [
      i("mon-22-fhd-100", 1, "จอคอมพิวเตอร์ขยายพื้นที่ทำงาน", { x: 46, y: 35 }),
      i("laptop-156-budget", 1, "โน้ตบุ๊กเรียนออนไลน์บนโต๊ะ", { x: 38, y: 50 }),
      i("desk-pine-100", 1, "โต๊ะทำงานท็อปไม้สนธรรมชาติ", { x: 52, y: 72 }),
      i("chair-office-basic", 1, "เก้าอี้สำนักงานปรับระดับได้", { x: 74, y: 68 }),
      i("bed-minimal-oak-5ft", 1, "เตียงนอนไม้โอ๊คพักผ่อนข้างโต๊ะเรียน", { x: 78, y: 38 }),
      i("lamp-led-student", 1, "โคมไฟอ่านหนังสือถนอมสายตา", { x: 18, y: 26 }),
      i("shelf-book-small", 1, "กองตำราเรียนและชั้นวางหนังสือ", { x: 24, y: 62 }),
      i("pad-basic", 1, "สมุดโน้ตและแผ่นรองเขียน", { x: 40, y: 69 }),
      i("combo-kb-mouse"),
      i("hs-budget"),
      i("stand-laptop-plastic"),
      i("board-cork"),
      i("rug-small-gray"),
    ],
    featured: true,
    popularity: 1204,
    createdAt: "2026-10-01",
  }),
  room({
    id: "r06",
    slug: "streamer-neon",
    name: "ห้องสตรีมเมอร์ Neon Studio",
    description: "สตูดิโอสตรีมครบชุด ไมค์ XLR + ออดิโออินเทอร์เฟซ เว็บแคม 4K ไฟ Key Light และแผงซับเสียง พร้อมจอที่สองแนวตั้งสำหรับแชต",
    images: ["/rooms/room-06-a.jpg", "/rooms/room-06-b.jpg"],
    style: "creator",
    colors: ["black", "blue", "pink"],
    materials: ["steel", "mdf", "fabric"],
    lighting: ["rgb", "adjustable"],
    items: [i("desk-l-black-160"), i("pc-stream-4070-7700"), i("mon-27-qhd-170-ips"), i("mon-24-fhd-ips-dp"), i("mic-xlr-dynamic"), i("audio-interface-2ch"), i("boom-arm"), i("webcam-4k"), i("keylight-panel"), i("stream-deck-15"), i("hs-studio-closed"), i("chair-gaming-black"), i("foam-acoustic-12"), i("light-hex-rgb"), i("kb-75-rgb-black")],
    featured: true,
    popularity: 776,
    createdAt: "2026-10-12",
  }),
  room({
    id: "r07",
    slug: "creator-editing-studio",
    name: "ห้องตัดต่อและครีเอเตอร์",
    description: "เวิร์กสเตชันตัดต่อ 4K จอ Ultrawide + จองานสี คอนโทรลเลอร์ตัดต่อ และลำโพงมอนิเตอร์ เหมาะกับ Video Editor / Colorist",
    images: ["/rooms/real-07-a.jpg", "/rooms/real-07-b.jpg"],
    style: "creator",
    colors: ["gray", "wood", "black"],
    materials: ["wood", "steel", "mesh"],
    lighting: ["medium", "adjustable"],
    items: [i("desk-creator-160"), i("pc-ws-4080s-9950x"), i("mon-34-uw-qhd"), i("mon-27-4k-pro-color"), i("calibrator"), i("kb-productivity"), i("mouse-productivity"), i("edit-controller"), i("hs-studio-open"), i("lightbar-pro"), i("chair-ergo-premium"), i("spk-studio-monitor"), i("lamp-clamp-led")],
    popularity: 698,
    createdAt: "2026-10-05",
  }),
  room({
    id: "r08",
    slug: "health-standing-desk",
    name: "ห้องเพื่อสุขภาพ Standing Desk",
    description: "โต๊ะปรับระดับไฟฟ้า สลับนั่ง-ยืนได้ทั้งวัน เก้าอี้รองรับหลัง คีย์บอร์ดแยกฝั่ง และจอถนอมสายตา ลดอาการออฟฟิศซินโดรม",
    images: ["/rooms/real-08-a.jpg", "/rooms/real-08-b.jpg"],
    style: "health",
    colors: ["white", "wood", "black"],
    materials: ["steel", "mdf", "mesh"],
    lighting: ["bright", "adjustable"],
    items: [i("desk-standing-140"), i("minipc-m-class"), i("mon-27-eyecare"), i("arm-single-white"), i("chair-ergo-lumbar"), i("kb-split-ergo"), i("mouse-vertical"), i("wrist-rest-foam"), i("mat-antifatigue"), i("footrest"), i("lamp-eyecare-auto"), i("decor-plant-ceramic")],
    popularity: 721,
    createdAt: "2026-10-20",
  }),
  room({
    id: "r09",
    slug: "dark-luxury-walnut",
    name: "Dark Luxury Walnut",
    description: "ห้องคอมโทนเข้มเรียบหรู โต๊ะไม้วอลนัทแท้ หนังแท้ และทองเหลือง แสงวอร์มสลัว คอมเคสเล็กซ่อนพลังเกม 4K",
    images: ["/rooms/real-09-a.jpg", "/rooms/real-09-b.jpg"],
    style: "minimal",
    colors: ["black", "walnut", "brass"],
    materials: ["wood", "leather", "metal"],
    lighting: ["low", "adjustable"],
    items: [i("desk-walnut-160"), i("pc-sff-4070tis"), i("mon-32-4k-black"), i("kb-alu-black"), i("mouse-premium-black"), i("mat-leather-90"), i("hs-premium-wireless"), i("chair-exec-leather"), i("lamp-brass"), i("spk-bookshelf-wood"), i("stand-headset-brass"), i("rug-dark-gray")],
    popularity: 588,
    createdAt: "2026-10-24",
  }),
  room({
    id: "r10",
    slug: "premium-flagship",
    name: "Premium Flagship Command Center",
    description: "ระดับเรือธง RTX 5090 จอ OLED 360Hz สามจอ โต๊ะไฟฟ้า 2 เมตร เก้าอี้เออร์โกโนมิกระดับท็อป และระบบเสียงไฮเอนด์",
    images: ["/rooms/real-10-a.jpg", "/rooms/real-10-b.jpg"],
    style: "gaming",
    colors: ["black", "walnut", "silver"],
    materials: ["wood", "aluminum", "leather"],
    lighting: ["rgb", "adjustable"],
    items: [i("desk-motor-200"), i("pc-flagship-5090"), i("mon-27-oled-360", 3), i("arm-triple"), i("kb-custom-premium"), i("mouse-pro-wireless"), i("mat-leather-120"), i("hs-audiophile-dac"), i("spk-active-premium"), i("chair-premium-ergo"), i("light-smart-ambient"), i("webcam-4k"), i("decor-pixel-clock"), i("rug-premium-wool")],
    featured: true,
    popularity: 1530,
    createdAt: "2026-10-27",
  }),
];
