'use client';
import { useLocale, useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { usePathname } from '@/i18n/routing';
import { toNextParam } from '@/lib/next-path';
import { SIGN_IN_HREF } from './AccountSlot';

export type SignInReason = 'cart' | 'prescriptions' | 'checkout' | 'order' | 'labs' | 'account';

export interface RequireSignInProps {
  reason: SignInReason;
  /** Locale-less path to come back to; defaults to the current route. */
  returnTo?: string;
}

/**
 * In-place prompt for a route that needs an account: says why, and links to sign-in with `?next=` set
 * to this route so the patient lands back here afterwards (validated by `sanitizeNext` on arrival).
 * The caller decides who sees it (a server page checks the session); this renders no patient data.
 */
export function RequireSignIn({ reason, returnTo }: RequireSignInProps) {
  const t = useTranslations('shell.signInRequired');
  const locale = useLocale();
  const pathname = usePathname();
  const next = toNextParam(locale, returnTo ?? pathname);
  return (
    <div className="mx-auto max-w-content px-5 nav:px-8">
      <Card className="mx-auto my-14 grid max-w-110 gap-4" data-sign-in-required>
        <div>
          <h2 className="font-display text-2xl font-semibold text-text-heading">{t('title')}</h2>
          <p className="mt-1.5 text-sm text-neutral-600">{t(reason)}</p>
        </div>
        <ButtonLink href={{ pathname: SIGN_IN_HREF, query: { next } }} full>
          {t('action')}
        </ButtonLink>
      </Card>
    </div>
  );
}
