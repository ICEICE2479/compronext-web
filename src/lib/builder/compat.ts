import { MONITOR_CATALOG } from "./monitors";
import { PC_PARTS } from "./parts";
import type { BuildSelection, MonitorSpec, PcPart } from "./types";

export interface ResolvedBuild {
  cpu: PcPart | null;
  motherboard: PcPart | null;
  ram: PcPart | null;
  gpu: PcPart | null;
  storage: PcPart | null;
  psu: PcPart | null;
  case: PcPart | null;
  cooler: PcPart | null;
  monitor: MonitorSpec | null;
}

export function resolveBuildSelection(sel: BuildSelection): ResolvedBuild {
  const findPart = (id: string | undefined) => (id ? PC_PARTS.find((p) => p.id === id) ?? null : null);
  return {
    cpu: findPart(sel.cpu),
    motherboard: findPart(sel.motherboard),
    ram: findPart(sel.ram),
    gpu: findPart(sel.gpu),
    storage: findPart(sel.storage),
    psu: findPart(sel.psu),
    case: findPart(sel.case),
    cooler: findPart(sel.cooler),
    monitor: sel.monitor ? MONITOR_CATALOG.find((m) => m.id === sel.monitor) ?? null : null,
  };
}

export function calculateBuildTotals(b: ResolvedBuild, gpuQty = 1): {
  totalPrice: number;
  pcOnlyPrice: number;
  monitorPrice: number;
  estimatedWatts: number;
  selectedCount: number;
} {
  const parts = [b.cpu, b.motherboard, b.ram, b.gpu, b.storage, b.psu, b.case, b.cooler];
  const pcOnlyPrice = parts.reduce((sum, p) => sum + (p?.price ?? 0), 0) + (b.gpu ? b.gpu.price * (gpuQty - 1) : 0);
  const monitorPrice = b.monitor?.price ?? 0;
  const selectedCount = parts.filter(Boolean).length + (b.monitor ? 1 : 0);

  const cpuWatts = b.cpu?.specs.tdpWatts ?? 0;
  const gpuWatts = (b.gpu?.specs.boardPowerWatts ?? 0) * Math.max(1, gpuQty);
  const baseOverhead = b.cpu || b.motherboard ? 75 : 0;
  const estimatedWatts = cpuWatts + gpuWatts + baseOverhead;

  return {
    totalPrice: pcOnlyPrice + monitorPrice,
    pcOnlyPrice,
    monitorPrice,
    estimatedWatts,
    selectedCount,
  };
}

export interface BuilderCompatIssue {
  id: string;
  title: string;
  status: "pass" | "fail" | "warn" | "insufficient";
  detail: string;
}

export function evaluateBuilderCompatibility(b: ResolvedBuild, gpuQty = 1): BuilderCompatIssue[] {
  const list: BuilderCompatIssue[] = [];
  const { estimatedWatts } = calculateBuildTotals(b, gpuQty);

  // 1. CPU <-> Motherboard Socket
  if (!b.cpu || !b.motherboard) {
    list.push({
      id: "socket",
      title: "ซ็อกเก็ต ซีพียู ↔ เมนบอร์ด",
      status: "insufficient",
      detail: "กรุณาเลือกทั้งซีพียูและเมนบอร์ดเพื่อตรวจสอบซ็อกเก็ต",
    });
  } else if (b.cpu.specs.socket !== b.motherboard.specs.socket) {
    list.push({
      id: "socket",
      title: "ซ็อกเก็ต ซีพียู ↔ เมนบอร์ด",
      status: "fail",
      detail: `ซีพียูใช้ซ็อกเก็ต ${b.cpu.specs.socket} แต่เมนบอร์ดเป็น ${b.motherboard.specs.socket} ใส่ด้วยกันไม่ได้`,
    });
  } else {
    list.push({
      id: "socket",
      title: "ซ็อกเก็ต ซีพียู ↔ เมนบอร์ด",
      status: "pass",
      detail: `ตรงกัน (${b.cpu.specs.socket})`,
    });
  }

  // 2. RAM <-> Motherboard
  if (!b.ram || !b.motherboard) {
    list.push({
      id: "ram",
      title: "ชนิดและจำนวนแถวแรม ↔ เมนบอร์ด",
      status: "insufficient",
      detail: "กรุณาเลือกแรมและเมนบอร์ดเพื่อตรวจสอบ DDR4/DDR5 และจำนวนสล็อต",
    });
  } else if (b.ram.specs.ramType !== b.motherboard.specs.ramType) {
    list.push({
      id: "ram",
      title: "ชนิดและจำนวนแถวแรม ↔ เมนบอร์ด",
      status: "fail",
      detail: `แรมเป็น ${b.ram.specs.ramType} แต่เมนบอร์ดรองรับเฉพาะ ${b.motherboard.specs.ramType}`,
    });
  } else if ((b.ram.specs.modules ?? 2) > (b.motherboard.specs.ramSlots ?? 4)) {
    list.push({
      id: "ram",
      title: "ชนิดและจำนวนแถวแรม ↔ เมนบอร์ด",
      status: "fail",
      detail: `ชุดแรมมี ${b.ram.specs.modules} แถว แต่เมนบอร์ดมีเพียง ${b.motherboard.specs.ramSlots} สล็อต`,
    });
  } else {
    list.push({
      id: "ram",
      title: "ชนิดและจำนวนแถวแรม ↔ เมนบอร์ด",
      status: "pass",
      detail: `รองรับ ${b.ram.specs.ramType} (${b.ram.specs.modules} แถว จาก ${b.motherboard.specs.ramSlots} สล็อต)`,
    });
  }

  // 3. Motherboard <-> Case form factor
  if (!b.motherboard || !b.case) {
    list.push({
      id: "case-board",
      title: "ขนาดเมนบอร์ด ↔ เคส",
      status: "insufficient",
      detail: "กรุณาเลือกเมนบอร์ดและเคสเพื่อตรวจสอบขนาด (ATX / mATX / ITX)",
    });
  } else if (!b.case.specs.supportedBoardSizes?.includes(b.motherboard.specs.formFactor!)) {
    list.push({
      id: "case-board",
      title: "ขนาดเมนบอร์ด ↔ เคส",
      status: "fail",
      detail: `เมนบอร์ดขนาด ${b.motherboard.specs.formFactor} ใส่ในเคสที่รองรับเฉพาะ [${b.case.specs.supportedBoardSizes?.join(", ")}] ไม่ได้`,
    });
  } else {
    list.push({
      id: "case-board",
      title: "ขนาดเมนบอร์ด ↔ เคส",
      status: "pass",
      detail: `เคสรองรับเมนบอร์ดขนาด ${b.motherboard.specs.formFactor}`,
    });
  }

  // 4. GPU length <-> Case + Video output check
  if (!b.gpu) {
    if (b.cpu && b.cpu.specs.hasIgpu === false) {
      list.push({
        id: "gpu-signal",
        title: "สัญญาณภาพออกจอ",
        status: "fail",
        detail: `${b.cpu.name} ไม่มีกราฟิกในตัว (No iGPU) จำเป็นต้องเลือกการ์ดจอแยก`,
      });
    } else {
      list.push({
        id: "gpu-signal",
        title: "ความยาวการ์ดจอ ↔ เคส",
        status: "insufficient",
        detail: "ยังไม่ได้เลือกการ์ดจอแยก (ใช้ iGPU บนซีพียู)",
      });
    }
  } else if (!b.case) {
    list.push({
      id: "gpu-signal",
      title: "ความยาวการ์ดจอ ↔ เคส",
      status: "insufficient",
      detail: "กรุณาเลือกเคสเพื่อตรวจความยาวการ์ดจอ",
    });
  } else if ((b.gpu.specs.lengthMm ?? 0) > (b.case.specs.maxGpuLengthMm ?? 999)) {
    list.push({
      id: "gpu-signal",
      title: "ความยาวการ์ดจอ ↔ เคส",
      status: "fail",
      detail: `การ์ดจอยาว ${b.gpu.specs.lengthMm} มม. เกินพื้นที่เคสที่รับได้สูงสุด ${b.case.specs.maxGpuLengthMm} มม.`,
    });
  } else {
    list.push({
      id: "gpu-signal",
      title: "ความยาวการ์ดจอ ↔ เคส",
      status: "pass",
      detail: `การ์ดจอยาว ${b.gpu.specs.lengthMm} มม. ใส่ในเคสได้ (รองรับสูงสุด ${b.case.specs.maxGpuLengthMm} มม.)`,
    });
  }

  // 5. Cooler <-> Case
  if (!b.cooler || !b.case) {
    list.push({
      id: "cooler-case",
      title: "ชุดระบายความร้อน ↔ เคส",
      status: "insufficient",
      detail: "กรุณาเลือกชุดระบายความร้อนและเคส",
    });
  } else if (
    b.cooler.specs.coolerType === "air" &&
    (b.cooler.specs.coolerHeightMm ?? 0) > (b.case.specs.maxCoolerHeightMm ?? 999)
  ) {
    list.push({
      id: "cooler-case",
      title: "ชุดระบายความร้อน ↔ เคส",
      status: "fail",
      detail: `ซิงก์ลมสูง ${b.cooler.specs.coolerHeightMm} มม. เกินความสูงที่เคสรองรับ (${b.case.specs.maxCoolerHeightMm} มม.)`,
    });
  } else if (
    b.cooler.specs.coolerType === "aio" &&
    !b.case.specs.supportedRadiatorsMm?.includes(b.cooler.specs.radiatorMm ?? 240)
  ) {
    list.push({
      id: "cooler-case",
      title: "ชุดระบายความร้อน ↔ เคส",
      status: "fail",
      detail: `หม้อน้ำ ${b.cooler.specs.radiatorMm} มม. ไม่รองรับในเคสนี้ (รับได้เฉพาะ ${b.case.specs.supportedRadiatorsMm?.join("/")} มม.)`,
    });
  } else {
    list.push({
      id: "cooler-case",
      title: "ชุดระบายความร้อน ↔ เคส",
      status: "pass",
      detail:
        b.cooler.specs.coolerType === "aio"
          ? `เคสรองรับหม้อน้ำ ${b.cooler.specs.radiatorMm} มม.`
          : `เคสรองรับซิงก์ลมสูง ${b.cooler.specs.coolerHeightMm} มม.`,
    });
  }

  // 6. PSU wattage & form factor
  if (!b.psu) {
    list.push({
      id: "psu",
      title: "กำลังไฟและขนาดพาวเวอร์ซัพพลาย (PSU)",
      status: "insufficient",
      detail: `กรุณาเลือก PSU (ระบบใช้ไฟประมาณ ${estimatedWatts}W)`,
    });
  } else {
    const psuW = b.psu.specs.wattage ?? 0;
    const recommendedW = Math.round(estimatedWatts * 1.3);
    if (b.case && !b.case.specs.supportedPsu?.includes(b.psu.specs.psuFormFactor!)) {
      list.push({
        id: "psu",
        title: "กำลังไฟและขนาดพาวเวอร์ซัพพลาย (PSU)",
        status: "fail",
        detail: `PSU ขนาด ${b.psu.specs.psuFormFactor} ใส่ในเคสที่รับเฉพาะ [${b.case.specs.supportedPsu?.join(", ")}] ไม่ได้`,
      });
    } else if (psuW < estimatedWatts) {
      list.push({
        id: "psu",
        title: "กำลังไฟและขนาดพาวเวอร์ซัพพลาย (PSU)",
        status: "fail",
        detail: `PSU ${psuW}W ไม่พอต่อโหลดระบบประมาณ ${estimatedWatts}W (แนะนำอย่างน้อย ${recommendedW}W)`,
      });
    } else if (psuW < recommendedW) {
      list.push({
        id: "psu",
        title: "กำลังไฟและขนาดพาวเวอร์ซัพพลาย (PSU)",
        status: "warn",
        detail: `PSU ${psuW}W เพียงพอแต่เหลือ Headroom น้อย (โหลดประมาณ ${estimatedWatts}W แนะนำ ${recommendedW}W ขึ้นไป)`,
      });
    } else {
      list.push({
        id: "psu",
        title: "กำลังไฟและขนาดพาวเวอร์ซัพพลาย (PSU)",
        status: "pass",
        detail: `PSU ${psuW}W เพียงพอพร้อมไฟสำรอง (โหลดประมาณ ${estimatedWatts}W)`,
      });
    }
  }

  return list;
}

/** ใส่การ์ดจอได้กี่ใบ (ตามช่อง PCIe x16 ขนาดเต็มของเมนบอร์ด) */
export function maxGpuCount(board: PcPart | null): number {
  if (!board) return 1;
  return board.specs.pcieX16Slots ?? (board.specs.formFactor === "ITX" ? 1 : 2);
}
