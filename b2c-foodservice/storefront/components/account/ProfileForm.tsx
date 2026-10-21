'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import PanelState from '@/components/account/PanelState';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/context/toast';
import { ApiError } from '@/hooks/fetcher';
import { useAddresses } from '@/hooks/useAddresses';
import { useProfile } from '@/hooks/useProfile';
import type { AccountProfile } from '@/lib/types';

/** Profile card: names, read-only email, the phone of the default address, and the default address itself. */
export default function ProfileForm() {
  const t = useTranslations('account.profile');
  const tTabs = useTranslations('account.tabs');
  const { profile, isLoading, isError, reload, save } = useProfile();
  const book = useAddresses();
  return (
    <section aria-labelledby="profile-heading">
      <h2 id="profile-heading" className="m-0 mb-[18px] font-display text-[22px] font-bold text-ink">
        {t('title')}
      </h2>
      <PanelState
        panel={tTabs('profile')}
        isLoading={isLoading && !profile}
        isError={isError && !profile}
        isEmpty={false}
        onRetry={() => void reload()}
        empty={null}
      >
        {profile ? <ProfileFields key={JSON.stringify(profile)} profile={profile} addresses={book.addresses ?? []} save={save} /> : null}
      </PanelState>
    </section>
  );
}

function ProfileFields({
  profile,
  addresses,
  save,
}: {
  profile: AccountProfile;
  addresses: { id: string; label: string | null; streetName: string }[];
  save: (change: { firstName?: string; lastName?: string; phone?: string; defaultShippingAddressId?: string }) => Promise<void>;
}) {
  const t = useTranslations('account.profile');
  const toast = useToast();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [defaultId, setDefaultId] = useState(profile.defaultShippingAddressId ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const noAddress = addresses.length === 0 && !profile.defaultShippingAddressId;

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!firstName.trim()) found.firstName = 'required';
    if (!lastName.trim()) found.lastName = 'required';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    try {
      await save({
        firstName, lastName,
        ...(noAddress ? {} : { phone }),
        ...(defaultId && defaultId !== profile.defaultShippingAddressId ? { defaultShippingAddressId: defaultId } : {}),
      });
      toast.show(t('saved'));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'validation_failed' && e.extra.fields) setErrors(e.extra.fields as Record<string, string>);
      else toast.show(t('failed'));
    } finally {
      setPending(false);
    }
  };
  const err = (k: string) => (errors[k] ? t(`error.${errors[k]}` as 'error.invalid') : undefined);

  return (
    <Card>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-x-4 xs:grid-cols-2">
          <Field label={t('firstName')} htmlFor="profile-firstName" error={err('firstName')}>
            <Input id="profile-firstName" value={firstName} invalid={Boolean(errors.firstName)} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label={t('lastName')} htmlFor="profile-lastName" error={err('lastName')}>
            <Input id="profile-lastName" value={lastName} invalid={Boolean(errors.lastName)} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </Field>
        </div>
        <Field label={t('email')} htmlFor="profile-email" hint={t('emailHelp')}>
          <Input id="profile-email" value={profile.email} readOnly aria-describedby="profile-email-hint" autoComplete="email" />
        </Field>
        <Field label={t('phone')} htmlFor="profile-phone" error={err('phone')} hint={noAddress ? t('phoneNoAddress') : t('phoneHelp')}>
          <Input
            id="profile-phone"
            type="tel"
            value={noAddress ? '' : phone}
            disabled={noAddress}
            invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'profile-phone-error' : 'profile-phone-hint'}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </Field>
        <Field label={t('defaultAddress')} htmlFor="profile-default">
          <Select id="profile-default" value={defaultId} disabled={addresses.length === 0} onChange={(e) => setDefaultId(e.target.value)}>
            {addresses.length === 0 ? <option value="">{t('defaultAddressNone')}</option> : null}
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label ? `${a.label} · ${a.streetName}` : a.streetName}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" loading={pending}>
          {t('save')}
        </Button>
      </form>
    </Card>
  );
}
