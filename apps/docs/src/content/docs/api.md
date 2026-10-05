# API reference

Every export, grouped by module. Types are summarised here. The source's doc comments, which your editor shows on hover, have the full detail.

## sigilkit

The core. No DOM, and no peers.

### Authoring

| Export | Signature | Notes |
| --- | --- | --- |
| `defineGame` | `<T extends GameDef>(game: T) => T` | Identity helper for type checking content |
| `defineRoom` | `<T extends RoomDef>(room: T) => T` | |
| `tileArea` | `(room, x, y, w = 1, h = 1, lift = 0, level?) => Shape` | Hotspot polygon over a block of tiles, in the room's projection |
| `DEFAULT_VERBS` | `["walk", "look", "use", "talk", "take"]` | |
| `DEFAULT_BASE_LEVEL` | `"ground"` | |

### Content types

| Type | Describes |
| --- | --- |
| `GameDef` | `title`, `resolution`, `player`, `startRoom`, `startEntry?`, `actors`, `rooms`, `items?`, `verbs?`, `defaultVerb?`, `flags?`, `fallback?`. See [Games and the World](/docs/games-and-worlds#definegame) |
| `RoomDef` | See [Rooms](/docs/rooms#fields) |
| `ActorDef` | `name`, `sprite`, `speed?`, `color?`, `verbs?`, `hitbox?`, `height?` |
| `ActorPlacement` | `{ at: TilePos; facing?; level? }`, for entries and room actors |
| `HotspotDef` | `id`, `name`, `shape`, `verbs`, `standAt?`, `face?`, `default?`, `when?`, `z?`, `level?` |
| `ItemDef` | `name`, `icon`, `verbs?`, `with?` |
| `PropDef` | `id?`, `asset?`, `at?`, `tile?`, `depthTile?`, `anchor?`, `level?` |
| `LevelDef` | `id`, `elevation`, `walkmap`, `areamap?` |
| `StairDef` | `from?`, `to`, `steps`, `top` |
| `AreaDef` | `id`, `key`, `name?`, `interior?`, `reveal?`, `cover?`, `onEnter?` |
| `DoorDef` | `id`, `tiles`, `openWhen`, `level?` |
| `ClearanceDef` | `tiles`, `height`, `level?` |
| `Handler` | `string \| (ctx: ScriptContext) => void \| Promise<void>` |
| `ScriptContext` | `{ world, target, verb, item? }` |
| `Shape` | `{ rect: [x, y, w, h] } \| { polygon: number[] }` |
| `Vec2`, `TilePos`, `LevelTilePos` | `{ x, y }`, plus `level?` |
| `Facing` | `"up" \| "down" \| "left" \| "right" \| "up-left" \| "up-right" \| "down-left" \| "down-right"` |
| `VerbId`, `FlagValue`, `ProjectionKind` | `string`, `string \| number \| boolean`, `"orthogonal" \| "isometric"` |

### Runtime types

| Type | Describes |
| --- | --- |
| `WorldState` | `room`, `actors`, `inventory`, `flags`, `script?`, `revealed?`, `walkable?`. See [Saving](/docs/save-and-load) |
| `ActorState` | `room`, `x`, `y`, `facing`, `visible`, `level?` |
| `UiState` | `line`, `choices`, `verb`, `heldItem`, `hover`, `busy`, `focus`, `choiceIndex`, `inventory`, `room` |
| `DialogLine` | `{ speaker: string \| null; text; tags: string[] }` |
| `DialogChoice` | `{ index; text }` |
| `ActorView` | `id`, `sprite`, `screen`, `depth`, `facing`, `screenFacing`, `moving`, `visible`, `level`, `elevation`, `sortY`, `area`. See [Actors](/docs/actors#actorview-what-the-renderer-draws) |
| `WorldOptions` | `autoAdvanceMs?`, `room?`, `spawnPlayer?` |
| `WorldEvents` | Event map for `world.events`. See [events](/docs/games-and-worlds#events) |
| `ScriptRunner` | `run(path, ctx)`, `save?()`, `load?(blob)` |

### World

`new World(game: GameDef, options?: WorldOptions)`

**Properties**

| Member | Type |
| --- | --- |
| `game` | `GameDef` (with this world's own copy of `actors`) |
| `state` | `WorldState` |
| `events` | `Emitter<WorldEvents>` |
| `ui` | `Store<UiState>` |
| `commands` | `Map<string, CommandFn>` |
| `options` | `WorldOptions` |
| `room`, `projection`, `layout`, `walkmap` | The current room, its `Projection`, its `RoomLayout`, and its base-level `Walkmap` |
| `player` | The player's actor id |
| `time` | World time in ms |
| `verbs` | Verbs on offer |

**Lifecycle and time**

| Method | Does |
| --- | --- |
| `useScriptRunner(runner)` | Install a script runner (`InkRunner` does this itself) |
| `start()` | Enter the start room and run its `onEnter` |
| `update(deltaMs)` | Advance world time: movement, timers, areas |
| `wait(ms): Promise<void>` | Resolve after `ms` of world time |

**Actors and movement**

| Method | Does |
| --- | --- |
| `walk(id, dest: LevelTilePos): Promise<boolean>` | Pathfind, across levels if needed. `false` if it stopped short |
| `stepToward(id, direction: Vec2): Promise<boolean> \| null` | One step toward a screen direction |
| `place(id, at: LevelTilePos)` | Instant move |
| `face(id, facing)` | Turn |
| `setVisible(id, visible)` | Show or hide |
| `addActor(id, def, at, room?)` / `removeActor(id)` | Runtime actors |
| `tileOf(id)`, `levelOf(id)`, `heightOf(id)` | Queries |
| `fits(id, tile, level): boolean` | Headroom check |
| `screenOf(tile, level?): Vec2` | Tile → room pixels |
| `actorsInRoom(): string[]` | Ids in the current room |
| `actorViews(): ActorView[]` | Render-ready views |
| `isActorShown(view): boolean` | Not hidden by fog or cutaway |

**Interaction**

| Method | Does |
| --- | --- |
| `activate(point, verb?)` | A click at a room point: walk, or walk-then-act |
| `interact(targetId, verb, item?)` | Walk to the target, face it, run the handler (or the fallback) |
| `runHandler(handler, ctx)` | Run a handler, emitting `error` if it throws |
| `pick(point)` | `{ kind: "hotspot" \| "actor" \| "tile", … }` under a room point |
| `pickTile(point)` | The topmost visible floor tile under a point |
| `nameAt(point)` | Hover label |
| `hover(point \| null)` | Update `ui.hover` |
| `hotspots(): HotspotDef[]` | Hotspots usable right now |
| `defaultVerbFor(id)` | What a plain click does |
| `setVerb(verb)`, `holdItem(item \| null)` | Verb bar and inventory selection |
| `targetsNear(from?, maxDistance?)` | Focusable targets, nearest first |
| `setFocus(id \| null)`, `focusNext(step?, maxDistance?)`, `activateFocus(verb?)` | Couch focus |

**Dialog**

| Method | Does |
| --- | --- |
| `say(speaker \| null, text, tags?): Promise<void>` | Show a line until advanced |
| `advance()` | Advance the current line |
| `ask(choices): Promise<number>` | Offer choices |
| `choose(index)` | Pick one |
| `moveChoice(delta)`, `confirmChoice()` | Keyboard and gamepad cursor |

**Rooms, items, flags, commands**

| Method | Does |
| --- | --- |
| `goto(room, entry?): Promise<void>` | Change room and run its `onEnter` |
| `give(item)`, `take(item)`, `has(item)` | Inventory |
| `flag(name)`, `setFlag(name, value)` | Flags |
| `command(line): Promise<void>` | Run a command line |

**Levels, areas, walkability**

| Method | Does |
| --- | --- |
| `areaOf(id?)` | Area an actor (default the player) stands in |
| `cutaway()` | The interior being cut away, or `null` |
| `isCutAway(level, x, y)` | Whether a tile is cut away |
| `isAreaRevealed(id)`, `revealArea(id)` | Fog |
| `isDoorOpen(doorId)` | Door state |
| `setWalkable(tile, walkable \| null, room?)` | Permanent change, saved |

**State**

| Method | Does |
| --- | --- |
| `serialize(): WorldState` | A deep copy, including the script runner's state |
| `load(state)` | Restore and re-enter the saved room |
| `World.initialState(game)` | The state a new game starts with |
| `World.entryFor(room, entry?)` | Resolve an entry, falling back to the first entry or walkable tile |

### Projections and geometry

| Export | Notes |
| --- | --- |
| `Projection` | `kind`, `tileToScreen`, `screenToTile`, `depth`, `bounds` |
| `orthogonal(tileWidth, tileHeight, origin?)` | |
| `isometric(tileWidth, tileHeight, origin?)` | Diamond. `origin` is tile (0,0)'s top corner |
| `projectionFor(room)` | The room's projection, with default origins |
| `pointInShape(shape, point)`, `shapeCenter(shape)` | |
| `facingOfStep(dx, dy)`, `facingToward(from, to)`, `screenFacing(projection, facing)` | |
| `parseWalkmap(rows)`, `Walkmap` | `{ cols, rows, walkable(x, y) }` |
| `RoomLayout` | Levels, stairs, areas and walkability for a room: `walkable`, `clearanceAt`, `elevationAt`, `areaAt`, `areaTiles`, `isStep`, `levelsFromTop`, `stairEnds`, `isMultiLevel`, … |
| `LayoutLevel`, `StairEnds` | Layout types |
| `ELEVATION_SORT_BIAS` | How much elevation nudges draw order |

### Commands and events

| Export | Notes |
| --- | --- |
| `CommandFn` | `(args: string[], world) => void \| Promise<void>` |
| `builtinCommands()` | A fresh `Map` of the built-ins |
| `tokenize(line)` | Split a command line, honouring double quotes |
| `parseValue(raw)` | `"true"` → `true`, `"3"` → `3`, otherwise the string |
| `Emitter<Events>` | `on(event, fn): () => void`, `emit(event, value)` |
| `Store<T>` | `get()`, `set(patch)`, `subscribe(fn): () => void`, compatible with `useSyncExternalStore` |

## sigilkit/story

Peer: `inkjs`.

| Export | Notes |
| --- | --- |
| `InkRunner` | `new InkRunner(world, json, options?)`. Installs itself. `story` is the inkjs `Story`. Implements `run`, `save`, `load` |
| `InkRunnerOptions` | `commandPrefix?` (`">>>"`), `syncFlags?` (`true`), `resolveSpeaker?(name)` |
| `InkJson` | Compiled Ink, as a string or object |

## sigilkit/story/vite

Peer: `vite`. Node only.

| Export | Notes |
| --- | --- |
| `ink()` | Vite plugin: `.ink` imports become compiled JSON. `INCLUDE`s are watched |
| `compileInk(source, file?)` | Compile to a JSON string. Throws with every compiler error |

## sigilkit/pixi

Peer: `pixi.js` v8.

| Export | Notes |
| --- | --- |
| `createRenderer(world, options): Promise<Renderer>` | See [Rendering](/docs/rendering#options) |
| `Renderer` | `app`, `world`, `toRoom`, `toClient`, `setDebug`, `layers`, `destroy` |
| `RendererOptions`, `Scaling`, `BlockoutStyle` | |
| `placeholderActor(color, size = 14): ActorDisplay` | |
| `sheetActor(spec: SheetSpec): ActorDisplay` | `texture`, `frameWidth`, `frameHeight`, `rows`, `walkFrames`, `idleFrame?`, `fps?`, `anchor?` |
| `ActorDisplay`, `ActorFactory` | `{ view, update(view, deltaMs), destroy }`, `(sprite, actorId) => ActorDisplay` |
| `PropDisplay`, `PropFactory` | `{ view, update?(deltaMs, world), destroy }`, `(prop, { world, projection }) => PropDisplay \| null` |
| `AreaLook`, `DEFAULT_AREA_LOOK` | `cutawayAlpha`, `shadeColor`, `shadeAlpha`, `fogColor`, `fogAlpha`, `headroom?`, `fadeMs` |
| `RoomPiece` | `{ view, level, tiles, propId? }`, something a cutaway can fade |
| `tileOutline(projection, x, y, elevation?)` | A tile's outline as a flat polygon |
| `tilePrism(projection, x, y, elevation, headroom)` | The screen region a column over a tile covers |
| `drawBlock(projection, x, y, baseElevation, topElevation, faces)` | A blockout-style block as `Graphics` |
| `sortKeyFor(projection, x, y, elevation)` | Draw-order key matching actors' `sortY` |
| `BlockFaces` | `{ top, left, right }` colours |

## sigilkit/react

Peer: `react` 19. Styles: `sigilkit/react/styles.css`.

| Export | Notes |
| --- | --- |
| `GameProvider` | `{ world, children }` |
| `Stage`, `StageProps` | Renderer options except `host`, plus `className`, `style`, `onFirstGesture`, `onAltPress` |
| `useWorld()`, `useRenderer()`, `useUi()` | |
| `useDialog()` | `{ line, choices, advance, choose }` |
| `useVerbs()` | `{ verbs, verb, setVerb }` |
| `useInventory()` | `{ items, held, hold }` |
| `GameShell` | `{ stage, children? }` |
| `DialogBox`, `ChoiceList`, `SentenceLine` | `{ className? }` |
| `VerbBar` | `{ className?, labels? }` |
| `InventoryBar` | `{ className?, renderIcon? }` |
| `VerbCoin` | `{ className?, radius? }` |

## sigilkit/input

No peers.

| Export | Notes |
| --- | --- |
| `startKeyboard(world, options?, target = window)` | Returns `{ nav, stop }` |
| `KeyboardOptions`, `KeyAction`, `DEFAULT_KEYS` | `bindings?`, `onKey?`, `focusRangeTiles?` |
| `startGamepad(world, options?)` | Returns `{ controller, stop }`. Polls the first standard-mapping pad |
| `GamepadController` | `new GamepadController(world, options?)`, `frame(pad \| null, deltaMs)`, `events`, `nav` |
| `GamepadOptions` | `deadzone?`, `repeatMs?`, `onButton?`, `onFrame?`, `focusRangeTiles?` |
| `PadSnapshot`, `PadButtonEvent`, `GamepadEvents`, `Button`, `BUTTONS` | |
| `snapshotOf(gamepad)` | `Gamepad` → `PadSnapshot` |
| `Navigator`, `NavigatorOptions` | `update`, `confirm`, `verb`, `cycle`, `cancel` |
| `inputMode`, `setInputMode(mode)`, `InputMode` | Last-used device store |
| `trackPointerAndKeyboard(target = window)` | Updates `inputMode` from pointer and key events. Returns a stop function |

## sigilkit/audio

No peers.

| Export | Notes |
| --- | --- |
| `AudioDirector` | `new AudioDirector(world, options)`. `unlock`, `music`, `sfx`, `setVolumes`, `duckMusic`, `dispose`, `ctx` |
| `AudioOptions` | `resolve`, `musicVolume?`, `sfxVolume?`, `duck?`, `fade?` |

## sigilkit/net

Protocol and auth. Safe in any runtime.

| Export | Notes |
| --- | --- |
| `ClientMessage`, `ServerMessage`, `ActorSnapshot`, `Identity` | Wire types. See [Protocol](/docs/multiplayer#protocol) |
| `parseClientMessage(raw)` | Validate an incoming message, or `null` |
| `IDENTITY_HEADER`, `PLAYER_PREFIX`, `isPlayerId(id)`, `MAX_CHAT` | |
| `AuthVerifier` | `(request) => Promise<Identity \| null>` |
| `betterAuthVerifier(auth)`, `betterAuthRemoteVerifier(baseURL, basePath?)`, `guestVerifier` | |

## sigilkit/net/server

Peer: `partyserver`. Re-exports everything from `sigilkit/net`.

| Export | Notes |
| --- | --- |
| `createRoomServer(game, options?)` | A Durable Object class for `game` |
| `RoomServer`, `RoomServerOptions` | Subclass to extend. Options: `playerSprite?`, `tickMs?`, `rateLimit?` |
| `createPartyHandler(verify)` | Worker fetch handler: `(request, env) => Promise<Response \| null>` |
| `roomIdFromPartyName(name)` | `"eu1~greenhouse"` → `"greenhouse"` |
| `ConnState` | Per-connection state |

## sigilkit/net/client

Peer: `partysocket`.

| Export | Notes |
| --- | --- |
| `connect(world, options): NetSession` | Join the current room's server, and follow room changes |
| `ConnectOptions` | `host`, `party?`, `instance?`, `query?` |
| `NetSession` | `socket`, `events`, `self()`, `chat(text)`, `close()` |
| `NetEvents` | `chat`, `status`, `error` |
