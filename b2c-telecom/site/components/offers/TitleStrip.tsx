import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/Breadcrumb';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';

export type SubcategoryLink = { key: string; name: string; href: string };

type TitleStripProps = {
  breadcrumb: BreadcrumbItem[];
  title: string;
  blurb?: string | undefined;
  /** Child categories of this category ("Browse by type"), so they are reachable from the listing. */
  subcategories?: SubcategoryLink[];
  note?: ReactElement | null;
};

/** The honey strip on top of a listing: breadcrumb, H1, blurb (design/specs/plp.md). */
export function TitleStrip({ breadcrumb, title, blurb, subcategories = [], note = null }: TitleStripProps): ReactElement {
  const t = useTranslations('plp');
  return (
    <section className="bg-brand-100 py-10 md:py-12">
      <div className="mx-auto flex w-full max-w-(--container-width) flex-col gap-3 px-5 md:px-10">
        <Breadcrumb items={breadcrumb} />
        <h1 className="m-0 font-display text-5xl font-bold tracking-ui">{title}</h1>
        {blurb ? <p className="m-0 max-w-2xl text-lg leading-normal text-brand-900">{blurb}</p> : null}
        {subcategories.length > 0 ? (
          <nav aria-label={t('browseBy')}>
            <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
              {subcategories.map((child) => (
                <li key={child.key}>
                  <Link
                    href={child.href}
                    className={cx('inline-flex min-h-11 items-center rounded-pill border-2 border-brand-950 px-5 font-display text-sm font-semibold text-brand-950 no-underline hover:bg-brand-200', FOCUS_RING)}
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {note}
      </div>
    </section>
  );
}
