/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useViewer } from '@/context/ViewerContext';
import { useBundles } from '@/hooks/marketingApi';
import { BundleForm } from './BundleForm';
import { BundleList } from './BundleList';

/** Bundles (workstream W): the create form with the live price and the list of the store's bundles. */
export function BundlesPage() {
  const { storeKey } = useViewer();
  const { data, error, isLoading, mutate } = useBundles(storeKey);
  return (
    <div className="flex flex-col gap-400">
      <BundleForm onCreated={() => mutate()} />
      <BundleList bundles={data?.bundles ?? []} loading={isLoading} failed={Boolean(error)} onChanged={() => mutate()} />
    </div>
  );
}
