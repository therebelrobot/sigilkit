/*
 * Stand-ins for audio files. A real game ships .ogg files and resolves keys to
 * their URLs; this lesson synthesises a few small WAVs in the browser instead,
 * so there's nothing to download. AudioDirector can't tell the difference.
 */

const SAMPLE_RATE = 22050;

type Synth = (seconds: number) => Float32Array;

const SOUNDS: Record<string, Synth> = {
  // A bright pentatonic arpeggio, loops every 4 seconds.
  "greenhouse-theme": () => {
    const notes = [523.25, 659.25, 783.99, 880, 783.99, 659.25, 587.33, 659.25];
    return render(4, (time) => {
      const step = Math.floor(time * 4) % 16;
      const frequency = notes[step % notes.length]! * (step >= 8 ? 0.75 : 1);
      const sinceNote = time % 0.25;
      return pluck(frequency, sinceNote) * 0.35 + Math.sin(2 * Math.PI * 130.81 * time) * 0.06;
    });
  },
  // A low drone with a slow bell, loops every 4 seconds.
  "shed-theme": () =>
    render(4, (time) => {
      const drone = Math.sin(2 * Math.PI * 98 * time) * 0.12 + Math.sin(2 * Math.PI * 146.83 * time) * 0.06;
      const bellAt = time % 2;
      return drone + bell(time < 2 ? 392 : 349.23, bellAt) * 0.25;
    }),
  door: () => render(0.35, (time) => noise() * Math.exp(-time * 22) * 0.6 + Math.sin(2 * Math.PI * 70 * time) * Math.exp(-time * 12) * 0.5),
  chime: () => render(1.2, (time) => bell(1046.5, time) * 0.4 + bell(1567.98, Math.max(0, time - 0.08)) * 0.25),
  pour: () => render(1, (time) => noise() * (0.25 + Math.sin(time * 70) * 0.12) * Math.min(1, time * 8) * Math.min(1, (1 - time) * 5)),
};

const urlByKey = new Map<string, string>();

/** URL for a sound key, generating it the first time. Unknown keys get a URL that 404s, as a missing file would. */
export function soundUrl(key: string): string {
  const synth = SOUNDS[key];
  if (!synth) return `missing-audio/${key}.ogg`;
  let url = urlByKey.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([wav(synth(0))], { type: "audio/wav" }));
    urlByKey.set(key, url);
  }
  return url;
}

function render(seconds: number, sample: (time: number) => number): Float32Array {
  const samples = new Float32Array(Math.floor(seconds * SAMPLE_RATE));
  for (let index = 0; index < samples.length; index++) samples[index] = sample(index / SAMPLE_RATE);
  return samples;
}

const noise = () => Math.random() * 2 - 1;
const pluck = (frequency: number, since: number) => Math.sin(2 * Math.PI * frequency * since) * Math.exp(-since * 9);
const bell = (frequency: number, since: number) =>
  (Math.sin(2 * Math.PI * frequency * since) + Math.sin(2 * Math.PI * frequency * 2.76 * since) * 0.3) * Math.exp(-since * 3);

/** 16-bit mono PCM WAV. */
function wav(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true));
  return buffer;
}
