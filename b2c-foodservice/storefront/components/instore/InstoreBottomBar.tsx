'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The bar fixed to the bottom of a page: the total and the main action (workstream R). While one is mounted the document element
 * carries `data-instore-bar`, which lifts the scan button and the page padding above it (app/instore.css). Safe-area insets are
 * in the CSS class, so the bar clears a phone's home indicator.
 */
export default function InstoreBottomBar({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-instore-bar', '');
    return () => root.removeAttribute('data-instore-bar');
  }, []);
  return (
    <div role="region" aria-label={label} data-testid="instore-bar" className={cn('instore-bar', className)}>
      {children}
    </div>
  );
}
