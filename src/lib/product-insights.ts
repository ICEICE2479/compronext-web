/**
 * ข้อดี / ข้อควรรู้ / เหมาะกับ ของสินค้าคอม — สรุปจากสเปกที่อ่านได้จากชื่อสินค้า
 * (กฎตายตัว ไม่ได้มาจากรีวิว จึงเขียนแบบกลางๆ ให้คนทั่วไปอ่านเข้าใจ)
 */

export interface Insight {
  fit: string | null;
  pros: string[];
  cons: string[];
}

/** อธิบายสั้นๆ ว่าชิ้นนี้ทำหน้าที่อะไร */
export const KIND_EXPLAIN: Record<string, string> = {
  ซีพียู: "สมองของคอม คิดคำนวณทุกอย่าง ยิ่งคอร์เยอะยิ่งทำหลายงานพร้อมกันได้ดี ส่วนเกมเน้นความเร็วต่อคอร์และแคช",
  การ์ดจอ: "วาดภาพเกมและงานกราฟิก มีผลกับเฟรมเรตมากที่สุด VRAM คือหน่วยความจำของการ์ด ยิ่งความละเอียดสูงยิ่งต้องใช้เยอะ",
  เมนบอร์ด: "แผงหลักที่ทุกชิ้นมาเสียบรวมกัน ต้องเลือกซ็อกเก็ตให้ตรงกับซีพียู และชนิดแรมให้ตรงกัน",
  แรม: "หน่วยความจำชั่วคราวตอนเปิดโปรแกรม ถ้าน้อยไปเครื่องจะกระตุกเมื่อเปิดหลายอย่าง ตอนนี้แนะนำ 16–32GB",
  "SSD/HDD": "ที่เก็บไฟล์และเกม SSD แบบ NVMe เปิดเครื่อง/โหลดเกมเร็วที่สุด HDD ถูกและจุเยอะแต่ช้า",
  พาวเวอร์ซัพพลาย: "จ่ายไฟให้ทุกชิ้น ต้องมีวัตต์พอสำหรับการ์ดจอและซีพียู มาตรฐาน 80+ ยิ่งสูงยิ่งประหยัดไฟ",
  ระบายความร้อน: "ดึงความร้อนออกจากซีพียู ชุดน้ำเย็นและดูสวย ซิงก์ลมทนทานและราคาถูกกว่า",
  เคส: "กล่องใส่ทุกชิ้น ขนาดเคสต้องรองรับเมนบอร์ดและความยาวการ์ดจอ เคสใหญ่ระบายความร้อนดีกว่า",
  คอมประกอบ: "คอมที่ร้านประกอบมาให้ครบชุด เปิดใช้ได้ทันที เทียบได้จากซีพียู การ์ดจอ แรม และพื้นที่เก็บข้อมูล",
  โน้ตบุ๊ก: "คอมพกพา จอและแบตในตัว เทียบจากซีพียู การ์ดจอ แรม และน้ำหนัก",
  จอ: "ขนาด ความละเอียด และรีเฟรชเรตกำหนดความคมและความลื่นของภาพ พาเนล IPS สีสวย VA คอนทราสต์ดี OLED ดีสุดแต่แพง",
  คีย์บอร์ด: "สวิตช์กำหนดสัมผัสและเสียง: แดง = นุ่มเงียบ, น้ำตาล = มีจังหวะ, น้ำเงิน = คลิกดัง",
  เมาส์: "เกมแข่งเน้นน้ำหนักเบาและเซนเซอร์แม่น งานทั่วไปเน้นจับสบายและเงียบ",
  หูฟัง: "ไร้สายสะดวกแต่ต้องชาร์จ มีสายไม่ต้องห่วงแบต แบบครอบหูเก็บเสียงดีกว่า",
  ไมโครโฟน: "USB เสียบใช้ได้ทันที XLR คุณภาพสูงกว่าแต่ต้องมีอุปกรณ์แปลงเสียง",
};

const has = (specs: Array<[string, string]>, k: string) => specs.find(([x]) => x === k)?.[1] ?? null;
const num = (v: string | null) => (v ? Number(v.replace(/[^\d.]/g, "")) : NaN);

export function insightFor(kind: string, name: string, specs: Array<[string, string]>): Insight {
  const up = name.toUpperCase();
  const pros: string[] = [];
  const cons: string[] = [];
  let fit: string | null = null;

  switch (kind) {
    case "ซีพียู": {
      const cores = Number((has(specs, "คอร์/เธรด") ?? "").match(/\d+/)?.[0] ?? NaN);
      const socket = has(specs, "ซ็อกเก็ต") ?? "";
      if (/X3D/.test(up)) {
        pros.push("แคช 3D ใหญ่ เล่นเกมเฟรมสูงมาก");
      }
      if (cores >= 12) pros.push("คอร์เยอะ ตัดต่อ/สตรีมพร้อมเล่นเกมได้ลื่น");
      if (cores && cores <= 6) cons.push(`${cores} คอร์ งานหนักหลายอย่างพร้อมกันอาจช้า`);
      if (/AM5|1851/.test(socket)) pros.push("แพลตฟอร์มใหม่ อัปเกรดต่อได้อีกหลายปี");
      if (/AM4|1700/.test(socket)) cons.push("แพลตฟอร์มรุ่นก่อน อัปเกรดต่อได้จำกัด");
      if (/\d{4,5}KF?\b|\dK\b/.test(up)) pros.push("ปลดล็อก โอเวอร์คล็อกได้");
      if (/\d{4,5}K?F\b/.test(up)) cons.push("ไม่มีกราฟิกในตัว ต้องใช้การ์ดจอ");
      if (/\d{4}G[TE]?\b/.test(up)) pros.push("มีกราฟิกในตัว ไม่มีการ์ดจอก็ใช้งานได้");
      if (/TRAY|MPK/.test(up)) cons.push("แพ็กไม่มีกล่อง (TRAY/MPK) อาจไม่มีพัดลมแถม");
      if (Number.isFinite(cores)) {
        fit = /X3D/.test(up)
          ? "เล่นเกมเป็นหลัก"
          : cores >= 12
            ? "เล่นเกม + ทำงานหนัก"
            : cores >= 8
              ? "เล่นเกมและงานทั่วไป"
              : "งานทั่วไป/เกมเบาๆ";
      }
      break;
    }
    case "การ์ดจอ": {
      const vram = num(has(specs, "หน่วยความจำ"));
      const chip = has(specs, "ชิป") ?? "";
      const tier = Number(chip.match(/\d{2}(\d)0/)?.[1] ?? NaN);
      if (vram >= 16) pros.push(`VRAM ${vram}GB เล่น 4K หรือทำ AI ได้สบาย`);
      else if (vram >= 12) pros.push(`VRAM ${vram}GB พอสำหรับ 1440p`);
      if (vram && vram <= 8) cons.push(`VRAM ${vram}GB อาจตึงกับเกมใหม่ที่ 1440p ขึ้นไป`);
      if (/RTX/.test(chip)) pros.push("รองรับ DLSS และ Ray Tracing");
      if (/^RX/.test(chip)) {
        pros.push("ราคาต่อเฟรมคุ้ม");
        cons.push("Ray Tracing ด้อยกว่าฝั่ง RTX");
      }
      const psu = num(has(specs, "พาวเวอร์แนะนำ") ?? has(specs, "กำลังไฟแนะนำ"));
      if (psu > 0) cons.push(`ผู้ผลิตแนะนำพาวเวอร์ ${psu}W ขึ้นไป`);
      if (tier >= 8) fit = "เกม 4K / งานหนัก (ประมาณ)";
      else if (tier === 7) fit = "เกม 1440p (ประมาณ)";
      else if (tier) fit = "เกม 1080p (ประมาณ)";
      break;
    }
    case "เมนบอร์ด": {
      const chipset = has(specs, "ชิปเซ็ต") ?? "";
      if (/^[XZ]/.test(chipset)) {
        pros.push("ชิปเซ็ตตัวท็อป ฟีเจอร์ครบ โอเวอร์คล็อกได้");
        cons.push("ราคาสูง ถ้าไม่โอเวอร์คล็อกอาจเกินจำเป็น");
      } else if (/^B/.test(chipset)) pros.push("ชิปเซ็ตระดับกลาง สมดุลราคากับฟีเจอร์");
      else if (/^[AH]/.test(chipset)) cons.push("ชิปเซ็ตพื้นฐาน ช่องต่อน้อย โอเวอร์คล็อกไม่ได้");
      if (has(specs, "Wi-Fi")) pros.push("มี Wi-Fi ในตัว ไม่ต้องเดินสาย LAN");
      if (/D4/.test(up)) cons.push("ใช้แรม DDR4 เท่านั้น");
      if (has(specs, "ขนาดบอร์ด") === "Mini-ITX") cons.push("บอร์ดเล็ก สล็อตน้อย ประกอบยาก");
      fit = /^[XZ]/.test(chipset) ? "สายโอเวอร์คล็อก" : "คอมเล่นเกม/ทำงานทั่วไป";
      break;
    }
    case "แรม": {
      const cap = num(has(specs, "ความจุ"));
      const type = has(specs, "ชนิด");
      if (type === "DDR5") pros.push("DDR5 เร็วกว่า ใช้กับบอร์ดรุ่นใหม่");
      if (type === "DDR4") cons.push("DDR4 ใส่ได้เฉพาะบอร์ด DDR4");
      if (cap >= 32) pros.push(`${cap}GB เล่นเกม + เปิดโปรแกรมหนักพร้อมกันได้`);
      else if (cap === 16) pros.push("16GB พอสำหรับเล่นเกมทั่วไป");
      if (cap && cap < 16) cons.push(`${cap}GB น้อยไปสำหรับเกมใหม่ แนะนำ 16GB ขึ้นไป`);
      if (/RGB/.test(up)) pros.push("มีไฟ RGB");
      fit = cap >= 32 ? "เกม + ตัดต่อ" : "เล่นเกมทั่วไป";
      break;
    }
    case "SSD/HDD": {
      const type = has(specs, "ชนิด") ?? "";
      const cap = has(specs, "ความจุ") ?? "";
      if (/NVMe/.test(type)) pros.push("NVMe โหลดเกม/เปิดเครื่องเร็วมาก");
      if (has(specs, "PCIe") === "Gen 4" || has(specs, "PCIe") === "Gen 5") pros.push(`PCIe ${has(specs, "PCIe")} ความเร็วสูง`);
      if (type === "SSD SATA") cons.push("SATA ช้ากว่า NVMe ประมาณ 5 เท่า");
      if (type === "HDD") cons.push("HDD ช้า เหมาะเก็บไฟล์ ไม่เหมาะลงเกม");
      if (/^(256|512)\s?GB/.test(cap)) cons.push("พื้นที่น้อย เกมใหม่เกมละ 100GB+");
      if (/TB/.test(cap)) pros.push(`ความจุ ${cap} ลงเกมได้หลายเกม`);
      if (/ENCLOSURE|กล่อง/.test(up)) {
        pros.length = 0;
        cons.length = 0;
        pros.push("แปลง SSD M.2 เป็นไดรฟ์พกพา");
        fit = "พกไฟล์ / สำรองข้อมูล";
      }
      break;
    }
    case "พาวเวอร์ซัพพลาย": {
      const w = num(has(specs, "กำลังไฟ"));
      const std = (has(specs, "มาตรฐาน") ?? "").toUpperCase();
      if (/GOLD|PLATINUM|TITANIUM/.test(std)) pros.push(`${std} ประหยัดไฟ ร้อนน้อย`);
      if (/BRONZE|WHITE/.test(std)) cons.push(`${std} ประสิทธิภาพต่ำกว่า Gold`);
      if (w >= 850) pros.push("วัตต์เหลือเผื่ออัปเกรดการ์ดจอแรง");
      if (w && w <= 550) cons.push("วัตต์น้อย ไม่เหมาะการ์ดจอระดับกลางขึ้นไป");
      if (has(specs, "สายถอดได้")) pros.push("สายถอดได้ จัดสายง่าย");
      if (w) fit = w >= 850 ? "การ์ดจอแรง (ประมาณ)" : w >= 650 ? "คอมเล่นเกมระดับกลาง (ประมาณ)" : "คอมทำงาน/การ์ดจอเล็ก (ประมาณ)";
      break;
    }
    case "ระบายความร้อน": {
      const aio = has(specs, "ชนิด") === "ชุดน้ำปิด";
      if (aio) {
        pros.push("เย็นและเงียบ ดูสวยในเคสกระจก");
        cons.push("ราคาสูงกว่า ปั๊มมีอายุการใช้งาน");
        if (has(specs, "ขนาดหม้อน้ำ")?.startsWith("360")) pros.push("หม้อน้ำ 360 มม. เอาอยู่กับซีพียูตัวแรง");
        if (has(specs, "ขนาดหม้อน้ำ")) cons.push(`ต้องเช็กว่าเคสรองรับหม้อน้ำ ${has(specs, "ขนาดหม้อน้ำ")}`);
      } else if (/FAN|พัดลม/.test(up) && !/COOLER|ซิงก์/.test(up)) {
        pros.push("เพิ่มลมเข้า-ออกในเคส ช่วยลดอุณหภูมิทั้งระบบ");
        fit = "เสริมการระบายความร้อนในเคส";
      } else {
        pros.push("ทนทาน ไม่มีปั๊ม ดูแลง่าย ราคาคุ้ม");
        cons.push("ตัวสูง ต้องเช็กความสูงที่เคสรองรับ");
      }
      if (has(specs, "ไฟ")) pros.push("มีไฟ ARGB");
      fit ??= aio ? "ซีพียูตัวแรง / เคสโชว์" : "คอมทั่วไป เน้นคุ้ม";
      break;
    }
    case "เคส": {
      const size = has(specs, "ขนาด");
      if (has(specs, "กระจกข้าง") || /TG|GLASS/.test(up)) pros.push("กระจกข้าง โชว์ไฟ RGB ได้");
      if (size === "Mini-ITX") cons.push("เคสเล็ก ประกอบยาก ระบายความร้อนจำกัด");
      if (size === "ATX" || size === "Mid Tower" || size === "Full Tower") pros.push("ใส่บอร์ด ATX ได้ ประกอบง่าย ลมผ่านสะดวก");
      if (/ARGB|RGB/.test(up)) pros.push("มีพัดลม/ไฟ ARGB มาให้");
      cons.push("เช็กความยาวการ์ดจอที่รองรับก่อนซื้อ");
      break;
    }
    case "คอมประกอบ":
    case "โน้ตบุ๊ก":
    case "คอมตั้งโต๊ะ": {
      const gpu = has(specs, "การ์ดจอ") ?? "";
      const ram = num(has(specs, "แรม"));
      const disk = has(specs, "พื้นที่เก็บข้อมูล") ?? "";
      if (kind === "คอมประกอบ") pros.push("ประกอบมาครบ เปิดใช้ได้ทันที");
      if (/RTX|RX/.test(gpu)) {
        const tier = Number(gpu.match(/\d{2}(\d)0/)?.[1] ?? NaN);
        pros.push(`การ์ดจอ ${gpu} ${tier >= 7 ? "เล่นเกม 1440p ได้" : "เล่นเกม 1080p ได้"}`);
        fit = tier >= 7 ? "เล่นเกมจริงจัง (ประมาณ)" : "เล่นเกม 1080p (ประมาณ)";
      }
      if (gpu === "ออนบอร์ด") {
        cons.push("ไม่มีการ์ดจอแยก เล่นเกมหนักไม่ได้");
        fit = "เรียน/ทำงานเอกสาร";
      }
      if (ram && ram < 16) cons.push(`แรม ${ram}GB ค่อนข้างน้อย`);
      if (ram >= 32) pros.push(`แรม ${ram}GB เหลือเฟือ`);
      if (/^512\s?GB/.test(disk)) cons.push("พื้นที่ 512GB ลงเกมได้ไม่กี่เกม");
      if (kind === "โน้ตบุ๊ก") pros.push("พกพาได้ มีจอและแบตในตัว");
      break;
    }
    case "จอ": {
      const hz = num(has(specs, "รีเฟรชเรต"));
      const panel = has(specs, "พาเนล") ?? "";
      const res = has(specs, "ความละเอียด") ?? "";
      const size = num(has(specs, "ขนาด"));
      if (hz >= 144) pros.push(`${hz}Hz ภาพลื่น เหมาะเกม`);
      if (hz && hz <= 75) cons.push(`${hz}Hz ไม่เหมาะเกมแข่ง`);
      if (/OLED/.test(panel)) {
        pros.push("OLED สีดำสนิท ตอบสนองไวมาก");
        cons.push("ราคาสูง เปิดภาพนิ่งนานๆ เสี่ยงจอเบิร์น");
      } else if (panel === "IPS") pros.push("IPS สีสวย มุมมองกว้าง");
      else if (panel === "VA") {
        pros.push("VA คอนทราสต์ดี สีดำเข้ม");
        cons.push("ภาพเคลื่อนไหวเร็วอาจมีเงา");
      } else if (panel === "MINILED") pros.push("Mini LED สว่างมาก HDR ดี");
      if (/4K|5K|6K/.test(res)) {
        pros.push(`${res} คมชัดมาก`);
        cons.push("เล่นเกมที่ 4K ต้องใช้การ์ดจอแรง");
      }
      if (size >= 27 && res === "Full HD") cons.push("จอใหญ่แต่ Full HD ตัวอักษรอาจไม่คม");
      fit = hz >= 144 ? (/4K/.test(res) ? "เกม + งานกราฟิก" : "เล่นเกม") : "ทำงาน/ดูหนัง";
      break;
    }
    case "คีย์บอร์ด": {
      const sw = (has(specs, "สวิตช์") ?? "").toUpperCase();
      const conn = has(specs, "การเชื่อมต่อ") ?? "";
      if (/RED|LINEAR|SILENT|JUPITER RED/.test(sw)) pros.push("สวิตช์นุ่ม เสียงเบา กดไว เหมาะเกม");
      if (/BROWN|TACTILE/.test(sw)) pros.push("สวิตช์มีจังหวะ พิมพ์มันมือ");
      if (/BLUE|CLICK/.test(sw)) cons.push("สวิตช์เสียงคลิกดัง อาจรบกวนคนข้างๆ");
      if (/ไร้สาย/.test(conn)) {
        pros.push(conn === "ไร้สาย 3 โหมด" ? "ไร้สาย 3 โหมด สลับได้หลายเครื่อง" : "ไร้สาย โต๊ะเรียบร้อย");
        cons.push("ต้องชาร์จแบต");
      }
      if (has(specs, "แป้นไทย")) pros.push("มีแป้นภาษาไทย");
      if (/MEMBRANE/.test(up)) cons.push("ปุ่มยาง (Membrane) สัมผัสไม่แน่นเท่าแมคคานิคอล");
      break;
    }
    case "เมาส์": {
      const conn = has(specs, "การเชื่อมต่อ");
      if (conn === "ไร้สาย") {
        pros.push("ไร้สาย ขยับคล่อง ไม่มีสายเกะกะ");
        cons.push("ต้องชาร์จ/เปลี่ยนถ่าน");
      } else pros.push("มีสาย ไม่ต้องห่วงแบต");
      if (has(specs, "เงียบ")) pros.push("คลิกเงียบ เหมาะใช้ในออฟฟิศ");
      if (/SUPERLIGHT|VIPER|AEROX|ULTRALIGHT/.test(up)) pros.push("น้ำหนักเบา เหมาะเกม FPS");
      if (/ERGO|VERTICAL|MX MASTER/.test(up)) pros.push("ทรงจับสบาย ใช้ทั้งวันไม่ล้า");
      break;
    }
    case "หูฟัง": {
      const conn = has(specs, "การเชื่อมต่อ") ?? "";
      if (/ไร้สาย/.test(conn)) {
        pros.push("ไร้สาย เดินไปมาได้");
        cons.push("ต้องชาร์จแบต");
      }
      if (conn === "สาย 3.5 มม.") pros.push("แจ็ค 3.5 มม. ใช้ได้กับมือถือ/จอยเกม");
      if (has(specs, "รูปแบบ") === "หูฟังเอียร์บัด") pros.push("เบา พกพาง่าย");
      if (has(specs, "เสียง") === "7.1 Surround") pros.push("เสียงรอบทิศ 7.1 ฟังทิศทางศัตรูง่าย");
      break;
    }
    case "ไมโครโฟน": {
      const conn = has(specs, "การเชื่อมต่อ");
      if (conn === "USB") pros.push("USB เสียบคอมใช้ได้เลย");
      if (conn === "XLR") cons.push("XLR ต้องมีออดิโออินเทอร์เฟซ");
      fit = "สตรีม / ประชุม / พอดแคสต์";
      break;
    }
  }

  return { fit, pros: pros.slice(0, 3), cons: cons.slice(0, 3) };
}
