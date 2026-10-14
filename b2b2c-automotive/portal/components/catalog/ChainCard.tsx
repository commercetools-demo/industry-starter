/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useViewer } from '@/context/ViewerContext';
import { useChain } from '@/hooks/catalogApi';
import { cardClass } from './ui';

function Node({ title, detail, active }: { title: string; detail: string; active?: boolean }) {
  return (
    <li className={`flex min-w-0 flex-1 flex-col gap-050 rounded-300 border px-400 py-300 ${active ? 'border-border-active bg-bg-active-subdued' : 'border-border-subdued bg-bg-surface-subdued'}`} aria-current={active ? 'step' : undefined}>
      <span className="text-body-2 font-bold text-text">{title}</span>
      <span className={`text-caption-1 font-medium ${active ? "text-text" : "text-text-subdued"}`}>{detail}</span>
    </li>
  );
}

/** The authority chain: Malva Global, Malva DACH, the reseller (the level this user edits), the branches. */
export function ChainCard() {
  const t = useTranslations('catalog.chain');
  const viewer = useViewer();
  const { data } = useChain(viewer.storeKey);
  const count = (n: number | undefined) => (n === undefined ? '…' : String(n));
  return (
    <section aria-labelledby="chain-title" className={cardClass}>
      <h2 id="chain-title" className="sr-only">
        {t('title')}
      </h2>
      <ol className="flex flex-col items-stretch gap-200 lg:flex-row lg:items-center">
        <Node title={t('global')} detail={t('masterPool', { count: count(data?.masterCount) })} />
        <li aria-hidden="true" className="px-100 text-center text-text-subdued">→</li>
        <Node title={t('dach')} detail={t('approved', { count: count(data?.approvedCount) })} />
        <li aria-hidden="true" className="px-100 text-center text-text-subdued">→</li>
        <Node title={viewer.businessUnitName} detail={`${t('youEdit')} · ${t('inStore', { count: count(data?.resellerCount) })}`} active />
        <li aria-hidden="true" className="px-100 text-center text-text-subdued">→</li>
        <Node title={t('branches')} detail={`${t('inherit')} · ${t('branchCount', { count: count(data?.branchCount) })}`} />
      </ol>
      <p className="mt-300 text-caption-1 font-medium text-text-subdued">{t('note')}</p>
    </section>
  );
}
