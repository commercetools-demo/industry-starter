/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { BlockedAddNotice } from '@/components/bundle/BlockedAddNotice';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useCart, useCartMutations } from '@/hooks/useCart';
import { contextVersion, PLAN_KINDS, useBuyerContextActions, useBuyerContextView, useFinderOffers, useOfferDetail, usePricePreview } from '@/hooks/useFinder';
import { useRouter } from '@/i18n/routing';
import { continueWithPlan } from '@/lib/finder/continue';
import { addExtra, EMPTY_DRAFT, removeExtra, selectPlan, type Draft, type DraftExtra } from '@/lib/finder/draft';
import { writeHandoff } from '@/lib/finder/handoff';
import { API_FAMILIES, type ApiFamily } from '@/lib/offers-api/filters';
import type { OfferItem } from '@/lib/offers-api/views';
import type { BlockedAdd } from '@/lib/types';
import { ContextBar } from './ContextBar';
import { DetailSections } from './DetailSections';
import { PlanList } from './PlanList';
import { PriceStrip } from './PriceStrip';

type PlanFinderProps = {
  /** `?plan=<key>`: restored on load (the draft is not). */
  initialPlanKey?: string;
};

function writeUrl(planKey: string | null): void {
  const url = new URL(window.location.href);
  if (planKey) url.searchParams.set('plan', planKey);
  else url.searchParams.delete('plan');
  window.history.replaceState(window.history.state, '', url);
}

/**
 * The plan finder: context bar, family control, plans of the family, the selected plan's three sections, a price strip and one Continue.
 * Reads only public endpoints; changes the cart only on Continue.
 */
export function PlanFinder({ initialPlanKey }: PlanFinderProps): ReactElement {
  const t = useTranslations('finder');
  const tb = useTranslations('bundle');
  const router = useRouter();
  const { cart } = useCart();
  const mutations = useCartMutations();
  const { context } = useBuyerContextView();
  const actions = useBuyerContextActions(mutations.setPostalCode);
  const version = context ? contextVersion(context) : null;
  const { offers, error: offersError, retry: retryOffers } = useFinderOffers(version);

  const plans = useMemo(() => (offers ?? []).filter((offer) => PLAN_KINDS.has(offer.kind)), [offers]);
  const counts = useMemo(() => Object.fromEntries(API_FAMILIES.map((name) => [name, plans.filter((plan) => plan.family === name).length])) as Record<ApiFamily, number>, [plans]);

  const [pickedFamily, setPickedFamily] = useState<ApiFamily | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(initialPlanKey ?? null);
  const restored = pickedKey === null ? undefined : plans.find((plan) => plan.key === pickedKey);
  // The family of a restored plan, else the one the buyer chose, else the first with an eligible plan.
  const family: ApiFamily | null = pickedFamily ?? restored?.family ?? API_FAMILIES.find((name) => counts[name] > 0) ?? null;
  const familyPlans = plans.filter((plan) => plan.family === family);
  // A selection that is no longer eligible (context or family changed) falls back to the first plan in listing order.
  const plan: OfferItem | null = familyPlans.find((entry) => entry.key === pickedKey) ?? familyPlans[0] ?? null;
  const planKey = plan?.key ?? null;

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [cleared, setCleared] = useState(false);
  // The draft belongs to one plan: when the plan changes (chosen, or re-selected by a context change) it is cleared, once, with a notice.
  if (draft.planKey !== planKey) {
    const next = selectPlan(draft, planKey);
    setDraft(next.draft);
    setCleared(next.cleared);
  }
  useEffect(() => {
    if (offers) writeUrl(planKey);
  }, [offers, planKey]);
  const extras = draft.planKey === planKey ? draft.extras : [];

  const { detail, error: detailError, retry: retryDetail } = useOfferDetail(planKey, version);
  const strip = usePricePreview(plan ? { key: plan.key, sku: plan.sku } : null, extras, version);
  const refusals = useMemo(() => Object.fromEntries((strip.preview?.issues ?? []).map((issue) => [issue.offerKey, issue.reasons[0]?.message ?? t('detail.refused')])), [strip.preview, t]);

  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<BlockedAdd | null>(null);
  const [failed, setFailed] = useState(false);

  function choose(next: OfferItem): void {
    setPickedKey(next.key);
    setBlocked(null);
    setFailed(false);
  }

  function add(extra: DraftExtra, requires: { offerKey: string; name: string }[]): void {
    setCleared(false);
    // "Add both": the offers this one requires come along (they are in the same sections).
    const all = [...(detail?.compatibleAddons ?? []), ...(detail?.compatibleEquipment ?? [])];
    setDraft((current) => {
      let next = current;
      for (const needed of requires) {
        const item = all.find((entry) => entry.offer.key === needed.offerKey)?.offer;
        if (item?.sku && (item.kind === 'addon' || item.kind === 'equipment') && !next.extras.some((entry) => entry.offerKey === item.key)) {
          next = addExtra(next, { offerKey: item.key, sku: item.sku, name: item.name, kind: item.kind, equipmentKind: item.equipmentKind });
        }
      }
      return addExtra(next, extra);
    });
  }

  async function proceed(replaceLineId?: string): Promise<void> {
    if (!plan || plan.sku === null) return;
    setBusy(true);
    setBlocked(null);
    setFailed(false);
    const result = await continueWithPlan({ cart, addLine: mutations.addLine }, { offerKey: plan.key, sku: plan.sku, name: plan.name }, extras, replaceLineId);
    setBusy(false);
    if (result.status === 'done') {
      writeHandoff({ refused: result.refused, notices: result.notices });
      router.push('/bundle');
    } else if (result.status === 'choose') setBlocked(result.blocked);
    else if (result.blocked) setBlocked(result.blocked);
    else setFailed(true);
  }

  if (!context) return <p role="status" className="m-0 text-md text-text-muted">{t('loading')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <ContextBar context={context} actions={actions} />

      <div role="group" aria-label={t('family.label')} className="flex flex-wrap gap-3">
        {API_FAMILIES.map((name) => (
          <Chip
            key={name}
            selected={name === family}
            count={offers ? counts[name] : undefined}
            onClick={() => {
              setPickedFamily(name);
              setPickedKey(null);
            }}
          >
            {t(`family.${name}`)}
          </Chip>
        ))}
      </div>

      {offersError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="m-0 text-md">{t('error.offers')}</p>
          <Button size="sm" variant="secondary" onClick={retryOffers}>
            {t('error.retry')}
          </Button>
        </div>
      ) : !offers ? (
        <p role="status" className="m-0 text-md text-text-muted">
          {t('loading')}
        </p>
      ) : !plan ? (
        <p role="status" className="m-0 text-md">
          {context.location && !context.location.anyServed ? t('empty.notServed', { postalCode: context.location.postalCode }) : t('empty.plans')}
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <PlanList plans={familyPlans} selectedKey={planKey} onSelect={choose} />
          <div className="flex min-w-0 flex-col gap-6">
            <h2 className="m-0 font-display text-3xl font-bold tracking-ui">{plan.name}</h2>
            {cleared ? (
              <p role="status" className="m-0 rounded-lg bg-brand-100 p-4 text-sm">
                {t('detail.cleared')}
              </p>
            ) : null}
            {detailError ? (
              <div role="alert" className="flex flex-col items-start gap-3">
                <p className="m-0 text-md">{t('error.detail')}</p>
                <Button size="sm" variant="secondary" onClick={retryDetail}>
                  {t('error.retry')}
                </Button>
              </div>
            ) : !detail || detail.offer.key !== plan.key ? (
              <p role="status" aria-busy="true" className="m-0 text-md text-text-muted">
                {t('detail.loading')}
              </p>
            ) : (
              <DetailSections detail={detail} inDraft={(key) => extras.some((extra) => extra.offerKey === key)} onAdd={add} onRemove={(key) => setDraft((current) => removeExtra(current, key))} refusals={refusals} />
            )}
            <PriceStrip state={strip} />
            {blocked ? <BlockedAddNotice blocked={blocked} name={plan.name} onReplace={blocked.replace ? () => void proceed(blocked.replace?.removeLineId) : undefined} onDismiss={() => setBlocked(null)} /> : null}
            {failed ? (
              <p role="alert" className="m-0 text-sm text-danger">
                {tb('error.generic')}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={() => void proceed()} loading={busy}>
                {t('continue.withPlan', { name: plan.name })}
              </Button>
              <span aria-live="polite" className="text-sm text-text-muted">
                {t('continue.extras', { count: extras.length })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
