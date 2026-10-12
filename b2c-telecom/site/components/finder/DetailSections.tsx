'use client';

import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { ProductImage } from '@/components/ui/ProductImage';
import { formatMoney } from '@/lib/format';
import type { DraftExtra } from '@/lib/finder/draft';
import type { GroupItem, OfferDetail } from '@/lib/offers-api/views';
import type { Locale } from '@/lib/types';
import { cx } from '@/lib/cx';

type DetailSectionsProps = {
  detail: OfferDetail;
  inDraft: (offerKey: string) => boolean;
  onAdd: (extra: DraftExtra, requires: { offerKey: string; name: string }[]) => void;
  onRemove: (offerKey: string) => void;
  /** Reason text by offer key for an extra the preview refused. */
  refusals: Record<string, string>;
};

function Row({ item, locale, action, note, tile = false }: { item: GroupItem; locale: Locale; action: ReactElement | null; note?: string; tile?: boolean }): ReactElement {
  const t = useTranslations('finder.detail');
  const to = useTranslations('offers');
  const { offer, verdict } = item;
  const unavailable = verdict.status === 'unavailable';
  const price = offer.price.recurring ? `${formatMoney(offer.price.recurring, locale)}${to('perMonth')}` : offer.price.oneTime ? `${formatMoney(offer.price.oneTime, locale)} ${to('addon.oneTime')}` : null;
  const title = (
    <div className="flex min-w-0 flex-col">
      <span className="font-display text-md font-semibold">{offer.name}</span>
      <span className="text-sm text-text-muted">
        {offer.equipmentKind ? to(`equipmentKind.${offer.equipmentKind}` as 'equipmentKind.router') : t(`kind.${offer.kind === 'equipment' ? 'equipment' : 'addon'}`)}
        {price && verdict.status !== 'included' ? ` · ${price}` : ''}
      </span>
    </div>
  );
  const status = verdict.status === 'included' ? <span className="whitespace-nowrap text-sm font-semibold">{to('included')}</span> : action;
  return (
    <li className={cx('flex flex-col rounded-lg border border-neutral-300 bg-surface', tile ? 'overflow-hidden' : 'gap-1 p-4', unavailable && 'opacity-70')}>
      {tile ? <ProductImage src={offer.image} name={offer.name} sizes="(min-width: 64rem) 12rem, 50vw" /> : null}
      <div className={cx(tile ? 'flex flex-1 flex-col justify-between gap-3 p-4' : 'contents')}>
        <div className={cx(tile ? 'flex flex-col gap-3' : 'flex items-start justify-between gap-3')}>
          {title}
          {status}
        </div>
        {unavailable ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {verdict.reasons.map((reason) => (
              <li key={reason.code} className="text-sm text-text-muted">
                {reason.message}
              </li>
            ))}
          </ul>
        ) : null}
        {note ? (
          <p role="alert" className="m-0 text-sm text-danger">
            {note}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Included, Compatible add-ons and Compatible equipment, each with its own empty text. An item the rules refuse is shown disabled with its reason. */
export function DetailSections({ detail, inDraft, onAdd, onRemove, refusals }: DetailSectionsProps): ReactElement {
  const t = useTranslations('finder.detail');
  const locale = useLocale() as Locale;

  const action = (item: GroupItem): ReactElement | null => {
    const { offer, verdict } = item;
    if (verdict.status === 'unavailable' || offer.sku === null || (offer.kind !== 'addon' && offer.kind !== 'equipment')) {
      return (
        <Button size="sm" variant="secondary" disabled aria-label={t('unavailableFor', { name: offer.name })}>
          {t('unavailable')}
        </Button>
      );
    }
    if (inDraft(offer.key)) {
      return (
        <Button size="sm" variant="secondary" pressed onClick={() => onRemove(offer.key)} aria-label={t('removeFrom', { name: offer.name })}>
          {t('remove')}
        </Button>
      );
    }
    const extra: DraftExtra = { offerKey: offer.key, sku: offer.sku, name: offer.name, kind: offer.kind, equipmentKind: offer.equipmentKind };
    return (
      <Button size="sm" variant="secondary" onClick={() => onAdd(extra, verdict.requires ?? [])} aria-label={t('addTo', { name: offer.name })}>
        {t('add')}
      </Button>
    );
  };

  const sections: { id: string; title: string; empty: string; items: GroupItem[] }[] = [
    { id: 'included', title: t('included.title'), empty: t('included.empty'), items: detail.included },
    { id: 'addons', title: t('addons.title'), empty: t('addons.empty'), items: detail.compatibleAddons },
    { id: 'equipment', title: t('equipment.title'), empty: t('equipment.empty'), items: detail.compatibleEquipment },
  ];

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`finder-section-${section.id}`} className="flex flex-col gap-3">
          <h3 id={`finder-section-${section.id}`} className="m-0 font-display text-lg font-bold">
            {section.title}
          </h3>
          {section.items.length === 0 ? (
            <p className="m-0 text-md text-text-muted">{section.empty}</p>
          ) : (
            <ul className={cx('m-0 list-none gap-3 p-0', section.id === 'addons' ? 'grid grid-cols-2 lg:grid-cols-4' : 'flex flex-col')}>
              {section.items.map((item) => (
                <Row key={item.offer.key} item={item} locale={locale} action={action(item)} note={refusals[item.offer.key]} tile={section.id === 'addons'} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
