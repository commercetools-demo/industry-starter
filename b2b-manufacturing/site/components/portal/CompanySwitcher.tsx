'use client';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { useTranslations } from 'next-intl';
import { useBusinessUnits, selectBusinessUnit } from '@/hooks/useBusinessUnits';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { useRouter } from '@/i18n/routing';
import { clearClientState } from '@/lib/client-state';

/** Shown only for users in two or more companies. Switching rewrites the business context on the server, then drops everything cached for the other company. */
export function CompanySwitcher() {
  const t = useTranslations('portal');
  const { businessUnits, current } = useBusinessUnits();
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const [message, setMessage] = useState('');
  if (businessUnits.length < 2) return null;

  async function change(key: string) {
    setMessage('');
    try {
      await selectBusinessUnit(key);
      await clearClientState(mutate as never);
      setMessage(t('switched', { name: businessUnits.find((u) => u.key === key)?.name ?? key }));
      router.refresh();
    } catch {
      setMessage(t('switchFailed'));
    }
  }

  return (
    <div>
      <label htmlFor="company-switch" className="overline" style={{ display: 'block', marginBottom: 6 }}>{t('company')}</label>
      <select id="company-switch" value={current ?? ''} onChange={(event) => void change(event.target.value)}>
        {businessUnits.map((unit) => <option key={unit.key} value={unit.key}>{unit.name}</option>)}
      </select>
      <LiveRegion>{message}</LiveRegion>
    </div>
  );
}
