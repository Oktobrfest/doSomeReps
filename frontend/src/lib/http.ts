/**
 * Headers for a JSON POST, carrying the CSRF token when the page has one.
 *
 * Flask-WTF reads the token from X-CSRFToken; every JSON mutation in the app
 * needs the same pair, so they are built in one place.
 */
export function jsonHeaders(csrfToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  return headers;
}
