'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import useSWR from 'swr';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Field';
import { fetchJson } from '@/hooks/fetcher';
import { useAuthActions, type AuthResult } from '@/hooks/useAuthActions';

interface DemoItem { key: string; name: string; market: 'US' | 'CA' }

interface DemoSignInProps {
  onSignedIn: (result: AuthResult) => void | Promise<void>;
  onError: (error: unknown) => void;
}

/**
 * Demo customers (D-040). Rendered only when the server lists them, so a disabled demo leaves no gap. The browser sees
 * keys, names and markets; the server maps the key to the account and holds the password.
 */
export default function DemoSignIn({ onSignedIn, onError }: DemoSignInProps) {
  const t = useTranslations('auth.demo');
  const id = useId();
  const { demoSignIn } = useAuthActions();
  const { data } = useSWR<DemoItem[] | null>(
    'demo-customers',
    async () => {
      try {
        return (await fetchJson<{ customers: DemoItem[] }>('/api/auth/demo-customers')).customers;
      } catch {
        return null;
      }
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const [chosen, setChosen] = useState<string>('');
  const [pending, setPending] = useState(false);
  if (!data || data.length === 0) return null;

  const key = chosen || data[0].key;
  const groups = [
    { market: 'US' as const, label: t('groupUS') },
    { market: 'CA' as const, label: t('groupCA') },
  ];

  const submit = async () => {
    setPending(true);
    try {
      await onSignedIn(await demoSignIn(key));
    } catch (e) {
      onError(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card as="section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="m-0 font-display text-[16px] font-bold text-ink">
        {t('title')}
      </h2>
      <p className="mb-4 mt-1 text-[12.5px] text-ink-3">{t('hint')}</p>
      <Field label={t('label')} htmlFor={`${id}-select`}>
        <Select id={`${id}-select`} value={key} onChange={(e) => setChosen(e.target.value)}>
          {groups.map(({ market, label }) => (
            <optgroup key={market} label={label}>
              {data
                .filter((c) => c.market === market)
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {t(market === 'US' ? 'nameUS' : 'nameCA', { name: c.name })}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Button variant="ghost" block loading={pending} onClick={submit}>
        {t('submit')}
      </Button>
    </Card>
  );
}
