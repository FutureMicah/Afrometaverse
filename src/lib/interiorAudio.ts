/**
 * Interior wind and rain audio (era-progression-spec.md 17.4).
 * Generated noise through Web Audio, so there are no sample files to load.
 * Silent no-op when the browser has no AudioContext. Starts only after a user gesture
 * (the player pressed to enter the building), which browsers require.
 */

type Ctx = AudioContext;

function makeNoiseBuffer(ctx: Ctx, seconds = 2): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    // Brown-ish noise: soft, low, good for wind and a muffled roof hush.
    last = (last + (Math.random() * 2 - 1) * 0.04) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

export class InteriorAmbience {
  private ctx: Ctx | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private clackGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private started = false;

  /** Call from a user gesture (entering the building). Safe to call twice. */
  start(): void {
    if (this.started) return;
    if (typeof window === "undefined") return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      this.ctx = ctx;
      this.noise = makeNoiseBuffer(ctx);
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.value = 400;
      windFilter.Q.value = 0.7;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.playLoop(windFilter, this.windGain);

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = "highpass";
      rainFilter.frequency.value = 1800;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      this.playLoop(rainFilter, this.rainGain);

      this.clackGain = ctx.createGain();
      this.clackGain.gain.value = 0.6;
      this.clackGain.connect(ctx.destination);
      this.started = true;
    } catch {
      this.ctx = null;
    }
  }

  private playLoop(filter: BiquadFilterNode, gain: GainNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  /** Set the wind and rain levels (0 to 1), from interiorWeather.windAudioGain / rainAudioGain. */
  setLevels(wind: number, rain: number): void {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain?.gain.setTargetAtTime(Math.max(0, Math.min(1, wind)) * 0.5, t, 0.2);
    this.rainGain?.gain.setTargetAtTime(Math.max(0, Math.min(1, rain)) * 0.35, t, 0.2);
  }

  /** One short clack when a shutter or door blows open. */
  clack(): void {
    const ctx = this.ctx;
    if (!this.started || !ctx || !this.noise || !this.clackGain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    src.connect(env);
    env.connect(this.clackGain);
    src.start(ctx.currentTime, Math.random());
    src.stop(ctx.currentTime + 0.13);
  }

  stop(): void {
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
    }
    this.ctx = null;
    this.windGain = null;
    this.rainGain = null;
    this.clackGain = null;
    this.noise = null;
    this.started = false;
  }
}
