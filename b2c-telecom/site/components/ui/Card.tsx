import type { ElementType, ReactElement, ReactNode } from 'react';
import { cx } from '@/lib/cx';

type As = 'div' | 'article' | 'li' | 'section';

export function Card({ as = 'div', className, children }: { as?: As; className?: string; children: ReactNode }): ReactElement {
  const Tag: ElementType = as;
  return <Tag className={cx('overflow-hidden rounded-xl border border-border bg-surface', className)}>{children}</Tag>;
}

export type CardHeaderTone = 'brand' | 'pink' | 'plain';

const HEADER_TONE: Record<CardHeaderTone, string> = {
  brand: 'bg-brand-500 text-text-on-brand',
  pink: 'bg-pink-900 text-text-on-pink',
  plain: 'bg-surface text-text',
};

export function CardHeader({ tone = 'plain', className, children }: { tone?: CardHeaderTone; className?: string; children: ReactNode }): ReactElement {
  return <div className={cx('p-7', HEADER_TONE[tone], className)}>{children}</div>;
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }): ReactElement {
  return <div className={cx('flex flex-col gap-5 p-7', className)}>{children}</div>;
}
