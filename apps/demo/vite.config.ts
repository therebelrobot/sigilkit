import { ink } from "sigilkit/story/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), ink()],
  resolve: {
    // Use workspace packages' TypeScript source directly; no build step while developing.
    conditions: ["sigilkit-source"],
  },
  ssr: { resolve: { conditions: ["sigilkit-source"] } },
});
