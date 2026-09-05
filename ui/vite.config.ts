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
        // 스타일시트는 index.html 이 이름을 박아 쓰므로 confirm.css 로 고정.
        // 그림은 제 이름을 지킨다 — 한 이름에 몰아넣으면 Vite 가 confirm2 ·
        // confirm3 처럼 번호를 붙이고, 나중에 한 장 더 넣는 순간 번호가 밀려
        // 엉뚱한 그림이 나온다.
        assetFileNames: (info) =>
          info.names?.[0]?.endsWith(".css") ? "confirm.css" : "confirm-[name].[ext]",
      },
    },
  },
});
