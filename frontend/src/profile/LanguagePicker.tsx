import styles from "./Profile.module.css";

interface LanguagePickerProps {
  languages: string[];
  selected: string[];
  maxSelected: number;
  onChange: (selected: string[]) => void;
}

/** Checkbox list posted as the WTForms `languages` field. */
export function LanguagePicker({
  languages,
  selected,
  maxSelected,
  onChange,
}: LanguagePickerProps) {
  const atLimit = selected.length >= maxSelected;

  const toggle = (language: string, checked: boolean) =>
    onChange(
      checked
        ? [...selected, language]
        : selected.filter((value) => value !== language)
    );

  return (
    <div className={styles.languageGrid}>
      {languages.map((language) => {
        const checked = selected.includes(language);
        return (
          <label className={styles.languageOption} key={language}>
            <input
              type="checkbox"
              name="languages"
              value={language}
              checked={checked}
              disabled={!checked && atLimit}
              onChange={(event) => toggle(language, event.target.checked)}
            />
            <span>{language}</span>
          </label>
        );
      })}
    </div>
  );
}
