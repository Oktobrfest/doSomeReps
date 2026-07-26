import { useState, useEffect } from "react";

import { QuestionEditor } from "./QuestionEditor";


export function InlineQuestionEditor() {
  const [questionId, setQuestionId] = useState<number | null>(null);

  useEffect(() => {
    // Listen for the custom event from the global function
    const handleSetQuestionId = (event: Event) => {
      const customEvent = event as CustomEvent<{ id: number | null }>;
      if (customEvent.detail && typeof customEvent.detail.id === 'number') {
        setQuestionId(customEvent.detail.id);
      } else if (customEvent.detail && customEvent.detail.id === null) {
        setQuestionId(null);
      }
    };

    window.addEventListener('setEditQuestionId', handleSetQuestionId as EventListener);

    return () => {
      window.removeEventListener('setEditQuestionId', handleSetQuestionId as EventListener);
    };
  }, []);

  const handleDeleted = () => {
    // After deletion, clear the selection
    setQuestionId(null);
    // Trigger a refresh of the search results list
    // by dispatching a custom event that the index.js can listen to
    window.dispatchEvent(new CustomEvent('questionDeleted'));
  };

  const handleClose = () => {
    // Clear the selection without saving
    setQuestionId(null);
  };

  const handleSaved = () => {
    // Trigger a refresh of the search results after saving
    window.dispatchEvent(new CustomEvent('questionSaved'));
  };

  return (
    <QuestionEditor
      questionId={questionId}
      onDeleted={handleDeleted}
      onSaved={handleSaved}
      onClose={handleClose}
    />
  );
}