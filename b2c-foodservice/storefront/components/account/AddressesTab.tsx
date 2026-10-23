'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import AddressCard from '@/components/account/AddressCard';
import AddressForm from '@/components/account/AddressForm';
import AddressVerifyDialog from '@/components/account/AddressVerifyDialog';
import PanelState from '@/components/account/PanelState';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/context/toast';
import { ApiError } from '@/hooks/fetcher';
import { useAddresses } from '@/hooks/useAddresses';
import { DEFAULT_ADDRESS_AFTER_DELETE, afterDeleteDefault } from '@/lib/account/address-policy';
import type { AddressInput, AppAddress } from '@/lib/types';

interface Pending { input: AddressInput; makeDefault: boolean }
interface Verify extends Pending { unresolved: string[]; suggestion: AddressInput | null }

/** Address book: cards with default handling, add and edit in a dialog, delete with a confirmation naming the next default. */
export default function AddressesTab() {
  const t = useTranslations('account.addresses');
  const tTabs = useTranslations('account.tabs');
  const toast = useToast();
  const book = useAddresses();
  const [editing, setEditing] = useState<AppAddress | 'new' | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [draft, setDraft] = useState<AddressInput | null>(null);
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const [verify, setVerify] = useState<Verify | null>(null);
  const [deleting, setDeleting] = useState<AppAddress | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setEditing(null);
    setDraft(null);
    setServerFields({});
    setVerify(null);
  };

  const save = async (input: AddressInput, makeDefault: boolean, confirmed = false) => {
    if (!editing) return;
    setPending(true);
    try {
      if (editing === 'new') await book.add({ address: input, makeDefault, confirmed });
      else await book.change(editing.id, { address: input, makeDefault, confirmed });
      toast.show(t('saved'));
      close();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'address_needs_confirmation') {
        // Nothing was stored: the shopper decides.
        const suggestion = (e.extra.suggestion as AddressInput | undefined) ?? null;
        setVerify({ input, makeDefault, suggestion, unresolved: Array.isArray(e.extra.unresolved) ? (e.extra.unresolved as string[]) : [] });
      } else if (e instanceof ApiError && e.code === 'validation_failed' && e.extra.fields) {
        setServerFields(e.extra.fields as Record<string, string>);
        setVerify(null);
      } else {
        toast.show(t('failed'));
        setVerify(null);
      }
    } finally {
      setPending(false);
    }
  };

  const makeDefault = async (a: AppAddress) => {
    try {
      await book.change(a.id, {
        address: {
          label: a.label ?? undefined, firstName: a.firstName, lastName: a.lastName, streetName: a.streetName,
          additionalStreetInfo: a.additionalStreetInfo ?? undefined, city: a.city, state: a.state ?? undefined,
          postalCode: a.postalCode, country: a.country, phone: a.phone ?? undefined,
        },
        makeDefault: true,
        confirmed: true,
      });
    } catch {
      toast.show(t('failed'));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setPending(true);
    try {
      await book.remove(deleting.id);
      toast.show(t('deleted'));
      setDeleting(null);
    } catch {
      toast.show(t('failed'));
    } finally {
      setPending(false);
    }
  };

  const nextDefault =
    deleting && deleting.isDefaultShipping && book.addresses
      ? (book.addresses.find((a) => a.id === afterDeleteDefault(book.addresses ?? [], deleting.id)) ?? null)
      : null;
  const nextLabel = nextDefault ? (nextDefault.label ?? nextDefault.streetName) : '';

  return (
    <section aria-labelledby="addresses-heading">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 id="addresses-heading" className="m-0 font-display text-[22px] font-bold text-ink">
          {t('title')}
        </h2>
        {book.addresses && book.addresses.length > 0 ? (
          <Button
            variant="ghost"
            onClick={() => {
              setFormKey((k) => k + 1);
              setEditing('new');
            }}
          >
            {t('add')}
          </Button>
        ) : null}
      </div>
      <PanelState
        panel={tTabs('addresses')}
        isLoading={book.isLoading && !book.addresses}
        isError={book.isError && !book.addresses}
        isEmpty={Boolean(book.addresses) && book.addresses!.length === 0}
        onRetry={() => void book.reload()}
        empty={
          <>
            <p className="m-0 mb-1 text-[14.5px] font-semibold text-ink">{t('empty')}</p>
            <p className="m-0 mb-4 text-[14px] text-ink-2">{t('emptyHelp')}</p>
            <Button
              onClick={() => {
                setFormKey((k) => k + 1);
                setEditing('new');
              }}
            >
              {t('add')}
            </Button>
          </>
        }
      >
        <div role="group" aria-label={t('list')}>
          {(book.addresses ?? []).map((a) => (
            <AddressCard
              key={a.id}
              address={a}
              onEdit={(x) => {
                setFormKey((k) => k + 1);
                setEditing(x);
              }}
              onDelete={setDeleting}
              onMakeDefault={(x) => void makeDefault(x)}
            />
          ))}
        </div>
      </PanelState>

      <Modal open={editing !== null && verify === null} onClose={close} title={editing === 'new' ? t('addTitle') : t('editTitle')}>
        {editing ? (
          <AddressForm
            key={formKey}
            address={editing === 'new' ? null : editing}
            draft={draft}
            serverFields={serverFields}
            pending={pending}
            onCancel={close}
            onSubmit={(input, asDefault) => void save(input, asDefault)}
          />
        ) : null}
      </Modal>

      <AddressVerifyDialog
        open={verify !== null}
        unresolved={verify?.unresolved ?? []}
        suggestion={verify?.suggestion ?? null}
        pending={pending}
        onUseSuggestion={() => verify && void save(verify.suggestion ?? verify.input, verify.makeDefault, true)}
        onKeepMine={() => verify && void save(verify.input, verify.makeDefault, true)}
        onEdit={() => {
          if (verify) {
            setDraft(verify.input);
            setFormKey((k) => k + 1);
          }
          setVerify(null);
        }}
      />

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t('deleteConfirm')}>
        {deleting ? (
          <>
            {deleting.isDefaultShipping ? (
              <p className="m-0 mb-4 text-[14.5px] text-ink-2" data-testid="delete-default-note">
                {DEFAULT_ADDRESS_AFTER_DELETE === 'promote' && nextDefault
                  ? t('deleteDefaultPromote', { label: nextLabel })
                  : t('deleteDefaultNone')}
              </p>
            ) : null}
            <p className="m-0 mb-5 text-[14px] text-ink-3">
              {deleting.label ?? `${deleting.firstName} ${deleting.lastName}`} · {deleting.streetName}
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                {t('deleteKeep')}
              </Button>
              <Button loading={pending} onClick={() => void confirmDelete()}>
                {t('deleteAction')}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}
