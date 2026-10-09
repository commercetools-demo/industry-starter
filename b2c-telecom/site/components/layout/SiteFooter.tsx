import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FooterLegalLinks } from '@/components/content/FooterLegalLinks';
import { Link } from '@/i18n/routing';
import type { NavItem } from '@/lib/nav';

const LINK = 'rounded-sm font-display text-sm font-medium text-brand-100 no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

type SiteFooterProps = {
  /** Root categories; empty when the catalog is unavailable (Support and the copyright still render). */
  items: NavItem[];
};

export function SiteFooter({ items }: SiteFooterProps): ReactElement {
  const t = useTranslations('footer');
  return (
    <footer data-surface="dark" className="bg-brand-950 py-9 text-brand-100">
      <div className="mx-auto flex w-full max-w-(--container-width) flex-col gap-7 px-5 md:px-10">
        <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
          <span className="font-display text-3xl font-bold leading-none tracking-widest text-brand-500">malva</span>
          <nav aria-label={t('nav')}>
            <ul className="m-0 flex list-none flex-wrap gap-x-7 gap-y-3 p-0">
              {items.map((item) => (
                <li key={item.key}>
                  <Link href={item.path} className={LINK}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/support" className={LINK}>
                  {t('support')}
                </Link>
              </li>
            </ul>
          </nav>
          <p className="m-0 font-body text-sm text-brand-300">{t('copyright')}</p>
        </div>
        <FooterLegalLinks />
      </div>
    </footer>
  );
}
