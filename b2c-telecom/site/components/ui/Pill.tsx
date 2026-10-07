import type { ReactElement, ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { FOCUS_RING_ON_BRAND } from './focus';

type PillProps = {
  active?: boolean;
  as?: 'link' | 'button';
  href?: string;
  className?: string;
  onClick?: () => void;
  'aria-current'?: 'page' | undefined;
  'aria-label'?: string;
  children: ReactNode;
};

/** Navigation pill. Active = dark pill; inactive = transparent on a brand surface. The caller sets `aria-current`. */
export function Pill({ active = false, as = 'link', href, className, onClick, children, ...aria }: PillProps): ReactElement {
  const classes = cx(
    'inline-flex min-h-11 items-center rounded-pill px-5 py-3 font-display text-sm font-semibold tracking-ui no-underline',
    active ? 'bg-brand-950 text-text-on-pink' : 'bg-transparent text-text-on-brand hover:bg-brand-400',
    FOCUS_RING_ON_BRAND,
    className,
  );
  if (as === 'button' || href === undefined) {
    return (
      <button type="button" className={classes} onClick={onClick} {...aria}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={classes} onClick={onClick} {...aria}>
      {children}
    </Link>
  );
}
