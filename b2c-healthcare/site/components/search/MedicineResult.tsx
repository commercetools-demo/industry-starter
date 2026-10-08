import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { formatMoney } from '@/lib/utils';
import type { Medication } from '@/lib/types';

/** A medicine hit. When it matched by part number the card says which one. */
export function MedicineResult({ medicine, matchedSku }: { medicine: Medication; matchedSku?: boolean }) {
  const t = useTranslations('search');
  const locale = useLocale();
  return (
    <Card as="article" data-testid="medicine-result" className="grid gap-1.5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-semibold text-navy-900">{medicine.name}</h3>
        <Badge variant={medicine.rxOnly ? 'wait' : 'neutral'}>{medicine.rxOnly ? t('rxOnly') : t('otc')}</Badge>
      </div>
      <p className="text-sm text-neutral-600">
        {medicine.price ? `${formatMoney(medicine.price.centAmount, medicine.price.currencyCode, locale)} ${t('pack')}` : t('noPrice')}
      </p>
      {matchedSku && medicine.sku ? <p className="font-meta text-sm text-brand-800">{t('matchedSku', { sku: medicine.sku })}</p> : null}
    </Card>
  );
}
