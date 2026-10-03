import { Direction, GridEngineHeadless, NoPathFoundStrategy, type NumberOfDirections } from "grid-engine";
import { builtinCommands, tokenize, type CommandFn } from "./commands";
import { Emitter, Store } from "./events";
import { projectionFor, type Projection } from "./projection";
import { pointInShape, shapeCenter } from "./shapes";
import type {
  ActorPlacement,
  ActorState,
  ActorView,
  DialogChoice,
  Facing,
  FlagValue,
  GameDef,
  Handler,
  HotspotDef,
  RoomDef,
  ScriptContext,
  TilePos,
  UiState,
  Vec2,
  VerbId,
  WorldState,
} from "./types";
import { DEFAULT_VERBS } from "./types";
import { CHAR_LAYER, tilemapFor, type Walkmap } from "./walkmap";

export interface ScriptRunner {
  /** Run a story path (e.g. an Ink knot) to completion. */
  run(path: string, ctx: ScriptContext): Promise<void>;
  save?(): string;
  load?(blob: string): void;
}

export interface WorldEvents extends Record<string, unknown> {
  roomChanged: { room: RoomDef; projection: Projection };
  music: { key: string | null };
  sfx: { key: string };
  flag: { name: string; value: FlagValue };
  error: { error: unknown; context: string };
  /** An actor started walking toward a tile (multiplayer clients send this as intent). */
  walk: { actor: string; to: TilePos };
  actorAdded: { actor: string };
  actorRemoved: { actor: string };
}

export interface WorldOptions {
  /** Resolve say() lines automatically after this many ms of world time. For servers and tests. */
  autoAdvanceMs?: number;
  /** Start in this room instead of game.startRoom (a multiplayer server pins one room per instance). */
  room?: string;
  /** Create the single-player actor. Default true; servers set false and add one actor per connection. */
  spawnPlayer?: boolean;
}

const NEIGHBOURS: [number, number][] = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [1, -1], [1, 1], [-1, 1], [-1, -1],
];

const STEP: Record<Facing, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  "up-left": { x: -1, y: -1 },
  "up-right": { x: 1, y: -1 },
  "down-left": { x: -1, y: 1 },
  "down-right": { x: 1, y: 1 },
};

export function facingToward(from: TilePos, to: TilePos): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return "down";
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

type Target =
  | { kind: "hotspot"; hotspot: HotspotDef }
  | { kind: "actor"; id: string }
  | { kind: "tile"; tile: TilePos };

/**
 * The headless game. Owns state, movement and interaction; knows nothing about
 * pixels on a screen beyond room-space coordinates, so the same World runs in a
 * browser, a test, or a PartyServer room.
 */
export class World {
  readonly game: GameDef;
  readonly events = new Emitter<WorldEvents>();
  readonly ui: Store<UiState>;
  readonly commands: Map<string, CommandFn> = builtinCommands();
  readonly options: WorldOptions;

  state: WorldState;
  room!: RoomDef;
  projection!: Projection;
  walkmap!: Walkmap;

  #grid = new GridEngineHeadless(false);
  #time = 0;
  #timers: { at: number; resolve: () => void }[] = [];
  #lineResolve: (() => void) | null = null;
  #choiceResolve: ((i: number) => void) | null = null;
  #runner: ScriptRunner | null = null;

  constructor(game: GameDef, options: WorldOptions = {}) {
    // Copy the actor table so addActor() can extend it without touching shared content.
    this.game = { ...game, actors: { ...game.actors } };
    this.options = options;
    this.state = World.initialState(game);
    if (options.spawnPlayer === false) delete this.state.actors[game.player];
    if (options.room) {
      if (!game.rooms[options.room]) throw new Error(`unknown room "${options.room}"`);
      this.state.room = options.room;
    }
    this.ui = new Store<UiState>({
      line: null,
      choices: [],
      verb: "walk",
      heldItem: null,
      hover: null,
      busy: false,
      focus: null,
      choiceIndex: 0,
      inventory: [],
      room: this.state.room,
    });
  }

  static initialState(game: GameDef): WorldState {
    const actors: Record<string, ActorState> = {};
    for (const room of Object.values(game.rooms)) {
      for (const [id, p] of Object.entries(room.actors ?? {})) {
        actors[id] ??= { room: room.id, x: p.at.x, y: p.at.y, facing: p.facing ?? "down", visible: true };
      }
    }
    const start = game.rooms[game.startRoom];
    if (!start) throw new Error(`startRoom "${game.startRoom}" is not defined`);
    const entry = World.entryFor(start, game.startEntry);
    actors[game.player] = {
      room: start.id,
      x: entry.at.x,
      y: entry.at.y,
      facing: entry.facing ?? "down",
      visible: true,
    };
    return { room: start.id, actors, inventory: [], flags: { ...game.flags } };
  }

  static entryFor(room: RoomDef, entry?: string): ActorPlacement {
    if (entry && room.entries?.[entry]) return room.entries[entry];
    const first = room.entries && Object.values(room.entries)[0];
    if (first) return first;
    // First walkable tile as a last resort.
    for (let y = 0; y < room.walkmap.length; y++) {
      const x = room.walkmap[y]!.indexOf(".");
      if (x >= 0) return { at: { x, y } };
    }
    throw new Error(`room "${room.id}" has no walkable tiles`);
  }

  // ---------------------------------------------------------------- lifecycle

  useScriptRunner(runner: ScriptRunner): void {
    this.#runner = runner;
  }

  /** Enter the starting room and run its onEnter. Call once after construction. */
  start(): void {
    this.#enter(this.state.room);
    const { onEnter } = this.room;
    if (onEnter) void this.#busy(() => this.runHandler(onEnter, { world: this, target: this.room.id, verb: "enter" }));
  }

  /** Advance world time. Drive this from the renderer's ticker or a server loop. */
  update(deltaMs: number): void {
    this.#time += deltaMs;
    this.#grid.update(this.#time, deltaMs);
    if (this.#timers.length) {
      const due = this.#timers.filter((t) => t.at <= this.#time);
      this.#timers = this.#timers.filter((t) => t.at > this.#time);
      for (const t of due) t.resolve();
    }
  }

  get time(): number {
    return this.#time;
  }

  // ----------------------------------------------------------------- queries

  get player(): string {
    return this.game.player;
  }

  actorsInRoom(): string[] {
    return Object.entries(this.state.actors)
      .filter(([, a]) => a.room === this.room.id)
      .map(([id]) => id);
  }

  tileOf(id: string): TilePos {
    if (this.#grid.hasCharacter(id)) return this.#grid.getPosition(id);
    const a = this.#actor(id);
    return { x: a.x, y: a.y };
  }

  /** Renderer view: projected, depth-sorted, with smooth sub-tile movement. */
  actorViews(): ActorView[] {
    const views: ActorView[] = [];
    for (const id of this.actorsInRoom()) {
      const a = this.#actor(id);
      const def = this.game.actors[id];
      let { x, y } = this.tileOf(id);
      const moving = this.#grid.hasCharacter(id) && this.#grid.isMoving(id);
      const facing = this.#grid.hasCharacter(id) ? (this.#grid.getFacingDirection(id) as Facing) : a.facing;
      if (moving) {
        const t = this.#grid.getMovementProgress(id) / 1000;
        const step = STEP[facing] ?? { x: 0, y: 0 };
        x += step.x * t;
        y += step.y * t;
      }
      views.push({
        id,
        sprite: def?.sprite ?? id,
        screen: this.projection.tileToScreen(x, y),
        depth: this.projection.depth(x, y),
        facing,
        moving,
        visible: a.visible,
      });
    }
    return views.sort((a, b) => a.depth - b.depth);
  }

  hotspots(): HotspotDef[] {
    return this.room.hotspots.filter((h) => !h.when || h.when(this));
  }

  /** What's under a room-pixel point: hotspot, then actor, then floor tile. */
  pick(p: Vec2): Target {
    const spots = this.hotspots()
      .filter((h) => pointInShape(h.shape, p))
      .sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
    if (spots[0]) return { kind: "hotspot", hotspot: spots[0] };
    const views = this.actorViews().reverse(); // front-most first
    for (const v of views) {
      if (!v.visible || v.id === this.player) continue;
      const [w, h] = this.game.actors[v.id]?.hitbox ?? [this.room.tile.width, this.room.tile.width * 2];
      if (p.x >= v.screen.x - w / 2 && p.x < v.screen.x + w / 2 && p.y >= v.screen.y - h && p.y < v.screen.y)
        return { kind: "actor", id: v.id };
    }
    return { kind: "tile", tile: this.projection.screenToTile(p.x, p.y) };
  }

  nameAt(p: Vec2): string | null {
    const t = this.pick(p);
    if (t.kind === "hotspot") return t.hotspot.name;
    if (t.kind === "actor") return this.game.actors[t.id]?.name ?? t.id;
    return null;
  }

  // ------------------------------------------------------------------- input

  /** Update the hover label for a room-pixel point. */
  hover(p: Vec2 | null): void {
    this.ui.set({ hover: p ? this.nameAt(p) : null });
  }

  setVerb(verb: VerbId): void {
    this.ui.set({ verb, heldItem: null });
  }

  holdItem(item: string | null): void {
    this.ui.set({ heldItem: item, verb: item ? "use" : "walk" });
  }

  /**
   * Primary input. Tap/click at a room-pixel point:
   * walk to floor, or walk-then-act on a hotspot/actor with the current verb
   * (or the target's default verb if the current verb is "walk").
   */
  async activate(p: Vec2, verbOverride?: VerbId): Promise<void> {
    if (this.ui.get().busy) return;
    const target = this.pick(p);
    if (target.kind === "tile") {
      if (this.ui.get().heldItem) this.holdItem(null);
      await this.walk(this.player, target.tile);
      return;
    }
    const id = target.kind === "hotspot" ? target.hotspot.id : target.id;
    const { verb, heldItem } = this.ui.get();
    await this.interact(id, verbOverride ?? (verb !== "walk" ? verb : this.defaultVerbFor(id)), heldItem ?? undefined);
  }

  /** The verb a plain tap/A-press uses on a hotspot or actor. */
  defaultVerbFor(id: string): VerbId {
    const hotspot = this.room.hotspots.find((h) => h.id === id);
    if (hotspot) return hotspot.default ?? this.game.defaultVerb ?? "look";
    return "talk";
  }

  // ------------------------------------------------------------ focus input

  /**
   * Interactable things near an actor, nearest first: visible hotspots, plus
   * other actors that have verbs. Distance is in room pixels from the actor's
   * foot point to the target (hotspot stand point or shape centre).
   */
  targetsNear(from = this.player, maxDistance = Infinity): { id: string; name: string; distance: number }[] {
    const origin = this.actorViews().find((v) => v.id === from)?.screen;
    if (!origin) return [];
    const out: { id: string; name: string; distance: number }[] = [];
    for (const h of this.hotspots()) {
      const c = shapeCenter(h.shape);
      const stand = h.standAt ? this.projection.tileToScreen(h.standAt.x, h.standAt.y) : c;
      const distance = Math.min(Math.hypot(c.x - origin.x, c.y - origin.y), Math.hypot(stand.x - origin.x, stand.y - origin.y));
      out.push({ id: h.id, name: h.name, distance });
    }
    for (const v of this.actorViews()) {
      const def = this.game.actors[v.id];
      if (v.id === from || !v.visible || !def?.verbs) continue;
      out.push({ id: v.id, name: def.name, distance: Math.hypot(v.screen.x - origin.x, v.screen.y - origin.y) });
    }
    return out.filter((t) => t.distance <= maxDistance).sort((a, b) => a.distance - b.distance);
  }

  setFocus(id: string | null): void {
    this.ui.set({ focus: id });
  }

  /** Cycle focus through targetsNear(), nearest first. */
  focusNext(step = 1, maxDistance = Infinity): string | null {
    const ids = this.targetsNear(this.player, maxDistance).map((t) => t.id);
    if (!ids.length) {
      this.setFocus(null);
      return null;
    }
    const i = ids.indexOf(this.ui.get().focus ?? "");
    const next = ids[(i + step + ids.length) % ids.length]!;
    this.setFocus(next);
    return next;
  }

  /** Act on the focused target: its default verb, or the given one. */
  async activateFocus(verb?: VerbId): Promise<void> {
    const id = this.ui.get().focus;
    if (!id || this.ui.get().busy) return;
    const { heldItem } = this.ui.get();
    await this.interact(id, verb ?? this.defaultVerbFor(id), heldItem ?? undefined);
  }

  /** Move the highlighted choice (gamepad/keyboard). */
  moveChoice(delta: number): void {
    const { choices, choiceIndex } = this.ui.get();
    if (!choices.length) return;
    this.ui.set({ choiceIndex: (choiceIndex + delta + choices.length) % choices.length });
  }

  confirmChoice(): void {
    const { choices, choiceIndex } = this.ui.get();
    const c = choices[choiceIndex];
    if (c) this.choose(c.index);
  }

  /**
   * Walk one step in a screen-space direction (stick or d-pad), in any
   * projection: picks the walkable neighbour tile whose on-screen direction is
   * closest. Returns null if there's nowhere to go or the actor is mid-step.
   */
  stepToward(id: string, dir: Vec2): Promise<boolean> | null {
    const len = Math.hypot(dir.x, dir.y);
    if (!len || !this.#grid.hasCharacter(id) || this.#grid.isMoving(id)) return null;
    const from = this.tileOf(id);
    const origin = this.projection.tileToScreen(from.x, from.y);
    const diagonals = (this.room.directions ?? 4) === 8;
    let best: { tile: TilePos; score: number } | null = null;
    for (const [dx, dy] of NEIGHBOURS) {
      if (!diagonals && dx !== 0 && dy !== 0) continue;
      const tile = { x: from.x + dx, y: from.y + dy };
      if (!this.walkmap.walkable(tile.x, tile.y) || this.#grid.isBlocked(tile, CHAR_LAYER)) continue;
      const s = this.projection.tileToScreen(tile.x, tile.y);
      const sx = s.x - origin.x;
      const sy = s.y - origin.y;
      const score = (sx * dir.x + sy * dir.y) / (Math.hypot(sx, sy) * len);
      if (score > 0.5 && (!best || score > best.score)) best = { tile, score };
    }
    return best ? this.walk(id, best.tile) : null;
  }

  // ------------------------------------------------------------ interaction

  /** Walk to a target (if it has a stand point), face it, then run its handler. */
  async interact(targetId: string, verb: VerbId, item?: string): Promise<void> {
    const hotspot = this.room.hotspots.find((h) => h.id === targetId);
    const actor = this.game.actors[targetId];
    let handler: Handler | undefined;
    if (item) handler = this.game.items?.[item]?.with?.[targetId];
    handler ??= hotspot?.verbs[verb] ?? actor?.verbs?.[verb];

    await this.#busy(async () => {
      if (hotspot) {
        if (hotspot.standAt) await this.walk(this.player, hotspot.standAt);
        const c = shapeCenter(hotspot.shape);
        const center = this.projection.screenToTile(c.x, c.y);
        this.face(this.player, hotspot.face ?? facingToward(this.tileOf(this.player), center));
      } else if (actor) {
        const there = this.tileOf(targetId);
        // The actor occupies its tile, so CLOSEST_REACHABLE stops beside it.
        await this.walk(this.player, there);
        this.face(this.player, facingToward(this.tileOf(this.player), there));
        this.face(targetId, facingToward(there, this.tileOf(this.player)));
      }
      if (!handler) {
        const text = this.game.fallback?.(verb, targetId) ?? "I can't do that.";
        await this.say(this.player, text);
        return;
      }
      await this.runHandler(handler, { world: this, target: targetId, verb, ...(item ? { item } : {}) });
      if (item) this.holdItem(null);
    });
  }

  async runHandler(handler: Handler, ctx: ScriptContext): Promise<void> {
    try {
      if (typeof handler === "function") return await handler(ctx);
      if (!this.#runner) throw new Error(`no script runner installed for "${handler}"`);
      await this.#runner.run(handler, ctx);
    } catch (error) {
      this.events.emit("error", { error, context: `${ctx.verb} ${ctx.target}` });
    }
  }

  /** Run one command line (`walk hero 3 4`, `say moth "hi"`). Leading `>>>` is optional. */
  async command(line: string): Promise<void> {
    const [name, ...args] = tokenize(line.replace(/^\s*>>>\s*/, ""));
    if (!name) return;
    const fn = this.commands.get(name);
    if (!fn) throw new Error(`unknown command "${name}"`);
    await fn(args, this);
  }

  // ---------------------------------------------------------------- actions

  /** Pathfind to a tile; resolves true if the actor got there, false if it stopped short. */
  walk(id: string, dest: TilePos): Promise<boolean> {
    if (!this.#grid.hasCharacter(id)) return Promise.resolve(false);
    const from = this.tileOf(id);
    if (from.x === dest.x && from.y === dest.y) return Promise.resolve(true);
    // Walking "to" an occupied tile (an NPC, a prop) means walking next to it. If we're
    // already beside it there's nothing to do; grid-engine would otherwise never finish.
    let to = dest;
    if (this.#grid.isBlocked(dest, CHAR_LAYER)) {
      if (this.#adjacent(from, dest)) return Promise.resolve(false);
      const beside = this.#freeNeighbours(dest).sort(
        (a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y),
      )[0];
      if (beside) to = beside;
    }
    this.events.emit("walk", { actor: id, to });
    return new Promise((resolve) => {
      let settled = false;
      const sub = this.#grid
        .moveTo(id, to, {
          noPathFoundStrategy: NoPathFoundStrategy.CLOSEST_REACHABLE,
          // Default fires when the last step *starts*; we want arrival.
          emitFinishedEvent: "END_MOVEMENT",
        })
        .subscribe((finished) => {
          if (settled) return;
          settled = true;
          // May fire synchronously (no path), before `sub` is assigned.
          queueMicrotask(() => sub.unsubscribe());
          const at = this.#grid.getPosition(id);
          this.#syncActor(id);
          resolve(finished.result === "SUCCESS" || (at.x === to.x && at.y === to.y));
        });
    });
  }

  /** Add an actor at runtime (remote players, spawned NPCs). */
  addActor(id: string, def: import("./types").ActorDef, at: ActorPlacement, room = this.room.id): void {
    this.game.actors[id] = def;
    this.state.actors[id] = { room, x: at.at.x, y: at.at.y, facing: at.facing ?? "down", visible: true };
    if (room === this.room.id && !this.#grid.hasCharacter(id)) {
      this.#grid.addCharacter({
        id,
        charLayer: CHAR_LAYER,
        startPosition: at.at,
        facingDirection: (at.facing ?? "down") as unknown as Direction,
        speed: def.speed ?? 4,
      });
    }
    this.events.emit("actorAdded", { actor: id });
  }

  removeActor(id: string): void {
    if (this.#grid.hasCharacter(id)) this.#grid.removeCharacter(id);
    delete this.state.actors[id];
    this.events.emit("actorRemoved", { actor: id });
  }

  #adjacent(a: TilePos, b: TilePos): boolean {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (this.room.directions ?? 4) === 8 ? Math.max(dx, dy) === 1 : dx + dy === 1;
  }

  #freeNeighbours(t: TilePos): TilePos[] {
    const diagonals = (this.room.directions ?? 4) === 8;
    return NEIGHBOURS.filter(([dx, dy]) => diagonals || dx === 0 || dy === 0)
      .map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy }))
      .filter((n) => this.walkmap.walkable(n.x, n.y) && !this.#grid.isBlocked(n, CHAR_LAYER));
  }

  face(id: string, facing: Facing): void {
    if (this.#grid.hasCharacter(id)) this.#grid.turnTowards(id, facing as unknown as Direction);
    const a = this.state.actors[id];
    if (a) a.facing = facing;
  }

  place(id: string, at: TilePos): void {
    const a = this.#actor(id);
    a.x = at.x;
    a.y = at.y;
    if (this.#grid.hasCharacter(id)) this.#grid.setPosition(id, at, CHAR_LAYER);
  }

  setVisible(id: string, visible: boolean): void {
    this.#actor(id).visible = visible;
  }

  /** Show a line and wait for the UI (or autoAdvanceMs) to advance it. */
  say(speaker: string | null, text: string, tags: string[] = []): Promise<void> {
    this.ui.set({ line: { speaker, text, tags }, choices: [] });
    return new Promise<void>((resolve) => {
      this.#lineResolve = () => {
        this.#lineResolve = null;
        this.ui.set({ line: null });
        resolve();
      };
      if (this.options.autoAdvanceMs !== undefined)
        void this.wait(this.options.autoAdvanceMs).then(() => this.#lineResolve?.());
    });
  }

  /** UI calls this on tap/click/key while a line is showing. */
  advance(): void {
    this.#lineResolve?.();
  }

  /** Offer choices and wait for choose(). */
  ask(choices: DialogChoice[]): Promise<number> {
    this.ui.set({ choices, line: null, choiceIndex: 0 });
    return new Promise<number>((resolve) => {
      this.#choiceResolve = (i) => {
        this.#choiceResolve = null;
        this.ui.set({ choices: [] });
        resolve(i);
      };
    });
  }

  choose(index: number): void {
    this.#choiceResolve?.(index);
  }

  /** Resolve after ms of world time (not wall time), so servers and tests stay deterministic. */
  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.#timers.push({ at: this.#time + ms, resolve }));
  }

  async goto(roomId: string, entry?: string): Promise<void> {
    const room = this.game.rooms[roomId];
    if (!room) throw new Error(`unknown room "${roomId}"`);
    this.#leave();
    const p = World.entryFor(room, entry);
    const player = this.#actor(this.player);
    Object.assign(player, { room: roomId, x: p.at.x, y: p.at.y, facing: p.facing ?? player.facing });
    this.state.room = roomId;
    this.#enter(roomId);
    if (room.onEnter) await this.runHandler(room.onEnter, { world: this, target: roomId, verb: "enter" });
  }

  give(item: string): void {
    if (!this.state.inventory.includes(item)) this.state.inventory = [...this.state.inventory, item];
    this.ui.set({ inventory: this.state.inventory });
  }

  take(item: string): void {
    this.state.inventory = this.state.inventory.filter((i) => i !== item);
    this.ui.set({ inventory: this.state.inventory });
  }

  has(item: string): boolean {
    return this.state.inventory.includes(item);
  }

  flag(name: string): FlagValue | undefined {
    return this.state.flags[name];
  }

  setFlag(name: string, value: FlagValue): void {
    if (this.state.flags[name] === value) return;
    this.state.flags[name] = value;
    this.events.emit("flag", { name, value });
  }

  // ------------------------------------------------------------- save/load

  serialize(): WorldState {
    for (const id of this.actorsInRoom()) this.#syncActor(id);
    const script = this.#runner?.save?.();
    return structuredClone({ ...this.state, ...(script !== undefined ? { script } : {}) });
  }

  load(state: WorldState): void {
    this.state = structuredClone(state);
    if (state.script !== undefined) this.#runner?.load?.(state.script);
    this.#enter(state.room);
  }

  // ---------------------------------------------------------------- private

  #actor(id: string): ActorState {
    const a = this.state.actors[id];
    if (!a) throw new Error(`unknown actor "${id}"`);
    return a;
  }

  #syncActor(id: string): void {
    if (!this.#grid.hasCharacter(id)) return;
    const a = this.#actor(id);
    const p = this.#grid.getPosition(id);
    a.x = p.x;
    a.y = p.y;
    a.facing = this.#grid.getFacingDirection(id) as Facing;
  }

  #leave(): void {
    if (!this.room) return;
    for (const id of this.actorsInRoom()) this.#syncActor(id);
  }

  #enter(roomId: string): void {
    const room = this.game.rooms[roomId];
    if (!room) throw new Error(`unknown room "${roomId}"`);
    this.room = room;
    this.projection = projectionFor(room);
    const { tilemap, walkmap } = tilemapFor(room);
    this.walkmap = walkmap;
    this.#grid = new GridEngineHeadless(false);
    this.#grid.create(tilemap, {
      characters: this.actorsInRoom().map((id) => {
        const a = this.#actor(id);
        return {
          id,
          charLayer: CHAR_LAYER,
          startPosition: { x: a.x, y: a.y },
          facingDirection: a.facing as unknown as Direction,
          speed: this.game.actors[id]?.speed ?? 4,
        };
      }),
      numberOfDirections: (room.directions ?? 4) as unknown as NumberOfDirections,
    });
    this.ui.set({ room: roomId, inventory: this.state.inventory, hover: null, focus: null });
    this.events.emit("roomChanged", { room, projection: this.projection });
    if (room.music) this.events.emit("music", { key: room.music });
  }

  async #busy(fn: () => Promise<void>): Promise<void> {
    this.ui.set({ busy: true });
    try {
      await fn();
    } finally {
      this.ui.set({ busy: false, line: null, choices: [] });
    }
  }

  /** Verbs offered by the UI. */
  get verbs(): VerbId[] {
    return this.game.verbs ?? DEFAULT_VERBS;
  }
}
