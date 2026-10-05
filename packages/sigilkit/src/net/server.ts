import { World, type GameDef, type LevelTilePos } from "../core/index";
import { routePartykitRequest, Server, type Connection, type ConnectionContext } from "partyserver";
import type { AuthVerifier } from "./auth";
import { IDENTITY_HEADER, isPlayerId, parseClientMessage, PLAYER_PREFIX, type ActorSnapshot, type Identity, type ServerMessage } from "./protocol";

export interface RoomServerOptions {
  /** Sprite key for players without one. Default: the single-player actor's sprite. */
  playerSprite?: string;
  /** Simulation step. Default 50ms (20Hz). */
  tickMs?: number;
  /** Max client messages per second per connection. Default 12. */
  rateLimit?: number;
}

export interface ConnState {
  id: string;
  name: string;
  /** messages in the current second */
  budget: number;
  window: number;
}

/**
 * Party room names map to game rooms: "cabin" or "<instance>~cabin" (so you can
 * shard one map into several instances). Each Durable Object simulates exactly
 * one game room; moving between rooms is a reconnect.
 */
export function roomIdFromPartyName(name: string): string {
  return name.includes("~") ? name.slice(name.lastIndexOf("~") + 1) : name;
}

/**
 * A Durable Object that runs one game room authoritatively. Subclass it and set
 * the static `game`:
 *
 *   export class Rooms extends RoomServer {
 *     static override game = game;
 *   }
 *
 * or use createRoomServer(game, options). Override onMessage etc. to extend the
 * protocol; call super to keep movement and chat.
 */
export class RoomServer extends Server {
  static override options = { hibernate: false };
  static game: GameDef;
  static config: RoomServerOptions = {};
  world!: World;
  #timer: ReturnType<typeof setInterval> | null = null;
  #intents = new Map<string, number>();

  get #cfg(): Required<Omit<RoomServerOptions, "playerSprite">> & Pick<RoomServerOptions, "playerSprite"> {
    const c = (this.constructor as typeof RoomServer).config;
    return { tickMs: 50, rateLimit: 12, ...c };
  }

  override onStart(): void {
    const { game } = this.constructor as typeof RoomServer;
    if (!game) throw new Error("RoomServer subclass must set `static game`");
    this.world = new World(game, { room: roomIdFromPartyName(this.name), spawnPlayer: false, autoAdvanceMs: 0 });
    this.world.start();
    this.world.events.on("walk", ({ actor, to }) => this.#send({ t: "moves", moves: { [actor]: to } }));
  }

  override onConnect(conn: Connection<ConnState>, ctx: ConnectionContext): void {
    const raw = ctx.request.headers.get(IDENTITY_HEADER);
    const who = raw ? (JSON.parse(raw) as Identity) : null;
    if (!who) return conn.close(4401, "unauthenticated");
    const id = `${PLAYER_PREFIX}${who.id}`;
    // One live connection per identity: a new tab replaces the old one.
    for (const other of this.getConnections<ConnState>()) {
      if (other.id !== conn.id && other.state?.id === id) other.close(4409, "replaced");
    }
    conn.setState({ id, name: who.name, budget: 0, window: 0 });

    const params = new URL(ctx.request.url).searchParams;
    const x = Number(params.get("x"));
    const y = Number(params.get("y"));
    // Arrive where the client's own world put you if that's a free, walkable tile; else at an entry.
    const at =
      Number.isInteger(x) && Number.isInteger(y) && this.world.walkmap.walkable(x, y)
        ? { at: { x, y } }
        : World.entryFor(this.world.room, params.get("entry") ?? undefined);
    if (this.world.state.actors[id]) this.world.removeActor(id);
    // Players move like the single-player character (speed, hitbox) so client prediction matches.
    const { verbs: _verbs, ...template } = this.world.game.actors[this.world.game.player] ?? { name: "", sprite: "player" };
    this.world.addActor(id, { ...template, name: who.name, sprite: who.sprite ?? this.#cfg.playerSprite ?? template.sprite }, at);

    this.#send({ t: "welcome", you: id, actors: this.#snapshot() }, conn);
    this.#send({ t: "joined", id, actor: this.#snapshot()[id]! }, undefined, [conn.id]);
    this.#ensureTicking();
  }

  override async onMessage(conn: Connection<ConnState>, message: string | ArrayBuffer | ArrayBufferView): Promise<void> {
    const s = conn.state;
    if (!s) return;
    const now = Math.floor(Date.now() / 1000);
    const budget = s.window === now ? s.budget : 0;
    if (budget >= this.#cfg.rateLimit) return;
    conn.setState({ ...s, window: now, budget: budget + 1 });

    const msg = parseClientMessage(message);
    if (!msg) return this.#send({ t: "error", message: "bad message" }, conn);
    if (msg.t === "chat") return this.#send({ t: "chat", from: s.id, name: s.name, text: msg.text });
    if (msg.t === "walk") {
      const level = msg.to.level ?? this.world.layout.baseLevel;
      if (!this.world.layout.hasLevel(level) || !this.world.layout.walkable(level, msg.to.x, msg.to.y)) return;
      const seq = (this.#intents.get(s.id) ?? 0) + 1;
      this.#intents.set(s.id, seq);
      const arrived = await this.world.walk(s.id, msg.to);
      // A newer intent cancels this walk; that's not a failure worth correcting.
      if (this.#intents.get(s.id) !== seq || arrived || !this.world.state.actors[s.id]) return;
      const at: LevelTilePos = { ...this.world.tileOf(s.id), level: this.world.levelOf(s.id) };
      this.#send({ t: "moves", moves: { [s.id]: at } });
      this.#send({ t: "correct", at }, conn);
    }
  }

  override onClose(conn: Connection<ConnState>): void {
    const id = conn.state?.id;
    const stillHere = id && [...this.getConnections<ConnState>()].some((c) => c.id !== conn.id && c.state?.id === id);
    if (id && !stillHere && this.world.state.actors[id]) {
      this.world.removeActor(id);
      this.#intents.delete(id);
      this.#send({ t: "left", id });
    }
    if (![...this.getConnections()].length && this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  #ensureTicking(): void {
    const step = this.#cfg.tickMs;
    this.#timer ??= setInterval(() => this.world.update(step), step);
  }

  #snapshot(): Record<string, ActorSnapshot> {
    const out: Record<string, ActorSnapshot> = {};
    for (const id of this.world.actorsInRoom()) {
      if (!isPlayerId(id)) continue;
      const a = this.world.state.actors[id]!;
      const def = this.world.game.actors[id];
      const at = this.world.tileOf(id);
      const level = this.world.levelOf(id);
      out[id] = {
        x: at.x,
        y: at.y,
        facing: a.facing,
        name: def?.name ?? id,
        sprite: def?.sprite ?? id,
        speed: def?.speed ?? 4,
        ...(level !== this.world.layout.baseLevel ? { level } : {}),
      };
    }
    return out;
  }

  #send(msg: ServerMessage, to?: Connection, except?: string[]): void {
    const data = JSON.stringify(msg);
    if (to) to.send(data);
    else this.broadcast(data, except);
  }
}

/** Shorthand for `class extends RoomServer { static game = game }`. */
export function createRoomServer(game: GameDef, options: RoomServerOptions = {}): typeof RoomServer {
  return class extends RoomServer {
    static override game = game;
    static override config = options;
  };
}

/**
 * Worker fetch handler: authenticates WebSocket upgrades, stamps the verified
 * identity onto the request for the room, and routes /parties/:party/:room.
 */
export function createPartyHandler(verify: AuthVerifier) {
  const stamp = async (req: Request): Promise<Request | Response> => {
    const who = await verify(req);
    if (!who) return new Response("Unauthorized", { status: 401 });
    const forwarded = new Request(req);
    forwarded.headers.set(IDENTITY_HEADER, JSON.stringify(who));
    return forwarded;
  };
  return async (request: Request, env: Cloudflare.Env): Promise<Response | null> =>
    routePartykitRequest(request, env, {
      onBeforeConnect: stamp,
      // Plain HTTP to a room never carries a trusted identity.
      onBeforeRequest: (req) => {
        const clean = new Request(req);
        clean.headers.delete(IDENTITY_HEADER);
        return clean;
      },
    });
}
export * from "./auth";
export * from "./protocol";
