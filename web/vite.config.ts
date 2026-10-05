import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // CSP font-src 'self' blocks data: URIs, so fonts must never be inlined.
    assetsInlineLimit: (file) => (file.endsWith(".woff2") ? false : undefined),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
