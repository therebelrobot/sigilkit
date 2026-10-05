# Games and the World

Everything in sigilkit hangs off two objects. A **game** (`GameDef`) is your content: rooms, actors, items, verbs and starting flags. A **world** (`World`) is a running copy of it: where everyone is, what's in the inventory, which flags are set, and the clock. A game is plain data, and a world is the engine.

## defineGame

```ts
import { defineGame } from "sigilkit";

export const game = defineGame({
  title: "Greenhouse",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "greenhouse",
  startEntry: "start",
  actors: { wren: { name: "Wren", sprite: "wren" } },
  rooms: { greenhouse, rooftop },
  items: { can: { name: "watering can", icon: "can", with: { planter: "planter_water" } } },
  verbs: ["walk", "look", "use", "talk", "take"],
  defaultVerb: "look",
  flags: { roof_unlocked: false },
  fallback: (verb, target) => "Nothing interesting.",
});
```

`defineGame` returns its argument unchanged. It's there so content files get type checking and editor completion. `defineRoom` does the same for rooms.

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | `string` | The game's name |
| `resolution` | `{ width, height }` | Logical screen size in pixels. The renderer scales it to fit. 320 × 180 is a good default |
| `player` | `string` | Actor id the player controls |
| `startRoom` | `string` | Room id to begin in |
| `startEntry` | `string?` | Entry in the start room. Default: its first entry |
| `actors` | `Record<string, ActorDef>` | Every character. See [Actors](/docs/actors) |
| `rooms` | `Record<string, RoomDef>` | Every room. See [Rooms](/docs/rooms) |
| `items` | `Record<string, ItemDef>?` | Inventory items. See [Items and flags](/docs/items-and-flags) |
| `verbs` | `string[]?` | Verbs the UI offers. Default `walk look use talk take` |
| `defaultVerb` | `string?` | What a plain click does to a hotspot without its own `default`. Default `"look"` |
| `flags` | `Record<string, string \| number \| boolean>?` | Starting flag values |
| `fallback` | `(verb, target) => string` | The player's line when a verb has no handler. Default "I can't do that." |

Keep game files free of asset imports and DOM code. The multiplayer server and your tests import the same object.

## World

```ts
import { World } from "sigilkit";

const world = new World(game);
world.start();
```

`start()` enters the starting room and runs its `onEnter`. Call it once, after installing a script runner (`new InkRunner(world, story)`), so the first room's `onEnter` knot can run.

### Options

```ts
new World(game, { autoAdvanceMs: 1, room: "greenhouse", spawnPlayer: false });
```

| Option | Default | Use |
| --- | --- | --- |
| `autoAdvanceMs` | none | Resolve every `say` line after this many ms of world time, for tests and servers |
| `room` | `game.startRoom` | Start in another room. A multiplayer server pins one room per instance |
| `spawnPlayer` | `true` | Create the single-player actor. Servers set `false` and add one actor per connection |

### Time

The world has its own clock. Nothing moves until `world.update(deltaMs)` is called. The Pixi renderer calls it every frame, a server calls it from its tick, and a test calls it in a loop. `world.time` is the total so far, and `world.wait(ms)` resolves after that much world time.

That's why scripts and tests are deterministic: a cutscene with `>>> wait 5000` finishes in microseconds in a test, the same way every time.

### State

`world.state` is the whole game state as plain JSON (`WorldState`): current room, every actor's position, inventory, flags, revealed areas and changed tiles. `world.serialize()` returns a copy, and `world.load(state)` restores one. See [Saving and loading](/docs/save-and-load).

### The current room

The world simulates one room at a time. `world.room` is its `RoomDef`, `world.projection` its tile/pixel math, and `world.layout` its levels, stairs, areas and walkability. `world.goto(room, entry)` moves there.

### Events

`world.events` is a small typed emitter. `on` returns an unsubscribe function.

```ts
const stop = world.events.on("flag", ({ name, value }) => console.log(name, value));
```

| Event | Payload | When |
| --- | --- | --- |
| `roomChanged` | `{ room, projection }` | A room was entered (including at `start()` and `load()`) |
| `walk` | `{ actor, to }` | An actor started walking toward a tile. Multiplayer clients send this as an intent |
| `flag` | `{ name, value }` | A flag changed value |
| `music` | `{ key }` | Room music, or `>>> music key`. `null` means silence |
| `sfx` | `{ key }` | `>>> sfx key` |
| `areaChanged` | `{ area, previous }` | The player walked into another area, or out of all of them |
| `areaRevealed` | `{ room, area }` | A `reveal: "once"` area was revealed for good |
| `walkableChanged` | `{ tiles }` | A door opened or shut, or `setWalkable` changed tiles |
| `actorAdded` / `actorRemoved` | `{ actor }` | `addActor` / `removeActor` |
| `error` | `{ error, context }` | A handler threw. Log these in development |

### UI state

`world.ui` is a tiny store holding everything an interface shows: the current line, choices, selected verb, held item, hover label, focus, busy flag, inventory and room. It's compatible with React's `useSyncExternalStore`, and `sigilkit/react`'s hooks read it. See [React UI](/docs/react).

### Busy

While a handler runs (walking to a hotspot, then its dialog), `ui.busy` is `true` and clicks on the world are ignored. That's what stops the player wandering off mid-sentence. Commands run from your own code don't set busy, so a cutscene you trigger from TypeScript can run during play.

## Script runners

A string handler like `"planter_look"` is a story path. The world passes it to its **script runner**:

```ts
interface ScriptRunner {
  run(path: string, ctx: ScriptContext): Promise<void>;
  save?(): string;
  load?(blob: string): void;
}
```

`InkRunner` from `sigilkit/story` installs itself with `world.useScriptRunner(this)`. Write your own to drive Yarn Spinner, a JSON dialog tree or anything else. `save` and `load` let its state travel with the game's saves.

## Next

- [Rooms and walkmaps](/docs/rooms)
- [Actors and movement](/docs/actors)
- The [API reference](/docs/api#world) lists every `World` method.
