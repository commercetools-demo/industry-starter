import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'aside';
}

/** White surface, 15 px radius, small shadow. Not interactive by itself. */
export function Card({ as: Tag = 'div', className, ...rest }: CardProps) {
  return <Tag className={cx('rounded-lg bg-surface p-6 shadow-sm', className)} {...rest} />;
}
