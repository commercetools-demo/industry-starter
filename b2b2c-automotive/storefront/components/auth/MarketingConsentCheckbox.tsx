// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

/**
 * "Send me offers by e-mail" (W-07), for the registration form AND the account profile. Controlled; the parent starts it UNCHECKED
 * (`useState(false)`; never pre-checked) and sends the value to the server: registration posts `marketingConsent` to `/api/auth/register`,
 * the profile page to `PUT /api/account/profile` (workstream Q), which write `malva-customer.marketingConsent` and `marketingConsentAt`.
 * It only records consent for the portal's audience counts; nothing is ever sent. `status` is announced next to the box (saved, failed).
 */
export function MarketingConsentCheckbox({ checked, onChange, disabled = false, status }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; status?: string }) {
  const t = useTranslations('marketingConsent');
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-describedby={`${id}-hint`} className="mt-1 size-5 shrink-0 accent-action" />
      <div className="grid gap-1">
        <label htmlFor={id} className="font-ui text-sm text-text">
          {t('label')}
        </label>
        <p id={`${id}-hint`} className="m-0 font-ui text-xs text-text-subtle">
          {t('hint')}
        </p>
        <p role="status" className="m-0 font-ui text-xs text-text-muted">
          {status ?? ''}
        </p>
      </div>
    </div>
  );
}
