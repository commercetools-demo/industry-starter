'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from '@/i18n/routing';
import { useAuthMutations } from '@/hooks/useAuthMutations';
import { submitErrorKey } from './errors';

/** "Log out": clears the session, empties the bundle cache and goes home. Used by the account pages (S). */
export function LogoutButton(): ReactElement {
  const t = useTranslations('auth');
  const router = useRouter();
  const toast = useToast();
  const { logout } = useAuthMutations();
  const [pending, setPending] = useState(false);

  async function onClick(): Promise<void> {
    setPending(true);
    try {
      await logout();
      router.replace('/');
      router.refresh();
    } catch (error) {
      toast.show({ message: t(submitErrorKey(error)), tone: 'error' });
      setPending(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={onClick}>
      {pending ? t('logout.pending') : t('logout.label')}
    </Button>
  );
}
