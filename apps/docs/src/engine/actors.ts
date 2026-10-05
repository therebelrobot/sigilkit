import type { World } from "sigilkit";
import { placeholderActor, type ActorFactory } from "sigilkit/pixi";

/** Placeholder art for every lesson: each actor in its `color`, smaller if `height` says so. */
export function placeholderActors(world: World): ActorFactory {
  return (_sprite, actorId) => {
    const definition = world.game.actors[actorId];
    const color = definition?.color ? Number.parseInt(definition.color.replace("#", ""), 16) : hashColor(actorId);
    const tileHeight = world.room?.tile.height ?? 16;
    const size = definition?.height !== undefined && definition.height < tileHeight * 2 ? 10 : 14;
    return placeholderActor(color, size);
  };
}

function hashColor(text: string): number {
  let hash = 0;
  for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return (hash & 0x7f7f7f) | 0x404040;
}
