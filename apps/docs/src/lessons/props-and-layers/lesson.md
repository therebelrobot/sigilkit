# Props and effect layers

Placeholder capsules and blockout floors are good for finding a game's shape, but a world needs things that move. This lesson adds two kinds of moving art: **props**, scenery that depth-sorts with characters and can react to the game, and **effect layers** for particles, decals and screen flashes.

Walk Wren behind the lamp post and the pinwheel, then in front of them: both sort correctly against her. Fireflies follow her, and she leaves fading footprints. Use the lamp to turn it off, and the fireflies brighten.

## Props

```ts
props: [
  { id: "lamp", tile: { x: 3, y: 3 } },
  { id: "pinwheel", tile: { x: 6, y: 2 } },
],
```

A prop is placed by `tile` (drawn at that tile's foot point, and sorted with it) or by `at` (a pixel position, for painted art). A static prop needs only an `asset`, an image key the renderer resolves through `resolveAsset`. Use static props for anything tall in a painted room that characters walk behind: a pillar, a tree, the front of a counter.

For props that move, give the renderer a **prop factory**:

```tsx
<Stage actors={actors} props={props} />
```

The factory receives each `PropDef` and returns a `PropDisplay` (a Pixi `view`, an optional `update(deltaMs, world)`, and `destroy`), or `null` to fall back to the static `asset`. The renderer positions the view, depth-sorts it with actors every frame, and calls `update`. The lamp reads `world.flag("lamp_lit")` in its `update`, which is how scenery reacts to game state without being turned into a fake actor.

Mark a prop's tile as blocked in the walkmap (`l` and `w` here) so nobody walks through it.

## Effect layers

The renderer has three containers for your own drawing:

| Layer | Coordinates | Sits | Use it for |
| --- | --- | --- | --- |
| `renderer.layers.floor` | room pixels, follows the camera | on the ground, under walls, props and actors | footprints, paths, ripples, decals, runtime floor tiles |
| `renderer.layers.world` | room pixels, follows the camera | above actors and props | particles, auras, spell effects |
| `renderer.layers.overlay` | logical screen pixels (320 × 180) | over everything | flashes, tints, vignettes, static |

**effects.ts** uses all three. It runs on `renderer.app.ticker`, reads `world.actorViews()` for the player's on-screen position, and cleans up after itself. Get the renderer from `useRenderer()` inside `<GameProvider>`, or from `createRenderer` if you aren't using React.

## Characters

`<Stage actors={…}>` takes an **actor factory**: `(spriteKey, actorId) => ActorDisplay`. These lessons use `placeholderActor(color)`. `sheetActor({ texture, frameWidth, frameHeight, rows, walkFrames })` animates a classic grid spritesheet with one row per facing. Like props, an actor display is a Pixi view plus an `update(view, deltaMs)` that receives the actor's `ActorView` (position, `screenFacing`, `moving`), so Spine, Aseprite exports or anything else fit the same shape.

## What you learned

- `RoomDef.props` places scenery, and a `PropFactory` animates it with access to the world.
- `layers.floor`, `layers.world` and `layers.overlay` are for your own effects.
- Actor art is an `ActorFactory`. `placeholderActor` and `sheetActor` are built in.
