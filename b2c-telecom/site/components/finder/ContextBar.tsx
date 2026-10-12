'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/cx';
import { Field, Input, Select } from '@/components/ui/Field';
import { useBuyerContextActions } from '@/hooks/useFinder';
import type { BuyerContextView } from '@/app/api/buyer-context/route';
import type { CustomerType, Technology } from '@/lib/types';

type ContextBarProps = {
  context: BuyerContextView;
  actions: ReturnType<typeof useBuyerContextActions>;
};

const CUSTOMER_TYPES: CustomerType[] = ['consumer', 'small-business', 'employee'];
const EXISTING = ['unspecified', 'yes', 'no'] as const;
const TECHNOLOGIES: Technology[] = ['cable', 'fixed-wireless', 'mobile'];

/**
 * The buyer context bar: customer type, existing customer and service location. A signed-in customer's type and status come from the
 * account (read-only, labelled); an anonymous visitor's are declared here and stored in a cookie. The location is never an account fact.
 */
export function ContextBar({ context, actions }: ContextBarProps): ReactElement {
  const t = useTranslations('finder.context');
  const ts = useTranslations('serviceability');
  const [zip, setZip] = useState(context.location?.postalCode ?? '');
  const [zipError, setZipError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [declareError, setDeclareError] = useState(false);
  const readOnly = context.fromAccount;
  // An employee's group decides everything: whether they are an existing customer changes no plan, price or discount, so the control is hidden.
  const employee = context.customerType === 'employee';
  const location = context.location;

  async function declare(patch: Parameters<typeof actions.declare>[0]): Promise<void> {
    setDeclareError(!(await actions.declare(patch)));
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setZipError(null);
    const outcome = await actions.enterZip(zip.trim());
    setBusy(false);
    if (!outcome.ok) setZipError(outcome.reason === 'invalid' ? ts('invalid') : t('zipFailed'));
  }

  async function clear(): Promise<void> {
    setBusy(true);
    if (await actions.clearZip()) setZip('');
    else setZipError(t('zipFailed'));
    setBusy(false);
  }

  const served = location ? TECHNOLOGIES.filter((technology) => location.served[technology]) : [];

  return (
    <section aria-labelledby="finder-context-title" className="flex flex-col gap-4 rounded-lg border border-neutral-300 bg-surface p-5">
      <h2 id="finder-context-title" className="m-0 font-display text-lg font-bold">
        {t('title')}
      </h2>
      <div className={cx('grid grid-cols-1 gap-4', employee ? 'md:grid-cols-2' : 'md:grid-cols-3')}>
        <Field label={t('customerType.label')} hint={readOnly ? t('fromAccount') : undefined}>
          <Select value={context.customerType} disabled={readOnly} onChange={(event) => void declare({ customerType: event.target.value as CustomerType })}>
            {CUSTOMER_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`customerType.${type}`)}
              </option>
            ))}
          </Select>
        </Field>
        {employee ? null : (
          <Field label={t('existing.label')} hint={readOnly ? t('fromAccount') : undefined}>
            <Select value={context.existingCustomer} disabled={readOnly} onChange={(event) => void declare({ existingCustomer: event.target.value as (typeof EXISTING)[number] })}>
              {EXISTING.map((value) => (
                <option key={value} value={value}>
                  {t(`existing.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-3">
          <Field label={t('zip.label')} error={zipError ?? undefined} errorLive>
            <div className="flex gap-3">
              <Input inputMode="numeric" autoComplete="postal-code" maxLength={10} value={zip} onChange={(event) => setZip(event.target.value)} />
              <Button type="submit" size="sm" variant="secondary" loading={busy}>
                {t('zip.apply')}
              </Button>
            </div>
          </Field>
        </form>
      </div>
      {declareError ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {t('declareFailed')}
        </p>
      ) : null}
      <div aria-live="polite" className="flex flex-wrap items-center gap-3 text-sm">
        {location ? (
          <>
            <span>{location.anyServed ? ts('partial', { postalCode: location.postalCode, technologies: served.map((technology) => ts(`tech.${technology}`)).join(', ') }) : t('notServed', { postalCode: location.postalCode })}</span>
            {location.state ? <span className="text-text-muted">{t('zip.state', { state: location.state })}</span> : null}
            <Button size="sm" variant="ghost" onClick={() => void clear()} disabled={busy}>
              {t('zip.clear')}
            </Button>
          </>
        ) : (
          <span className="text-text-muted">{t('zip.none')}</span>
        )}
      </div>
    </section>
  );
}
