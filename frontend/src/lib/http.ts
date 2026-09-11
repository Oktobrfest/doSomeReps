/**
 * CSRF plumbing for every mutating request the app makes.
 *
 * Flask-WTF reads the token from an X-CSRFToken header, and base.html renders
 * it into a meta tag, so any React island can pick it up without prop drilling.
 * Every non-GET fetch builds its headers here so no call site can forget it.
 */

function csrfToken(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  return meta?.content ?? "";
}

/**
 * Headers for a mutating request whose body is `FormData` or empty.
 *
 * FormData must not carry an explicit Content-Type: only the browser knows the
 * multipart boundary it generated.
 */
export function csrfHeaders(): Record<string, string> {
  const token = csrfToken();
  return token ? { "X-CSRFToken": token } : {};
}

/** Headers for a mutating request with a JSON body. */
export function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...csrfHeaders() };
}
