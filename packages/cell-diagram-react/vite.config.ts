import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

// Externalize React and every declared runtime/peer dependency so the
// consumer's bundler resolves them as ESM. Bundling them inlines CJS
// transitive deps (e.g. use-sync-external-store's `require("react")`),
// which throws `Dynamic require of "react" is not supported` in Vite.
const escapeRe = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const asExternal = (name: string) => new RegExp(`^${escapeRe(name)}($|\\/)`);

const external = [
  asExternal("react"),
  asExternal("react-dom"),
  ...Object.keys(pkg.dependencies ?? {}).map(asExternal),
  ...Object.keys(pkg.peerDependencies ?? {}).map(asExternal)
];

export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: "./tsconfig.json", include: ["src"] })],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
      cssFileName: "style"
    },
    rollupOptions: {
      external
    },
    cssCodeSplit: false
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
