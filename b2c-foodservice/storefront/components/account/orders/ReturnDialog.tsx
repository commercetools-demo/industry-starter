'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { ApiError } from '@/hooks/fetcher';
import type { ReturnLineDraft } from '@/hooks/useOrderActions';
import type { OrderView } from '@/lib/types';

const REASONS = ['damaged', 'wrong', 'notAsDescribed', 'changedMind'] as const;

interface Draft { checked: boolean; quantity: number; reason: string }

/**
 * "Start a return": the lines with units left to return, a quantity (1 to what remains) and a reason each. At least one
 * line must be ticked. The server repeats every check (a shopper cannot return more than remains).
 */
export default function ReturnDialog({
  order,
  open,
  onClose,
  onSubmit,
}: {
  order: OrderView;
  open: boolean;
  onClose: () => void;
  onSubmit: (items: ReturnLineDraft[]) => Promise<void>;
}) {
  const t = useTranslations('account.orders.return');
  const lines = order.lines.filter((l) => (order.returnable[l.id] ?? 0) > 0);
  const [picks, setPicks] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const pick = (lineId: string): Draft => picks[lineId] ?? { checked: false, quantity: 1, reason: '' };
  const set = (lineId: string, patch: Partial<Draft>) => setPicks((p) => ({ ...p, [lineId]: { ...pick(lineId), ...patch } }));
  const chosen = lines.filter((l) => pick(l.id).checked);

  const submit = async () => {
    if (chosen.length === 0) return setError(t('pickOne'));
    setError(null);
    setPending(true);
    try {
      await onSubmit(
        chosen.map((l) => {
          const p = pick(l.id);
          return { lineId: l.id, quantity: p.quantity, ...(p.reason ? { reason: p.reason } : {}) };
        }),
      );
      setPicks({});
      onClose();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'return_window_closed' ? t('closed') : t('failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('title')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <ul className="m-0 grid list-none gap-5 p-0">
          {lines.map((l) => {
            const p = pick(l.id);
            const max = order.returnable[l.id] ?? 1;
            return (
              <li key={l.id} className="rounded-field border border-line p-3.5">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14.5px] font-semibold text-ink">
                  <input type="checkbox" checked={p.checked} onChange={(e) => set(l.id, { checked: e.target.checked })} className="h-6 w-6 accent-accent" />
                  {l.name}
                </label>
                {p.checked ? (
                  <div className="mt-3 grid gap-3 xs:grid-cols-2">
                    <Field label={t('quantityLabel', { name: l.name })} htmlFor={`rq-${l.id}`}>
                      <Select id={`rq-${l.id}`} value={p.quantity} onChange={(e) => set(l.id, { quantity: Number(e.target.value) })}>
                        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('reason')} htmlFor={`rr-${l.id}`}>
                      <Select id={`rr-${l.id}`} value={p.reason} onChange={(e) => set(l.id, { reason: e.target.value })}>
                        <option value="">{t('reasons.none')}</option>
                        {REASONS.map((r) => (
                          <option key={r} value={r}>
                            {t(`reasons.${r}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {error ? (
          <p role="alert" className="mb-0 mt-4 text-[13.5px] font-medium text-danger-text">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end">
          <Button type="submit" loading={pending}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
