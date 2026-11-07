/**
 * เสียงคอมในฉาก 3D (สังเคราะห์ด้วย Web Audio ไม่ต้องโหลดไฟล์)
 * เปิดเครื่อง: พัดลมหมุนขึ้น (เสียงลมกรอง) + บี๊ป POST + เสียงเปิด Windows แบบสั้น · ปิดเครื่อง: พัดลมค่อยๆ เงียบ
 */
export interface PcSound {
  powerOn: () => void;
  powerOff: () => void;
  setMuted: (m: boolean) => void;
  dispose: () => void;
}

export function createPcSound(): PcSound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let fanGain: GainNode | null = null;
  let fanSrc: AudioBufferSourceNode | null = null;
  let muted = false;

  const ensure = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return ctx;
  };

  const tone = (freq: number, at: number, dur: number, vol: number, type: OscillatorType = "sine") => {
    if (!ctx || !master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + dur + 0.05);
  };

  const startFan = () => {
    if (!ctx || !master || fanSrc) return;
    // เสียงลมพัดลม = noise ผ่าน low-pass
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    fanSrc = ctx.createBufferSource();
    fanSrc.buffer = buf;
    fanSrc.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;
    fanGain = ctx.createGain();
    fanGain.gain.value = 0;
    fanSrc.connect(lp).connect(fanGain).connect(master);
    const t = ctx.currentTime;
    lp.frequency.setValueAtTime(150, t);
    lp.frequency.linearRampToValueAtTime(900, t + 1.2);
    lp.frequency.linearRampToValueAtTime(520, t + 3);
    fanGain.gain.linearRampToValueAtTime(0.5, t + 1.2);
    fanGain.gain.linearRampToValueAtTime(0.16, t + 3.2);
    fanSrc.start();
  };

  return {
    powerOn() {
      const c = ensure();
      if (!c) return;
      void c.resume();
      startFan();
      const t = c.currentTime;
      tone(1000, t + 0.7, 0.16, 0.25, "square"); // บี๊ป POST
      // เสียงเปิดเครื่องหลังบูต (คอร์ดสั้นๆ)
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + 3.1 + i * 0.09, 1.2, 0.12, "triangle"));
    },
    powerOff() {
      if (!ctx || !fanGain || !fanSrc) return;
      const t = ctx.currentTime;
      fanGain.gain.cancelScheduledValues(t);
      fanGain.gain.setValueAtTime(fanGain.gain.value, t);
      fanGain.gain.linearRampToValueAtTime(0, t + 1.4);
      const src = fanSrc;
      fanSrc = null;
      src.stop(t + 1.5);
    },
    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
    },
    dispose() {
      try {
        fanSrc?.stop();
      } catch {
        /* ignore */
      }
      void ctx?.close();
      ctx = null;
    },
  };
}
