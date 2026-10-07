import type { ReactElement, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { FOCUS_RING_ON_BRAND } from '@/components/ui/focus';
import { cx } from '@/lib/cx';
import type { NavItem } from '@/lib/nav';
import { NavPill } from './NavPill';

type SiteHeaderProps = {
  /** Root categories; empty when the catalog is unavailable (the frame still renders). */
  items: NavItem[];
  /** Session-resolved slots, provided by the layout. */
  account: ReactNode;
  bundle: ReactNode;
};

export function SiteHeader({ items, account, bundle }: SiteHeaderProps): ReactElement {
  const t = useTranslations('shell');
  return (
    <header className="sticky top-0 z-10 bg-surface-brand text-text-on-brand shadow-sm">
      <div className="mx-auto flex w-full max-w-(--container-width) items-center gap-5 px-5 py-4 md:gap-8 md:px-10">
        <Link
          href="/"
          aria-label={t('home')}
          className={cx('rounded-pill font-display text-4xl font-bold leading-none tracking-widest text-brand-950 no-underline', FOCUS_RING_ON_BRAND)}
        >
          malva
        </Link>
        <nav aria-label={t('nav.primary')} className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          {items.map((item) => (
            <NavPill key={item.key} item={item} items={items} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-5 md:ml-0">
          <div className="hidden md:block">{account}</div>
          {bundle}
        </div>
      </div>
    </header>
  );
}
