import { useState, useEffect } from "react";
import { CatPicker } from "./CatPicker";
import { ExtendButton, type ExtendPayload } from "./ExtendButton";
import styles from "./AiQuestionGenerator.module.css";

interface GeneratedQuestion {
  question: string;
  hint: string | null;
  answer: string;
  categories: string[];
  privacy?: boolean;
  auto_que?: boolean;

}

export function AiQuestionGenerator() {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [quizContent, setQuizContent] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [qtyFrom, setQtyFrom] = useState<number>(5);
  const [qtyTo, setQtyTo] = useState<number>(10);
  const [tryProvideHints, setTryProvideHints] = useState<boolean>(false);
  const [avoidDuplicates, setAvoidDuplicates] = useState<boolean>(false);

  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load initial state (generated questions and categories)
  useEffect(() => {
    fetch("/ai_question_generator/api/state")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load generator state");
        return res.json();
      })
      .then((data) => {
        setGeneratedQuestions(
          (data.generated_questions || []).map((q: any) => ({
            ...q,
            privacy: !!q.privacy,
            auto_que: !!q.auto_que,
          }))
        );
        if (Array.isArray(data.selected_categories)) {
          setSelectedCats(data.selected_categories);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error loading state");
        setLoading(false);
      });
  }, []);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizContent.trim() && !file) {
      setError("Quiz content or a document file is required.");
      return;
    }
    if (selectedCats.length === 0) {
      setError("Please select at least one category - the AI uses these to tag every generated question.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    let body: any;
    let headers: Record<string, string> = {};

    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("categories", JSON.stringify(selectedCats));
      formData.append("qty_from", qtyFrom.toString());
      formData.append("qty_to", qtyTo.toString());
      formData.append("try_provide_hints", tryProvideHints.toString());
      formData.append("avoid_duplicates", avoidDuplicates.toString());
      body = formData;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({
        quiz_content: quizContent,
        categories: selectedCats,
        qty_from: qtyFrom,
        qty_to: qtyTo,
        try_provide_hints: tryProvideHints,
        avoid_duplicates: avoidDuplicates,
      });
    }

    fetch("/ai_question_generator/api/generate", {
      method: "POST",
      headers,
      body,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(data.error || "Generation failed");
        }
        setGeneratedQuestions(
          (data.generated_questions || []).map((q: any) => ({
            ...q,
            privacy: !!q.privacy,
            auto_que: !!q.auto_que,
          }))
        );
        setSuccess(`Successfully generated ${data.generated_questions?.length || 0} question(s).`);
        setQuizContent(""); // Clear text after success
        setFile(null); // Clear file after success
        const fileInput = document.getElementById("file_upload") as HTMLInputElement | null;
        if (fileInput) {
          fileInput.value = "";
        }
        setSubmitting(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Generation failed");
        setSubmitting(false);
      });
  };

  const handleQuestionChange = (index: number, field: keyof GeneratedQuestion, value: any) => {
    setGeneratedQuestions((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const handleSaveOne = (index: number) => {
    setError(null);
    setSuccess(null);
    const item = generatedQuestions[index];

    fetch("/ai_question_generator/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        index,
        question: item,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(data.error || "Save failed");
        }
        setGeneratedQuestions(
          (data.generated_questions || []).map((q: any, i: number) => {
            const oldIndex = i < index ? i : i + 1;
            const oldItem = generatedQuestions[oldIndex];
            return {
              ...q,
              privacy: oldItem ? !!oldItem.privacy : !!q.privacy,
              auto_que: oldItem ? !!oldItem.auto_que : !!q.auto_que,
            };
          })
        );
        setSuccess("Question saved.");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Save failed");
      });
  };

  const handleDeleteOne = (index: number) => {
    setError(null);
    setSuccess(null);

    fetch("/ai_question_generator/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(data.error || "Delete failed");
        }
        setGeneratedQuestions(
          (data.generated_questions || []).map((q: any, i: number) => {
            const oldIndex = i < index ? i : i + 1;
            const oldItem = generatedQuestions[oldIndex];
            return {
              ...q,
              privacy: oldItem ? !!oldItem.privacy : !!q.privacy,
              auto_que: oldItem ? !!oldItem.auto_que : !!q.auto_que,
            };
          })
        );
        setSuccess("Question removed.");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Delete failed");
      });
  };

  const handleExtendOne = async (
    index: number,
    payload: ExtendPayload
  ): Promise<void> => {
    setError(null);
    setSuccess(null);
    const item = generatedQuestions[index];

    try {
      const res = await fetch("/ai_question_generator/api/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          index,
          question: item,
          custom_instructions: payload.customInstructions,
          options: payload.selectedOptions,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Extend failed");
      }

      setGeneratedQuestions(
        (data.generated_questions || []).map((q: any, i: number) => {
          const oldItem = generatedQuestions[i];
          return {
            ...q,
            privacy: oldItem ? !!oldItem.privacy : !!q.privacy,
            auto_que: oldItem ? !!oldItem.auto_que : !!q.auto_que,
          };
        })
      );
      setSuccess("Answer extended.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extend failed";
      setError(msg);
      throw err;
    }
  };

  const handleSaveAll = () => {
    setError(null);
    setSuccess(null);

    fetch("/ai_question_generator/api/save_all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: generatedQuestions }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(data.error || "Save all failed");
        }
        setGeneratedQuestions(
          (data.generated_questions || []).map((q: any) => {
            const oldItem = generatedQuestions.find((oldQ) => oldQ.question === q.question);
            return {
              ...q,
              privacy: oldItem ? !!oldItem.privacy : !!q.privacy,
              auto_que: oldItem ? !!oldItem.auto_que : !!q.auto_que,
            };
          })
        );
        if (data.saved_count > 0) {
          setSuccess(`Saved ${data.saved_count} question(s) to the database.`);
        } else {
          setError("Failed to save questions.");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Save all failed");
      });
  };

  const handleDeleteAll = () => {
    if (!window.confirm("Delete all generated questions? This will not remove anything from the database.")) {
      return;
    }
    setError(null);
    setSuccess(null);

    fetch("/ai_question_generator/api/delete_all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(data.error || "Delete all failed");
        }
        setGeneratedQuestions([]);
        setSuccess("Cleared all generated questions.");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Delete all failed");
      });
  };

  const handleExtendAll = async () => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    let extendedCount = 0;
    let failureCount = 0;
    const errorsList: string[] = [];

    // Make a copy of current questions state so we can mutate and update sequentially
    const updatedQuestions = [...generatedQuestions];

    for (let i = 0; i < updatedQuestions.length; i++) {
      const item = updatedQuestions[i];
      try {
        const res = await fetch("/ai_question_generator/api/extend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            index: i,
            question: item,
            custom_instructions: "",
            options: [],
          }),
        });
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || "Extend failed");
        }

        // The endpoint returns the entire generated_questions array.
        // We extract the newly extended question at index i.
        if (data.generated_questions && data.generated_questions[i]) {
          const newQuestionData = data.generated_questions[i];
          updatedQuestions[i] = {
            ...newQuestionData,
            privacy: !!item.privacy,
            auto_que: !!item.auto_que,
          };
          // Update the list state in real-time as each question completes
          setGeneratedQuestions([...updatedQuestions]);
        }
        extendedCount++;
      } catch (err) {
        failureCount++;
        const msg = err instanceof Error ? err.message : "Extend failed";
        errorsList.push(`Question #${i + 1}: ${msg}`);
      }
    }

    setSubmitting(false);

    if (extendedCount > 0) {
      setSuccess(`Successfully extended ${extendedCount} answer(s).`);
    }
    if (failureCount > 0) {
      setError(`Failed to extend ${failureCount} answer(s): ${errorsList.join("; ")}`);
    }
  };

  const handleMasterToggleChange = (field: "auto_que" | "privacy", checked: boolean) => {
    setGeneratedQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        [field]: checked,
      }))
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Loading AI Question Generator...</p>
      </div>
    );
  }

  // Check if every item is checked for auto_que / privacy to sync master toggle states
  const allAutoQueChecked = generatedQuestions.length > 0 && generatedQuestions.every((q) => q.auto_que);
  const allPrivacyChecked = generatedQuestions.length > 0 && generatedQuestions.every((q) => q.privacy);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>AI Question Generator</h1>
      <p className={styles.description}>Have AI generate quiz questions from your material.</p>

      {error && <div className={`${styles.alert} ${styles.alertDanger}`}>{error}</div>}
      {success && <div className={`${styles.alert} ${styles.alertSuccess}`}>{success}</div>}

      <form onSubmit={handleGenerate} className={styles.card}>
        <p className={styles.subLabel} style={{ textAlign: "center", marginBottom: "16px" }}>
          <strong>Categories are required.</strong> Pick one or more below — the AI will tag each generated question with the relevant ones.
        </p>

        <div className={styles.formGroup}>
          <CatPicker selectedCategories={selectedCats} onChange={setSelectedCats} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="file_upload" className={styles.label}>Upload Document (Optional)</label>
          <span className={styles.subLabel}>
            Upload a PDF or an image (PNG, JPG, JPEG) to generate questions from.
          </span>
          <input
            id="file_upload"
            type="file"
            accept=".pdf,image/*"
            className={styles.fileInput}
            onChange={(e) => {
              const selectedFile = e.target.files?.[0] || null;
              setFile(selectedFile);
            }}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="quiz_content" className={styles.label}>Quiz Content {file ? "(Optional)" : ""}</label>
          <span className={styles.subLabel}>
            Have AI create questions for you regarding the following material.
          </span>
          <textarea
            id="quiz_content"
            className={styles.textarea}
            rows={10}
            placeholder={file ? "Optional when a document is uploaded..." : "Paste or type the source material you'd like questions generated from..."}
            value={quizContent}
            onChange={(e) => setQuizContent(e.target.value)}
            required={!file}
          />
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Qty. of Questions to create</legend>
          <p className={styles.subLabel}>
            Tell the AI to create <strong>between this many questions</strong> (a minimum and a maximum). Each value must be 0–50.
          </p>
          <div className={styles.row}>
            <div className={styles.col}>
              <label htmlFor="qty_from" className={styles.label}>From</label>
              <input
                id="qty_from"
                type="number"
                className={styles.input}
                min={0}
                max={50}
                value={qtyFrom}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  setQtyFrom(val);
                  if (qtyTo < val + 1) {
                    setQtyTo(val + 1);
                  }
                }}
              />
              <span className={styles.subLabel}>at least this many</span>
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", padding: "0 8px" }}>–</div>
            <div className={styles.col}>
              <label htmlFor="qty_to" className={styles.label}>To</label>
              <input
                id="qty_to"
                type="number"
                className={styles.input}
                min={Math.max(1, qtyFrom + 1)}
                max={50}
                value={qtyTo}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  const minTo = Math.max(1, qtyFrom + 1);
                  setQtyTo(Math.max(val, minTo));
                }}
              />
              <span className={styles.subLabel}>up to this many</span>
            </div>
          </div>
        </fieldset>

        <label className={styles.checkboxContainer}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={tryProvideHints}
            onChange={(e) => setTryProvideHints(e.target.checked)}
          />
          <div>
            <span className={styles.checkboxLabel}>Try to use hints</span>
            <span className={styles.subLabel} style={{ marginTop: "4px" }}>
              If checked, a separate AI call will be made to generate hints for the questions it considers difficult enough to warrant one. Easy questions won't get a hint.
            </span>
          </div>
        </label>

        <label className={styles.checkboxContainer}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={avoidDuplicates}
            onChange={(e) => setAvoidDuplicates(e.target.checked)}
          />
          <div>
            <span className={styles.checkboxLabel}>Avoid duplicates</span>
            <span className={styles.subLabel} style={{ marginTop: "4px" }}>
              If checked, existing questions under these categories will be queried and passed to the AI to prevent generating duplicate questions.
            </span>
          </div>
        </label>

        <div className={styles.formGroup} style={{ marginBottom: 0 }}>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}
            disabled={submitting}
          >
            {submitting && <span className={styles.btnSpinner} />}
            {submitting ? "Generating Questions..." : "Get AI Questions!"}
          </button>
        </div>
      </form>

      <hr className={styles.divider} />

      <section id="ai-generated-questions">
        <h2 className={styles.sectionTitle}>Generated Questions</h2>

        {generatedQuestions.length > 0 ? (
          <div>
            {/* Top bulk actions */}
            <div className={styles.bulkActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSuccess}`}
                onClick={handleSaveAll}
              >
                Save All
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleDeleteAll}
              >
                Delete All
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnInfo}`}
                onClick={handleExtendAll}
              >
                Extend All
              </button>
            </div>

            {/* Master toggles */}
            <div className={styles.masterToggles}>
              <span className={styles.masterTogglesTitle}>Apply to all:</span>
              <label className={styles.checkboxContainer} style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allAutoQueChecked}
                  onChange={(e) => handleMasterToggleChange("auto_que", e.target.checked)}
                />
                <span className={styles.checkboxLabel}>Add all to Que</span>
              </label>
              <label className={styles.checkboxContainer} style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allPrivacyChecked}
                  onChange={(e) => handleMasterToggleChange("privacy", e.target.checked)}
                />
                <span className={styles.checkboxLabel}>Mark all Private</span>
              </label>
              <span className={styles.subLabel} style={{ margin: 0 }}>
                Check / uncheck to flip every matching checkbox below.
              </span>
            </div>

            {/* Question Group List */}
            {generatedQuestions.map((gq, i) => (
              <div key={i} className={styles.questionGroup}>
                <div className={styles.questionGroupHeader}>Question #{i + 1}</div>

                <div className={styles.formGroup}>
                  <label htmlFor={`gen_question_${i}`} className={styles.label}>Question</label>
                  <textarea
                    id={`gen_question_${i}`}
                    className={styles.textarea}
                    rows={2}
                    maxLength={1499}
                    value={gq.question}
                    onChange={(e) => handleQuestionChange(i, "question", e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={`gen_hint_${i}`} className={styles.label}>Hint</label>
                  <textarea
                    id={`gen_hint_${i}`}
                    className={styles.textarea}
                    rows={2}
                    maxLength={1999}
                    placeholder="(no hint)"
                    value={gq.hint || ""}
                    onChange={(e) => handleQuestionChange(i, "hint", e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={`gen_answer_${i}`} className={styles.label}>Answer</label>
                  <textarea
                    id={`gen_answer_${i}`}
                    className={styles.textarea}
                    rows={4}
                    maxLength={3999}
                    value={gq.answer}
                    onChange={(e) => handleQuestionChange(i, "answer", e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <span className={styles.label}>Categories</span>
                  <CatPicker
                    selectedCategories={gq.categories}
                    onChange={(cats) => handleQuestionChange(i, "categories", cats)}
                  />
                </div>

                <div className={styles.questionOptions}>
                  <div className={styles.optionBox}>
                    <input
                      type="checkbox"
                      id={`gen-auto-que-${i}`}
                      className={styles.checkbox}
                      style={{ margin: 0 }}
                      checked={!!gq.auto_que}
                      onChange={(e) => handleQuestionChange(i, "auto_que", e.target.checked)}
                    />
                    <label htmlFor={`gen-auto-que-${i}`} className={styles.checkboxLabel} style={{ fontSize: "0.875rem" }}>
                      Add Question to Que
                    </label>
                  </div>
                  <div className={styles.optionBox}>
                    <input
                      type="checkbox"
                      id={`gen-privacy-${i}`}
                      className={styles.checkbox}
                      style={{ margin: 0 }}
                      checked={!!gq.privacy}
                      onChange={(e) => handleQuestionChange(i, "privacy", e.target.checked)}
                    />
                    <label htmlFor={`gen-privacy-${i}`} className={styles.checkboxLabel} style={{ fontSize: "0.875rem" }}>
                      Private only
                    </label>
                  </div>
                </div>

                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSm}`}
                    onClick={() => handleSaveOne(i)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                    onClick={() => handleDeleteOne(i)}
                  >
                    Delete
                  </button>

                  <ExtendButton
                    onExtend={(payload) => handleExtendOne(i, payload)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.subLabel} style={{ fontStyle: "italic", marginTop: "20px" }}>
            Generated questions will appear here once you click "Get AI Questions!" above.
          </p>
        )}
      </section>
    </div>
  );
}
