// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// The vehicle-first hero (workstream K, design-home-page "Vehicle-first hero"). A client component so Puck can render it; the
// pickup promise comes from HomeData (read on the server). Authored texts are plain text (never HTML) and may use {reseller},
// {city} and {pickup}.
import { useTranslations } from 'next-intl';
import { BlockLink, storePath } from '@/components/home/BlockLink';
import { useHomeData } from '@/components/home/HomeDataContext';
import { VehicleFinderCard } from '@/components/vehicle/VehicleFinderCard';
import { fillTemplate } from '@/lib/home/template';
import { parseBlockProps } from '@/lib/puck/automotive-blocks.schema';

export function AutomotiveHero(raw: Record<string, unknown>) {
  const t = useTranslations('home');
  const data = useHomeData();
  const props = parseBlockProps('AutomotiveHero', raw, { eyebrow: t('eyebrow'), headline: t.raw('headline') as string, ctaLabel: t('shopAll') });
  const city = data.branch?.city;
  const values = { reseller: data.storeName, city, pickup: data.pickup === 'tomorrow' ? t('wordTomorrow') : t('wordToday') };

  // Empty line, or {pickup} for a store that only ships to the store: the automatic promise of the selected branch.
  const automatic = props.supportingLine === '' || (props.supportingLine.includes('{pickup}') && data.pickup === 'ship-to-store');
  const promise = !city
    ? t('promiseNoBranch')
    : data.pickup === 'today'
      ? t('promiseToday', { city })
      : data.pickup === 'tomorrow'
        ? t('promiseTomorrow', { city })
        : t('promiseShipToStore', { city });
  const supporting = automatic ? promise : fillTemplate(props.supportingLine, values);
  const imageUrl = props.imageUrl;

  return (
    <section className="relative isolate overflow-hidden bg-surface-brand-deep px-5 py-7 text-text-on-brand">
      {imageUrl ? <div aria-hidden="true" className="absolute inset-0 -z-10 bg-cover bg-center opacity-30" style={{ backgroundImage: `url("${encodeURI(imageUrl)}")` }} /> : null}
      <div className="mx-auto grid max-w-content grid-cols-[repeat(auto-fit,minmax(18.75rem,1fr))] items-center gap-6">
        <div>
          {props.eyebrow ? <p className="font-ui text-xs font-bold uppercase tracking-label text-accent-300">{props.eyebrow}</p> : null}
          <h1 className="my-3 font-display text-4xl font-semibold leading-tight text-text-on-brand">{fillTemplate(props.headline, values)}</h1>
          <p className="mb-5 max-w-prose font-body text-md leading-normal text-brand-100">{supporting}</p>
          <BlockLink
            href={props.ctaHref}
            store={data.storeKey}
            className="inline-flex min-h-7 items-center justify-center rounded-pill bg-surface px-6 font-display text-sm font-semibold text-action hover:bg-surface-subtle"
          >
            {props.ctaLabel}
          </BlockLink>
        </div>
        {props.showFinder ? <VehicleFinderCard partsHref={storePath('/parts', data.storeKey)} /> : null}
      </div>
    </section>
  );
}
