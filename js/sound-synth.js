/**
 * sound-synth.js
 * 輕量級 Web Audio API 程式化儀式音效合成器（零外部音訊檔）
 * 合成：木質筊杯撞擊聲、竹籤搖晃碰撞聲、靈籤抽出清鳴、卡牌翻面氣流聲、卷軸展開聲
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
   * @param {number} intensity 0.1 ~ 1.0
   * @param {number} pitchOffset 頻率微調（區分左右兩枚筊杯）
   */
  playWoodKnock(intensity = 0.7, pitchOffset = 0) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainVal = Math.min(1, Math.max(0.08, intensity)) * 0.28;

    // 主木質共振音
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

    // 瞬間木擊高頻短促噪訊
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
   * 籤筒內竹籤清脆碰撞聲
   * @param {number} intensity 0.1 ~ 1.0
   */
  playBambooClack(intensity = 0.5) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainVal = Math.min(1, Math.max(0.05, intensity)) * 0.16;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const freq = 920 + Math.random() * 480;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + 0.055);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * 結果揭曉時的東方古磬清鳴（柔和泛音）
   * @param {'sacred'|'laugh'|'yin'|'chime'} tone
   */
  playChime(tone = 'chime') {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqMap = {
      sacred: [528, 792, 1056], // 明朗五聲音階泛音
      laugh: [440, 587.33],     // 從容微揚
      yin: [293.66, 392],       // 沉靜低迴
      chime: [493.88, 739.99]   // 靈籤清音
    };
    const freqs = freqMap[tone] || freqMap.chime;

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);

      const peak = (idx === 0 ? 0.11 : 0.045);
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
      data[i] = (Math.random() * 2 - 1) * env * 0.45;
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
    gain.gain.setValueAtTime(0.14, now);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }
}

export const ritualSound = new RitualSoundSynth();
