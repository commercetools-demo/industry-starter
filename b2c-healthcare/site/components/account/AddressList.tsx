'use client';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { addressName } from '@/lib/address';
import type { Address } from '@/lib/types';

export interface AddressListProps {
  addresses: readonly Address[];
  onAdd: () => void;
  onEdit: (address: Address) => void;
  onRemove: (address: Address) => void;
  onMakeDefault: (address: Address) => void;
  /** Id of the address whose "Make default" request is running. */
  busyId?: string | null;
}

/** One-line description of an address for dialogs and labels. */
export function addressSummary(address: Address): string {
  return `${addressName(address)}, ${address.street}, ${address.city}, ${address.state} ${address.zip}`;
}

/** Saved addresses as cards: Default badge, Make default, Edit, Remove; empty state "No addresses yet". */
export function AddressList({ addresses, onAdd, onEdit, onRemove, onMakeDefault, busyId = null }: AddressListProps) {
  const t = useTranslations('account.addresses');
  if (addresses.length === 0) {
    return <EmptyState title={t('emptyTitle')} description={t('emptyBody')} action={<Button onClick={onAdd}>{t('add')}</Button>} />;
  }
  const hasDefault = addresses.some((a) => a.isDefault);
  return (
    <div className="grid gap-4">
      {hasDefault ? null : <p className="rounded-md bg-info-50 px-3.5 py-2.5 text-sm text-info-700">{t('noDefault')}</p>}
      <ul aria-label={t('listLabel')} className="grid gap-4 sm:grid-cols-2">
        {addresses.map((address) => (
          <li key={address.id}>
            <Card as="article" className="grid h-full content-between gap-4" data-default={address.isDefault || undefined}>
              <div className="grid gap-1 text-sm text-navy-900">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-base font-semibold">{addressName(address)}</h2>
                  {address.isDefault ? <Badge variant="ok">{t('defaultBadge')}</Badge> : null}
                </div>
                <p>{address.street}</p>
                {address.street2 ? <p>{address.street2}</p> : null}
                <p>
                  {address.city}, {address.state} {address.zip}
                </p>
                <p className="text-neutral-600">{address.phone}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {address.isDefault ? null : (
                  <Button size="sm" variant="outline" busy={busyId === address.id} onClick={() => onMakeDefault(address)} aria-label={`${t('makeDefault')}: ${addressSummary(address)}`}>
                    {t('makeDefault')}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onEdit(address)} aria-label={`${t('edit')}: ${addressSummary(address)}`}>
                  {t('edit')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onRemove(address)} aria-label={`${t('remove')}: ${addressSummary(address)}`}>
                  {t('remove')}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
