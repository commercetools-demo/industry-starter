import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { chipGroupVisible } from '@/lib/listing/facets';
import { toQueryString, withListingChange } from '@/lib/listing/params';
import type { ListingParams } from '@/lib/types';

type FilterChipsProps = {
  /** Chips of the listing with the number of offers each keeps (H's `ListingResult.chips`). */
  chips: { id: string; count: number }[];
  /** The chip that is applied; null = All. */
  active: string | null;
  params: ListingParams;
  /** `/shop/<slug>`, without the locale. */
  basePath: string;
};

export const CHIP_CLASSES = 'inline-flex min-h-11 items-center rounded-pill px-5 py-3 font-display text-sm font-semibold no-underline';

/**
 * The filter chips (D-017): real links, so the state is the URL (back button, reload and a pasted link give the same list). A chip with
 * no offers stays visible but disabled. Clicking the active chip, or All, removes the filter. Hidden while fewer than two chips have offers.
 */
export function FilterChips({ chips, active, params, basePath }: FilterChipsProps): ReactElement | null {
  const t = useTranslations('plp.filter');
  if (!chipGroupVisible(chips)) return null;
  return (
    <nav aria-label={t('label')}>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {chips.map((chip) => {
          const isActive = chip.id === 'all' ? active === null : active === chip.id;
          const disabled = chip.id !== 'all' && chip.count === 0;
          const label = t(chip.id);
          if (disabled) {
            return (
              <li key={chip.id}>
                <span role="link" aria-disabled="true" className={cx(CHIP_CLASSES, 'bg-brand-100 text-brand-950 opacity-50')}>
                  {label}
                </span>
              </li>
            );
          }
          const next = isActive || chip.id === 'all' ? null : chip.id;
          return (
            <li key={chip.id}>
              <Link
                href={`${basePath}${toQueryString(withListingChange(params, { filter: next }))}`}
                aria-current={isActive ? 'true' : undefined}
                className={cx(CHIP_CLASSES, isActive ? 'bg-brand-950 text-text-on-pink' : 'bg-brand-100 text-brand-950 hover:bg-brand-200', FOCUS_RING)}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
