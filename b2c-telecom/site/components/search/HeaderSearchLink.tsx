import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING_ON_BRAND } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';

function MagnifierIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="1.25rem" height="1.25rem" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

/**
 * The header entry to the search page (undrawn: Junior design choice, D-068; the design has no search entry, sign-off requested).
 * An icon-only 44 x 44 target with an accessible name. Shown from 768 px up: below that the same link is the first item of the drawer.
 */
export function HeaderSearchLink(): ReactElement {
  const t = useTranslations('search');
  return (
    <Link
      href="/search"
      aria-label={t('open')}
      className={cx('hidden min-h-11 min-w-11 items-center justify-center rounded-pill text-text-on-brand no-underline hover:bg-brand-600 md:inline-flex', FOCUS_RING_ON_BRAND)}
    >
      <MagnifierIcon />
    </Link>
  );
}

/** The drawer's first item: icon and label, closes the drawer on click. */
export function DrawerSearchLink({ onNavigate }: { onNavigate: () => void }): ReactElement {
  const t = useTranslations('search');
  return (
    <Link
      href="/search"
      onClick={onNavigate}
      className={cx('inline-flex min-h-11 items-center gap-3 rounded-pill bg-brand-100 px-5 py-3 font-display text-sm font-semibold text-brand-950 no-underline hover:bg-brand-200', FOCUS_RING_ON_BRAND)}
    >
      <MagnifierIcon />
      {t('open')}
    </Link>
  );
}
