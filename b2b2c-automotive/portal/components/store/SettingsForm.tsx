'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Store & channels, tab Settings (workstream U-05): store name, logo and favicon, the read-only storefront address and the main
// location with a map. Admin only (the page gates it, every route checks again).
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState, type ChangeEvent } from 'react';
import { buttonPrimary, buttonSecondary, cardClass, errorNote, hintClass, infoNote, inputClass, labelClass, sectionTitle } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import { failureText } from '@/hooks/sellerHttp';
import { useStoreActions, useStoreSettings } from '@/hooks/storeApi';
import { LANGUAGES, locationSchema, nameSchema } from '@/lib/store/schemas';
import type { StoreSettings } from '@/lib/store/types';
import { LazyBranchMap } from './LazyBranchMap';

const ACCEPT = 'image/jpeg,image/png,image/webp';

function BrandingUpload({ kind, url, disabled }: { kind: 'logo' | 'favicon'; url?: string; disabled: boolean }) {
  const t = useTranslations('store.settings');
  const { uploadAsset } = useStoreActions();
  const { toast } = useToast();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    const result = await uploadAsset(kind, file);
    setBusy(false);
    input.value = '';
    if (result.ok) toast(t(kind === 'logo' ? 'logoSaved' : 'faviconSaved'));
    else setError(failureText(result, t('uploadFailed')));
  }

  return (
    <div className="flex flex-col gap-200">
      <label htmlFor={id} className={labelClass}>
        {t(kind)}
      </label>
      <div className="flex items-center gap-400">
        <div className="flex size-1200 flex-none items-center justify-center overflow-hidden rounded-300 border border-border bg-bg-surface-subdued">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a seller-uploaded asset on the Contentools host, not a build-time image
            <img src={url} alt={t(kind === 'logo' ? 'logoAlt' : 'faviconAlt')} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-caption-1 text-text-subdued">{t('noImage')}</span>
          )}
        </div>
        <input id={id} type="file" accept={ACCEPT} disabled={disabled || busy} onChange={onChange} className="min-w-0 text-body-2 text-text" />
      </div>
      <p className={hintClass}>{t(kind === 'logo' ? 'logoHint' : 'faviconHint')}</p>
      {busy ? (
        <p role="status" className={hintClass}>
          {t('uploading')}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={errorNote}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const asText = (value: number | string | undefined) => (value === undefined ? '' : String(value));

/** Loads the settings, then mounts the form with them as its starting values (the key remounts it after a save changed them). */
export function SettingsForm() {
  const t = useTranslations('store.settings');
  const { data: settings, error: loadError, isLoading } = useStoreSettings();
  if (loadError) return <p role="alert" className={errorNote}>{t('loadFailed')}</p>;
  if (isLoading || !settings) return <p role="status" className="text-body-2 font-semibold text-text-subdued">{t('loading')}</p>;
  return <SettingsFormBody key={JSON.stringify([settings.key, settings.name, settings.location])} settings={settings} />;
}

function SettingsFormBody({ settings }: { settings: StoreSettings }) {
  const t = useTranslations('store.settings');
  const { saveSettings, geocode } = useStoreActions();
  const { can } = usePermissions();
  const { toast } = useToast();
  const editable = can('store.edit');

  const [names, setNames] = useState<Record<string, string>>(() => ({ ...settings.name }));
  const [loc, setLoc] = useState(() => ({
    addressLine: settings.location.addressLine ?? '',
    postalCode: settings.location.postalCode ?? '',
    city: settings.location.city ?? '',
    countryCode: settings.location.countryCode ?? '',
    latitude: asText(settings.location.latitude),
    longitude: asText(settings.location.longitude),
  }));
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

  const point = useMemo(() => {
    const lat = loc.latitude.trim() === '' ? NaN : Number(loc.latitude);
    const lng = loc.longitude.trim() === '' ? NaN : Number(loc.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }, [loc.latitude, loc.longitude]);

  const setField = (key: keyof typeof loc) => (event: ChangeEvent<HTMLInputElement>) => setLoc((prev) => ({ ...prev, [key]: event.target.value }));

  function parsedLocation() {
    const trim = (v: string) => (v.trim() === '' ? undefined : v.trim());
    return locationSchema.safeParse({
      addressLine: trim(loc.addressLine),
      postalCode: trim(loc.postalCode),
      city: trim(loc.city),
      countryCode: trim(loc.countryCode)?.toUpperCase(),
      latitude: trim(loc.latitude) === undefined ? undefined : Number(loc.latitude),
      longitude: trim(loc.longitude) === undefined ? undefined : Number(loc.longitude),
    });
  }

  async function onSave() {
    setError('');
    const parsedName = nameSchema.safeParse(names);
    if (!parsedName.success) return setError(parsedName.error.issues[0].message);
    const parsedLoc = parsedLocation();
    if (!parsedLoc.success) return setError(parsedLoc.error.issues[0].message);
    setBusy(true);
    const result = await saveSettings({ name: parsedName.data, location: parsedLoc.data });
    setBusy(false);
    if (result.ok) toast(t('saved'));
    else setError(failureText(result, t('saveFailed')));
  }

  async function onFind() {
    setNote('');
    setError('');
    const address = [loc.addressLine, loc.postalCode, loc.city, loc.countryCode].map((s) => s.trim()).filter(Boolean).join(', ');
    const result = await geocode(address);
    if (!result.ok) return setError(failureText(result, t('geocodeFailed')));
    const hit = result.data?.result;
    if (!hit) return setNote(t(result.data?.unavailable ? 'geocodeUnavailable' : 'geocodeNone'));
    setLoc((prev) => ({ ...prev, latitude: String(hit.lat), longitude: String(hit.lng) }));
    setCenter({ lat: hit.lat, lng: hit.lng });
    setNote(t('geocodeFound', { label: hit.label }));
  }

  const field = (key: keyof typeof loc, label: string, props: { inputMode?: 'decimal'; maxLength?: number } = {}) => (
    <label className="flex flex-col gap-100">
      <span className={labelClass}>{label}</span>
      <input value={loc[key]} onChange={setField(key)} disabled={!editable} className={inputClass} {...props} />
    </label>
  );

  return (
    <div className="flex flex-col gap-400">
      <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="store-identity">
        <h2 id="store-identity" className={sectionTitle}>
          {t('identity')}
        </h2>
        <div className="grid gap-400 md:grid-cols-2">
          {LANGUAGES.map((language) => (
            <label key={language} className="flex flex-col gap-100">
              <span className={labelClass}>{t('name', { language })}</span>
              <input value={names[language] ?? ''} onChange={(e) => setNames((prev) => ({ ...prev, [language]: e.target.value }))} disabled={!editable} maxLength={80} className={inputClass} />
            </label>
          ))}
        </div>
        <div className="grid gap-400 md:grid-cols-2">
          <BrandingUpload kind="logo" url={settings.logoUrl} disabled={!editable} />
          <BrandingUpload kind="favicon" url={settings.faviconUrl} disabled={!editable} />
        </div>
        <div className="flex flex-col gap-100">
          <label htmlFor="store-address" className={labelClass}>
            {t('address')}
          </label>
          <input id="store-address" value={settings.address} readOnly aria-describedby="store-address-hint" className={inputClass} />
          <span id="store-address-hint" className={hintClass}>
            {t('addressHint')}
          </span>
        </div>
        <div className="grid gap-400 md:grid-cols-2">
          <label className="flex flex-col gap-100">
            <span className={labelClass}>{t('currency')}</span>
            <input value={settings.currency ?? ''} readOnly className={inputClass} />
            <span className={hintClass}>{t('managedByMalva')}</span>
          </label>
          <label className="flex flex-col gap-100">
            <span className={labelClass}>{t('country')}</span>
            <input value={settings.defaultCountry ?? ''} readOnly className={inputClass} />
            <span className={hintClass}>{t('managedByMalva')}</span>
          </label>
        </div>
      </section>

      <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="store-location">
        <h2 id="store-location" className={sectionTitle}>
          {t('location')}
        </h2>
        <div className="grid gap-400 lg:grid-cols-2">
          <div className="flex flex-col gap-300">
            {field('addressLine', t('addressLine'), { maxLength: 120 })}
            <div className="grid gap-300 sm:grid-cols-3">
              {field('postalCode', t('postalCode'), { maxLength: 20 })}
              {field('city', t('city'), { maxLength: 80 })}
              {field('countryCode', t('countryCode'), { maxLength: 2 })}
            </div>
            <div className="grid gap-300 sm:grid-cols-2">
              {field('latitude', t('latitude'), { inputMode: 'decimal' })}
              {field('longitude', t('longitude'), { inputMode: 'decimal' })}
            </div>
            <div>
              <button type="button" onClick={onFind} disabled={!editable} className={buttonSecondary}>
                {t('findCoordinates')}
              </button>
            </div>
            {note ? (
              <p role="status" className={infoNote}>
                {note}
              </p>
            ) : null}
          </div>
          <div className="h-6400">
            <LazyBranchMap
              points={[]}
              value={point}
              center={center}
              label={t('mapLabel')}
              pinName={t('pinName')}
              onPick={editable ? (lat, lng) => setLoc((prev) => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) })) : undefined}
            />
          </div>
        </div>
        <p className={hintClass}>{t('mapHint')}</p>
      </section>

      {error ? (
        <p role="alert" className={errorNote}>
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-300">
        <button type="button" onClick={onSave} disabled={!editable || busy} className={buttonPrimary}>
          {busy ? t('saving') : t('save')}
        </button>
        {editable ? null : <span className={hintClass}>{t('readOnly')}</span>}
      </div>
    </div>
  );
}
