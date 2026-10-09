'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useAuthActions } from '@/components/auth/useAuthActions';
import { useRouter } from '@/i18n/routing';

/** Ends the session, clears every per-visitor client cache, and leaves the portal. `replace` keeps Back from returning to it. */
export function SignOutButton() {
  const t = useTranslations('portal');
  const router = useRouter();
  const { signOut } = useAuthActions();
  return (
    <Button variant="outline" small className="portal-signout" onClick={async () => { await signOut(); router.replace('/'); router.refresh(); }}>{t('signOut')}</Button>
  );
}
