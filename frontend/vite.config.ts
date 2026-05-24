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
      react_edit_question: "src/edit_question.tsx",
      audio_command_system: "src/audio_command_system.tsx",
    },
  },
},
  server: {
    origin: "http://localhost:5173",
    cors: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
