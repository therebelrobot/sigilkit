# Isometric rooms

The walkmaps so far have been seen from straight above. Many adventures are drawn **isometric** instead: a diamond grid seen from an angle, with walls that stand up. In sigilkit that's a change to one field. The walkmap, the hotspots and the story stay the same.

The demo starts in the isometric courtyard. Walk around, look at the fountain and the urn, then use the **projection** buttons under the demo to switch to the orthogonal version of the same room. Wren keeps her tile.

## What changes

```ts
projection: "isometric",          // was "orthogonal"
tile: { width: 32, height: 16 },  // a 2:1 diamond
directions: 8,                    // diagonal steps for keyboard and stick play
```

Everything that touches space goes through the room's **projection**, an object with four functions:

```ts
tileToScreen(x, y)    // a (fractional) tile -> its foot point in room pixels
screenToTile(px, py)  // a click -> the tile under it
depth(x, y)           // draw order
bounds(cols, rows)    // the room's pixel extent, for the camera
```

Rendering, click picking, smooth movement between tiles and depth sorting all use it. That's why `tileArea` makes diamond hotspots here and square ones in the other room, from the same call.

## Walls stand up

In the blockout, `#` tiles are raised into walls in isometric rooms, and furniture letters draw as low blocks. Actors and walls sort by their foot point's y position, so Wren walks behind the urn and in front of it as she goes around. A finished room usually replaces the blockout with a painted `background` and `props` for anything tall. [Visual design](/docs/visual-design) covers how to draw for both projections.

## Directions on screen

In an isometric room, walking "right" along the grid goes **down-right** on screen. sigilkit keeps two facings on every `ActorView`:

- `facing`: grid space. Scripts and `>>> face wren right` use this.
- `screenFacing`: how it looks. Sprite sheets pick their animation row from this.

Keyboard and gamepad walking (`stepToward`) work in screen space, so pressing up means up on screen in either projection. In an isometric room screen-up is a diagonal grid step, which is why `directions: 8` matters there.

## Bigger than the screen

A room larger than the game's resolution scrolls. The camera follows the player and stops at the room's edges. Isometric rooms get wide quickly (each row and column adds half a tile), so this comes up early. Set `origin` and `size` on a room when its art needs a specific placement.

## What you learned

- `projection: "isometric"` with a 2:1 `tile` turns a room into a diamond grid. Nothing else has to change.
- Hotspots built with `tileArea` follow the projection automatically.
- `facing` is grid space and `screenFacing` is screen space. Use `directions: 8` in isometric rooms.
