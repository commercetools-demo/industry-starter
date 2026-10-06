import type { ReactNode } from 'react';
import { cx } from './cx';

export function Tag({ tone = 'neutral', className, children }: { tone?: 'accent' | 'accent-2' | 'neutral' | 'outline'; className?: string; children: ReactNode }) {
  return <span className={cx('tag', `tag-${tone}`, className)}>{children}</span>;
}
