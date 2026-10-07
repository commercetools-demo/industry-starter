'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BlockedAddNotice } from '@/components/bundle/BlockedAddNotice';
import { useReasonText } from '@/components/bundle/useReasonText';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { FOCUS_RING } from '@/components/ui/focus';
import { useCartContext } from '@/context/CartProvider';
import { CartError } from '@/hooks/useCart';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import { addonPrice } from '@/lib/listing/cardData';
import { offerAnchorId } from '@/lib/listing/links';
import { resolveAddonCard } from '@/lib/listing/parent';
import type { BlockedAdd, Locale, Offer } from '@/lib/types';
import { useListing } from './ListingProvider';

type AddonCardProps = {
  offer: Offer;
  highlighted?: boolean;
};

/**
 * An add-on (or a piece of equipment) on the add-ons page (design/specs/addons.md): banner with the name, tag, description, price and
 * a toggle. "Added" is read from the bundle. Adding attaches it to the first plan in the bundle that it fits (or the plan named by
 * `?for=`); with no such plan the card says "Needs a plan" (undrawn state: Junior design choice, D-068).
 */
export function AddonCard({ offer, highlighted = false }: AddonCardProps): ReactElement {
  const t = useTranslations('offers');
  const tp = useTranslations('plp');
  const tb = useTranslations('bundle');
  const locale = useLocale() as Locale;
  const reasonText = useReasonText();
  const listing = useListing();
  const { cart, addLine, removeLine } = useCartContext();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<BlockedAdd | null>(null);
  const [failed, setFailed] = useState(false);

  const plansByKey = useMemo(() => Object.fromEntries(listing.plans.map((plan) => [plan.key, plan])), [listing.plans]);
  const state = resolveAddonCard(offer, cart?.lines ?? [], plansByKey, listing.preferredParentLineId);
  const price = addonPrice(offer);
  const master = offer.variants.find((variant) => variant.isMaster) ?? offer.variants[0];
  const facts = offer.facts;
  const tag = facts?.kind === 'addon' && facts.tag ? tp(`filter.${facts.tag}`) : facts?.kind === 'equipment' ? t(`equipmentKind.${facts.equipmentKind}`) : '';
  const description = facts?.kind === 'addon' ? (facts.highlights[0] ?? '') : '';

  const toggle = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setBlocked(null);
    setFailed(false);
    try {
      if (state.kind === 'added') await removeLine(state.line.id);
      else if (state.kind === 'ready' && master) {
        await addLine({ offerKey: offer.key, sku: master.sku, quantity: offer.kind === 'equipment' ? 1 : state.parent.quantity, parentLineId: state.parent.id });
      }
    } catch (error) {
      const refusal = error instanceof CartError ? error.blocked : undefined;
      if (refusal) setBlocked(refusal);
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const added = state.kind === 'added';
  const cannot = state.kind === 'needs-plan' || state.kind === 'included' || state.kind === 'unavailable';
  const planHref = state.kind === 'needs-plan' ? (state.family === 'phone' ? listing.links.phonePlans : listing.links.internetPlans) : null;

  return (
    <div
      id={offerAnchorId(offer.key)}
      data-highlighted={highlighted ? 'true' : undefined}
      className={cx('scroll-mt-28 rounded-xl', highlighted && 'outline-4 outline-offset-4 outline-action')}
    >
      <Card as="article" className="flex h-full flex-col">
        <div className="flex h-30 items-center bg-pink-900 px-7">
          <h2 className="m-0 line-clamp-2 font-display text-5xl font-bold tracking-ui text-text-on-pink">{offer.name}</h2>
        </div>
        <CardBody className="flex-1">
          {tag ? <div className="font-display text-xs font-semibold text-pink-700">{tag}</div> : null}
          {description ? <p className="m-0 text-md leading-snug">{description}</p> : null}
          <div className="mt-auto flex items-baseline gap-2 border-t border-border pt-4">
            {price ? (
              <>
                <span className="font-display text-2xl font-bold">{formatMoney(price.amount, locale)}</span>
                <span className="text-sm text-text-muted">{price.recurring ? t('perMonth') : t('addon.oneTime')}</span>
              </>
            ) : (
              <span className="text-sm text-text-muted">{tp('price.unavailable')}</span>
            )}
          </div>
          <Button variant="secondary" block pressed={added} disabled={cannot || price === null} loading={busy} onClick={() => void toggle()}>
            {added ? t('addon.added') : state.kind === 'needs-plan' ? t('addon.needsPlan') : state.kind === 'included' ? t('addon.included') : state.kind === 'unavailable' ? t('addon.unavailable') : t('addon.add')}
          </Button>
          {state.kind === 'needs-plan' ? (
            <div className="flex flex-col gap-1 text-sm text-text-muted">
              <p className="m-0">{t('needsPlan')}</p>
              {planHref ? (
                <Link href={planHref} className={cx('self-start font-display font-semibold text-text-link underline underline-offset-4', FOCUS_RING)}>
                  {t('addon.choosePlan')}
                </Link>
              ) : null}
            </div>
          ) : null}
          {state.kind === 'unavailable' && state.reason ? <p className="m-0 text-sm text-text-muted">{reasonText(state.reason)}</p> : null}
          {blocked ? <BlockedAddNotice blocked={blocked} name={offer.name} onDismiss={() => setBlocked(null)} /> : null}
          {failed ? (
            <p role="alert" className="m-0 text-sm text-danger">
              {tb('error.generic')}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
