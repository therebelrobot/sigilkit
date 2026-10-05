import { useWorld } from "sigilkit/react";
import { useState } from "react";
import { startWorld } from "../../engine/session";
import { defineLesson } from "../types";
import { addCommands } from "./commands";
import commandsSource from "./commands.ts?code";
import { game } from "./game";
import gameSource from "./game.ts?code";
import prose from "./lesson.md";
import story from "./story.ink?code";

const EXAMPLES = ["walk wren 16 8", "face wren left", 'say moth "Beep."', "blink moth 4", "stroll moth 3 8"];

/** A command line under the demo: anything a story's >>> line can do. */
function CommandPrompt() {
  const world = useWorld();
  const [line, setLine] = useState("walk wren 16 8");
  const [result, setResult] = useState("");
  const run = (commandLine: string) => {
    setResult(`>>> ${commandLine}`);
    world.command(commandLine).then(
      () => setResult(`>>> ${commandLine}  ✓ done`),
      (error: unknown) => setResult(`>>> ${commandLine}  ✗ ${error instanceof Error ? error.message : String(error)}`),
    );
  };
  return (
    <>
      <form
        className="command-prompt"
        onSubmit={(event) => {
          event.preventDefault();
          run(line);
        }}
      >
        <label>
          <span>&gt;&gt;&gt;</span>
          <input value={line} onChange={(event) => setLine(event.target.value)} aria-label="Command" spellCheck={false} />
        </label>
        <button type="submit">Run command</button>
      </form>
      {EXAMPLES.map((example) => (
        <button type="button" key={example} onClick={() => (setLine(example), run(example))}>
          {example}
        </button>
      ))}
      <output>{result}</output>
    </>
  );
}

export default defineLesson({
  prose,
  files: [
    { name: "story.ink", language: "ink", file: story, editable: true },
    { name: "commands.ts", language: "ts", file: commandsSource },
    { name: "game.ts", language: "ts", file: gameSource },
  ],
  start: async (sources) => {
    const world = await startWorld(game, sources["story.ink"]);
    addCommands(world);
    return { world, controls: CommandPrompt };
  },
});
