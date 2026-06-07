import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const base = process.env.NODE_ENV === 'production' ? '/static/vite_dist/' : '/';

export default defineConfig({
  base,
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
    cssCodeSplit: true,
    minify: false,
    sourcemap: true,
    target: "esnext",
    modulePreload: false,
    rollupOptions: {
      treeshake: false,
      input: {
        ai_integration: "src/main.tsx",
      react_edit_question: "src/edit_question.tsx",
      react_edit_question_inline: "src/edit_question_inline.tsx",
      audio_command_system: "src/audio/audio_command_system.tsx",
      audio_quiz_entry: "src/audio/audio_quiz_entry.tsx",
      quiz_markdown: "src/QuizMarkdown.tsx",
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
