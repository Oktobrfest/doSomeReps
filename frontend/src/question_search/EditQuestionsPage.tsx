import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Toaster, toast } from "sonner";
import { QuestionEditor } from "../question_editor/QuestionEditor";
import { QuestionSearchPanel } from "./QuestionSearchPanel";
import { QuestionResultsList } from "./QuestionResultsList";
import { readBootstrap, unexcludeQuestion } from "./question_search_api";
import { useQuestionSearch } from "./useQuestionSearch";
import { readUrlState, useWriteUrlState } from "./useUrlState";
import type { SearchFilters } from "./question_search_types";
import styles from "./QuestionSearch.module.css";

const bootstrap = readBootstrap();
const initial = readUrlState();

export function EditQuestionsPage() {
  const [filters, setFilters] = useState<SearchFilters>(initial.filters);
  const [selectedId, setSelectedId] = useState<number | null>(initial.questionId);
  
   const [resultsCollapsed, setResultsCollapsed] = useState(false);

  const search = useQuestionSearch(bootstrap.searchUrl);
  const writeUrl = useWriteUrlState();  

  useEffect(() => {
    writeUrl(filters, selectedId);
  }, [filters, selectedId, writeUrl]);

  // Restore results on load when the URL already carries filters.
  useEffect(() => {
    const { terms, categories, flags } = initial.filters;
    if (terms || categories.length || flags.length) {
      void search.runSearch(initial.filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnexclude = useCallback(
    async (questionId: number) => {
      try {
        await unexcludeQuestion(bootstrap.unexcludeUrl, questionId);
        search.removeResult(questionId);
        if (selectedId === questionId) setSelectedId(null);
        toast.success("Question unexcluded.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unexclude failed.");
      }
    },
    [search, selectedId]
  );

  return (
    <div className={styles.page}>
      <Toaster richColors position="top-right" />

      <QuestionSearchPanel
        filters={filters}
        onChange={setFilters}
        onSearch={() => void search.runSearch(filters)}
        loading={search.loading}
      />

      <div
        className={`${styles.shell} ${selectedId !== null ? styles.shellDetail : ""} ${resultsCollapsed ? styles.shellResultsCollapsed : ""}`}
      >
        {!resultsCollapsed ? (
          <div className={styles.resultsColumn}>
            <QuestionResultsList
              items={search.results}
              selectedId={selectedId}
              loading={search.loading}
              error={search.error}
              hasSearched={search.hasSearched}
              showUnexclude={filters.excluded}
              onSelect={setSelectedId}
              onUnexclude={handleUnexclude}
              onCollapse={() => setResultsCollapsed(true)}
            />
          </div>
        ) : (
          <div className={styles.collapsedResultsBar}>
            <button
              type="button"
              className={styles.expandResultsBtn}
              onClick={() => setResultsCollapsed(false)}
              title="Expand search results"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        <div className={styles.editorColumn}>
          <button
            type="button"
            className={styles.backToResultsBtn}
            onClick={() => setSelectedId(null)}
          >
            <ArrowLeft size={16} />
            <span>Back to results</span>
          </button>

          <QuestionEditor
            questionId={selectedId}
            onDeleted={() => {
              if (selectedId !== null) search.removeResult(selectedId);
              setSelectedId(null);
            }}
            onSaved={() => search.rerun()}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}