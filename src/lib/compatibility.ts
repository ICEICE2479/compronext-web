import type { Dimensions, Product, ResolvedRoomItem } from "./types";

export type CompatStatus = "pass" | "fail" | "insufficient";

export interface CompatCheckResult {
  id: string;
  title: string;
  status: CompatStatus;
  detail: string;
}

function toCm(d: Dimensions | null): { width: number | null; depth: number | null; height: number | null } | null {
  if (!d) return null;
  const factor = d.unit === "mm" ? 0.1 : d.unit === "in" ? 2.54 : 1;
  return {
    width: d.width !== null ? +(d.width * factor).toFixed(1) : null,
    depth: d.depth !== null ? +(d.depth * factor).toFixed(1) : null,
    height: d.height !== null ? +(d.height * factor).toFixed(1) : null,
  };
}

function normalizePortFamily(port: string): "hdmi" | "dp" | "usbc_dp" | "vga" | "other" {
  const s = port.toLowerCase();
  if (s.includes("usb-c") || s.includes("thunderbolt") || s.includes("type-c")) return "usbc_dp";
  if (s.includes("displayport") || s.startsWith("dp")) return "dp";
  if (s.includes("hdmi")) return "hdmi";
  if (s.includes("vga")) return "vga";
  return "other";
}

/**
 * ตรวจสอบความเข้ากันได้ของสินค้าในห้องจากข้อมูลจริง
 * ห้ามแสดงว่าเข้ากันได้แน่นอนหากไม่มีข้อมูลรองรับ
 */
export function evaluateRoomCompatibility(items: ResolvedRoomItem[]): {
  overall: CompatStatus;
  checks: CompatCheckResult[];
} {
  const validProducts: Array<{ product: Product; quantity: number }> = items
    .filter((it): it is ResolvedRoomItem & { product: Product } => it.product !== null)
    .map((it) => ({ product: it.product, quantity: Math.max(1, it.quantity) }));

  const checks: CompatCheckResult[] = [];

  // 1) พอร์ตเชื่อมต่อระหว่างคอมพิวเตอร์และจอภาพ
  const computers = validProducts.filter((x) => x.product.category === "computer");
  const monitors = validProducts.filter((x) => x.product.category === "monitor");

  if (computers.length === 0 || monitors.length === 0) {
    checks.push({
      id: "ports-pc-monitor",
      title: "พอร์ตเชื่อมต่อ คอมพิวเตอร์ ↔ จอภาพ",
      status: "insufficient",
      detail:
        computers.length === 0
          ? "ไม่มีรายการคอมพิวเตอร์ในห้องนี้ จึงไม่สามารถตรวจสอบพอร์ตเชื่อมต่อกับจอภาพได้"
          : "ไม่มีรายการจอภาพในห้องนี้ จึงไม่สามารถตรวจสอบพอร์ตเชื่อมต่อได้",
    });
  } else {
    const pc = computers[0].product;
    const totalMonitorsCount = monitors.reduce((acc, m) => acc + m.quantity, 0);

    if (!pc.ports || pc.ports.length === 0) {
      checks.push({
        id: "ports-pc-monitor",
        title: "พอร์ตเชื่อมต่อ คอมพิวเตอร์ ↔ จอภาพ",
        status: "insufficient",
        detail: `สินค้า "${pc.name}" ยังไม่มีข้อมูลพอร์ตสัญญาณภาพ จึงไม่ยืนยันความเข้ากันได้`,
      });
    } else {
      const pcFamilies = pc.ports.map(normalizePortFamily);
      const missingPortMonitors = monitors.filter((m) => !m.product.ports || m.product.ports.length === 0);

      if (missingPortMonitors.length > 0) {
        checks.push({
          id: "ports-pc-monitor",
          title: "พอร์ตเชื่อมต่อ คอมพิวเตอร์ ↔ จอภาพ",
          status: "insufficient",
          detail: `จอ "${missingPortMonitors[0].product.name}" ยังไม่มีข้อมูลพอร์ตรับสัญญาณ จึงไม่ยืนยันความเข้ากันได้`,
        });
      } else if (pc.ports.length < totalMonitorsCount) {
        checks.push({
          id: "ports-pc-monitor",
          title: "พอร์ตเชื่อมต่อ คอมพิวเตอร์ ↔ จอภาพ",
          status: "fail",
          detail: `คอมพิวเตอร์มีพอร์ตภาพ ${pc.ports.length} ช่อง (${pc.ports.join(", ")}) แต่ในห้องใช้จอรวม ${totalMonitorsCount} จอ`,
        });
      } else {
        // ตรวจสอบว่าจอแต่ละตัวมีพอร์ตที่ตรงกับคอมหรือไม่
        const incompatibleMonitor = monitors.find((m) => {
          const monFamilies = m.product.ports.map(normalizePortFamily);
          return !monFamilies.some((mf) => pcFamilies.includes(mf));
        });

        if (incompatibleMonitor) {
          checks.push({
            id: "ports-pc-monitor",
            title: "พอร์ตเชื่อมต่อ คอมพิวเตอร์ ↔ จอภาพ",
            status: "fail",
            detail: `"${pc.name}" มีพอร์ต [${pc.ports.join(", ")}] ไม่ตรงกับพอร์ตของ "${incompatibleMonitor.product.name}" [${incompatibleMonitor.product.ports.join(", ")}] ต้องใช้อะแดปเตอร์แปลงสัญญาณ`,
          });
        } else {
          checks.push({
            id: "ports-pc-monitor",
            title: "พอร์ตเชื่อมต่อ คอมพิวเตอร์ ↔ จอภาพ",
            status: "pass",
            detail: `พอร์ตของ "${pc.name}" (${pc.ports.join(", ")}) รองรับจอภาพทั้ง ${totalMonitorsCount} จอโดยตรง`,
          });
        }
      }
    }
  }

  // 2) ความกว้างโต๊ะ vs ความกว้างรวมของจอภาพ
  const desks = validProducts.filter((x) => x.product.category === "desk");
  const monitorArms = validProducts.filter((x) => x.product.category === "monitor_arm");

  if (desks.length === 0) {
    checks.push({
      id: "desk-monitor-width",
      title: "ความกว้างโต๊ะ ↔ ขนาดจอภาพ",
      status: "insufficient",
      detail: "ไม่มีข้อมูลโต๊ะในห้องนี้ จึงไม่สามารถตรวจสอบความกว้างได้",
    });
  } else {
    const desk = desks[0].product;
    const deskCm = toCm(desk.dimensions);

    if (!deskCm || deskCm.width === null || deskCm.depth === null) {
      checks.push({
        id: "desk-monitor-width",
        title: "ความกว้างโต๊ะ ↔ ขนาดจอภาพ",
        status: "insufficient",
        detail: `โต๊ะ "${desk.name}" ยังไม่มีข้อมูลขนาดกว้าง × ลึกที่ครบถ้วน`,
      });
    } else if (monitors.length === 0) {
      checks.push({
        id: "desk-monitor-width",
        title: "ความกว้างโต๊ะ ↔ ขนาดจอภาพ",
        status: "insufficient",
        detail: "ไม่มีข้อมูลจอภาพเพื่อเปรียบเทียบกับขนาดโต๊ะ",
      });
    } else {
      const monitorDims = monitors.map((m) => ({
        name: m.product.name,
        qty: m.quantity,
        cm: toCm(m.product.dimensions),
      }));

      if (monitorDims.some((m) => !m.cm || m.cm.width === null)) {
        checks.push({
          id: "desk-monitor-width",
          title: "ความกว้างโต๊ะ ↔ ขนาดจอภาพ",
          status: "insufficient",
          detail: "จอภาพบางรายการยังไม่มีข้อมูลความกว้าง จึงไม่สามารถคำนวณระยะวางได้",
        });
      } else {
        const totalMonitorWidth = monitorDims.reduce((sum, m) => sum + (m.cm!.width ?? 0) * m.qty, 0);
        const hasMultiArm = monitorArms.length > 0;
        // หากมีแขนจับจอหลายจอ สามารถเอียงจอเข้าหากันหรือซ้อนมุมได้ ~82%
        const effectiveSpan = hasMultiArm && totalMonitorWidth > deskCm.width ? +(totalMonitorWidth * 0.82).toFixed(1) : +totalMonitorWidth.toFixed(1);

        if (effectiveSpan > deskCm.width * 1.05) {
          checks.push({
            id: "desk-monitor-width",
            title: "ความกว้างโต๊ะ ↔ ขนาดจอภาพ",
            status: "fail",
            detail: `ความกว้างรวมของจอประมาณ ${effectiveSpan} ซม. เกินหน้าโต๊ะกว้าง ${deskCm.width} ซม.`,
          });
        } else {
          checks.push({
            id: "desk-monitor-width",
            title: "ความกว้างโต๊ะ ↔ ขนาดจอภาพ",
            status: "pass",
            detail: `โต๊ะกว้าง ${deskCm.width} × ลึก ${deskCm.depth} ซม. รองรับระยะวางจอรวมประมาณ ${effectiveSpan} ซม.${hasMultiArm ? " (ติดตั้งบนแขนจับจอ)" : ""}`,
          });
        }
      }
    }

    // 3) พื้นที่วางอุปกรณ์บนโต๊ะ (Desk surface footprint)
    if (deskCm && deskCm.width !== null && deskCm.depth !== null) {
      const deskItems = validProducts.filter(
        (x) => x.product.placement === "desk" && x.product.category !== "desk" && x.product.category !== "mousepad"
      );
      const missingDimItems = deskItems.filter((x) => {
        const cm = toCm(x.product.dimensions);
        return !cm || cm.width === null || cm.depth === null;
      });

      const deskArea = deskCm.width * deskCm.depth;
      const usedArea = deskItems.reduce((sum, x) => {
        const cm = toCm(x.product.dimensions);
        if (!cm || cm.width === null || cm.depth === null) return sum;
        return sum + cm.width * cm.depth * x.quantity;
      }, 0);
      const ratio = deskArea > 0 ? Math.round((usedArea / deskArea) * 100) : 0;

      if (missingDimItems.length > 0) {
        checks.push({
          id: "desk-surface-area",
          title: "พื้นที่วางอุปกรณ์บนโต๊ะ",
          status: "insufficient",
          detail: `อุปกรณ์บนโต๊ะ ${missingDimItems.length} รายการ (เช่น "${missingDimItems[0].product.name}") ยังไม่มีข้อมูลขนาดครบถ้วน — เฉพาะชิ้นที่มีข้อมูลใช้พื้นที่ประมาณ ${ratio}% ของหน้าโต๊ะ`,
        });
      } else if (ratio > 80) {
        checks.push({
          id: "desk-surface-area",
          title: "พื้นที่วางอุปกรณ์บนโต๊ะ",
          status: "fail",
          detail: `อุปกรณ์บนโต๊ะใช้พื้นที่รวมประมาณ ${ratio}% ของหน้าโต๊ะ (${deskCm.width}×${deskCm.depth} ซม.) แน่นเกินไป ควรใช้โต๊ะที่ใหญ่ขึ้น`,
        });
      } else {
        checks.push({
          id: "desk-surface-area",
          title: "พื้นที่วางอุปกรณ์บนโต๊ะ",
          status: "pass",
          detail: `อุปกรณ์บนโต๊ะที่มีข้อมูลครบถ้วนใช้พื้นที่ประมาณ ${ratio}% ของหน้าโต๊ะ (${deskCm.width}×${deskCm.depth} ซม.) เหลือพื้นที่ใช้งานสะดวก`,
        });
      }
    }
  }

  // 4) ตรวจสอบข้อมูลขนาด/สเปกของสินค้าทั้งหมดในห้อง
  const missingAnySpec = validProducts.filter((x) => {
    const p = x.product;
    if (["desk", "monitor", "keyboard", "mousepad", "chair"].includes(p.category) && !p.dimensions) return true;
    return false;
  });

  if (missingAnySpec.length > 0) {
    checks.push({
      id: "completeness",
      title: "ความครบถ้วนของข้อมูลขนาดและสเปก",
      status: "insufficient",
      detail: `มีสินค้าหลัก ${missingAnySpec.length} รายการที่ยังไม่มีขนาดครบถ้วน: ${missingAnySpec.map((m) => m.product.name).join(", ")}`,
    });
  } else {
    checks.push({
      id: "completeness",
      title: "ความครบถ้วนของข้อมูลขนาดและสเปก",
      status: "pass",
      detail: "สินค้าหลักทุกชิ้น (โต๊ะ จอ คีย์บอร์ด แผ่นรอง เก้าอี้) มีข้อมูลขนาดสำหรับตรวจสอบครบถ้วน",
    });
  }

  const hasFail = checks.some((c) => c.status === "fail");
  const hasInsufficient = checks.some((c) => c.status === "insufficient");
  const overall: CompatStatus = hasFail ? "fail" : hasInsufficient ? "insufficient" : "pass";

  return { overall, checks };
}

const CHECKS_BY_CATEGORY: Record<string, string[]> = {
  computer: ["ports-pc-monitor"],
  monitor: ["ports-pc-monitor", "desk-monitor-width", "desk-surface-area"],
  desk: ["desk-monitor-width", "desk-surface-area"],
  monitor_arm: ["desk-monitor-width"],
};
const PAIR_CATEGORIES: Record<string, string[]> = {
  computer: ["monitor"],
  monitor: ["computer", "desk", "monitor_arm"],
  desk: ["monitor", "monitor_arm"],
  monitor_arm: ["monitor", "desk"],
};

/** เทียบสินค้าชิ้นเดียวกับของอื่น (เช่นในตะกร้า) เฉพาะเช็กแบบคู่ที่เกี่ยวกับหมวดของสินค้านี้โดยตรง */
export function compatAgainstItems(
  product: Product,
  others: Product[],
): { overall: CompatStatus; checks: CompatCheckResult[] } | null {
  const relevantChecks = new Set(CHECKS_BY_CATEGORY[product.category] ?? []);
  if (product.placement === "desk" && product.category !== "desk" && product.category !== "mousepad") {
    relevantChecks.add("desk-surface-area");
  }
  if (relevantChecks.size === 0) return null;

  const rest = others.filter((o) => o.id !== product.id);
  const mine = PAIR_CATEGORIES[product.category] ?? [];
  const related = rest.filter(
    (o) =>
      mine.includes(o.category) ||
      (product.category === "desk" && o.placement === "desk") ||
      (product.placement === "desk" && o.category === "desk")
  );
  if (related.length === 0) return null;

  // สำหรับหมวดเดียวกับ product (เช่นมีโต๊ะหรือคอมตัวอื่นในตะกร้า) ให้ใช้ product เป็นตัวหลักในการเทียบคู่
  const singletonCats = new Set(["computer", "desk"]);
  const filteredRest = singletonCats.has(product.category)
    ? rest.filter((o) => o.category !== product.category)
    : rest;

  const items = [product, ...filteredRest].map((p) => ({ productId: p.id, quantity: 1, product: p }));
  let kept = evaluateRoomCompatibility(items).checks.filter((c) => relevantChecks.has(c.id));
  if (kept.some((c) => c.status !== "insufficient")) kept = kept.filter((c) => c.status !== "insufficient");
  if (kept.length === 0) return null;
  const overall: CompatStatus = kept.some((c) => c.status === "fail")
    ? "fail"
    : kept.some((c) => c.status === "insufficient")
      ? "insufficient"
      : "pass";
  return { overall, checks: kept };
}
