import { readBootstrap as readShared } from "../lib/bootstrap";
import type { LandingBootstrap } from "./landing_types";

export function readBootstrap(): LandingBootstrap {
  return readShared<LandingBootstrap>("landing-data", "landing");
}
