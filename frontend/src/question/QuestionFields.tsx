import { useId, type ChangeEvent } from "react";
import { toast } from "sonner";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import { CategoryPicker } from "../components/CategoryPicker"; // # CHANGED THIS - use the unified category picker; CatPicker no longer exists.
import { useFilePreviews } from "./useFilePreviews";
import {
  QUESTION_PARTS,
  QUESTION_PART_SPECS,
  type QuestionDraft,
  type QuestionPart,
} from "./question_types";
import styles from "./QuestionFields.module.css";

/** Room left under the caret so the box does not grow on every keystroke. */
const TEXTAREA_EXTRA_SPACE = 24;

/** Mirrors `repz.home.form_validation.validate_filename`, so a bad filename is
 *  caught before the upload round-trips rather than after. */
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

interface PartFieldProps {
  part: QuestionPart;
  draft: QuestionDraft;
  onChange: (next: QuestionDraft) => void;
}

/** One part of a question: its text and the images that belong with it. */
function PartField({ part, draft, onChange }: PartFieldProps) {
  const spec = QUESTION_PART_SPECS[part];
  const baseId = useId();
  const textId = `${baseId}-text`;
  const fileId = `${baseId}-file`;

  const files = draft.files[part];
  const pics = draft.pics[part];
  const previews = useFilePreviews(files);

  const replace = <K extends "text" | "pics" | "files">(
    key: K,
    value: QuestionDraft[K][QuestionPart]
  ) => onChange({ ...draft, [key]: { ...draft[key], [part]: value } });

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    // Clearing lets the same file be picked again after it is removed.
    event.target.value = "";

    const problems = picked
      .map((file) => filenameError(file.name))
      .filter((message): message is string => message !== null);

    if (problems.length > 0) {
      problems.forEach((message) => toast.error(message));
      return;
    }

    replace("files", [...files, ...picked]);
  };

  return (
    <section className={`${styles.part} ${styles[part]}`}>
      <label className={styles.label} htmlFor={textId}>
        {spec.label}
      </label>

      <AutoResizeTextarea
        id={textId}
        className={styles.textarea}
        rows={spec.rows}
        maxLength={spec.maxLength}
        required={spec.required}
        extraSpace={TEXTAREA_EXTRA_SPACE}
        value={draft.text[part]}
        onChange={(event) => replace("text", event.target.value)}
      />

      {(pics.length > 0 || previews.length > 0) && (
        <ul className={styles.thumbs}>
          {pics.map((pic) => (
            <li key={pic.pic_id} className={styles.thumb}>
              <img className={styles.image} src={pic.pic_string} alt={spec.mediaLabel} />
              <button
                type="button"
                className={styles.removeImage}
                title="Remove image"
                onClick={() =>
                  replace(
                    "pics",
                    pics.filter((item) => item.pic_id !== pic.pic_id)
                  )
                }
              >
                &times;
              </button>
            </li>
          ))}

          {files.map((file, index) =>
            previews[index] ? (
              <li key={`${file.name}-${index}`} className={styles.thumb}>
                <img className={styles.image} src={previews[index]} alt={file.name} />
                <button
                  type="button"
                  className={styles.removeImage}
                  title="Remove image"
                  onClick={() =>
                    replace(
                      "files",
                      files.filter((_, at) => at !== index)
                    )
                  }
                >
                  &times;
                </button>
              </li>
            ) : null
          )}
        </ul>
      )}

      <input
        type="file"
        id={fileId}
        className={styles.fileInput}
        multiple
        accept="image/*"
        onChange={addFiles}
      />
      <label className={styles.fileLabel} htmlFor={fileId}>
        Add {spec.mediaLabel} Images
      </label>
    </section>
  );
}

interface QuestionFieldsProps {
  value: QuestionDraft;
  onChange: (next: QuestionDraft) => void;
  /** An existing question is not queued from the editor; /quemore does that. */
  showAutoQue?: boolean;
}

/**
 * Everything a question is made of, editable.
 *
 * The add-content page, the AI question generator and the question editor all
 * render this and nothing else of their own: whatever a writer can do to a
 * question, they can do the same way on all three.
 */
export function QuestionFields({
  value,
  onChange,
  showAutoQue = true,
}: QuestionFieldsProps) {
  const baseId = useId();

  return (
    <div className={styles.fields}>
      {QUESTION_PARTS.map((part) => (
        <PartField key={part} part={part} draft={value} onChange={onChange} />
      ))}

      {/* # CHANGED THIS - question editing keeps the existing search/create/modal behavior through the unified picker. */}
      <CategoryPicker
        selectedCategories={value.categories}
        onChange={(categories) => onChange({ ...value, categories })}
      />

      <div className={styles.options}>
        <label className={styles.option} htmlFor={`${baseId}-privacy`}>
          <input
            type="checkbox"
            id={`${baseId}-privacy`}
            className={styles.checkbox}
            checked={value.privacy}
            onChange={(event) =>
              onChange({ ...value, privacy: event.target.checked })
            }
          />
          <span>Private only</span>
        </label>

        {showAutoQue && (
          <label className={styles.option} htmlFor={`${baseId}-auto-que`}>
            <input
              type="checkbox"
              id={`${baseId}-auto-que`}
              className={styles.checkbox}
              checked={value.autoQue}
              onChange={(event) =>
                onChange({ ...value, autoQue: event.target.checked })
              }
            />
            <span>Add Question to Que</span>
          </label>
        )}
      </div>
    </div>
  );
}
