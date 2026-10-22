'use client';

import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import type { AppAddress } from '@/lib/types';

/** One address. Radio-looking, but pressing it means "make this the default" (`aria-pressed`). */
export default function AddressCard({
  address,
  onEdit,
  onDelete,
  onMakeDefault,
}: {
  address: AppAddress;
  onEdit: (a: AppAddress) => void;
  onDelete: (a: AppAddress) => void;
  onMakeDefault: (a: AppAddress) => void;
}) {
  const t = useTranslations('account.addresses');
  const isDefault = address.isDefaultShipping;
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(' ');
  return (
    <Card
      as="article"
      data-testid="address-card"
      className={cn('mb-3 p-5', isDefault && 'border-accent shadow-[inset_0_0_0_1px_var(--accent)]')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 flex items-center gap-2 font-display text-[16px] font-bold text-ink">
            {address.label ?? `${address.firstName} ${address.lastName}`}
            {isDefault ? (
              <span className="rounded-pill bg-accent/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-accent-press" data-testid="default-pill">
                {t('default')}
              </span>
            ) : null}
          </h3>
          <p className="m-0 mt-1 text-[14px] text-ink-2">
            {address.firstName} {address.lastName}
            <br />
            {address.streetName}
            {address.additionalStreetInfo ? `, ${address.additionalStreetInfo}` : ''}
            <br />
            {cityLine} {address.country}
            {address.phone ? (
              <>
                <br />
                {address.phone}
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={isDefault}
          onClick={() => {
            if (!isDefault) onMakeDefault(address);
          }}
          className="flex min-h-11 items-center gap-2 rounded-pill border-0 bg-transparent px-1 text-[13px] font-semibold text-ink-2"
        >
          <span
            aria-hidden="true"
            className={cn('flex h-5 w-5 items-center justify-center rounded-pill border-2', isDefault ? 'border-accent' : 'border-line-2')}
          >
            {isDefault ? <span className="h-2.5 w-2.5 rounded-pill bg-accent" /> : null}
          </span>
          {isDefault ? t('default') : t('makeDefault')}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button variant="ghost" onClick={() => onEdit(address)}>
          {t('edit')}
        </Button>
        <Button variant="ghost" onClick={() => onDelete(address)}>
          {t('delete')}
        </Button>
      </div>
    </Card>
  );
}
