import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
let MarkdownContent;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)),
    server: { middlewareMode: true },
  });
  ({ MarkdownContent } = await server.ssrLoadModule("/src/components/MarkdownContent.tsx"));
});

after(async () => { await server?.close(); });

const render = (content) => renderToStaticMarkup(createElement(MarkdownContent, { content }));

test("untrusted HTML cannot introduce active elements or event handlers", () => {
  const html = render('<iframe src="https://evil.example"></iframe><script>alert(1)</script>' +
    '<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">link</a>' +
    '<form action="https://evil.example"><input name="password"></form>');
  assert.doesNotMatch(html, /<iframe|<script|<form|onerror|javascript:|evil\.example/);
  // GFM task-list inputs are allowed, but forced to disabled checkboxes.
  assert.match(html, /<input disabled="" type="checkbox"/);
  assert.match(html, /link/);
});

test("tables, math, highlighted code, and Mermaid source survive sanitization", () => {
  assert.match(render("| A | B |\n| - | - |\n| 1 | 2 |"), /<table/);
  assert.match(render("$x^2$"), /class="katex"/);
  assert.match(render("```typescript\nconst x = 1;\n```"), /hljs-keyword/);
  assert.match(render("```mermaid\ngraph TD; A-->B;\n```"), /class="mermaid/);
});
