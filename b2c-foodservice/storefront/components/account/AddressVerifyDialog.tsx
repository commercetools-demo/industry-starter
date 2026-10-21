'use client';

import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type { AddressInput } from '@/lib/types';

const line = (a: AddressInput) => [a.streetName, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ');

/**
 * Shown when the verifier cannot confirm an address. Nothing has been stored yet: the shopper decides to use the
 * suggestion, keep what they typed, or go back to edit.
 */
export default function AddressVerifyDialog({
  open,
  unresolved,
  suggestion,
  pending,
  onUseSuggestion,
  onKeepMine,
  onEdit,
}: {
  open: boolean;
  unresolved: string[];
  suggestion: AddressInput | null;
  pending: boolean;
  onUseSuggestion: () => void;
  onKeepMine: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations('account.addresses.verify');
  return (
    <Modal open={open} onClose={onEdit} title={t('title')}>
      <p className="m-0 mb-3 text-[14.5px] text-ink-2">{t('unresolved', { fields: unresolved.join(', ') })}</p>
      {suggestion ? <p className="m-0 mb-4 text-[14.5px] font-semibold text-ink">{t('suggestion', { address: line(suggestion) })}</p> : null}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onEdit}>
          {t('edit')}
        </Button>
        <Button variant="ghost" loading={pending} onClick={onKeepMine}>
          {t('keepMine')}
        </Button>
        {suggestion ? (
          <Button loading={pending} onClick={onUseSuggestion}>
            {t('useSuggestion')}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
