'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import type { ListingParams } from '@/lib/listing-params';
import { useListingNavigation, usePriceBandLabel, type FilterPatch, type ListingFilterData } from './filter-data';

type Chip = { key: string; label: string; clear: FilterPatch };

/** Removable chips for the active category, price band and availability; renders nothing when none is active. */
export function AppliedFilters({ data, params }: { data: ListingFilterData; params: ListingParams }) {
  const t = useTranslations('plp');
  const bandLabel = usePriceBandLabel(data.currency);
  const { apply } = useListingNavigation(params);
  const chips: Chip[] = [];
  const category = params.category ? data.categories.find((c) => c.slug === params.category) : undefined;
  if (category) chips.push({ key: 'category', label: category.name, clear: { category: undefined } });
  const band = params.price ? data.priceBands.find((b) => b.id === params.price) : undefined;
  if (band) chips.push({ key: 'price', label: bandLabel(band), clear: { price: undefined } });
  if (params.stock) chips.push({ key: 'stock', label: t(params.stock === 'in' ? 'availability.in' : 'availability.out'), clear: { stock: undefined } });
  if (chips.length === 0) return null;
  return (
    <ul aria-label={t('applied.label')} className="m-0 mb-(--space-4) flex list-none flex-wrap gap-(--space-2) p-0">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            aria-label={t('applied.remove', { label: chip.label })}
            onClick={() => apply(chip.clear)}
            className="tag tag-accent cursor-pointer gap-(--space-1) border-0 py-[5px] text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {chip.label}
            <Icon icon={X} size={12} />
          </button>
        </li>
      ))}
    </ul>
  );
}
