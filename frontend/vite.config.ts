import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    outDir: "../app/repz/static/vite_dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        ai_integration: "src/main.tsx",
      },
    },
  },
  server: {
    origin: "http://localhost:5173",
    cors: true,
  },
});
