'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useIntervalLabel } from '@/components/cart/use-cart-ui';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useRecurrencePolicies } from '@/hooks/useRecurrencePolicies';

/** Radio list of the delivery intervals (H's policies); the current one is preselected and marked. The price stays (Fixed). */
export default function ChangeIntervalDialog({
  open, currentPolicyId, busy, onClose, onSave,
}: {
  open: boolean;
  currentPolicyId: string | null;
  busy: boolean;
  onClose: () => void;
  onSave: (policyId: string) => void;
}) {
  const t = useTranslations('subscription.dialog');
  const interval = useIntervalLabel();
  const { data } = useRecurrencePolicies();
  const policies = data?.policies ?? [];
  const [picked, setChosen] = useState<string | null>(null);
  const chosen = picked ?? currentPolicyId;
  const close = () => {
    setChosen(null);
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title={t('interval.title')}>
      <p className="m-0 mb-4 text-[14.5px] text-ink-2">{t('interval.text')}</p>
      <fieldset className="m-0 mb-5 grid gap-2 border-0 p-0">
        <legend className="sr-only">{t('interval.title')}</legend>
        {policies.map((p) => (
          <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-field border border-line px-4 py-2.5 text-[14.5px] text-ink">
            <input type="radio" name="interval" value={p.id} checked={chosen === p.id} onChange={() => setChosen(p.id)} className="accent-accent" />
            <span>{interval(p.schedule)}</span>
            {p.id === currentPolicyId ? <span className="ml-auto text-[12.5px] text-ink-3">{t('interval.current')}</span> : null}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-3 max-[519px]:flex-col">
        <Button variant="ink" loading={busy} disabled={!chosen || chosen === currentPolicyId} onClick={() => chosen && onSave(chosen)} className="max-[519px]:min-h-11">
          {t('save')}
        </Button>
        <Button variant="ghost" onClick={close} className="max-[519px]:min-h-11">
          {t('cancelLabel')}
        </Button>
      </div>
    </Modal>
  );
}
