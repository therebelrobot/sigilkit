import { World } from "sigilkit";
import { GameProvider, Stage } from "sigilkit/react";
import { placeholderActors } from "../../engine/actors";
import { defineLesson } from "../types";
import { gameFor } from "./game";
import gameSource from "./game.ts?code";
import prose from "./lesson.md";
import { shareRoom, type LocalPlayer } from "./local-server";
import serverSource from "./local-server.ts?code";

function playerWorld(entry: "west" | "east", color: string): World {
  const world = new World(gameFor(entry, color));
  world.start();
  return world;
}

export default defineLesson({
  prose,
  files: [
    { name: "local-server.ts", language: "ts", file: serverSource },
    { name: "game.ts", language: "ts", file: gameSource },
  ],
  start: () => {
    const alex: LocalPlayer = { world: playerWorld("west", "#f3d27a"), id: "alex", actor: { name: "Alex", sprite: "player", speed: 5, color: "#f3d27a" } };
    const sam: LocalPlayer = { world: playerWorld("east", "#9fe0d4"), id: "sam", actor: { name: "Sam", sprite: "player", speed: 5, color: "#9fe0d4" } };
    // The server pins one room and spawns no player of its own.
    const server = new World(gameFor("west", "#ffffff"), { spawnPlayer: false });
    server.start();
    const stop = shareRoom(server, [alex, sam]);

    const Pane = ({ player, label }: { player: LocalPlayer; label: string }) => (
      <GameProvider world={player.world}>
        <figure className="mp-pane">
          <figcaption>
            <span className="mp-swatch" style={{ background: player.actor.color }} /> {label}
          </figcaption>
          <div className="mp-stage">
            <Stage actors={placeholderActors(player.world)} background={0x070c0b} />
          </div>
        </figure>
      </GameProvider>
    );

    return {
      world: alex.world,
      view: () => (
        <div className="mp-split">
          <Pane player={alex} label="Alex's browser" />
          <Pane player={sam} label="Sam's browser" />
        </div>
      ),
      dispose: stop,
    };
  },
});
