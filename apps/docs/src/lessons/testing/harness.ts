/*
 * Just enough of Vitest's API (describe, it, expect) to run the lesson's tests
 * in the browser. In a project, import these from "vitest" instead.
 */

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  wallMs: number;
}

type TestFn = () => void | Promise<void>;
const registered: { name: string; fn: TestFn }[] = [];
let prefix = "";
let compiledStory = "";

export function describe(name: string, body: () => void): void {
  const outer = prefix;
  prefix = `${outer}${name} › `;
  body();
  prefix = outer;
}

export function it(name: string, fn: TestFn): void {
  registered.push({ name: prefix + name, fn });
}

/** The compiled Ink story the tests run against (Vitest would compile it with compileInk). */
export const story = () => compiledStory;

export function expect<T>(actual: T, label?: string) {
  const fail = (message: string) => {
    throw new Error(label ? `${label}: ${message}` : message);
  };
  const show = (value: unknown) => JSON.stringify(value);
  return {
    toBe(expected: T) {
      if (!Object.is(actual, expected)) fail(`expected ${show(actual)} to be ${show(expected)}`);
    },
    toEqual(expected: T) {
      if (show(actual) !== show(expected)) fail(`expected ${show(actual)} to equal ${show(expected)}`);
    },
    toContain(item: unknown) {
      if (!(actual as unknown[]).includes(item)) fail(`expected ${show(actual)} to contain ${show(item)}`);
    },
  };
}

/** Run every test registered so far against a compiled story. */
export async function runRegisteredTests(storyJson: string): Promise<TestResult[]> {
  compiledStory = storyJson;
  const results: TestResult[] = [];
  for (const test of registered) {
    const started = performance.now();
    try {
      await test.fn();
      results.push({ name: test.name, passed: true, wallMs: performance.now() - started });
    } catch (error) {
      results.push({ name: test.name, passed: false, error: error instanceof Error ? error.message : String(error), wallMs: performance.now() - started });
    }
  }
  return results;
}
