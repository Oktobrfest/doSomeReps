import { csrfHeaders } from "../lib/http";
import { readBootstrap as readShared } from "../lib/bootstrap";
import type { AddContentBootstrap } from "./add_content_types";

export function readBootstrap(): AddContentBootstrap {
  return readShared<AddContentBootstrap>("add-content-data", "add-content");
}

/**
 * Posts to `quest_ajx.addcat`, which answers 200 with `{data, htl}` and signals
 * failure by setting `htl` to the string "error" rather than by status code.
 */
export async function createCategory(
  url: string,
  categoryName: string
): Promise<string> {
  const body = new FormData();
  body.append("add_category_field", categoryName);

  const response = await fetch(url, { method: "POST", headers: csrfHeaders(), body });

  if (!response.ok) {
    throw new Error("Could not reach the server. Try again.");
  }

  const result = (await response.json()) as { data?: string; htl?: string };

  if (result.htl === "error" || result.data === "error") {
    throw new Error(result.data || "Could not create that category.");
  }

  return result.data ?? categoryName;
}
