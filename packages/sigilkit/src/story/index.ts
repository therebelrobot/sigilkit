import type { ScriptContext, ScriptRunner, World } from "../core/index";
import { Story } from "inkjs";

export interface InkRunnerOptions {
  /** Lines starting with this run as engine commands. Default ">>>". */
  commandPrefix?: string;
  /** Mirror Ink global variables <-> world flags. Default true. */
  syncFlags?: boolean;
  /** Map a "Name:" prefix to an actor id. Default: actor id or display name, case-insensitive. */
  resolveSpeaker?: (name: string) => string | null;
}

/** Compiled Ink: the JSON from inklecate/Inky, or what the Vite plugin produces. */
export type InkJson = string | Record<string, unknown>;

/**
 * Runs Ink knots as hotspot/actor handlers.
 *
 * Authoring conventions inside a knot:
 *   Moth: The lamp's been out for days.        -> a spoken line by actor "moth"
 *   >>> walk hero 4 6                          -> engine command (awaited)
 *   * [Ask about the lamp] ...                 -> choices go to the UI
 *   {has_item("oil"): ...}                     -> external functions read the world
 *   ~ door_open = true                         -> globals mirror world flags
 * Lines without a speaker prefix are narration (speaker null).
 */
export class InkRunner implements ScriptRunner {
  readonly story: Story;
  #world: World;
  #prefix: string;
  #resolveSpeaker: (name: string) => string | null;
  #ctx: ScriptContext | null = null;

  constructor(world: World, json: InkJson, options: InkRunnerOptions = {}) {
    this.#world = world;
    this.story = new Story(typeof json === "string" ? json : JSON.stringify(json));
    this.#prefix = options.commandPrefix ?? ">>>";
    this.#resolveSpeaker = options.resolveSpeaker ?? ((name) => this.#defaultSpeaker(name));

    const bind = (name: string, fn: (...args: never[]) => unknown) =>
      this.story.BindExternalFunction(name, fn as never, true);
    bind("has_item", (id: string) => world.has(id));
    bind("flag", (name: string) => world.flag(name) ?? false);
    bind("target", () => this.#ctx?.target ?? "");
    bind("verb", () => this.#ctx?.verb ?? "");
    bind("held_item", () => this.#ctx?.item ?? "");

    if (options.syncFlags ?? true) this.#syncFlags();
    world.useScriptRunner(this);
  }

  async run(path: string, ctx: ScriptContext): Promise<void> {
    this.#ctx = ctx;
    try {
      this.story.ChoosePathString(path);
      for (;;) {
        while (this.story.canContinue) {
          const raw = this.story.Continue() ?? "";
          const tags = this.story.currentTags ?? [];
          await this.#line(raw.trim(), tags);
        }
        const choices = this.story.currentChoices;
        if (!choices.length) break;
        const i = await this.#world.ask(choices.map((c) => ({ index: c.index, text: c.text })));
        this.story.ChooseChoiceIndex(i);
      }
    } finally {
      this.#ctx = null;
    }
  }

  save(): string {
    return this.story.state.ToJson();
  }

  load(blob: string): void {
    this.story.state.LoadJson(blob);
  }

  async #line(line: string, tags: string[]): Promise<void> {
    if (!line) return;
    if (line.startsWith(this.#prefix)) {
      await this.#world.command(line.slice(this.#prefix.length));
      return;
    }
    const m = /^([^:\s][^:]{0,40}):\s+(.+)$/.exec(line);
    const speaker = m ? this.#resolveSpeaker(m[1]!.trim()) : null;
    // Only treat "X:" as a speaker if X is a known actor, so "Note: ..." stays narration.
    if (m && speaker) await this.#world.say(speaker, m[2]!, tags);
    else await this.#world.say(null, line, tags);
  }

  #defaultSpeaker(name: string): string | null {
    const lower = name.toLowerCase();
    for (const [id, def] of Object.entries(this.#world.game.actors)) {
      if (id.toLowerCase() === lower || def.name.toLowerCase() === lower) return id;
    }
    return null;
  }

  #syncFlags(): void {
    const vars = this.story.variablesState as unknown as Record<string, unknown> & {
      GetVariableWithName(name: string): unknown;
      ObserveVariableChange(cb: (name: string, value: unknown) => void): void;
    };
    // World -> Ink, for globals the story declares.
    this.#world.events.on("flag", ({ name, value }) => {
      if (vars.GetVariableWithName(name) !== null && vars[name] !== value) vars[name] = value;
    });
    // Ink -> World. Ink hands back runtime value objects; unwrap to plain values.
    vars.ObserveVariableChange((name, value) => {
      const plain = (value as { value?: unknown })?.value ?? value;
      if (typeof plain === "string" || typeof plain === "number" || typeof plain === "boolean")
        this.#world.setFlag(name, plain);
    });
    // Seed Ink from flags the game already has.
    for (const [name, value] of Object.entries(this.#world.state.flags)) {
      if (vars.GetVariableWithName(name) !== null) vars[name] = value;
    }
  }
}
