'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Tag } from '@/components/ui/Tag';
import { useAddressMutations, useAddresses } from '@/hooks/useAddresses';
import type { SavedAddress } from '@/lib/types';
import { AddressDialog } from './AddressDialog';
import { addressLines } from './AddressCard';

const nameOf = (a: SavedAddress): string => [a.firstName, a.lastName].filter(Boolean).join(' ') || a.streetName || a.id;

function AddressItem({
  address,
  onEdit,
  onDelete,
  onMakeDefault,
  busy,
}: {
  address: SavedAddress;
  onEdit: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
  busy: boolean;
}) {
  const t = useTranslations('account.addresses');
  const name = nameOf(address);
  return (
    <li>
      <Card elev="sm" className="flex h-full flex-col gap-(--space-3) p-[17.6px]" data-testid="address-card">
        {address.isDefaultShipping ? (
          <div>
            <Tag tone="accent-2">{t('default')}</Tag>
          </div>
        ) : null}
        <address className="m-0 text-[15px] not-italic leading-[1.6]">
          {addressLines(address).map((line, i) => (
            <div key={`${i}-${line}`}>{line}</div>
          ))}
        </address>
        <div className="mt-auto flex flex-wrap gap-(--space-2)">
          <Button variant="ghost" onClick={onEdit} aria-label={t('editLabel', { name })}>
            {t('edit')}
          </Button>
          <Button variant="ghost" onClick={onDelete} aria-label={t('deleteLabel', { name })}>
            {t('delete')}
          </Button>
          {address.isDefaultShipping ? null : (
            <Button variant="ghost" onClick={onMakeDefault} disabled={busy} aria-label={t('makeDefaultLabel', { name })}>
              {t('makeDefault')}
            </Button>
          )}
        </div>
      </Card>
    </li>
  );
}

function DeleteConfirm({ address, onClose }: { address: SavedAddress | null; onClose: () => void }) {
  const t = useTranslations('account.addresses.confirm');
  const { remove } = useAddressMutations();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = async () => {
    if (!address) return;
    setPending(true);
    setFailed(false);
    try {
      await remove(address.id);
      onClose();
    } catch {
      setFailed(true);
    }
    setPending(false);
  };

  return (
    <Dialog open={address !== null} onClose={onClose} title={t('title')}>
      {address ? (
        <>
          <p className="m-0 text-[15px]">{t('body')}</p>
          <address className="m-0 text-[15px] not-italic leading-[1.6]">
            {addressLines(address).map((line, i) => (
              <div key={`${i}-${line}`}>{line}</div>
            ))}
          </address>
          {address.isDefaultShipping ? <p className="m-0 text-[14px] text-text/60">{t('defaultNote')}</p> : null}
          {failed ? (
            <p role="alert" className="m-0 text-[14px] text-accent-700">
              {t('failed')}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-(--space-3)">
            <Button variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void confirm()} disabled={pending}>
              {pending ? t('deleting') : t('confirm')}
            </Button>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

/** The address book page body: cards in a two-column grid, add/edit dialog, delete confirmation, empty state. */
export function AddressBook() {
  const t = useTranslations('account.addresses');
  const { addresses, error, isLoading, mutate } = useAddresses();
  const { makeDefault } = useAddressMutations();
  // `editing === null` closed; `'new'` add; an address edits it.
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const setDefault = async (address: SavedAddress) => {
    setBusy(true);
    setActionFailed(false);
    try {
      await makeDefault(address.id);
    } catch {
      setActionFailed(true);
    }
    setBusy(false);
  };

  if (isLoading && addresses.length === 0) {
    return (
      <p aria-busy="true" className="m-0 text-[15px] text-text/60">
        {t('loading')}
      </p>
    );
  }
  if (error && addresses.length === 0) {
    return (
      <div role="alert" className="flex flex-col items-start gap-(--space-3)">
        <p className="m-0 text-[15px]">{t('loadFailed')}</p>
        <Button variant="secondary" onClick={() => void mutate()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-(--space-4)">
      {addresses.length === 0 ? (
        <div className="flex flex-col items-start gap-(--space-3)">
          <p className="m-0 text-[17px] text-text/60">{t('empty')}</p>
        </div>
      ) : (
        <ul aria-label={t('list')} className="m-0 grid list-none gap-(--space-4) p-0 tablet:grid-cols-2">
          {addresses.map((address) => (
            <AddressItem key={address.id} address={address} busy={busy} onEdit={() => setEditing(address)} onDelete={() => setDeleting(address)} onMakeDefault={() => void setDefault(address)} />
          ))}
        </ul>
      )}
      {actionFailed ? (
        <p role="alert" className="m-0 text-[14px] text-accent-700">
          {t('actionFailed')}
        </p>
      ) : null}
      <div>
        <Button onClick={() => setEditing('new')}>{t('add')}</Button>
      </div>
      <AddressDialog open={editing !== null} address={editing === 'new' || editing === null ? undefined : editing} onClose={() => setEditing(null)} />
      <DeleteConfirm address={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
