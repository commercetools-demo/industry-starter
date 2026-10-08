import type { ReactNode } from 'react';
import { cx } from './cx';

export interface PageHeadProps {
  title: string;
  sub?: string;
  children?: ReactNode;
  className?: string;
}

/** Sky-gradient page head with the H1 and an optional muted sub line. */
export function PageHead({ title, sub, children, className }: PageHeadProps) {
  return (
    <div className={cx('bg-(image:--gradient-sky) pt-10 pb-8', className)}>
      <div className="mx-auto max-w-content px-5 nav:px-8">
        <h1 className="font-display text-[length:clamp(1.75rem,4vw,2.5rem)] leading-tight font-semibold text-navy-900">{title}</h1>
        {sub ? <p className="mt-1.5 max-w-155 text-neutral-600">{sub}</p> : null}
        {children}
      </div>
    </div>
  );
}
