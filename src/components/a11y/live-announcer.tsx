"use client";

import { useCallback, useRef, useState } from "react";

/**
 * WCAG 4.1.3 (status messages): drag-and-drop moves a card silently for a
 * screen reader unless something narrates it. `aria-live="polite"` waits for
 * the current utterance to finish rather than interrupting it.
 */
export function useLiveAnnouncer() {
  const [message, setMessage] = useState("");
  // Announcing the same string twice in a row (e.g. two drops onto the same
  // column) doesn't re-fire the live region, so nudge it with a trailing space.
  const flip = useRef(false);

  const announce = useCallback((text: string) => {
    flip.current = !flip.current;
    setMessage(flip.current ? text : `${text} `);
  }, []);

  return { message, announce };
}

export function LiveRegion({ message }: { message: string }) {
  return (
    <div aria-live="polite" role="status" className="sr-only">
      {message}
    </div>
  );
}
