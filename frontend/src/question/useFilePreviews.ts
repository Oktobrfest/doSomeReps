import { useEffect, useState } from "react";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Data URLs for images picked in the browser, in the order they were picked.
 *
 * Data rather than object URLs because these previews are also what the Ask AI
 * feature is shown for a question that has no server-side images yet: an object
 * URL means nothing outside this tab. Empty until the reads finish, so callers
 * index defensively.
 */
export function useFilePreviews(files: File[]): string[] {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(files.map(readAsDataUrl))
      .then((urls) => {
        if (!cancelled) setPreviews(urls);
      })
      .catch(() => {
        if (!cancelled) setPreviews([]);
      });

    return () => {
      cancelled = true;
    };
  }, [files]);

  return previews;
}
