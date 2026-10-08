'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SignInOnUnauthorized } from '@/components/layout/SignInOnUnauthorized';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useAddresses } from '@/hooks/use-addresses';
import type { Address } from '@/lib/types';
import { AddressForm } from './AddressForm';
import { AddressList, addressSummary } from './AddressList';

type Dialog = { kind: 'add' } | { kind: 'edit'; address: Address } | { kind: 'remove'; address: Address } | null;

/** `/account/addresses` content: the list, the add/edit modal and the remove confirmation. */
export function AddressBook() {
  const t = useTranslations('account.addresses');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const toast = useToast();
  const { addresses, error, add, update, remove, makeDefault } = useAddresses();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState('');
  const close = () => setDialog(null);

  const onMakeDefault = async (address: Address) => {
    setBusyId(address.id);
    setMessage('');
    const result = await makeDefault(address.id);
    setBusyId(null);
    if (result.ok) toast.show({ message: t('toast.defaultSet') });
    else setMessage(result.reason === 'failed' && result.status === 0 ? errors('network') : errors('generic'));
  };

  const onRemove = async (address: Address) => {
    setRemoving(true);
    const result = await remove(address.id);
    setRemoving(false);
    close();
    if (result.ok) toast.show({ message: t('toast.removed') });
    else setMessage(result.reason === 'failed' && result.status === 0 ? errors('network') : errors('generic'));
  };

  return (
    <SignInOnUnauthorized error={error} reason="account">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-155 text-neutral-600">{t('sub')}</p>
          <Button onClick={() => setDialog({ kind: 'add' })}>{t('add')}</Button>
        </div>
        {message ? (
          <p role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700">
            {t('loadFailed')}
          </p>
        ) : addresses === undefined ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <AddressList
            addresses={addresses}
            busyId={busyId}
            onAdd={() => setDialog({ kind: 'add' })}
            onEdit={(address) => setDialog({ kind: 'edit', address })}
            onRemove={(address) => setDialog({ kind: 'remove', address })}
            onMakeDefault={onMakeDefault}
          />
        )}
      </div>
      <Modal open={dialog?.kind === 'add'} onClose={close} title={t('form.addTitle')}>
        <AddressForm onSave={add} onCancel={close} onSaved={() => (close(), toast.show({ message: t('toast.saved') }))} />
      </Modal>
      <Modal open={dialog?.kind === 'edit'} onClose={close} title={t('form.editTitle')}>
        {dialog?.kind === 'edit' ? (
          <AddressForm
            initial={dialog.address}
            onSave={(input, options) => update(dialog.address.id, input, options)}
            onCancel={close}
            onSaved={() => (close(), toast.show({ message: t('toast.saved') }))}
          />
        ) : null}
      </Modal>
      <Modal open={dialog?.kind === 'remove'} onClose={close} title={t('removeTitle')}>
        {dialog?.kind === 'remove' ? (
          <div className="grid gap-5">
            <p className="text-neutral-700">
              {t(dialog.address.isDefault ? 'removeBodyDefault' : 'removeBody', { address: addressSummary(dialog.address) })}
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={close}>
                {common('cancel')}
              </Button>
              <Button busy={removing} onClick={() => void onRemove(dialog.address)}>
                {t('removeConfirm')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </SignInOnUnauthorized>
  );
}
