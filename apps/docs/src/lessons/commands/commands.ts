import type { World } from "sigilkit";

/** Two commands of our own, usable as `>>> blink moth 3` and `>>> stroll wren 8 6`. */
export function addCommands(world: World): void {
  // blink <actor> [times]: flicker an actor. It's async, so the story waits for it.
  world.commands.set("blink", async ([actor, times = "3"], w) => {
    for (let flicker = 0; flicker < Number(times); flicker++) {
      w.setVisible(actor!, false);
      await w.wait(120); // world time, not wall time
      w.setVisible(actor!, true);
      await w.wait(120);
    }
  });

  // stroll <actor> <x> <y>: start walking and carry on straight away.
  // The built-in walk waits for arrival; this returns without waiting.
  world.commands.set("stroll", ([actor, x, y], w) => {
    void w.walk(actor!, { x: Number(x), y: Number(y) });
  });
}
