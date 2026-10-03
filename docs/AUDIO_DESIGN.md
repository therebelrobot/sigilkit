# Audio design

How sound works in sigilkit and how to make music, effects and dialog audio that fit it. The engine side is small on purpose: `sigilkit/audio` is a thin Web Audio layer that follows the world, and anything richer is game code listening to the same events.

## 1. What the engine does

`AudioDirector` (from `sigilkit/audio`) listens to a `World` and handles three things:

| Thing | Triggered by | Behaviour |
| --- | --- | --- |
| **Music** | `RoomDef.music` on entering a room, or `>>> music <key>` | Loops the whole file; crossfades from the previous track over `fade` seconds (default 1.2) |
| **Sound effects** | `>>> sfx <key>` | One-shot, played once at full sfx volume |
| **Ducking** | a dialog line showing (`world.ui.get().line`), plus any reason the game adds with `duckMusic` | Music drops to `duck` × its volume during dialog (default 0.45, about −7 dB) and comes back when the line clears; game reasons multiply with it |

```ts
import { AudioDirector } from "sigilkit/audio";

const audio = new AudioDirector(world, {
  resolve: (key) => `/audio/${key}.ogg`, // asset key -> URL
  musicVolume: 0.7,
  sfxVolume: 0.9,
  duck: 0.45, // 1 turns ducking off
  fade: 1.2,
});

<Stage onFirstGesture={() => void audio.unlock()} … />
```

- **Unlocking:** browsers start audio suspended until a user gesture. `<Stage onFirstGesture>` fires on the first pointer press; also call `audio.unlock()` from the first key press. Some browsers don't count gamepad buttons as a gesture, so a controller-only player may need one click or key on a title screen.
- **Missing files never break play.** A key that fails to load logs one warning and is skipped. Failures aren't cached, so a file added while the dev server runs is picked up on the next play.
- **Volume:** `audio.setVolumes({ music, sfx })`, for a settings screen.
- **Ducking for your own reasons:** `audio.duckMusic(reason, level)` lowers the music by a gain multiplier (1 removes the reason, 0.5 is about −6 dB) without touching the player's volume setting. Reasons multiply, so a game's own ducking stacks with dialog's (the built-in reason `"dialog"`). It's safe to call every frame: the gain glides to its target, and tiny changes aren't rescheduled.

  ```ts
  // Dip the music while a cutscene's big moment plays, then bring it back.
  audio.duckMusic("revelation", 0.3);
  await world.wait(4000);
  audio.duckMusic("revelation", 1);
  ```
- **Anything else** can listen to the same events: `world.events.on("music", ({ key }) => …)` and `world.events.on("sfx", ({ key }) => …)`. A game that wants a different mixer can replace `AudioDirector` entirely.

Audio is client-side only. In multiplayer, each player hears their own story and room.

## 2. Music

### Choosing what plays

- **Per room:** `music: "workshop-theme"` on the room. It plays on entry.
- **Same key, no restart:** walking between two rooms with the same `music` key keeps the track going without a seam. Use this for an area theme.
- **No key, no change:** a room without `music` leaves the current track playing. To go quiet, put `>>> music` (no key) in the room's `onEnter` knot.
- **Story beats:** `>>> music tense-reveal` from Ink switches tracks mid-scene; `>>> music workshop-theme` switches back.

### Making loops

`AudioDirector` loops the **entire decoded file** from sample 0 to the last sample. There are no loop points, so the file itself must loop:

- **Cut to exact length.** For metered music, export exactly N bars (at 90 BPM in 4/4, 16 bars = 42.667 s). Don't round to the nearest second.
- **No silence** at the start or end.
- **Fold the tail back in.** Reverb and delay ringing past the loop point should be mixed into the start of the file (render two passes and keep the second), so the loop doesn't go dry at the seam.
- **Cut at zero crossings,** or apply a few-millisecond fade, so the seam doesn't click.
- **Check it** by looping it in your DAW or audio editor for a few minutes before exporting.

### Keep loops short

Files are decoded fully into memory as uncompressed float audio before they play: one minute of 48 kHz stereo is about 23 MB of RAM, whatever the file size on disk. On phones, aim for **30–90 second loops**, and vary them with arrangement (stems that drop in and out) rather than length.

### Mixing for an adventure game

- **Leave room for dialog.** Even ducked, music sits under words. Keep busy lead lines out of the 1–4 kHz speech band, or keep them sparse.
- **Leave room for effects.** A one-shot needs a gap to land in; avoid wall-to-wall percussion.
- **Ambience can be music.** Room tone (hum, wind, machinery) can be the room's `music` track, so it crossfades between rooms like a score would.

## 3. Sound effects

`>>> sfx <key>` from Ink, or `world.command("sfx <key>")` from TypeScript:

```ink
=== door_use ===
>>> sfx door-creak
>>> goto hallway door
-> END
```

- One-shots play at the sfx bus volume, unpitched and non-positional. There's no limit on overlapping copies, so don't fire them every frame.
- **Trim tightly.** The sound starts when the command runs; leading silence reads as lag.
- **Peak below −1 dBFS** and leave headroom: sfx land on top of music.
- **Variation** (three footstep takes, random pitch) is game code: a custom command that picks a key and emits `sfx`:

  ```ts
  world.commands.set("sfx-variant", ([keyPrefix, takeCount], targetWorld) => {
    const takeNumber = 1 + Math.floor(Math.random() * Number(takeCount));
    targetWorld.events.emit("sfx", { key: `${keyPrefix}-${takeNumber}` });
  });
  // Ink: >>> sfx-variant footstep 3
  ```

- **Effects tied to visuals** (a door sliding, a lamp humming) usually belong in the story knot that changes the flag, right before or after the `~ flag = true` line, so sound and picture change together.

## 4. Dialog sound

sigilkit has no voice playback built in, but every dialog line carries its **Ink tags**, which is the hook for one.

### Voiced lines

Tag the line in Ink:

```ink
Hesper: Good ears. #vo:hesper_012
```

Play the tagged file when the line appears and stop it when the line goes:

```ts
import type { World } from "sigilkit";
import type { AudioDirector } from "sigilkit/audio";

export function attachVoiceLines(
  world: World,
  audio: AudioDirector,
  resolveVoiceUrl: (voiceId: string) => string,
  { advanceWhenFinished = false } = {},
) {
  const voiceVolume = audio.ctx.createGain();
  voiceVolume.connect(audio.ctx.destination);
  const decodedVoiceById = new Map<string, Promise<AudioBuffer>>();
  let currentLine = world.ui.get().line;
  let currentVoiceSource: AudioBufferSourceNode | null = null;

  const loadVoice = (voiceId: string) => {
    let decodedVoice = decodedVoiceById.get(voiceId);
    if (!decodedVoice) {
      decodedVoice = fetch(resolveVoiceUrl(voiceId))
        .then((response) => response.arrayBuffer())
        .then((encodedAudio) => audio.ctx.decodeAudioData(encodedAudio));
      decodedVoiceById.set(voiceId, decodedVoice);
    }
    return decodedVoice;
  };

  const stopListening = world.ui.subscribe(() => {
    const line = world.ui.get().line;
    if (line === currentLine) return;
    currentLine = line;
    currentVoiceSource?.stop();
    currentVoiceSource = null;

    const voiceId = line?.tags.find((tag) => tag.startsWith("vo:"))?.slice(3);
    if (!voiceId) return;
    void loadVoice(voiceId).then((voiceBuffer) => {
      if (world.ui.get().line !== line) return; // skipped before it loaded
      const voiceSource = audio.ctx.createBufferSource();
      voiceSource.buffer = voiceBuffer;
      voiceSource.connect(voiceVolume);
      voiceSource.onended = () => {
        if (advanceWhenFinished && world.ui.get().line === line) world.advance();
      };
      voiceSource.start();
      currentVoiceSource = voiceSource;
    });
  });

  return { voiceVolume, destroy: stopListening };
}
```

Music already ducks under every line, voiced or not. Record voice dry (no room reverb), trimmed, peaking around −3 dBFS, one file per line, named by speaker and number (`hesper_012`) so scripts and recording sessions can share a sheet.

### Unvoiced character sounds

Most adventure games of this scale use **blips or murmurs** instead of recorded voice: a short tone, chirp or syllable per speaker, played when a line appears (or once per few characters). They need no tags: the line's `speaker` is enough.

```ts
let lastLine = world.ui.get().line;
world.ui.subscribe(() => {
  const line = world.ui.get().line;
  if (line === lastLine) return;
  lastLine = line;
  if (line?.speaker) world.events.emit("sfx", { key: `blip-${line.speaker}` });
});
```

Give every speaker a distinct timbre and pitch range, and a narrator line (speaker `null`) either silence or a soft neutral tone.

### Other useful tags

Tags are free-form text, so a game can define its own: `#mood:worried` for a portrait or a music sting, `#sfx:gasp` to fire an effect with the line, `#pause:600`. Keep the `name:value` shape so they're easy to parse.

## 5. Files

- **Where:** `public/audio/<key>.<ext>` with ``resolve: (key) => `/audio/${key}.ogg` ``, or Vite imports through `import.meta.glob` for hashed URLs (see VISUAL_DESIGN.md section 4).
- **Keys:** lowercase with hyphens, grouped by prefix: `music-workshop`, `sfx-door-creak`, `vo-hesper-012`.
- **Format:** browsers differ on which compressed formats `decodeAudioData` accepts. AAC (`.m4a`) and MP3 are the safest single choice; Ogg (Vorbis or Opus) is smaller and loops cleaner but may not decode everywhere. To ship both, pick per browser:

  ```ts
  const audioExtension = new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? "ogg" : "m4a";
  const audio = new AudioDirector(world, { resolve: (key) => `/audio/${key}.${audioExtension}` });
  ```

- **MP3 adds silence** at the start and end of the file (encoder padding), which breaks seamless loops. Use Ogg or AAC for music loops.
- **Sample rate:** 48 kHz or 44.1 kHz. **Channels:** stereo for music and ambience, mono for effects and voice.
- **Loudness targets,** as a starting point: music around −18 LUFS integrated, ambience lower, effects and voice peaking at −1 to −3 dBFS. Balance in the game, not in isolation.

## 6. Checklist

- [ ] Every room has `music`, or deliberately inherits the previous room's, or silences it in `onEnter`
- [ ] Music loops are exact length, loop cleanly, and are under about 90 seconds
- [ ] Dialog is readable over the music while ducked
- [ ] Every `>>> sfx` key in the Ink has a file (missing ones show as console warnings in dev)
- [ ] Audio unlocks from the first click, tap or key; controller-only start has a fallback
- [ ] Volume controls exist for music and effects (and voice, if voiced)
- [ ] Tested on a phone speaker and on headphones

## Known gaps

Engine features that would make audio authoring easier, in rough priority order:

- **Streaming music** through an `<audio>` element, so long tracks don't decode fully into memory
- **Loop points** (`loopStart` / `loopEnd`) so a track can have an intro and a tail outside the loop
- **A voice channel** with its own volume, playing `vo:` tags, built in
- **Ambience layers** that run alongside music, with per-room beds
- **Per-call sfx options:** volume, pitch variation, and positional pan from a tile
