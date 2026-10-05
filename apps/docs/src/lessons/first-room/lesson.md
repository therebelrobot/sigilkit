# A room to walk in

Every sigilkit game starts from the same two things: a **room** that says where feet can go, and a **game** that says who's playing. This lesson has no art, no story and nothing to click. It's a character in a room, walking where you tell it to.

Click anywhere on the floor in the demo. Wren walks there, going around the planters and the wall in the middle. If you click somewhere she can't stand, she walks to the nearest reachable tile.

## The walkmap

Open **walkmap.txt** in the demo. Each character is one tile:

| Character | Means |
| --- | --- |
| `.` | Floor: walkable |
| `#` | Wall |
| any other letter | Floor with something on it, so it's blocked. The letters are only names: `p` for planter, `t` for table, `b` for barrel |

The walkmap only decides where characters can walk. The art is drawn separately. A finished room has a painted `background` image, and its walkmap is invisible. Until you have art, the renderer draws a **blockout** from the walkmap: floor tiles in two greens, darker blocks for furniture, and wall colour for `#`. That makes a room playable before anything is painted.

Press **Debug** in the toolbar to see the grid as the engine sees it.

> [!TIP]
> Try it: in walkmap.txt, turn the wall in the middle into floor, or draw yourself a maze, then press **Run**. Every row should be the same length. Lines starting with `//` are ignored.

## The room

`defineRoom` takes plain data. The fields this room uses are:

- `projection`: `"orthogonal"` here (a square grid seen from above). [Lesson 8](/learn/isometric) switches to `"isometric"`.
- `tile`: how many pixels one walkmap character covers. 16 × 16 is a good size for a 320 × 180 screen.
- `entries`: named places to arrive. With no `startEntry` set, the game uses the first one.
- `hotspots`: the things you can click. There aren't any yet.

`defineRoom` and `defineGame` return what you pass them unchanged. They exist so your editor can type-check content files and autocomplete their fields.

## The game

`defineGame` lists every actor and room, and picks the player and the starting room. `resolution` is the logical screen size. The renderer scales it to whatever space it has: crisp whole-number scaling at 2× and above, and smooth scaling on small phones.

Actors need a `sprite` key. The renderer turns that key into art through an *actor factory*. These lessons use `placeholderActor`, a coloured capsule with a dot showing which way it faces, which is also why `color` is set here.

## Wiring it up

Under the demo is the same wiring every game uses:

```ts
import { World } from "sigilkit";
import { placeholderActor } from "sigilkit/pixi";
import { GameProvider, GameShell, Stage } from "sigilkit/react";
import "sigilkit/react/styles.css";

const world = new World(game); // the headless game state
world.start();                 // enter the start room

export const App = () => (
  <GameProvider world={world}>
    <GameShell stage={<Stage actors={() => placeholderActor(0xf3d27a)} />} />
  </GameProvider>
);
```

`World` is the whole game: rooms, positions, inventory, flags and pathfinding. It has no DOM, which is why the same class runs in tests and on a multiplayer server. `<Stage>` mounts the Pixi renderer, which drives the world's clock every frame and turns clicks into `world.activate(point)`.

## What you learned

- A room is data: a `walkmap` for movement, `entries` for arrival points, and later, hotspots for interaction.
- Art and walkability are separate. The blockout lets you play before there's any art.
- `World` holds the state, and `<Stage>` draws it and passes it clicks.

Next, we'll give Wren something to look at.
