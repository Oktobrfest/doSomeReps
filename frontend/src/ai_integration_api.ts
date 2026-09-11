import { csrfHeaders, jsonHeaders } from "./lib/http";
import type {
  AIConfig,
  IntegrationInput,
  PlaygroundResult,
  ProviderInput,
} from "./ai_integration_types";

const API_BASE = "/integration/api";

/**
 * These endpoints answer 200 with `{success: false, error}` as readily as they
 * answer a 4xx, so both have to be treated as failure.
 */
interface MutationEnvelope {
  success?: boolean;
  message?: string;
  error?: string;
}

async function readJson(response: Response, fallback: string): Promise<any> {
  try {
    return await response.json();
  } catch {
    throw new Error(`${fallback}: server returned a non-JSON response (Status: ${response.status}).`);
  }
}

async function mutate(
  path: string,
  options: RequestInit,
  fallback: string
): Promise<string | undefined> {
  const response = await fetch(`${API_BASE}${path}`, options);
  const result = (await readJson(response, fallback)) as MutationEnvelope;

  if (!response.ok || !result.success) {
    throw new Error(result.error || fallback);
  }

  return result.message;
}

function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  };
}

export async function getConfig(): Promise<AIConfig> {
  // Cache-busted: the page re-reads this straight after every mutation.
  const response = await fetch(`${API_BASE}/config?_=${Date.now()}`);
  const data = await readJson(response, "Failed to load configuration");

  if (!response.ok) {
    throw new Error(
      data?.error || `Failed to load configuration (Status: ${response.status})`
    );
  }

  return data as AIConfig;
}

export function saveProvider(input: ProviderInput): Promise<string | undefined> {
  return mutate("/provider", postJson(input), "Failed to save provider.");
}

export function deleteProvider(providerId: number): Promise<string | undefined> {
  return mutate(
    `/provider/${providerId}`,
    { method: "DELETE", headers: csrfHeaders() },
    "Failed to delete provider."
  );
}

export function saveIntegration(
  input: IntegrationInput
): Promise<string | undefined> {
  return mutate("/integration", postJson(input), "Failed to save integration.");
}

export async function testPrompt(
  prompt: string,
  modality: string
): Promise<PlaygroundResult> {
  const response = await fetch(
    `${API_BASE}/test`,
    postJson({ prompt, modality })
  );
  const data = await readJson(response, "Failed to generate completion.");

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to generate completion.");
  }

  return { response: data.response, modelUsed: data.model_used };
}
