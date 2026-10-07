'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { Tag } from '@/components/ui/Tag';
import { cx } from '@/lib/cx';
import type { SavedAddress } from '@/lib/types';

const ACTION = cx('min-h-9 bg-transparent p-0 font-display text-sm font-semibold text-text-link underline underline-offset-4 disabled:opacity-50', FOCUS_RING);

export interface AddressCardProps {
  address: SavedAddress;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMakeDefault: (kind: 'service' | 'billing') => void;
}

/** One saved address: its lines, its tags (defaults and purposes) and its actions. A "make default" action is hidden when it already is the default or the address does not serve that purpose. */
export function AddressCard({ address, busy, onEdit, onDelete, onMakeDefault }: AddressCardProps): ReactElement {
  const t = useTranslations('account.addresses');
  const name = `${address.firstName} ${address.lastName}`.trim();
  const region = [address.state, address.postalCode].filter(Boolean).join(' ');
  return (
    <li className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-surface p-7" data-address-id={address.id}>
      <div className="flex flex-wrap gap-3" aria-label={name}>
        {address.isDefaultService ? <Tag tone="pink">{t('tag.defaultService')}</Tag> : address.isService ? <Tag tone="neutral">{t('tag.service')}</Tag> : null}
        {address.isDefaultBilling ? <Tag tone="brand">{t('tag.defaultBilling')}</Tag> : address.isBilling ? <Tag tone="neutral">{t('tag.billing')}</Tag> : null}
      </div>
      <address className="m-0 flex flex-col text-md not-italic">
        <span className="font-display text-lg font-bold">{name}</span>
        <span>{address.streetName}</span>
        {address.additionalStreetInfo ? <span>{address.additionalStreetInfo}</span> : null}
        <span>{[address.city, region].filter(Boolean).join(', ')}</span>
        <span>{t(`countries.${address.country}`)}</span>
        {address.phone ? <span>{address.phone}</span> : null}
      </address>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <button type="button" className={ACTION} onClick={onEdit} disabled={busy}>
          {t('actions.edit')}
          <span className="sr-only"> {name}</span>
        </button>
        <button type="button" className={ACTION} onClick={onDelete} disabled={busy}>
          {t('actions.delete')}
          <span className="sr-only"> {name}</span>
        </button>
        {address.isService && !address.isDefaultService ? (
          <button type="button" className={ACTION} onClick={() => onMakeDefault('service')} disabled={busy}>
            {t('makeDefaultService')}
            <span className="sr-only"> {name}</span>
          </button>
        ) : null}
        {address.isBilling && !address.isDefaultBilling ? (
          <button type="button" className={ACTION} onClick={() => onMakeDefault('billing')} disabled={busy}>
            {t('makeDefaultBilling')}
            <span className="sr-only"> {name}</span>
          </button>
        ) : null}
      </div>
    </li>
  );
}
