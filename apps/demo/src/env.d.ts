/// <reference types="vite/client" />

declare module "*.ink" {
  /** Compiled Ink JSON, produced by sigilkit/story/vite. */
  const json: string;
  export default json;
}
