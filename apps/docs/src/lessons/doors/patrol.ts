import type { World } from "sigilkit";

/**
 * Moth walks back and forth between the two halves of the cellar. Nothing
 * here knows about doors: when one shuts mid-walk, the walk re-plans by
 * itself, going round if there's another way or stopping as close as it can.
 */
export function startPatrol(world: World): () => void {
  let patrolling = true;
  const route = [
    { x: 16, y: 5 },
    { x: 3, y: 5 },
  ];
  void (async () => {
    for (let leg = 0; patrolling; leg++) {
      await world.walk("moth", route[leg % route.length]!);
      // Pause between legs (and avoid spinning when there's no way through).
      await world.wait(500);
    }
  })();
  return () => {
    patrolling = false;
  };
}
