/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { cardClass, errorNote, infoNote } from '@/components/portal/kit';
import { useViewer } from '@/context/ViewerContext';
import { useCampaigns } from '@/hooks/marketingApi';
import { usePermissions } from '@/hooks/usePermissions';
import { CampaignCard } from './CampaignCard';

/** The campaign cards of the Marketing page. The page gate and every route check the role on the server again. */
export function MarketingPage() {
  const t = useTranslations('marketing');
  const { storeKey } = useViewer();
  const { can } = usePermissions();
  const { data, error, mutate } = useCampaigns(storeKey);

  if (error) {
    return (
      <p role="alert" className={errorNote}>
        {t('error')}
      </p>
    );
  }
  if (!data) {
    return (
      <p role="status" className={infoNote}>
        {t('loading')}
      </p>
    );
  }
  if (data.campaigns.length === 0) return <p className={`${cardClass} text-body-2 text-text-subdued`}>{t('empty')}</p>;
  return (
    <div className="flex flex-col gap-400">
      {data.campaigns.map((campaign) => (
        <CampaignCard key={campaign.key} campaign={campaign} storeKey={storeKey} canEdit={can('marketing.manage')} onChanged={() => void mutate()} />
      ))}
    </div>
  );
}
