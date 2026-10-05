# Multiplayer

The optional `sigilkit/net` modules add **shared presence**: players in the same room see each other and walk around together, while each runs their own story. It's built on [PartyServer](https://github.com/cloudflare/partykit/tree/main/packages/partyserver) (Cloudflare Durable Objects) and [partysocket](https://www.npmjs.com/package/partysocket).

| Import | For | Peer |
| --- | --- | --- |
| `sigilkit/net` | Protocol types and auth verifiers, safe anywhere | — |
| `sigilkit/net/server` | `RoomServer`, `createRoomServer`, `createPartyHandler` | `partyserver` |
| `sigilkit/net/client` | `connect(world, options)` | `partysocket` |

The [Shared presence](/learn/multiplayer) lesson simulates the model in the browser.

## Architecture

```
browser ──ws──► Worker fetch ──► createPartyHandler(verify)
                                  │ verify(request) -> Identity | 401
                                  │ stamps x-sigilkit-identity (client copies are stripped)
                                  ▼
                        Durable Object per game room ("greenhouse", or "eu1~greenhouse" for shards)
                        RoomServer: World(room, spawnPlayer: false), 20 Hz tick
```

- **The server owns positions.** Each Durable Object runs a `World` for one room. Clients send walk intents, and the server re-runs pathfinding, so walls and teleports are impossible, then broadcasts target tiles.
- **Clients animate others locally** from those targets, and predict their own movement. The server corrects a client only if its walk genuinely failed.
- **Story stays local.** Dialog, NPCs and puzzles run per client. Two players can talk to the same NPC at once.
- **Changing rooms reconnects** to that room's Durable Object.

## Server

```ts
// worker.ts
import { createPartyHandler, createRoomServer, guestVerifier } from "sigilkit/net/server";
import { game } from "./game";

/** One Durable Object class; the name must match the binding in wrangler config. */
export const Rooms = createRoomServer(game, { tickMs: 50, rateLimit: 12 });

const route = createPartyHandler(guestVerifier);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await route(request, env)) ?? new Response("Not found", { status: 404 });
  },
};
```

```jsonc
// wrangler.jsonc
{
  "main": "src/worker.ts",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": { "bindings": [{ "name": "Rooms", "class_name": "Rooms" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Rooms"] }]
}
```

`RoomServerOptions`: `playerSprite` (default: the single-player actor's sprite), `tickMs` (default 50, so 20 Hz), and `rateLimit` (messages per second per connection, default 12). To extend the protocol, subclass `RoomServer` (`static override game = game`) and override its handlers, calling `super` to keep movement and chat.

The server imports your game file, which is why content must stay free of DOM code and asset imports. Remember the [Phaser shim](/docs/installation#the-grid-engine-and-phaser-shim): without it, Workers crash on load.

## Client

```ts
import { connect } from "sigilkit/net/client";

const net = connect(world, {
  host: "game.example.com",       // or "localhost:8787" with wrangler dev
  party: "rooms",                 // the binding in kebab-case; default "rooms"
  instance: "eu1",                // optional shard: players in other instances don't see you
  query: async () => ({ token: await auth.getToken() }),
});

net.events.on("status", ({ connected }) => …);
net.events.on("chat", ({ from, name, text }) => …);
net.chat("hello!");
net.self();  // your actor id on the server
net.close();
```

Other players appear as actors with ids starting `p:` (`isPlayerId(id)`), added and removed with the world's `addActor`/`removeActor`.

## Auth

`createPartyHandler(verify)` authenticates every connection before it reaches a room. A verifier is `(request) => Promise<Identity | null>`, where `Identity` is `{ id, name, sprite? }`. Returning `null` rejects with 401.

| Verifier | Use |
| --- | --- |
| `betterAuthVerifier(auth)` | [Better Auth](https://www.better-auth.com/) running in the same Worker |
| `betterAuthRemoteVerifier(url, basePath?)` | Better Auth on another service (calls its `get-session`) |
| `guestVerifier` | Development only: anyone joins with a `?guest=` id |

Browsers can't set headers on WebSockets, so a `?token=` from Better Auth's bearer plugin is promoted to an `Authorization` header. Same-origin cookie sessions work without it. The verified identity is stamped onto the request in `x-sigilkit-identity`, and any copy a client sends is stripped.

## Protocol

| Up (client → server) | |
| --- | --- |
| `{ t: "walk", to: { x, y, level? } }` | Walk intent |
| `{ t: "chat", text }` | Chat, up to 280 characters |

| Down (server → client) | |
| --- | --- |
| `welcome` | Your id and everyone present |
| `joined` / `left` | A player arrived or left |
| `moves` | Target tiles by actor id |
| `correct` | Your authoritative position, after a failed walk |
| `chat` | A chat message |
| `error` | A rejected message |

Messages are validated (`parseClientMessage`) and rate-limited per connection. A second connection with the same identity replaces the first.

## Beyond shared presence

These are the layers to add when a game needs them:

1. **Server-owned shared flags.** A `RoomServer` subclass handles a `flag` message, validates it and broadcasts it, so a door one player opens is open for everyone.
2. **Server-run handlers.** Run selected hotspot handlers on the server (the `World` is already there) for shared puzzles and anti-cheat.
3. **Persistence.** The Durable Object's SQLite (`this.sql`) for per-room state, keyed by Better Auth's user id for saves.

## Local development

The repository's `apps/party` hosts the demo game: run `npm run dev:party`, then open the demo with `?party=localhost:8787` in two tabs.
