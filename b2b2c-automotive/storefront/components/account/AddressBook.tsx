// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { AddressForm } from '@/components/account/AddressForm';
import { Notice, PageTitle, Panel, StateMessage } from '@/components/account/Panel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAddresses } from '@/hooks/useAddresses';
import { MAX_ADDRESSES } from '@/lib/account/address-validation';
import type { AccountAddress } from '@/lib/types';

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'delete'; id: string };

/** The address book: list with a default chip, add, edit, make default and delete (asks first). At most twenty addresses. */
export function AddressBook() {
  const t = useTranslations('account.addresses');
  const tc = useTranslations('account');
  const locale = useLocale();
  const { book, isLoading, error, reload, add, change, remove, makeDefault } = useAddresses();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [failed, setFailed] = useState(false);
  const countryName = (code: string) => new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  const nameOf = (a: AccountAddress) => [a.firstName, a.lastName].filter(Boolean).join(' ') || [a.streetName, a.streetNumber].filter(Boolean).join(' ');

  async function run(action: () => Promise<void>) {
    setFailed(false);
    try {
      await action();
      setMode({ kind: 'list' });
    } catch {
      setFailed(true);
    }
  }

  let body;
  if (isLoading && !book) body = <StateMessage kind="loading" />;
  else if (error || !book) body = <StateMessage kind="error" onRetry={() => void reload()} />;
  else if (mode.kind === 'add' || mode.kind === 'edit') {
    const editing = mode.kind === 'edit' ? book.addresses.find((a) => a.id === mode.id) : undefined;
    body = (
      <Panel>
        <AddressForm
          key={mode.kind === 'edit' ? mode.id : 'new'}
          address={editing}
          countries={book.countries}
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={async (input) => {
            if (editing) await change(editing.id, input);
            else await add(input);
            setMode({ kind: 'list' });
          }}
        />
      </Panel>
    );
  } else if (book.addresses.length === 0) {
    body = (
      <StateMessage
        kind="empty"
        title={t('empty')}
        hint={<p className="m-0 font-ui text-sm text-text-body">{t('emptyHint')}</p>}
        action={<Button onClick={() => setMode({ kind: 'add' })}>{t('add')}</Button>}
      />
    );
  } else {
    const full = book.addresses.length >= MAX_ADDRESSES;
    body = (
      <Panel>
        <ul aria-label={t('listLabel')} className="m-0 grid list-none gap-3 p-0">
          {book.addresses.map((a) => (
            <li key={a.id} className="grid gap-3 rounded-sm border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-md font-semibold text-text">{nameOf(a)}</span>
                {a.isDefault ? <Badge tone="success">{t('defaultChip')}</Badge> : null}
              </div>
              <address className="m-0 font-ui text-sm not-italic text-text-body">
                {[a.streetName, a.streetNumber].filter(Boolean).join(' ')}
                <br />
                {a.postalCode} {a.city}
                <br />
                {countryName(a.country)}
                {a.phone ? (
                  <>
                    <br />
                    {a.phone}
                  </>
                ) : null}
              </address>
              {mode.kind === 'delete' && mode.id === a.id ? (
                <div role="group" aria-label={t('deleteConfirm')} className="grid gap-3">
                  <p className="m-0 font-ui text-sm text-text">{t('deleteConfirm')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => run(() => remove(a.id))}>{t('deleteYes')}</Button>
                    <Button variant="secondary" onClick={() => setMode({ kind: 'list' })}>
                      {tc('cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  <Button variant="link" aria-label={t('editLabel', { name: nameOf(a) })} onClick={() => setMode({ kind: 'edit', id: a.id })}>
                    {t('edit')}
                  </Button>
                  {!a.isDefault ? (
                    <Button variant="link" onClick={() => run(() => makeDefault(a.id))}>
                      {t('makeDefault')}
                    </Button>
                  ) : null}
                  <Button variant="link" aria-label={t('deleteLabel', { name: nameOf(a) })} onClick={() => setMode({ kind: 'delete', id: a.id })}>
                    {t('delete')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {full ? (
          <p role="status" className="m-0 rounded-xs bg-warning-50 px-3 py-2 font-ui text-sm text-text-body">
            {t('limit')}
          </p>
        ) : (
          <div>
            <Button onClick={() => setMode({ kind: 'add' })}>{t('add')}</Button>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <div className="grid gap-5">
      <PageTitle>{t('title')}</PageTitle>
      <Notice tone="error">{failed ? tc('failed') : null}</Notice>
      {body}
    </div>
  );
}
