import { createRoot } from 'react-dom/client';
import { QuizPage } from '../quiz/QuizPage';
import type { QuizPageProps } from '../quiz/types';
import "../styles/global.css";

// Jinja passes data via:
//   <script id="quiz-data" type="application/json">{{ data | tojson }}</script>
//   <div id="quiz-root"></div>

function mount() {
  const root = document.getElementById('quiz-root');
  const dataEl = document.getElementById('quiz-data');
  if (!root || !dataEl) return;

  const props: QuizPageProps = JSON.parse(dataEl.textContent || '{}');
  createRoot(root).render(<QuizPage {...props} />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
