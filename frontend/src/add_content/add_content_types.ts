export interface AddContentBootstrap {
  /** WTForms CSRF token. `QuestionForm.validate_on_submit()` rejects the post without it. */
  csrfToken: string;
  /** Canonical category names, used to resolve the server's slugs back to names. */
  categoryList: string[];
  /** Slugs the server echoed back after a failed validation round-trip. */
  selectedCategories: string[];
  addCategoryUrl: string;
}

export interface FilePreview {
  name: string;
  dataUrl: string;
}
