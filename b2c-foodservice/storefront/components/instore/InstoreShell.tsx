import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import '@/app/instore.css';
import InstoreBagButton from '@/components/instore/InstoreBagButton';
import InstoreProviders from '@/components/instore/InstoreProviders';
import { ScanFab, ScanHeaderButton } from '@/components/instore/ScanButtons';
import { Link } from '@/i18n/routing';

/**
 * The In-store companion's page frame (workstream R, D-041): a slim header with the brand, an unmistakable "In-store" badge, the
 * camera and the bag; the page; the floating camera button. No promise bar, mega menu, footer, store picker or locale chooser.
 * Pages must not render their own `<main>`.
 */
export default function InstoreShell({ children }: { children: ReactNode }) {
  const common = useTranslations('common');
  const t = useTranslations('instore');
  return (
    <InstoreProviders>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-130 focus:rounded-pill focus:bg-ink focus:px-5 focus:py-3 focus:text-surface"
      >
        {common('skipToContent')}
      </a>
      <header className="instore-header sticky top-0 z-40 border-b border-line-2 bg-surface" data-testid="instore-header">
        <div className="flex h-[68px] items-center gap-3 px-4">
          <Link href="/" aria-label={t('header.home')} className="flex min-w-0 flex-1 items-center gap-2.5 text-ink no-underline">
            <span className="wordmark truncate text-[19px]">{t('header.brand')}</span>
            <span
              data-testid="instore-badge"
              className="shrink-0 rounded-pill bg-ink px-3 py-1 text-[12px] font-bold uppercase tracking-[0.08em] text-surface"
            >
              {t('badge')}
            </span>
          </Link>
          <ScanHeaderButton />
          <InstoreBagButton />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="instore-main outline-none">
        {children}
      </main>
      <ScanFab />
    </InstoreProviders>
  );
}
