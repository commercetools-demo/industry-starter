/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Chip } from '@/components/portal/Chip';
import { Dialog } from '@/components/portal/Dialog';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSecondary, buttonSmall, cardClass, errorNote, inputClass, sectionTitle, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { useAccountActions, useAccountAddresses } from '@/hooks/accountApi';
import { failureText } from '@/hooks/sellerHttp';

const EMPTY = { streetName: '', streetNumber: '', postalCode: '', city: '', country: 'DE', makeDefault: false };

/** Account > Addresses: the signed-in customer's personal addresses (list, add, remove, make default). */
export function AddressesTab() {
  const t = useTranslations('account.addresses');
  const { data, error, isLoading } = useAccountAddresses();
  const { addAddress, removeAddress, makeDefault } = useAccountActions();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [rowError, setRowError] = useState('');
  const [busy, setBusy] = useState(false);
  const addresses = data?.addresses ?? [];
  const set = (key: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: key === 'makeDefault' ? event.target.checked : event.target.value }));

  function close() {
    setAdding(false);
    setForm(EMPTY);
    setFormError('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.streetName.trim() || !form.postalCode.trim() || !form.city.trim()) {
      setFormError(t('required'));
      return;
    }
    setBusy(true);
    setFormError('');
    const result = await addAddress({ ...form, country: form.country.trim().toUpperCase(), streetNumber: form.streetNumber.trim() || undefined });
    setBusy(false);
    if (result.ok) close();
    else setFormError(failureText(result, t('failed')));
  }

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setRowError('');
    const result = await action();
    if (!result.ok) setRowError(result.error ?? t('failed'));
  }

  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="acc-addresses-title">
      <div className="flex flex-wrap items-start justify-between gap-300">
        <div>
          <h2 id="acc-addresses-title" className={sectionTitle}>
            {t('title')}
          </h2>
          <p className="text-body-2 text-text-subdued">{t('subtitle')}</p>
        </div>
        <button type="button" className={buttonPrimary} onClick={() => setAdding(true)}>
          {t('add')}
        </button>
      </div>
      {error || rowError ? (
        <p role="alert" className={errorNote}>
          {rowError || t('loadFailed')}
        </p>
      ) : null}
      {isLoading ? (
        <p role="status" className="text-body-2 text-text-subdued">
          {t('loading')}
        </p>
      ) : (
        <div className={tableScroll} role="group" tabIndex={0} aria-labelledby="acc-addresses-title">
          <table className="w-full" aria-labelledby="acc-addresses-title">
            <thead>
              <tr>
                <th scope="col" className={thClass}>{t('address')}</th>
                <th scope="col" className={thClass}>{t('default')}</th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {addresses.map((address) => (
                <tr key={address.id} className="border-t border-border-subdued">
                  <td className={tdClass}>
                    {address.streetName} {address.streetNumber ?? ''}, {address.postalCode} {address.city}, {address.country}
                  </td>
                  <td className={tdClass}>
                    {address.isDefault ? (
                      <Chip tone="info">{t('defaultChip')}</Chip>
                    ) : (
                      <button type="button" className={buttonSmall} onClick={() => run(() => makeDefault(address.id))}>
                        {t('makeDefault')}
                      </button>
                    )}
                  </td>
                  <td className={tdClass}>
                    <button type="button" className={buttonSmall} onClick={() => run(() => removeAddress(address.id))}>
                      {t('remove')}
                    </button>
                  </td>
                </tr>
              ))}
              {addresses.length === 0 ? (
                <tr>
                  <td className={tdClass} colSpan={3}>
                    {t('empty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={adding}
        title={t('addTitle')}
        onClose={close}
        footer={
          <>
            <button type="button" className={buttonSecondary} onClick={close}>
              {t('cancel')}
            </button>
            <button type="submit" form="account-address-form" className={buttonPrimary} disabled={busy}>
              {busy ? t('saving') : t('save')}
            </button>
          </>
        }
      >
        <form id="account-address-form" onSubmit={submit} noValidate className="flex flex-col gap-300">
          <FormField id="aa-street" label={t('street')}>
            <input id="aa-street" className={inputClass} value={form.streetName} onChange={set('streetName')} />
          </FormField>
          <FormField id="aa-number" label={t('number')}>
            <input id="aa-number" className={inputClass} value={form.streetNumber} onChange={set('streetNumber')} />
          </FormField>
          <FormField id="aa-postal" label={t('postalCode')}>
            <input id="aa-postal" className={inputClass} value={form.postalCode} onChange={set('postalCode')} />
          </FormField>
          <FormField id="aa-city" label={t('city')}>
            <input id="aa-city" className={inputClass} value={form.city} onChange={set('city')} />
          </FormField>
          <FormField id="aa-country" label={t('country')} hint={t('countryHint')}>
            <input id="aa-country" className={inputClass} value={form.country} maxLength={2} onChange={set('country')} />
          </FormField>
          <label className="flex items-center gap-200 text-body-2 font-semibold text-text">
            <input type="checkbox" checked={form.makeDefault} onChange={set('makeDefault')} />
            {t('makeDefaultCheck')}
          </label>
          {formError ? (
            <p role="alert" className={errorNote}>
              {formError}
            </p>
          ) : null}
        </form>
      </Dialog>
    </section>
  );
}
