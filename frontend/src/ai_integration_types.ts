export interface SavedProvider {
  id: number;
  provider: string;
  apiBase: string;
  hasKey: boolean;
  maskedKey: string;
}

export interface SavedIntegration {
  id: number;
  modality: string;
  provider_id: number | null;
  model: string;
}

export interface AIConfig {
  providers: SavedProvider[];
  integrations: SavedIntegration[];
  predefinedOptions: Record<string, string[]>;
  modelPrices?: Record<string, string>;
}

export interface ProviderInput {
  provider: string;
  apiBase: string;
  apiKey: string;
}

export interface IntegrationInput {
  modality: string;
  provider_id: number | null;
  model: string;
}

export interface PlaygroundResult {
  response: string;
  modelUsed: string;
}
