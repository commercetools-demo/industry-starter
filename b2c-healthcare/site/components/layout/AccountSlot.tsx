'use client';
import { useTranslations } from 'next-intl';
import { useAccount } from '@/hooks/use-account';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { initialsOf } from '@/lib/initials';

/** Path of the sign-in page. */
export const SIGN_IN_HREF = '/login';

/**
 * Header account slot: "Sign in" for an anonymous visitor, otherwise a 36 px initials avatar that
 * links to the account. Identity comes from the session-resolved SWR user (`useAccount`), never from markup.
 */
export function AccountSlot({ className }: { className?: string }) {
  const t = useTranslations('shell');
  const { data: user } = useAccount();
  if (!user) {
    return (
      <ButtonLink href={SIGN_IN_HREF} size="sm" className={className}>
        {t('signIn')}
      </ButtonLink>
    );
  }
  const initials = initialsOf(user.firstName, user.lastName);
  return (
    <Link href="/account" aria-label={t('account')} className={className} data-account-link>
      <Avatar tone="brand" size="sm" initials={initials || '·'} />
    </Link>
  );
}
