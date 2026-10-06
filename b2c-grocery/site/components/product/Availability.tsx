import { useTranslations } from 'next-intl';
import type { Variant } from '@/lib/types';
import { cx } from '@/components/ui/cx';

/** "In stock" / "Out of stock" for the selected variant (D-021 replaces the prototype's lead-time note). */
export function Availability({ variant, className }: { variant?: Pick<Variant, 'availability'>; className?: string }) {
  const t = useTranslations('pdp.availability');
  const inStock = variant?.availability.isOnStock ?? false;
  return (
    <p className={cx('m-0 text-[15px]', inStock ? 'text-text' : 'text-muted', className)} data-in-stock={inStock}>
      <span aria-hidden="true" className={cx('mr-(--space-2) inline-block size-2 rounded-full align-middle', inStock ? 'bg-accent' : 'bg-neutral-400')} />
      {inStock ? t('in') : t('out')}
    </p>
  );
}
