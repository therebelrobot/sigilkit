import type { Facing, TilePos } from "../core/index";

/**
 * Wire protocol. v0 model: shared presence, local narrative.
 * The server owns where everyone is (pathfinding is re-run server-side, so
 * clients can't teleport); each client runs its own story and UI. Shared,
 * server-owned story state is a later layer (see docs/ARCHITECTURE.md).
 */
export type ClientMessage =
  | { t: "walk"; to: TilePos }
  | { t: "chat"; text: string };

export interface ActorSnapshot {
  x: number;
  y: number;
  facing: Facing;
  name: string;
  sprite: string;
  /** Tiles per second, so clients animate others at server speed. */
  speed: number;
}

export type ServerMessage =
  | { t: "welcome"; you: string; actors: Record<string, ActorSnapshot> }
  | { t: "joined"; id: string; actor: ActorSnapshot }
  | { t: "left"; id: string }
  /** Target tiles, not interpolated positions: clients animate locally. */
  | { t: "moves"; moves: Record<string, TilePos> }
  /** Authoritative correction when a client's own position drifted. */
  | { t: "correct"; at: TilePos }
  | { t: "chat"; from: string; name: string; text: string }
  | { t: "error"; message: string };

export interface Identity {
  id: string;
  name: string;
  /** Optional sprite key override (cosmetics, avatars). */
  sprite?: string;
}

export const IDENTITY_HEADER = "x-sigilkit-identity";
/** Server actor ids for players. Everything else (NPCs) is simulated locally by each client in v0. */
export const PLAYER_PREFIX = "p:";
export const isPlayerId = (id: string) => id.startsWith(PLAYER_PREFIX);
export const MAX_CHAT = 280;

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== "object") return null;
  const msg = m as Record<string, unknown>;
  if (msg.t === "walk") {
    const to = msg.to as Record<string, unknown> | undefined;
    if (to && Number.isInteger(to.x) && Number.isInteger(to.y)) return { t: "walk", to: { x: to.x as number, y: to.y as number } };
  }
  if (msg.t === "chat" && typeof msg.text === "string") {
    const text = msg.text.trim().slice(0, MAX_CHAT);
    if (text) return { t: "chat", text };
  }
  return null;
}
