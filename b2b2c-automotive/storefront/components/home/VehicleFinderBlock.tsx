// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// The standalone finder block: the same VehicleFinderCard as the hero (D4). The card carries its own heading (the message
// `vehicleFinder.title`); a different authored `title` is shown above it as a section heading, an identical one is not repeated.
import { useTranslations } from 'next-intl';
import { storePath } from '@/components/home/BlockLink';
import { useHomeData } from '@/components/home/HomeDataContext';
import { VehicleFinderCard } from '@/components/vehicle/VehicleFinderCard';
import { parseBlockProps } from '@/lib/puck/automotive-blocks.schema';

export function VehicleFinderBlock(raw: Record<string, unknown>) {
  const t = useTranslations('vehicleFinder');
  const data = useHomeData();
  const { title } = parseBlockProps('VehicleFinder', raw, { title: t('title') });
  return (
    <section className="mx-auto grid w-full max-w-content gap-3 px-5 py-5">
      {title !== t('title') ? <h2 className="font-display text-2xl font-semibold text-text-strong">{title}</h2> : null}
      <div className="rounded-md border border-border">
        <VehicleFinderCard partsHref={storePath('/parts', data.storeKey)} />
      </div>
    </section>
  );
}
