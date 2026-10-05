# Music and sound

Sound does more for atmosphere than almost anything else in an adventure game. `sigilkit/audio` is a small Web Audio layer that follows the world: each room's music crossfades in, `>>> sfx` lines play one-shots, and the music ducks under dialog so lines can be heard.

**Turn your sound on**, then click the demo once. Browsers won't play audio until the page has been interacted with. Walk through the door on the right and the music crossfades to the shed's. Look at the tool rack, talk to Moth, and try the mixer under the demo.

## The director

```ts
import { AudioDirector } from "sigilkit/audio";

const audio = new AudioDirector(world, { resolve: (key) => `/audio/${key}.ogg` });
```

```tsx
<Stage actors={actors} onFirstGesture={() => void audio.unlock()} />
```

`resolve` turns an asset key into a URL. Everything else follows the world's events:

| In the game | The director |
| --- | --- |
| `music: "shed-theme"` on a room, or `>>> music shed-theme` | Crossfades to that loop (`fade` seconds). `>>> music` with no key fades to silence |
| `>>> sfx door` | Plays a one-shot over the music |
| A line of dialog is showing | Ducks the music to `duck` (0.45 by default) |

Missing files never break play. The director logs one warning per key and carries on, so you can write `>>> sfx` lines before the sounds exist. This lesson's sounds are synthesised in the browser by **sounds.ts**, because there are no files to download. A game resolves keys to real files.

## Ducking for your own reasons

Dialog ducking is one *reason*. Games add more:

```ts
audio.duckMusic("spell", 0.15); // while the player plays notes
audio.duckMusic("spell", 1);    // done: remove the reason
```

Reasons multiply, so dialog ducking and your own don't fight. `duckMusic` is safe to call every frame: changes glide over a few milliseconds, and tiny ones are skipped. The **duckMusic** button under the demo toggles a "spell" reason.

## Volumes

`audio.setVolumes({ music, sfx })` sets the player's volume levels, separately from ducking. Connect them to your settings screen.

## Not using AudioDirector

The director is only a listener on `world.events`. If you'd rather use Howler, FMOD or your own engine, listen to the same events:

```ts
world.events.on("music", ({ key }) => myEngine.playMusic(key));
world.events.on("sfx", ({ key }) => myEngine.play(key));
```

[Audio design](/docs/audio-design) covers making loops, mixing, voiced lines and file formats.

## What you learned

- `AudioDirector` follows room `music`, `>>> sfx` and dialog, given a `resolve` from keys to URLs.
- Call `unlock()` from the first user gesture. `<Stage onFirstGesture>` is the place.
- `duckMusic(reason, level)` stacks ducking reasons, and `setVolumes` is for player settings.
