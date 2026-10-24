import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSub from "remark-sub";
import remarkSuper from "remark-super";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";
import mermaid from "mermaid";
import type { Root } from "hast";
import { visit } from "unist-util-visit";
import styles from "./MarkdownContent.module.css";

// Initialize mermaid. A diagram that fails to parse throws into Mermaid's own
// catch below rather than rendering mermaid's "Syntax error" graphic as the diagram.
mermaid.initialize({ startOnLoad: false, theme: "default", suppressErrorRendering: true });

const TABLE_CONTAINERS = new Set(["table", "thead", "tbody", "tfoot", "tr", "colgroup"]);

/**
 * Strips whitespace-only text children from table structural containers
 * (table, thead, tbody, tfoot, tr, colgroup) before `rehype-raw` runs.
 *
 * `remark-rehype` injects formatting `\n` text nodes into table structures.
 * When `rehype-raw` processes the tree through parse5, WHATWG HTML foster-parenting
 * rules hoist any text nodes directly inside table containers out and place them
 * immediately BEFORE the <table> element. In containers styled with `white-space: pre-wrap`,
 * these dozens of hoisted newlines are rendered as blank lines, creating a full page
 * of empty padding above the table.
 */
function rehypeCleanTableWhitespace() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (TABLE_CONTAINERS.has(node.tagName) && Array.isArray(node.children)) {
        node.children = node.children.filter(
          (child) => !(child.type === "text" && /^[\r\n\s]+$/.test(child.value))
        );
      }
    });
  };
}

interface MarkdownContentProps {
  content: string;
}

function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const id = `mermaid-${Math.floor(Math.random() * 1000000)}`;

    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (active) setSvg(svg);
      })
      .catch((err) => {
        console.error("Mermaid parsing failed", err);
        if (active) setError("Failed to render Mermaid diagram");
      });

    return () => {
      active = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="text-red-500 font-mono text-sm border border-red-200 p-2 rounded bg-red-50 my-2">
        {error}
      </div>
    );
  }
  if (!svg) {
    return <pre className="mermaid p-2 bg-muted rounded my-2">{chart}</pre>;
  }

  return <div ref={ref} className="my-4 flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkSub, remarkSuper]}
      rehypePlugins={[
        rehypeCleanTableWhitespace,
        rehypeRaw,
        [rehypeSanitize, {
          ...defaultSchema,
          attributes: {
            ...defaultSchema.attributes,
            code: [["className", /^language-./, "math-inline", "math-display"]],
          },
        }],
        rehypeKatex,
        [
          rehypeHighlight,
          {
            detect: true,
            languages: {
              typescript,
              ts: typescript,
              tsx: typescript,
              javascript,
              js: javascript,
              jsx: javascript,
              xml,
              html: xml,
              css,
            },
          },
        ],
      ]}
      components={{
        table({ node, className, ...props }) {
          return <table className={`${styles.table}${className ? ` ${className}` : ""}`} {...props} />;
        },
        th({ node, className, ...props }) {
          return <th className={`${styles.th}${className ? ` ${className}` : ""}`} {...props} />;
        },
        td({ node, className, ...props }) {
          return <td className={`${styles.td}${className ? ` ${className}` : ""}`} {...props} />;
        },
        tr({ node, className, ...props }) {
          return <tr className={`${styles.tr}${className ? ` ${className}` : ""}`} {...props} />;
        },
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const isMermaid = match && match[1] === "mermaid";
          if (isMermaid) {
            return <Mermaid chart={String(children).replace(/\n$/, "")} />;
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
