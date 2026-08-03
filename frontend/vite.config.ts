import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const base = process.env.NODE_ENV === "production" ? "/static/vite_dist/" : "/";

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
        ai_integration: "src/entrypoints/AiIntegration.entry.tsx",
        edit_question: "src/entrypoints/EditQuestion.entry.tsx",
        edit_questions_page: "src/entrypoints/EditQuestions.entry.tsx",
        audio_quiz_entry: "src/entrypoints/AudioQuiz.entry.tsx",
        quiz_markdown: "src/entrypoints/QuizMarkdown.entry.tsx",
        add_content: "src/entrypoints/AddContent.entry.tsx",
        ai_question_generator: "src/entrypoints/AiQuestionGenerator.entry.tsx",
      },
    },
  },
  server: {
    origin: "http://localhost:5173",
    cors: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
});
