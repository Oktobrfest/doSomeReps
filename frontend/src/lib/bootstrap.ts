/**
 * Every page is a React island hydrated from a `<script type="application/json">`
 * block that Jinja renders. This is the one reader for all of them.
 */
export function readBootstrap<T>(elementId: string, label: string): T {
  const node = document.getElementById(elementId);
  if (!node?.textContent) {
    throw new Error(`Missing ${label} bootstrap data.`);
  }
  return JSON.parse(node.textContent) as T;
}
