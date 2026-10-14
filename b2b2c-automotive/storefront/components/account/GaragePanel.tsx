// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Notice, PageTitle, Panel, StateMessage } from '@/components/account/Panel';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PlateVinTabs } from '@/components/vehicle/PlateVinTabs';
import { VehicleChip } from '@/components/vehicle/VehicleChip';
import { useGarage } from '@/hooks/useGarage';
import { NICKNAME_MAX } from '@/lib/vehicles/garage';

/**
 * The garage page (spec "Garage"): vehicles with the active one marked, set active, rename (inline, 40 characters), remove (asks first), and add
 * while there is room (five at most; at five the add form is replaced by the "garage is full" message). With no vehicle left the page says
 * what the listings say: "Select your vehicle to check fit" (the shared `vehicleFit.unknown` text).
 */
export function GaragePanel() {
  const t = useTranslations('account.garage');
  const tFit = useTranslations('vehicleFit');
  const tCommon = useTranslations('account');
  const { garage, vehicles, active, isFull, setActive, remove, rename, error } = useGarage();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const formId = useId();
  const nicknameOf = (id: string) => garage?.vehicles.find((v) => v.id === id)?.nickname ?? '';

  async function run(action: () => Promise<void>) {
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="grid gap-5">
      <PageTitle>{t('title')}</PageTitle>
      <p className="m-0 font-ui text-sm text-text-body">{t('intro')}</p>
      <Notice tone="error">{failed ? t('failed') : null}</Notice>
      {error && vehicles.length === 0 ? (
        <StateMessage kind="error" />
      ) : vehicles.length === 0 ? (
        <StateMessage kind="empty" title={t('empty')} hint={<p className="m-0 font-ui text-sm text-text-body">{`${t('emptyHint')} ${tFit('unknown')}`}</p>} />
      ) : (
        <Panel>
          <ul aria-label={t('listLabel')} className="m-0 grid list-none gap-3 p-0">
            {vehicles.map((v) => {
              const isActive = v.id === active?.id;
              const nickname = nicknameOf(v.id);
              const label = nickname ? `${nickname} (${v.label})` : v.label;
              return (
                <li key={v.id} className="grid gap-3 rounded-sm border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {nickname ? <span className="font-display text-md font-semibold text-text">{nickname}</span> : null}
                    <VehicleChip label={v.label} />
                    {isActive ? <span className="font-ui text-xs font-bold uppercase tracking-label text-text-muted">{t('active')}</span> : null}
                  </div>
                  {renaming === v.id ? (
                    <form
                      id={`${formId}-${v.id}`}
                      className="grid gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(async () => {
                          await rename(v.id, name);
                          setRenaming(null);
                        });
                      }}
                    >
                      <Field label={t('nickname')} hint={t('nicknameHint')} value={name} maxLength={NICKNAME_MAX} onChange={(e) => setName(e.target.value)} autoFocus />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit">{t('rename')}</Button>
                        <Button variant="secondary" onClick={() => setRenaming(null)}>
                          {tCommon('cancel')}
                        </Button>
                      </div>
                    </form>
                  ) : removing === v.id ? (
                    <div role="group" aria-label={t('removeConfirm', { vehicle: label })} className="grid gap-3">
                      <p className="m-0 font-ui text-sm text-text">{t('removeConfirm', { vehicle: label })}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() =>
                            run(async () => {
                              await remove(v.id);
                              setRemoving(null);
                            })
                          }
                        >
                          {t('removeYes')}
                        </Button>
                        <Button variant="secondary" onClick={() => setRemoving(null)}>
                          {tCommon('cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {!isActive ? (
                        <Button variant="link" aria-label={t('setActiveLabel', { vehicle: label })} onClick={() => run(() => setActive(v.id))}>
                          {t('setActive')}
                        </Button>
                      ) : null}
                      <Button
                        variant="link"
                        aria-label={t('renameLabel', { vehicle: label })}
                        onClick={() => {
                          setName(nickname);
                          setRenaming(v.id);
                        }}
                      >
                        {t('rename')}
                      </Button>
                      <Button variant="link" aria-label={t('removeLabel', { vehicle: label })} onClick={() => setRemoving(v.id)}>
                        {t('remove')}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      <Panel title={t('addTitle')} titleId="garage-add">
        {isFull ? (
          <p role="status" className="m-0 rounded-xs bg-warning-50 px-3 py-2 font-ui text-sm text-text-body">
            {t('full')}
          </p>
        ) : (
          <PlateVinTabs />
        )}
      </Panel>
    </div>
  );
}
