import { useRef, useState, type FormEvent } from "react";
import { Toaster, toast } from "sonner";
import { AskAiLauncher } from "../ask_ai/AskAiLauncher";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import { CategoryPicker } from "../components/CategoryPicker";
import { NewCategoryForm } from "./NewCategoryForm";
import { readBootstrap } from "./add_content_api";
import sharedStyles from "../styles/shared.module.css";
import styles from "./AddContent.module.css";

const bootstrap = readBootstrap();

const toSlug = (value: string) => value.replace(/ /g, "_");

/**
 * Mirrors `repz.home.form_validation.validate_filename` so the user hears about
 * a bad filename before the upload round-trips.
 */
const VALID_FILENAME = /^[a-zA-Z0-9_. !@#$%^&()\-]+$/;

function filenameError(filename: string): string | null {
  if (filename.startsWith(".") && filename.split(".").length === 2) {
    return `"${filename}" cannot start with a period and have no extension.`;
  }
  if (!VALID_FILENAME.test(filename)) {
    return `"${filename}" contains invalid characters.`;
  }
  if (!/\.[^.]+$/.test(filename)) {
    return `"${filename}" must have a file extension.`;
  }
  return null;
}

function resolveInitialSelection(): string[] {
  return bootstrap.selectedCategories.map(
    (slug) =>
      bootstrap.categoryList.find((cat) => toSlug(cat) === slug) ??
      slug.replace(/_/g, " ")
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Uncontrolled file input: the browser owns the FileList so multipart posts work. */
function useImageInput() {
  const ref = useRef<HTMLInputElement>(null);
  const [dataUrls, setDataUrls] = useState<string[]>([]);

  const onChange = async () => {
    const input = ref.current;
    if (!input) return;

    const files = Array.from(input.files ?? []);
    const problems = files.map((f) => filenameError(f.name)).filter(Boolean);

    if (problems.length > 0) {
      problems.forEach((message) => toast.error(message as string));
      input.value = "";
      setDataUrls([]);
      return;
    }

    try {
      const urls = await Promise.all(files.map(readAsDataUrl));
      setDataUrls(urls.filter((url) => url.startsWith("data:image/")));
    } catch {
      setDataUrls([]);
    }
  };

  return { ref, dataUrls, onChange: () => void onChange() };
}

export function AddContentPage() {
  const [selected, setSelected] = useState<string[]>(resolveInitialSelection);
  const [questionText, setQuestionText] = useState("");
  const [hint, setHint] = useState("");
  const [answer, setAnswer] = useState("");

  const questionImage = useImageInput();
  const hintImage = useImageInput();
  const answerImages = useImageInput();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (selected.length === 0) {
      event.preventDefault();
      toast.error("Select at least one category before submitting.");
      return;
    }
    if (questionText.trim().length < 3) {
      event.preventDefault();
      toast.error("Question text is too short.");
      return;
    }
    if (answer.trim().length < 1) {
      event.preventDefault();
      toast.error("An answer is required.");
    }
  };

  return (
    <div className={styles.page}>
      <Toaster richColors position="top-right" />

      <h1 className={styles.pageTitle}>New Question</h1>

      <NewCategoryForm
        addCategoryUrl={bootstrap.addCategoryUrl}
        onCreated={(name) =>
          setSelected((prev) => (prev.includes(name) ? prev : [...prev, name]))
        }
      />

      <form method="post" encType="multipart/form-data" onSubmit={handleSubmit}>
        <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

        <section className={styles.section}>
          <CategoryPicker
            selectedCategories={selected}
            onChange={setSelected}
            showSavedLists={false}
            showSelectAll={false}
            showApplyButton={false}
            checkboxName="category_name"
            checkboxValueFn={toSlug}
          />
        </section>

        <section className={styles.section}>
          <label className={styles.labelRequired} htmlFor="question_text">
            Question Text
          </label>
          <AutoResizeTextarea
            id="question_text"
            name="question_text"
            className={styles.textarea}
            placeholder="Enter question here"
            maxLength={1499}
            required
            rows={3}
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
          />
          <label className={styles.fileLabel} htmlFor="question_image">
            Upload a Question Image:
            <input
              type="file"
              id="question_image"
              name="question_image"
              accept="image/*"
              ref={questionImage.ref}
              onChange={questionImage.onChange}
            />
          </label>
        </section>

        <section className={styles.section}>
          <label className={styles.label} htmlFor="hint">
            Hint
          </label>
          <AutoResizeTextarea
            id="hint"
            name="hint"
            className={styles.textarea}
            placeholder="Enter hint"
            maxLength={1999}
            rows={2}
            value={hint}
            onChange={(event) => setHint(event.target.value)}
          />
          <label className={styles.fileLabel} htmlFor="hint_image">
            Upload a Hint Image:
            <input
              type="file"
              id="hint_image"
              name="hint_image"
              accept="image/*"
              ref={hintImage.ref}
              onChange={hintImage.onChange}
            />
          </label>
        </section>

        <section className={styles.section}>
          <label className={styles.labelRequired} htmlFor="answer">
            Answer
          </label>
          <AutoResizeTextarea
            id="answer"
            name="answer"
            className={styles.textarea}
            placeholder="Enter answer here"
            maxLength={3999}
            required
            rows={4}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
          />
          <label className={styles.fileLabel} htmlFor="answer_pics">
            Upload Answer Images:
            <input
              type="file"
              id="answer_pics"
              name="answer_pics"
              accept="image/*"
              multiple
              ref={answerImages.ref}
              onChange={answerImages.onChange}
            />
          </label>
        </section>

        <div className={styles.submitRow}>
          <button
            type="submit"
            className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue}`}
          >
            Submit
          </button>

          <label className={styles.checkboxOption} htmlFor="auto-que-checkbox">
            <input
              type="checkbox"
              id="auto-que-checkbox"
              name="automatically-que-created-question"
            />
            <span>Add Question to Que</span>
          </label>

          <label className={styles.checkboxOption} htmlFor="privacy-checkbox">
            <input type="checkbox" id="privacy-checkbox" name="privacy-checkbox" />
            <span>Private only</span>
          </label>
        </div>
      </form>

      <AskAiLauncher
        questionId="new"
        questionText={questionText}
        answerText={answer}
        answerRevealed={true}
        categories={selected}
        questionImageUrls={questionImage.dataUrls}
        answerImageUrls={answerImages.dataUrls}
        csrfToken={bootstrap.csrfToken}
      />
    </div>
  );
}
