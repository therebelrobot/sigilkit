import { useState } from "react";
import { compileInkInBrowser } from "../../engine/compile-ink";
import { startWorld } from "../../engine/session";
import { game } from "../items/game";
import story from "../items/story.ink?code";
import { defineLesson } from "../types";
import { runRegisteredTests, type TestResult } from "./harness";
import harnessSource from "./harness.ts?code";
// Registers its tests with the harness on import, as Vitest would collect them.
import "./greenhouse.test";
import prose from "./lesson.md";
import testSource from "./greenhouse.test.ts?code";

function testViewFor(storySource: string) {
  return function TestRunner() {
    const [results, setResults] = useState<TestResult[] | null>(null);
    const [running, setRunning] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const run = async () => {
      setRunning(true);
      setFailure(null);
      try {
        const compiled = await compileInkInBrowser(storySource);
        setResults(await runRegisteredTests(compiled));
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
      setRunning(false);
    };
    const passed = results?.filter((result) => result.passed).length ?? 0;
    return (
      <div className="test-runner">
        <div className="test-runner-head">
          <button type="button" className="button primary" onClick={() => void run()} disabled={running}>
            {running ? "Running…" : results ? "Run again" : "Run the tests"}
          </button>
          {results && (
            <span className={passed === results.length ? "test-summary pass" : "test-summary fail"}>
              {passed} of {results.length} passed
            </span>
          )}
        </div>
        {failure && <p className="test-error">{failure}</p>}
        <ol className="test-results">
          {(results ?? []).map((result) => (
            <li key={result.name} data-passed={result.passed}>
              <span className="test-mark" aria-label={result.passed ? "passed" : "failed"}>
                {result.passed ? "✓" : "✗"}
              </span>
              <span className="test-name">{result.name}</span>
              <span className="test-time">{result.wallMs.toFixed(0)} ms</span>
              {result.error && <span className="test-error">{result.error}</span>}
            </li>
          ))}
          {!results && <li className="muted">Five tests that play the Items lesson's greenhouse in code. No renderer, no DOM.</li>}
        </ol>
      </div>
    );
  };
}

export default defineLesson({
  prose,
  files: [
    { name: "greenhouse.test.ts", language: "ts", file: testSource },
    { name: "story.ink", language: "ink", file: story, editable: true },
    { name: "harness.ts", language: "ts", file: harnessSource },
  ],
  start: async (sources) => ({ world: await startWorld(game, sources["story.ink"]), view: testViewFor(sources["story.ink"]!) }),
});
