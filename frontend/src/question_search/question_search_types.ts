import type { FlagCategory } from "../components/FlagConstants";

export const UNFLAGGED = "UNFLAGGED" as const;

export type FlagFilterKey = FlagCategory | typeof UNFLAGGED;

export interface QuestionFlag {
  category: FlagCategory;
  note: string | null;
}

export interface SearchResultItem {
  question_id: number;
  question_text: string;
  categories: string[];
  flag: QuestionFlag | null;
}

export interface SearchFilters {
  terms: string;
  within: string[];
  categories: string[];
  excluded: boolean;
  flags: FlagFilterKey[];
}

export interface EditQuestionsBootstrap {
  searchUrl: string;
  unexcludeUrl: string;
}

export const EMPTY_FILTERS: SearchFilters = {
  terms: "",
  within: [],
  categories: [],
  excluded: false,
  flags: [],
};