import type { QuestionPayload } from "../question/question_api";

/** What the que workflow talks to, on whichever page it is mounted. */
export interface QueEndpoints {
  searchUrl: string;
  saveUrl: string;
  blockUserUrl: string;
}

export interface QueMoreBootstrap extends QueEndpoints {
  /** Canonical category names, used to resolve the session's slugs back to names. */
  categoryList: string[];
  /** Slugs restored from the user's last search, held in the Flask session. */
  selectedCategories: string[];
}

export interface QueFilterState {
  personal: boolean;
  favorate: boolean;
  public: boolean;
  blocked: boolean;
  excluded: boolean;
}

/** The question whole, as every page reads one, plus where the reader stands with it. */
export interface QueSearchResult extends QuestionPayload {
  id: number;
  question_text: string;
  answer: string;
  categories: string[];
  username: string;
  created_by: number;
  favorite: boolean;
  rating: number | null;
  excluded: boolean;
}

/** `save_to_que` reads each list as empty when it is left out. */
export interface SavePayload {
  que?: number[];
  exclude?: number[];
  unexclude?: number[];
}

export interface AjaxEnvelope<T> {
  data: T;
  msg: string;
  msg_category: "success" | "error" | "warning";
  status: "ok" | "nogo";
}
