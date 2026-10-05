import { World, type ActorDef } from "sigilkit";

export interface LocalPlayer {
  /** This player's own world: what their browser runs. */
  world: World;
  id: string;
  actor: ActorDef;
}

/**
 * What sigilkit/net does over WebSockets, in one page: a server World owns
 * everyone's position, clients send walk *intents*, and the server re-runs
 * pathfinding before telling the others where each player is headed.
 */
export function shareRoom(server: World, players: LocalPlayer[], latencyMs = 120): () => void {
  const remoteId = (player: LocalPlayer) => `p:${player.id}`;
  const later = (fn: () => void) => setTimeout(fn, latencyMs);

  // Join: the server and every other client get an actor for each player.
  for (const player of players) {
    const at = { at: player.world.tileOf(player.world.player) };
    server.addActor(remoteId(player), player.actor, at);
    for (const other of players) if (other !== player) other.world.addActor(remoteId(player), player.actor, at);
  }

  const stops = players.map((player) =>
    // Every walk the player starts is an intent sent "up" to the server.
    player.world.events.on("walk", ({ actor, to }) => {
      if (actor !== player.world.player) return;
      later(() => {
        // The server pathfinds for real (walls and teleports are impossible)...
        void server.walk(remoteId(player), to);
        // ...and broadcasts the target; each client animates the move itself.
        later(() => {
          for (const other of players) if (other !== player) void other.world.walk(remoteId(player), to);
        });
      });
    }),
  );

  // The server ticks at 20 Hz, like RoomServer.
  const tick = setInterval(() => server.update(50), 50);
  return () => {
    clearInterval(tick);
    stops.forEach((stop) => stop());
  };
}
