import type { ProfileBootstrap } from "./profile_types";

export function readBootstrap(): ProfileBootstrap {
  const node = document.getElementById("profile-data");
  if (!node?.textContent) {
    throw new Error("Missing profile bootstrap data.");
  }
  return JSON.parse(node.textContent) as ProfileBootstrap;
}
