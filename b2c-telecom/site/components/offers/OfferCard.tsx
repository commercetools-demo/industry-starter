'use client';

import { useState, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BlockedAddNotice } from '@/components/bundle/BlockedAddNotice';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import { termKey, toPlanCardData } from '@/lib/listing/cardData';
import { offerAnchorId } from '@/lib/listing/links';
import type { Locale, Offer } from '@/lib/types';
import { AddonPicker } from './AddonPicker';
import { ConfirmReplace } from './ConfirmReplace';
import { EquipmentPicker } from './EquipmentPicker';
import { useListing } from './ListingProvider';
import { TermSelector } from './TermSelector';
import { useOfferSelection } from './useOfferSelection';

type OfferCardProps = {
  offer: Offer;
  /** The card the `?offer=` link points at: marked with an outline (the page also scrolls to it). */
  highlighted?: boolean;
};

/**
 * A plan card (design/specs/plp.md): tag, name, price, bullets, validity, contract term, lines (phone), "Choose plan" / "Selected ✓" and
 * the "Customize" disclosure with add-ons and equipment. "Selected" is read from the bundle, never kept in the card. A first render
 * equals the server HTML (outlined "Choose plan"); the bundle fills in after hydration.
 */
export function OfferCard({ offer, highlighted = false }: OfferCardProps): ReactElement {
  const t = useTranslations('offers');
  const tp = useTranslations('plp');
  const tb = useTranslations('bundle');
  const locale = useLocale() as Locale;
  const listing = useListing();
  const selection = useOfferSelection(offer);
  const data = toPlanCardData(offer);

  const [term, setTerm] = useState(data.masterSku);
  const [lines, setLines] = useState(1);
  const { planLine } = selection;
  const selected = planLine !== undefined;
  const sku = planLine?.sku ?? term;
  const option = data.terms.find((candidate) => candidate.sku === sku) ?? data.terms.find((candidate) => candidate.isMaster) ?? data.terms[0];
  const price = option?.price ?? null;
  const shownLines = planLine?.quantity ?? lines;

  const tag = [data.chipId ? tp(`filter.${data.chipId}`) : null, data.mostPopular ? t('mostPopular') : null].filter(Boolean).join(' · ');
  const validity = option ? t(`validity.${termKey(option.termMonths)}`) : '';

  const onCta = (): void => {
    if (selected) void selection.deselect();
    else void selection.choose(sku, shownLines);
  };

  return (
    <div
      id={offerAnchorId(offer.key)}
      data-highlighted={highlighted ? 'true' : undefined}
      className={cx('scroll-mt-28 rounded-xl', highlighted && 'outline-4 outline-offset-4 outline-action')}
    >
      <Card as="article" className="flex h-full flex-col">
        <CardHeader tone="brand" className="flex flex-col gap-1">
          <div className="min-h-4 font-display text-xs font-semibold tracking-ui">{tag}</div>
          <h2 className="m-0 font-display text-3xl font-bold">{offer.name}</h2>
          {price ? (
            <div className="font-display text-5xl font-bold">
              {formatMoney(price, locale)}
              <span className="text-md font-semibold">{t('perMonth')}</span>
            </div>
          ) : (
            <div className="font-display text-lg font-semibold text-brand-900">{tp('price.unavailable')}</div>
          )}
        </CardHeader>
        <CardBody className="flex-1">
          {data.bullets.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {data.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 text-md leading-snug">
                  <span aria-hidden="true" className="text-pink-700">
                    ▸
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="border-t border-border pt-4 text-sm text-text-muted">{validity}</div>
          {data.terms.length > 1 ? <TermSelector terms={data.terms} value={sku} onChange={setTerm} locked={selected} /> : null}
          {data.maxLines > 1 ? (
            <div className="flex items-center gap-5">
              <span className="font-display text-sm font-semibold">{t('lines')}</span>
              <QuantityStepper
                value={shownLines}
                min={1}
                max={data.maxLines}
                onChange={(value) => (selected ? void selection.changeQuantity(value) : setLines(value))}
                decreaseLabel={tb('qty.decrease')}
                increaseLabel={tb('qty.increase')}
                valueLabel={tb('qty.label')}
                className={selection.busy ? 'pointer-events-none opacity-60' : undefined}
              />
            </div>
          ) : null}
          <Button variant="secondary" block pressed={selected} disabled={price === null && !selected} loading={selection.busy} onClick={onCta}>
            {price === null && !selected ? tp('cta.unavailable') : selected ? t('cta.selected') : t('cta.choose')}
          </Button>
          {selection.blocked ? <BlockedAddNotice blocked={selection.blocked} name={offer.name} onDismiss={selection.dismissBlocked} /> : null}
          <details className="border-t border-border pt-4">
            <summary className="flex min-h-11 cursor-pointer items-center font-display text-md font-bold">{t('customize')}</summary>
            <div className="flex flex-col gap-5 pt-3">
              {selected ? null : <p className="m-0 text-sm text-text-muted">{t('hint')}</p>}
              <AddonPicker plan={offer} planLine={planLine} attached={selection.dependents} addons={listing.addons} browseHref={listing.links.addons} />
              <EquipmentPicker plan={offer} planLine={planLine} attached={selection.dependents} equipment={listing.equipment} />
            </div>
          </details>
        </CardBody>
      </Card>
      <ConfirmReplace pending={selection.pending} offerName={offer.name} onConfirm={() => void selection.confirm()} onCancel={selection.cancel} />
    </div>
  );
}
