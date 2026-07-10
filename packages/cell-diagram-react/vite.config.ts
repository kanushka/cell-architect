import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: "./tsconfig.json", include: ["src"] })],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js"
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"]
    },
    cssCodeSplit: false
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
