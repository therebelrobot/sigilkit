# Saving and loading

The whole game state is one plain JSON object. There's no save format to design.

```ts
const state = world.serialize(); // WorldState, a deep copy
localStorage.setItem("save", JSON.stringify(state));

world.load(JSON.parse(localStorage.getItem("save")!));
```

## WorldState

```ts
interface WorldState {
  room: string;
  actors: Record<string, ActorState>; // room, x, y, level, facing, visible
  inventory: string[];
  flags: Record<string, string | number | boolean>;
  script?: string;                     // the script runner's state (Ink's JSON)
  revealed?: string[];                 // "room:area" for areas revealed by reveal: "once"
  walkable?: Record<string, boolean>;  // "room:level:x,y" -> walkable, from setWalkable
}
```

A save holds **state**, never **content**. Rooms, hotspots, dialog text and art come from your code, so you can fix typos and rebalance puzzles without breaking saves. The script runner adds its own state: for `InkRunner` that's Ink's visit counts, variables and random seed, so "first time here" lines keep working after a load.

## When to load

`load` replaces the state and re-enters the saved room. Do it between scripts: while a handler is running (`world.ui.get().busy`), the rest of that handler would run against the loaded game. Disable your Load button while busy, or wait for `busy` to clear.

## Where to keep saves

- **localStorage**: wrap it in `try`, because private browsing and full storage can throw.
- **Files**: a download of `JSON.stringify(state)`, and an `<input type="file">` to bring it back.
- **A server**: keyed by the player's account. With the multiplayer layer's Better Auth integration, that's the user id.

Saves are usually a few kilobytes. Ink's state is the largest part.

## Autosave

```ts
world.events.on("roomChanged", () => save(world.serialize()));
```

## Initial state

`World.initialState(game)` builds the state a new game starts from, without creating a world. It's useful for "new game" screens and for comparing saves.
