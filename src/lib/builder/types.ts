export type BuilderSlot =
  | "cpu"
  | "motherboard"
  | "ram"
  | "gpu"
  | "storage"
  | "psu"
  | "case"
  | "cooler"
  | "monitor";

export const BUILDER_SLOTS: Array<{
  slot: BuilderSlot;
  label: string;
  required: boolean;
  subtitle: string;
}> = [
  { slot: "cpu", label: "ซีพียู (CPU)", required: true, subtitle: "หัวใจประมวลผลและเฟรมเรตเกม" },
  { slot: "motherboard", label: "เมนบอร์ด (Mainboard)", required: true, subtitle: "ซ็อกเก็ต ชิปเซ็ต และสล็อตแรม" },
  { slot: "ram", label: "แรม (Memory)", required: true, subtitle: "DDR4 / DDR5 ความจุและความเร็ว" },
  { slot: "gpu", label: "การ์ดจอ (GPU)", required: false, subtitle: "พลังกราฟิก 3D และการเรนเดอร์" },
  { slot: "storage", label: "SSD / ที่เก็บข้อมูล", required: true, subtitle: "NVMe M.2 ความเร็วสูง" },
  { slot: "psu", label: "พาวเวอร์ซัพพลาย (PSU)", required: true, subtitle: "กำลังไฟสำรองและมาตรฐาน 80+" },
  { slot: "case", label: "เคสคอมพิวเตอร์ (Case)", required: true, subtitle: "ขนาดเคส กระจกใส และทิศทางลม" },
  { slot: "cooler", label: "ชุดระบายความร้อน (Cooler)", required: true, subtitle: "ซิงก์ลมหรือชุดน้ำปิด AIO" },
  { slot: "monitor", label: "จอคอมพิวเตอร์ (Monitor)", required: false, subtitle: "ความชัด (PPI) และอัตรารีเฟรช (Hz)" },
];

export interface PcPartSpecs {
  // CPU
  socket?: "AM5" | "AM4" | "LGA1700" | "LGA1851";
  cores?: string;
  tdpWatts?: number;
  hasIgpu?: boolean;
  cpuGamingScore?: number; // Ryzen 5 7600 = 100
  // Motherboard
  formFactor?: "ATX" | "mATX" | "ITX";
  /** จำนวนช่อง PCIe x16 ขนาดเต็ม (ใส่การ์ดจอได้กี่ใบ) */
  pcieX16Slots?: number;
  ramType?: "DDR4" | "DDR5";
  ramSlots?: number;
  // RAM
  capacityGb?: number;
  modules?: number;
  speedMhz?: number;
  hasRgb?: boolean;
  // GPU
  vramGb?: number;
  lengthMm?: number;
  gpuScore?: number; // RTX 4060 = 100
  boardPowerWatts?: number;
  videoOutputs?: string[];
  // Storage
  interface?: "NVMe Gen4" | "NVMe Gen5" | "SATA";
  storageGb?: number;
  // PSU
  wattage?: number;
  psuFormFactor?: "ATX" | "SFX";
  efficiency?: string;
  // Case
  supportedBoardSizes?: Array<"ATX" | "mATX" | "ITX">;
  maxGpuLengthMm?: number;
  maxCoolerHeightMm?: number;
  supportedRadiatorsMm?: number[];
  supportedPsu?: Array<"ATX" | "SFX">;
  caseSizeClass?: "itx" | "matx" | "mid" | "full";
  hasTemperedGlass?: boolean;
  // Cooler
  coolerType?: "air" | "aio";
  coolerHeightMm?: number;
  radiatorMm?: number;
  supportedSockets?: Array<"AM5" | "AM4" | "LGA1700" | "LGA1851">;
}

export interface PcPart {
  id: string;
  slot: Exclude<BuilderSlot, "monitor">;
  name: string;
  brand: string;
  price: number;
  color: "black" | "white" | "silver" | "gray";
  highlights: string;
  specs: PcPartSpecs;
  imageUrl?: string | null;
  buyUrl: string;
  platform: "JIB" | "iHAVECPU" | "Advice" | "Shopee" | "Lazada";
  isSample: boolean;
}

export type MonitorUsageCategory = "gaming" | "work" | "health" | "creator";

export interface MonitorSpec {
  id: string;
  name: string;
  brand: string;
  usage: MonitorUsageCategory;
  sizeInch: number;
  resolution: {
    width: number;
    height: number;
    label: "FHD 1920×1080" | "QHD 2560×1440" | "WQHD 3440×1440" | "4K UHD 3840×2160";
    short: "1080p" | "1440p" | "Ultrawide 1440p" | "4K";
  };
  refreshHz: number;
  panel: "Fast IPS" | "Rapid IPS" | "IPS" | "VA" | "QD-OLED" | "WOLED";
  responseMs: number;
  colorGamut: string;
  brightnessNits: number;
  curved: boolean;
  flickerFree: boolean;
  lowBlueLightCert: string;
  ergonomicStand: string[];
  ports: string[];
  price: number;
  color: "black" | "white" | "silver";
  imageUrl?: string | null;
  buyUrl: string;
  platform: "JIB" | "iHAVECPU" | "Advice" | "Shopee" | "Lazada";
  isSample: boolean;
}

export type BuildSelection = Partial<Record<BuilderSlot, string>>;

export interface SavedPcBuild {
  id: string;
  name: string;
  selection: BuildSelection;
  createdAt: string;
}
