// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useExitImpersonation } from '@/hooks/useExitImpersonation';
import { useRouter } from '@/i18n/routing';

/**
 * Shown above the header while a seller shops as a customer (V-06): "You are shopping as {name}. Orders are placed on their behalf." and
 * "Exit customer session". The name is first name and last initial only (the layout reads it on the server). Exit ends the session on the
 * server, hides the banner at once and refreshes the page so the signed-in state, cart and account link follow.
 */
export function ImpersonationBanner({ name, store }: { name: string | null; store: string }) {
  const t = useTranslations('impersonation');
  const router = useRouter();
  const { exit, isExiting, failed } = useExitImpersonation();
  const [ended, setEnded] = useState(false);
  if (ended) return null;

  async function onExit() {
    if (!(await exit())) return;
    setEnded(true);
    router.replace(`/${store}`);
    router.refresh();
  }

  return (
    <div role="status" className="border-b border-border bg-warning-50 text-text-body">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <p className="m-0 min-w-0 flex-1 font-ui text-sm">{name ? t('banner', { name }) : t('bannerUnnamed')}</p>
        <Button variant="secondary" onClick={onExit} disabled={isExiting}>
          {isExiting ? t('exiting') : t('exit')}
        </Button>
        {failed ? (
          <p role="alert" className="m-0 w-full font-ui text-xs text-danger-600">
            {t('exitFailed')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
