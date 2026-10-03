import type { World } from "../core/index";

export interface AudioOptions {
  /** Asset key -> URL. */
  resolve: (key: string) => string;
  musicVolume?: number;
  sfxVolume?: number;
  /** Music gain multiplier while a dialog line is showing. Default 0.45; 1 disables ducking. */
  duck?: number;
  /** Crossfade time in seconds. Default 1.2. */
  fade?: number;
}

/**
 * Small Web Audio layer that follows a World: room music crossfades, `>>> sfx`
 * one-shots, ducking under dialog. Browsers start audio suspended, so call
 * unlock() from the first user gesture (Stage does this for you).
 */
export class AudioDirector {
  readonly ctx = new AudioContext();
  #opts: Required<Omit<AudioOptions, "resolve">> & Pick<AudioOptions, "resolve">;
  #buffers = new Map<string, Promise<AudioBuffer>>();
  #music = this.ctx.createGain();
  #sfx = this.ctx.createGain();
  #duck = this.ctx.createGain();
  #current: { key: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  #off: (() => void)[] = [];

  constructor(world: World, options: AudioOptions) {
    this.#opts = { musicVolume: 0.7, sfxVolume: 0.9, duck: 0.45, fade: 1.2, ...options };
    this.#music.gain.value = this.#opts.musicVolume;
    this.#sfx.gain.value = this.#opts.sfxVolume;
    this.#music.connect(this.#duck).connect(this.ctx.destination);
    this.#sfx.connect(this.ctx.destination);

    this.#off.push(
      world.events.on("music", ({ key }) => void this.music(key).catch(this.#warn)),
      world.events.on("sfx", ({ key }) => void this.sfx(key).catch(this.#warn)),
      world.ui.subscribe(() => this.#setDuck(world.ui.get().line !== null)),
    );
    if (world.room?.music) void this.music(world.room.music).catch(this.#warn);
  }

  // Missing audio should never break play; warn once per message.
  #warned = new Set<string>();
  #warn = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (!this.#warned.has(msg)) console.warn(`[sigilkit/audio] ${msg}`);
    this.#warned.add(msg);
  };

  async unlock(): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  async music(key: string | null): Promise<void> {
    if (this.#current?.key === key) return;
    const now = this.ctx.currentTime;
    const fade = this.#opts.fade;
    if (this.#current) {
      const old = this.#current;
      old.gain.gain.setTargetAtTime(0, now, fade / 4);
      old.src.stop(now + fade);
      this.#current = null;
    }
    if (!key) return;
    const buffer = await this.#load(key);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(1, this.ctx.currentTime, fade / 4);
    src.connect(gain).connect(this.#music);
    src.start();
    this.#current = { key, src, gain };
  }

  async sfx(key: string): Promise<void> {
    const src = this.ctx.createBufferSource();
    src.buffer = await this.#load(key);
    src.connect(this.#sfx);
    src.start();
  }

  setVolumes(v: { music?: number; sfx?: number }): void {
    if (v.music !== undefined) this.#music.gain.value = v.music;
    if (v.sfx !== undefined) this.#sfx.gain.value = v.sfx;
  }

  dispose(): void {
    for (const off of this.#off) off();
    void this.ctx.close();
  }

  #setDuck(on: boolean): void {
    this.#duck.gain.setTargetAtTime(on ? this.#opts.duck : 1, this.ctx.currentTime, 0.08);
  }

  #load(key: string): Promise<AudioBuffer> {
    let p = this.#buffers.get(key);
    if (!p) {
      p = fetch(this.#opts.resolve(key))
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => this.ctx.decodeAudioData(b))
        .catch((e: unknown) => {
          throw new Error(`audio "${key}": ${e instanceof Error ? e.message : String(e)}`);
        });
      // Don't cache failures, so a file added during dev is picked up.
      p.catch(() => this.#buffers.delete(key));
      this.#buffers.set(key, p);
    }
    return p;
  }
}
