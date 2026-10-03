import { defineConfig } from "tsdown";

// One entry per subpath export; output mirrors src/ so dist/<module>/index.js lines up with package.json.
export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "story/index": "src/story/index.ts",
    "story/vite": "src/story/vite.ts",
    "audio/index": "src/audio/index.ts",
    "input/index": "src/input/index.ts",
    "pixi/index": "src/pixi/index.ts",
    "react/index": "src/react/index.tsx",
    "net/index": "src/net/index.ts",
    "net/server": "src/net/server.ts",
    "net/client": "src/net/client.ts",
  },
  format: "esm",
  platform: "neutral",
  // Node built-ins are only used by the Vite plugin (story/vite), which runs in Node.
  external: [/^node:/],
  dts: true,
  sourcemap: true,
  clean: true,
  fixedExtension: false,
});
