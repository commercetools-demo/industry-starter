import { useTranslations } from 'next-intl';
import { AuthCard } from '@/components/portal/AuthCard';
import { SignOutButton } from './SignOutButton';

/** A signed-in user without a portal role (for example a role that maps to neither Admin nor Buyer): refused, with Sign out. */
export function NoAccess() {
  const t = useTranslations('forbidden');
  return (
    <AuthCard title={t('title')} subtitle={t('body')}>
      <SignOutButton />
    </AuthCard>
  );
}
