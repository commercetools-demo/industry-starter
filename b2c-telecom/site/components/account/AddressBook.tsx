'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { SWRConfig } from 'swr';
import { ConfirmDialog } from '@/components/bundle/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAddressMutations, useAddresses } from '@/hooks/useAddresses';
import { KEY_ADDRESSES } from '@/lib/cache-keys';
import type { SavedAddress } from '@/lib/types';
import { AddressCard } from './AddressCard';
import { AddressDialog } from './AddressDialog';

type DialogState = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; address: SavedAddress };

function Book({ country }: { country: 'US' | 'DE' }): ReactElement {
  const t = useTranslations('account.addresses');
  const toast = useToast();
  const { addresses } = useAddresses();
  const { remove, makeDefault } = useAddressMutations();
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.show({ message: t('errors.generic'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const addButton = (
    <Button onClick={() => setDialog({ kind: 'add' })}>{t('add')}</Button>
  );

  return (
    <div className="flex flex-col gap-7">
      {addresses.length === 0 ? (
        <section aria-labelledby="addresses-empty-title" className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface p-9 text-center">
          <h2 id="addresses-empty-title" className="m-0 font-display text-2xl font-bold">
            {t('empty.title')}
          </h2>
          <p className="m-0 max-w-prose text-md">{t('empty.body')}</p>
          {addButton}
        </section>
      ) : (
        <>
          <ul className="m-0 grid list-none gap-7 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                busy={busy}
                onEdit={() => setDialog({ kind: 'edit', address })}
                onDelete={() => setDeleting(address)}
                onMakeDefault={(kind) => void run(() => makeDefault(address.id, kind))}
              />
            ))}
          </ul>
          <div>{addButton}</div>
        </>
      )}

      {dialog.kind !== 'closed' ? (
        <AddressDialog
          key={dialog.kind === 'edit' ? dialog.address.id : 'add'}
          editing={dialog.kind === 'edit' ? dialog.address : null}
          isFirst={addresses.length === 0}
          defaultCountry={country}
          onClose={() => setDialog({ kind: 'closed' })}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title={t('delete.title')}
        confirmLabel={t('delete.confirm')}
        cancelLabel={t('delete.cancel')}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void run(() => remove(target.id));
        }}
      >
        {deleting?.isDefaultService || deleting?.isDefaultBilling ? <p className="m-0">{t('delete.noDefault')}</p> : null}
      </ConfirmDialog>
    </div>
  );
}

/** The address book page body. `initial` is the server's read, passed as the SWR fallback so the page never flashes the empty state. */
export function AddressBook({ initial, country }: { initial: SavedAddress[]; country: 'US' | 'DE' }): ReactElement {
  return (
    <SWRConfig value={{ fallback: { [KEY_ADDRESSES]: { addresses: initial } }, revalidateOnMount: false }}>
      <Book country={country} />
    </SWRConfig>
  );
}
