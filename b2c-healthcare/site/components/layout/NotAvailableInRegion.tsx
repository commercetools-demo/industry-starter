import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';

/**
 * Shown instead of a price and a booking or add-to-cart control when the product has no price in the visitor's
 * currency (switching-region-or-language: never a broken price).
 */
export function NotAvailableInRegion({ className }: { className?: string }) {
  const t = useTranslations('region');
  return (
    <Card as="section" aria-labelledby="region-unavailable" className={className}>
      <h2 id="region-unavailable" className="font-display text-xl font-semibold text-text-heading">
        {t('notAvailableTitle')}
      </h2>
      <p className="mt-2 text-neutral-700">{t('notAvailableBody')}</p>
    </Card>
  );
}
