import { Fragment, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { FOCUS_RING } from './focus';

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }): ReactElement {
  const t = useTranslations('common');
  return (
    <nav aria-label={t('breadcrumb')} className={className}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-3 p-0 font-display text-sm font-medium text-brand-900">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li>
                {last || item.href === undefined ? (
                  <span aria-current={last ? 'page' : undefined}>{item.label}</span>
                ) : (
                  <Link href={item.href} className={cx('text-brand-900 underline-offset-4 hover:underline', FOCUS_RING)}>
                    {item.label}
                  </Link>
                )}
              </li>
              {last ? null : (
                <li aria-hidden="true" role="presentation">
                  /
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
