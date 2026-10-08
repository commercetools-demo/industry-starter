'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Inputs';
import { useRefillActions, type EnableResult } from '@/hooks/use-auto-refill';
import { useRouter } from '@/i18n/routing';
import { HttpError } from '@/lib/http';
import { CADENCES, type Cadence } from '@/lib/refill-types';

export interface RefillOption {
  /** The prescription number is shown (it is the patient's own page) and sent in the body only. */
  number: string;
  lines: { lineRef: string; name: string }[];
}

export interface EnableRefillFormProps {
  options: RefillOption[];
  /** False when the patient has no saved payment method (refills are charged to it); null when that could not be read. */
  hasMethod: boolean | null;
}

/** "Set up auto-refill": medicines (grouped by prescription), a cadence, one button. Every line is re-checked on the server. */
export function EnableRefillForm({ options, hasMethod }: EnableRefillFormProps) {
  const t = useTranslations('autoRefill.setup');
  const tc = useTranslations('autoRefill.cadence');
  const router = useRouter();
  const { enableRx } = useRefillActions();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EnableResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = (rx: string, ref: string) => `${rx}|${ref}`;
  const chosen = options.flatMap((o) => o.lines.filter((l) => picked[key(o.number, l.lineRef)]).map((l) => ({ rx: o.number, ref: l.lineRef })));
  const rxOfChosen = [...new Set(chosen.map((c) => c.rx))];

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // One standing order per prescription (a request names one prescription).
      let last: EnableResult | null = null;
      const notIncluded: EnableResult['notIncluded'] = [];
      const names: string[] = [];
      for (const rx of rxOfChosen) {
        last = await enableRx(rx, chosen.filter((c) => c.rx === rx).map((c) => c.ref), cadence);
        notIncluded.push(...last.notIncluded);
        names.push(...last.refill.lines.map((l) => l.name));
      }
      if (last) setResult({ refill: { ...last.refill, lines: names.map((name) => ({ name, quantity: 1 })) }, notIncluded });
      setPicked({});
      router.refresh();
    } catch (e) {
      setError(e instanceof HttpError && e.message ? e.message : t('failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-4" data-refill-setup>
      <div>
        <h2 className="font-display text-xl font-semibold text-navy-900">{t('title')}</h2>
        <p className="text-sm text-neutral-600">{t('intro')}</p>
      </div>
      {hasMethod === false ? (
        <div className="grid justify-items-start gap-2 rounded-md bg-warning-50 px-3.5 py-2.5 text-sm text-navy-900" data-need-method>
          <p>{t('needMethod')}</p>
          <ButtonLink href="/account/payment-methods" variant="outline" size="sm">
            {t('addMethod')}
          </ButtonLink>
        </div>
      ) : null}
      {options.length === 0 ? (
        <p className="text-neutral-600">{t('noRx')}</p>
      ) : (
        <>
          {options.map((option) => (
            <fieldset key={option.number} className="grid gap-2 border-0 p-0">
              <legend className="mb-1 font-meta text-sm font-bold text-navy-900">{t('rxHeading', { number: option.number })}</legend>
              {option.lines.map((line) => (
                <label key={line.lineRef} className="flex cursor-pointer items-center gap-3 text-sm text-navy-900">
                  <input type="checkbox" className="size-5 accent-brand-500" checked={!!picked[key(option.number, line.lineRef)]} onChange={(e) => setPicked((p) => ({ ...p, [key(option.number, line.lineRef)]: e.target.checked }))} />
                  {line.name}
                </label>
              ))}
            </fieldset>
          ))}
          <div className="flex flex-wrap items-end gap-2.5">
            <Select label={t('howOften')} value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)} fieldClassName="min-w-48">
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {tc(c)}
                </option>
              ))}
            </Select>
            <Button busy={busy} disabled={chosen.length === 0 || hasMethod === false} onClick={() => void submit()}>
              {busy ? t('starting') : t('start')}
            </Button>
          </div>
        </>
      )}
      {result ? (
        <div role="status" className="grid gap-1 rounded-md bg-info-50 px-3.5 py-2.5 text-sm text-navy-900" data-setup-result>
          <p>{t('done', { names: result.refill.lines.map((l) => l.name).join(', ') })}</p>
          {result.notIncluded.length > 0 ? <p data-not-included>{t('notIncluded', { names: result.notIncluded.map((n) => `${n.name} (${t(`reason.${n.reason}`)})`).join(', ') })}</p> : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
