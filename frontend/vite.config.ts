import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
  manifest: true,
  outDir: "../app/repz/static/vite_dist",
  emptyOutDir: true,
  rollupOptions: {
    input: {
      ai_integration: "src/main.tsx",
      react_edit_question: "src/edit_question.tsx",
      audio_command_system: "src/audio/audio_command_system.tsx",
    },
  },
},
  server: {
    origin: "http://localhost:5173",
    cors: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: {
       'Cross-Origin-Opener-Policy': 'same-origin',
       'Cross-Origin-Embedder-Policy': 'credentialless',
     },
  },
});
