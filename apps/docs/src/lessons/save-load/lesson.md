# Saving and loading

A sigilkit game's whole state is one plain JSON object. Saving is `world.serialize()`, and loading is `world.load(state)`. There's no special save format and nothing to register.

Move Wren somewhere, then press **Save** and read the JSON that appears. Take the watering can, water the planter, walk away, and press **Load**: you're back where you saved, with the can on the bench and the planter dry. The save is kept in your browser's localStorage, so it survives **Restart** and reloading the page.

## What's in a save

```ts
interface WorldState {
  room: string;                            // current room
  actors: Record<string, ActorState>;      // room, tile, level, facing, visibility of every actor
  inventory: string[];
  flags: Record<string, FlagValue>;
  script?: string;                         // the script runner's state (Ink's, as JSON)
  revealed?: string[];                     // areas revealed by reveal: "once"
  walkable?: Record<string, boolean>;      // tiles changed with setWalkable / block / unblock
}
```

Everything the game remembers lives here. Rooms, hotspots and story text are content: they come from your code, not from the save, so a save from an older version of the game still loads when you fix a typo. `InkRunner` adds Ink's own state (visit counts, variables, its random seed) as the `script` string, which is why Moth's "first visit" lines keep working after a load.

## Where to keep it

A save is small (usually a few kilobytes), so put it wherever suits the game:

- **localStorage**, as **saves.ts** does. Wrap it in `try`, because private browsing can refuse.
- **A file**: `new Blob([JSON.stringify(state)])` and a download link, for players who want to keep saves themselves.
- **A server**, keyed by the player's account. With the multiplayer layer's Better Auth integration, the user id is a natural key.

## When to load

Load between scripts, not in the middle of one. A running knot is a promise in progress, and replacing the world's state under it would let the rest of the knot run against the loaded game. **saves.ts** refuses while `ui.busy` is true, and the buttons are disabled then.

Autosave is a `roomChanged` listener away:

```ts
world.events.on("roomChanged", () => saveGame(world));
```

## What you learned

- `world.serialize()` returns plain JSON, and `world.load(state)` restores it.
- The save holds state (positions, inventory, flags, story progress), never content.
- Load only while the world isn't busy, and put saves wherever suits the game.
