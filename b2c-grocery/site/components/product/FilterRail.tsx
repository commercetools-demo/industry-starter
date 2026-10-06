'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Radio } from '@/components/ui/Radio';
import { cx } from '@/components/ui/cx';
import type { ListingParams } from '@/lib/listing-params';
import { useListingNavigation, usePriceBandLabel, type ListingFilterData } from './filter-data';

type FilterRailProps = {
  data: ListingFilterData;
  params: ListingParams;
  /** Called after a change navigates (the tablet sheet closes itself here). */
  onChange?: () => void;
  className?: string;
};

const row =
  'flex w-full cursor-pointer items-center justify-between gap-(--space-2) rounded-full border-0 bg-transparent px-(--space-3) py-[7px] text-left text-[14px] text-text hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const bandTag =
  'cursor-pointer rounded-full border border-divider bg-transparent px-(--space-3) py-[5px] text-[13px] text-text hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Category rows with counts, price band tags, availability radios and "Clear all"; every change goes to the URL. */
export function FilterRail({ data, params, onChange, className }: FilterRailProps) {
  const t = useTranslations('plp');
  const group = useId();
  const bandLabel = usePriceBandLabel(data.currency);
  const { apply, clearAll } = useListingNavigation(params, onChange);
  const stock = params.stock ?? 'all';

  return (
    <div className={cx('flex flex-col gap-(--space-6)', className)}>
      <section aria-labelledby={`${group}-category`}>
        <h3 id={`${group}-category`} className="card-kicker mb-(--space-2)">
          {t('filters.category')}
        </h3>
        <ul className="m-0 flex list-none flex-col gap-[2px] p-0">
          <li>
            <button type="button" className={row} aria-pressed={!params.category} onClick={() => apply({ category: undefined })}>
              <span>{t('everything')}</span>
              <span className="opacity-60">{data.total}</span>
            </button>
          </li>
          {data.categories.map((category) => (
            <li key={category.slug}>
              <button
                type="button"
                className={row}
                aria-pressed={params.category === category.slug}
                style={category.depth > 0 ? { paddingInlineStart: `calc(var(--space-3) + ${category.depth} * var(--space-3))` } : undefined}
                onClick={() => apply({ category: category.slug })}
              >
                <span>{category.name}</span>
                <span className="opacity-60">{category.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={`${group}-price`}>
        <h3 id={`${group}-price`} className="card-kicker mb-(--space-2)">
          {t('filters.price')}
        </h3>
        <div className="flex flex-wrap gap-(--space-2)">
          <button type="button" className={bandTag} aria-pressed={!params.price} onClick={() => apply({ price: undefined })}>
            {t('band.any')}
          </button>
          {data.priceBands.map((band) => (
            <button key={band.id} type="button" className={bandTag} aria-pressed={params.price === band.id} onClick={() => apply({ price: band.id })}>
              {bandLabel(band)}
            </button>
          ))}
        </div>
      </section>

      <fieldset className="m-0 border-0 p-0">
        <legend className="card-kicker mb-(--space-2) p-0">{t('filters.availability')}</legend>
        <div className="flex flex-col gap-(--space-2)">
          <Radio name={`${group}-stock`} value="all" label={t('availability.all')} checked={stock === 'all'} onChange={() => apply({ stock: undefined })} />
          <Radio
            name={`${group}-stock`}
            value="in"
            label={`${t('availability.in')} (${data.availability.inStock})`}
            checked={stock === 'in'}
            onChange={() => apply({ stock: 'in' })}
          />
          <Radio
            name={`${group}-stock`}
            value="out"
            label={`${t('availability.out')} (${data.availability.outOfStock})`}
            checked={stock === 'out'}
            onChange={() => apply({ stock: 'out' })}
          />
        </div>
      </fieldset>

      <div>
        <Button variant="ghost" onClick={clearAll} className="text-[13px]">
          {t('filters.clearAll')}
        </Button>
      </div>
    </div>
  );
}
