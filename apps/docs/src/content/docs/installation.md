# Installation

sigilkit is one package on npm. Install it with the peers for the modules you'll use. For a typical browser game with React, Pixi rendering and Ink, that's:

```sh
npm install sigilkit pixi.js react react-dom inkjs
```

| You use | Also install |
| --- | --- |
| `sigilkit` (core) | nothing |
| `sigilkit/pixi` | `pixi.js` (v8) |
| `sigilkit/react` | `react`, `react-dom` (v19) |
| `sigilkit/story` | `inkjs` |
| `sigilkit/story/vite` | `vite` (you probably have it) |
| `sigilkit/input`, `sigilkit/audio` | nothing |
| `sigilkit/net/server` | `partyserver` |
| `sigilkit/net/client` | `partysocket` |

All peers are optional. A game that never imports `sigilkit/net/server` never needs `partyserver`.

## The grid-engine and Phaser shim

Movement and pathfinding come from [grid-engine](https://github.com/Annoraaq/grid-engine). It imports `phaser` when it loads, even in headless use, only to read one enum. Left alone, that pulls all of Phaser into your bundle, and it crashes in Cloudflare Workers. Until the import is made lazy upstream, give your app a two-line stand-in package named `phaser`:

```jsonc
// package.json
"dependencies": { "phaser": "file:./vendor/phaser-shim" }
```

```js
// vendor/phaser-shim/index.js
export const Tilemaps = { Orientation: { ORTHOGONAL: 0, ISOMETRIC: 1, STAGGERED: 2, HEXAGONAL: 3 } };
```

```json
// vendor/phaser-shim/package.json
{ "name": "phaser", "version": "4.0.0", "type": "module", "main": "index.js" }
```

Run `npm install` again after adding it. This also satisfies grid-engine's peer dependency.

> [!NOTE]
> If you'd rather not vendor files, npm `overrides` can point `phaser` at a published copy of the same shim. The sigilkit repository keeps one at `packages/phaser-shim`.

## Vite

Add the Ink plugin so `.ink` files import as compiled stories, with compile errors shown in the dev overlay:

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { ink } from "sigilkit/story/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), ink()],
});
```

Tell TypeScript what an `.ink` import is:

```ts
// src/env.d.ts
declare module "*.ink" {
  const json: string;
  export default json;
}
```

`INCLUDE` lines in Ink are resolved relative to the importing file and are watched for changes.

Not using Vite? Compile Ink with inklecate or Inky and pass the JSON to `InkRunner`, or call `compileInk(source)` from `sigilkit/story/vite` in your own build step. It's plain Node.

## TypeScript

sigilkit ships ESM with type declarations. It's written for `moduleResolution: "bundler"` (or `"node16"`/`"nodenext"`) and strict mode. No `@types` packages are needed.

## Styles

`sigilkit/react` components are unstyled apart from layout essentials. Import the default look once:

```ts
import "sigilkit/react/styles.css";
```

See [React UI](/docs/react#styling) for theming it.

## Requirements

- A browser with WebGL (for `sigilkit/pixi`) and Web Audio (for `sigilkit/audio`). That's every current desktop and mobile browser.
- Node 24 or later for tooling.
- The core has no runtime requirements beyond ES2023, so it runs in Workers, Deno and Bun as well.

Next: the [Quick start](/docs/quick-start).
