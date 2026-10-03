import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["sigilkit-source"],
  },
  ssr: {
    resolve: {
      conditions: ["sigilkit-source"],
    },
  },
  test: {
    include: ["packages/sigilkit/test/**/*.test.ts"],
    environment: "node",
  },
});
