import { useTranslations } from 'next-intl';
import { CategoryTile } from '@/components/instore/InstoreHome';
import ProductRow from '@/components/instore/ProductRow';
import Icon from '@/components/ui/Icon';
import { buttonClasses } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import type { InstoreCategoryView } from '@/lib/instore/category';
import { cn } from '@/lib/cn';

/**
 * The In-store category page (workstream R): a back link, the name, sub-category tiles when there are any, and the product
 * rows. No filters, no sort, no breadcrumbs; paging is two big buttons. Render only: the route loads `view`.
 */
export default function InstoreCategory({ view, rootKey }: { view: InstoreCategoryView; rootKey: string | undefined }) {
  const t = useTranslations('instore.category');
  const { category, parent, children, rows, page, pageCount, total } = view;
  const href = (n: number) => `/c/${encodeURIComponent(category.slug)}${n > 1 ? `?page=${n}` : ''}`;
  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
      <Link
        href={parent ? `/c/${encodeURIComponent(parent.slug)}` : '/'}
        className="inline-flex min-h-12 w-fit items-center gap-2 pr-3 text-[15px] font-semibold text-ink-2 no-underline"
      >
        <Icon name="chevL" size={22} />
        {parent ? t('backTo', { name: parent.name }) : t('home')}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{category.name}</h1>
        <p className="m-0 text-[14px] text-ink-3">{t('count', { count: total })}</p>
      </div>

      {children.length > 0 ? (
        <section aria-label={t('browse')}>
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
            {children.map((c) => (
              <li key={c.id} className="min-w-0">
                <CategoryTile name={c.name} slug={c.slug} rootKey={rootKey} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section aria-label={t('products')}>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {rows.map((row) => (
              <li key={row.id}>
                <ProductRow row={row} />
              </li>
            ))}
          </ul>
        </section>
      ) : children.length === 0 ? (
        <p role="status" className="m-0 py-6 text-center text-[16px] text-ink-2">
          {t('empty')}
        </p>
      ) : null}

      {pageCount > 1 ? (
        <nav aria-label={t('paging')} className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={href(page - 1)} className={cn(buttonClasses({ variant: 'ghost', size: 'lg' }), 'min-h-14 flex-1')}>
              {t('previous')}
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          <span className="shrink-0 text-[14px] text-ink-3">{t('page', { page, pages: pageCount })}</span>
          {page < pageCount ? (
            <Link href={href(page + 1)} className={cn(buttonClasses({ variant: 'ghost', size: 'lg' }), 'min-h-14 flex-1')}>
              {t('next')}
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      ) : null}
    </div>
  );
}
