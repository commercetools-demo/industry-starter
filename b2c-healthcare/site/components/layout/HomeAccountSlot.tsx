'use client';
import { useTranslations } from 'next-intl';
import { useAccount } from '@/hooks/use-account';
import { ButtonLink } from '@/components/ui/Button';
import { AccountSlot, SIGN_IN_HREF } from './AccountSlot';
import { CartButton } from './CartButton';

/**
 * Account area of the marketing (home) header, resolved from the session on every request: an anonymous
 * visitor or an expired session gets the "Sign in" outline button and no cart or identity; a signed-in
 * patient gets the cart with its line count and the initials avatar, the same as the app header.
 */
export function HomeAccountSlot() {
  const t = useTranslations('shell');
  const { data: user } = useAccount();
  if (!user) {
    return (
      <ButtonLink href={SIGN_IN_HREF} variant="outline" size="sm" className="max-sm:hidden">
        {t('signIn')}
      </ButtonLink>
    );
  }
  return (
    <>
      <CartButton className="max-sm:hidden" />
      <AccountSlot />
    </>
  );
}
