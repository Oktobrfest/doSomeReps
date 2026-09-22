import { useEffect, useState } from 'react';

/**
 * The width at which a page stops being a phone screen.
 *
 * It mirrors the breakpoint the touch tiers collapse at in
 * `styles/global.css`: a media query cannot read a custom property, so the
 * number is stated in both places and nowhere else.
 */
export const FULL_SIZED_PAGE = '(min-width: 900px)';

/** One reading of the breakpoint, safe on browsers without `matchMedia`. */
export function matchesFullSizedPage(): boolean {
  try {
    return window.matchMedia(FULL_SIZED_PAGE).matches;
  } catch {
    // No matchMedia is a very old or very small browser; assume a phone.
    return false;
  }
}

/**
 * Whether there is a full-sized page to lay out on.
 *
 * The phone and the desktop builds of the quiz and of the category picker are
 * different compositions of the same parts rather than one composition
 * restyled, so the breakpoint has to be readable from JavaScript as well as
 * from CSS.
 */
export function useFullSizedPage(): boolean {
  const [fullSized, setFullSized] = useState(matchesFullSizedPage);

  useEffect(() => {
    const query = window.matchMedia(FULL_SIZED_PAGE);
    const update = () => setFullSized(query.matches);

    update();
    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, []);

  return fullSized;
}
