import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: [".."] } },
  // Three.js is isolated in a lazy-loaded renderer chunk; 130 KB gzip is within budget.
  build: { chunkSizeWarningLimit: 550 },
});
