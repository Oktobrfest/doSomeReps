import { useState } from "react";
import AiIntegration from "../AiIntegration";
import sharedStyles from "../styles/shared.module.css";
import { LanguagePicker } from "./LanguagePicker";
import { readBootstrap } from "./profile_api";
import styles from "./Profile.module.css";

const bootstrap = readBootstrap();

export function ProfilePage() {
  const [selected, setSelected] = useState<string[]>(
    bootstrap.selectedLanguages
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>User Profile</h1>
      <p className={styles.intro}>
        Configure your preferred languages and AI integration.
      </p>

      {bootstrap.errors.length > 0 && (
        <div
          className={`${sharedStyles.alert} ${sharedStyles.alertError}`}
          role="alert"
        >
          <ul className={styles.errorList}>
            {bootstrap.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <form className={styles.form} method="post" autoComplete="off">
        <input type="hidden" name="csrf_token" value={bootstrap.csrfToken} />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Preferred Languages</legend>

          <LanguagePicker
            languages={bootstrap.languages}
            selected={selected}
            maxSelected={bootstrap.maxLanguages}
            onChange={setSelected}
          />

          <p className={styles.help}>
            Select up to {bootstrap.maxLanguages} preferred languages.{" "}
            {selected.length} of {bootstrap.maxLanguages} selected.
          </p>
        </fieldset>

        <button
          type="submit"
          name="submit"
          className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue}`}
        >
          Save
        </button>
      </form>

      <hr className={styles.divider} />

      <AiIntegration />
    </div>
  );
}
