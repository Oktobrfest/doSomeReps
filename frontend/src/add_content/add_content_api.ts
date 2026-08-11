import type { AddContentBootstrap } from "./add_content_types";

export function readBootstrap(): AddContentBootstrap {
  const node = document.getElementById("add-content-data");
  if (!node?.textContent) {
    throw new Error("Missing add-content bootstrap data.");
  }
  return JSON.parse(node.textContent) as AddContentBootstrap;
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

  const response = await fetch(url, { method: "POST", body });

  if (!response.ok) {
    throw new Error("Could not reach the server. Try again.");
  }

  const result = (await response.json()) as { data?: string; htl?: string };

  if (result.htl === "error" || result.data === "error") {
    throw new Error(result.data || "Could not create that category.");
  }

  return result.data ?? categoryName;
}
