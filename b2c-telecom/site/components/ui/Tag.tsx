import type { ReactElement, ReactNode } from 'react';
import { cx } from '@/lib/cx';

export type TagTone = 'brand' | 'pink' | 'neutral' | 'danger';

const TONE: Record<TagTone, string> = {
  brand: 'bg-brand-100 text-brand-950',
  pink: 'bg-pink-50 text-pink-800',
  neutral: 'bg-neutral-100 text-text',
  danger: 'bg-danger text-text-on-pink',
};

export function Tag({ tone = 'brand', className, children }: { tone?: TagTone; className?: string; children: ReactNode }): ReactElement {
  return (
    <span className={cx('inline-block rounded-pill px-3 py-1 font-display text-xs font-semibold uppercase tracking-ui', TONE[tone], className)}>
      {children}
    </span>
  );
}
