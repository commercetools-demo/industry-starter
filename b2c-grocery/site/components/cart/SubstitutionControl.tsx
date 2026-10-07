'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { useCartContext } from '@/context/CartProvider';
import type { CartLine, SubstitutionPreference } from '@/lib/types';

/**
 * Per-line substitution preference ("Allow similar" / "No substitution"). The choice shows immediately and rolls back
 * (with a toast) when the server refuses; the saved value comes from the line.
 */
export function SubstitutionControl({ line }: { line: CartLine }) {
  const t = useTranslations('cart');
  const toast = useToast();
  const { setSubstitution } = useCartContext();
  const [pending, setPending] = useState<SubstitutionPreference | null>(null);
  const value = pending ?? line.substitutionPreference;

  const change = async (next: string) => {
    if (next !== 'allow-similar' && next !== 'none') return;
    if (next === value) return;
    setPending(next);
    try {
      await setSubstitution(line.id, next);
    } catch {
      toast.show({ message: t('updateFailed') });
    } finally {
      setPending(null);
    }
  };

  return (
    <Segmented
      label={t('substitution.label', { name: line.name })}
      name={`substitution-${line.id}`}
      value={value}
      onChange={(v) => void change(v)}
      options={[
        { value: 'allow-similar', label: t('substitution.allow-similar') },
        { value: 'none', label: t('substitution.none') },
      ]}
    />
  );
}
