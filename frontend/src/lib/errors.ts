/**
 * What to tell the reader about something caught: the error's own message
 * when it has one, otherwise `fallback`.
 */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
