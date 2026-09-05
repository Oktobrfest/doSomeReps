// doSomeReps/frontend/src/components/ExtendButton.tsx
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Settings } from "lucide-react";
import sharedStyles from "../styles/shared.module.css";
import styles from "./ExtendButton.module.css";

const OPTIONS_TIMEOUT_MS = 20_000;

export interface ExtendOption {
  key: string;
  label: string;
}

export interface ExtendPayload {
  customInstructions: string;
  selectedOptions: string[];
}

interface ExtendButtonProps {
  onExtend: (payload: ExtendPayload, signal: AbortSignal) => Promise<void>;
  disabled?: boolean;
}

export function ExtendButton({ onExtend, disabled = false }: ExtendButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [options, setOptions] = useState<ExtendOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const extendAbortRef = useRef<AbortController | null>(null);
  const instructionsId = useId();

  // Load available options when the settings modal is first opened.
  useEffect(() => {
    if (!isOpen || options.length > 0) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPTIONS_TIMEOUT_MS);

    setLoadingOptions(true);
    fetch("/ai_question_generator/api/extend-options", {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.options)) {
          setOptions(data.options);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          // Leave the options list empty; the user can still add custom instructions.
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoadingOptions(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isOpen, options.length]);

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

  // Drop an in-flight extend whose button is going away.
  useEffect(() => () => extendAbortRef.current?.abort(), []);

  const toggleOption = (key: string) => {
    setSelectedOptions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleExtend = async () => {
    const controller = new AbortController();
    extendAbortRef.current = controller;
    setIsExtending(true);
    // The request runs in the background: the modal must not hold the page.
    setIsOpen(false);

    try {
      await onExtend(
        {
          customInstructions: customInstructions.trim(),
          selectedOptions,
        },
        controller.signal
      );
    } catch {
      // The page that owns the request reports the failure.
    } finally {
      extendAbortRef.current = null;
      setIsExtending(false);
    }
  };

  const handleCancel = () => extendAbortRef.current?.abort();

  return (
    <>
      <div className={`${styles.widget} ${disabled ? styles.disabled : ""}`} role="group" aria-label="AI extend">
        <button
          type="button"
          className={styles.extendBtn}
          onClick={isExtending ? handleCancel : handleExtend}
          disabled={disabled}
          aria-label={isExtending ? "Cancel extend" : "Extend"}
        >
          {isExtending ? (
            <>
              <Loader2
                className={`${sharedStyles.buttonIcon} ${sharedStyles.spinIcon}`}
                aria-hidden="true"
              />
              Cancel
            </>
          ) : (
            "Extend"
          )}
        </button>
        <button
          type="button"
          className={styles.settingsBtn}
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          aria-label="Extend settings"
          title="Extend settings"
        >
          <Settings size={14} />
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onClose={() => setIsOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) {
            setIsOpen(false);
          }
        }}
      >
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h4 className={styles.modalTitle}>AI Extend Settings</h4>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.field}>
              <label htmlFor={instructionsId} className={styles.fieldLabel}>
                Extra instructions (optional)
              </label>
              <textarea
                id={instructionsId}
                className={styles.textarea}
                rows={5}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., Use simpler language, add an example..."
              />
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>
                What should the AI focus on?
              </span>
              {loadingOptions ? (
                <div className={styles.loadingOptions}>Loading options... (timeout in {OPTIONS_TIMEOUT_MS / 1000}s)</div>
              ) : (
                <ul className={styles.optionList}>
                  {options.length === 0 && (
                    <li className={styles.optionItem}>No options available.</li>
                  )}
                  {options.map((opt) => (
                    <li key={opt.key} className={styles.optionItem}>
                      <label className={styles.optionLabel}>
                        <input
                          type="checkbox"
                          className={styles.optionCheckbox}
                          checked={selectedOptions.includes(opt.key)}
                          onChange={() => toggleOption(opt.key)}
                        />
                        <span className={styles.optionText}>{opt.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={`${sharedStyles.button} ${sharedStyles.buttonSecondary}`}
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${sharedStyles.button} ${sharedStyles.buttonPrimary}`}
              onClick={handleExtend}
              disabled={isExtending}
            >
              {isExtending ? "Extending..." : "Extend"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
