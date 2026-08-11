import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

type AutoResizeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
};

/**
 * Textarea that grows to fit its content. Height is driven by scrollHeight, so
 * it has to be measured imperatively — CSS alone cannot size a textarea to
 * its text.
 */
export function AutoResizeTextarea({ value, ...props }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return <textarea ref={ref} value={value} {...props} />;
}
