/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/use-auth';

/** Ends the session, clears the patient-scoped client state and goes to `/login` (all inside `useAuth().signOut`). */
export function SignOutButton() {
  const t = useTranslations('account.nav');
  const toast = useToast();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      busy={busy}
      onClick={async () => {
        setBusy(true);
        const ok = await signOut();
        if (!ok) {
          setBusy(false);
          toast.show({ message: t('signOutFailed') });
        }
      }}
    >
      {t('signOut')}
    </Button>
  );
}
