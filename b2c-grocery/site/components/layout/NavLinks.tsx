import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cx } from '@/components/ui/cx';

export const NAV_ITEMS = [
  { key: 'shop', href: '/shop' },
  { key: 'new', href: '/shop?sort=newest' },
  { key: 'journal', href: '/journal' },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]['key'];

type NavLinksProps = {
  /** The item that gets `aria-current="page"`; `null` renders none (used as the server fallback). */
  active: NavKey | null;
  stacked?: boolean;
  onNavigate?: () => void;
  className?: string;
};

/** Primary links (Shop, New in, Journal). Presentational: `PrimaryNav` decides which one is active. */
export function NavLinks({ active, stacked, onNavigate, className }: NavLinksProps) {
  const t = useTranslations('nav');
  return (
    <nav aria-label={t('primary')} className={className}>
      <ul className={cx('m-0 flex list-none p-0', stacked ? 'flex-col gap-(--space-3)' : 'items-center gap-(--space-6)')}>
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={active === item.key ? 'page' : undefined}
              onClick={onNavigate}
              className="inline-block border-b-2 border-transparent py-(--space-1) text-[14px] font-medium whitespace-nowrap text-text no-underline hover:text-accent-700 aria-[current=page]:border-accent aria-[current=page]:text-accent-700"
            >
              {t(item.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
