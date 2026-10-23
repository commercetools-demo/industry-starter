import { useLocale, useTranslations } from 'next-intl';
import FooterStoreButton from '@/components/layout/FooterStoreButton';
import NewsletterForm from '@/components/layout/NewsletterForm';
import { Link } from '@/i18n/routing';
import { buildListingHref } from '@/lib/nav/listing-href';
import { FOOTER_COLUMNS, FOOTER_LEGAL, footerHref, type FooterLink } from '@/lib/nav/footer-config';
import { findCategoryByKey } from '@/lib/nav/mega-config';
import type { Category } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';

const LINK = 'text-[14px] text-footer-link hover:text-surface';

/** Ink footer. Server component: a brand column with the newsletter form, four link columns (Collect only in the US), legal row. */
export default function Footer({ categories }: { categories: Category[] }) {
  const t = useTranslations('shell.footer');
  const tCommon = useTranslations('common');
  const market = marketForLocale(useLocale());
  const columns = FOOTER_COLUMNS.filter((c) => market.collection || !c.collectionOnly);

  const hrefFor = (link: FooterLink): string => {
    if (link.categoryKey) {
      const category = findCategoryByKey(categories, link.categoryKey);
      return category ? buildListingHref(category.slug) : '/';
    }
    return footerHref(link.href ?? '/');
  };

  return (
    <footer className="mt-24 bg-ink text-surface">
      <div className="wrap grid grid-cols-[1.4fr_repeat(4,1fr)] gap-10 pb-12 pt-16 max-grid3:grid-cols-3 max-mobile:grid-cols-2">
        <div className="max-grid3:col-span-3 max-mobile:col-span-2">
          <p className="wordmark m-0">{tCommon('brand')}</p>
          <p className="mt-3 max-w-[340px] text-[14px] text-footer-link">{t('tagline')}</p>
          <NewsletterForm />
        </div>
        {columns.map((column) => (
          <nav key={column.id} aria-label={t(`col.${column.id}`)}>
            <h2 className="eyebrow m-0 mb-4 text-footer-heading!">{t(`col.${column.id}`)}</h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {column.links.map((link) => (
                <li key={link.labelKey}>
                  {link.action === 'choose-store' ? (
                    <FooterStoreButton label={t(`link.${link.labelKey}`)} className={`${LINK} inline-flex min-h-6 cursor-pointer items-center border-0 bg-transparent p-0`} />
                  ) : (
                    <Link prefetch={false} href={hrefFor(link)} className={LINK}>
                      {t(`link.${link.labelKey}`)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-footer-meta/30">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-6 text-[13px] text-footer-meta">
          <p className="m-0">{t('copyright', { year: new Date().getFullYear() })}</p>
          <ul className="m-0 flex list-none gap-5 p-0">
            {FOOTER_LEGAL.map((item) => (
              <li key={item.labelKey}>
                <Link prefetch={false} href={footerHref(item.href)} className="text-footer-meta hover:text-surface">
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
