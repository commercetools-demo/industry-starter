'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Dialog } from '@/components/portal/Dialog';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSecondary, errorNote, inputClass } from '@/components/portal/kit';
import { campaignApi } from '@/hooks/marketingApi';
import { parsePriceCents } from '@/lib/import/local-product';

const textareaClass =
  'min-h-3200 w-full rounded-300 border border-border-input bg-bg-surface px-300 py-250 text-body-2 font-medium text-text placeholder:text-text-disabled focus-visible:outline-2 focus-visible:outline-border-active';

/** Proof of spend of a campaign: amount, invoice reference and note (no file upload, Q-W09). The server sets the status `submitted`. */
export function ClaimDialog({ open, name, campaignKey, storeKey, onClose, onSent }: { open: boolean; name: string; campaignKey: string; storeKey: string; onClose: () => void; onSent: () => void }) {
  const t = useTranslations('marketing');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  const validate = (): string => {
    if (parsePriceCents(amount) === null) return t('errors.invalidAmount');
    if (reference.trim() === '') return t('errors.referenceRequired');
    if (reference.trim().length > 80) return t('errors.referenceTooLong');
    if (note.length > 500) return t('errors.noteTooLong');
    return '';
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validate();
    setProblem(invalid);
    if (invalid) return;
    setBusy(true);
    const result = await campaignApi.claim(storeKey, campaignKey, { amountCents: parsePriceCents(amount) as number, invoiceReference: reference.trim(), note });
    setBusy(false);
    if (result.ok) return onSent();
    setProblem(
      result.code === 'CLAIM_PENDING' ? t('errors.claimPending') : result.code === 'CLAIM_CLOSED' ? t('errors.claimClosed') : result.status === 403 ? t('errors.forbidden') : t('errors.generic'),
    );
  }

  return (
    <Dialog
      open={open}
      title={t('claimDialog.title', { name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>
            {t('claimDialog.cancel')}
          </button>
          <button type="submit" form="coop-claim-form" className={buttonPrimary} disabled={busy}>
            {t('claimDialog.submit')}
          </button>
        </>
      }
    >
      <form id="coop-claim-form" onSubmit={submit} noValidate className="flex flex-col gap-400">
        <FormField id="claim-amount" label={t('claimDialog.amount')} hint={t('claimDialog.amountHint')}>
          <input id="claim-amount" className={inputClass} inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <FormField id="claim-reference" label={t('claimDialog.reference')}>
          <input id="claim-reference" className={inputClass} maxLength={120} autoComplete="off" value={reference} onChange={(e) => setReference(e.target.value)} />
        </FormField>
        <FormField id="claim-note" label={t('claimDialog.note')}>
          <textarea id="claim-note" className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        {problem ? (
          <p role="alert" className={errorNote}>
            {problem}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
