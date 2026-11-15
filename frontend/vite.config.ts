<<<<<<< HEAD
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
=======
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
>>>>>>> a804f1cf32df6f271aa4a3cc0ef26efa7f0d33b8

export default defineConfig({
<<<<<<< HEAD
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: [".."] } },
  // Three.js is isolated in a lazy-loaded renderer chunk; 130 KB gzip is within budget.
  build: { chunkSizeWarningLimit: 550 },
});
=======
  plugins: [react()],
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        fileURLToPath(new URL('../engine/pkg', import.meta.url)),
      ],
    },
  },
})
>>>>>>> a804f1cf32df6f271aa4a3cc0ef26efa7f0d33b8
