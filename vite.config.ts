import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@sample": path.resolve(import.meta.dirname, "src/sample/index.ts"),
    },
  },
  base: "./",
  server: { host: "127.0.0.1", port: 1462, strictPort: true },
  build: { target: "es2022" },
});
