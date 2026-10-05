import { World, type GameDef, type WorldOptions } from "sigilkit";
import { InkRunner } from "sigilkit/story";
import { compileInkInBrowser } from "./compile-ink";

/**
 * The usual wiring, as in a game's main.ts: a World, an InkRunner over the
 * story, then start(). Errors from handlers go to the console and the
 * playground's event log.
 */
export async function startWorld(game: GameDef, inkSource?: string, options: WorldOptions = {}): Promise<World> {
  const world = new World(game, options);
  if (inkSource !== undefined) new InkRunner(world, await compileInkInBrowser(inkSource));
  world.events.on("error", ({ error, context }) => console.error(`[${context}]`, error));
  world.start();
  return world;
}

/** Walkmap rows from an editable text file: blank lines and // comments are ignored. */
export function walkmapRows(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.trim() !== "" && !line.trimStart().startsWith("//"));
}
