import { csrfHeaders, jsonHeaders } from "../lib/http";
import { readBootstrap as readShared } from "../lib/bootstrap";
import type { HomeBootstrap } from "./home_types";

export function readBootstrap(): HomeBootstrap {
  return readShared<HomeBootstrap>("home-data", "home");
}

/** These endpoints answer with the bare JSON string "ok". */
async function expectOk(response: Response, failure: string): Promise<void> {
  if (!response.ok) {
    throw new Error(failure);
  }
  const data = await response.json();
  if (data !== "ok") {
    throw new Error(failure);
  }
}

export async function unfavoriteUser(url: string, userId: number): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  await expectOk(response, "Could not remove that user from your favorites.");
}

export async function unblockUser(url: string, userId: number): Promise<void> {
  const body = new FormData();
  body.append("blk_user_id", String(userId));

  const response = await fetch(url, { method: "POST", headers: csrfHeaders(), body });
  await expectOk(response, "Could not unblock that user.");
}
