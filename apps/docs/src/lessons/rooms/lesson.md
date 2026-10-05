# Moving between rooms

A game is a set of rooms joined by doors. In sigilkit, moving between them is one command: `goto`. This lesson connects the greenhouse to a potting shed.

Walk to the doorway on the right edge of the greenhouse (clicking it uses **walk**), and you're in the shed. The inspector's **Events** tab shows `roomChanged` and `music` each time you go through.

## Entries

An **entry** is a named place to arrive in a room, with a facing:

```ts
entries: {
  start: { at: { x: 5, y: 7 }, facing: "right" },
  "from-shed": { at: { x: 18, y: 5 }, facing: "left" },
},
```

`goto <room> <entry>` puts the player there. Give each doorway its own entry, so coming back through a door puts the player beside it. With no entry named, `goto` uses the room's first one. The game's `startEntry` picks where play begins.

## A door is a hotspot with a goto

There's nothing special about a door. It's a hotspot over the doorway, with `default: "walk"` so a plain click goes through it, and a handler that calls `goto`:

```ink
=== to_shed ===
>>> goto shed door
-> END
```

To lock a door, put a condition in front of the `goto`: `{ has_item("key"): >>> goto shed door - else: Wren: Locked. }`.

## Entering a room

- `onEnter` runs each time the player arrives, and once at the start for the starting room. Ink's visit counts make "only the first time" easy: `{ shed_enter == 1: … }`.
- `music` names the room's music. The world emits a `music` event on entry, and `AudioDirector` from `sigilkit/audio` crossfades to it. See [Music and sound](/learn/audio).
- Actors listed in a room's `actors` start there. Moth lives in the shed and is still there when you come back, because every actor's room and position is kept in the world's state.

From TypeScript, `await world.goto("shed", "door")` does the same thing.

## One room at a time

The world only simulates the **current** room. Pathfinding, collisions and the camera are all set up fresh when you enter, and actors elsewhere wait where they were. That keeps big games cheap. It also means scenes in other rooms happen when the player gets there, which is usually what adventure games want.

## What you learned

- `goto <room> <entry>` changes room, and entries are named arrival points.
- Doors are hotspots whose handler calls `goto`.
- Rooms have `onEnter` handlers and `music`, and the world remembers where every actor is.
