import { readBootstrap as readShared } from "../lib/bootstrap";
import type { AboutBootstrap } from "./about_types";

export function readBootstrap(): AboutBootstrap {
  return readShared<AboutBootstrap>("about-data", "about");
}
