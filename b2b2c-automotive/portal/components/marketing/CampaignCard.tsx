/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Chip, type ChipTone } from '@/components/portal/Chip';
import { buttonPrimary, buttonSecondary, buttonSmall, cardClass, errorNote, hintClass, infoNote, labelClass, successNote } from '@/components/portal/kit';
import { Link } from '@/i18n/routing';
import { campaignApi, type CampaignView } from '@/hooks/marketingApi';
import { ClaimDialog } from './ClaimDialog';

const CLAIM_TONE: Record<CampaignView['claim']['status'], ChipTone> = { none: 'neutral', submitted: 'info', approved: 'success', rejected: 'critical' };

const pick = (text: Record<string, string> | undefined, locale: string): string => text?.[locale] ?? text?.['en-US'] ?? Object.values(text ?? {})[0] ?? '';

/** One Malva co-op campaign: approved copy (read only), the store's code, the discount action and the funding claim. */
export function CampaignCard({ campaign, storeKey, canEdit = true, onChanged }: { campaign: CampaignView; storeKey: string; canEdit?: boolean; onChanged: () => void }) {
  const t = useTranslations('marketing');
  const tp = useTranslations('permissions');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [copy, setCopy] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimSent, setClaimSent] = useState(false);

  const name = pick(campaign.name, locale);
  const caption = pick(campaign.caption, locale);
  const code = `${campaign.code}-${storeKey.toUpperCase()}`;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const discount = campaign.discount;
  const claimStatus = claimSent ? 'submitted' : campaign.claim.status;
  const claimOpen = claimStatus === 'none' || claimStatus === 'rejected';

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopy(t('copied'));
    } catch {
      setCopy(t('copyFailed'));
    }
  }

  async function createDiscount() {
    setBusy(true);
    setProblem('');
    const result = await campaignApi.createDiscount(storeKey, campaign.key);
    setBusy(false);
    if (result.ok && result.data) {
      setCreated(result.data.code);
      return onChanged();
    }
    setProblem(
      result.status === 403
        ? tp('insufficient')
        : result.code === 'CAMPAIGN_ENDED'
          ? t('errors.campaignEnded')
          : result.code === 'DISCOUNT_EXISTS'
            ? t('errors.discountExists')
            : result.code === 'CODE_TAKEN'
              ? t('errors.codeTaken')
              : t('errors.generic'),
    );
  }

  return (
    <article className={`${cardClass} flex flex-col gap-400`} aria-labelledby={`campaign-${campaign.key}`}>
      <header className="flex flex-wrap items-start justify-between gap-300">
        <div className="min-w-0">
          <h2 id={`campaign-${campaign.key}`} className="text-title-1 font-semibold text-text">
            {name}
          </h2>
          <p className="text-body-2 font-medium text-text-subdued">{t('fundsShare', { share: Math.round(campaign.fundingShare * 100) })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-200">
          {campaign.ended ? <Chip tone="neutral">{t('ended')}</Chip> : null}
          <Chip tone={CLAIM_TONE[claimStatus]}>
            {t('claimLabel')}: {t(`claimStatus.${claimStatus}`)}
          </Chip>
        </div>
      </header>

      <section className="flex flex-col gap-150">
        <h3 className={labelClass}>{t('captionLabel')}</h3>
        <blockquote data-testid="caption" className="rounded-300 bg-bg-surface-subdued px-400 py-300 text-body-1 font-medium text-text">
          {caption}
        </blockquote>
        <p className={hintClass}>{t('brandFunded')}</p>
      </section>

      <dl className="grid gap-300 text-body-2 sm:grid-cols-2">
        <div>
          <dt className={labelClass}>{t('codeLabel')}</dt>
          <dd data-testid="code" className="font-mono text-text">
            {code}
          </dd>
        </div>
        <div>
          <dt className={labelClass}>{t('datesLabel')}</dt>
          <dd className="text-text">{t('dates', { from: date.format(new Date(campaign.startsAt)), to: date.format(new Date(campaign.endsAt)) })}</dd>
        </div>
        <div>
          <dt className={labelClass}>{t('channelsLabel')}</dt>
          <dd className="text-text">{campaign.channels.join(', ')}</dd>
        </div>
        <div>
          <dt className={labelClass}>{t('eligibleLabel')}</dt>
          <dd className="text-text">
            {campaign.eligible.map((e) => `${pick(e.name as Record<string, string>, locale)} (${e.sku})`).join(', ')}
            {campaign.eligibleMore > 0 ? ` ${t('eligibleMore', { count: campaign.eligibleMore })}` : ''}
          </dd>
        </div>
      </dl>

      {discount ? (
        <p className={infoNote}>{discount.isActive ? t('discountActive', { code: discount.code }) : t('discountDraft', { code: discount.code })}</p>
      ) : null}
      {created && !discount ? (
        <p role="status" className={successNote}>
          {t('discountCreated', { code: created })}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className={errorNote}>
          {problem}
        </p>
      ) : null}
      {claimSent ? (
        <p role="status" className={successNote}>
          {t('claimSent')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-300">
        <button type="button" className={buttonSecondary} onClick={copyCaption}>
          {t('copyCaption')}
        </button>
        {discount || created ? (
          <Link href="/catalog/cart-discounts" className={buttonPrimary}>
            {t('openDiscount')}
          </Link>
        ) : (
          <button type="button" className={buttonPrimary} disabled={!canEdit || campaign.ended || busy} onClick={createDiscount}>
            {busy ? t('creating') : t('createDiscount')}
          </button>
        )}
        <button type="button" className={buttonSmall} disabled={!canEdit || !claimOpen} onClick={() => setClaiming(true)}>
          {t('submitClaim')}
        </button>
        <span role="status" aria-live="polite" className="text-caption-1 font-medium text-text-subdued">
          {copy}
        </span>
      </div>

      <ClaimDialog
        open={claiming}
        name={name}
        campaignKey={campaign.key}
        storeKey={storeKey}
        onClose={() => setClaiming(false)}
        onSent={() => {
          setClaiming(false);
          setClaimSent(true);
          onChanged();
        }}
      />
    </article>
  );
}
