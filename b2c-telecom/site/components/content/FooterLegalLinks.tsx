import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

const LINK =
  'inline-flex min-h-9 items-center rounded-sm font-body text-sm text-brand-300 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const LINKS = [
  { href: '/about', key: 'about' },
  { href: '/faq', key: 'faq' },
  { href: '/blog', key: 'blog' },
  { href: '/legal/shipping-returns', key: 'shippingReturns' },
  { href: '/legal/terms', key: 'terms' },
  { href: '/legal/privacy', key: 'privacy' },
  { href: '/legal/image-credits', key: 'imageCredits' },
] as const;

/** Company and legal links, appended to the site footer. */
export function FooterLegalLinks(): ReactElement {
  const t = useTranslations('content.footer');
  return (
    <nav aria-label={t('label')}>
      <ul className="m-0 flex list-none flex-wrap gap-x-7 gap-y-1 p-0">
        {LINKS.map((link) => (
          <li key={link.key}>
            <Link href={link.href} className={LINK}>
              {t(link.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
