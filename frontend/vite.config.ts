import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    manifest: true,
    outDir: "../app/repz/static/vite_dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    minify: false,
    sourcemap: true,
    target: "esnext",
    modulePreload: false,
    rollupOptions: {
      treeshake: false,
      input: {
        ai_integration: "src/main.tsx",
        react_edit_question: "src/edit_question.tsx",
        audio_command_system: "src/audio/audio_command_system.tsx",
        audio_quiz_entry: "src/audio/audio_quiz_entry.tsx",
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
