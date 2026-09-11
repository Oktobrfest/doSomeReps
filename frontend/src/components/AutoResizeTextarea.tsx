import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

type AutoResizeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  /**
   * Extra height beyond the content, in px. Gives the writer room to keep
   * typing without the box growing under the caret on every keystroke.
   */
  extraSpace?: number;
};

/**
 * Textarea that grows to fit its content. Height is driven by scrollHeight, so
 * it has to be measured imperatively — CSS alone cannot size a textarea to
 * its text.
 */
export function AutoResizeTextarea({
  value,
  extraSpace = 0,
  ...props
}: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + extraSpace}px`;
  }, [value, extraSpace]);

  return <textarea ref={ref} value={value} {...props} />;
}
