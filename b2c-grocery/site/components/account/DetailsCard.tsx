import { useTranslations } from 'next-intl';
import { Card, CardKicker } from '@/components/ui/Card';
import { Link } from '@/i18n/routing';
import { subscriptionsEnabled } from '@/lib/config/features';

export const DETAIL_ROWS = [
  { key: 'orders', href: '/account/orders' },
  { key: 'addresses', href: '/account/addresses' },
  { key: 'saved', href: '/account/saved' },
  { key: 'subscriptions', href: '/account/subscriptions' },
  { key: 'contact', href: '/contact' },
] as const;

/** Rows with a trailing arrow that turn accent on hover. Also the sub-navigation rail on account sub-pages (`current` marks the active row). */
export function DetailsCard({ current }: { current?: (typeof DETAIL_ROWS)[number]['key'] }) {
  const t = useTranslations('account.details');
  return (
    <Card elev="sm" className="p-[17.6px]">
      <CardKicker>{t('kicker')}</CardKicker>
      <nav aria-label={t('nav')}>
        <ul className="m-0 flex list-none flex-col p-0">
          {DETAIL_ROWS.filter(({ key }) => key !== 'subscriptions' || subscriptionsEnabled()).map(({ key, href }) => (
            <li key={key} className="border-b border-divider last:border-b-0">
              <Link
                href={href}
                aria-current={current === key ? 'page' : undefined}
                className={`flex items-center justify-between py-[10px] text-[15px] no-underline hover:text-accent ${current === key ? 'text-accent' : 'text-text'}`}
              >
                <span>{t(key)}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Card>
  );
}
