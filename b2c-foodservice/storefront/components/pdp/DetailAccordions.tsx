'use client';

import { useLocale, useTranslations } from 'next-intl';
import Accordion from '@/components/pdp/Accordion';
import { usePdp } from '@/components/pdp/pdp-state';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { Link } from '@/i18n/routing';
import { SHIP_DAYS_MAX, SHIP_DAYS_MIN } from '@/lib/shop-config';
import { formatMoney } from '@/lib/utils';

/** Spec value text: booleans as Yes, units from the catalogue (`pdp.specValue.<key>`), anything else as is. */
function useSpecValue() {
  const t = useTranslations('pdp');
  return (key: string, value: string): string => {
    if (value === 'true') return t('spec.yes');
    return t.has(`specValue.${key}`) ? t(`specValue.${key}`, { value }) : value;
  };
}

/**
 * Details (open by default), Brewing and care, Shipping and collection (workstream H, 3.9). Details lists the description
 * and the shape's facts (origin, notes, roast, intensity, then the specification rows); the other two are static copy per
 * shape (approved in SO-x1) and a sentence with the live free-shipping figure, collection minutes and return days.
 */
export default function DetailAccordions() {
  const t = useTranslations('pdp');
  const locale = useLocale();
  const specValue = useSpecValue();
  const { data, store } = usePdp();
  const { stores } = useCollectionStore();
  const { product } = data;
  const { facts } = product;
  const threshold = data.freeShippingThreshold;
  const rows: { label: string; value: string }[] = [];
  if (facts.origin) rows.push({ label: t('facts.origin'), value: facts.origin });
  if (facts.notes.length > 0) rows.push({ label: t('facts.notes'), value: facts.notes.join(', ') });
  if (facts.roast) rows.push({ label: t('facts.roast'), value: facts.roast });
  if (facts.intensity !== undefined) rows.push({ label: t('facts.intensity'), value: `${facts.intensity} / 13` });
  for (const s of facts.specs) rows.push({ label: t.has(`spec.${s.key}`) ? t(`spec.${s.key}`) : s.key, value: specValue(s.key, s.value) });

  const minutes = store?.collectionMinutes ?? (stores.length > 0 ? Math.min(...stores.map((x) => x.collectionMinutes)) : undefined);
  const otherSystem = product.systemKey === 'original' ? 'vertuo' : product.systemKey === 'vertuo' ? 'original' : null;
  const otherSlug = otherSystem ? data.guideLinks[otherSystem] : undefined;

  return (
    <div className="border-t border-line" data-testid="pdp-accordions">
      <Accordion title={t('acc.details')} defaultOpen>
        {product.description ? <p className="m-0 mb-3">{product.description}</p> : null}
        {rows.length > 0 ? (
          <dl className="m-0 grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-2">
            {rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="font-medium text-ink">{r.label}</dt>
                <dd className="m-0">{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {product.shape === 'pods' && otherSystem && otherSlug ? (
          <p className="mb-0 mt-3">
            <Link href={`/category/${encodeURIComponent(otherSlug)}`} className="text-accent underline underline-offset-2">
              {t('system.browseOther', { system: otherSystem === 'vertuo' ? 'Vertuo' : 'Original' })}
            </Link>
          </p>
        ) : null}
      </Accordion>
      <Accordion title={t('acc.brewing')}>
        <p className="m-0">{t(`care.${product.shape}`)}</p>
      </Accordion>
      <Accordion title={t('acc.shipping')}>
        <p className="m-0" data-testid="pdp-shipping-text">
          {threshold
            ? t('shipping.delivery', { threshold: formatMoney(threshold.centAmount, threshold.currencyCode, locale) })
            : null}{' '}
          {t('shipping.deliveryFlat', { min: SHIP_DAYS_MIN, max: SHIP_DAYS_MAX })}{' '}
          {data.collection && minutes ? t('shipping.collect', { minutes }) : null} {t('shipping.returns', { days: data.returnDays })}
        </p>
      </Accordion>
    </div>
  );
}
