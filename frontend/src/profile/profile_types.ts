export interface ProfileBootstrap {
  csrfToken: string;
  /** Every language the server offers, already ordered. */
  languages: string[];
  selectedLanguages: string[];
  /** Server-enforced ceiling, mirrored here so the form can hold the line. */
  maxLanguages: number;
  /** Validation messages from the previous submit, if it failed. */
  errors: string[];
}
