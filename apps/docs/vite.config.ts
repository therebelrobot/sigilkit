import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { markdown } from "./plugins/markdown";
import { staticPages } from "./plugins/static-pages";
import { STATIC_ROUTES } from "./src/site";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves a project site under /<repo>/. Override with DOCS_BASE for a custom domain ("/").
  base: process.env.DOCS_BASE ?? (command === "build" ? "/sigilkit/" : "/"),
  plugins: [markdown(), react(), staticPages(STATIC_ROUTES)],
  resolve: {
    // Use the engine's TypeScript source directly, like the demo.
    conditions: ["sigilkit-source"],
  },
  server: { fs: { allow: ["../.."] } },
  build: { chunkSizeWarningLimit: 1200 },
}));
