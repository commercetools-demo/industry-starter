import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { FOCUS_RING_ON_BRAND } from '@/components/ui/focus';
import { cx } from '@/lib/cx';

/**
 * Presentational. `app/[locale]/_shell/AccountSlot.tsx` resolves the session on every request and passes the result in,
 * because components never import `lib/ct` (workstream B boundary).
 */
export function AccountLink({ signedIn, firstName }: { signedIn: boolean; firstName?: string }): ReactElement {
  const t = useTranslations('shell.account');
  const classes = cx(
    'inline-block max-w-40 truncate rounded-pill px-3 py-3 font-display text-sm font-semibold tracking-ui text-text-on-brand no-underline hover:underline',
    FOCUS_RING_ON_BRAND,
  );
  if (!signedIn) {
    return (
      <Link href="/login" className={classes}>
        {t('login')}
      </Link>
    );
  }
  return (
    <Link href="/account" className={classes}>
      {firstName ? t('greeting', { firstName }) : t('greetingNoName')}
    </Link>
  );
}
