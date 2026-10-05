/**
 * Compile Ink source in the browser, for the lesson editors. The compiler is
 * large, so it loads on first use. (A game would compile at build time with
 * `ink()` from sigilkit/story/vite instead.)
 */
export async function compileInkInBrowser(source: string): Promise<string> {
  const { Compiler, CompilerOptions } = await import("inkjs/full");
  const errors: string[] = [];
  const options = new CompilerOptions(null, [], false, (message: string, type: number) => {
    // type 2 is an error in inkjs's ErrorType enum; warnings and TODOs pass.
    if (type === 2) errors.push(message);
  });
  const compiler = new Compiler(source, options);
  let json: string | undefined;
  try {
    json = compiler.Compile()?.ToJson() ?? undefined;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  const all = [...new Set([...errors, ...compiler.errors])];
  if (all.length || !json) throw new InkCompileError(all.length ? all : ["The story didn't compile."]);
  return json;
}

export class InkCompileError extends Error {
  readonly messages: string[];
  constructor(messages: string[]) {
    super(messages.join("\n"));
    this.messages = messages;
  }
}
