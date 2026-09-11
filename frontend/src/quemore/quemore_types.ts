export interface QueMoreBootstrap {
  /** Canonical category names, used to resolve the session's slugs back to names. */
  categoryList: string[];
  /** Slugs restored from the user's last search, held in the Flask session. */
  selectedCategories: string[];
  searchUrl: string;
  saveUrl: string;
  blockUserUrl: string;
}

export interface QueFilterState {
  personal: boolean;
  favorate: boolean;
  public: boolean;
  blocked: boolean;
  excluded: boolean;
}

export interface QueSearchResult {
  question_id: number;
  question_text: string;
  categories: string[];
  username: string;
  created_by: number;
  favorite: boolean;
  rating: number | null;
  excluded: boolean;
}

/** Per-row selection state. Que and exclude are mutually exclusive. */
export interface RowSelection {
  que: boolean;
  exclude: boolean;
}

/** A row the reader has not given a verdict on. */
export const NO_SELECTION: RowSelection = { que: false, exclude: false };

export interface SavePayload {
  que: number[];
  exclude: number[];
  unexclude: number[];
}

export interface AjaxEnvelope<T> {
  data: T;
  msg: string;
  msg_category: "success" | "error" | "warning";
  status: "ok" | "nogo";
}
