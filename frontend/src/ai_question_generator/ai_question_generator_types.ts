export interface GeneratedQuestion {
  question: string;
  hint: string | null;
  answer: string;
  categories: string[];
  privacy?: boolean;
  auto_que?: boolean;
}

export interface GeneratorStateResponse {
  generated_questions?: GeneratedQuestion[];
  selected_categories?: string[];
}

export interface GeneratorMutationResponse {
  success: boolean;
  error?: string;
  generated_questions?: GeneratedQuestion[];
  saved_count?: number;
}

export interface GenerateQuestionsRequest {
  quizContent: string;
  file: File | null;
  selectedCats: string[];
  qtyFrom: number;
  qtyTo: number;
  tryProvideHints: boolean;
  avoidDuplicates: boolean;
}
