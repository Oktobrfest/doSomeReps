import React, { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import styles from "./FlagButton.module.css";
import sharedStyles from "../styles/shared.module.css";
import {
  FlagCategory,
  FLAG_METADATA,
  REMOVE_FLAG_METADATA,
  DEFAULT_FLAG_METADATA,
} from "./FlagConstants";

export interface QuestionFlag {
  category: FlagCategory;
  note: string | null;
}

interface FlagButtonProps {
  questionId: string | number;
  initialFlag?: QuestionFlag | null;
  csrfToken?: string;
  onFlagChange?: (newFlag: QuestionFlag | null) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function FlagButton({
  questionId,
  initialFlag = null,
  csrfToken,
  onFlagChange,
  disabled = false,
  compact = false,
}: FlagButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<FlagCategory>(FlagCategory.NEEDS_CHANGES);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync state with initialFlag when it changes
  useEffect(() => {
    if (initialFlag) {
      setCategory(initialFlag.category);
      setNote(initialFlag.note || "");
    } else {
      setCategory(FlagCategory.NEEDS_CHANGES);
      setNote("");
    }
  }, [initialFlag]);

  // Sync the modal open/close state with the native <dialog> element.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const saveFlag = async (cat: FlagCategory | "", flagNote: string | null) => {
    setError(null);
    setIsSaving(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
      }

      const response = await fetch("/api/flag", {
        method: "POST",
        headers,
        body: JSON.stringify({
          questionId,
          category: cat || null,
          note: flagNote ? flagNote.trim() : null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save flag");
      }

      const updatedFlag = cat ? { category: cat, note: flagNote } : null;
      if (onFlagChange) {
        onFlagChange(updatedFlag);
      }
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMainButtonClick = async () => {
    if (initialFlag) {
      // If already flagged, default main button behavior is to toggle/unflag
      await saveFlag("", null);
    } else {
      // Default flag is NEEDS_CHANGES
      await saveFlag(FlagCategory.NEEDS_CHANGES, "");
    }
  };

  const handleModalSave = async () => {
    await saveFlag(category, note);
  };

  const handleModalRemove = async () => {
    await saveFlag("", null);
  };

  const isFlagged = !!initialFlag;
  
  const flagClass = isFlagged
    ? (initialFlag.category === FlagCategory.STUDY_ME ? styles.flaggedStudyMe : styles.flaggedOther)
    : "";

  // Custom button text logic
  const buttonText = isFlagged
    ? `Remove ${FLAG_METADATA[initialFlag.category].label} Flag`
    : "Flag";

  // Dynamic button icon logic
  const activeIconElement = isFlagged
    ? REMOVE_FLAG_METADATA.icon
    : DEFAULT_FLAG_METADATA.icon;

  const trigger = compact ? (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      disabled={disabled || isSaving}
      className={`${styles.compactTrigger} ${flagClass}`}
      title={isFlagged ? `Flagged: ${FLAG_METADATA[initialFlag.category].label}` : "Flag Question"}
    >
      {React.cloneElement((isFlagged ? FLAG_METADATA[initialFlag.category].icon : DEFAULT_FLAG_METADATA.icon) as React.ReactElement, {
        className: styles.compactIcon,
      })}
    </button>
  ) : (
    <div
      className={`${styles.widget} ${flagClass} ${disabled || isSaving ? styles.disabled : ""}`}
      role="group"
      aria-label="Flag question"
    >
      <button
        type="button"
        className={styles.flagBtn}
        onClick={handleMainButtonClick}
        disabled={disabled || isSaving}
        aria-label={isSaving ? "Flagging" : "Flag question"}
      >
        {React.cloneElement(activeIconElement as React.ReactElement, {
          className: styles.flagIcon,
        })}
        <span>{isSaving ? "Saving..." : buttonText}</span>
      </button>
      <button
        type="button"
        className={styles.settingsBtn}
        onClick={() => setIsOpen(true)}
        disabled={disabled || isSaving}
        aria-label="Flag settings"
        title="Flag settings"
      >
        <Settings className={styles.flagIcon} />
      </button>
    </div>
  );

  return (
    <>
      {trigger}

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onClick={(e) => {
          if (e.target === dialogRef.current) {
            setIsOpen(false);
          }
        }}
      >
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h4 className={styles.modalTitle}>Flag Question Settings</h4>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className={styles.modalBody}>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Flag Category</span>
              <div className={styles.radioGroup}>
                {Object.entries(FLAG_METADATA).map(([key, metadata]) => (
                  <label key={key} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="flag_category"
                      value={key}
                      checked={category === key}
                      onChange={(e) => setCategory(e.target.value as FlagCategory)}
                      className={styles.radioInput}
                    />
                    {React.cloneElement(metadata.icon as React.ReactElement, {
                      className: styles.radioIcon,
                    })}
                    <span className={styles.radioText}>{metadata.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="flag-note" className={styles.fieldLabel}>
                Add Note (optional)
              </label>
              <textarea
                id="flag-note"
                className={styles.textarea}
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why are you flagging this question?..."
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            {isFlagged && (
              <button
                type="button"
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnRed} ${styles.btnDangerPlacement}`}
                onClick={handleModalRemove}
                disabled={isSaving}
              >
                Remove Flag
              </button>
            )}
            <button
              type="button"
              className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnSlate}`}
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnBlue}`}
              onClick={handleModalSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Flag"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
