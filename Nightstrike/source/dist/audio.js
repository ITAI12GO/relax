/** Original, locally synthesized stadium soundscape. No downloaded audio. */
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ready = false;
    this.last = Object.create(null);
    this.ambience = null;
    this.rolling = null;
  }
  async unlock() {
    try {
      if (!this.ctx) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return false;
        this.ctx = new Audio();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.66;
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 18;
        compressor.ratio.value = 4;
        this.master.connect(compressor);
        compressor.connect(this.ctx.destination);
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * 0.035) / 1.035;
          data[i] = brown * 4.5;
        }
        this.ambience = this._bed(430, 0);
        this.rolling = this._bed(190, 0);
      }
      if (this.ctx.state !== 'running') await this.ctx.resume();
      this.ready = this.ctx.state === 'running';
      return this.ready;
    } catch (_) { return false; }
  }
  setMuted(value) {
    this.muted = Boolean(value);
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.66, this.ctx.currentTime, 0.055);
  }
  _bed(frequency, gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const amp = this.ctx.createGain();
    amp.gain.value = gain;
    src.connect(filter); filter.connect(amp); amp.connect(this.master); src.start();
    return {src, filter, amp};
  }
  _tone(freq, duration = 0.12, gain = 0.15, type = 'sine', delay = 0, endFreq = freq) {
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + Math.min(0.012, duration / 4));
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp); amp.connect(this.master);
    osc.start(now); osc.stop(now + duration + 0.04);
    osc.onended = () => { osc.disconnect(); amp.disconnect(); };
  }
  _noise(duration = 0.2, gain = 0.14, frequency = 1100, delay = 0, endFrequency = frequency) {
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(frequency, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + Math.min(0.025, duration / 4));
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter); filter.connect(amp); amp.connect(this.master);
    src.start(now); src.stop(now + duration + 0.04);
    src.onended = () => { src.disconnect(); filter.disconnect(); amp.disconnect(); };
  }
  play(name) {
    if (!this.ready || !this.ctx || this.ctx.state !== 'running' || this.muted) return;
    const now = this.ctx.currentTime;
    const minimum = name === 'coin' ? 0.045 : name === 'hit' ? 0.2 : 0.035;
    if (this.last[name] !== undefined && now - this.last[name] < minimum) return;
    this.last[name] = now;
    switch (name) {
      case 'click': this._tone(700, 0.055, 0.06, 'sine', 0, 520); break;
      case 'focus':
        this._tone(520, 0.32, 0.075, 'sine', 0, 145);
        this._noise(0.28, 0.07, 1400, 0, 240); break;
      case 'coin':
        this._tone(1250, 0.11, 0.12); this._tone(1875, 0.18, 0.08, 'sine', 0.045); break;
      case 'nutmeg':
        [520, 780, 1040].forEach((f, i) => this._tone(f, 0.17, 0.13, 'triangle', i * 0.065));
        this._noise(0.14, 0.1, 1800, 0, 450); break;
      case 'dodge':
        this._noise(0.19, 0.15, 650, 0, 2400); this._tone(850, 0.14, 0.07, 'sine', 0.08, 1200); break;
      case 'pass':
        this._noise(0.22, 0.18, 1600, 0, 320); this._tone(165, 0.1, 0.14, 'sine', 0, 60);
        this._tone(640, 0.12, 0.07, 'triangle', 0.37, 820); break;
      case 'hit':
        this._noise(0.22, 0.3, 520, 0, 110); this._tone(95, 0.22, 0.23, 'triangle', 0, 32); break;
      case 'comet':
        this._noise(1.0, 0.35, 250, 0, 2200);
        [130, 195, 260, 390].forEach((f, i) => this._tone(f, 0.55, 0.09, 'triangle', i * 0.07, f * 2)); break;
      case 'shot':
        this._tone(140, 0.2, 0.23, 'sine', 0, 42); this._noise(0.48, 0.3, 2000, 0, 190); break;
      case 'goal':
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._tone(f, 0.6, 0.13, 'triangle', i * 0.1));
        [261.63, 392, 523.25].forEach(f => this._tone(f, 1.15, 0.055, 'sine', 0.4));
        this._noise(1.3, 0.24, 900, 0.06, 1700); break;
      case 'save':
        this._tone(350, 0.24, 0.13, 'triangle', 0, 280); this._tone(220, 0.45, 0.12, 'triangle', 0.19, 140);
        this._noise(0.18, 0.12, 500); break;
      case 'start':
        [440, 660, 880].forEach((f, i) => this._tone(f, 0.2, 0.12, 'triangle', i * 0.1)); break;
    }
  }
  update(state, dt) {
    if (!this.ready || !this.ctx || this.ctx.state !== 'running' || !state) return;
    const now = this.ctx.currentTime;
    const focusing = Boolean(state.focusing);
    if (focusing && !this.wasFocusing) this.play('focus');
    this.wasFocusing = focusing;
    const live = state.mode === 'playing';
    const ambient = state.mode === 'paused' ? 0 : (0.024 + Math.sin((state.time || 0) * 0.7) * 0.004) * (focusing ? .5 : 1);
    this.ambience.amp.gain.setTargetAtTime(ambient, now, 0.3);
    this.ambience.filter.frequency.setTargetAtTime(focusing ? 180 : 430, now, 0.15);
    this.rolling.amp.gain.setTargetAtTime(live ? 0.012 + (state.heat || 0) / 100 * 0.028 : 0, now, 0.16);
    this.rolling.filter.frequency.setTargetAtTime(live ? 160 + (state.heat || 0) * 5 : 160, now, 0.1);
    this.rolling.src.playbackRate.setTargetAtTime(focusing ? .6 : 1, now, .12);
  }
}
