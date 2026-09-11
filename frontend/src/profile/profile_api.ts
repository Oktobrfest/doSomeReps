import { readBootstrap as readShared } from "../lib/bootstrap";
import type { ProfileBootstrap } from "./profile_types";

export function readBootstrap(): ProfileBootstrap {
  return readShared<ProfileBootstrap>("profile-data", "profile");
}
