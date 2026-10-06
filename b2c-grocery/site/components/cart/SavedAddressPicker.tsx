'use client';

import { useTranslations } from 'next-intl';
import { addressLines } from '@/components/account/AddressCard';
import { Radio } from '@/components/ui/Radio';
import { Tag } from '@/components/ui/Tag';
import type { SavedAddress } from '@/lib/types';

export const NEW_ADDRESS = 'new';

/**
 * Radio cards for the signed-in customer's saved addresses plus "Add a new address". Addresses for another country
 * than the shop's market are disabled (the cart rejects them, `COUNTRY_MISMATCH`). Presentational: the delivery step
 * owns the selection and the cart call.
 */
export function SavedAddressPicker({
  addresses,
  selected,
  marketCountry,
  pending,
  error,
  onSelect,
}: {
  addresses: SavedAddress[];
  /** A saved address id, or `NEW_ADDRESS`. */
  selected: string;
  marketCountry: string;
  pending: boolean;
  error: string | null;
  onSelect: (choice: SavedAddress | typeof NEW_ADDRESS) => void;
}) {
  const t = useTranslations('cart');
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-(--space-3) border-0 p-0" disabled={pending}>
      <legend className="sr-only">{t('saved.legend')}</legend>
      {addresses.map((a) => {
        const mismatch = a.country !== marketCountry;
        return (
          <div key={a.id} className={`rounded-[var(--radius-md)] border p-(--space-3) ${selected === a.id ? 'border-accent' : 'border-divider'}`} data-testid="saved-address">
            <Radio
              name="saved-address"
              value={a.id}
              checked={selected === a.id}
              disabled={mismatch}
              onChange={() => onSelect(a)}
              label={
                <span className="flex flex-col gap-1 text-[15px] leading-[1.5]">
                  {a.isDefaultShipping ? (
                    <span>
                      <Tag tone="accent-2">{t('saved.default')}</Tag>
                    </span>
                  ) : null}
                  {addressLines(a).map((line, i) => (
                    <span key={`${i}-${line}`}>{line}</span>
                  ))}
                  {mismatch ? <span className="text-[13px] text-text/60">{t('step.countryMismatch')}</span> : null}
                </span>
              }
            />
          </div>
        );
      })}
      <div className={`rounded-[var(--radius-md)] border p-(--space-3) ${selected === NEW_ADDRESS ? 'border-accent' : 'border-divider'}`}>
        <Radio name="saved-address" value={NEW_ADDRESS} checked={selected === NEW_ADDRESS} onChange={() => onSelect(NEW_ADDRESS)} label={t('saved.new')} />
      </div>
      {error ? (
        <p role="alert" className="m-0 text-[14px] text-accent-700">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
