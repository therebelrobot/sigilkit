import { Emitter, type World } from "../core/index";
import PartySocket from "partysocket";
import { isPlayerId, type ClientMessage, type ServerMessage } from "./protocol";

export interface ConnectOptions {
  /** Worker host, e.g. "game.example.com" or "localhost:8787". */
  host: string;
  /** Party name: the Durable Object binding in kebab-case. Default "rooms". */
  party?: string;
  /** Shard prefix: players in different instances of a room don't see each other. */
  instance?: string;
  /** Extra query params, e.g. { token } from Better Auth's bearer plugin, or { guest } in dev. */
  query?: () => Record<string, string> | Promise<Record<string, string>>;
}

export interface NetEvents extends Record<string, unknown> {
  chat: { from: string; name: string; text: string };
  status: { connected: boolean };
  error: { message: string };
}

export interface NetSession {
  readonly socket: PartySocket;
  readonly events: Emitter<NetEvents>;
  /** Your actor id on the server. */
  readonly self: () => string | null;
  chat(text: string): void;
  close(): void;
}

/**
 * Joins the server room matching the world's current room and keeps it in sync:
 * your walks go up as intents, other players appear as actors and are animated
 * locally from their target tiles, and changing rooms reconnects.
 */
export function connect(world: World, opts: ConnectOptions): NetSession {
  const events = new Emitter<NetEvents>();
  const remote = new Set<string>();
  let self: string | null = null;

  const partyRoom = () => (opts.instance ? `${opts.instance}~${world.room.id}` : world.room.id);
  const query = async () => {
    const at = world.tileOf(world.player);
    return { ...(await opts.query?.()), x: String(at.x), y: String(at.y) };
  };

  const socket = new PartySocket({ host: opts.host, party: opts.party ?? "rooms", room: partyRoom(), query });
  const send = (m: ClientMessage) => socket.send(JSON.stringify(m));

  const clearRemote = () => {
    for (const id of remote) if (world.state.actors[id]) world.removeActor(id);
    remote.clear();
  };

  socket.addEventListener("open", () => events.emit("status", { connected: true }));
  socket.addEventListener("close", () => events.emit("status", { connected: false }));
  socket.addEventListener("message", (e: MessageEvent) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(String(e.data)) as ServerMessage;
    } catch {
      return;
    }
    switch (msg.t) {
      case "welcome":
        clearRemote();
        self = msg.you;
        for (const [id, a] of Object.entries(msg.actors)) {
          if (id === self || !isPlayerId(id)) continue;
          world.addActor(
            id,
            { name: a.name, sprite: a.sprite, speed: a.speed },
            { at: { x: a.x, y: a.y }, facing: a.facing, ...(a.level ? { level: a.level } : {}) },
          );
          remote.add(id);
        }
        break;
      case "joined":
        if (msg.id === self || !isPlayerId(msg.id)) break;
        world.addActor(
          msg.id,
          { name: msg.actor.name, sprite: msg.actor.sprite, speed: msg.actor.speed },
          { at: { x: msg.actor.x, y: msg.actor.y }, facing: msg.actor.facing, ...(msg.actor.level ? { level: msg.actor.level } : {}) },
        );
        remote.add(msg.id);
        break;
      case "left":
        if (world.state.actors[msg.id]) world.removeActor(msg.id);
        remote.delete(msg.id);
        break;
      case "moves":
        for (const [id, to] of Object.entries(msg.moves)) if (remote.has(id)) void world.walk(id, to);
        break;
      case "correct":
        world.place(world.player, msg.at);
        break;
      case "chat":
        events.emit("chat", { from: msg.from, name: msg.name, text: msg.text });
        break;
      case "error":
        events.emit("error", { message: msg.message });
        break;
    }
  });

  const offs = [
    world.events.on("walk", ({ actor, to }) => {
      if (actor === world.player) send({ t: "walk", to });
    }),
    world.events.on("roomChanged", () => {
      clearRemote();
      self = null;
      socket.updateProperties({ room: partyRoom() });
      socket.reconnect();
    }),
  ];

  return {
    socket,
    events,
    self: () => self,
    chat: (text) => send({ t: "chat", text }),
    close: () => {
      for (const off of offs) off();
      clearRemote();
      socket.close();
    },
  };
}
