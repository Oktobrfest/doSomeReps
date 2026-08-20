import type { AboutBootstrap } from "./about_types";

export function readBootstrap(): AboutBootstrap {
  const node = document.getElementById("about-data");
  if (!node?.textContent) {
    throw new Error("Missing about bootstrap data.");
  }
  return JSON.parse(node.textContent) as AboutBootstrap;
}
