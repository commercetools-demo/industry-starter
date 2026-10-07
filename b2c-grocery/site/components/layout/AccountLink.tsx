'use client';

import { User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAccount } from '@/hooks/useAccount';

/** Header account slot: "Sign in" icon button for visitors; the first name (or "Account") linking to the dashboard when signed in. */
export function AccountLink() {
  const t = useTranslations('auth');
  const { user } = useAccount();
  if (!user) {
    return (
      <Button href="/account/sign-in" variant="secondary" size="icon" aria-label={t('signInLink')}>
        <Icon icon={User} size={17} />
      </Button>
    );
  }
  const name = user.firstName.trim();
  return (
    <Button href="/account" variant="secondary" className="flex-none gap-2 whitespace-nowrap" aria-label={name ? t('accountLinkNamed', { name }) : t('accountLink')}>
      <Icon icon={User} size={17} />
      <span className="hidden max-w-[10ch] truncate desktop:inline">{name || t('accountLink')}</span>
    </Button>
  );
}
