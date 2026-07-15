import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSub from "remark-sub";
import remarkSuper from "remark-super";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";
import mermaid from "mermaid";

// Initialize mermaid
mermaid.initialize({ startOnLoad: false, theme: "default" });

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
        rehypeRaw,
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
