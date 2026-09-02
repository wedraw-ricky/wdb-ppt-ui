import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Build straight into the Flask static tree. Filenames are fixed (no hash) so
// static/index.html can reference them without a manifest step, and the bundle
// is committed so the page works offline with no npm install.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/static/app/",
  build: {
    outDir: "../static/app",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "confirm.js",
        chunkFileNames: "confirm-[name].js",
        assetFileNames: "confirm.[ext]",
      },
    },
  },
});
