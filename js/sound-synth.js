/**
 * sound-synth.js
 * 輕量級 Web Audio API 程式化儀式音效合成器（零外部音訊檔）
 * 支援：
 * - 溫潤硬木筊杯撞擊聲 (playWoodKnock)
 * - 符文逐一點亮星音泛音 (playRuneIgnite)
 * - 天文機械齒輪咬合與六瓣鎖開啟聲 (playMechanismLock / playBambooClack)
 * - 魔法召喚聚能共鳴音 (playMagicHum)
 * - 五聲音階磬音與絲帛展開聲 (playChime / playSilkSweep)
 */

class RitualSoundSynth {
  constructor() {
    this.ctx = null;
    this.enabled = false;
  }

  _ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(flag) {
    this.enabled = Boolean(flag);
    if (this.enabled) {
      this._ensureContext();
    }
    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  /**
   * 溫潤硬木筊杯落地碰撞聲
   */
  playWoodKnock(intensity = 0.7, pitchOffset = 0) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainVal = Math.min(1, Math.max(0.08, intensity)) * 0.28;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    const baseFreq = 260 + pitchOffset + Math.random() * 45;
    osc.frequency.setValueAtTime(baseFreq * 1.45, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.045);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.12);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(720 + pitchOffset * 1.5, now);
    filter.Q.setValueAtTime(3.2, now);

    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(gainVal, now + 0.004);
    oscGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.13);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);

    const bufferSize = Math.floor(ctx.sampleRate * 0.035);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1450 + pitchOffset * 2, now);
    noiseFilter.Q.setValueAtTime(2.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(gainVal * 0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * 天文齒輪棘輪運轉微響
   */
  playBambooClack(intensity = 0.5) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainVal = Math.min(1, Math.max(0.05, intensity)) * 0.14;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const freq = 980 + Math.random() * 420;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.68, now + 0.05);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  /**
   * 12 枚古代星宿符文逐一點亮時的清透泛音（隨序號微幅上揚）
   */
  playRuneIgnite(index = 0) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    // 東方宮商角徵羽五聲音階延伸頻率表
    const scale = [
      523.25, 587.33, 659.25, 783.99, 880.0, 1046.5,
      1174.66, 1318.51, 1567.98, 1760.0, 2093.0, 2349.32
    ];
    const freq = scale[index % scale.length];
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0004, now + 0.42);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * 巨型古老天體封印甦醒時的深沉低頻古銅共鳴（營造莊嚴神祕的空間重量感）
   */
  playAncientResonance() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [110.0, 164.81, 220.0].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f * 0.99, now);
      osc.frequency.linearRampToValueAtTime(f, now + 1.6);

      const peak = idx === 0 ? 0.085 : idx === 1 ? 0.042 : 0.022;
      gain.gain.setValueAtTime(0.0004, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.65);
      gain.gain.exponentialRampToValueAtTime(0.0004, now + 2.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2.9);
    });
  }

  /**
   * 宇宙封印機關沉重古銅卡榫咬合定位聲
   */
  playMechanismLock() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 0.14].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const base = i === 0 ? 195 : 290;
      osc.frequency.setValueAtTime(base * 1.45, now + offset);
      osc.frequency.exponentialRampToValueAtTime(base * 0.48, now + offset + 0.14);

      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.linearRampToValueAtTime(0.18, now + offset + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0006, now + offset + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.24);
    });
  }

  /**
   * 魔法陣展開與能量聚集時的空靈和弦微鳴
   */
  playMagicHum() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [329.63, 493.88, 659.25].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 0.98, now);
      osc.frequency.linearRampToValueAtTime(f, now + 0.85);

      gain.gain.setValueAtTime(0.0004, now);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.055 : 0.032, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0004, now + 1.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.4);
    });
  }

  /**
   * 結果揭曉時的東方古磬清鳴（柔和泛音）
   */
  playChime(tone = 'chime') {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqMap = {
      sacred: [528, 792, 1056],
      laugh: [440, 587.33],
      yin: [293.66, 392],
      chime: [493.88, 739.99]
    };
    const freqs = freqMap[tone] || freqMap.chime;

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);

      const peak = idx === 0 ? 0.11 : 0.045;
      gain.gain.setValueAtTime(0.0005, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(peak, now + idx * 0.06 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0004, now + idx * 0.06 + 1.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 1.9);
    });
  }

  /**
   * 卡牌翻面 / 卷軸舒展的柔和氣流紙聲
   */
  playSilkSweep() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const dur = 0.28;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const env = Math.sin(t * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.42;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + dur * 0.6);
    filter.frequency.exponentialRampToValueAtTime(420, now + dur);
    filter.Q.setValueAtTime(1.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.13, now);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  /**
   * 宇宙煙霧甦醒與時空入口渦旋氣流聲（低頻星雲共鳴 + 柔和帶通氣流）
   */
  playPortalVortex() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const dur = 1.65;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const env = Math.sin(t * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.35;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(190, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + dur * 0.55);
    filter.frequency.exponentialRampToValueAtTime(240, now + dur);
    filter.Q.setValueAtTime(2.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, now);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // 搭配空靈深空五度低音泛音
    [130.81, 196.0].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 0.96, now);
      osc.frequency.linearRampToValueAtTime(f, now + 1.2);
      oGain.gain.setValueAtTime(0.0005, now);
      oGain.gain.linearRampToValueAtTime(idx === 0 ? 0.055 : 0.03, now + 0.5);
      oGain.gain.exponentialRampToValueAtTime(0.0004, now + 1.6);
      osc.connect(oGain);
      oGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.65);
    });
  }

  /**
   * 空間封印裂縫破開音效（紫藍能量裂解瞬態 + 空間擴散尾韻）
   */
  playSealBreakRift() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 低頻能量釋放衝擊
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(165, now);
    subOsc.frequency.exponentialRampToValueAtTime(46, now + 0.55);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.16, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.65);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.7);

    // 晶透裂縫高頻泛音展開
    [587.33, 880.0, 1174.66].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f * 0.92, now + i * 0.03);
      osc.frequency.exponentialRampToValueAtTime(f * 1.04, now + i * 0.03 + 0.45);
      g.gain.setValueAtTime(0.0005, now + i * 0.03);
      g.gain.linearRampToValueAtTime(0.045 / (i + 1), now + i * 0.03 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0004, now + i * 0.03 + 0.95);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.03);
      osc.stop(now + i * 0.03 + 1.0);
    });
  }

  /**
   * 中央垂直天體光柱貫穿共鳴（神聖清澈和弦）
   */
  playCelestialBeam() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [261.63, 392.0, 523.25, 783.99, 1046.5].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.045);

      const peak = idx === 0 ? 0.065 : 0.042 / Math.sqrt(idx + 1);
      gain.gain.setValueAtTime(0.0004, now + idx * 0.045);
      gain.gain.linearRampToValueAtTime(peak, now + idx * 0.045 + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0004, now + idx * 0.045 + 2.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 2.5);
    });
  }
}

export const ritualSound = new RitualSoundSynth();
