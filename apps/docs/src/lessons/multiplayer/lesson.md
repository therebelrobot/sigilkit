# Shared presence

sigilkit has an optional multiplayer layer for **shared presence**: several players in the same room, seeing each other walk around, while each one plays their own story. It runs on Cloudflare's PartyServer, which needs a server, and this site is static. So this lesson runs the same model inside the page: two players' worlds side by side, joined by a small stand-in for the server.

Click to walk in **Alex's** pane, and Alex walks in **Sam's** too, a moment later. Then walk Sam. Each pane is a separate `World`, like two browsers. They stay in step only because walks are passed between them.

## The model: shared presence, local narrative

- **The server owns positions.** It runs the same `World` class, with `spawnPlayer: false`, and one actor per connected player.
- **Clients send intents.** When you click, your world starts walking straight away (prediction) and sends `{ t: "walk", to }`. The server pathfinds that walk itself, so walls and teleports are impossible, and broadcasts the target.
- **Clients animate others locally.** Other players are ordinary actors in your world (`p:<id>`), walking to the targets the server sends. Only target tiles go over the wire, not a position every frame.
- **Story stays local.** Dialog, NPCs and puzzles run per client. Two players can talk to the same NPC at once without interfering.

**local-server.ts** is that loop with the network replaced by `setTimeout`.

## The real thing

The Worker hosts one Durable Object per game room:

```ts
// worker.ts
import { createPartyHandler, createRoomServer, guestVerifier } from "sigilkit/net/server";
import { game } from "./game"; // the same content file the browser uses

export const Rooms = createRoomServer(game);
const route = createPartyHandler(guestVerifier); // Better Auth in production

export default {
  fetch: async (request: Request, env: Env) => (await route(request, env)) ?? new Response("Not found", { status: 404 }),
};
```

The browser connects with one call. It follows room changes and reconnects by itself:

```ts
import { connect } from "sigilkit/net/client";

const net = connect(world, { host: "game.example.com", query: async () => ({ token: await getToken() }) });
net.events.on("chat", ({ name, text }) => showChat(name, text));
net.chat("hello!");
```

This is why game content must stay free of DOM and asset imports: the server imports the same `game` object. The repository's `apps/party` is a working Worker for the demo game.

## Auth

`createPartyHandler(verify)` checks every connection before it reaches a room. `betterAuthVerifier(auth)` works with Better Auth in the same Worker, and `betterAuthRemoteVerifier(url)` with a separate auth service. Browsers can't set headers on WebSockets, so a `?token=` from Better Auth's bearer plugin is promoted to an `Authorization` header. `guestVerifier` is for local development only.

## What's shared, and what's next

In this version, flags are per client, so a door one player opens stays shut for everyone else. The layers that change that are described in [Multiplayer](/docs/multiplayer): server-owned shared flags, server-run handlers for shared puzzles, and persistence in the Durable Object's storage.

## What you learned

- Multiplayer in sigilkit is shared presence: the server owns positions, and story stays local.
- Clients send walk intents, the server re-pathfinds, and others animate from target tiles.
- `createRoomServer` and `connect` are the two halves, and both use the same game content.
