import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import "highlight.js/styles/github.css";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
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
    >
      {content}
    </ReactMarkdown>
  );
}