import sharp from "sharp";

/**
 * ตัดพื้นหลังสตูดิโอ (ขาว/เทาเรียบ) ออกจากรูปสินค้า
 *
 * ทำไมของเดิมมีจุดขาว:
 *  1) ตัดแบบ 0/100% ไม่มีขอบนุ่ม → พิกเซลขอบที่ผสมสีขาวค้างเป็นเส้นขาวรอบสินค้า
 *  2) เศษ JPEG ที่ไม่ต่อกับขอบรูปไม่ถูกลบ → เป็นจุดขาวลอยๆ
 *  3) ช่องโล่งที่ถูกสินค้าล้อม (เช่นช่องชั้นวาง) ไม่ถูกลบ → เป็นแผ่นขาว
 *
 * วิธีนี้:
 *  - หาพื้นหลังจริงด้วย flood fill จากขอบรูป (เฉพาะสีที่ใกล้พื้นหลังมาก) → ไม่กินเข้าไปในสินค้าสีขาว
 *  - ขอบ 2 พิกเซลรอบพื้นหลังได้ค่าโปร่งใสแบบไล่ระดับ + ลบสีขาวที่ปนออก (defringe)
 *  - ช่องโล่งขนาดใหญ่ที่สีเท่าพื้นหลังเป๊ะ ถือเป็นพื้นหลัง
 *  - ลบเศษเล็กๆ สีใกล้พื้นหลังที่ลอยอยู่
 */

export interface CutoutResult {
  buffer: Buffer;
  contentType: string;
  /** true = ตัดพื้นหลังแล้ว, false = เป็นรูปบรรยากาศ/มีพื้นโปร่งอยู่แล้ว จึงไม่ตัด */
  cut: boolean;
}

const MAX_SIDE = 640;

export async function cutoutProductImage(input: Buffer, opts: { trim?: boolean } = {}): Promise<CutoutResult> {
  const doTrim = opts.trim !== false;
  const base = sharp(input, { failOn: "none" }).rotate();
  const meta = await base.metadata();

  // มีพื้นโปร่งมาแล้ว → แค่ย่อ/แปลงเป็น webp
  if (meta.hasAlpha) {
    const { channels } = await sharp(input, { failOn: "none" }).stats();
    if (channels[3] && channels[3].min < 200) {
      const buffer = await sharp(input, { failOn: "none" })
        .rotate()
        .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88, alphaQuality: 90 })
        .toBuffer();
      return { buffer, contentType: "image/webp", cut: false };
    }
  }

  const { data, info } = await base
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const total = w * h;
  const px = (i: number) => i * 4;

  // ---- 1) สีพื้นหลัง: สีอ่อนเรียบที่พบมากที่ขอบรูป (สินค้าอาจชนขอบได้ จึงไม่ใช้ค่ากลางทั้งหมด) ----
  const ring: number[] = [];
  for (let x = 0; x < w; x++) ring.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) ring.push(y * w, y * w + w - 1);
  const lightRing = ring.filter((i) => {
    const o = px(i);
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    return Math.min(r, g, b) >= 215 && Math.max(r, g, b) - Math.min(r, g, b) <= 14;
  });
  const median = (list: number[], ch: number) => {
    const vals = list.map((i) => data[px(i) + ch]).sort((a, b) => a - b);
    return vals[vals.length >> 1] ?? 255;
  };
  const bg = [median(lightRing, 0), median(lightRing, 1), median(lightRing, 2)];
  const dist = (i: number) => {
    const o = px(i);
    return Math.max(Math.abs(data[o] - bg[0]), Math.abs(data[o + 1] - bg[1]), Math.abs(data[o + 2] - bg[2]));
  };
  const coverage = ring.filter((i) => dist(i) <= 12).length / ring.length;

  // ขอบรูปแทบไม่มีพื้นสีอ่อนเรียบ → เป็นรูปบรรยากาศ/รูปห้อง ไม่ตัด
  if (lightRing.length / ring.length < 0.25 || coverage < 0.25) {
    const buffer = await sharp(input, { failOn: "none" })
      .rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
    return { buffer, contentType: "image/webp", cut: false };
  }

  // ใกล้พื้นหลังแค่ไหนถึงนับว่าเป็นพื้นหลัง — เริ่มเข้มงวดก่อน แล้วค่อยผ่อนถ้าสินค้าไม่ใช่สีขาว
  let T_BG = 3;
  const T_EDGE = 60; // ขอบที่ต่างเกินนี้ถือเป็นเนื้อสินค้าเต็ม

  // ---- 2) flood fill พื้นหลังจากขอบรูป ----
  const isBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const seed = (i: number) => {
    if (!isBg[i] && dist(i) <= T_BG) {
      isBg[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  const spread = () => {
    while (head < tail) {
      const c = queue[head++];
      const x = c % w;
      if (x > 0) seed(c - 1);
      if (x < w - 1) seed(c + 1);
      if (c >= w) seed(c - w);
      if (c < total - w) seed(c + w);
    }
  };
  spread();

  // สินค้าสีขาว (ตู้/ชั้นขาว) แยกจากพื้นขาวยาก → คงค่าเข้มงวดไว้ ไม่กินเนื้อสินค้า
  let fg = 0;
  let nearWhite = 0;
  for (let i = 0; i < total; i++) {
    if (isBg[i]) continue;
    fg++;
    if (dist(i) <= 25) nearWhite++;
  }
  const whiteProduct = fg > 0 && nearWhite / fg > 0.35;
  // สินค้าสีขาว/สีอ่อนบนพื้นขาว (เช่น ชั้น KALLAX) แยกพื้นออกไม่ได้โดยไม่กินเนื้อสินค้า
  // → ไม่ตัด ใช้รูปเดิมทั้งแผ่น (การ์ดจะโชว์เป็นแผ่นรูปพื้นขาวบนพื้นเทา เห็นสินค้าครบ)
  if (whiteProduct) {
    const buffer = await sharp(input, { failOn: "none" })
      .rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .webp({ quality: 86 })
      .toBuffer();
    return { buffer, contentType: "image/webp", cut: false };
  }
  {
    T_BG = 10;
    head = 0;
    spread();
  }

  // ---- 3) ช่องโล่งที่ถูกล้อม (สีเท่าพื้นหลังเป๊ะ และใหญ่พอ) ----
  const seen = new Uint8Array(total);
  const minHole = Math.max(40, Math.round(total * 0.0015));
  const comp = new Int32Array(total);
  for (let s = 0; s < total; s++) {
    if (isBg[s] || seen[s] || dist(s) > 3) continue;
    let ch = 0;
    let ct = 0;
    comp[ct++] = s;
    seen[s] = 1;
    while (ch < ct) {
      const c = comp[ch++];
      const x = c % w;
      const nb = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c >= w ? c - w : -1, c < total - w ? c + w : -1];
      for (const n of nb) {
        if (n >= 0 && !seen[n] && !isBg[n] && dist(n) <= 3) {
          seen[n] = 1;
          comp[ct++] = n;
        }
      }
    }
    // ขอบของช่องโล่งจริงตัดกับตัวสินค้าชัด ส่วนแผ่นสีขาวของสินค้าจะค่อยๆ ไล่เฉดเข้าหาสีพื้น
    // วัดความต่างของพิกเซลที่ห่างออกไป 2–3 ชั้น (ชั้นแรกเป็นขอบนุ่มของ JPEG)
    let edgeSum = 0;
    let edgeN = 0;
    if (ct >= minHole) {
      const layer = new Map<number, number>();
      let frontier: number[] = [];
      for (let k = 0; k < ct; k++) layer.set(comp[k], 0);
      for (let k = 0; k < ct; k++) frontier.push(comp[k]);
      for (let depth = 1; depth <= 3; depth++) {
        const next: number[] = [];
        for (const c of frontier) {
          const x = c % w;
          for (const n of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c >= w ? c - w : -1, c < total - w ? c + w : -1]) {
            if (n < 0 || layer.has(n) || isBg[n]) continue;
            layer.set(n, depth);
            next.push(n);
            if (depth >= 2) {
              edgeSum += dist(n);
              edgeN++;
            }
          }
        }
        frontier = next;
      }
    }
    if (ct >= minHole && edgeN > 0 && edgeSum / edgeN >= (whiteProduct ? 22 : 14)) {
      // ไม่ขยายต่อ: กันกินชั้นวาง/แผ่นสีขาวที่อยู่ติดช่องโล่ง
      for (let k = 0; k < ct; k++) isBg[comp[k]] = 1;
    }
  }

  // ---- 3.5) ตัดทางรั่วเส้นบางๆ ที่ลามเข้าไปในเนื้อสินค้า (opening) แล้วคืนรูเล็กที่ลอยอยู่ ----
  const eroded = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (!isBg[i]) continue;
    const x = i % w;
    eroded[i] =
      (x === 0 || isBg[i - 1]) && (x === w - 1 || isBg[i + 1]) && (i < w || isBg[i - w]) && (i >= total - w || isBg[i + w]) ? 1 : 0;
  }
  for (let i = 0; i < total; i++) {
    if (!isBg[i] || eroded[i]) continue;
    const x = i % w;
    const keep = (x > 0 && eroded[i - 1]) || (x < w - 1 && eroded[i + 1]) || (i >= w && eroded[i - w]) || (i < total - w && eroded[i + w]);
    if (!keep) isBg[i] = 0;
  }
  {
    const lab = new Uint8Array(total);
    for (let s0 = 0; s0 < total; s0++) {
      if (!isBg[s0] || lab[s0]) continue;
      let ch = 0;
      let ct = 0;
      let touches = false;
      comp[ct++] = s0;
      lab[s0] = 1;
      while (ch < ct) {
        const c = comp[ch++];
        const x = c % w;
        if (x === 0 || x === w - 1 || c < w || c >= total - w) touches = true;
        for (const n of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c >= w ? c - w : -1, c < total - w ? c + w : -1]) {
          if (n >= 0 && isBg[n] && !lab[n]) {
            lab[n] = 1;
            comp[ct++] = n;
          }
        }
      }
      if (!touches && ct < minHole) for (let k = 0; k < ct; k++) isBg[comp[k]] = 0;
    }
  }

  // ---- 4) ค่าโปร่งใส: พื้นหลัง = 0, ขอบ 2 พิกเซลไล่ระดับ, ที่เหลือทึบ ----
  const alpha = new Uint8Array(total).fill(255);
  const ring1 = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (isBg[i]) {
      alpha[i] = 0;
      continue;
    }
    const x = i % w;
    if ((x > 0 && isBg[i - 1]) || (x < w - 1 && isBg[i + 1]) || (i >= w && isBg[i - w]) || (i < total - w && isBg[i + w])) {
      ring1[i] = 1;
    }
  }
  const soften = (i: number, maxA: number) => {
    const d = dist(i);
    const a = Math.min(1, Math.max(0, (d - T_BG) / (T_EDGE - T_BG)));
    alpha[i] = Math.round(Math.min(maxA, a) * 255);
  };
  for (let i = 0; i < total; i++) {
    if (!ring1[i]) continue;
    soften(i, 1);
  }
  for (let i = 0; i < total; i++) {
    if (isBg[i] || ring1[i]) continue;
    const x = i % w;
    if ((x > 0 && ring1[i - 1]) || (x < w - 1 && ring1[i + 1]) || (i >= w && ring1[i - w]) || (i < total - w && ring1[i + w])) {
      // ชั้นที่ 2 ค่อยๆ ทึบขึ้น (ไม่ให้โปร่งเกินไปในเนื้อสินค้าสีขาว)
      const d = dist(i);
      const a = Math.min(1, Math.max(0.35, (d - T_BG) / (T_EDGE - T_BG) + 0.35));
      alpha[i] = Math.round(a * 255);
    }
  }

  // ---- 5) ลบเศษเล็กๆ สีใกล้พื้นหลังที่ลอยอยู่ (จุดขาว) ----
  const seen2 = new Uint8Array(total);
  const maxSpeck = Math.max(16, Math.round(total * 0.0012));
  for (let s = 0; s < total; s++) {
    if (alpha[s] === 0 || seen2[s]) continue;
    let ch = 0;
    let ct = 0;
    let sumD = 0;
    comp[ct++] = s;
    seen2[s] = 1;
    while (ch < ct) {
      const c = comp[ch++];
      sumD += dist(c);
      if (ct > maxSpeck) continue; // ใหญ่แล้ว ไม่ใช่เศษ ไม่ต้องไล่ต่อ
      const x = c % w;
      const nb = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c >= w ? c - w : -1, c < total - w ? c + w : -1];
      for (const n of nb) {
        if (n >= 0 && !seen2[n] && alpha[n] > 0) {
          seen2[n] = 1;
          comp[ct++] = n;
        }
      }
    }
    if (ct <= maxSpeck && sumD / ct < T_EDGE) {
      for (let k = 0; k < ct; k++) alpha[comp[k]] = 0;
    }
  }

  // ---- 6) ขอบเนียน: เฉลี่ย 3x3 เฉพาะพิกเซลที่ติดขอบ กันขอบหยักจากเศษ JPEG ----
  const src = Uint8Array.from(alpha);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = src[i];
      const n = [src[i - 1], src[i + 1], src[i - w], src[i + w]];
      const isEdge = n.some((v) => v !== a);
      if (!isEdge) continue;
      const sum = a * 4 + n[0] + n[1] + n[2] + n[3] + src[i - w - 1] + src[i - w + 1] + src[i + w - 1] + src[i + w + 1];
      const avg = sum / 12;
      // พื้นหลังไม่กลับมาทึบเกิน 25%, เนื้อสินค้าไม่โปร่งลงเกินครึ่ง
      alpha[i] = Math.round(a === 0 ? Math.min(avg, 64) : a === 255 ? Math.max(avg, 160) : avg);
    }
  }

  // ---- 7) defringe: เอาสีพื้นหลังที่ปนในพิกเซลขอบออก ----
  for (let i = 0; i < total; i++) {
    const a = alpha[i];
    const o = px(i);
    data[o + 3] = a;
    if (a === 0 || a === 255) continue;
    const f = a / 255;
    for (let c = 0; c < 3; c++) {
      const v = (data[o + c] - (1 - f) * bg[c]) / f;
      data[o + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }

  const out = sharp(data, { raw: { width: w, height: h, channels: 4 } });
  const buffer = await (doTrim ? out.trim({ threshold: 1 }) : out)
    .webp({ quality: 88, alphaQuality: 90, effort: 4 })
    .toBuffer()
    .catch(() => sharp(data, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 88 }).toBuffer());
  return { buffer, contentType: "image/webp", cut: true };
}
