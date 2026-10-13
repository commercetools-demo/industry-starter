'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Chip } from '@/components/portal/Chip';
import { Dialog } from '@/components/portal/Dialog';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSecondary, buttonSmall, cardClass, errorNote, inputClass, sectionTitle, selectClass, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { PermissionButton } from '@/components/portal/PermissionButton';
import { useCompanyActions, useCompanyAddresses } from '@/hooks/companyApi';
import { usePermissions } from '@/hooks/usePermissions';
import { failureText } from '@/hooks/sellerHttp';
import { ADDRESS_TYPES } from '@/lib/company/schemas';
import type { AddressType } from '@/lib/company/types';

const TYPE_KEY: Record<AddressType, string> = { Delivery: 'delivery', 'Delivery & billing': 'both', Billing: 'billing' };

const EMPTY = { label: '', streetName: '', streetNumber: '', postalCode: '', city: '', country: 'DE', type: 'Delivery' as AddressType, makeDefault: false };

/** Company addresses: Delivery, Delivery & billing, Billing; the default marker; Add and Make default are Admin only. */
export function AddressesTab() {
  const t = useTranslations('company.addresses');
  const tp = useTranslations('permissions');
  const { data, error, isLoading } = useCompanyAddresses();
  const { addAddress, makeDefault } = useCompanyActions();
  const { can } = usePermissions();
  const allowed = can('company.edit');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState('');
  const addresses = data?.addresses ?? [];
  const set = (key: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: key === 'makeDefault' ? (event.target as HTMLInputElement).checked : event.target.value }));

  function close() {
    setAdding(false);
    setForm(EMPTY);
    setFormError('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.label.trim() || !form.streetName.trim() || !form.postalCode.trim() || !form.city.trim()) {
      setFormError(t('required'));
      return;
    }
    setFormError('');
    setBusy(true);
    const result = await addAddress({ ...form, country: form.country.trim().toUpperCase(), streetNumber: form.streetNumber.trim() || undefined });
    setBusy(false);
    if (result.ok) close();
    else setFormError(failureText(result, t('failed')));
  }

  async function setDefault(id: string) {
    setRowError('');
    const result = await makeDefault(id);
    if (!result.ok) setRowError(failureText(result, t('failed')));
  }

  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="addresses-title">
      <div className="flex flex-wrap items-start justify-between gap-300">
        <div>
          <h2 id="addresses-title" className={sectionTitle}>
            {t('title')}
          </h2>
          <p className="text-body-2 text-text-subdued">{t('subtitle')}</p>
        </div>
        <PermissionButton action="company.edit" onClick={() => setAdding(true)}>
          {t('add')}
        </PermissionButton>
      </div>
      {error ? (
        <p role="alert" className={errorNote}>
          {t('loadFailed')}
        </p>
      ) : null}
      {rowError ? (
        <p role="alert" className={errorNote}>
          {rowError}
        </p>
      ) : null}
      {isLoading ? (
        <p role="status" className="text-body-2 text-text-subdued">
          {t('loading')}
        </p>
      ) : (
        <div className={tableScroll} role="group" tabIndex={0} aria-labelledby="addresses-title">
          <table className="w-full" aria-labelledby="addresses-title">
            <thead>
              <tr>
                <th scope="col" className={thClass}>{t('label')}</th>
                <th scope="col" className={thClass}>{t('address')}</th>
                <th scope="col" className={thClass}>{t('type')}</th>
                <th scope="col" className={thClass}>{t('default')}</th>
              </tr>
            </thead>
            <tbody>
              {addresses.map((address) => (
                <tr key={address.id} className="border-t border-border-subdued">
                  <td className={tdClass}>{address.label}</td>
                  <td className={tdClass}>
                    {address.streetName} {address.streetNumber ?? ''}, {address.postalCode} {address.city}, {address.country}
                  </td>
                  <td className={tdClass}>{t(`types.${TYPE_KEY[address.type]}`)}</td>
                  <td className={tdClass}>
                    {address.isDefault ? (
                      <Chip tone="info">{t('defaultChip')}</Chip>
                    ) : (
                      <button type="button" className={buttonSmall} disabled={!allowed} title={allowed ? undefined : tp('insufficient')} onClick={() => setDefault(address.id)}>
                        {t('makeDefault')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {addresses.length === 0 ? (
                <tr>
                  <td className={tdClass} colSpan={4}>
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
            <button type="submit" form="company-address-form" className={buttonPrimary} disabled={busy}>
              {busy ? t('saving') : t('save')}
            </button>
          </>
        }
      >
        <form id="company-address-form" onSubmit={submit} noValidate className="flex flex-col gap-300">
          <FormField id="ca-label" label={t('label')}>
            <input id="ca-label" className={inputClass} value={form.label} onChange={set('label')} />
          </FormField>
          <FormField id="ca-street" label={t('street')}>
            <input id="ca-street" className={inputClass} value={form.streetName} onChange={set('streetName')} />
          </FormField>
          <FormField id="ca-number" label={t('number')}>
            <input id="ca-number" className={inputClass} value={form.streetNumber} onChange={set('streetNumber')} />
          </FormField>
          <FormField id="ca-postal" label={t('postalCode')}>
            <input id="ca-postal" className={inputClass} value={form.postalCode} onChange={set('postalCode')} />
          </FormField>
          <FormField id="ca-city" label={t('city')}>
            <input id="ca-city" className={inputClass} value={form.city} onChange={set('city')} />
          </FormField>
          <FormField id="ca-country" label={t('country')} hint={t('countryHint')}>
            <input id="ca-country" className={inputClass} value={form.country} maxLength={2} onChange={set('country')} />
          </FormField>
          <FormField id="ca-type" label={t('type')}>
            <select id="ca-type" className={selectClass} value={form.type} onChange={set('type')}>
              {ADDRESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`types.${TYPE_KEY[type]}`)}
                </option>
              ))}
            </select>
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
