/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { secondaryButtonClass } from '@/components/portal/AuthCard';
import { useHardNavigate } from '@/hooks/useHardNavigate';
import { authApi } from '@/hooks/useAuthApi';

/** Signs out from a status page (pending approval, no access) and returns to the sign-in screen. */
export function SignOutButton() {
  const t = useTranslations('auth.pending');
  const go = useHardNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authApi.signOut();
        go('/sign-in');
      }}
      className={secondaryButtonClass}
    >
      {t('signOut')}
    </button>
  );
}
