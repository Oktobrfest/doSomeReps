import type { LandingBootstrap } from "./landing_types";

export function readBootstrap(): LandingBootstrap {
  const node = document.getElementById("landing-data");
  if (!node?.textContent) {
    throw new Error("Missing landing bootstrap data.");
  }
  return JSON.parse(node.textContent) as LandingBootstrap;
}
