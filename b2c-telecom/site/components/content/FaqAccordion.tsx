'use client';

import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';

/**
 * Progressive enhancement of the FAQ: the server HTML has every answer open (crawlers and readers without scripts see all of them).
 * After mount, every answer closes except the one the URL hash points at (or the one that contains the hash target).
 */
export function FaqAccordion({ children }: { children: ReactNode }): ReactElement {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = () => {
      const container = root.current;
      if (!container) return;
      let id = window.location.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // keep the raw hash
      }
      const target = id ? document.getElementById(id) : null;
      const keepOpen = target ? target.closest('details') : null;
      container.querySelectorAll('details').forEach((details) => {
        details.open = details === keepOpen;
      });
      if (target) target.scrollIntoView({ block: 'start' });
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  return <div ref={root}>{children}</div>;
}
