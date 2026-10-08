import type { ReactNode } from 'react';
import { Card } from './Card';
import { cx } from './cx';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Usually a ButtonLink or Button. */
  action?: ReactNode;
  className?: string;
}

/** "Nothing here yet" card: says what is missing and offers the next step. */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cx('grid justify-items-center gap-3 py-10 text-center', className)}>
      <h2 className="font-display text-xl font-semibold text-navy-900">{title}</h2>
      {description ? <p className="max-w-120 text-neutral-600">{description}</p> : null}
      {action}
    </Card>
  );
}
