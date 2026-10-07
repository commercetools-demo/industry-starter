import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type CardProps = { elev?: 'sm' | 'md' | 'lg'; children: ReactNode } & HTMLAttributes<HTMLDivElement>;

export function Card({ elev, className, children, ...rest }: CardProps) {
  return (
    <div className={cx('card', elev && `elev-${elev}`, className)} {...rest}>
      {children}
    </div>
  );
}

export function CardKicker({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('card-kicker', className)}>{children}</div>;
}
export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('card-title', className)}>{children}</div>;
}
export function CardMeta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('card-meta', className)}>{children}</div>;
}
