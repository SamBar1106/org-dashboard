import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(root, "..");

export default defineConfig({
  plugins: [react()],
  base: "/org-dashboard/",
  server: { fs: { allow: [repoRoot] } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets/floor",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
