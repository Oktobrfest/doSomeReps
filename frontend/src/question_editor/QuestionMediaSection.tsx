import { type ChangeEvent } from "react";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import type { PicData, QuestionPart } from "./question_editor_types";
import styles from "./QuestionEditor.module.css";

/** Room left under the caret so the box does not grow on every keystroke. */
const TEXTAREA_EXTRA_SPACE = 24;

interface QuestionMediaSectionProps {
  part: QuestionPart;
  fieldLabel: string;
  mediaLabel: string;
  inputId: string;
  textareaId: string;
  value: string;
  rows: number;
  maxLength: number;
  required?: boolean;
  sectionClassName: string;
  textareaClassName: string;
  existingPics: PicData[];
  files: File[];
  onValueChange: (value: string) => void;
  onFileChange: (
    part: QuestionPart,
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  onRemoveExisting: (part: QuestionPart, id: number) => void;
  onRemoveNew: (part: QuestionPart, index: number) => void;
}

export function QuestionMediaSection({
  part,
  fieldLabel,
  mediaLabel,
  inputId,
  textareaId,
  value,
  rows,
  maxLength,
  required = false,
  sectionClassName,
  textareaClassName,
  existingPics,
  files,
  onValueChange,
  onFileChange,
  onRemoveExisting,
  onRemoveNew,
}: QuestionMediaSectionProps) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onValueChange(event.target.value);
  };

  return (
    <div className={`${styles.formSection} ${sectionClassName}`}>
      <label htmlFor={textareaId} className={styles.label}>
        {fieldLabel}
      </label>
      <AutoResizeTextarea
        id={textareaId}
        className={`${styles.textarea} ${textareaClassName}`}
        rows={rows}
        value={value}
        onChange={handleChange}
        maxLength={maxLength}
        required={required}
        extraSpace={TEXTAREA_EXTRA_SPACE}
      />

      <div className={styles.mediaSection}>
        {existingPics.length > 0 && (
          <div className={styles.existingMediaSection}>
            <span className={styles.existingMediaLabel}>
              Existing {mediaLabel} Images:
            </span>
            <div className={styles.mediaGrid}>
              {existingPics.map((pic) => (
                <div key={pic.pic_id} className={styles.imageContainer}>
                  <img
                    src={pic.pic_string}
                    alt={part}
                    className={styles.image}
                  />
                  <button
                    type="button"
                    className={styles.deleteImageBtn}
                    onClick={() => onRemoveExisting(part, pic.pic_id)}
                    title="Delete Image"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.customFileWrapper}>
          <input
            type="file"
            className={styles.customFileInput}
            id={inputId}
            multiple
            accept="image/*"
            onChange={(event) => onFileChange(part, event)}
          />
          <label className={styles.customFileLabel} htmlFor={inputId}>
            {files.length > 0
              ? `${files.length} file(s) selected`
              : `Add ${mediaLabel} Images`}
          </label>
        </div>

        {files.length > 0 && (
          <div className={styles.previewGrid}>
            {files.map((file, index) => (
              <div key={index} className={styles.previewContainer}>
                <img
                  src={URL.createObjectURL(file)}
                  className={styles.image}
                />
                <button
                  type="button"
                  className={styles.removeFileBtn}
                  onClick={() => onRemoveNew(part, index)}
                  title="Remove selected file"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
