import { csrfHeaders, jsonHeaders } from "../lib/http";
import { readBootstrap as readShared } from "../lib/bootstrap";
import type {
  AjaxEnvelope,
  QueFilterState,
  QueMoreBootstrap,
  QueSearchResult,
  SavePayload,
} from "./quemore_types";

export function readBootstrap(): QueMoreBootstrap {
  return readShared<QueMoreBootstrap>("quemore-data", "quemore");
}

export interface SearchOutcome {
  results: QueSearchResult[];
  msg: string;
  msgCategory: "success" | "error" | "warning";
  ok: boolean;
}

/**
 * `searchquefilters` answers 200 for "no categories selected" and "nothing
 * found" alike, flagging both with status "nogo" and a human-readable msg.
 */
export async function searchQue(
  url: string,
  filters: QueFilterState,
  categorySlugs: string[]
): Promise<SearchOutcome> {
  const response = await fetch(url, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...filters, catz: categorySlugs }),
  });

  if (!response.ok) {
    throw new Error(`Search failed (HTTP ${response.status}).`);
  }

  const envelope = (await response.json()) as AjaxEnvelope<QueSearchResult[]>;

  return {
    results: envelope.status === "ok" && Array.isArray(envelope.data)
      ? envelope.data
      : [],
    msg: envelope.msg,
    msgCategory: envelope.msg_category,
    ok: envelope.status === "ok",
  };
}

export async function saveToQue(url: string, payload: SavePayload): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Could not save to your que (HTTP ${response.status}).`);
  }

  const envelope = (await response.json()) as AjaxEnvelope<unknown>;
  if (envelope.status !== "ok") {
    throw new Error(envelope.msg || "Could not save to your que.");
  }
  return envelope.msg;
}

export async function blockUser(url: string, userId: number): Promise<void> {
  const body = new FormData();
  body.append("block_user_id", String(userId));

  const response = await fetch(url, { method: "POST", headers: csrfHeaders(), body });
  if (!response.ok) {
    throw new Error("Could not block that user.");
  }
}
