import { createRoot } from 'react-dom/client';
import { AudioQuiz } from '../audio/AudioQuiz';
import type { AudioQuizProps } from '../audio/types';
import "../styles/global.css";

// Jinja passes data via:
//   <script id="audio-quiz-data" type="application/json">{{ data | tojson }}</script>
//   <div id="audio-quiz-root"></div>

function mount() {
  const root = document.getElementById('audio-quiz-root');
  const dataEl = document.getElementById('audio-quiz-data');
  if (!root || !dataEl) return;

  const props: AudioQuizProps = JSON.parse(dataEl.textContent || '{}');
  createRoot(root).render(<AudioQuiz {...props} />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}