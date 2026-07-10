import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve:
    command === "serve"
      ? {
          alias: {
            "@kanushka/cell-diagram-react": resolve(
              __dirname,
              "../../packages/cell-diagram-react/src/index.ts"
            )
          }
        }
      : undefined,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    alias: {
      "@kanushka/cell-diagram-react": resolve(
        __dirname,
        "../../packages/cell-diagram-react/src/index.ts"
      )
    }
  }
}));
