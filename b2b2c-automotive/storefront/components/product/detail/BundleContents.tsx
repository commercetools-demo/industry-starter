// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';
import type { BundleView } from '@/lib/types';

/**
 * What a bundle contains and whether it can be bought (workstream W-11). The bundle is priced as one part; the list shows its components
 * with their quantities. With `available` 0 (a component is withdrawn from the store or out of stock) the panel says "Currently unavailable"
 * and the buy box disables Add.
 */
export function BundleContents({ bundle }: { bundle: BundleView }) {
  const t = useTranslations('pdp');
  const unavailable = bundle.available < 1;
  return (
    <section aria-label={t('bundleIncludes')} className="grid gap-3 rounded-md border border-border bg-surface p-4">
      <h2 className="m-0 font-display text-sm font-semibold text-text">{t('bundleIncludes')}</h2>
      <ul className="m-0 grid list-none gap-1 p-0 font-ui text-sm text-text-body">
        {bundle.components.map((component) => (
          <li key={component.sku}>{t('bundleComponent', { count: component.qty, name: component.name })}</li>
        ))}
      </ul>
      {unavailable ? (
        <div role="status" className="grid gap-1 rounded-sm bg-warning-50 p-3">
          <p className="m-0 font-display text-sm font-semibold text-text">{t('bundleUnavailable')}</p>
          <p className="m-0 font-ui text-xs text-text-body">{t('bundleUnavailableHint')}</p>
        </div>
      ) : (
        <p className="m-0 font-display text-sm font-semibold text-success-600">{t('bundleAvailable')}</p>
      )}
    </section>
  );
}
