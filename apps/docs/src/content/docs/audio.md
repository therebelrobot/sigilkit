# Audio

`sigilkit/audio` is a small Web Audio layer that follows the world: room music crossfades, `>>> sfx` lines play one-shots, and music ducks while dialog is on screen.

```ts
import { AudioDirector } from "sigilkit/audio";

const audio = new AudioDirector(world, { resolve: (key) => `/audio/${key}.ogg` });
```

```tsx
<Stage actors={actors} onFirstGesture={() => void audio.unlock()} />
```

No peers. Browsers start audio suspended, so call `unlock()` from the first user gesture. `<Stage onFirstGesture>` is the place.

## What it listens to

| World | Director |
| --- | --- |
| A room with `music: "theme"` is entered | Crossfade to `theme`, looping |
| `>>> music theme` / `>>> music` | Crossfade to it, or to silence |
| `>>> sfx door` | Play `door` once |
| A dialog line is showing | Duck the music to `duck` |

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `resolve` | required | Asset key → URL |
| `musicVolume` | 0.7 | Music bus gain |
| `sfxVolume` | 0.9 | Effects bus gain |
| `duck` | 0.45 | Music gain multiplier under dialog. 1 disables |
| `fade` | 1.2 | Crossfade time, seconds |

## Methods

| Method | Does |
| --- | --- |
| `unlock()` | Resume the audio context |
| `music(key \| null)` | Crossfade to a loop, or out |
| `sfx(key)` | One-shot |
| `setVolumes({ music?, sfx? })` | Player volume settings |
| `duckMusic(reason, level, smoothing?)` | Lower the music for a named reason. `level` 1 removes it |
| `dispose()` | Stop listening and close the context |
| `ctx` | The `AudioContext`, for your own nodes |

### Ducking reasons

Dialog ducking is the built-in reason `"dialog"`. Add your own (a spell being cast, a cutscene, a pause menu) and they multiply rather than fight:

```ts
audio.duckMusic("weave", 0.2); // while the player plays notes
audio.duckMusic("weave", 1);   // remove the reason
```

It's safe to call every frame. Changes glide over `smoothing` seconds (0.08 by default), and changes smaller than 0.01 aren't rescheduled.

## Missing files

A missing or undecodable file logs one warning per key and never breaks play. You can write `>>> sfx` lines before the sounds exist, and failures aren't cached, so a file added during development is picked up on the next play.

## Using something else

The director only listens to `world.events`. Use any audio engine the same way:

```ts
world.events.on("music", ({ key }) => howler.playMusic(key));
world.events.on("sfx", ({ key }) => howler.play(key));
world.ui.subscribe(() => howler.duck(world.ui.get().line !== null));
```

[Audio design](/docs/audio-design) covers making loops, mixing, voiced lines, dialog blips and file formats.
